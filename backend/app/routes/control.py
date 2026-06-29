from fastapi import APIRouter
from app.tasks.email_tasks import send_bulk_emails_task
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
    # Trigger Celery task asynchronously
    send_bulk_emails_task.delay()
    return {"message": "Sending started"}

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
