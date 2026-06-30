from cryptography.fernet import Fernet
import os
from dotenv import load_dotenv
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta

load_dotenv()

# JWT Config
SECRET_KEY = os.getenv("SECRET_KEY", "change_this_to_a_random_secret_string")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Fernet Key Config for App Passwords
KEY = os.getenv("FERNET_KEY")

try:
    if not KEY or KEY == "change_this_to_a_valid_fernet_key":
        raise ValueError("Invalid or missing key")
    
    KEY = KEY.strip() if isinstance(KEY, str) else KEY
    cipher_suite = Fernet(KEY.encode() if isinstance(KEY, str) else KEY)
except Exception as e:
    print(f"WARNING: Invalid FERNET_KEY found. Generating a temporary key.")
    KEY = Fernet.generate_key().decode()
    cipher_suite = Fernet(KEY.encode())

def encrypt_password(password: str) -> str:
    return cipher_suite.encrypt(password.encode()).decode()

def decrypt_password(encrypted_password: str) -> str:
    try:
        return cipher_suite.decrypt(encrypted_password.encode()).decode()
    except Exception as e:
        print(f"DECRYPTION ERROR: {e}")
        raise e
