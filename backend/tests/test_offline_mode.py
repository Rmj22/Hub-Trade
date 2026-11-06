"""Offline mode v1: timecard `at` timestamps, job photos endpoint."""
import os
import base64
from datetime import datetime, timezone, timedelta
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
OWNER_EMAIL = os.environ.get("TEST_OWNER_EMAIL", "robinjones335@gmail.com")
OWNER_PASSWORD = os.environ["TEST_OWNER_PASSWORD"]

PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    r = sess.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert r.status_code == 200, r.text
    return sess


@pytest.fixture(scope="module")
def temp_employee(s):
    r = s.post(f"{API}/employees", json={"name": "TEST_Offline Emp", "role_title": "Laborer"})
    assert r.status_code in (200, 201), r.text
    emp = r.json()
    yield emp
    s.delete(f"{API}/employees/{emp['id']}")


@pytest.fixture(scope="module")
def temp_job(s):
    r = s.post(f"{API}/jobs", json={"name": "TEST_Offline Job", "status": "active"})
    assert r.status_code in (200, 201), r.text
    job = r.json()
    yield job
    s.delete(f"{API}/jobs/{job['id']}")


def _iso(dt):
    return dt.isoformat().replace("+00:00", "Z")


# Timecards with offline `at`
class TestTimecardAt:
    def test_clock_in_out_with_at_gives_hours(self, s, temp_employee):
        now = datetime.now(timezone.utc)
        ci = now - timedelta(hours=3)
        r = s.post(f"{API}/timecards/clock-in", json={"employee_id": temp_employee["id"], "at": _iso(ci)})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["offline_synced"] is True
        assert abs((datetime.fromisoformat(d["clock_in"]) - ci).total_seconds()) < 2
        act = s.get(f"{API}/timecards/active").json()
        assert any(a["employee_id"] == temp_employee["id"] for a in act)
        r = s.post(f"{API}/timecards/clock-out", json={"employee_id": temp_employee["id"], "at": _iso(now - timedelta(hours=1))})
        assert r.status_code == 200, r.text
        assert r.json()["hours"] == 2.0

    def test_future_at_clamped(self, s, temp_employee):
        fut = datetime.now(timezone.utc) + timedelta(days=2)
        r = s.post(f"{API}/timecards/clock-in", json={"employee_id": temp_employee["id"], "at": _iso(fut)})
        assert r.status_code == 200, r.text
        ci = datetime.fromisoformat(r.json()["clock_in"])
        assert ci <= datetime.now(timezone.utc) + timedelta(seconds=5)
        r = s.post(f"{API}/timecards/clock-out", json={"employee_id": temp_employee["id"]})
        assert r.status_code == 200
        assert r.json()["hours"] >= 0

    def test_online_clock_in_not_offline_synced(self, s, temp_employee):
        r = s.post(f"{API}/timecards/clock-in", json={"employee_id": temp_employee["id"]})
        assert r.status_code == 200
        assert r.json()["offline_synced"] is False
        r2 = s.post(f"{API}/timecards/clock-in", json={"employee_id": temp_employee["id"]})
        assert r2.status_code == 400
        s.post(f"{API}/timecards/clock-out", json={"employee_id": temp_employee["id"]})

    def test_invalid_at_falls_back_to_now(self, s, temp_employee):
        r = s.post(f"{API}/timecards/clock-in", json={"employee_id": temp_employee["id"], "at": "garbage"})
        assert r.status_code == 200, r.text
        s.post(f"{API}/timecards/clock-out", json={"employee_id": temp_employee["id"]})

    def test_clock_out_before_clock_in_zero_hours(self, s, temp_employee):
        now = datetime.now(timezone.utc)
        s.post(f"{API}/timecards/clock-in", json={"employee_id": temp_employee["id"], "at": _iso(now - timedelta(hours=1))})
        r = s.post(f"{API}/timecards/clock-out", json={"employee_id": temp_employee["id"], "at": _iso(now - timedelta(hours=5))})
        assert r.status_code == 200
        assert r.json()["hours"] == 0.0


# Job photos
class TestJobPhotos:
    def test_photos_requires_auth(self, temp_job):
        r = requests.post(f"{API}/jobs/{temp_job['id']}/photos", json={"path": "x", "caption": "c"})
        assert r.status_code == 401

    def test_photos_bad_id_404(self, s):
        r = s.post(f"{API}/jobs/000000000000000000000000/photos", json={"path": "x"})
        assert r.status_code == 404
        r = s.post(f"{API}/jobs/not-an-id/photos", json={"path": "x"})
        assert r.status_code in (400, 404)

    def test_upload_and_add_photo_persists(self, s, temp_job):
        up = s.post(f"{API}/upload", files={"file": ("t.png", PNG, "image/png")})
        assert up.status_code == 200, up.text
        path = up.json()["path"]
        r = s.post(f"{API}/jobs/{temp_job['id']}/photos", json={"path": path, "caption": "TEST_cap", "taken_at": "2026-01-01T00:00:00Z"})
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["caption"] == "TEST_cap" and p["taken_at"] == "2026-01-01T00:00:00Z" and p["id"]
        job = s.get(f"{API}/jobs/{temp_job['id']}").json()
        assert any(ph["caption"] == "TEST_cap" for ph in job.get("photos", []))
        f = s.get(f"{API}/files/{path}")
        assert f.status_code == 200

    def test_files_endpoint_is_unauthenticated(self, s, temp_job):
        """Security probe: file download without any auth."""
        up = s.post(f"{API}/upload", files={"file": ("t.png", PNG, "image/png")})
        path = up.json()["path"]
        r = requests.get(f"{API}/files/{path}")
        print("unauth file download status:", r.status_code)
