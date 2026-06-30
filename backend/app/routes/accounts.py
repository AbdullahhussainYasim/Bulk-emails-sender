from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.database import get_session
from app.models import Account, AccountUpdate, User
from app.services.security import encrypt_password
from app.routes.auth import get_current_user

router = APIRouter(prefix="/accounts", tags=["accounts"])

@router.post("", response_model=Account)
def create_account(account: Account, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    account.user_id = current_user.id
    account.encrypted_app_password = encrypt_password(account.encrypted_app_password)
    session.add(account)
    session.commit()
    session.refresh(account)
    return account

@router.get("", response_model=list[Account])
def read_accounts(session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    accounts = session.exec(select(Account).where(Account.user_id == current_user.id)).all()
    return accounts

@router.put("/{account_id}", response_model=Account)
def update_account(account_id: int, account_update: AccountUpdate, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    account = session.exec(select(Account).where(Account.id == account_id, Account.user_id == current_user.id)).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    update_data = account_update.dict(exclude_unset=True)
    
    if "encrypted_app_password" in update_data:
        if update_data["encrypted_app_password"]:
            if update_data["encrypted_app_password"] != account.encrypted_app_password:
                update_data["encrypted_app_password"] = encrypt_password(update_data["encrypted_app_password"])
        else:
            # If empty string was passed, do not update the password
            del update_data["encrypted_app_password"]
    
    for key, value in update_data.items():
        setattr(account, key, value)
        
    session.add(account)
    session.commit()
    session.refresh(account)
    return account

@router.delete("/{account_id}")
def delete_account(account_id: int, session: Session = Depends(get_session), current_user: User = Depends(get_current_user)):
    account = session.exec(select(Account).where(Account.id == account_id, Account.user_id == current_user.id)).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    try:
        from app.models import Client, EmailLog
        # Unlink clients
        clients = session.exec(select(Client).where(Client.sent_via_account_id == account_id, Client.user_id == current_user.id)).all()
        for client in clients:
            client.sent_via_account_id = None
            session.add(client)
            
        # Delete related email logs
        logs = session.exec(select(EmailLog).where(EmailLog.account_id == account_id, EmailLog.user_id == current_user.id)).all()
        for log in logs:
            session.delete(log)
            
        session.commit() # Commit the unlinking and log deletion first
        
        session.delete(account)
        session.commit()
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
        
    return {"ok": True}
