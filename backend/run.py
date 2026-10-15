import os
import sys
import logging
from dotenv import load_dotenv
import uvicorn

# Load environment variables from .env file
load_dotenv()

# Configure logging format to standard layout
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    stream=sys.stdout
)
logger = logging.getLogger("fc_agent")

# Ensure root directory is in the Python path
base_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.dirname(base_dir))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    is_dev = os.environ.get("ENV", "production").lower() == "development"
    logger.info(f"Starting FastAPI Backend Server on port {port} (dev={is_dev})...")
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=port, reload=is_dev)

