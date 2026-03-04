from celery import Celery
import os
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "cold_email",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.tasks.email_tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    "reset-daily-limits-at-midnight": {
        "task": "app.tasks.email_tasks.reset_daily_limits_task",
        "schedule": crontab(hour=0, minute=0),
    },
}
