
import json
import sys
# Mount virtual environment packages and project root inside python path
sys.path.append('/app/.venv/lib/python3.13/site-packages')
sys.path.append('/app')
from backend.app.agent.tools import bank_account_verify

try:
    result = bank_account_verify(account_number='1012345678', bank_name='Standard Bank', id_number='9001015000081', full_name='Sipho Maseko')
    print(json.dumps(result))
except Exception as e:
    from backend.app.models import AuditStatus
    print(json.dumps({"status": AuditStatus.ERROR.value, "message": str(e)}))
