@echo off
cd backend
if not exist venv (
    echo Virtual environment not found. Please run start_backend.bat first to create it.
    pause
    exit
)
call venv\Scripts\activate
echo Starting Celery Worker...
celery -A app.celery_app worker --loglevel=info --pool=solo
pause
