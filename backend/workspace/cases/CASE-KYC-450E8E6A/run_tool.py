
import json
import sys
# Mount virtual environment packages and project root inside python path
sys.path.append('/app/.venv/lib/python3.13/site-packages')
sys.path.append('/app')
from backend.app.agent.tools import dha_identity_check

try:
    result = dha_identity_check(id_number='9001015000081')
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"status": "ERROR", "message": str(e)}))
