"""
Initialize SQLite Database
Creates all tables based on SQLAlchemy models
"""

import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine
from app.models import Base

# Load environment variables
load_dotenv()

def init_database():
    """Initialize database and create all tables"""
    
    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL', 'sqlite:///collab_edit.db')
    
    print(f"Initializing database: {database_url}")
    
    # Create engine
    engine = create_engine(database_url, echo=True)
    
    try:
        # Create all tables
        Base.metadata.create_all(engine)
        print("\nDatabase initialized successfully!")
        print("Tables created:")
        for table in Base.metadata.sorted_tables:
            print(f"  - {table.name}")
        
        return True
    except Exception as e:
        print(f"\n❌ Error initializing database: {str(e)}")
        return False

if __name__ == '__main__':
    success = init_database()
    sys.exit(0 if success else 1)
