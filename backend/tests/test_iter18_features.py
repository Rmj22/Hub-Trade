# Iteration 18: jobs auto-id/status, vehicles rental fields, equipment category, sectioned estimates + payment schedule, team auto-credentials
import os, secrets
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = BASE_URL + "/api"
OWNER = {"email": "robinjones335@gmail.com", "password": os.environ.get("TEST_OWNER_PASSWORD", "BuildIt2026!")}
CREATED = {"jobs": [], "vehicles": [], "equipment": [], "estimates": [], "team": []}
TODAY = datetime.now(timezone.utc).date()
PAST = (TODAY - timedelta(days=5)).isoformat()
FUTURE = (TODAY + timedelta(days=30)).isoformat()


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    r = sess.post(f"{API}/auth/login", json=OWNER)
    if r.status_code != 200:
        pytest.skip(f"owner login failed {r.status_code} {r.text}")
    yield sess
    for coll in ("jobs", "vehicles", "equipment", "estimates"):
        for i in CREATED[coll]:
            sess.delete(f"{API}/{coll}/{i}")
    for i in CREATED["team"]:
        sess.delete(f"{API}/team/{i}")


# --- Jobs ---
class TestJobs:
    def test_create_late_job(self, s):
        r = s.post(f"{API}/jobs", json={"customer_name": "TEST_Smith", "start_date": PAST, "completion_date": PAST})
        assert r.status_code == 200, r.text
        d = r.json(); CREATED["jobs"].append(d["id"])
        assert isinstance(d["job_number"], int) and d["job_number"] >= 1001
        assert d["name"] == f"#{d['job_number']} – TEST_Smith"
        assert d["status"] == "late"

    def test_create_on_time_and_completed(self, s):
        r = s.post(f"{API}/jobs", json={"customer_name": "TEST_Ontime", "completion_date": FUTURE})
        d = r.json(); CREATED["jobs"].append(d["id"])
        assert d["status"] == "on_time"
        r2 = s.post(f"{API}/jobs", json={"customer_name": "TEST_Done", "completion_date": PAST, "status": "completed"})
        d2 = r2.json(); CREATED["jobs"].append(d2["id"])
        assert d2["status"] == "completed"
        assert d2["job_number"] == d["job_number"] + 1 or d2["job_number"] > d["job_number"]

    def test_put_keeps_number_recomputes_name(self, s):
        r = s.post(f"{API}/jobs", json={"customer_name": "TEST_Before", "completion_date": FUTURE})
        d = r.json(); CREATED["jobs"].append(d["id"])
        u = s.put(f"{API}/jobs/{d['id']}", json={"customer_name": "TEST_After", "completion_date": PAST, "status": "on_time"})
        assert u.status_code == 200, u.text
        ud = u.json()
        assert ud["job_number"] == d["job_number"]
        assert ud["name"] == f"#{d['job_number']} – TEST_After"
        assert ud["status"] == "late"
        g = s.get(f"{API}/jobs/{d['id']}").json()
        assert g["name"] == ud["name"] and g["status"] == "late"
        # mark completed
        c = s.put(f"{API}/jobs/{d['id']}", json={"customer_name": "TEST_After", "status": "completed"}).json()
        assert c["status"] == "completed"

    def test_dashboard_jobs_behind_counts_late(self, s):
        before = s.get(f"{API}/dashboard").json()["jobs_behind"]
        r = s.post(f"{API}/jobs", json={"customer_name": "TEST_Behind", "completion_date": PAST})
        CREATED["jobs"].append(r.json()["id"])
        after = s.get(f"{API}/dashboard").json()["jobs_behind"]
        assert after == before + 1

    def test_dashboard_counts_late_job_created_with_client_status(self, s):
        # client may send status 'on_time' (e.g. via edit form); still must count as behind
        before = s.get(f"{API}/dashboard").json()["jobs_behind"]
        r = s.post(f"{API}/jobs", json={"customer_name": "TEST_Behind2", "completion_date": PAST, "status": "on_time"})
        CREATED["jobs"].append(r.json()["id"])
        assert r.json()["status"] == "late"
        after = s.get(f"{API}/dashboard").json()["jobs_behind"]
        assert after == before + 1, "job POSTed with status!='active' not counted in jobs_behind"


