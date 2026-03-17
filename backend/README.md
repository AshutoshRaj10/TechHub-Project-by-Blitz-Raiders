# DB Analyser Bot Backend ⚙️

This directory contains the FastAPI-powered backend engine for **DB Analyser Bot**, developed by **Team Blitz Raiders**.

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- pip

### Installation
1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Configuration
Ensure you have a `.env` file in the root directory with your `OPENAI_API_KEY`.

### Running the Server
```bash
python main.py
```
The API will be available at `http://localhost:8000`. You can access the Swagger documentation at `http://localhost:8000/docs`.

## 🧠 Core Modules

- `main.py`: FastAPI application entry point and endpoints.
- `agent.py`: The AI logic core, handling intent detection and SQL generation.
- `tools.py`: Helper functions for database schema extraction and visualization data prep.
- `auth_utils.py`: JWT-based authentication logic.
- `system_db.py`: Management of the internal SQLite database for users and chat history.

## 📁 Storage
- `uploads/`: Temporary directory where uploaded CSVs and their converted SQLite counterparts are stored.

---

For full project documentation, please refer to the [Main README](../README.md).
