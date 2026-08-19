"""FieldForge backend API tests."""
import os
import uuid
import io
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://trade-hub-910.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = "robinjones335@gmail.com"
OWNER_PASSWORD = "BuildIt2026!"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def owner_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert r.status_code == 200, r.text
    assert "access_token" in s.cookies
    return s


@pytest.fixture(scope="session")
def owner_me(owner_session):
    r = owner_session.get(f"{API}/auth/me")
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="session")
def unique_suffix():
    return uuid.uuid4().hex[:8]


# ---------- Auth ----------
class TestAuth:
    def test_login_and_me(self, owner_session, owner_me):
        assert owner_me["email"] == OWNER_EMAIL
        assert owner_me["role"] == "owner"
        assert "company" in owner_me and owner_me["company"] is not None
        assert owner_me["company"]["name"]

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_register_new_owner(self, unique_suffix):
        email = f"TEST_owner_{unique_suffix}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "Passw0rd!", "name": "Test Owner",
            "company_name": f"TEST Co {unique_suffix}"
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "owner"
        assert data["email"] == email
        assert "id" in data


# ---------- Team + RBAC ----------
@pytest.fixture(scope="session")
def employee_session(owner_session, unique_suffix):
    email = f"TEST_emp_{unique_suffix}@example.com"
    pw = "EmpPass1!"
    r = owner_session.post(f"{API}/team", json={"email": email, "password": pw, "name": "Test Emp", "role": "employee"})
    assert r.status_code == 200, r.text
    emp_user = r.json()
    s = requests.Session()
    lr = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert lr.status_code == 200
    return {"session": s, "user": emp_user}


@pytest.fixture(scope="session")
def foreman_session(owner_session, unique_suffix):
    email = f"TEST_fmn_{unique_suffix}@example.com"
    pw = "FmnPass1!"
    r = owner_session.post(f"{API}/team", json={"email": email, "password": pw, "name": "Test Fmn", "role": "foreman"})
    assert r.status_code == 200
    s = requests.Session()
    s.post(f"{API}/auth/login", json={"email": email, "password": pw})
    return s


class TestRBAC:
    def test_employee_cannot_create_employee(self, employee_session):
        r = employee_session["session"].post(f"{API}/employees", json={"name": "X"})
        assert r.status_code == 403

    def test_foreman_cannot_create_employee(self, foreman_session):
        r = foreman_session.post(f"{API}/employees", json={"name": "X"})
        assert r.status_code == 403

    def test_foreman_can_create_job(self, foreman_session):
        r = foreman_session.post(f"{API}/jobs", json={"name": "TEST Fmn Job"})
        assert r.status_code == 200
        r2 = foreman_session.delete(f"{API}/jobs/{r.json()['id']}")
        # foreman cannot delete
        assert r2.status_code == 403


# ---------- CRUD ----------
class TestCRUD:
    def test_jobs_crud(self, owner_session):
        payload = {"name": "TEST Job", "address": "1 Main", "status": "active", "material_cost": 100}
        r = owner_session.post(f"{API}/jobs", json=payload)
        assert r.status_code == 200
        job = r.json()
        assert job["name"] == "TEST Job"
        jid = job["id"]
        # list
        lr = owner_session.get(f"{API}/jobs")
        assert lr.status_code == 200
        assert any(j["id"] == jid for j in lr.json())
        # update
        ur = owner_session.put(f"{API}/jobs/{jid}", json={**payload, "name": "TEST Job Upd"})
        assert ur.status_code == 200
        assert ur.json()["name"] == "TEST Job Upd"
        # delete
        dr = owner_session.delete(f"{API}/jobs/{jid}")
        assert dr.status_code == 200
        # get 404
        gr = owner_session.get(f"{API}/jobs/{jid}")
        assert gr.status_code == 404

    def test_employee_crud(self, owner_session):
        r = owner_session.post(f"{API}/employees", json={"name": "TEST Emp", "hourly_rate": 30})
        assert r.status_code == 200
        eid = r.json()["id"]
        assert owner_session.delete(f"{API}/employees/{eid}").status_code == 200

    def test_vehicle_crud(self, owner_session):
        r = owner_session.post(f"{API}/vehicles", json={"name": "TEST Truck", "plate": "ABC"})
        assert r.status_code == 200
        assert owner_session.delete(f"{API}/vehicles/{r.json()['id']}").status_code == 200

    def test_equipment_crud(self, owner_session):
        r = owner_session.post(f"{API}/equipment", json={"name": "TEST Drill"})
        assert r.status_code == 200
        assert owner_session.delete(f"{API}/equipment/{r.json()['id']}").status_code == 200


# ---------- Cross-company scoping ----------
class TestScoping:
    def test_no_cross_company_leakage(self, owner_session, unique_suffix):
        # Register a new owner+company
        email = f"TEST_other_{unique_suffix}@example.com"
        s2 = requests.Session()
        r = s2.post(f"{API}/auth/register", json={
            "email": email, "password": "Pw123456!", "name": "Other Owner",
            "company_name": f"TEST Other {unique_suffix}"
        })
        assert r.status_code == 200
        # Owner1 creates a job
        j = owner_session.post(f"{API}/jobs", json={"name": "TEST Scoped Job"}).json()
        # Owner2 lists jobs - shouldn't include it
        lr = s2.get(f"{API}/jobs")
        assert lr.status_code == 200
        assert not any(x["id"] == j["id"] for x in lr.json())
        # cleanup
        owner_session.delete(f"{API}/jobs/{j['id']}")


