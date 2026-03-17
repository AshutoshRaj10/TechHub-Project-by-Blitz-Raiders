import os
import json
import re
import time
from typing import Generator
from openai import OpenAI
from sqlalchemy import create_engine, text
import pandas as pd
from dotenv import load_dotenv

# Load env variables from root directory
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

# ─────────────────────────────────────────────────────────────────────────────
# AI Engine Configuration - EXCLUSIVELY OPENAI
# ─────────────────────────────────────────────────────────────────────────────
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL   = "gpt-4o-mini"

# Client
client = None

def set_openai_key(key: str):
    global client, OPENAI_API_KEY, OPENAI_MODEL
    if not key:
        print(f"[Agent] Attempted to set empty key")
        return False
    
    key = key.strip()
    OPENAI_API_KEY = key
    base_url = None
    
    # ─── Failsafe Key Identification ───
    if key.startswith("sk-or-"):
        # OpenRouter Detection
        base_url = "https://openrouter.ai/api/v1"
        OPENAI_MODEL = "openai/gpt-4o-mini"
        print(f"[Agent] OpenRouter gateway detected.")
    elif key.startswith("gsk_"):
        # Groq Detection
        base_url = "https://api.groq.com/openai/v1"
        OPENAI_MODEL = "llama-3.3-70b-versatile"
        print(f"[Agent] Groq gateway detected.")
    elif key.startswith("sk-"):
        # Native OpenAI
        base_url = None
        OPENAI_MODEL = "gpt-4o-mini"
        print(f"[Agent] Native OpenAI key detected.")
    else:
        # Fallback / Unknown - Try as OpenAI but keep it flexible
        base_url = None
        OPENAI_MODEL = "gpt-4o-mini"
        print(f"[Agent] Generic key format, using default OpenAI endpoint.")

    try:
        # Extra headers for compatibility (OpenRouter/Groq)
        extra_headers = {
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "DB Analyser Bot"
        }
        
        client = OpenAI(
            api_key=key, 
            base_url=base_url,
            default_headers=extra_headers if base_url else None
        )
        print(f"[Agent] Engine initialized successfully for model: {OPENAI_MODEL}")
        return True
    except Exception as e:
        print(f"[Agent] Initialization failed: {e}")
        client = None
        return False

# Initialize
if OPENAI_API_KEY:
    set_openai_key(OPENAI_API_KEY)

# ... (tools omitted for brevity, keeping the imports)
from tools import (
    get_schema, schema_to_text, auto_generate_er,
    execute_query, auto_pick_axes,
    generate_chart, CHART_PURPOSES,
    generate_flowchart, DIAGRAM_LABELS,
    explain_data,
)


def _llm_call(messages: list, max_tokens: int = 1000, stream: bool = False, temp: float = 0.1):
    """Exclusively OpenAI LLM call."""
    if not client:
        raise RuntimeError("OpenAI Engine Offline: No OpenAI key found. Please configure it in settings.")

    try:
        res = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temp,
            stream=stream
        )
        return res
    except Exception as e:
        err_str = str(e).lower()
        if any(x in err_str for x in ["auth", "401", "unauthorized", "api_key", "invalid"]):
            raise RuntimeError("INVALID_OPENAI_KEY: Your OpenAI API key is invalid or expired.")
        if any(x in err_str for x in ["quota", "429", "rate limit", "insufficient"]):
            raise RuntimeError("OPENAI_LIMIT_REACHED: You've hit your quota or rate limit. Please check your credit balance.")
        raise RuntimeError(f"OpenAI Engine Error: {str(e)}")


def _get_chunk_text(chunk) -> str:
    """Safely extract text from OpenAI stream chunks."""
    try:
        if hasattr(chunk, 'choices') and chunk.choices:
            return chunk.choices[0].delta.content or ""
        return ""
    except:
        return ""


# ─────────────────────────────────────────────────────────────────────────────
# Session State
# ─────────────────────────────────────────────────────────────────────────────
class SessionState:
    engine           = None
    schema_dict      : dict = {}
    schema_text      : str  = ""
    connection_label : str  = ""
    is_connected     : bool = False

    @property
    def schema(self):
        return self.schema_text

