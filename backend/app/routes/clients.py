from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session, select
from app.database import get_session
from app.models import Client, ClientStatus, User
from app.routes.auth import get_current_user
from typing import List
import csv
import io

router = APIRouter(prefix="/clients", tags=["clients"])

@router.post("/upload")
async def upload_clients(file: UploadFile = File(...), session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    contents = await file.read()
    decoded_content = contents.decode("utf-8")
    csv_reader = csv.DictReader(io.StringIO(decoded_content))
    
    count = 0
    for row in csv_reader:
        if "client_email" not in row:
             continue # or raise error
             
        email = row.get("client_email")
        name = row.get("client_name", "")
        
        # Check if exists for THIS user
        existing = session.exec(select(Client).where(Client.email == email, Client.user_id == current_user.id)).first()
        if existing:
            continue
            
        client = Client(name=name, email=email, status=ClientStatus.PENDING, user_id=current_user.id)
        session.add(client)
        count += 1
    
    session.commit()
    return {"message": f"Successfully added {count} clients"}

@router.get("", response_model=List[Client])
def read_clients(
    status: str = None, 
    offset: int = 0, 
    limit: int = 100, 
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    query = select(Client).where(Client.user_id == current_user.id)
    if status:
        query = query.where(Client.status == status)
    query = query.offset(offset).limit(limit)
    return session.exec(query).all()

@router.post("/{client_id}/reset")
def reset_client(client_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    client = session.exec(select(Client).where(Client.id == client_id, Client.user_id == current_user.id)).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.status = ClientStatus.PENDING
    client.retry_count = 0
    client.sent_via_account_id = None
    client.sent_at = None
    session.commit()
    return {"message": "Client reset to pending"}

@router.delete("/{client_id}")
def delete_client(client_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    client = session.exec(select(Client).where(Client.id == client_id, Client.user_id == current_user.id)).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
        
    try:
        from app.models import EmailLog
        # Delete related email logs first due to foreign key constraints
        logs = session.exec(select(EmailLog).where(EmailLog.client_id == client_id, EmailLog.user_id == current_user.id)).all()
        for log in logs:
            session.delete(log)
            
        session.commit()
        
        session.delete(client)
        session.commit()
        return {"ok": True}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
