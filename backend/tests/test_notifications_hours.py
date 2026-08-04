"""Tests for notifications, hours meter, and recent ticket updates on dashboard."""
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
    assert me.get("is_superadmin") is True
    return {"session": s, "me": me}


@pytest.fixture(scope="module")
def other_company(suffix):
    email = f"TEST_nother_owner_{suffix}@example.com"
    pw = "Pw123456!"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": pw, "name": "TEST NOther Owner",
        "company_name": f"TEST NOther Co {suffix}"})
    assert r.status_code == 200, r.text
    me = s.get(f"{API}/auth/me").json()
    return {"session": s, "email": email, "me": me}


# ---------- Dashboard fields ----------
class TestDashboardFields:
    def test_dashboard_has_hours_and_updates(self, owner):
        r = owner["session"].get(f"{API}/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ("data_hours_total", "data_hours_used", "data_hours_remaining",
                  "unread_notifications", "recent_ticket_updates"):
            assert k in d, f"missing {k}"
        # medium plan => 10 hours
        assert d["data_hours_total"] == 10
        # remaining is clamped >= 0
        assert d["data_hours_remaining"] >= 0
        # remaining == max(total - used, 0)
        assert d["data_hours_remaining"] == round(max(d["data_hours_total"] - d["data_hours_used"], 0), 1)
        assert isinstance(d["recent_ticket_updates"], list)
        assert len(d["recent_ticket_updates"]) <= 5

    def test_hours_used_increases_after_new_ticket(self, owner):
        d0 = owner["session"].get(f"{API}/dashboard").json()
        used0 = d0["data_hours_used"]
        r = owner["session"].post(f"{API}/data-entry-tickets", json={
            "title": "TEST hours ticket", "category": "General", "priority": "normal",
            "description": "", "hours_requested": 3})
        assert r.status_code == 200
        d1 = owner["session"].get(f"{API}/dashboard").json()
        assert round(d1["data_hours_used"] - used0, 1) == 3.0


# ---------- Notifications flow ----------
class TestNotifications:
    def test_admin_update_creates_notification(self, owner):
        # create a fresh ticket
        c = owner["session"].post(f"{API}/data-entry-tickets", json={
            "title": "TEST notif ticket", "category": "General", "priority": "normal",
            "description": "", "hours_requested": 0}).json()
        tid = c["id"]
        before = owner["session"].get(f"{API}/notifications").json()
        assert isinstance(before, list)
        n_before = len(before)
        r = owner["session"].put(f"{API}/admin/data-entry-tickets/{tid}", json={
            "status": "done", "admin_notes": "All complete now"})
        assert r.status_code == 200
        assert r.json()["status"] == "done"
        after = owner["session"].get(f"{API}/notifications").json()
        assert len(after) == n_before + 1
        latest = after[0]
        assert latest["ticket_id"] == tid
        assert "TEST notif ticket" in latest["message"]
        assert latest["read"] is False
        assert latest["company_id"] == owner["me"]["company_id"]
        # message references done + note added
        assert "done" in latest["message"] and "note" in latest["message"]

    def test_dashboard_recent_updates_contains_ticket(self, owner):
        # trigger an admin update, then check dashboard recent_ticket_updates
        c = owner["session"].post(f"{API}/data-entry-tickets", json={
            "title": "TEST recent update", "category": "General", "priority": "normal",
            "description": "", "hours_requested": 0}).json()
        tid = c["id"]
        owner["session"].put(f"{API}/admin/data-entry-tickets/{tid}", json={
            "status": "done", "admin_notes": "Note X"})
        d = owner["session"].get(f"{API}/dashboard").json()
        ids = [t["id"] for t in d["recent_ticket_updates"]]
        assert tid in ids
        found = next(t for t in d["recent_ticket_updates"] if t["id"] == tid)
        assert found["status"] == "done"
        assert found["admin_notes"] == "Note X"

    def test_no_notification_when_no_status_or_note_change(self, owner):
        c = owner["session"].post(f"{API}/data-entry-tickets", json={
            "title": "TEST nochange", "category": "General", "priority": "normal",
            "description": "", "hours_requested": 0}).json()
        tid = c["id"]
        # First set to in_progress
        owner["session"].put(f"{API}/admin/data-entry-tickets/{tid}", json={
            "status": "in_progress"})
        before = owner["session"].get(f"{API}/notifications").json()
        n_before = len(before)
        # Update with same status and no notes -> should NOT create notification
        r = owner["session"].put(f"{API}/admin/data-entry-tickets/{tid}", json={
            "status": "in_progress"})
        assert r.status_code == 200
        after = owner["session"].get(f"{API}/notifications").json()
        assert len(after) == n_before, "no-op update should not create a notification"

    def test_read_all_clears_unread(self, owner):
        # ensure at least one unread by triggering
        c = owner["session"].post(f"{API}/data-entry-tickets", json={
            "title": "TEST unread", "category": "General", "priority": "normal",
            "description": "", "hours_requested": 0}).json()
        owner["session"].put(f"{API}/admin/data-entry-tickets/{c['id']}", json={
            "status": "done"})
        d0 = owner["session"].get(f"{API}/dashboard").json()
        assert d0["unread_notifications"] >= 1
        r = owner["session"].post(f"{API}/notifications/read-all")
        assert r.status_code == 200
        d1 = owner["session"].get(f"{API}/dashboard").json()
        assert d1["unread_notifications"] == 0
        # all listed items are now read
        lst = owner["session"].get(f"{API}/notifications").json()
        assert all(n["read"] is True for n in lst)

    def test_mark_single_read(self, owner):
        c = owner["session"].post(f"{API}/data-entry-tickets", json={
            "title": "TEST single read", "category": "General", "priority": "normal",
            "description": "", "hours_requested": 0}).json()
        owner["session"].put(f"{API}/admin/data-entry-tickets/{c['id']}", json={
            "status": "done"})
        lst = owner["session"].get(f"{API}/notifications").json()
        nid = lst[0]["id"]
        assert lst[0]["read"] is False
        r = owner["session"].post(f"{API}/notifications/{nid}/read")
        assert r.status_code == 200
        lst2 = owner["session"].get(f"{API}/notifications").json()
        target = next(n for n in lst2 if n["id"] == nid)
        assert target["read"] is True

    def test_notification_company_scoping(self, owner, other_company):
        # trigger a notification in owner's company
        c = owner["session"].post(f"{API}/data-entry-tickets", json={
            "title": "TEST scope owner", "category": "General", "priority": "normal",
            "description": "", "hours_requested": 0}).json()
        owner["session"].put(f"{API}/admin/data-entry-tickets/{c['id']}", json={
            "status": "done", "admin_notes": "for owner co"})
        # other_company owner must not see any notif referencing this ticket
        other_list = other_company["session"].get(f"{API}/notifications").json()
        assert all(n.get("ticket_id") != c["id"] for n in other_list)
        # and their company_id on any returned notif matches their company
        for n in other_list:
            assert n["company_id"] == other_company["me"]["company_id"]


# ---------- Hours meter clamping ----------
class TestHoursClamp:
    def test_remaining_clamps_at_zero(self, owner):
        # push used above total by creating a big ticket
        r = owner["session"].post(f"{API}/data-entry-tickets", json={
            "title": "TEST clamp", "category": "General", "priority": "normal",
            "description": "", "hours_requested": 999})
        assert r.status_code == 200
        d = owner["session"].get(f"{API}/dashboard").json()
        assert d["data_hours_used"] >= d["data_hours_total"]
        assert d["data_hours_remaining"] == 0