session = SessionState()

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# DB Connections
# ─────────────────────────────────────────────────────────────────────────────
def _set_session(engine, label: str) -> dict:
    session.engine            = engine
    session.schema_dict       = get_schema(engine)
    session.schema_text       = schema_to_text(session.schema_dict)
    session.connection_label  = label
    session.is_connected      = True
    return {"ok": True, "schema": session.schema_dict, "label": label}


def connect_sqlite_path(path: str) -> dict:
    try:
        abs_path = os.path.abspath(os.path.expanduser(path))
        if not os.path.exists(abs_path):
            return {"ok": False, "error": f"File not found: {abs_path}"}
        engine = create_engine(f"sqlite:///{abs_path}")
        with engine.connect() as c: c.execute(text("SELECT 1"))
        return _set_session(engine, f"SQLite: {os.path.basename(abs_path)}")
    except Exception as e:
        return {"ok": False, "error": str(e)}

def connect_mysql(host: str, port: int, user: str, password: str, database: str) -> dict:
    try:
        url = f"mysql+pymysql://{user}:{password}@{host}:{port}/{database}"
        engine = create_engine(url)
        with engine.connect() as c: c.execute(text("SELECT 1"))
        return _set_session(engine, f"MySQL: {database}@{host}")
    except Exception as e:
        return {"ok": False, "error": str(e)}

def _sanitize_column_name(name: str) -> str:
    """Convert a column name to a valid SQL identifier."""
    name = str(name).strip()
    name = re.sub(r"[^a-zA-Z0-9_]", "_", name)
    if name and name[0].isdigit():
        name = "col_" + name
    return name or "col"

def connect_csv(file_bytes: bytes, filename: str) -> dict:
    """Upload a CSV → sanitize column names → store as SQLite table."""
    import io
    try:
        table_name = re.sub(r"[^a-z0-9_]", "_", os.path.splitext(filename)[0].lower())
        if not table_name or table_name[0].isdigit():
            table_name = "data_" + table_name

        db_path = os.path.join(UPLOADS_DIR, f"{table_name}.db")

        df = None
        for encoding in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
            try:
                df = pd.read_csv(io.BytesIO(file_bytes), encoding=encoding)
                break
            except (UnicodeDecodeError, pd.errors.ParserError):
                continue

        if df is None:
            return {"ok": False, "error": "Could not decode CSV."}
        if df.empty:
            return {"ok": False, "error": "CSV file is empty."}

        original_cols = list(df.columns)
        clean_cols    = [_sanitize_column_name(c) for c in original_cols]
        seen = {}
        deduped = []
        for c in clean_cols:
            if c in seen:
                seen[c] += 1
                deduped.append(f"{c}_{seen[c]}")
            else:
                seen[c] = 0
                deduped.append(c)
        df.columns = deduped

        engine = create_engine(f"sqlite:///{db_path}")
        df.to_sql(table_name, engine, if_exists="replace", index=False)
        return _set_session(engine, f"CSV: {filename} \u2192 table '{table_name}'")
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# Intent Classification
# ─────────────────────────────────────────────────────────────────────────────
FLOWCHART_KEYWORDS = ["flowchart", "flow chart", "er diagram", "erd", "diagram", "process flow"]
CHART_KEYWORDS     = ["chart", "plot", "graph", "visualize", "visualise", "dashboard"]
SCHEMA_KEYWORDS    = ["schema", "structure", "tables", "columns", "fields", "database"]
GREETING_KEYWORDS  = ["hi", "hello", "hey", "help", "who are you"]
QUERY_KEYWORDS     = ["query", "insight", "analyze", "analyse", "data", "tell me about"]

