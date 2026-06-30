from fastapi import APIRouter, Depends
from app.tasks.email_tasks import send_emails_for_account_task
from sqlmodel import Session, select
from app.database import engine
from app.models import Account, User
from app.routes.auth import get_current_user
import redis
import os

router = APIRouter(prefix="/send", tags=["send"])

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.Redis.from_url(REDIS_URL.replace("CERT_NONE", "none"), decode_responses=True)

@router.post("/start")
def start_sending(current_user: User = Depends(get_current_user)):
    user_active_key = f"sending_active_{current_user.id}"
    user_stop_key = f"sending_stopped_{current_user.id}"
    
    if redis_client.get(user_active_key) == "true":
        return {"message": "Sending already in progress"}

    redis_client.set(user_active_key, "true")
    redis_client.set(user_stop_key, "false")
    
    with Session(engine) as session:
        accounts = session.exec(select(Account).where(Account.user_id == current_user.id)).all()
        if not accounts:
            redis_client.delete(user_active_key)
            return {"message": "No configured email accounts found"}
            
        for account in accounts:
            send_emails_for_account_task.delay(account.id)
            
    return {"message": f"Sending started concurrently across {len(accounts)} accounts"}

@router.post("/stop")
def stop_sending(current_user: User = Depends(get_current_user)):
    user_stop_key = f"sending_stopped_{current_user.id}"
    redis_client.set(user_stop_key, "true")
    return {"message": "Stopping sending process..."}

@router.get("/status")
def get_status(current_user: User = Depends(get_current_user)):
    user_active_key = f"sending_active_{current_user.id}"
    active = redis_client.get(user_active_key)
    status = "Running" if active == "true" else "Stopped"
    return {"status": status}
