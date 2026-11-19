"""Auto 15-day Medium trial, archive (402) on trial end, reminder cron and archived purge."""
import os
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from bson import ObjectId
from dotenv import dotenv_values
from pymongo import MongoClient

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
_env = dotenv_values("/app/backend/.env")
CRON_SECRET = _env["WEBHOOK_CRON_SECRET"]
db = MongoClient(_env["MONGO_URL"])[_env["DB_NAME"]]
OWNER_EMAIL = "robinjones335@gmail.com"
OWNER_PASSWORD = os.environ["TEST_OWNER_PASSWORD"]

CREATED_COMPANIES = []


def iso(days):
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def register(prefix="trial"):
    s = requests.Session()
    sfx = uuid.uuid4().hex[:8]
    r = s.post(f"{API}/auth/register", json={"email": f"test_{prefix}_{sfx}@example.com", "password": "TrialPass1!",
                                            "name": f"TEST {prefix}", "company_name": f"TEST_{prefix}_{sfx}"})
    assert r.status_code == 200, r.text
    u = r.json()
    CREATED_COMPANIES.append(u["company_id"])
    return s, u


def run_cron():
    r = requests.post(f"{API}/cron/trial-reminders", headers={"Authorization": f"Bearer {CRON_SECRET}",
                                                              "X-Webhook-Id": f"test-{uuid.uuid4()}"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "accepted"
    time.sleep(6)


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for cid in CREATED_COMPANIES:
        for coll in ("jobs", "audit_logs", "notifications"):
            db[coll].delete_many({"company_id": cid})
        db.users.delete_many({"company_id": cid, "is_superadmin": {"$ne": True}})
        db.companies.delete_one({"_id": ObjectId(cid)})


# --- Signup gets auto trial
def test_register_auto_trial():
    s, u = register()
    me = s.get(f"{API}/auth/me").json()
    c = me["company"]
    assert c["plan"] == "medium"
    assert c["membership_status"] == "trial"
    assert c["trial_days_left"] == 15


def test_redeem_trial_removed():
    s, _ = register()
    r = s.post(f"{API}/membership/redeem-trial", json={"code": "HUBTRADE10"})
    assert r.status_code in (404, 405), r.status_code


# --- Trial user can use app
def test_trial_user_can_use_app():
    s, _ = register()
    r = s.post(f"{API}/jobs", json={"name": "TEST_job", "address": "1 Main"})
    assert r.status_code == 200, r.text
    assert s.get(f"{API}/jobs").status_code == 200
    assert s.get(f"{API}/dashboard").status_code == 200


# --- Trial end -> archived & 402
def test_trial_end_archives():
    s, u = register("arch")
    db.companies.update_one({"_id": ObjectId(u["company_id"])}, {"$set": {"trial_ends_at": iso(-1)}})
    r = s.get(f"{API}/jobs")
    assert r.status_code == 402, r.text
    assert "archived" in r.json()["detail"].lower()
    assert s.get(f"{API}/dashboard").status_code == 402
    me = s.get(f"{API}/auth/me")
    assert me.status_code == 200
    c = me.json()["company"]
    assert c["membership_status"] == "archived"
    assert c["plan"] is None
    assert c["days_until_removal"] in (5, 6)
    # payments still allowed (not 402)
    r = s.post(f"{API}/payments/checkout", json={"plan": "medium", "origin_url": BASE_URL})
    assert r.status_code != 402, r.text
    print("checkout status for archived:", r.status_code, r.text[:200])


# --- Cron auth
def test_cron_requires_secret():
    r = requests.post(f"{API}/cron/trial-reminders", headers={"Authorization": "Bearer wrong"})
    assert r.status_code == 401
    r = requests.post(f"{API}/cron/trial-reminders")
    assert r.status_code == 401


def test_cron_duplicate_webhook_id():
    wid = f"test-dup-{uuid.uuid4()}"
    h = {"Authorization": f"Bearer {CRON_SECRET}", "X-Webhook-Id": wid}
    assert requests.post(f"{API}/cron/trial-reminders", headers=h).json()["status"] == "accepted"
    assert requests.post(f"{API}/cron/trial-reminders", headers=h).json()["status"] == "duplicate"


# --- Cron reminders + purge
def test_cron_reminder_and_purge():
    _, a = register("rem4")
    _, b = register("rem7")
    sc, c = register("purge6")
    _, d = register("keep2")
    sc.post(f"{API}/jobs", json={"name": "TEST_purge_job"})
    assert db.jobs.count_documents({"company_id": c["company_id"]}) == 1
    db.companies.update_one({"_id": ObjectId(a["company_id"])}, {"$set": {"trial_ends_at": iso(4)}})
    db.companies.update_one({"_id": ObjectId(b["company_id"])}, {"$set": {"trial_ends_at": iso(7)}})
    db.companies.update_one({"_id": ObjectId(c["company_id"])}, {"$set": {"membership_status": "archived", "plan": None,
                                                                         "trial_ends_at": iso(-7), "archived_at": iso(-6)}})
    db.companies.update_one({"_id": ObjectId(d["company_id"])}, {"$set": {"membership_status": "archived", "plan": None,
                                                                         "trial_ends_at": iso(-3), "archived_at": iso(-2)}})
    run_cron()
    ca = db.companies.find_one({"_id": ObjectId(a["company_id"])})
    cb = db.companies.find_one({"_id": ObjectId(b["company_id"])})
    assert ca.get("trial_reminder_sent") is True
    assert cb.get("trial_reminder_sent") is not True
    assert db.companies.find_one({"_id": ObjectId(c["company_id"])}) is None
    assert db.users.count_documents({"company_id": c["company_id"]}) == 0
    assert db.jobs.count_documents({"company_id": c["company_id"]}) == 0
    cd = db.companies.find_one({"_id": ObjectId(d["company_id"])})
    assert cd is not None and cd["membership_status"] == "archived"
    assert db.users.count_documents({"company_id": d["company_id"]}) == 1


def test_cron_trial_ended_marks_archived():
    _, e = register("ended")
    db.companies.update_one({"_id": ObjectId(e["company_id"])}, {"$set": {"trial_ends_at": iso(-0.1)}})
    run_cron()
    ce = db.companies.find_one({"_id": ObjectId(e["company_id"])})
    assert ce["membership_status"] == "archived"
    assert ce.get("trial_ended_email_sent") is True
    assert ce.get("archived_at")


# --- Existing active owner unaffected
def test_active_owner_unaffected():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert r.status_code == 200
    c = s.get(f"{API}/auth/me").json()["company"]
    assert c["membership_status"] == "active"
    assert "trial_days_left" not in c
    for p in ("/jobs", "/dashboard", "/team", "/admin/stats", "/admin/data-entry-tickets"):
        assert s.get(f"{API}{p}").status_code == 200, p