def detect_intent_llm(text: str) -> str:
    t = text.lower()
    if any(k in t for k in SCHEMA_KEYWORDS):    return "schema"
    if any(k in t for k in FLOWCHART_KEYWORDS): return "flowchart"
    if any(k in t for k in CHART_KEYWORDS):     return "chart"
    if any(k in t for k in GREETING_KEYWORDS):  return "conversation"
    if any(k in t for k in QUERY_KEYWORDS):     return "query"

    if not session.is_connected: return "conversation"
    if len(text.split()) < 3:    return "conversation"

    prompt = (
        "Classify the following user request into exactly ONE of these categories:\n"
        "- 'schema': Request to see tables, columns, or database structure.\n"
        "- 'chart': Request for a data visualization (bar, line, pie, etc.).\n"
        "- 'flowchart': Request for a flowchart, ER diagram, or process diagram.\n"
        "- 'query': Request for data analysis, specific numbers, or a database query.\n"
        "- 'conversation': General greetings, unrelated help, or out-of-context talk.\n\n"
        f"Request: \"{text}\"\n\n"
        "Output ONLY the category name."
    )
    try:
        resp = _llm_call([{"role": "user", "content": prompt}], max_tokens=10, temp=0.0)
        if hasattr(resp, 'choices'):
            intent = resp.choices[0].message.content.strip().lower()
        else:
            intent = resp.text.strip().lower()

        if intent in ["schema", "chart", "flowchart", "query", "conversation"]:
            return intent
    except Exception:
        pass
    
    return "query" if session.is_connected else "conversation"

def detect_chart_type(text: str) -> str:
    t = text.lower()
    if "pie"     in t: return "pie"
    if "line"    in t: return "line"
    if "scatter" in t: return "scatter"
    return "bar"

def detect_diagram_type(text: str) -> str:
    t = text.lower()
    if any(k in t for k in ["er diagram", "erd", "entity", "relationship"]): return "erDiagram"
    if any(k in t for k in ["decision tree", "logic"]): return "graph LR"
    return "graph TD"


# ─────────────────────────────────────────────────────────────────────────────
# SQL Generation Helpers
# ─────────────────────────────────────────────────────────────────────────────
def _get_column_samples(engine, table_name: str, n: int = 3) -> dict:
    try:
        df = pd.read_sql(f"SELECT * FROM `{table_name}` LIMIT {n}", engine)
        samples = {}
        for col in df.columns:
            vals = df[col].dropna().head(n).tolist()
            samples[col] = vals
        return samples
    except Exception:
        return {}

def _build_column_hints(schema_dict: dict, engine) -> str:
    lines = []
    for table_name, meta in schema_dict.get("tables", {}).items():
        lines.append(f"Table `{table_name}`:")
        samples = _get_column_samples(engine, table_name)
        for col in meta.get("columns", []):
            cn = col["name"]
            ct = col["type"]
            pk = " [PK]" if col.get("primary_key") else ""
            s  = samples.get(cn, [])
            s_str = ", ".join(repr(v) for v in s[:3]) if s else "\u2014"
            lines.append(f"  - `{cn}` ({ct}){pk}  e.g. {s_str}")
    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# Prompts
# ─────────────────────────────────────────────────────────────────────────────
SQL_SYSTEM_PROMPT = """You are a specialized SQL Generator. Output ONLY a valid SELECT query or 'UNRELATED'. Use backticks for all identifiers."""
GENERAL_SYSTEM_PROMPT = """You are DB Analyser Bot, a Professional Data Intelligence Bot. Only answer data-related questions."""

def llm_generate_sql(question: str) -> str:
    col_hints = _build_column_hints(session.schema_dict, session.engine)
    tables    = session.schema_dict.get("table_names", [])
    tables_list = ", ".join(f"`{t}`" for t in tables)

    messages = [
        {"role": "system", "content": SQL_SYSTEM_PROMPT},
        {"role": "user",   "content": f"Tables: {tables_list}\n\nHints:\n{col_hints}\n\nQuestion: {question}\n\nSQL:"}
    ]

    try:
        resp = _llm_call(messages, max_tokens=300, temp=0.0)
        if hasattr(resp, 'choices'):
            raw = resp.choices[0].message.content.strip()
        else:
            raw = resp.text.strip()
            
        sql = re.sub(r"```sql\s*", "", raw, flags=re.I)
        sql = re.sub(r"```", "", sql).strip()
        sql = sql.split(";")[0].strip()
        
        if not re.match(r"^\s*(SELECT|WITH|PRAGMA)", sql, re.I):
            m = re.search(r"(SELECT\s+.+)", sql, re.I | re.S)
            sql = m.group(1).strip() if m else f"SELECT * FROM `{tables[0]}` LIMIT 10"
        
        return sql
    except Exception:
        return f"SELECT * FROM `{tables[0]}` LIMIT 10" if tables else "SELECT 1"


