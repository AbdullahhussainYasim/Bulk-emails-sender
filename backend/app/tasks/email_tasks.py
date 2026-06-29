from app.celery_app import celery_app
from sqlmodel import Session, select
from app.database import engine
from app.models import Account, Client, ClientStatus, EmailLog, EmailTemplate
from app.services.email_service import send_email_via_smtp
from jinja2 import Template
import time
import random
import redis
import os
import logging
from datetime import datetime
from sqlalchemy.exc import SQLAlchemyError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.Redis.from_url(REDIS_URL.replace("CERT_NONE", "none"), decode_responses=True)

STOP_KEY = "sending_stopped"

@celery_app.task
def send_bulk_emails_task():
    logger.info("Starting send_bulk_emails_task")
    
    # Check stop signal
    if redis_client.get(STOP_KEY) == "true":
        logger.info("Task stopped by user signal")
        return "Stopped"
    
    # Reset stop key to ensure we run
    redis_client.set(STOP_KEY, "false")
    
    try:
        with Session(engine) as session:
            # 1. Fetch active template
            template_model = session.exec(select(EmailTemplate).where(EmailTemplate.is_active == True)).first()
            if not template_model:
                logger.error("No active email template found")
                return "No template found"
                
            raw_subject = template_model.subject
            raw_body = template_model.body
            
            # 2. Fetch pending clients
            pending_clients = session.exec(select(Client).where(Client.status == "pending")).all()
            if not pending_clients:
                logger.info("No pending clients found")
                return "No pending clients"
            
            logger.info(f"Found {len(pending_clients)} pending clients")
                
            # 3. Fetch accounts
            accounts = session.exec(select(Account)).all()
            if not accounts:
                logger.error("No email accounts configured")
                return "No accounts found"

            logger.info(f"Found {len(accounts)} email accounts")
            
            clients_idx = 0
            total_clients = len(pending_clients)
            
            emails_sent_count = 0

            for account in accounts:
                # Check stop signal inside loop
                if redis_client.get(STOP_KEY) == "true":
                    logger.info("Stopping loop due to signal")
                    break
                
                # Dynamic daily limit reset check
                if account.last_reset.date() < datetime.utcnow().date():
                    logger.info(f"Dynamic daily limit reset for {account.email}")
                    account.sent_today = 0
                    account.last_reset = datetime.utcnow()
                    session.add(account)
                    session.commit()
                    
                remaining = account.daily_limit - account.sent_today
                if remaining <= 0:
                    logger.info(f"Account {account.email} limit reached ({account.sent_today}/{account.daily_limit})")
                    continue
                    
                logger.info(f"Using account {account.email}. Remaining quota: {remaining}")

                # Send loop for this account
                while remaining > 0 and clients_idx < total_clients:
                    if redis_client.get(STOP_KEY) == "true":
                        break
                        
                    client = pending_clients[clients_idx]
                    clients_idx += 1
                    
                    # Client Name & Sender Name replacement
                    client_name_str = client.name or ""
                    sender_name_str = account.name or account.email.split("@")[0]
                    
                    try:
                        subject = raw_subject.replace("{{client_name}}", client_name_str).replace("{client_name}", client_name_str)
                        subject = subject.replace("{{sender_name}}", sender_name_str).replace("{sender_name}", sender_name_str)
                        
                        body = raw_body.replace("{{client_name}}", client_name_str).replace("{client_name}", client_name_str)
                        body = body.replace("{{sender_name}}", sender_name_str).replace("{sender_name}", sender_name_str)
                        
                        logger.info(f"Sending email to {client.email} via {account.email}")
                        
                        # Send
                        success, error = send_email_via_smtp(account, client.email, subject, body)
                        
                        # Update DB
                        if success:
                            client.status = "sent"
                            account.sent_today += 1
                            remaining -= 1 # Decrement local counter
                            emails_sent_count += 1
                            logger.info(f"Successfully sent to {client.email}")
                        else:
                            client.status = "failed"
                            client.retry_count += 1
                            if client.retry_count < 2:
                                client.status = "pending" # Retry later
                            logger.error(f"Failed to send to {client.email}: {error}")
                            
                        client.sent_via_account_id = account.id
                        client.sent_at = datetime.utcnow()
                        
                        # Log entry
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
                        
                        # Random Delay based on Account Settings
                        delay = random.randint(account.delay_min, account.delay_max)
                        logger.info(f"Sleeping for {delay} seconds (Range: {account.delay_min}-{account.delay_max})...")
                        time.sleep(delay)
                        
                    except Exception as e:
                        logger.error(f"Error processing client {client.email}: {e}")
                        continue
                        
                if clients_idx >= total_clients:
                    break
            
            return f"Processed {emails_sent_count} emails"

    except Exception as e:
        logger.error(f"Critical error in email task: {e}")
        return f"Error: {e}"
        
    finally:
        # Release the lock so it can be started again
        redis_client.delete("sending_active")
        logger.info("Task finished, lock released.")

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
