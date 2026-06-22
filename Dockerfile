# ==========================================
# STAGE 1: Build the React Frontend
# ==========================================
FROM node:22-slim AS frontend-builder
WORKDIR /frontend

# Install pnpm globally
RUN npm install -g pnpm

# Copy frontend source files (including pnpm-lock.yaml and pnpm-workspace.yaml)
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
COPY frontend/tsconfig.json frontend/vite.config.ts ./
COPY frontend/tailwind.config.js frontend/postcss.config.js ./
COPY frontend/index.html ./
COPY frontend/src ./src

# Install dependencies using pnpm and build production assets
RUN pnpm install --frozen-lockfile
RUN pnpm run build

# ==========================================
# STAGE 2: Build the Python FastAPI Backend
# ==========================================
FROM python:3.10-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv (modern python package manager)
ADD https://astral.sh/uv/install.sh /uv-installer.sh
RUN sh /uv-installer.sh && rm /uv-installer.sh
ENV PATH="/root/.local/bin/:${PATH}"

# Copy backend dependencies definition
COPY pyproject.toml ./

# Sync python environment using uv (creates .venv)
RUN uv venv && uv pip install .

# Copy backend application source
COPY backend ./backend

# Copy the compiled static React build from STAGE 1 into the backend's static directory
COPY --from=frontend-builder /frontend/dist ./frontend/dist

# Expose port 8080 for Uvicorn
EXPOSE 8080

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH="."

# Run the FastAPI server via uv using the uvicorn script
CMD ["uv", "run", "backend/run.py"]
