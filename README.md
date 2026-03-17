# 🤖 DB Analyser Bot: Professional Data Intelligence Agent

![DB Analyser Bot Logo](https://img.shields.io/badge/DB_Analyser_Bot-Data%20Intelligence-blueviolet?style=for-the-badge&logo=openai)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

**DB Analyser Bot** is a powerful, full-stack AI-driven database agent designed to bridge the gap between complex data structures and human-readable insights. By leveraging the power of LLMs (OpenAI/OpenRouter), **DB Analyser Bot** allows users to interact with their databases using natural language, auto-generate visualizations, and understand data schemas instantly.

---

## ✨ Key Features

- 🔍 **Natural Language to SQL**: Query your databases without writing a single line of SQL.
- 📊 **Dynamic Visualizations**: Automatically generates Bar, Line, Pie, and Scatter charts based on query results.
- 🗺️ **Auto-ER Diagrams**: Instantly visualize your database schema with Mermaid.js-powered ER diagrams.
- 📁 **CSV Analysis**: Upload CSV files and interact with them as if they were full-scale databases.
- 🔋 **Multi-DB Support**: Out-of-the-box support for **SQLite**, **MySQL**, and **CSV**.
- 🔐 **Secure & Private**: Built-in authentication (Local & Guest modes) and secure connection handling.
- 🐳 **Docker Ready**: Fully containerized for easy deployment and scalability.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React, Vite, Tailwind CSS, Lucide Icons, Mermaid.js, Chart.js |
| **Backend** | FastAPI, SQLAlchemy, Pandas, OpenAI SDK, Pydantic |
| **Database** | SQLite (System), MySQL/CSV (Connectors) |
| **DevOps** | Docker, Docker Compose |

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/llm-bot.git
cd llm-bot
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```bash
cp .env.example .env
```
Add your **OpenAI API Key** (or Groq/OpenRouter key) to the `.env` file.

### 3. Run with Docker Compose
```bash
docker-compose up --build
```
- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:8000](http://localhost:8000)

---

## 🧪 Manual Setup (Development)

### Backend
1. Navigate to `backend/`
2. Create a virtual environment: `python -m venv venv`
3. Activate it: `source venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
5. Run the server: `python main.py`

### Frontend
1. Navigate to `frontend/`
2. Install dependencies: `npm install`
3. Run the dev server: `npm run dev` 

---

## 📖 How it Works

1. **Connect**: Link your SQLite/MySQL database or upload a CSV.
2. **Schema Insight**: **DB Analyser Bot** automatically analyzes the tables and relationships.
3. **Ask**: Type questions like *"What are the top 5 customers by revenue?"* or *"Show me the distribution of users by country"*.
4. **Visualize**: **DB Analyser Bot** chooses the best chart type or generates a flowchart to explain the logic.

---

## 📝 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request, we'll appreciate it.

---

Developed with ❤️ by **Team Blitz Raiders**
---
Contributors: Hari Prasath SS , Parinith M , Nirmal , Ashutosh Raj , Gaurav Kumar
