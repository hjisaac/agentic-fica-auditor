import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from backend.app.api import router as api_router

logger = logging.getLogger("fc_agent")

app = FastAPI(title="Fraudcheck FICA Compliance Agent API")

# Enable CORS for cross-origin frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include compliance API endpoints router
app.include_router(api_router)

# Serve static frontend files with correct routing
react_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend/dist'))

@app.get("/{path:path}")
async def serve_static(path: str):
    if not os.path.exists(react_dir):
        raise HTTPException(
            status_code=500,
            detail="Frontend production build not found. Please run the build command inside the frontend directory first."
        )
    file_path = os.path.join(react_dir, path)
    if path != "" and os.path.exists(file_path):
        return FileResponse(file_path)
    else:
        return FileResponse(os.path.join(react_dir, 'index.html'))
