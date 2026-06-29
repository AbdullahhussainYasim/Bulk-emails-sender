#!/bin/bash

# Start Celery Worker in background
celery -A app.celery_app worker --concurrency=1 --loglevel=info &

# Start Celery Beat in background (for scheduled tasks)
celery -A app.celery_app beat --loglevel=info &

# Start FastAPI application
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
