# Cold Email Automation System

A full-stack application for automating cold email campaigns with multiple Gmail accounts, daily limits, and background processing.

## Tech Stack

- **Backend**: FastAPI, SQLModel (SQLite/PostgreSQL), Celery, Redis
- **Frontend**: React, Vite, Tailwind CSS, TanStack Query
- **Email**: SMTP (Gmail)

## Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Redis** (Local or via Docker)

## Setup Instructions (Local Development)

### 1. Redis Setup
Ensure Redis is running on default port `6379`.
On Windows, you can use WSL or run via Docker:
```bash
docker run -d -p 6379:6379 redis
```

### 2. Backend Setup
```bash
cd backend
python -m venv venv
# Activate venv:
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

pip install -r requirements.txt
```

Create `.env` file in `backend/` (copy `.env.example`):
```ini
DATABASE_URL=sqlite:///./cold_email.db
SECRET_KEY=your_secret_key
REDIS_URL=redis://localhost:6379/0
FERNET_KEY=your_fernet_key # Generate one using cryptography.fernet.Fernet.generate_key()
```

Run the API:
```bash
uvicorn app.main:app --reload
```

Run Celery Worker (in a separate terminal):
**Windows Note**: Use `--pool=solo` for Windows compatibility.
```bash
cd backend
# With venv activated:
celery -A app.celery_app worker --loglevel=info --pool=solo
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`.

## Docker Setup (Recommended for Production)

1. Ensure Docker Desktop is running.
2. Run:
```bash
docker-compose up --build
```
This will start Backend, Frontend, Redis, and Celery Worker.
Access Frontend at `http://localhost:5173` (or port 80 if configured).

## Usage Guide

1. **Dashboard**: View overall stats.
2. **Accounts**: Add Gmail accounts. You MUST use an **App Password** (Manage Google Account -> Security -> 2-Step Verification -> App Passwords).
3. **Clients**: Upload a CSV file with headers: `client_name`, `client_email`.
4. **Template**: Set your email subject and body. Use {{client_name}} and {{sender_name}} as placeholders.
5. **Send**: Click "Start Sending". The system will distribute emails across accounts.
6. **Logs**: Monitor delivery status.

## Security Note
App passwords are encrypted in the database. Ensure `FERNET_KEY` is kept secure in `.env`.
