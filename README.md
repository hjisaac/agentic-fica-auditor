# FICA Compliance KYC & KYB AI Agent 

A personal weekend project designed to demonstrate **Agentic AI patterns** in regulatory compliance checks under South Africa's **FICA (Financial Intelligence Centre Act)**. Built as a technical showcase for **Fraudcheck**. 

---

## Project Goal & Context

The goal of this prototype is to show how autonomous reasoning agents can streamline multi-step, complex compliance audits. 

Instead of writing rigid, hardcoded scripts for compliance verification, this platform uses a **ReAct (Reasoning and Action) loop** where the agent autonomously decides what verification tools to call, inspects their results, and builds a comprehensive audit recommendation.

> [!NOTE]
> **Mocked Endpoints & Swappable Tools**: To run fully out-of-the-box without requiring restricted or expensive government API credentials, all external verification tools (DHA citizen registry, CIPC corporate business lookup, bank account verification, sanctions lists) query local, mocked databases. The tool interfaces are fully defined and can be easily replaced with live production REST API endpoints.

---

## Agentic Patterns Demonstrated

1.  **Autonomous ReAct Loop**: The agent loops through `Thought -> Action -> Observation -> Decision` to collect audit data.
2.  **Tool-Use Abstraction**: The agent has access to specialized tools (PEP screening, DHA checks, adverse media, CIPC lookups). If it's auditing a business (KYB), it maps the director tree from CIPC and recursively audits all directors.
3.  **Sandbox Isolation & Verification Ledger**: Ephemeral contexts utilize [Bubblewrap](https://github.com/containers/bubblewrap) (low-level Linux sandboxing) and new chat sessions for complete sandbox isolation. It captures case execution logs and signs the final results with a **SHA-256 cryptographic hash** to prevent compliance tampering.
4.  **Resilient Hybrid Fallback**: If live AI services (Gemini API) experience rate limits (e.g., 429 quota exhaustion) or network errors, the engine falls back to local compliance sandboxes and highlights the error in the telemetry terminal as a prominent warning alert.

---

## Tech Stack

*   **AI Engine**: Google Gemini API + custom ReAct reasoning parser.
*   **Backend**: FastAPI + Uvicorn (high-performance async web server).
*   **Database & ORM**: SQLite + Peewee ORM (Active Record pattern).
*   **Frontend**: React + Tailwind CSS (visualizes live agent thoughts, corporate trees, and generates client-side PDF audit reports).
*   **Deployment**: Fully containerized with a multi-stage Dockerfile and ready for one-click deployment on Render.

---

## Quick Start (Local Run)

Since the frontend build directory (`frontend/dist/`) is gitignored, you must compile the React assets first, then start the FastAPI backend.

### 1. Build the Frontend
Requires Node.js and `pnpm`:
```bash
cd frontend
pnpm install
pnpm run build
cd ..
```

### 2. Run the Backend & Server
The project backend is natively configured for **`uv`**, the modern Rust-based Python package manager. **`uv run` automatically initializes the virtual environment and synchronizes all Python dependencies on the fly:**
```bash
uv run backend/run.py
```

Once the server has initialized, open **http://localhost:8080** in your browser to view the interactive FICA dashboard.

---

## Production Deployment (Render)

A `render.yaml` blueprint is included. Connect this repository to your **Render.com** account, create a **Blueprint Instance**, and Render will deploy the Docker container automatically.
