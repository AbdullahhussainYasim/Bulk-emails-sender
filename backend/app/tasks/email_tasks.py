from app.celery_app import celery_app
from sqlmodel import Session, select
from app.database import engine
from app.models import Account, Client, EmailLog, EmailTemplate
from app.services.email_service import send_email_via_smtp
import random
import redis
import os
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.Redis.from_url(REDIS_URL.replace("CERT_NONE", "none"), decode_responses=True)

STOP_KEY = "sending_stopped"

@celery_app.task(bind=True)
def send_emails_for_account_task(self, account_id: int):
    """
    1. Fixes 'Sleep Blocking': Uses apply_async(countdown) instead of time.sleep()
    2. Parallel Account Sending: Operates entirely independently for this specific account
    3. Database Memory Limit: Only fetches 1 client at a time instead of all
    """
    logger.info(f"Starting task for account_id: {account_id}")
    
    # Check user stop signal
    if redis_client.get(STOP_KEY) == "true":
        logger.info(f"Task for account {account_id} stopped by user signal")
        redis_client.delete("sending_active")
        return "Stopped"
        
    try:
        with Session(engine) as session:
            # Check Account
            account = session.get(Account, account_id)
            if not account:
                logger.error(f"Account {account_id} not found")
                return "Account not found"
                
            # Dynamic daily limit reset check
            if account.last_reset.date() < datetime.utcnow().date():
                logger.info(f"Dynamic daily limit reset for {account.email}")
                account.sent_today = 0
                account.last_reset = datetime.utcnow()
                session.add(account)
                session.commit()
                
            remaining = account.daily_limit - account.sent_today
            if remaining <= 0:
                logger.info(f"Account {account.email} limit reached")
                # Don't schedule another run for this account
                return "Limit reached"
                
            # Fetch active template
            template_model = session.exec(select(EmailTemplate).where(EmailTemplate.is_active == True)).first()
            if not template_model:
                logger.error("No active email template found")
                redis_client.delete("sending_active")
                return "No template found"
                
            raw_subject = template_model.subject
            raw_body = template_model.body
            
            # MEMORY FIX: Fetch exactly 1 pending client instead of all of them
            client = session.exec(
                select(Client)
                .where(Client.status == "pending")
                .limit(1)
            ).first()
            
            if not client:
                logger.info(f"No more pending clients for account {account.email}")
                redis_client.delete("sending_active")
                return "No pending clients"
                
            # Immediately lock this client so parallel workers don't grab it
            client.status = "processing"
            session.add(client)
            session.commit()
            
            # Prepare email
            client_name_str = client.name or ""
            sender_name_str = account.name or account.email.split("@")[0]
            
            subject = raw_subject.replace("{{client_name}}", client_name_str).replace("{client_name}", client_name_str)
            subject = subject.replace("{{sender_name}}", sender_name_str).replace("{sender_name}", sender_name_str)
            
            body = raw_body.replace("{{client_name}}", client_name_str).replace("{client_name}", client_name_str)
            body = body.replace("{{sender_name}}", sender_name_str).replace("{sender_name}", sender_name_str)
            
            logger.info(f"Sending email to {client.email} via {account.email}")
            
            # Send (Now includes 10-second strict timeout)
            success, error = send_email_via_smtp(account, client.email, subject, body)
            
            if success:
                client.status = "sent"
                account.sent_today += 1
                logger.info(f"Successfully sent to {client.email}")
            else:
                client.status = "failed"
                client.retry_count += 1
                if client.retry_count < 2:
                    client.status = "pending" # Retry later
                logger.error(f"Failed to send to {client.email}: {error}")
                
            client.sent_via_account_id = account.id
            client.sent_at = datetime.utcnow()
            
            log = EmailLog(
                client_id=client.id,
                account_id=account.id,
                status="sent" if success else "failed",
                error_message=error,
                timestamp=datetime.utcnow()
            )
            
            session.add(log)
            session.add(client)
            session.add(account)
            session.commit()
            
            # SLEEP BLOCKING FIX: Enqueue next email in Celery natively instead of time.sleep()
            delay = random.randint(account.delay_min, account.delay_max)
            logger.info(f"Scheduling next email for account {account.email} in {delay} seconds...")
            
            # Re-enqueue this EXACT task for this EXACT account after 'delay' seconds
            send_emails_for_account_task.apply_async(args=[account_id], countdown=delay)
            
            return f"Processed {client.email}"

    except Exception as e:
        logger.error(f"Critical error in task for account {account_id}: {e}")
        redis_client.delete("sending_active")
        return f"Error: {e}"

@celery_app.task
def reset_daily_limits_task():
    logger.info("Running daily limit reset")
    with Session(engine) as session:
        accounts = session.exec(select(Account)).all()
        for acc in accounts:
            acc.sent_today = 0
            acc.last_reset = datetime.utcnow()
            session.add(acc)
        session.commit()
    logger.info("Daily limits reset complete")
