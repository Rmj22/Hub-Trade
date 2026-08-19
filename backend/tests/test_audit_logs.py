"""Audit logs feature tests: logging, date filter (server-side), CSV export, RBAC."""
import os
import io
import csv
import uuid
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://trade-hub-910.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = "robinjones335@gmail.com"
OWNER_PASSWORD = "BuildIt2026!"


@pytest.fixture(scope="module")
def owner():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def foreman(owner):
    email = f"audit_foreman_{uuid.uuid4().hex[:6]}@jones.co"
    password = "Pass123!"
    r = owner.post(f"{API}/team", json={"name": "Audit Foreman", "email": email, "password": password, "role": "foreman"})
    assert r.status_code in (200, 201), r.text
    fs = requests.Session()
    r2 = fs.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r2.status_code == 200, r2.text
    return fs, email


# ---------- Audit logging via actions ----------
def test_login_creates_audit_entry(owner):
    # Login already happened in fixture; hit list endpoint
    r = owner.get(f"{API}/audit-logs")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    # Must have login entries
    assert any("log" in (i.get("action") or "").lower() for i in items), "expected a login audit entry"
    for i in items[:5]:
        assert "created_at" in i and "user_name" in i and "action" in i


def test_crud_job_creates_audit(owner):
    before = owner.get(f"{API}/audit-logs").json()
    before_count = len(before)
    # Create
    name = f"TEST_AUDIT_JOB_{uuid.uuid4().hex[:6]}"
    r = owner.post(f"{API}/jobs", json={"name": name, "address": "1 Test", "status": "active"})
    assert r.status_code in (200, 201), r.text
    job_id = r.json().get("id")
    assert job_id
    # Update
    ru = owner.put(f"{API}/jobs/{job_id}", json={"name": name + "_upd"})
    assert ru.status_code == 200, ru.text
    # Delete
    rd = owner.delete(f"{API}/jobs/{job_id}")
    assert rd.status_code in (200, 204), rd.text

    after = owner.get(f"{API}/audit-logs").json()
    actions = " | ".join(i.get("action", "") for i in after[:20])
    assert "Created" in actions
    assert "Updated" in actions
    assert "Deleted" in actions
    assert len(after) >= before_count + 3


# ---------- Server-side date filter ----------
def test_future_date_range_returns_empty(owner):
    r = owner.get(f"{API}/audit-logs", params={"start": "2099-01-01", "end": "2099-01-02"})
    assert r.status_code == 200
    assert r.json() == []


def test_date_range_filter_inclusive(owner):
    # today filter should include today's login
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    r = owner.get(f"{API}/audit-logs", params={"start": today, "end": today})
    assert r.status_code == 200
    items = r.json()
    assert len(items) > 0
    for i in items:
        assert i["created_at"][:10] == today


def test_past_date_only_returns_empty(owner):
    r = owner.get(f"{API}/audit-logs", params={"start": "1990-01-01", "end": "1990-01-02"})
    assert r.status_code == 200
    assert r.json() == []


# ---------- CSV export ----------
def test_csv_export_headers_and_format(owner):
    r = owner.get(f"{API}/audit-logs/export")
    assert r.status_code == 200
    ctype = r.headers.get("Content-Type", "")
    assert "text/csv" in ctype, ctype
    cdisp = r.headers.get("Content-Disposition", "")
    assert "attachment" in cdisp.lower()
    assert ".csv" in cdisp.lower()
    body = r.text
    first_line = body.splitlines()[0]
    assert first_line == "Timestamp,User,Action", repr(first_line)
    # Parse subsequent rows
    reader = csv.reader(io.StringIO(body))
    rows = list(reader)
    assert rows[0] == ["Timestamp", "User", "Action"]
    assert len(rows) >= 2  # header + at least one entry


def test_csv_export_future_range_only_header(owner):
    r = owner.get(f"{API}/audit-logs/export", params={"start": "2099-01-01", "end": "2099-01-02"})
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("Content-Type", "")
    rows = list(csv.reader(io.StringIO(r.text)))
    assert rows == [["Timestamp", "User", "Action"]], rows


def test_csv_export_row_count_matches_list(owner):
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    list_items = owner.get(f"{API}/audit-logs", params={"start": today, "end": today}).json()
    csv_resp = owner.get(f"{API}/audit-logs/export", params={"start": today, "end": today})
    rows = list(csv.reader(io.StringIO(csv_resp.text)))
    # header + n entries
    assert len(rows) - 1 == len(list_items), f"csv has {len(rows)-1} rows, list has {len(list_items)}"


# ---------- RBAC ----------
def test_foreman_forbidden_list(foreman):
    fs, _ = foreman
    r = fs.get(f"{API}/audit-logs")
    assert r.status_code == 403, r.text


def test_foreman_forbidden_export(foreman):
    fs, _ = foreman
    r = fs.get(f"{API}/audit-logs/export")
    assert r.status_code == 403, r.text


def test_unauthenticated_forbidden():
    r = requests.get(f"{API}/audit-logs")
    assert r.status_code in (401, 403)
    r2 = requests.get(f"{API}/audit-logs/export")
    assert r2.status_code in (401, 403)


# ---------- Additional loggable actions ----------
def test_team_member_add_change_remove_logged(owner):
    email = f"audit_temp_{uuid.uuid4().hex[:6]}@jones.co"
    r = owner.post(f"{API}/team", json={"name": "Audit Temp", "email": email, "password": "Pass123!", "role": "employee"})
    assert r.status_code in (200, 201)
    uid = r.json().get("id")
    ru = owner.put(f"{API}/team/{uid}/role", json={"role": "foreman"})
    assert ru.status_code == 200
    rd = owner.delete(f"{API}/team/{uid}")
    assert rd.status_code in (200, 204)
    logs = owner.get(f"{API}/audit-logs").json()
    joined = " | ".join(l.get("action", "") for l in logs[:15])
    assert "Added team member" in joined
    assert "Changed" in joined and "role" in joined
    assert "Removed team member" in joined
