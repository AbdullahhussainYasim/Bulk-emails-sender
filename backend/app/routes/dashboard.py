from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func
from app.database import get_session
from app.models import Client, Account, ClientStatus
from datetime import date, datetime

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/stats")
def get_stats(session: Session = Depends(get_session)):
    total_clients = session.exec(select(func.count(Client.id))).one()
    pending_clients = session.exec(select(func.count(Client.id)).where(Client.status == ClientStatus.PENDING)).one()
    # "Sent today" - simplistic check: clients sent today
    # Better: check sent_at timestamp >= today midnight
    today_start = datetime.combine(date.today(), datetime.min.time())
    sent_today_clients = session.exec(select(func.count(Client.id)).where(Client.stats == ClientStatus.SENT, Client.sent_at >= today_start)).one() if False else 0 # Fix logic below
    
    # Actually Client doesn't track *when* it was sent in easily queryable way if we only update status. 
    # But we added sent_at in Client model.
    sent_today = session.exec(select(func.count(Client.id)).where(Client.status == ClientStatus.SENT, Client.sent_at >= today_start)).one()
    
    failed_clients = session.exec(select(func.count(Client.id)).where(Client.status == ClientStatus.FAILED)).one()
    
    total_accounts = session.exec(select(func.count(Account.id))).one()
    
    accounts = session.exec(select(Account)).all()
    account_stats = []
    for acc in accounts:
        account_stats.append({
            "email": acc.email,
            "daily_limit": acc.daily_limit,
            "sent_today": acc.sent_today,
            "remaining": max(0, acc.daily_limit - acc.sent_today)
        })
        
    return {
        "total_clients": total_clients,
        "pending": pending_clients,
        "sent_today": sent_today,
        "failed": failed_clients,
        "total_accounts": total_accounts,
        "accounts": account_stats,
        "status": "Stopped" # TODO: Fetch real status from Redis
    }
