"""Regression: editing a job via generic PUT /jobs/{id} (as the Jobs edit form does) must not wipe its crew."""
import os
import uuid
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


def test_job_edit_preserves_crew():
    s = requests.Session()
    assert s.post(f"{API}/auth/login", json={"email": os.environ.get("TEST_OWNER_EMAIL", "robinjones335@gmail.com"),
                                             "password": os.environ["TEST_OWNER_PASSWORD"]}).status_code == 200
    sfx = uuid.uuid4().hex[:6]
    jid = s.post(f"{API}/jobs", json={"name": f"TEST_EditCrew {sfx}"}).json()["id"]
    vid = s.post(f"{API}/vehicles", json={"name": f"TEST_V {sfx}"}).json()["id"]
    try:
        s.put(f"{API}/jobs/{jid}/crew", json={"assigned_vehicles": [vid]})
        # Same payload shape as CrudManager (only JOB_FIELDS keys)
        payload = {"name": f"TEST_EditCrew2 {sfx}", "customer_name": "", "address": "", "status": "active",
                   "due_date": None, "material_cost": 0, "onsite_purchases": 0, "description": ""}
        assert s.put(f"{API}/jobs/{jid}", json=payload).status_code == 200
        job = s.get(f"{API}/jobs/{jid}").json()
        assert job["assigned_vehicles"] == [vid], f"crew wiped by job edit: {job['assigned_vehicles']}"
    finally:
        s.delete(f"{API}/jobs/{jid}")
        s.delete(f"{API}/vehicles/{vid}")
