import json
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from playhouse.shortcuts import model_to_dict
from backend.app.models import Case, TransactionType
from backend.app.agent.engine import ComplianceAgentEngine

logger = logging.getLogger("fc_agent")
router = APIRouter(prefix="/api")
agent_engine = ComplianceAgentEngine()

# Pydantic Schemas for Requests
class KYCRequest(BaseModel):
    first_names: str
    last_name: str
    id_number: str
    bank_name: Optional[str] = None
    account_number: Optional[str] = None

class KYBRequest(BaseModel):
    company_name: str
    registration_number: str

@router.post("/kyc")
async def run_kyc(payload: KYCRequest):
    """Trigger an individual KYC check."""
    try:
        result = agent_engine.verify_individual(
            first_names=payload.first_names,
            last_name=payload.last_name,
            id_number=payload.id_number,
            account_number=payload.account_number,
            bank_name=payload.bank_name
        )
        return result
    except Exception as e:
        logger.exception("FICA KYC Agent execution failed.")
        raise HTTPException(status_code=500, detail=f"Agent loop failed: {str(e)}")

@router.post("/kyb")
async def run_kyb(payload: KYBRequest):
    """Trigger a business KYB check."""
    try:
        result = agent_engine.verify_business(
            company_name=payload.company_name,
            registration_number=payload.registration_number
        )
        return result
    except Exception as e:
        logger.exception("FICA KYB Agent execution failed.")
        raise HTTPException(status_code=500, detail=f"Agent loop failed: {str(e)}")

@router.get("/cases")
async def get_cases():
    """Retrieve all case compliance logs."""
    try:
        cases = Case.select().order_by(Case.timestamp.desc())
        return [model_to_dict(c) for c in cases]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/cases/{case_id}/audit")
async def get_case_audit(case_id: str):
    """Retrieve detailed step-by-step reasoning trace and logs for a case."""
    try:
        case_obj = Case.get(Case.id == case_id)
        case_dict = model_to_dict(case_obj)
        case_dict["traces"] = json.loads(case_obj.traces_json)
        
        # If this is a KYB check, retrieve its spawned director (child) cases
        case_dict["children"] = []
        if case_dict.get("type") == TransactionType.KYB.value:
            children = Case.select().where(Case.parent_case_id == case_id)
            for child in children:
                child_dict = model_to_dict(child)
                child_dict["traces"] = json.loads(child.traces_json)
                case_dict["children"].append(child_dict)
                
        return case_dict
    except Case.DoesNotExist:
        raise HTTPException(status_code=404, detail=f"Case with ID '{case_id}' not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
