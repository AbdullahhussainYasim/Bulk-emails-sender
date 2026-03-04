from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from app.database import get_session
from app.models import EmailLog
from typing import List

router = APIRouter(prefix="/logs", tags=["logs"])

@router.get("/", response_model=List[EmailLog])
def read_logs(
    limit: int = 100, 
    offset: int = 0, 
    session: Session = Depends(get_session)
):
    logs = session.exec(select(EmailLog).order_by(EmailLog.timestamp.desc()).offset(offset).limit(limit)).all()
    return logs
