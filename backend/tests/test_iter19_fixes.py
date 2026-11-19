# Iteration 19: retest calendar-month schedule, job status normalization, deposit == schedule[0]
import os

import pytest
import requests
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = BASE_URL + "/api"
OWNER = {"email": "robinjones335@gmail.com", "password": os.environ.get("TEST_OWNER_PASSWORD", "BuildIt2026!")}
CREATED = {"jobs": [], "estimates": []}
PAST = (datetime.now(timezone.utc).date() - timedelta(days=10)).isoformat()


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    r = sess.post(f"{API}/auth/login", json=OWNER)
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    yield sess
    for c, ids in CREATED.items():
        for i in ids:
            sess.delete(f"{API}/{c}/{i}")


def _est(s, **kw):
    body = {"customer_name": "TEST_Sched", "customer_email": "test_sched@example.com",
            "line_items": [{"section": "General", "desc": "TEST work", "qty": 1, "unit_price": 900}],
            "deposit_percent": 25, "job_start_date": "2026-01-31", "num_payments": 3}
    body.update(kw)
    r = s.post(f"{API}/estimates", json=body)
    assert r.status_code == 200, r.text
    d = r.json(); CREATED["estimates"].append(d["id"])
    return d


# Fix 1: calendar months
class TestSchedule:
    def test_jan31_three_payments(self, s):
        d = _est(s)
        assert [p["due_date"] for p in d["payment_schedule"]] == ["2026-01-31", "2026-02-28", "2026-03-31"]
        assert [p["amount"] for p in d["payment_schedule"]] == [300, 300, 300]

    def test_year_rollover_and_leap(self, s):
        d = _est(s, job_start_date="2027-11-30", num_payments=4)
        assert [p["due_date"] for p in d["payment_schedule"]] == ["2027-11-30", "2027-12-30", "2028-01-30", "2028-02-29"]

    def test_put_recomputes(self, s):
        d = _est(s)
        u = s.put(f"{API}/estimates/{d['id']}", json={"customer_name": "TEST_Sched", "customer_email": "test_sched@example.com",
                  "line_items": d["line_items"], "job_start_date": "2026-03-31", "num_payments": 2})
        assert u.status_code == 200
        assert [p["due_date"] for p in u.json()["payment_schedule"]] == ["2026-03-31", "2026-04-30"]


# Fix 2: job status normalization
class TestJobs:
    @pytest.mark.parametrize("status", ["behind", "on_time", "late", "foo"])
    def test_status_normalized(self, s, status):
        before = s.get(f"{API}/dashboard").json()["jobs_behind"]
        r = s.post(f"{API}/jobs", json={"customer_name": f"TEST_{status}", "completion_date": PAST, "status": status})
        assert r.status_code == 200, r.text
        d = r.json(); CREATED["jobs"].append(d["id"])
        assert d["status"] == "late"
        assert s.get(f"{API}/jobs/{d['id']}").json()["status"] == "late"
        after = s.get(f"{API}/dashboard").json()["jobs_behind"]
        assert after == before + 1

    def test_completed_kept(self, s):
        before = s.get(f"{API}/dashboard").json()["jobs_behind"]
        r = s.post(f"{API}/jobs", json={"customer_name": "TEST_done", "completion_date": PAST, "status": "completed"})
        d = r.json(); CREATED["jobs"].append(d["id"])
        assert d["status"] == "completed"
        assert s.get(f"{API}/dashboard").json()["jobs_behind"] == before


# Fix 3: deposit == schedule[0]
class TestDeposit:
    def test_public_deposit_and_pdf(self, s):
        d = _est(s, line_items=[{"section": "A", "desc": "x", "qty": 1, "unit_price": 1000}])
        sched0 = d["payment_schedule"][0]["amount"]
        assert sched0 == 333.33  # differs from 25% (250)
        r = s.post(f"{API}/estimates/{d['id']}/send")
        assert r.status_code == 200, r.text
        token = r.json()["link"].rstrip("/").split("/")[-1]
        pub = requests.get(f"{API}/public/estimates/{token}").json()
        assert pub["deposit_amount"] == sched0 == pub["payment_schedule"][0]["amount"]
        pdf = s.get(f"{API}/estimates/{d['id']}/pdf")
        assert pdf.status_code == 200 and pdf.headers["content-type"].startswith("application/pdf")
        assert pdf.content[:4] == b"%PDF"
        ppdf = requests.get(f"{API}/public/estimates/{token}/pdf")
        assert ppdf.status_code == 200 and ppdf.content[:4] == b"%PDF"
        # approve + deposit checkout
        a = requests.post(f"{API}/public/estimates/{token}/approve", json={"signature_name": "TEST Signer"})
        assert a.status_code == 200 and a.json()["deposit_amount"] == sched0
        c = requests.post(f"{API}/public/estimates/{token}/deposit", json={"origin_url": BASE_URL})
        assert c.status_code == 200, c.text
        sid = c.json()["session_id"]
        assert sid and c.json()["checkout_url"]
        pytest.session_id_for_check = sid
        print("DEPOSIT_SESSION", sid)
