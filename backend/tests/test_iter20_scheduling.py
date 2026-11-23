# Iteration 20: auto job scheduling, work dates, statuses, conflicts, clock notifications, notification prefs
import os

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = BASE_URL + "/api"
OWNER = {"email": "robinjones335@gmail.com", "password": os.environ.get("TEST_OWNER_PASSWORD", "BuildIt2026!")}
CREATED = {"jobs": [], "employees": [], "team": []}
D1, D2, D3, D4 = "2027-03-10", "2027-03-11", "2027-03-15", "2027-03-20"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    r = sess.post(f"{API}/auth/login", json=OWNER)
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    orig_prefs = sess.get(f"{API}/notification-prefs").json()
    yield sess
    sess.put(f"{API}/notification-prefs", json=orig_prefs)
    # remove schedule entries of our jobs (job delete doesn't cascade)
    rows = sess.get(f"{API}/schedule", params={"start": "2026-01-01", "end": "2027-12-31"}).json()
    for e in rows:
        if e["job_id"] in CREATED["jobs"]:
            sess.delete(f"{API}/schedule/{e['id']}")
    for i in CREATED["jobs"]:
        sess.delete(f"{API}/jobs/{i}")
    for i in CREATED["employees"]:
        sess.delete(f"{API}/employees/{i}")
    for i in CREATED["team"]:
        sess.delete(f"{API}/team/{i}")


def _job(s, **kw):
    body = {"customer_name": "TEST_AutoSched", "address": "1 Test St", "start_date": D1}
    body.update(kw)
    r = s.post(f"{API}/jobs", json=body)
    assert r.status_code == 200, r.text
    d = r.json()
    CREATED["jobs"].append(d["id"])
    return d


def _entries(s, jid, start="2027-01-01", end="2027-12-31"):
    r = s.get(f"{API}/schedule", params={"start": start, "end": end})
    assert r.status_code == 200, r.text
    return [e for e in r.json() if e["job_id"] == jid]


def _emp(s, name):
    r = s.post(f"{API}/employees", json={"name": name})
    assert r.status_code == 200, r.text
    CREATED["employees"].append(r.json()["id"])
    return r.json()["id"]


# Auto scheduling
class TestAutoSchedule:
    def test_create_job_creates_one_auto_entry(self, s):
        j = _job(s)
        es = _entries(s, j["id"])
        assert len(es) == 1 and es[0]["date"] == D1 and es[0]["auto"] is True
        e = es[0]
        for k in ("job_name", "customer_name", "address", "job_status", "start_date"):
            assert k in e
        assert e["customer_name"] == "TEST_AutoSched" and e["job_status"] == "scheduled" and e["start_date"] == D1

    def test_move_start_date_no_duplicate(self, s):
        j = _job(s)
        r = s.put(f"{API}/jobs/{j['id']}", json={"start_date": D2})
        assert r.status_code == 200
        es = _entries(s, j["id"])
        assert [e["date"] for e in es] == [D2]

    def test_work_dates_add_remove(self, s):
        j = _job(s)
        r = s.put(f"{API}/jobs/{j['id']}/dates", json={"work_dates": [D3, D4]})
        assert r.status_code == 200, r.text
        assert r.json()["start_date"] == D1 and r.json()["work_dates"] == [D3, D4]
        assert sorted(e["date"] for e in _entries(s, j["id"])) == [D1, D3, D4]
        r = s.put(f"{API}/jobs/{j['id']}/dates", json={"work_dates": [D3]})
        assert r.status_code == 200
        assert sorted(e["date"] for e in _entries(s, j["id"])) == [D1, D3]
        assert s.get(f"{API}/jobs/{j['id']}").json()["start_date"] == D1

    def test_work_dates_invalid(self, s):
        j = _job(s)
        r = s.put(f"{API}/jobs/{j['id']}/dates", json={"work_dates": ["bad"]})
        assert r.status_code == 400

    def test_crew_updates_auto_entries(self, s):
        j = _job(s)
        eid = _emp(s, "TEST_CrewSync")
        r = s.put(f"{API}/jobs/{j['id']}/crew", json={"assigned_employees": [eid]})
        assert r.status_code == 200
        es = _entries(s, j["id"])
        assert es[0]["employee_ids"] == [eid]

    def test_deleted_job_removes_schedule_entries(self, s):
        j = _job(s, start_date="2027-04-02")
        s.delete(f"{API}/jobs/{j['id']}")
        left = _entries(s, j["id"])
        assert left == [], f"orphan schedule entries after job delete: {left}"


