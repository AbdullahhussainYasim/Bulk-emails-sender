@echo off
echo Resetting clients to PENDING...
docker exec cold_email_backend python reset_clients.py
echo.
echo Process complete.
pause
