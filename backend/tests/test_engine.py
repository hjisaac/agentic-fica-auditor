import pytest
from backend.app.agent.engine import ComplianceAgentEngine
from backend.app.models import Case, AuditStatus, TransactionType

def test_verify_individual_accept():
    engine = ComplianceAgentEngine()
    # Shereen Naidoo is a clean South African Citizen
    result = engine.verify_individual(
        first_names="Shereen",
        last_name="Naidoo",
        id_number="8507155123084",
        account_number="1234567890",
        bank_name="Standard Bank"
    )
    
    assert result["id"].startswith("CASE-KYC-")
    assert result["target_name"] == "Shereen Naidoo"
    assert result["type"] == TransactionType.KYC.value
    assert result["status"] == AuditStatus.ACCEPT.value
    assert result["risk_score"] == 10
    
    # Check that case was saved to database
    case_in_db = Case.get_or_none(Case.id == result["id"])
    assert case_in_db is not None
    assert case_in_db.status == AuditStatus.ACCEPT.value
    assert case_in_db.risk_score == 10

def test_verify_individual_reject_dha():
    engine = ComplianceAgentEngine()
    # Using an ID not present in our seeded DHA registry
    result = engine.verify_individual(
        first_names="Unknown",
        last_name="Person",
        id_number="1111111111111"
    )
    
    assert result["status"] == AuditStatus.REJECT.value
    assert result["risk_score"] == 100
    assert "not found in DHA registry" in result["summary"]
    
    case_in_db = Case.get_or_none(Case.id == result["id"])
    assert case_in_db is not None
    assert case_in_db.status == AuditStatus.REJECT.value
    assert case_in_db.risk_score == 100

def test_verify_individual_watchlist_and_adverse_media():
    engine = ComplianceAgentEngine()
    # Victor Sanctioned is seeded in Watchlist (High OFAC list) and Adverse Media (High severity)
    result = engine.verify_individual(
        first_names="Victor",
        last_name="Sanctioned",
        id_number="6001015000080"
    )
    
    # High PEP match leads to REJECT, risk score 95
    assert result["status"] == AuditStatus.REJECT.value
    assert result["risk_score"] == 95
    assert "PEP hit detected" in result["summary"]
    assert "Adverse news articles matched" in result["summary"]
    
    case_in_db = Case.get_or_none(Case.id == result["id"])
    assert case_in_db is not None
    assert case_in_db.status == AuditStatus.REJECT.value
    assert case_in_db.risk_score == 95

def test_verify_business_accept():
    engine = ComplianceAgentEngine()
    # Apex Tech Solutions (Pty) Ltd is a registered company
    result = engine.verify_business(
        company_name="Apex Tech Solutions (Pty) Ltd",
        registration_number="2021/100200/07"
    )
    
    assert result["id"].startswith("CASE-KYB-")
    assert result["target_name"] == "Apex Tech Solutions (Pty) Ltd"
    assert result["type"] == TransactionType.KYB.value
    # It should succeed or require review (based on director results)
    assert result["status"] in [AuditStatus.ACCEPT.value, AuditStatus.REVIEW.value]
    
    case_in_db = Case.get_or_none(Case.id == result["id"])
    assert case_in_db is not None

def test_verify_individual_live_failure_fallback_warning(monkeypatch):
    import json
    import backend.app.agent.engine as engine_module
    if not engine_module.HAS_GEMINI:
        pytest.skip("Google GenAI SDK is not installed")
        
    # Force live mode configured to True
    monkeypatch.setattr(engine_module, "IS_GEMINI_KEY_VALID", True)
    
    # Mock genai.Client to raise an exception on init
    def mock_client_init(*args, **kwargs):
        raise RuntimeError("API quota exceeded (Mock 429)")
    
    monkeypatch.setattr(engine_module.genai, "Client", mock_client_init)
    
    engine = ComplianceAgentEngine()
    
    result = engine.verify_individual(
        first_names="Sipho",
        last_name="Maseko",
        id_number="9001015000080"
    )
    
    # Verify fallback succeeded and did not raise an exception
    assert result["status"] == AuditStatus.REJECT.value
    
    # Verify warning trace was prepended at step_index 0
    traces = json.loads(result["traces_json"])
    assert len(traces) > 0
    assert traces[0]["step_index"] == 0
    assert traces[0]["name"] == "Live Connection Warning"
    assert "[API WARNING] Live Gemini verification failed" in traces[0]["content"]
    assert "RESOURCE_EXHAUSTED" in traces[0]["content"]