def execute_query_with_retry(question: str) -> dict:
    sql = llm_generate_sql(question)
    if sql.strip().upper() == "UNRELATED":
        return {"tool": "execute_query", "error": "UNRELATED_CONTEXT", "records": [], "table_md": ""}
    
    qr = execute_query(session.engine, sql)
    
    if qr.get("error"):
        # Simple fallback retry
        tables = session.schema_dict.get("table_names", [])
        best_table = tables[0] if tables else "data"
        sql2 = f"SELECT * FROM `{best_table}` LIMIT 20"
        qr = execute_query(session.engine, sql2)
        
    return qr


# ─────────────────────────────────────────────────────────────────────────────
# Mermaid Generation
# ─────────────────────────────────────────────────────────────────────────────
def sanitize_mermaid(body: str, directive: str) -> str:
    """Fix common LLM-generated Mermaid syntax errors and enforce strict structure."""
    # 1. Remove markdown fences and backticks
    body = re.sub(r"```[a-z]*\n?", "", body, flags=re.I).strip()
    body = body.strip("`").strip()
    
    # 2. Fix invalid edge labels: | "Label" | >  -> |Label|
    # This strips BOTH quotes and trailing arrows from inside pipes
    body = re.sub(r"\|\s*[\"']?([^|\"']+)[\"']?\s*\|\s*>?\s*", r"|\1|", body)
    
    # 3. Fix double arrowheads like --> -> or --> >
    body = re.sub(r"-->\s*->?", "-->", body)
    
    # 4. Enforce quoted labels for nodes (but NOT for pipe labels)
    if "graph" in directive:
        # Wrap brackets text in quotes: A[some text] -> A["some text"]
        # Use better regex that doesn't double-quote
        body = re.sub(r"(\w+)\[([^\"\]]+)\]", r'\1["\2"]', body)
        body = re.sub(r"(\w+)\{([^\"\}]+)\}", r'\1{"\2"}', body)
        body = re.sub(r"(\w+)\(([^\"\) ]+)\)", r'\1("\2")', body)

    lines = []
    for line in body.split('\n'):
        l = line.strip()
        if not l: continue
        # 5. Filter out junk lines
        if any(op in l for op in ["-->", "---", "--", "||", "::", "{", "[", "("]):
            lines.append(l)

    if not lines:
        return f"{directive}\n  A[\"Data Flow Start\"] --> B[\"Insights Generated\"]"
        
    # 6. Ensure directive is exactly correct
    if not lines[0].lower().startswith(directive.lower().split()[0]):
        lines.insert(0, directive)
    else:
        lines[0] = directive
        
    return "\n".join(lines)

def llm_generate_mermaid(diagram_type: str, question: str) -> str:
    directive = diagram_type
    messages = [
        {"role": "system", "content": (
            f"You are a Mermaid.js v11 expert. Output ONLY valid {directive} syntax.\n"
            "RULES:\n"
            "1. NO markdown fences (```).\n"
            "2. EVERY label must be in double quotes, e.g., A[\"My Label Value\"].\n"
            "3. Use simple alphanumeric node IDs (A, B, C).\n"
            "4. For arrows, use A --> B or A -->| \"Label\" | B.\n"
        )},
        {"role": "user", "content": f"Schema:\n{session.schema_text}\n\nCreate a {directive} for: {question}"}
    ]
    try:
        resp = _llm_call(messages, max_tokens=800)
        if hasattr(resp, 'choices'):
            body = resp.choices[0].message.content.strip()
        else:
            body = resp.text.strip()
        
        sanitized = sanitize_mermaid(body, directive)
        
        # Simple pre-flight check: must have at least one link or node
        if "-->" not in sanitized and "--" not in sanitized:
             # Logic flow fallback
             return f"{directive}\n  A[\"Data Process\"] --> B[\"Analysis Complete\"]"

        return sanitized
    except Exception as e:
        print(f"[Mermaid error] {e}")
        return f"{directive}\n  A[\"Rendering Error\"] --> B[\"Check Connection\"]"


