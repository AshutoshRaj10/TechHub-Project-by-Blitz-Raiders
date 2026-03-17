"""
tools.py — 5 formal agent tools (Gemini-optimized)

This module provides the analytical primitives for the DB Analyser.
It integrates with the Gemini 2.0 Flash engine to provide data insights,
visualizations, and schema mapping.
"""

import json
import re
from typing import List


# ─────────────────────────────────────────────────────────────────────────────
# Tool 1 — get_schema
# ─────────────────────────────────────────────────────────────────────────────
def get_schema(engine) -> dict:
    """
    Retrieve the full database schema.
    Returns structured JSON: {tables: {table_name: {columns: [{name, type, nullable, primary_key}]}}}
    """
    from sqlalchemy import MetaData

    metadata = MetaData()
    metadata.reflect(bind=engine)

    schema_json = {}
    for table_name, table in metadata.tables.items():
        schema_json[table_name] = {
            "columns": [
                {
                    "name": col.name,
                    "type": str(col.type),
                    "nullable": col.nullable,
                    "primary_key": col.primary_key,
                    "foreign_key": bool(col.foreign_keys),
                }
                for col in table.columns
            ]
        }

    return {
        "tool": "get_schema",
        "tables": schema_json,
        "table_count": len(schema_json),
        "table_names": list(schema_json.keys()),
    }


def schema_to_text(schema_dict: dict) -> str:
    """Human-readable schema text for LLM prompts — uses safe SQL identifiers."""
    TYPE_MAP = {
        "VARCHAR": "TEXT", "NVARCHAR": "TEXT", "CLOB": "TEXT",
        "FLOAT": "REAL", "DOUBLE": "REAL", "NUMERIC": "REAL",
        "BOOLEAN": "INTEGER",
    }
    def clean_type(raw: str) -> str:
        upper = raw.upper().split("(")[0].strip()  # remove "(255)" suffixes
        return TYPE_MAP.get(upper, upper) or raw

    lines = []
    for table, meta in schema_dict.get("tables", {}).items():
        cols = ", ".join(
            f"`{c['name']}` {clean_type(c['type'])}" + (" PK" if c["primary_key"] else "")
            for c in meta["columns"]
        )
        lines.append(f"- `{table}` ({cols})")
    return "\n".join(lines) if lines else "No tables."


# ─────────────────────────────────────────────────────────────────────────────
# Tool 2 — execute_query
# ─────────────────────────────────────────────────────────────────────────────
def execute_query(engine, query: str) -> dict:
    """
    Execute a read-only SQL SELECT query.
    Returns: {records, row_count, columns, table_md, error?}
    """
    import pandas as pd

    query = query.strip()
    if not query:
        return {"tool": "execute_query", "error": "Empty query.", "records": [], "table_md": ""}

    # Safety: read-only
    first_word = query.split()[0].upper() if query.split() else ""
    if first_word not in ("SELECT", "WITH", "EXPLAIN", "PRAGMA"):
        return {
            "tool": "execute_query",
            "error": "Only SELECT queries are allowed.",
            "records": [], "table_md": ""
        }

    try:
        df = pd.read_sql(query, engine)
        if df.empty:
            return {
                "tool": "execute_query", "records": [], "row_count": 0,
                "columns": list(df.columns), "table_md": "_No rows returned._",
            }

        records = json.loads(df.to_json(orient="records"))
        # Markdown table (max 50 rows)
        preview = df.head(50)
        headers = list(preview.columns)
        md = ["| " + " | ".join(str(h) for h in headers) + " |",
              "| " + " | ".join(["---"] * len(headers)) + " |"]
        for _, row in preview.iterrows():
            row_vals = []
            for h in headers:
                val = row.get(h, "")
                if isinstance(val, (float, int)) and not isinstance(val, bool):
                    row_vals.append(f"{val:,.2f}")
                else:
                    row_vals.append(str(val))
            md.append("| " + " | ".join(row_vals) + " |")

        return {
            "tool": "execute_query",
            "query": query,
            "records": records,
            "row_count": len(records),
            "columns": list(df.columns),
            "table_md": "\n".join(md),
            "table_data": {
                "columns": list(df.columns),
                "rows": records[:50]
            }
        }
    except Exception as e:
        return {"tool": "execute_query", "error": str(e), "records": [], "table_md": ""}


# ─────────────────────────────────────────────────────────────────────────────
# Tool 3 — generate_chart
# ─────────────────────────────────────────────────────────────────────────────
CHART_PURPOSES = {
    "bar":     "Bar Chart - for categorical comparisons",
    "line":    "Line Chart - for trends over time",
    "pie":     "Pie Chart - for proportional distribution",
    "scatter": "Scatter Plot - for correlation analysis (bonus)",
}

def generate_chart(chart_type: str, title: str, records: List[dict],
                   x_key: str, y_keys: List[str]) -> dict:
    """
    Build a Recharts-compatible chart config for the frontend ChartRenderer.
    chart_type: 'bar' | 'line' | 'pie' | 'scatter'
    """
    if chart_type not in CHART_PURPOSES:
        chart_type = "bar"
    return {
        "tool": "generate_chart",
        "type": "chart",
        "chart_type": chart_type,
        "purpose": CHART_PURPOSES[chart_type],
        "title": title,
        "data": records,
        "x_key": x_key,
        "y_keys": y_keys,
    }


def is_numeric(val):
    if isinstance(val, (int, float)):
        return True
    if isinstance(val, str):
        try:
            float(val.replace(',', '').replace('$', '').strip())
            return True
        except ValueError:
            pass
    return False

