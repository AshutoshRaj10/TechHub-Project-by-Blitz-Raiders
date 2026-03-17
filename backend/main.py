import os
import secrets
import json
import re
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session

# Local Imports
from agent import (
    process_message_stream, 
    connect_sqlite_path, connect_mysql, connect_csv, 
    session, generate_suggestions, set_openai_key
)
from system_db import SessionLocal, init_system_db, User, Conversation, Message
from auth_utils import get_password_hash, verify_password, create_access_token, decode_access_token

app = FastAPI(title="Intelligence Engine API")
init_system_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Dependency ──────────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

async def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload: return None
    user_id = payload.get("sub")
    return db.query(User).filter(User.id == user_id).first()

# ─── Pydantic models ─────────────────────────────────────────────────────────
class AuthRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None

class ChatRequest(BaseModel):
    message: str
    chat_id: str

class SQLiteConnectRequest(BaseModel):
    path: str
    chat_id: str

class MySQLConnectRequest(BaseModel):
    host: str
    port: int = 3306
    user: str
    password: str
    database: str
    chat_id: str

class OpenAIKeyRequest(BaseModel):
    key: str

# ─── Helper: Save Connection Info ───────────────────────────────────────────
def save_conn_info(db: Session, chat_id: str, user_id: int, type: str, config: dict, label: str):
    conv = db.query(Conversation).filter(Conversation.id == chat_id).first()
    if not conv:
        conv = Conversation(id=chat_id, user_id=user_id, title=label)
        db.add(conv)
    conv.db_config = {"type": type, "config": config, "label": label}
    db.commit()

# ─── Authentication Endpoints ────────────────────────────────────────────────
@app.post("/api/auth/register")
def register(req: AuthRequest, db: Session = Depends(get_db)):
    user = User(
        email=req.email, 
        name=req.name or req.email.split('@')[0], 
        password_hash=get_password_hash(req.password), 
        provider="local"
    )
    db.add(user)
    db.commit()
    token = create_access_token({"sub": str(user.id)})
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name, "type": user.provider}}

@app.post("/api/auth/login")
def login(req: AuthRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id)})
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name or user.email.split('@')[0], "type": user.provider}}

@app.post("/api/auth/guest")
def guest_login(db: Session = Depends(get_db)):
    user = User(provider="guest")
    db.add(user)
    db.commit()
    token = create_access_token({"sub": str(user.id)})
    return {"token": token, "user": {"id": user.id, "name": "Guest Explorer", "type": "guest"}}
@app.get("/api/auth/me")
def get_me(user: User = Depends(get_current_user)):
    if not user: raise HTTPException(401)
    return {"user": {"id": user.id, "email": user.email, "name": user.email.split('@')[0] if user.email else "Guest Explorer", "type": user.provider}}

# ─── Connection Endpoints ────────────────────────────────────────────────────
@app.post("/api/config/openai")
def update_openai(req: OpenAIKeyRequest):
    success = set_openai_key(req.key)
    if not success: raise HTTPException(status_code=400, detail="Invalid key")
    return {"ok": True}

