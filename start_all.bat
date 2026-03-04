@echo off
echo Starting all services...
echo WARNING: You must have Redis running separately for the backend/worker to function correctly!

start "Backend API" cmd /c start_backend.bat
timeout /t 5
start "Celery Worker" cmd /c start_worker.bat
start "Frontend" cmd /c start_frontend.bat

echo Services launching in separate windows...
pause