def auto_pick_axes(records: List[dict]) -> tuple:
    """Heuristically pick the best x and y axis keys from records."""
    if not records:
        return "name", ["value"]
    keys = list(records[0].keys())

    # Prefer known categorical column name patterns for x-axis
    x_pref = ["name", "category", "status", "date", "label", "type",
               "product", "month", "year", "region", "industry", "variable",
               "group", "class", "segment", "description", "title", "tag"]
    # Try preference list first
    x_key = next((k for k in keys if any(p in k.lower() for p in x_pref)), None)

    # If not found via preferences, use the FIRST non-numeric column
    if x_key is None:
        for k in keys:
            sample_vals = [r.get(k) for r in records[:5] if r.get(k) is not None]
            if sample_vals and not all(isinstance(v, (int, float)) for v in sample_vals):
                x_key = k
                break

    # Final fallback: just use first column
    if x_key is None:
        x_key = keys[0]

    # y candidates: numeric columns that are NOT the x column
    y_candidates = [
        k for k in keys
        if k != x_key and is_numeric(records[0].get(k))
    ]
    y_keys = y_candidates if y_candidates else [k for k in keys if k != x_key][:1]
    return x_key, y_keys if y_keys else [keys[-1]]


# ─────────────────────────────────────────────────────────────────────────────
# Tool 4 — generate_flowchart
# ─────────────────────────────────────────────────────────────────────────────
DIAGRAM_LABELS = {
    "erDiagram": "Entity-Relationship (ER) Diagram - visualize database relationships",
    "graph TD":  "Process Flow Diagram - illustrate data pipelines or workflows",
    "graph LR":  "Decision Tree - for conditional logic visualization",
}

def generate_flowchart(diagram_type: str, mermaid_syntax: str, title: str = "") -> dict:
    """
    Build a Mermaid diagram config for the frontend MermaidRenderer.
    diagram_type: 'erDiagram' | 'graph TD' | 'graph LR'
    """
    VALID = {"erDiagram", "graph TD", "graph LR"}
    if diagram_type not in VALID:
        diagram_type = "graph TD"

    body = mermaid_syntax.strip()
    if not body.startswith(diagram_type):
        body = f"{diagram_type}\n{body}"

    return {
        "tool": "generate_flowchart",
        "type": "mermaid",
        "diagram_type": diagram_type,
        "diagram_label": DIAGRAM_LABELS.get(diagram_type, "Diagram"),
        "title": title,
        "mermaid": body,
    }


def auto_generate_er(schema_dict: dict) -> str:
    """
    Deterministically build an erDiagram from get_schema() output.
    No LLM needed — uses FK heuristics.
    """
    lines = ["erDiagram"]
    table_names_upper = [t.upper() for t in schema_dict.get("table_names", [])]

    for table, meta in schema_dict.get("tables", {}).items():
        t = table.upper()
        lines.append(f"  {t} {{")
        for col in meta["columns"]:
            pk_marker = " PK" if col["primary_key"] else ""
            fk_marker = " FK" if col.get("foreign_key") else ""
            lines.append(f"    {col['type']} {col['name']}{pk_marker}{fk_marker}")
        lines.append("  }")

    # FK relationships from naming heuristic
    for table, meta in schema_dict.get("tables", {}).items():
        t = table.upper()
        for col in meta["columns"]:
            if col["name"].endswith("_id") and not col["primary_key"]:
                parent = col["name"].replace("_id", "").upper()
                if parent in table_names_upper:
                    lines.append(f"  {parent} ||--o{{ {t} : has")

    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# Tool 5 — explain_data
# ─────────────────────────────────────────────────────────────────────────────
def explain_data(genai_model, question: str, records: List[dict]) -> dict:
    """
    Generate a professional natural-language business insight using Gemini API.
    Returns: {insight, record_count, numeric_stats}
    """
    if not records:
        return {"tool": "explain_data", "insight": "No data was returned for this query.",
                "record_count": 0, "numeric_stats": {}}

    # Quick numeric stats
    numeric_stats = {}
    for key in records[0].keys():
        vals = [r[key] for r in records if isinstance(r.get(key), (int, float))]
        if vals:
            numeric_stats[key] = {
                "min":   round(min(vals), 2),
                "max":   round(max(vals), 2),
                "avg":   round(sum(vals) / len(vals), 2),
                "sum":   round(sum(vals), 2),
            }

    data_preview = json.dumps(records[:15])
    if len(data_preview) > 1500:
        data_preview = data_preview[:1500] + "..."

    try:
        resp = genai_model.generate_content(
            f"You are a concise business data analyst. Give clear, specific 2-3 sentence insights about data. Mention actual values. No code. No SQL.\n\n"
            f'User asked: "{question}"\n\nData ({len(records)} rows):\n{data_preview}\n\nGive a 2-3 sentence insight:'
        )
        insight = resp.text.strip()
    except Exception as e:
        insight = f"Data retrieved successfully. {len(records)} rows returned."

    return {
        "tool": "explain_data",
        "insight": insight,
        "record_count": len(records),
        "numeric_stats": numeric_stats,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Tool registry (for documentation / introspection)
# ─────────────────────────────────────────────────────────────────────────────
TOOL_REGISTRY = {
    "get_schema":        {"description": "Retrieve database schema (tables, columns, types). Output: JSON."},
    "execute_query":     {"description": "Execute read-only SQL SELECT. Output: JSON records + markdown table."},
    "generate_chart":    {"description": "Create bar/line/pie/scatter charts. Output: Recharts config JSON."},
    "generate_flowchart":{"description": "Create erDiagram/process flow/decision tree. Output: Mermaid syntax."},
    "explain_data":      {"description": "Generate natural-language insight from query results via LLM. Output: text + stats."},
}
