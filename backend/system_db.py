from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey, DateTime, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import datetime
import os

DB_DIR = os.path.dirname(os.path.abspath(__file__))
SYSTEM_DB_PATH = os.path.join(DB_DIR, "system_core.db")
engine = create_engine(f"sqlite:///{SYSTEM_DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    name = Column(String, nullable=True)
    password_hash = Column(String, nullable=True)
    provider = Column(String, default="local") # local, google, guest
    settings = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    conversations = relationship("Conversation", back_populates="owner")

class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(String, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, default="New Analysis")
    db_config = Column(JSON, nullable=True) # stores connection details for this specific chat
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    owner = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(String, ForeignKey("conversations.id"))
    role = Column(String) # human, ai
    parts = Column(JSON) # stores the detailed parts (text, chart, mermaid, etc.)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    conversation = relationship("Conversation", back_populates="messages")

def init_system_db():
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    init_system_db()
    print(f"System Database initialized at {SYSTEM_DB_PATH}")
