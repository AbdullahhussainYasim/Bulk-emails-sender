@echo off
cd frontend
if not exist node_modules (
    echo Installing node modules...
    npm install
)
echo Starting Frontend...
npm run dev
pause
