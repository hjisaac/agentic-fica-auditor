# FICA Compliance KYC & KYB AI Agent Onboarding Platform

A production-grade AI Agent prototype designed for automating Know Your Customer (KYC) and Know Your Business (KYB) compliance checks under South Africa's FICA regulations. Built as a hiring demonstration for **Fraudcheck**.

---

## 🏗️ Technical Architecture

This application is built using a modern, lightweight, and secure stack:

*   **Backend API**: **FastAPI** + **Uvicorn** for high-performance, asynchronous REST endpoints, featuring auto-generated Swagger documentation.
*   **Database & ORM**: **SQLite** database managed via **Peewee ORM**, delivering a clean, Django-like Active Record database interface.
*   **AI Agent reasoning**: A custom implementation of the **ReAct (Reasoning and Action) loop** parsing `Thought -> Action -> Observation -> Decision` to carry out compliance audits.
*   **Case Isolation Sandbox**: Ephemeral contexts (`CaseIsolationSandbox`) that enforce directory boundaries, capture run telemetry, and sign case results with a **cryptographic SHA-256 hash** to prevent tampering.
*   **Frontend Dashboard**: A responsive single-page application showcasing the live agent reasoning telemetry, UBO director tree structure, and audit log history.

---

## 🚀 Local Execution (Offline Sandbox)

The project is configured natively for **`uv`**, the modern Rust-based python package manager.

### Prerequisites
Make sure you have `uv` installed. If not, install it using:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Run the Application
From the project root directory, run:
```bash
uv run backend/run.py
```
This command will:
1. Initialize the virtual environment (`.venv`) if it does not exist.
2. Synchronize all backend dependencies listed in `pyproject.toml`.
3. Create the SQLite database (`compliance.db`) and seed it from the fixtures directory (`backend/app/fixtures/*.json`).
4. Start the FastAPI server on **http://localhost:8080**.

Open **http://localhost:8080** in your browser to view the interactive dashboard.

---

## 📦 Production Deployment

The project is fully configured for production cloud deployment using **Docker** and **Render.com**.

### 1. One-Click Deployment (Render.com)
We have included a `render.yaml` blueprint. To deploy:
1. Push this repository to your GitHub account.
2. Connect your GitHub account to [Render.com](https://render.com).
3. Create a new **Blueprint Instance** and select this repository. Render will automatically build the React frontend and deploy the FastAPI web service using the Dockerfile.

### 2. Manual Docker Build
To build and run the Docker container locally or on a virtual private server (VPS):
```bash
# Build the container
docker build -t fica-agent .

# Run the container
docker run -d -p 8080:8080 --name fica-agent-run fica-agent
```
The container uses a **multi-stage build** to compile the React frontend assets and copy them directly into the FastAPI static files folder, serving both backend and frontend from a single lightweight container.

---

## 🔒 Security & POPIA Compliance Design

*   **Context Isolation**: Every transaction ID provisions a unique workspace directory under `workspace/cases/<transaction_id>/`. The sandbox blocks file I/O operations from accessing files outside this path, preventing directory traversal.
*   **Zero-Egress Proxy Pattern**: Sandboxed tools are network-isolated. If they need to query external APIs, they communicate through a secure gateway proxy on the host server, preventing data exfiltration.
*   **Cryptographic Trace Ledger**: The agent's thought logs, tool inputs, and decision status are hashed using SHA-256 upon case completion. This hash serves as an immutable verification lock suitable for regulatory audits.
