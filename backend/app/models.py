import os
import logging
from enum import StrEnum
from peewee import *

logger = logging.getLogger("fc_agent")

class TransactionType(StrEnum):
    KYC = "KYC"
    KYB = "KYB"

class AuditStatus(StrEnum):
    ACCEPT = "ACCEPT"
    REVIEW = "REVIEW"
    REJECT = "REJECT"
    ERROR = "ERROR"
    UNKNOWN = "UNKNOWN"

class StepType(StrEnum):
    THOUGHT = "THOUGHT"
    ACTION = "ACTION"
    OBSERVATION = "OBSERVATION"
    DECISION = "DECISION"


base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
db_path = os.path.join(base_dir, "compliance.db")
db = SqliteDatabase(db_path)

class Case(Model):
    id = CharField(primary_key=True, max_length=50)
    parent_case_id = CharField(null=True, max_length=50)
    timestamp = CharField(max_length=50)
    type = CharField(max_length=20)
    target_name = CharField(max_length=100)
    status = CharField(max_length=20)
    risk_score = IntegerField(default=0)
    sandbox_hash = CharField(max_length=64)
    summary = TextField(null=True)
    traces_json = TextField(default="[]")

    class Meta:
        database = db
        table_name = 'cases'

class DHAPerson(Model):
    id_number = CharField(primary_key=True, max_length=13)
    first_names = CharField(max_length=100)
    last_name = CharField(max_length=100)
    dob = CharField(max_length=20)
    gender = CharField(max_length=20)
    status = CharField(max_length=20, default="Alive")
    citizen_status = CharField(max_length=50, default="South African Citizen")

    class Meta:
        database = db
        table_name = 'dha_registry'

class CIPCCompany(Model):
    registration_number = CharField(primary_key=True, max_length=50)
    name = CharField(max_length=150)
    status = CharField(max_length=50)
    registration_date = CharField(max_length=20)
    directors_json = TextField()

    class Meta:
        database = db
        table_name = 'cipc_registry'

class Watchlist(Model):
    id = CharField(primary_key=True, max_length=50)
    name = CharField(max_length=100)
    type = CharField(max_length=50)
    list_name = CharField(max_length=100)
    reason = CharField(max_length=250)
    risk_level = CharField(max_length=20)

    class Meta:
        database = db
        table_name = 'watchlist'

class AdverseMedia(Model):
    id = CharField(primary_key=True, max_length=50)
    target_name = CharField(max_length=100)
    title = CharField(max_length=250)
    snippet = TextField()
    source = CharField(max_length=100)
    severity = CharField(max_length=20)  # None, Low, Medium, High

    class Meta:
        database = db
        table_name = 'adverse_media'

# DB Auto-Initialization & Seeding from JSON fixtures
def init_db():
    import json
    db.connect(reuse_if_open=True)
    db.create_tables([Case, DHAPerson, CIPCCompany, Watchlist, AdverseMedia])
    
    # Seed if registry is empty
    if DHAPerson.select().count() == 0:
        fixtures_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
        
        # 1. Seed DHA
        dha_path = os.path.join(fixtures_dir, "dha_registry.json")
        if os.path.exists(dha_path):
            with open(dha_path, "r") as f:
                dha_data = json.load(f)
                for d in dha_data:
                    DHAPerson.create(**d)
                    
        # 2. Seed CIPC
        cipc_path = os.path.join(fixtures_dir, "cipc_registry.json")
        if os.path.exists(cipc_path):
            with open(cipc_path, "r") as f:
                cipc_data = json.load(f)
                for c in cipc_data:
                    CIPCCompany.create(
                        registration_number=c["registration_number"],
                        name=c["name"],
                        status=c["status"],
                        registration_date=c["registration_date"],
                        directors_json=json.dumps(c["directors_json"])
                    )
                    
        # 3. Seed Watchlist
        watchlist_path = os.path.join(fixtures_dir, "watchlist.json")
        if os.path.exists(watchlist_path):
            with open(watchlist_path, "r") as f:
                watchlist_data = json.load(f)
                for w in watchlist_data:
                    Watchlist.create(**w)

        # 4. Seed Adverse Media
        adverse_path = os.path.join(fixtures_dir, "adverse_media.json")
        if os.path.exists(adverse_path):
            with open(adverse_path, "r") as f:
                adverse_data = json.load(f)
                for a in adverse_data:
                    AdverseMedia.create(**a)

init_db()
logger.info("Utilizing SQLite database via Peewee ORM (Auto-initialized).")


