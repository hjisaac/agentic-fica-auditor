
import json
import sys
# Mount virtual environment packages and project root inside python path
sys.path.append('/app/.venv/lib/python3.13/site-packages')
sys.path.append('/app')
from backend.app.agent.tools import bank_account_verify

try:
    result = bank_account_verify(account_number='444333222', bank_name='Capitec', id_number='9503120123087', full_name='Kagiso Modise')
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"status": "ERROR", "message": str(e)}))
