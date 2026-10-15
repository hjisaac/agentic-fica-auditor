# Agentic FICA Compliance Auditor

An autonomous compliance verification platform implementing agentic AI patterns for South Africa's Financial Intelligence Centre Act (FICA) regulations. It automates multi-step KYC (individual) and KYB (corporate) compliance audits with tamper-evident audit trails.

## Key Features

- **Autonomous ReAct Loop**: Coordinates compliance verification via iterative Reasoning and Action (`Thought -> Action -> Observation -> Decision`).
- **Tool-Use Abstraction**: Calls specialized verification services including DHA identity validation, CIPC corporate registry lookups with recursive director audits, PEP and sanctions screening, bank account verification, and adverse media checks.
- **Tamper-Evident Ledger**: Captures chronological reasoning traces and signs final compliance records with a SHA-256 cryptographic hash.
- **Hybrid Execution**: Runs dynamic agent reasoning with the Google Gemini API when `GEMINI_API_KEY` is present, or falls back to deterministic local mock verification without external API dependencies.
- **Unified Frontend**: React dashboard visualizing agent thought streams, corporate ownership hierarchies, and exportable PDF audit reports.

## Architecture & Tech Stack

- **Backend**: FastAPI, Uvicorn, Peewee ORM, SQLite
- **AI & Reasoning**: Google Gemini API via `google-genai` SDK with custom ReAct orchestrator
- **Frontend**: React 18, Vite, Tailwind CSS, jsPDF
- **Packaging & Deployment**: Multi-stage Docker container, Render Blueprint (`render.yaml`)

## Quick Start

### Using Docker

```bash
docker build -t fica-auditor .
docker run -p 8080:8080 -e PORT=8080 fica-auditor
```
Access the application at `http://localhost:8080`.

### Local Setup

1. **Build Frontend**:
   ```bash
   cd frontend
   pnpm install && pnpm run build
   cd ..
   ```

2. **Run Backend**:
   ```bash
   uv run backend/run.py
   ```
   The backend serves both the API and compiled frontend assets at `http://localhost:8080`.

### Configuration

Optional environment variables:

- `GEMINI_API_KEY`: API key for live Gemini agent reasoning. If omitted, the engine automatically operates in offline mock mode.
- `PORT`: Server port (defaults to `8080`, dynamically bound by hosting platforms).

## Deployment

A `render.yaml` blueprint is included for deployment on Render as a containerized web service.
