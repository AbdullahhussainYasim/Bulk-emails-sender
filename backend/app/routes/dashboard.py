from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func
from app.database import get_session
from app.models import Client, Account, ClientStatus, User
from app.routes.auth import get_current_user
from datetime import date, datetime

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/stats")
def get_stats(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    total_clients = session.exec(select(func.count(Client.id)).where(Client.user_id == current_user.id)).one()
    pending_clients = session.exec(select(func.count(Client.id)).where(Client.status == ClientStatus.PENDING, Client.user_id == current_user.id)).one()
    
    today_start = datetime.combine(date.today(), datetime.min.time())
    
    sent_today = session.exec(select(func.count(Client.id)).where(Client.status == ClientStatus.SENT, Client.sent_at >= today_start, Client.user_id == current_user.id)).one()
    
    failed_clients = session.exec(select(func.count(Client.id)).where(Client.status == ClientStatus.FAILED, Client.user_id == current_user.id)).one()
    
    total_accounts = session.exec(select(func.count(Account.id)).where(Account.user_id == current_user.id)).one()
    
    accounts = session.exec(select(Account).where(Account.user_id == current_user.id)).all()
    account_stats = []
    for acc in accounts:
        account_stats.append({
            "email": acc.email,
            "daily_limit": acc.daily_limit,
            "sent_today": acc.sent_today,
            "remaining": max(0, acc.daily_limit - acc.sent_today)
        })
        
    import redis
    import os
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    redis_client = redis.Redis.from_url(REDIS_URL.replace("CERT_NONE", "none"), decode_responses=True)
    status_str = "Running" if redis_client.get(f"sending_active_{current_user.id}") == "true" else "Stopped"
        
    return {
        "total_clients": total_clients,
        "pending": pending_clients,
        "sent_today": sent_today,
        "failed": failed_clients,
        "total_accounts": total_accounts,
        "accounts": account_stats,
        "status": status_str
    }
