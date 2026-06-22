import pytest
from backend.app.models import Case, AuditStatus, TransactionType

def test_api_run_kyc_success(client):
    payload = {
        "first_names": "Shereen",
        "last_name": "Naidoo",
        "id_number": "8507155123084",
        "bank_name": "Standard Bank",
        "account_number": "1234567890"
    }
    response = client.post("/api/kyc", json=payload)
    assert response.status_code == 200
    
    data = response.json()
    assert data["id"].startswith("CASE-KYC-")
    assert data["target_name"] == "Shereen Naidoo"
    assert data["status"] == AuditStatus.ACCEPT.value
    assert data["risk_score"] == 10

def test_api_run_kyc_invalid_payload(client):
    # Missing id_number
    payload = {
        "first_names": "Shereen",
        "last_name": "Naidoo"
    }
    response = client.post("/api/kyc", json=payload)
    assert response.status_code == 422  # Unprocessable Entity (FastAPI validation error)

def test_api_run_kyb_success(client):
    payload = {
        "company_name": "Apex Tech Solutions (Pty) Ltd",
        "registration_number": "2021/100200/07"
    }
    response = client.post("/api/kyb", json=payload)
    assert response.status_code == 200
    
    data = response.json()
    assert data["id"].startswith("CASE-KYB-")
    assert data["target_name"] == "Apex Tech Solutions (Pty) Ltd"
    assert data["type"] == TransactionType.KYB.value

def test_api_get_status(client):
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert "live_mode" in data
    # In tests, it should be False since the test environment has no valid key
    assert data["live_mode"] is False

def test_api_get_cases_empty(client):
    response = client.get("/api/cases")
    assert response.status_code == 200
    assert response.json() == []

def test_api_get_cases_populated(client):
    # Add a KYC case manually
    Case.create(
        id="CASE-1",
        timestamp="2026-06-22T07:00:00",
        type=TransactionType.KYC.value,
        target_name="Test User",
        status=AuditStatus.ACCEPT.value,
        risk_score=15,
        sandbox_hash="abc123hash",
        summary="Test summary",
        traces_json="[]"
    )
    
    response = client.get("/api/cases")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == "CASE-1"
    assert data[0]["target_name"] == "Test User"
    assert data[0]["status"] == AuditStatus.ACCEPT.value

def test_api_get_case_audit_success(client):
    # Add a KYC case with traces manually
    import json
    traces = [
        {"step_index": 1, "type": "THOUGHT", "content": "Checking DHA", "is_clean": True}
    ]
    Case.create(
        id="CASE-AUDIT-1",
        timestamp="2026-06-22T07:00:00",
        type=TransactionType.KYC.value,
        target_name="Audit User",
        status=AuditStatus.ACCEPT.value,
        risk_score=15,
        sandbox_hash="abc123hash",
        summary="Test summary",
        traces_json=json.dumps(traces)
    )
    
    response = client.get("/api/cases/CASE-AUDIT-1/audit")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "CASE-AUDIT-1"
    assert len(data["traces"]) == 1
    assert data["traces"][0]["content"] == "Checking DHA"

def test_api_get_case_audit_not_found(client):
    response = client.get("/api/cases/CASE-NONEXISTENT/audit")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"]
