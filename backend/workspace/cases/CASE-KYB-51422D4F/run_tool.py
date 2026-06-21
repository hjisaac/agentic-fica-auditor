
import json
import sys
# Mount virtual environment packages and project root inside python path
sys.path.append('/app/.venv/lib/python3.13/site-packages')
sys.path.append('/app')
from backend.app.agent.tools import cipc_business_lookup

try:
    result = cipc_business_lookup(registration_number='2018/345678/07')
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"status": "ERROR", "message": str(e)}))
