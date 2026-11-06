# Estimate approval + deposit feature tests (public token page, approve, deposit checkout, status preservation)
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
EMAIL = "robinjones335@gmail.com"
PASSWORD = os.environ.get("TEST_OWNER_PASSWORD")
EXISTING_TOKEN = "NtGUrbGFo0OSiqIW0EUCp7-R8zKYbUiR"


@pytest.fixture(scope="module")
def owner():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code}")
    return s


@pytest.fixture(scope="module")
def created(owner):
    ids = []
    yield ids
    for i in ids:
        owner.delete(f"{BASE_URL}/api/estimates/{i}")


def _make(owner, created, pct=30, email="delivered@resend.dev"):
    r = owner.post(f"{BASE_URL}/api/estimates", json={
        "customer_name": "TEST_Approval Cust", "customer_email": email,
        "line_items": [{"desc": "Framing", "qty": 2, "unit_price": 500}, {"desc": "Drywall", "qty": 1, "unit_price": 1000}],
        "notes": "TEST notes", "deposit_percent": pct})
    assert r.status_code == 200, r.text
    d = r.json()
    created.append(d["id"])
    assert d["total"] == 2000
    assert d["deposit_percent"] == pct
    return d


def _send(owner, eid):
    r = owner.post(f"{BASE_URL}/api/estimates/{eid}/send")
    assert r.status_code == 200, r.text
    link = r.json()["link"]
    assert "/estimate/" in link
    return link.rsplit("/", 1)[-1]


# Public API
class TestPublic:
    def test_unknown_token_404(self):
        r = requests.get(f"{BASE_URL}/api/public/estimates/does-not-exist-xyz")
        assert r.status_code == 404

    def test_existing_token(self):
        r = requests.get(f"{BASE_URL}/api/public/estimates/{EXISTING_TOKEN}")
        assert r.status_code == 200
        d = r.json()
        print(d)
        assert d["status"] == "approved"
        assert d["signature_name"]
        assert "company_id" not in d and "customer_email" not in d and "public_token" not in d

    def test_full_flow(self, owner, created):
        e = _make(owner, created)
        token = _send(owner, e["id"])
        lst = {x["id"]: x for x in owner.get(f"{BASE_URL}/api/estimates").json()}
        assert lst[e["id"]]["status"] == "sent"
        p = requests.get(f"{BASE_URL}/api/public/estimates/{token}").json()
        assert p["status"] == "sent" and p["total"] == 2000 and p["deposit_amount"] == 600
        assert len(p["line_items"]) == 2
        # deposit before approve
        r = requests.post(f"{BASE_URL}/api/public/estimates/{token}/deposit", json={"origin_url": BASE_URL})
        assert r.status_code == 400
        # short signature
        r = requests.post(f"{BASE_URL}/api/public/estimates/{token}/approve", json={"signature_name": "a"})
        assert r.status_code == 422
        # approve
        r = requests.post(f"{BASE_URL}/api/public/estimates/{token}/approve", json={"signature_name": "TEST Signer"})
        assert r.status_code == 200 and r.json()["status"] == "approved"
        assert r.json()["signature_name"] == "TEST Signer"
        # idempotent
        r2 = requests.post(f"{BASE_URL}/api/public/estimates/{token}/approve", json={"signature_name": "Other Person"})
        assert r2.status_code == 200 and r2.json()["signature_name"] == "TEST Signer"
        assert r2.json()["approved_at"] == r.json()["approved_at"]
        # deposit checkout
        r = requests.post(f"{BASE_URL}/api/public/estimates/{token}/deposit", json={"origin_url": BASE_URL})
        assert r.status_code == 200, r.text
        assert "checkout.stripe.com" in r.json()["checkout_url"]
        sid = r.json()["session_id"]
        st = requests.get(f"{BASE_URL}/api/payments/status/{sid}").json()
        assert st["payment_status"] != "paid" and st["kind"] == "deposit"
        # owner edits approved estimate -> status stays approved
        r = owner.put(f"{BASE_URL}/api/estimates/{e['id']}", json={
            "customer_name": "TEST_Approval Cust", "customer_email": "delivered@resend.dev",
            "line_items": [{"desc": "Framing", "qty": 2, "unit_price": 500}, {"desc": "Drywall", "qty": 1, "unit_price": 1000}],
            "notes": "edited", "deposit_percent": 30, "status": "draft"})
        assert r.status_code == 200
        assert r.json()["status"] == "approved"
        assert r.json()["signature_name"] == "TEST Signer"
        assert r.json()["public_token"] == token
        # resend after approval -> what happens to status?
        r = owner.post(f"{BASE_URL}/api/estimates/{e['id']}/send")
        p = requests.get(f"{BASE_URL}/api/public/estimates/{token}").json()
        print("status after resend of approved estimate:", p["status"])
        assert p["status"] == "approved", "Re-sending an approved estimate resets status to 'sent'"

    def test_zero_deposit(self, owner, created):
        e = _make(owner, created, pct=0)
        token = _send(owner, e["id"])
        requests.post(f"{BASE_URL}/api/public/estimates/{token}/approve", json={"signature_name": "TEST Zero"})
        r = requests.post(f"{BASE_URL}/api/public/estimates/{token}/deposit", json={"origin_url": BASE_URL})
        assert r.status_code == 400

    def test_payment_status_unknown(self):
        r = requests.get(f"{BASE_URL}/api/payments/status/cs_test_nope")
        assert r.status_code == 404

    def test_send_without_email(self, owner, created):
        e = _make(owner, created, email="")
        r = owner.post(f"{BASE_URL}/api/estimates/{e['id']}/send")
        assert r.status_code == 400

    def test_notifications_has_approved(self, owner):
        r = owner.get(f"{BASE_URL}/api/notifications")
        assert r.status_code == 200
        msgs = [n.get("message", "") for n in (r.json() if isinstance(r.json(), list) else r.json().get("items", []))]
        assert any("approved estimate" in m for m in msgs)
