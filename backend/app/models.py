from typing import Optional
from sqlmodel import Field, SQLModel
from datetime import datetime
from enum import Enum

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ClientStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"

class Account(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    name: Optional[str] = Field(default=None)
    email: str = Field(unique=True, index=True)
    encrypted_app_password: str
    daily_limit: int = Field(default=50)
    sent_today: int = Field(default=0)
    last_reset: datetime = Field(default_factory=datetime.utcnow)
    delay_min: int = Field(default=30)
    delay_max: int = Field(default=90)

class AccountUpdate(SQLModel):
    name: Optional[str] = None
    email: Optional[str] = None
    encrypted_app_password: Optional[str] = None
    daily_limit: Optional[int] = None
    delay_min: Optional[int] = None
    delay_max: Optional[int] = None

class Client(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    name: str
    email: str = Field(index=True) # Removed unique=True so different users can have the same client email
    status: ClientStatus = Field(default=ClientStatus.PENDING)
    retry_count: int = Field(default=0)
    sent_via_account_id: Optional[int] = Field(default=None, foreign_key="account.id")
    sent_at: Optional[datetime] = Field(default=None)

class EmailLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    client_id: int = Field(foreign_key="client.id")
    account_id: int = Field(foreign_key="account.id")
    status: str
    error_message: Optional[str] = Field(default=None)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class EmailTemplate(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    name: str = Field(default="Default Template")
    subject: str
    body: str
    is_active: bool = Field(default=False)

class Settings(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    delay_min: int = Field(default=30)
    delay_max: int = Field(default=90)
    retry_attempts: int = Field(default=2)
