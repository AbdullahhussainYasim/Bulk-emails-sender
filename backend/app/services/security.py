from cryptography.fernet import Fernet
import os
from dotenv import load_dotenv

load_dotenv()

# Generate a key if not provided (for dev), but in prod it should be fixed
# Generate a key if not provided (for dev), but in prod it should be fixed
KEY = os.getenv("FERNET_KEY")

try:
    if not KEY or KEY == "change_this_to_a_valid_fernet_key":
        raise ValueError("Invalid or missing key")
    
    # Strip any accidental whitespace
    KEY = KEY.strip() if isinstance(KEY, str) else KEY
    
    cipher_suite = Fernet(KEY.encode() if isinstance(KEY, str) else KEY)
except Exception as e:
    print(f"WARNING: Invalid FERNET_KEY found: '{KEY}' (Type: {type(KEY)}). Error: {e}")
    print("Generating a temporary key. NOTE: Passwords encrypted by other services will NOT be decryptable.")
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