@app.post("/api/connect/sqlite")
def connect_sqlite_endpoint(req: SQLiteConnectRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    res = connect_sqlite_path(req.path)
    if res["ok"] and user:
        save_conn_info(db, req.chat_id, user.id, "sqlite", {"path": req.path}, res["label"])
    return res

@app.post("/api/connect/mysql")
def connect_mysql_endpoint(req: MySQLConnectRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    res = connect_mysql(req.host, req.port, req.user, req.password, req.database)
    if res["ok"] and user:
        config = {"host": req.host, "port": req.port, "user": req.user, "password": req.password, "database": req.database}
        save_conn_info(db, req.chat_id, user.id, "mysql", config, res["label"])
    return res

@app.post("/api/connect/csv")
async def connect_csv_endpoint(chat_id: str = Form(...), file: UploadFile = File(...), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not file.filename.endswith(".csv"): raise HTTPException(400, "CSVs only")
    content = await file.read()
    res = connect_csv(content, file.filename)
    if res["ok"] and user:
        # For CSV, we can't easily store 'bytes' in JSON, but connect_csv already saves it to uploads/
        # Next time we'll just connect to the generated sqlite db.
        # We'll rely on the existing label/schema. For revival, CSV is a bit special.
        save_conn_info(db, chat_id, user.id, "csv", {"filename": file.filename}, res["label"])
    return res

# ─── Chat & History ──────────────────────────────────────────────────────────
@app.get("/api/history")
def get_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user: return []
    convs = db.query(Conversation).filter(Conversation.user_id == user.id).order_by(Conversation.created_at.desc()).all()
    return [{"id": c.id, "title": c.title, "date": c.created_at} for c in convs]

@app.get("/api/chat/{chat_id}/messages")
def get_chat_messages(chat_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user: raise HTTPException(401)
    conv = db.query(Conversation).filter(Conversation.id == chat_id, Conversation.user_id == user.id).first()
    if not conv: raise HTTPException(404)
    
    # Revival logic: Auto-reconnect if there's a config
    conn_info = None
    if conv.db_config:
        cfg = conv.db_config.get("config")
        ctype = conv.db_config.get("type")
        try:
            if ctype == "sqlite": connect_sqlite_path(cfg["path"])
            elif ctype == "mysql": connect_mysql(cfg["host"], cfg["port"], cfg["user"], cfg["password"], cfg["database"])
            elif ctype == "csv": 
                # For CSV revival, find the .db file in uploads/
                table_name = re.sub(r"[^a-z0-9_]", "_", os.path.splitext(cfg["filename"])[0].lower())
                if not table_name or table_name[0].isdigit():
                    table_name = "data_" + table_name
                db_path = os.path.join(os.path.dirname(__file__), "uploads", f"{table_name}.db")
                if os.path.exists(db_path):
                    from sqlalchemy import create_engine
                    from agent import _set_session
                    engine = create_engine(f"sqlite:///{db_path}")
                    _set_session(engine, conv.db_config["label"])
            conn_info = {"label": conv.db_config["label"], "schema": session.schema_dict}
        except: pass

    msgs = db.query(Message).filter(Message.conversation_id == chat_id).order_by(Message.created_at.asc()).all()
    return {
        "messages": [{"id": m.id, "role": m.role, "parts": m.parts} for m in msgs],
        "connection": conn_info
    }

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user:
        conv = db.query(Conversation).filter(Conversation.id == request.chat_id).first()
        if not conv:
            conv = Conversation(id=request.chat_id, user_id=user.id, title="Active Analysis")
            db.add(conv)
        msg = Message(conversation_id=request.chat_id, role="human", parts=[{"type": "text", "content": request.message}])
        db.add(msg)
        db.commit()

    async def event_generator():
        hist = []
        if user:
            # Get up to 10 PREVIOUS messages (excluding the one we just added)
            hist_msgs = db.query(Message).filter(
                Message.conversation_id == request.chat_id
            ).order_by(Message.created_at.desc()).offset(1).limit(10).all()
            
            # Reverse to get chronological order
            for m in reversed(hist_msgs):
                if m.parts and len(m.parts) > 0:
                    content = m.parts[0].get("content", "")
                    if content:
                        hist.append({"role": m.role, "content": content})

        full_ai_parts = []
        current_text = ""
        
        for chunk in process_message_stream(request.message, hist):
            yield chunk
            try:
                if chunk.startswith("data: "):
                    evt = json.loads(chunk[6:])
                    if evt["type"] == "token": 
                        current_text += evt["content"]
                    elif evt["type"] in ["chart", "mermaid", "table"]:
                        # If we have accumulated text, push it first
                        if current_text:
                            full_ai_parts.append({"type": "text", "content": current_text})
                            current_text = ""
                        full_ai_parts.append({"type": evt["type"], "content": evt["content"]})
                    elif evt["type"] == "done":
                        if current_text:
                            full_ai_parts.append({"type": "text", "content": current_text})
                            current_text = ""
            except: pass
        
        if user and full_ai_parts:
            ai_msg = Message(conversation_id=request.chat_id, role="ai", parts=full_ai_parts)
            db.add(ai_msg)
            db.commit()

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/api/suggestions")
def get_suggestions_endpoint():
    if not session.is_connected: return {"suggestions": []}
    return {"suggestions": generate_suggestions(session.schema_dict)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
