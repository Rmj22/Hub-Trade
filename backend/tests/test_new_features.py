"""Tests for team role management, data-entry tickets and admin control."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://trade-hub-910.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = "robinjones335@gmail.com"
OWNER_PASSWORD = "BuildIt2026!"


@pytest.fixture(scope="module")
def suffix():
    return uuid.uuid4().hex[:8]


@pytest.fixture(scope="module")
def owner():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert r.status_code == 200, r.text
    me = s.get(f"{API}/auth/me").json()
    assert me.get("is_superadmin") is True, "seeded owner should be super-admin"
    return {"session": s, "me": me}


@pytest.fixture(scope="module")
def foreman(owner, suffix):
    email = f"TEST_fmn_{suffix}@example.com"
    pw = "FmnPass1!"
    r = owner["session"].post(f"{API}/team", json={
        "email": email, "password": pw, "name": "TEST Foreman", "role": "foreman"})
    assert r.status_code == 200, r.text
    u = r.json()
    s = requests.Session()
    lr = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert lr.status_code == 200
    return {"session": s, "user": u, "email": email, "password": pw}


@pytest.fixture(scope="module")
def employee(owner, suffix):
    email = f"TEST_emp_{suffix}@example.com"
    pw = "EmpPass1!"
    r = owner["session"].post(f"{API}/team", json={
        "email": email, "password": pw, "name": "TEST Employee", "role": "employee"})
    assert r.status_code == 200, r.text
    u = r.json()
    s = requests.Session()
    s.post(f"{API}/auth/login", json={"email": email, "password": pw})
    return {"session": s, "user": u}


@pytest.fixture(scope="module")
def other_company(suffix):
    email = f"TEST_other_owner_{suffix}@example.com"
    pw = "Pw123456!"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": pw, "name": "TEST Other Owner",
        "company_name": f"TEST Other Co {suffix}"})
    assert r.status_code == 200
    return {"session": s, "email": email}


# ---------- Role assignment ----------
class TestRoleAssignment:
    def test_add_member_employee_and_foreman(self, owner, suffix):
        for role in ("employee", "foreman"):
            email = f"TEST_add_{role}_{suffix}@example.com"
            r = owner["session"].post(f"{API}/team", json={
                "email": email, "password": "Pass123!", "name": f"TEST {role}", "role": role})
            assert r.status_code == 200, r.text
            assert r.json()["role"] == role

    def test_change_role(self, owner, foreman):
        uid = foreman["user"]["id"]
        r = owner["session"].put(f"{API}/team/{uid}/role", json={"role": "employee"})
        assert r.status_code == 200
        assert r.json()["role"] == "employee"
        # revert
        r2 = owner["session"].put(f"{API}/team/{uid}/role", json={"role": "foreman"})
        assert r2.status_code == 200

    def test_owner_cannot_demote_self_if_only_owner(self, other_company):
        # other_company owner is the sole owner of a fresh company
        me = other_company["session"].get(f"{API}/auth/me").json()
        uid = me["id"]
        r = other_company["session"].put(f"{API}/team/{uid}/role", json={"role": "foreman"})
        assert r.status_code == 400, r.text

    def test_owner_cannot_delete_self(self, owner):
        uid = owner["me"]["id"]
        r = owner["session"].delete(f"{API}/team/{uid}")
        assert r.status_code == 400

    def test_add_member_owner_role_accepted(self, owner, suffix):
        # Owner role option must be accepted by API, then cleanup
        email = f"TEST_add_owner_{suffix}@example.com"
        r = owner["session"].post(f"{API}/team", json={
            "email": email, "password": "Pass123!", "name": "TEST addOwner", "role": "owner"})
        assert r.status_code == 200
        assert r.json()["role"] == "owner"
        # cleanup: delete this extra owner so subsequent tests keep single-owner invariant
        owner["session"].delete(f"{API}/team/{r.json()['id']}")

    def test_non_owner_forbidden(self, foreman, employee, owner, suffix):
        # foreman POST /team -> 403
        r = foreman["session"].post(f"{API}/team", json={
            "email": f"TEST_x_{suffix}@x.com", "password": "P1!", "name": "X", "role": "employee"})
        assert r.status_code == 403
        # employee PUT role -> 403
        uid = owner["me"]["id"]
        r2 = employee["session"].put(f"{API}/team/{uid}/role", json={"role": "employee"})
        assert r2.status_code == 403
        # foreman DELETE -> 403
        r3 = foreman["session"].delete(f"{API}/team/{uid}")
        assert r3.status_code == 403

    def test_delete_member(self, owner, suffix):
        email = f"TEST_todel_{suffix}@x.com"
        c = owner["session"].post(f"{API}/team", json={
            "email": email, "password": "Pw12345!", "name": "Del", "role": "employee"})
        uid = c.json()["id"]
        d = owner["session"].delete(f"{API}/team/{uid}")
        assert d.status_code == 200


# ---------- Data-entry tickets ----------
class TestDataEntryTickets:
    def test_owner_creates_and_lists(self, owner):
        payload = {"title": "TEST Ticket A", "category": "Employees",
                   "priority": "high", "description": "Add 5 employees", "hours_requested": 2}
        r = owner["session"].post(f"{API}/data-entry-tickets", json=payload)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["status"] == "open"
        assert t["title"] == payload["title"]
        assert t["company_id"] == owner["me"]["company_id"]
        lst = owner["session"].get(f"{API}/data-entry-tickets").json()
        assert any(x["id"] == t["id"] for x in lst)

    def test_employee_can_create_ticket(self, employee):
        r = employee["session"].post(f"{API}/data-entry-tickets", json={
            "title": "TEST emp ticket", "category": "Jobs", "priority": "low",
            "description": "help", "hours_requested": 1})
        assert r.status_code == 200
        assert r.json()["status"] == "open"

    def test_scoping(self, owner, other_company):
        # create ticket in company2
        r2 = other_company["session"].post(f"{API}/data-entry-tickets", json={
            "title": "TEST co2 ticket", "category": "General", "priority": "normal",
            "description": "", "hours_requested": 0})
        assert r2.status_code == 200
        t2_id = r2.json()["id"]
        # owner1 list should not contain
        lst1 = owner["session"].get(f"{API}/data-entry-tickets").json()
        assert not any(x["id"] == t2_id for x in lst1)
        # owner2 list should contain
        lst2 = other_company["session"].get(f"{API}/data-entry-tickets").json()
        assert any(x["id"] == t2_id for x in lst2)


# ---------- Admin routes ----------
class TestAdmin:
    def test_admin_list_tickets(self, owner):
        r = owner["session"].get(f"{API}/admin/data-entry-tickets")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        sample = data[0]
        assert "company_name" in sample and "created_by" in sample

    def test_admin_sees_across_companies(self, owner, other_company):
        r = owner["session"].get(f"{API}/admin/data-entry-tickets").json()
        company_ids = {t.get("company_id") for t in r}
        # owner's own company + other_company should be present
        assert len(company_ids) >= 2

    def test_admin_update_ticket(self, owner):
        # create a ticket then update it
        c = owner["session"].post(f"{API}/data-entry-tickets", json={
            "title": "TEST update", "category": "General", "priority": "normal",
            "description": "", "hours_requested": 0}).json()
        tid = c["id"]
        r = owner["session"].put(f"{API}/admin/data-entry-tickets/{tid}", json={
            "status": "in_progress", "admin_notes": "Working on it"})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "in_progress"
        assert d["admin_notes"] == "Working on it"

    def test_admin_stats(self, owner):
        r = owner["session"].get(f"{API}/admin/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ("companies", "users", "tickets", "open_tickets"):
            assert k in d and isinstance(d[k], int)

    def test_non_superadmin_forbidden(self, other_company):
        # other_company owner is NOT super-admin
        for path in ("/admin/data-entry-tickets", "/admin/stats"):
            r = other_company["session"].get(f"{API}{path}")
            assert r.status_code == 403, f"{path} -> {r.status_code}"
        r = other_company["session"].put(f"{API}/admin/data-entry-tickets/xxx", json={"status": "done"})
        assert r.status_code == 403

    def test_foreman_forbidden_on_admin(self, foreman):
        r = foreman["session"].get(f"{API}/admin/data-entry-tickets")
        assert r.status_code == 403
        r2 = foreman["session"].get(f"{API}/admin/stats")
        assert r2.status_code == 403
