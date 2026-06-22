import os
import pytest
from fastapi.testclient import TestClient

# Determine path for test database in workspace root
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
db_test_path = os.path.join(base_dir, "compliance_test.db")

# Re-initialize peewee db to compliance_test.db before importing backend modules
from backend.app.models import db, init_db, Case, DHAPerson, CIPCCompany, Watchlist, AdverseMedia
db.init(db_test_path)

MODELS = [Case, DHAPerson, CIPCCompany, Watchlist, AdverseMedia]

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    # Initialize and seed compliance_test.db
    init_db()
    
    yield db
    
    # Close and remove the test database file
    db.close()
    if os.path.exists(db_test_path):
        try:
            os.remove(db_test_path)
        except Exception:
            pass

@pytest.fixture(autouse=True)
def clean_cases():
    # Truncate cases table between tests to ensure test isolation
    Case.delete().execute()
    yield

@pytest.fixture
def client():
    from backend.app.main import app
    with TestClient(app) as c:
        yield c
