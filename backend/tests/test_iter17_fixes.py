# Iteration 17: payment-link webhook reactivation (FIX 1) + archived member API state (FIX 2 backend part)
import hashlib, hmac, json, os, time, uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from bson import ObjectId
from dotenv import dotenv_values
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = BASE_URL + "/api"
ENV = dotenv_values("/app/backend/.env")
db = MongoClient(ENV["MONGO_URL"])[ENV["DB_NAME"]]
SECRET = ENV["STRIPE_WEBHOOK_SECRET"]
CREATED = {"companies": [], "users": [], "sessions": []}


def signed_post(event: dict, secret=SECRET):
    payload = json.dumps(event)
    ts = int(time.time())
    sig = hmac.new(secret.encode(), f"{ts}.{payload}".encode(), hashlib.sha256).hexdigest()
    return requests.post(f"{API}/stripe/webhook", data=payload,
                         headers={"Content-Type": "application/json", "Stripe-Signature": f"t={ts},v1={sig}"})


def make_archived_owner():
    sfx = uuid.uuid4().hex[:8]
    s = requests.Session()
    email = f"test_pl_{sfx}@example.com"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "TrialPass1!", "name": "TEST PL", "company_name": f"TEST_PL_{sfx}"})
    assert r.status_code == 200, r.text
    u = r.json()
    cid = u["company_id"]
    CREATED["companies"].append(cid)
    CREATED["users"].append(email)
    db.companies.update_one({"_id": ObjectId(cid)}, {"$set": {"trial_ends_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()}})
    assert s.get(f"{API}/jobs").status_code == 402
    c = db.companies.find_one({"_id": ObjectId(cid)})
    assert c["membership_status"] == "archived" and c.get("archived_at")
    return s, email, cid


def event_for(email, amount, sid=None):
    sid = sid or f"cs_test_link_{uuid.uuid4().hex[:10]}"
    CREATED["sessions"].append(sid)
    return sid, {"id": f"evt_test_{uuid.uuid4().hex[:8]}", "object": "event", "type": "checkout.session.completed",
                 "data": {"object": {"id": sid, "object": "checkout.session", "customer_details": {"email": email.upper()},
                                     "amount_total": amount, "currency": "usd", "payment_status": "paid"}}}


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    for cid in CREATED["companies"]:
        for col in ("jobs", "notifications", "audit_logs", "payment_transactions"):
            db[col].delete_many({"company_id": cid})
        db.companies.delete_one({"_id": ObjectId(cid)})
        db.users.delete_many({"company_id": cid})
    for sid in CREATED["sessions"]:
        db.payment_transactions.delete_many({"session_id": sid})


class TestPaymentLinkWebhook:
    @pytest.mark.parametrize("amount,plan", [(8900, "medium"), (6000, "startup"), (14900, "large")])
    def test_payment_link_reactivates(self, amount, plan):
        s, email, cid = make_archived_owner()
        sid, ev = event_for(email, amount)
        r = signed_post(ev)
        assert r.status_code == 200, r.text
        c = db.companies.find_one({"_id": ObjectId(cid)})
        assert c["membership_status"] == "active"
        assert c["plan"] == plan
        assert "archived_at" not in c
        tx = db.payment_transactions.find_one({"session_id": sid})
        assert tx and tx["source"] == "payment_link" and tx["plan"] == plan and tx["company_id"] == cid
        assert s.get(f"{API}/jobs").status_code == 200
        me = s.get(f"{API}/auth/me").json()
        assert me["company"]["membership_status"] == "active"

    def test_bad_signature_rejected(self):
        _, ev = event_for("nobody@example.com", 8900)
        r = signed_post(ev, secret="whsec_wrong")
        assert r.status_code == 400

    def test_unknown_email_no_tx(self):
        sid, ev = event_for(f"test_unknown_{uuid.uuid4().hex[:6]}@example.com", 8900)
        assert signed_post(ev).status_code == 200
        assert db.payment_transactions.find_one({"session_id": sid}) is None

    def test_unknown_amount_no_activation(self):
        s, email, cid = make_archived_owner()
        sid, ev = event_for(email, 1234)
        assert signed_post(ev).status_code == 200
        c = db.companies.find_one({"_id": ObjectId(cid)})
        assert c["membership_status"] == "archived"

    def test_replay_same_session_idempotent(self):
        s, email, cid = make_archived_owner()
        sid, ev = event_for(email, 8900)
        assert signed_post(ev).status_code == 200
        assert signed_post(ev).status_code == 200
        n = db.payment_transactions.count_documents({"session_id": sid})
        print("tx count after replay:", n)
        assert n == 1


class TestArchivedMember:
    def test_foreman_archived_me_and_402(self):
        sfx = uuid.uuid4().hex[:8]
        s = requests.Session()
        u = s.post(f"{API}/auth/register", json={"email": f"test_am_{sfx}@example.com", "password": "TrialPass1!", "name": "TEST AM", "company_name": f"TEST_AM_{sfx}"}).json()
        CREATED["companies"].append(u["company_id"])
        fm = f"test_amfm_{sfx}@example.com"
        r = s.post(f"{API}/team", json={"email": fm, "password": "FmPass123!", "name": "TEST Fm", "role": "foreman"})
        assert r.status_code in (200, 201), r.text
        db.companies.update_one({"_id": ObjectId(u["company_id"])}, {"$set": {"trial_ends_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()}})
        f = requests.Session()
        lr = f.post(f"{API}/auth/login", json={"email": fm, "password": "FmPass123!"})
        assert lr.status_code == 200
        me = f.get(f"{API}/auth/me").json()
        assert me["role"] == "foreman"
        assert me["company"]["membership_status"] == "archived"
        assert f.get(f"{API}/jobs").status_code == 402
