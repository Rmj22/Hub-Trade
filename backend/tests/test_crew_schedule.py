"""Tests for job crew assignment and daily schedule (iteration 9)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
OWNER_EMAIL = os.environ.get("TEST_OWNER_EMAIL", "robinjones335@gmail.com")
OWNER_PASSWORD = os.environ["TEST_OWNER_PASSWORD"]
SFX = uuid.uuid4().hex[:8]
DATE = "2031-03-1" + str(uuid.uuid4().int % 9)


@pytest.fixture(scope="module")
def owner():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def created(owner):
    store = {"jobs": [], "employees": [], "vehicles": [], "equipment": [], "schedule": [], "team": []}
    yield store
    for sid in store["schedule"]:
        owner.delete(f"{API}/schedule/{sid}")
    for coll in ("jobs", "employees", "vehicles", "equipment"):
        for i in store[coll]:
            owner.delete(f"{API}/{coll}/{i}")
    for uid in store["team"]:
        owner.delete(f"{API}/team/{uid}")


@pytest.fixture(scope="module")
def res(owner, created):
    j = owner.post(f"{API}/jobs", json={"name": f"TEST_Crew Job {SFX}"})
    assert j.status_code == 200, j.text
    created["jobs"].append(j.json()["id"])
    e = owner.post(f"{API}/employees", json={"name": f"TEST_Emp {SFX}"})
    assert e.status_code == 200, e.text
    created["employees"].append(e.json()["id"])
    v = owner.post(f"{API}/vehicles", json={"name": f"TEST_Veh {SFX}"})
    assert v.status_code == 200, v.text
    created["vehicles"].append(v.json()["id"])
    q = owner.post(f"{API}/equipment", json={"name": f"TEST_Eq {SFX}"})
    assert q.status_code == 200, q.text
    created["equipment"].append(q.json()["id"])
    return {"job": j.json()["id"], "emp": e.json()["id"], "veh": v.json()["id"], "eq": q.json()["id"]}


@pytest.fixture(scope="module")
def other_company_ids():
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={"email": f"TEST_xco_{SFX}@example.com", "password": "Pw123456!",
                                             "name": "TEST X", "company_name": f"TEST XCo {SFX}"})
    assert r.status_code == 200, r.text
    e = s.post(f"{API}/employees", json={"name": "TEST_Foreign emp"})
    j = s.post(f"{API}/jobs", json={"name": "TEST_Foreign job"})
    return {"emp": e.json().get("id"), "job": j.json().get("id")}


@pytest.fixture(scope="module")
def employee(owner, created):
    email = f"TEST_cs_emp_{SFX}@example.com"
    r = owner.post(f"{API}/team", json={"email": email, "password": "EmpPass1!", "name": "TEST CS Emp", "role": "employee"})
    assert r.status_code == 200, r.text
    created["team"].append(r.json()["id"])
    s = requests.Session()
    assert s.post(f"{API}/auth/login", json={"email": email, "password": "EmpPass1!"}).status_code == 200
    return s


# ---------- Crew assignment ----------
class TestCrew:
    def test_assign_crew_filters_invalid_and_foreign(self, owner, res, other_company_ids):
        payload = {"assigned_employees": [res["emp"], "notanid", other_company_ids["emp"], "0" * 24],
                   "assigned_vehicles": [res["veh"]], "assigned_equipment": [res["eq"], "bad"]}
        r = owner.put(f"{API}/jobs/{res['job']}/crew", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["assigned_employees"] == [res["emp"]]
        assert d["assigned_vehicles"] == [res["veh"]]
        assert d["assigned_equipment"] == [res["eq"]]
        g = owner.get(f"{API}/jobs/{res['job']}").json()
        assert g["assigned_employees"] == [res["emp"]]

    def test_assignment_notification_created(self, owner, res):
        r = owner.get(f"{API}/notifications")
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("items", data.get("notifications", []))
        assert any(n.get("type") == "assignment" and n.get("job_id") == res["job"] for n in items), str(data)[:400]

    def test_crew_unassign(self, owner, res):
        r = owner.put(f"{API}/jobs/{res['job']}/crew", json={"assigned_employees": [], "assigned_vehicles": [], "assigned_equipment": []})
        assert r.status_code == 200
        assert r.json()["assigned_employees"] == []
        # re-assign for later tests
        owner.put(f"{API}/jobs/{res['job']}/crew", json={"assigned_employees": [res["emp"]], "assigned_vehicles": [res["veh"]], "assigned_equipment": [res["eq"]]})

    def test_crew_foreign_job_404(self, owner, other_company_ids):
        r = owner.put(f"{API}/jobs/{other_company_ids['job']}/crew", json={})
        assert r.status_code == 404

    def test_crew_invalid_job_id(self, owner):
        r = owner.put(f"{API}/jobs/notanid/crew", json={})
        assert r.status_code in (400, 404, 422), f"got {r.status_code}"

    def test_employee_forbidden_crew(self, employee, res):
        r = employee.put(f"{API}/jobs/{res['job']}/crew", json={})
        assert r.status_code == 403


# ---------- Schedule ----------
class TestSchedule:
    def test_upsert_and_list(self, owner, res, created, other_company_ids):
        body = {"date": DATE, "job_id": res["job"], "employee_ids": [res["emp"], other_company_ids["emp"], "x"],
                "vehicle_ids": [res["veh"]], "equipment_ids": [res["eq"]], "notes": "TEST_first"}
        r = owner.put(f"{API}/schedule", json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        created["schedule"].append(d["id"])
        assert d["employee_ids"] == [res["emp"]]
        assert d["notes"] == "TEST_first"
        lst = owner.get(f"{API}/schedule", params={"start": DATE, "end": DATE}).json()
        mine = [x for x in lst if x["job_id"] == res["job"]]
        assert len(mine) == 1 and "_id" not in mine[0]

    def test_upsert_same_date_job_is_single(self, owner, res):
        r = owner.put(f"{API}/schedule", json={"date": DATE, "job_id": res["job"], "notes": "TEST_second"})
        assert r.status_code == 200
        lst = owner.get(f"{API}/schedule", params={"start": DATE, "end": DATE}).json()
        mine = [x for x in lst if x["job_id"] == res["job"]]
        assert len(mine) == 1
        assert mine[0]["notes"] == "TEST_second"

    def test_list_range_excludes(self, owner, res):
        lst = owner.get(f"{API}/schedule", params={"start": "2031-04-01", "end": "2031-04-30"}).json()
        assert all(x["job_id"] != res["job"] for x in lst)

    def test_list_requires_params(self, owner):
        assert owner.get(f"{API}/schedule").status_code == 422

    def test_foreign_job_schedule_404(self, owner, other_company_ids):
        r = owner.put(f"{API}/schedule", json={"date": DATE, "job_id": other_company_ids["job"]})
        assert r.status_code == 404

    def test_schedule_invalid_job_id(self, owner):
        r = owner.put(f"{API}/schedule", json={"date": DATE, "job_id": "bad"})
        assert r.status_code in (400, 404, 422), f"got {r.status_code}"

    def test_schedule_invalid_date(self, owner, res):
        r = owner.put(f"{API}/schedule", json={"date": "not-a-date", "job_id": res["job"]})
        if r.status_code == 200:
            owner.delete(f"{API}/schedule/{r.json()['id']}")
        assert r.status_code in (400, 422), f"invalid date accepted: {r.status_code}"

    def test_employee_forbidden_schedule(self, employee, res):
        assert employee.put(f"{API}/schedule", json={"date": DATE, "job_id": res["job"]}).status_code == 403
        assert employee.get(f"{API}/schedule", params={"start": DATE, "end": DATE}).status_code == 200

    def test_delete_and_verify(self, owner, res, employee):
        lst = owner.get(f"{API}/schedule", params={"start": DATE, "end": DATE}).json()
        sid = [x for x in lst if x["job_id"] == res["job"]][0]["id"]
        assert employee.delete(f"{API}/schedule/{sid}").status_code == 403
        r = owner.delete(f"{API}/schedule/{sid}")
        assert r.status_code == 200
        lst = owner.get(f"{API}/schedule", params={"start": DATE, "end": DATE}).json()
        assert all(x["job_id"] != res["job"] for x in lst)
        assert owner.delete(f"{API}/schedule/{sid}").status_code == 404

    def test_delete_invalid_id(self, owner):
        r = owner.delete(f"{API}/schedule/bad")
        assert r.status_code in (400, 404, 422), f"got {r.status_code}"


# ---------- Jobs CRUD regression ----------
class TestJobsRegression:
    def test_jobs_crud(self, owner):
        r = owner.post(f"{API}/jobs", json={"name": f"TEST_Reg {SFX}"})
        assert r.status_code == 200
        jid = r.json()["id"]
        u = owner.put(f"{API}/jobs/{jid}", json={"name": f"TEST_Reg2 {SFX}"})
        assert u.status_code == 200 and u.json()["name"] == f"TEST_Reg2 {SFX}"
        assert owner.delete(f"{API}/jobs/{jid}").status_code == 200
        assert owner.get(f"{API}/jobs/{jid}").status_code == 404