# ---------- Time cards ----------
class TestTimeCards:
    def test_clock_in_out(self, owner_session, unique_suffix):
        emp = owner_session.post(f"{API}/employees", json={"name": f"TEST TC {unique_suffix}", "hourly_rate": 25}).json()
        eid = emp["id"]
        r = owner_session.post(f"{API}/timecards/clock-in", json={"employee_id": eid})
        assert r.status_code == 200
        # double clock-in blocked
        r2 = owner_session.post(f"{API}/timecards/clock-in", json={"employee_id": eid})
        assert r2.status_code == 400
        # active list contains it
        act = owner_session.get(f"{API}/timecards/active").json()
        assert any(t["employee_id"] == eid for t in act)
        # clock-out
        time.sleep(1)
        r3 = owner_session.post(f"{API}/timecards/clock-out", json={"employee_id": eid})
        assert r3.status_code == 200
        assert "hours" in r3.json()
        # cleanup
        owner_session.delete(f"{API}/employees/{eid}")


# ---------- Dashboard + reports ----------
class TestDashboardReports:
    def test_dashboard(self, owner_session):
        r = owner_session.get(f"{API}/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ["active_jobs", "clocked_in", "vehicles_in_use", "equipment_assigned", "jobs_behind", "upcoming_estimates"]:
            assert k in d

    def test_weekly_report(self, owner_session):
        r = owner_session.get(f"{API}/reports/weekly")
        assert r.status_code == 200
        d = r.json()
        for k in ["labor_hours", "labor_cost", "equipment_hours", "vehicle_hours", "completed_jobs", "material_cost"]:
            assert k in d


# ---------- Estimates ----------
class TestEstimates:
    def test_estimate_total_and_send(self, owner_session):
        payload = {
            "customer_name": "TEST Customer", "customer_email": "test-recipient@example.com",
            "line_items": [{"desc": "A", "qty": 2, "unit_price": 100}, {"desc": "B", "qty": 1, "unit_price": 50}],
        }
        r = owner_session.post(f"{API}/estimates", json=payload)
        assert r.status_code == 200
        est = r.json()
        assert est["total"] == 250
        eid = est["id"]
        # update recomputes
        payload["line_items"].append({"desc": "C", "qty": 3, "unit_price": 10})
        r2 = owner_session.put(f"{API}/estimates/{eid}", json=payload)
        assert r2.status_code == 200
        assert r2.json()["total"] == 280
        # send
        rs = owner_session.post(f"{API}/estimates/{eid}/send")
        # Email may or may not succeed depending on env; accept 200 or 502
        assert rs.status_code in (200, 502), rs.text
        if rs.status_code == 200:
            g = owner_session.get(f"{API}/estimates").json()
            found = next((x for x in g if x["id"] == eid), None)
            assert found and found["status"] == "sent"
        # cleanup
        owner_session.delete(f"{API}/estimates/{eid}")

    def test_estimate_send_missing_email(self, owner_session):
        r = owner_session.post(f"{API}/estimates", json={"customer_name": "X", "line_items": []})
        eid = r.json()["id"]
        rs = owner_session.post(f"{API}/estimates/{eid}/send")
        assert rs.status_code == 400
        owner_session.delete(f"{API}/estimates/{eid}")


# ---------- Job cost ----------
class TestJobCost:
    def test_job_cost(self, owner_session):
        j = owner_session.post(f"{API}/jobs", json={"name": "TEST Cost Job", "material_cost": 500, "onsite_purchases": 100}).json()
        r = owner_session.get(f"{API}/jobs/{j['id']}/cost")
        assert r.status_code == 200
        d = r.json()
        assert d["material_cost"] == 500
        assert d["onsite_purchases"] == 100
        assert d["total"] == 600
        owner_session.delete(f"{API}/jobs/{j['id']}")


# ---------- Messages ----------
class TestMessages:
    def test_post_and_list(self, owner_session):
        r = owner_session.post(f"{API}/messages", json={"text": "TEST hello team"})
        assert r.status_code == 200
        lr = owner_session.get(f"{API}/messages")
        assert lr.status_code == 200
        assert any(m["text"] == "TEST hello team" for m in lr.json())


# ---------- Upload ----------
class TestUpload:
    def test_upload_and_get(self, owner_session):
        content = b"hello-test-bytes"
        files = {"file": ("test.txt", io.BytesIO(content), "text/plain")}
        r = owner_session.post(f"{API}/upload", files=files)
        # Storage may fail in preview env. Accept 200 or 5xx but log
        if r.status_code != 200:
            pytest.skip(f"Upload not available: {r.status_code} {r.text[:120]}")
        p = r.json()["path"]
        gr = owner_session.get(f"{API}/files/{p}")
        assert gr.status_code == 200


# ---------- Plans + checkout ----------
class TestPayments:
    def test_plans(self):
        r = requests.get(f"{API}/plans")
        assert r.status_code == 200
        d = r.json()
        for k in ("startup", "medium", "large"):
            assert k in d

    def test_checkout_owner_only(self, employee_session):
        r = employee_session["session"].post(f"{API}/payments/checkout", json={"plan": "startup", "origin_url": BASE_URL})
        assert r.status_code == 403

    def test_checkout_returns_url(self, owner_session):
        r = owner_session.post(f"{API}/payments/checkout", json={"plan": "startup", "origin_url": BASE_URL})
        if r.status_code != 200:
            pytest.skip(f"Stripe checkout unavailable: {r.status_code} {r.text[:200]}")
        assert "checkout_url" in r.json()
        assert r.json()["checkout_url"].startswith("http")
