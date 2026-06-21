
import json
import sys
# Mount virtual environment packages and project root inside python path
sys.path.append('/app/.venv/lib/python3.13/site-packages')
sys.path.append('/app')
from backend.app.agent.tools import dha_identity_check

try:
    result = dha_identity_check(id_number='1111111111111')
    print(json.dumps(result))
except Exception as e:
    from backend.app.models import AuditStatus
    print(json.dumps({"status": AuditStatus.ERROR.value, "message": str(e)}))
