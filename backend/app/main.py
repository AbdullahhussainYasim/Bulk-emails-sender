from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import create_db_and_tables

app = FastAPI(title="Cold Email Automation")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from .routes import accounts, clients, templates, dashboard, logs, control, inbox, auth

app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(clients.router)
app.include_router(templates.router)
app.include_router(dashboard.router)
app.include_router(logs.router)
app.include_router(control.router)
app.include_router(inbox.router)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()
    # Clear any stale locks on startup
    import redis
    import os
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    try:
        r = redis.Redis.from_url(REDIS_URL.replace("CERT_NONE", "none"), decode_responses=True)
        r.delete("sending_active")
        r.delete("sending_stopped") # Reset stop signal too
        print("Startup: Cleared sending locks.")
    except Exception as e:
        print(f"Startup Warning: Could not clear Redis locks: {e}")

@app.get("/")
def read_root():
    return {"message": "Cold Email Automation API is running"}