# --- Vehicles / Equipment ---
class TestResources:
    def test_vehicle_large_rent(self, s):
        p = {"name": "TEST_Excavator", "type": "Large Vehicle", "ownership": "rent", "rental_start_date": PAST, "rental_status": "returned"}
        r = s.post(f"{API}/vehicles", json=p)
        assert r.status_code == 200, r.text
        d = r.json(); CREATED["vehicles"].append(d["id"])
        g = s.get(f"{API}/vehicles/{d['id']}").json()
        for k, v in p.items():
            assert g[k] == v

    def test_equipment_shop_tool_servicing(self, s):
        r = s.post(f"{API}/equipment", json={"name": "TEST_Saw", "category": "Shop Tool", "status": "servicing"})
        assert r.status_code == 200, r.text
        d = r.json(); CREATED["equipment"].append(d["id"])
        g = s.get(f"{API}/equipment/{d['id']}").json()
        assert g["category"] == "Shop Tool" and g["status"] == "servicing"


# --- Estimates ---
class TestEstimates:
    def test_sectioned_estimate_schedule_and_public(self, s):
        items = [
            {"section": "materials", "desc": "Lumber", "qty": 1, "unit_price": 1000},
            {"section": "labor", "desc": "Framing", "qty": 1, "unit_price": 500},
            {"section": "services", "desc": "Permit", "qty": 1, "unit_price": 100.01},
        ]
        r = s.post(f"{API}/estimates", json={"customer_name": "TEST_Est", "customer_email": "test_est@example.com",
                                              "line_items": items, "job_start_date": "2026-03-01", "num_payments": 3})
        assert r.status_code == 200, r.text
        d = r.json(); CREATED["estimates"].append(d["id"])
        assert abs(d["total"] - 1600.01) < 0.001
        ps = d["payment_schedule"]
        assert len(ps) == 3
        assert ps[0]["label"] == "Deposit" and ps[1]["label"] == "Payment 2"
        assert ps[0]["due_date"] == "2026-03-01"
        assert abs(sum(p["amount"] for p in ps) - 1600.01) < 0.001
        sent = s.post(f"{API}/estimates/{d['id']}/send")
        assert sent.status_code == 200, sent.text
        token = sent.json()["link"].rstrip("/").split("/")[-1]
        pub = requests.get(f"{API}/public/estimates/{token}")
        assert pub.status_code == 200
        assert pub.json()["payment_schedule"] == ps

    def test_put_estimate_recomputes_schedule(self, s):
        r = s.post(f"{API}/estimates", json={"customer_name": "TEST_Est2", "line_items": [{"section": "labor", "desc": "x", "qty": 1, "unit_price": 300}], "num_payments": 2})
        d = r.json(); CREATED["estimates"].append(d["id"])
        u = s.put(f"{API}/estimates/{d['id']}", json={"customer_name": "TEST_Est2", "line_items": [{"section": "labor", "desc": "x", "qty": 1, "unit_price": 400}], "num_payments": 4, "job_start_date": "2026-02-01"}).json()
        assert u["total"] == 400 and len(u["payment_schedule"]) == 4
        assert all(p["amount"] == 100 for p in u["payment_schedule"])


# --- Team ---
class TestTeam:
    def test_add_member_autocreds_and_login(self, s):
        name = f"TEST Emp {secrets.token_hex(2)}"
        r = s.post(f"{API}/team", json={"name": name, "role": "employee"})
        assert r.status_code == 200, r.text
        d = r.json(); CREATED["team"].append(d["id"])
        cr = d["credentials"]
        assert cr["username"] and cr["password"] and len(cr["password"]) >= 8
        assert "password_hash" not in d
        l = requests.post(f"{API}/auth/login", json={"email": cr["username"], "password": cr["password"]})
        assert l.status_code == 200, l.text
        assert l.json()["role"] == "employee" and l.json()["name"] == name
        bad = requests.post(f"{API}/auth/login", json={"email": cr["username"], "password": "wrongpass"})
        assert bad.status_code == 401

    def test_add_member_with_email_dupe_rejected(self, s):
        r = s.post(f"{API}/team", json={"name": "TEST dupe", "role": "employee", "email": OWNER["email"]})
        assert r.status_code == 400