# ─────────────────────────────────────────────────────────────────────────────
# Streaming Logic
# ─────────────────────────────────────────────────────────────────────────────
def process_message_stream(user_input: str, chat_history: list) -> Generator[str, None, None]:
    def sse(obj): return f"data: {json.dumps(obj)}\n\n"

    if not OPENAI_API_KEY:
        yield sse({"type": "token", "content": "No OpenAI API key found. Please configure it in settings."})
        yield sse({"type": "done"})
        return

    if not session.is_connected:
        yield sse({"type": "token", "content": "Please connect a database or CSV first."})
        yield sse({"type": "done"})
        return

    yield sse({"type": "status", "content": "Thinking..."})
    intent = detect_intent_llm(user_input)

    try:
        if intent == "conversation":
            # Prepare contextual messages
            llm_history = []
            for h in chat_history:
                role = "user" if h["role"] == "human" else "assistant"
                llm_history.append({"role": role, "content": h["content"]})
            
            messages = [
                {"role": "system", "content": GENERAL_SYSTEM_PROMPT + "\nContext:\n" + session.schema_text},
            ] + llm_history + [{"role": "user", "content": user_input}]

            stream = _llm_call(messages, stream=True)
            for chunk in stream:
                token = _get_chunk_text(chunk)
                if token: yield sse({"type": "token", "content": token})

        elif intent == "schema":
            result = get_schema(session.engine)
            table_lines = [f"- **{t}** ({', '.join('`' + c['name'] + '`' for c in info['columns'])})" for t, info in result["tables"].items()]
            yield sse({"type": "token", "content": "### Database Schema\n" + "\n".join(table_lines)})

        elif intent == "flowchart":
            diagram_type = detect_diagram_type(user_input)
            if diagram_type == "erDiagram":
                mermaid_body = auto_generate_er(get_schema(session.engine))
            else:
                mermaid_body = llm_generate_mermaid(diagram_type, user_input)
            
            fd = generate_flowchart(diagram_type, mermaid_body)
            yield sse({"type": "mermaid", "content": fd["mermaid"]})
            yield sse({"type": "token", "content": f"\n**{fd['diagram_label']} Generated.**"})

        elif intent == "chart":
            chart_type = detect_chart_type(user_input)
            qr = execute_query_with_retry(user_input)
            if not qr.get("error") and qr.get("records"):
                x, ys = auto_pick_axes(qr["records"])
                cr = generate_chart(chart_type, user_input[:40], qr["records"], x, ys)
                yield sse({"type": "chart", "content": cr})
                yield sse({"type": "token", "content": f"Generated {chart_type} chart."})
            else:
                yield sse({"type": "token", "content": "Could not generate chart."})

        else: # query
            qr = execute_query_with_retry(user_input)
            if qr.get("error"):
                yield sse({"type": "token", "content": f"Query Error: {qr['error']}"})
            else:
                analysis_prompt = f"Analyze this data briefly: {json.dumps(qr['records'][:5])}"
                stream = _llm_call([{"role": "user", "content": analysis_prompt}], stream=True)
                for chunk in stream:
                    token = _get_chunk_text(chunk)
                    if token: yield sse({"type": "token", "content": token})
                yield sse({"type": "token", "content": "\n\n"})
                if qr.get("table_data"):
                    yield sse({"type": "table", "content": qr["table_data"]})

    except Exception as e:
        yield sse({"type": "token", "content": f"Error: {e}"})
    
    finally:
        yield sse({"type": "done"})


# Suggestions
def generate_suggestions(schema_dict: dict) -> list:
    """Generate 4 contextual query suggestions."""
    suggestions = []
    for table_name, meta in schema_dict.get("tables", {}).items():
        cols = meta.get("columns", [])
        col_names = [c["name"] for c in cols]
        suggestions.append(f"Show me all rows in {table_name}")
        if len(col_names) > 0:
            suggestions.append(f"List the first 5 entries of {col_names[0]}")
    unique_suggestions = list(set(suggestions))
    return unique_suggestions[:4]
