from sqlmodel import SQLModel
from app.database import engine
from app.models import * # Import all models to register them with SQLModel metadata

def reset_database():
    print("WARNING: Dropping all tables...")
    SQLModel.metadata.drop_all(engine)
    print("Recreating all tables with multi-tenant user schema...")
    SQLModel.metadata.create_all(engine)
    print("Database reset complete.")

if __name__ == "__main__":
    reset_database()
