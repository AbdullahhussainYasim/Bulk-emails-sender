from fastapi import APIRouter
from app.tasks.email_tasks import send_emails_for_account_task
from sqlmodel import Session, select
from app.database import engine
from app.models import Account
import redis
import os

router = APIRouter(prefix="/send", tags=["send"])

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.Redis.from_url(REDIS_URL.replace("CERT_NONE", "none"), decode_responses=True)
STOP_KEY = "sending_stopped"

@router.post("/start")
def start_sending():
    if redis_client.get("sending_active") == "true":
        return {"message": "Sending already in progress"}

    redis_client.set("sending_active", "true")
    redis_client.set(STOP_KEY, "false")
    
    with Session(engine) as session:
        accounts = session.exec(select(Account)).all()
        if not accounts:
            redis_client.delete("sending_active")
            return {"message": "No configured email accounts found"}
            
        for account in accounts:
            send_emails_for_account_task.delay(account.id)
            
    return {"message": f"Sending started concurrently across {len(accounts)} accounts"}

@router.post("/stop")
def stop_sending():
    redis_client.set(STOP_KEY, "true")
    return {"message": "Stopping sending process..."}

@router.get("/status")
def get_status():
    stopped = redis_client.get(STOP_KEY)
    status = "Stopped" if stopped == "true" else "Running"
    # Note: This is simplistic. Ideally check if Celery task is actually active.
    return {"status": status}
