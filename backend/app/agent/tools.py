import re
import json
from playhouse.shortcuts import model_to_dict
from backend.app.models import DHAPerson, CIPCCompany, Watchlist, AdverseMedia, AuditStatus

def dha_identity_check(id_number: str) -> dict:
    """
    Queries the mock Department of Home Affairs (DHA) database.
    Verifies ID validity, citizen status, and deceased status.
    """
    id_number = re.sub(r"\D", "", id_number)
    
    if len(id_number) != 13:
        return {
            "status": AuditStatus.ERROR.value,
            "message": "Invalid ID Number length. South African IDs must be exactly 13 digits."
        }
    
    try:
        person = DHAPerson.get(DHAPerson.id_number == id_number)
        person_dict = model_to_dict(person)
    except DHAPerson.DoesNotExist:
        return {
            "status": AuditStatus.REJECT.value,
            "message": "ID Number not found in DHA registry."
        }
        
    return {
        "status": AuditStatus.ACCEPT.value,
        "verified": True,
        "first_names": person_dict["first_names"],
        "last_name": person_dict["last_name"],
        "dob": person_dict["dob"],
        "gender": person_dict["gender"],
        "alive_status": person_dict["status"],
        "citizen_status": person_dict["citizen_status"]
    }

def cipc_business_lookup(registration_number: str) -> dict:
    """
    Queries the mock Companies and Intellectual Property Commission (CIPC) database.
    Retrieves company status and beneficial owners (directors).
    """
    clean_reg = registration_number.replace(" ", "")
    
    # Verify South African CIPC registration pattern (e.g. 2021/100200/07)
    match = re.match(r"^\d{4}/\d{6}/\d{2}$", clean_reg)
    if not match:
        return {
            "status": AuditStatus.ERROR.value,
            "message": "Invalid South African CIPC registration format. Use YYYY/NNNNNN/NN (e.g. 2021/100200/07)."
        }
        
    try:
        company = CIPCCompany.get(CIPCCompany.registration_number == clean_reg)
        company_dict = model_to_dict(company)
        company_dict["directors"] = json.loads(company_dict.pop("directors_json", "[]"))
    except CIPCCompany.DoesNotExist:
        return {
            "status": AuditStatus.REJECT.value,
            "message": "Company registration number not found in CIPC registry."
        }
        
    return {
        "status": AuditStatus.ACCEPT.value,
        "verified": True,
        "company_name": company_dict["name"],
        "company_status": company_dict["status"],
        "registration_date": company_dict["registration_date"],
        "directors": company_dict["directors"]
    }

def pep_sanctions_screen(full_name: str) -> dict:
    """
    Screens a name against mock global PEP and Sanction lists.
    """
    if not full_name or len(full_name.strip()) < 3:
        return {
            "status": AuditStatus.ERROR.value,
            "message": "Name is too short for search. Please provide full name and surname."
        }
        
    hits = Watchlist.select().where(Watchlist.name.contains(full_name))
    hits_list = [model_to_dict(hit, exclude=[Watchlist.id]) for hit in hits]
    
    if len(hits_list) == 0:
        return {
            "status": AuditStatus.ACCEPT.value,
            "match_found": False,
            "hits": []
        }
        
    # Determine the maximum risk level
    risk_levels = [hit.get("risk_level", "Low") for hit in hits_list]
    max_risk = "Low"
    if "High" in risk_levels:
        max_risk = "High"
    elif "Medium" in risk_levels:
        max_risk = "Medium"
        
    return {
        "status": AuditStatus.REVIEW.value if max_risk == "Medium" else AuditStatus.REJECT.value,
        "match_found": True,
        "max_risk_level": max_risk,
        "hits": hits_list
    }

def bank_account_verify(account_number: str, bank_name: str, id_number: str, full_name: str) -> dict:
    """
    Simulates South African real-time bank verification (AVS).
    """
    account_number = re.sub(r"\D", "", account_number)
    if not account_number or len(account_number) < 8 or len(account_number) > 11:
        return {
            "status": AuditStatus.ERROR.value,
            "message": "Invalid bank account number length."
        }
        
    try:
        person = DHAPerson.get(DHAPerson.id_number == id_number)
        person_dict = model_to_dict(person)
    except DHAPerson.DoesNotExist:
        return {
            "status": AuditStatus.REJECT.value,
            "verified": False,
            "message": "ID number verification failed, unable to match bank account."
        }
        
    full_name_lower = full_name.lower()
    person_first = person_dict["first_names"].lower()
    person_last = person_dict["last_name"].lower()
    
    name_match = person_last in full_name_lower and (person_first in full_name_lower or full_name_lower in person_first)
    
    if not name_match:
        return {
            "status": AuditStatus.REVIEW.value,
            "verified": True,
            "account_status": "Active",
            "owner_match": "No Match",
            "message": "Bank account is active but name does not match the account holder record."
        }
        
    return {
        "status": AuditStatus.ACCEPT.value,
        "verified": True,
        "account_status": "Active",
        "owner_match": "Exact Match",
        "branch_code": "250655",
        "message": "Bank account is active and ownership matches the provided ID details."
    }

def adverse_media_check(full_name: str) -> dict:
    """
    Screens name against mock adverse media database.
    Returns matched news articles containing negative allegations.
    """
    if not full_name or len(full_name.strip()) < 3:
        return {
            "status": AuditStatus.ERROR.value,
            "message": "Name is too short for adverse media search."
        }
        
    hits = AdverseMedia.select().where(AdverseMedia.target_name.contains(full_name))
    hits_list = [model_to_dict(hit, exclude=[AdverseMedia.id]) for hit in hits]
    
    if len(hits_list) == 0:
        return {
            "status": AuditStatus.ACCEPT.value,
            "match_found": False,
            "articles": []
        }
        
    severities = [hit.get("severity", "None") for hit in hits_list]
    max_severity = "None"
    if "High" in severities:
        max_severity = "High"
    elif "Medium" in severities:
        max_severity = "Medium"
    elif "Low" in severities:
        max_severity = "Low"
        
    return {
        "status": AuditStatus.REVIEW.value if max_severity in ["Medium", "High"] else AuditStatus.ACCEPT.value,
        "match_found": True,
        "max_severity": max_severity,
        "articles": hits_list
    }


