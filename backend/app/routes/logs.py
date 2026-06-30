from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from app.database import get_session
from app.models import EmailLog, User
from app.routes.auth import get_current_user
from typing import List

router = APIRouter(prefix="/logs", tags=["logs"])

@router.get("", response_model=List[EmailLog])
def read_logs(
    limit: int = 100, 
    offset: int = 0, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    logs = session.exec(select(EmailLog).where(EmailLog.user_id == current_user.id).order_by(EmailLog.timestamp.desc()).offset(offset).limit(limit)).all()
    return logs
