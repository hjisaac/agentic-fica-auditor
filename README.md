# FICA Compliance KYC & KYB AI Agent 

A personal weekend project designed to demonstrate **Agentic AI patterns** in regulatory compliance checks under South Africa's **FICA (Financial Intelligence Centre Act)**. Built as a technical showcase for **Fraudcheck**. 

## Demo Video

Here is a short demonstration of the FICA Compliance Agent in action, showing live agent thoughts, dynamic corporate director trees, and PDF report generation:

[Watch the Demo Video](demo.webm)

---

## Project Goal & Context

The goal of this prototype is to show how autonomous reasoning agents can streamline multi-step, complex compliance audits. 

Instead of writing rigid, hardcoded scripts for compliance verification, this platform uses a **ReAct (Reasoning and Action) loop** where the agent autonomously decides what verification tools to call, inspects their results, and builds a comprehensive audit recommendation.

> [!NOTE]
> **Mocked Endpoints & Swappable Tools**: To run fully out-of-the-box without requiring restricted or expensive government API credentials, all external verification tools (DHA citizen registry, CIPC corporate business lookup, bank account verification, sanctions lists) query local, mocked databases. The tool interfaces are fully defined and can be easily replaced with live production REST API endpoints.

> [!TIP]
> **Offline/Mock vs. Live Agent Modes**: The engine automatically checks your Gemini API key validity on startup using a token-free metadata ping.
> * **Offline/Mock Mode (Default)**: If no `GEMINI_API_KEY` is provided (or if the key is invalid), the engine automatically falls back to offline mode. It executes using deterministic, pre-seeded local mock verification traces, making it completely free, fast, and token-free to test.
> * **Live Agentic Mode**: If a valid `GEMINI_API_KEY` is configured (via your environment or `.env` file), the engine utilizes the Google Gemini API to run dynamic, autonomous ReAct loops.

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

There are two ways to run the project locally. 

> [!NOTE]
> **No Separate Frontend Server Required**: By default, the FastAPI backend is configured to serve the compiled static React build automatically. You do not need to run a separate server for the frontend.

### Option A: Standalone Setup (Recommended)
This compiles the React assets and lets the FastAPI backend serve them directly on **http://localhost:8080**.

1. **Build the Frontend**:
   Requires Node.js and `pnpm`:
   ```bash
   cd frontend
   pnpm install
   pnpm run build
   cd ..
   ```

2. **Run the Server**:
   The project backend is natively configured for **`uv`**, the modern Rust-based Python package manager. `uv run` automatically sets up the environment and synchronizes dependencies:
   ```bash
   uv run backend/run.py
   ```
   Once initialized, open **http://localhost:8080** in your browser to view the dashboard.

### Option B: Active Development Setup (Dual-Server)
If you want to modify the frontend code and see changes in real-time with hot-reloading, you can run Vite's development server alongside the backend.

1. **Start the Backend**:
   ```bash
   uv run backend/run.py
   ```
   The backend API will run on **http://localhost:8080**.

2. **Start the Frontend Dev Server**:
   In a new terminal window:
   ```bash
   cd frontend
   pnpm install
   pnpm run dev
   ```
   Vite runs on **http://localhost:3000** and automatically proxies `/api` requests to the FastAPI backend. Open **http://localhost:3000** in your browser.

---

## Production Deployment (Render)

A `render.yaml` blueprint is included. Connect this repository to your **Render.com** account, create a **Blueprint Instance**, and Render will deploy the Docker container automatically.
