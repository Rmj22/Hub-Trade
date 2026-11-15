"""Helper: create a TEST_ owner+foreman company and archive it (for UI testing). Prints ids."""
import os, sys, uuid
from datetime import datetime, timedelta, timezone
import requests
from bson import ObjectId
from dotenv import dotenv_values
from pymongo import MongoClient

API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
env = dotenv_values("/app/backend/.env")
db = MongoClient(env["MONGO_URL"])[env["DB_NAME"]]
sfx = uuid.uuid4().hex[:8]
s = requests.Session()
u = s.post(f"{API}/auth/register", json={"email": f"test_arch_{sfx}@example.com", "password": "TrialPass1!",
                                        "name": "TEST Arch Owner", "company_name": f"TEST_ARCH_{sfx}"}).json()
r = s.post(f"{API}/team", json={"email": f"test_fm_{sfx}@example.com", "password": "FmPass123!", "name": "TEST Fm", "role": "foreman"})
print("foreman", r.status_code)
db.companies.update_one({"_id": ObjectId(u["company_id"])}, {"$set": {"trial_ends_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()}})
print(u["company_id"], f"test_arch_{sfx}@example.com", f"test_fm_{sfx}@example.com")