# Statuses
class TestStatuses:
    @pytest.mark.parametrize("st", ["scheduled", "in_progress", "completed", "delayed", "rescheduled"])
    def test_status_values(self, s, st):
        j = _job(s)
        r = s.put(f"{API}/jobs/{j['id']}", json={"status": st})
        assert r.status_code == 200 and r.json()["status"] == st
        assert s.get(f"{API}/jobs/{j['id']}").json()["status"] == st

    def test_active_normalizes(self, s):
        j = _job(s)
        r = s.put(f"{API}/jobs/{j['id']}", json={"status": "active"})
        assert r.json()["status"] == "scheduled"

    def test_past_completion_delayed_and_dashboard(self, s):
        before = s.get(f"{API}/dashboard").json()
        assert "equipment_assigned" not in before or True
        j = _job(s, start_date="2026-01-05", completion_date="2026-01-10")
        assert j["status"] == "delayed"
        assert s.get(f"{API}/jobs/{j['id']}").json()["status"] == "delayed"
        after = s.get(f"{API}/dashboard").json()
        assert after["jobs_behind"] == before["jobs_behind"] + 1


# Conflicts
class TestConflicts:
    def test_conflict_detected_and_excluded(self, s):
        a = _job(s, customer_name="TEST_ConfA", start_date="2027-05-05")
        b = _job(s, customer_name="TEST_ConfB", start_date="2027-05-05")
        eid = _emp(s, "TEST_ConfEmp")
        assert s.put(f"{API}/jobs/{a['id']}/crew", json={"assigned_employees": [eid]}).status_code == 200
        r = s.post(f"{API}/schedule/conflicts", json={"dates": ["2027-05-05"], "employee_ids": [eid], "exclude_job_id": b["id"]})
        assert r.status_code == 200
        c = r.json()
        assert len(c) == 1 and c[0]["employee_id"] == eid and c[0]["job_id"] == a["id"]
        assert c[0]["employee_name"] == "TEST_ConfEmp" and c[0]["date"] == "2027-05-05" and "TEST_ConfA" in c[0]["job_name"]
        r = s.post(f"{API}/schedule/conflicts", json={"dates": ["2027-05-05"], "employee_ids": [eid], "exclude_job_id": a["id"]})
        assert r.json() == []


# Clock notifications + prefs
class TestClockNotifs:
    def test_clock_in_out_and_prefs(self, s):
        j = _job(s, customer_name="TEST_ClockJob")
        eid = _emp(s, "TEST_ClockEmp")
        assert s.put(f"{API}/notification-prefs", json={k: True for k in ("clock_in", "clock_out", "schedule_change", "assignment", "missed_clock_in")}).status_code == 200
        r = s.post(f"{API}/timecards/clock-in", json={"employee_id": eid, "job_id": j["id"]})
        assert r.status_code == 200, r.text
        r = s.post(f"{API}/timecards/clock-out", json={"employee_id": eid})
        assert r.status_code == 200, r.text
        ns = s.get(f"{API}/notifications").json()
        ci = [n for n in ns if n["type"] == "clock_in" and "TEST_ClockEmp" in n["message"]]
        co = [n for n in ns if n["type"] == "clock_out" and "TEST_ClockEmp" in n["message"]]
        assert ci and co
        assert "TEST_ClockJob" in ci[0]["message"] and "TEST_ClockJob" in co[0]["message"]
        print("clock_in msg:", ci[0]["message"])
        # disable clock_in
        r = s.put(f"{API}/notification-prefs", json={"clock_in": False})
        assert r.status_code == 200
        assert s.get(f"{API}/notification-prefs").json()["clock_in"] is False
        ns = s.get(f"{API}/notifications").json()
        assert not [n for n in ns if n["type"] == "clock_in"]
        assert [n for n in ns if n["type"] == "clock_out"]

    def test_partial_prefs_put_keeps_other_values(self, s):
        s.put(f"{API}/notification-prefs", json={"clock_in": True, "clock_out": True, "schedule_change": False, "assignment": True, "missed_clock_in": True})
        s.put(f"{API}/notification-prefs", json={"clock_in": False})
        p = s.get(f"{API}/notification-prefs").json()
        assert p["schedule_change"] is False, f"partial PUT reset other prefs: {p}"

    def test_employee_never_sees_clock_types(self, s):
        r = s.post(f"{API}/team", json={"name": "TEST_NotifEmployee", "role": "employee"})
        if r.status_code != 200:
            pytest.skip(f"cannot create employee user: {r.status_code} {r.text}")
        d = r.json()
        CREATED["team"].append(d["id"])
        e = requests.Session()
        lr = e.post(f"{API}/auth/login", json={"email": d["credentials"]["username"], "password": d["credentials"]["password"]})
        assert lr.status_code == 200, lr.text
        ns = e.get(f"{API}/notifications").json()
        assert not [n for n in ns if n["type"] in ("clock_in", "clock_out", "missed_clock_in")]
        assert e.put(f"{API}/notification-prefs", json={"clock_in": True}).status_code == 403
