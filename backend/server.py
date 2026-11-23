from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import csv
import uuid
import logging
import asyncio
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated

import bcrypt
import jwt
import stripe
import httpx
import re
import hmac
import base64
import ipaddress
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Header, Query, BackgroundTasks
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import Response as StarletteResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, BeforeValidator, ConfigDict
from bson import ObjectId
from estimate_pdf import build_estimate_pdf

# ---------- DB ----------
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fieldforge")

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Hub Trade")

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "fieldforge"
storage_key = None

TRIAL_DAYS = int(os.environ.get("TRIAL_DAYS", "15"))
TRIAL_PLAN = "medium"
ARCHIVE_GRACE_DAYS = int(os.environ.get("ARCHIVE_GRACE_DAYS", "5"))

PLAN_LIMITS = {
    "startup": {"name": "Startup", "monthly": 60, "lookup_key": "startup_6mo", "employees": 20, "vehicles": 3, "jobs": 10, "equipment": 30, "data_hours": 5},
    "medium": {"name": "Medium", "monthly": 89, "lookup_key": "medium_6mo", "employees": 50, "vehicles": 10, "jobs": 30, "equipment": 60, "data_hours": 10},
    "large": {"name": "Large", "monthly": 149, "lookup_key": "large_6mo", "employees": 100, "vehicles": 20, "jobs": 50, "equipment": 120, "data_hours": 20},
}


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------- helpers ----------
PyObjectId = Annotated[str, BeforeValidator(str)]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def clean(doc):
    if not doc:
        return doc
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    doc.pop("password_hash", None)
    return doc


async def create_notification(company_id: str, message: str, ticket_id: str = None):
    await db.notifications.insert_one({
        "company_id": company_id, "message": message, "ticket_id": ticket_id,
        "type": "data_entry", "read": False, "created_at": now_iso(),
    })


async def log_audit(company_id: str, user: dict, action: str):
    await db.audit_logs.insert_one({
        "company_id": company_id,
        "user_id": str(user["_id"]) if user and user.get("_id") else None,
        "user_name": (user.get("name") if user else None) or "System",
        "action": action,
        "created_at": now_iso(),
    })


app = FastAPI()
api = APIRouter(prefix="/api")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def _expire_trial(comp: dict) -> dict:
    now = datetime.now(timezone.utc)
    status = comp.get("membership_status")
    if status == "trial":
        ends = comp.get("trial_ends_at")
        if ends and datetime.fromisoformat(ends) > now:
            comp["trial_days_left"] = max(1, (datetime.fromisoformat(ends) - now).days + 1)
            return comp
        upd = {"membership_status": "archived", "plan": None, "archived_at": now_iso()}
        await db.companies.update_one({"_id": comp["_id"]}, {"$set": upd})
        comp = {**comp, **upd}
    if comp.get("membership_status") == "archived" and comp.get("archived_at"):
        purge_at = datetime.fromisoformat(comp["archived_at"]) + timedelta(days=ARCHIVE_GRACE_DAYS)
        comp["days_until_removal"] = max(0, (purge_at - now).days + 1)
    return comp


ARCHIVE_ALLOWED_PREFIXES = ("/api/auth/", "/api/membership", "/api/payments/", "/api/stripe/")


async def require_not_archived(request: Request, user: dict = Depends(get_current_user)) -> dict:
    if request.url.path.startswith(ARCHIVE_ALLOWED_PREFIXES) or user.get("is_superadmin"):
        return user
    comp = await db.companies.find_one({"_id": ObjectId(user["company_id"])}, {"membership_status": 1, "trial_ends_at": 1, "archived_at": 1})
    if comp:
        comp = await _expire_trial(comp)
        if comp.get("membership_status") == "archived":
            raise HTTPException(402, "Your free trial has ended and this account is archived. Choose a plan to reactivate it.")
    return user


def require_role(*roles):
    async def dep(user: dict = Depends(require_not_archived)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return dep


async def require_superadmin(user: dict = Depends(require_not_archived)):
    if not user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Admin access only")
    return user


def set_cookies(response: Response, token: str):
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="lax", max_age=604800, path="/")


LOGIN_MAX_ATTEMPTS = 10
LOGIN_WINDOW = timedelta(minutes=15)
_login_attempts: dict = {}


def _check_login_rate(key: str):
    now = datetime.now(timezone.utc)
    attempts = [t for t in _login_attempts.get(key, []) if now - t < LOGIN_WINDOW]
    _login_attempts[key] = attempts
    if len(attempts) >= LOGIN_MAX_ATTEMPTS:
        raise HTTPException(429, "Too many login attempts. Try again in 15 minutes.")


# ---------- Auth models ----------
class RegisterReq(BaseModel):
    email: EmailStr
    password: str
    name: str
    company_name: str
    phone: str = ""
    address: str = ""


class LoginReq(BaseModel):
    email: str
    password: str


# ---------- Auth endpoints ----------
ADMIN_CONTROL_WEBHOOK_URL = os.environ.get("ADMIN_CONTROL_WEBHOOK_URL", "")
ADMIN_CONTROL_WEBHOOK_SECRET = os.environ.get("ADMIN_CONTROL_WEBHOOK_SECRET", "")


def client_record(u: dict, comp: dict, member_count: int, tickets: Optional[dict] = None) -> dict:
    t = tickets or {"ticket_count": 0, "open_tickets": 0, "last_ticket_at": None}
    return {
        "client_id": str(u["_id"]), "name": u.get("name"), "email": u.get("email"), "role": u.get("role"),
        "phone": u.get("phone") or comp.get("phone") or "", "address": comp.get("address") or "",
        "company_id": str(comp.get("_id", u.get("company_id"))), "company_name": comp.get("name"),
        "company_phone": comp.get("phone") or "", "member_count": member_count,
        "plan": comp.get("plan"), "membership_status": comp.get("membership_status"),
        "trial_ends_at": comp.get("trial_ends_at"), "archived_at": comp.get("archived_at"),
        "created_at": u.get("created_at"), **t,
    }


async def push_admin_control(event: str, data: dict):
    if not ADMIN_CONTROL_WEBHOOK_URL:
        return
    secret = ADMIN_CONTROL_WEBHOOK_SECRET or os.environ.get("INTEGRATION_API_KEY", "")
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(ADMIN_CONTROL_WEBHOOK_URL, json={"event": event, "sent_at": now_iso(), "data": data},
                             headers={"X-Hubtrade-Secret": secret, "Authorization": f"Bearer {secret}",
                                      "X-API-Key": secret, "Content-Type": "application/json"})
        logging.info("admin-control push %s -> %s", event, r.status_code)
    except Exception as e:  # network failures must never break signup
        logging.warning("admin-control push %s failed: %s", event, e)


@api.post("/auth/register")
async def register(req: RegisterReq, response: Response):
    email = req.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    trial_ends = datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS)
    company = {"name": req.company_name, "phone": req.phone.strip(), "address": req.address.strip(),
               "plan": TRIAL_PLAN, "membership_status": "trial", "trial_used": True,
               "trial_started_at": now_iso(), "trial_ends_at": trial_ends.isoformat(), "trade": "General", "created_at": now_iso()}
    comp_res = await db.companies.insert_one(company)
    company_id = str(comp_res.inserted_id)
    user_doc = {"email": email, "password_hash": hash_password(req.password), "name": req.name,
                "phone": req.phone.strip(), "role": "owner", "company_id": company_id, "created_at": now_iso()}
    res = await db.users.insert_one(user_doc)
    token = create_access_token(str(res.inserted_id), email)
    set_cookies(response, token)
    user_doc["_id"] = res.inserted_id
    company["_id"] = comp_res.inserted_id
    asyncio.create_task(push_admin_control("client.created", client_record(user_doc, company, 1)))
    return clean(user_doc)


@api.post("/auth/login")
async def login(req: LoginReq, response: Response):
    email = req.email.lower()
    rate_key = email
    _check_login_rate(rate_key)
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        _login_attempts.setdefault(rate_key, []).append(datetime.now(timezone.utc))
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(str(user["_id"]), email)
    set_cookies(response, token)
    if user.get("company_id"):
        await log_audit(user["company_id"], user, "Logged in")
    return clean(user)


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"status": "ok"}


@api.get("/auth/me")
async def me(user: dict = Depends(require_not_archived)):
    out = clean(user)
    if user.get("company_id"):
        comp = await db.companies.find_one({"_id": ObjectId(user["company_id"])})
        comp = await _expire_trial(comp) if comp else None
        out["company"] = clean(comp) if comp else None
    return out


async def scope(user):
    return user["company_id"]


JOB_STATUSES = ("scheduled", "in_progress", "completed", "delayed", "rescheduled")
LEGACY_STATUS = {"active": "scheduled", "on_time": "scheduled", "late": "delayed", "behind": "delayed"}


class Job(BaseModel):
    name: str = ""
    address: str = ""
    customer_name: str = ""
    status: str = "scheduled"  # scheduled, in_progress, completed, delayed, rescheduled
    start_date: Optional[str] = None
    completion_date: Optional[str] = None
    work_dates: List[str] = []  # extra non-consecutive work days
    description: str = ""
    assigned_employees: List[str] = []
    assigned_vehicles: List[str] = []
    assigned_equipment: List[str] = []


def norm_status(s: Optional[str]) -> str:
    s = LEGACY_STATUS.get(s or "", s or "scheduled")
    return s if s in JOB_STATUSES else "scheduled"


def job_display(doc: dict) -> dict:
    num = doc.get("job_number")
    doc["name"] = f"#{num} – {doc.get('customer_name') or 'Customer'}" if num else doc.get("name", "")
    doc["status"] = norm_status(doc.get("status"))
    cd = doc.get("completion_date")
    doc["is_overdue"] = bool(cd and cd < datetime.now(timezone.utc).strftime("%Y-%m-%d") and doc["status"] != "completed")
    if doc["is_overdue"] and doc["status"] == "scheduled":
        doc["status"] = "delayed"
    doc.setdefault("work_dates", [])
    return doc


def job_dates(job: dict) -> List[str]:
    out = []
    for d in [job.get("start_date"), *(job.get("work_dates") or [])]:
        if d and d not in out:
            out.append(d)
    return sorted(out)


async def sync_job_schedule(job: dict, user: Optional[dict] = None):
    """Keep auto-created schedule entries in step with the job's dates/crew (no duplicates, manual entries kept)."""
    cid, jid = job["company_id"], str(job["_id"])
    wanted = set(job_dates(job))
    existing = await db.schedule.find({"company_id": cid, "job_id": jid}).to_list(500)
    have = {e["date"] for e in existing}
    for e in existing:
        if e.get("auto") and e["date"] not in wanted:
            await db.schedule.delete_one({"_id": e["_id"]})
    for d in wanted - have:
        await db.schedule.insert_one({"company_id": cid, "date": d, "job_id": jid, "auto": True, "notes": "",
                                      "employee_ids": job.get("assigned_employees", []), "vehicle_ids": job.get("assigned_vehicles", []),
                                      "equipment_ids": job.get("assigned_equipment", []), "updated_at": now_iso(),
                                      "updated_by": (user or {}).get("name", "System")})
    await db.schedule.update_many({"company_id": cid, "job_id": jid, "auto": True, "date": {"$in": list(wanted)}},
                                  {"$set": {"employee_ids": job.get("assigned_employees", []), "vehicle_ids": job.get("assigned_vehicles", []),
                                            "equipment_ids": job.get("assigned_equipment", [])}})


async def notify(company_id: str, ntype: str, message: str, **extra):
    await db.notifications.insert_one({"company_id": company_id, "type": ntype, "message": message, "read": False,
                                       "created_at": now_iso(), **extra})


async def next_job_number(cid: str) -> int:
    res = await db.counters.find_one_and_update({"_id": f"job:{cid}"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True)
    return 1000 + res["seq"]


class Employee(BaseModel):
    name: str
    email: str = ""
    phone: str = ""
    role_title: str = "Employee"
    trade: str = "General"
    hourly_rate: float = 0
    status: str = "active"


class Vehicle(BaseModel):
    name: str
    plate: str = ""
    type: str = "Truck"  # Truck, Trailer, Large Vehicle
    status: str = "available"  # available, in-use
    ownership: str = "own"  # own, rent (Large Vehicle)
    rental_start_date: Optional[str] = None
    rental_status: str = "in_use"  # in_use, returned
    oil_change_date: Optional[str] = None
    tire_rotation_date: Optional[str] = None
    registration_expiry: Optional[str] = None
    insurance_expiry: Optional[str] = None
    inspection_date: Optional[str] = None
    hours_used: float = 0


class Equipment(BaseModel):
    name: str
    category: str = "Power Hand Tool"  # Power Hand Tool, Shop Tool, Vehicle Tool
    trade: str = "General"
    condition: str = ""
    status: str = "available"  # available, servicing
    repair_history: List[dict] = []


class Estimate(BaseModel):
    customer_name: str
    customer_email: str = ""
    job_id: Optional[str] = None
    line_items: List[dict] = []  # {section, desc, qty, unit_price}
    notes: str = ""
    photos: List[str] = []
    status: str = "draft"  # draft, sent, approved
    deposit_percent: float = 25
    job_start_date: Optional[str] = None
    num_payments: int = 2


def _add_months(d: datetime, n: int) -> datetime:
    m = d.month - 1 + n
    y, m = d.year + m // 12, m % 12 + 1
    last = (datetime(y + (m == 12), (m % 12) + 1, 1) - timedelta(days=1)).day
    return d.replace(year=y, month=m, day=min(d.day, last))


def payment_schedule(total: float, start: Optional[str], n: int) -> List[dict]:
    n = max(1, min(int(n or 1), 12))
    try:
        base = datetime.strptime(start, "%Y-%m-%d") if start else datetime.now(timezone.utc).replace(tzinfo=None)
    except ValueError:
        base = datetime.now(timezone.utc).replace(tzinfo=None)
    per = round(total / n, 2)
    out = []
    for i in range(n):
        amt = round(total - per * (n - 1), 2) if i == n - 1 else per
        out.append({"label": "Deposit" if i == 0 else f"Payment {i + 1}", "amount": amt,
                    "due_date": _add_months(base, i).strftime("%Y-%m-%d")})
    return out


def deposit_amount(est: dict) -> float:
    sched = est.get("payment_schedule") or []
    if sched:
        return round(float(sched[0].get("amount", 0)), 2)
    return round(est.get("total", 0) * (est.get("deposit_percent", 25) or 0) / 100, 2)


class MessageReq(BaseModel):
    text: str
    job_id: Optional[str] = None


class TimeCardAction(BaseModel):
    employee_id: str
    job_id: Optional[str] = None
    at: Optional[str] = None  # ISO timestamp from offline-queued actions


def _action_time(at: Optional[str]) -> datetime:
    if not at:
        return datetime.now(timezone.utc)
    try:
        t = datetime.fromisoformat(at.replace("Z", "+00:00"))
        if t.tzinfo is None:
            t = t.replace(tzinfo=timezone.utc)
        return min(t, datetime.now(timezone.utc))
    except ValueError:
        return datetime.now(timezone.utc)


def crud_router(name: str, collection: str, Model, create_roles=("owner", "foreman")):
    r = APIRouter()
    post = job_display if collection == "jobs" else (lambda d: d)

    @r.get(f"/{name}")
    async def list_items(user: dict = Depends(require_not_archived)):
        items = await db[collection].find({"company_id": user["company_id"]}).sort("_id", -1).to_list(1000)
        return [post(clean(i)) for i in items]

    label = name[:-1] if name.endswith("s") else name

    @r.post(f"/{name}")
    async def create_item(payload: Model, user: dict = Depends(require_role(*create_roles))):
        doc = payload.model_dump()
        doc["company_id"] = user["company_id"]
        doc["created_at"] = now_iso()
        if collection == "jobs":
            doc["job_number"] = await next_job_number(user["company_id"])
            doc["name"] = f"#{doc['job_number']} – {doc.get('customer_name') or 'Customer'}"
            doc["status"] = norm_status(doc.get("status"))
        res = await db[collection].insert_one(doc)
        doc["_id"] = res.inserted_id
        if collection == "jobs":
            await sync_job_schedule(doc, user)
        await log_audit(user["company_id"], user, f"Created {label}: {doc.get('name', '')}".strip())
        return post(clean(doc))

    @r.get(f"/{name}/{{item_id}}")
    async def get_item(item_id: str, user: dict = Depends(require_not_archived)):
        item = await db[collection].find_one({"_id": _oid(item_id), "company_id": user["company_id"]})
        if not item:
            raise HTTPException(404, "Not found")
        return post(clean(item))

    @r.put(f"/{name}/{{item_id}}")
    async def update_item(item_id: str, payload: Model, user: dict = Depends(require_role(*create_roles))):
        doc = payload.model_dump(exclude_unset=True)
        before = None
        if collection == "jobs":
            doc.pop("name", None)
            if "status" in doc:
                doc["status"] = norm_status(doc["status"])
            before = await db[collection].find_one({"_id": _oid(item_id), "company_id": user["company_id"]})
            if before and before.get("job_number") and "customer_name" in doc:
                doc["name"] = f"#{before['job_number']} – {doc['customer_name'] or 'Customer'}"
        await db[collection].update_one({"_id": _oid(item_id), "company_id": user["company_id"]}, {"$set": doc})
        item = await db[collection].find_one({"_id": _oid(item_id), "company_id": user["company_id"]})
        if not item:
            raise HTTPException(404, "Not found")
        if collection == "jobs" and before:
            await sync_job_schedule(item, user)
            if job_dates(before) != job_dates(item):
                await notify(user["company_id"], "schedule_change", f"Schedule changed for {item['name']}: now {', '.join(job_dates(item)) or 'no dates'}", job_id=item_id)
            if norm_status(before.get("status")) != item.get("status"):
                await notify(user["company_id"], "schedule_change", f"{item['name']} marked {item['status'].replace('_', ' ')}", job_id=item_id)
        await log_audit(user["company_id"], user, f"Updated {label}: {item.get('name', '')}".strip())
        return post(clean(item))

    @r.delete(f"/{name}/{{item_id}}")
    async def delete_item(item_id: str, user: dict = Depends(require_role("owner"))):
        gone = await db[collection].find_one({"_id": _oid(item_id), "company_id": user["company_id"]})
        await db[collection].delete_one({"_id": _oid(item_id), "company_id": user["company_id"]})
        await log_audit(user["company_id"], user, f"Deleted {label}: {gone.get('name', '') if gone else ''}".strip())
        return {"status": "deleted"}

    return r


api.include_router(crud_router("jobs", "jobs", Job))
api.include_router(crud_router("employees", "employees", Employee, create_roles=("owner",)))
api.include_router(crud_router("vehicles", "vehicles", Vehicle))
api.include_router(crud_router("equipment", "equipment", Equipment))


# ---------- Crew assignment ----------
class CrewAssign(BaseModel):
    assigned_employees: List[str] = []
    assigned_vehicles: List[str] = []
    assigned_equipment: List[str] = []


async def _valid_ids(coll: str, cid: str, ids: List[str]) -> List[str]:
    oids = [ObjectId(i) for i in ids if ObjectId.is_valid(i)]
    docs = await db[coll].find({"_id": {"$in": oids}, "company_id": cid}, {"_id": 1}).to_list(1000)
    return [str(d["_id"]) for d in docs]


def _oid(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(404, "Not found")
    return ObjectId(value)


def _valid_date(value: str) -> str:
    try:
        return datetime.strptime(value, "%Y-%m-%d").strftime("%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Date must be YYYY-MM-DD")


@api.put("/jobs/{job_id}/crew")
async def assign_crew(job_id: str, req: CrewAssign, user: dict = Depends(require_role("owner", "foreman"))):
    cid = user["company_id"]
    job = await db.jobs.find_one({"_id": _oid(job_id), "company_id": cid})
    if not job:
        raise HTTPException(404, "Job not found")
    emps = await _valid_ids("employees", cid, req.assigned_employees)
    vehs = await _valid_ids("vehicles", cid, req.assigned_vehicles)
    eqs = await _valid_ids("equipment", cid, req.assigned_equipment)
    await db.jobs.update_one({"_id": job["_id"]}, {"$set": {"assigned_employees": emps, "assigned_vehicles": vehs, "assigned_equipment": eqs}})
    new_emps = set(emps) - set(job.get("assigned_employees", []))
    if new_emps:
        names = await db.employees.find({"_id": {"$in": [ObjectId(i) for i in new_emps]}}, {"name": 1}).to_list(100)
        for n in names:
            await notify(cid, "assignment", f"{n['name']} assigned to job: {job['name']}", job_id=job_id, employee_id=str(n["_id"]))
    job = await db.jobs.find_one({"_id": job["_id"]})
    await sync_job_schedule(job, user)
    await log_audit(cid, user, f"Updated crew on job: {job['name']}")
    return job_display(clean(job))


class JobDates(BaseModel):
    work_dates: List[str]


@api.put("/jobs/{job_id}/dates")
async def set_job_dates(job_id: str, req: JobDates, user: dict = Depends(require_role("owner", "foreman"))):
    cid = user["company_id"]
    job = await db.jobs.find_one({"_id": _oid(job_id), "company_id": cid})
    if not job:
        raise HTTPException(404, "Job not found")
    dates = sorted({_valid_date(d) for d in req.work_dates if d and d != job.get("start_date")})
    await db.jobs.update_one({"_id": job["_id"]}, {"$set": {"work_dates": dates}})
    job = await db.jobs.find_one({"_id": job["_id"]})
    await sync_job_schedule(job, user)
    await notify(cid, "schedule_change", f"Work dates updated for {job['name']}: {', '.join(job_dates(job))}", job_id=job_id)
    await log_audit(cid, user, f"Updated work dates on job: {job['name']}")
    return job_display(clean(job))


class ConflictCheck(BaseModel):
    dates: List[str]
    employee_ids: List[str] = []
    exclude_job_id: Optional[str] = None


@api.post("/schedule/conflicts")
async def schedule_conflicts(req: ConflictCheck, user: dict = Depends(require_role("owner", "foreman"))):
    cid = user["company_id"]
    dates = [_valid_date(d) for d in req.dates if d]
    if not dates or not req.employee_ids:
        return []
    q = {"company_id": cid, "date": {"$in": dates}, "employee_ids": {"$in": req.employee_ids}}
    if req.exclude_job_id:
        q["job_id"] = {"$ne": req.exclude_job_id}
    rows = await db.schedule.find(q).to_list(1000)
    job_ids = {r["job_id"] for r in rows}
    jobs = {str(j["_id"]): job_display(clean(j)) for j in await db.jobs.find({"_id": {"$in": [ObjectId(i) for i in job_ids if ObjectId.is_valid(i)]}}).to_list(500)}
    emps = {str(e["_id"]): e["name"] for e in await db.employees.find({"_id": {"$in": [ObjectId(i) for i in req.employee_ids if ObjectId.is_valid(i)]}}, {"name": 1}).to_list(500)}
    out = []
    for r in rows:
        for eid in set(r.get("employee_ids", [])) & set(req.employee_ids):
            out.append({"employee_id": eid, "employee_name": emps.get(eid, "Employee"), "date": r["date"],
                        "job_id": r["job_id"], "job_name": jobs.get(r["job_id"], {}).get("name", "Job")})
    return sorted(out, key=lambda c: (c["date"], c["employee_name"]))


# ---------- Daily schedule ----------
class ScheduleEntry(BaseModel):
    id: Optional[str] = None
    date: str  # YYYY-MM-DD
    job_id: str
    employee_ids: List[str] = []
    vehicle_ids: List[str] = []
    equipment_ids: List[str] = []
    notes: str = ""


@api.get("/schedule")
async def list_schedule(start: str = Query(...), end: str = Query(...), user: dict = Depends(require_not_archived)):
    cid = user["company_id"]
    rows = await db.schedule.find({"company_id": cid, "date": {"$gte": _valid_date(start), "$lte": _valid_date(end)}}).sort("date", 1).to_list(2000)
    jobs = {str(j["_id"]): job_display(clean(j)) for j in await db.jobs.find({"_id": {"$in": [ObjectId(r["job_id"]) for r in rows if ObjectId.is_valid(r["job_id"])]}}).to_list(2000)}
    out = []
    for r in rows:
        j = jobs.get(r["job_id"], {})
        out.append({**clean(r), "job_name": j.get("name", "Job"), "customer_name": j.get("customer_name", ""), "address": j.get("address", ""),
                    "job_status": j.get("status", "scheduled"), "start_date": j.get("start_date")})
    return out


@api.put("/schedule")
async def upsert_schedule(req: ScheduleEntry, user: dict = Depends(require_role("owner", "foreman"))):
    cid = user["company_id"]
    date = _valid_date(req.date)
    job = await db.jobs.find_one({"_id": _oid(req.job_id), "company_id": cid}, {"name": 1})
    if not job:
        raise HTTPException(404, "Job not found")
    doc = {"company_id": cid, "date": date, "job_id": req.job_id, "notes": req.notes,
           "employee_ids": await _valid_ids("employees", cid, req.employee_ids),
           "vehicle_ids": await _valid_ids("vehicles", cid, req.vehicle_ids),
           "equipment_ids": await _valid_ids("equipment", cid, req.equipment_ids),
           "updated_at": now_iso(), "updated_by": user.get("name", "")}
    key = {"company_id": cid, "date": date, "job_id": req.job_id}
    if req.id:
        existing = await db.schedule.find_one({"_id": _oid(req.id), "company_id": cid})
        if not existing:
            raise HTTPException(404, "Entry not found")
        dup = await db.schedule.find_one({**key, "_id": {"$ne": existing["_id"]}})
        if dup:
            raise HTTPException(400, "That job is already scheduled on this date")
        await db.schedule.update_one({"_id": existing["_id"]}, {"$set": doc})
        key = {"_id": existing["_id"]}
    else:
        await db.schedule.update_one(key, {"$set": doc, "$setOnInsert": {"auto": False}}, upsert=True)
    await notify(cid, "schedule_change", f"{job['name']} scheduled for {date}", job_id=req.job_id)
    await log_audit(cid, user, f"Scheduled {job['name']} for {date}")
    return clean(await db.schedule.find_one(key))


@api.delete("/schedule/{entry_id}")
async def delete_schedule(entry_id: str, user: dict = Depends(require_role("owner", "foreman"))):
    res = await db.schedule.delete_one({"_id": _oid(entry_id), "company_id": user["company_id"]})
    if not res.deleted_count:
        raise HTTPException(404, "Entry not found")
    return {"ok": True}


# ---------- Estimates (custom for email) ----------
@api.get("/estimates")
async def list_estimates(user: dict = Depends(require_not_archived)):
    items = await db.estimates.find({"company_id": user["company_id"]}).sort("_id", -1).to_list(1000)
    return [clean(i) for i in items]


@api.post("/estimates")
async def create_estimate(payload: Estimate, user: dict = Depends(require_role("owner", "foreman"))):
    doc = payload.model_dump()
    doc["company_id"] = user["company_id"]
    doc["total"] = sum(li.get("qty", 1) * li.get("unit_price", 0) for li in payload.line_items)
    doc["payment_schedule"] = payment_schedule(doc["total"], payload.job_start_date, payload.num_payments)
    doc["created_at"] = now_iso()
    res = await db.estimates.insert_one(doc)
    doc["_id"] = res.inserted_id
    await log_audit(user["company_id"], user, f"Created estimate for {payload.customer_name}")
    return clean(doc)


@api.put("/estimates/{item_id}")
async def update_estimate(item_id: str, payload: Estimate, user: dict = Depends(require_role("owner", "foreman"))):
    doc = payload.model_dump()
    doc.pop("status", None)
    doc["total"] = sum(li.get("qty", 1) * li.get("unit_price", 0) for li in payload.line_items)
    doc["payment_schedule"] = payment_schedule(doc["total"], payload.job_start_date, payload.num_payments)
    await db.estimates.update_one({"_id": _oid(item_id), "company_id": user["company_id"]}, {"$set": doc})
    item = await db.estimates.find_one({"_id": _oid(item_id), "company_id": user["company_id"]})
    if not item:
        raise HTTPException(404, "Estimate not found")
    return clean(item)


@api.delete("/estimates/{item_id}")
async def delete_estimate(item_id: str, user: dict = Depends(require_role("owner"))):
    await db.estimates.delete_one({"_id": _oid(item_id), "company_id": user["company_id"]})
    return {"status": "deleted"}


@api.post("/estimates/{item_id}/send")
async def send_estimate(item_id: str, user: dict = Depends(require_role("owner", "foreman"))):
    est = await db.estimates.find_one({"_id": _oid(item_id), "company_id": user["company_id"]})
    if not est:
        raise HTTPException(404, "Estimate not found")
    if not est.get("customer_email"):
        raise HTTPException(400, "Customer email required")
    comp = await db.companies.find_one({"_id": ObjectId(user["company_id"])})
    token = est.get("public_token") or secrets.token_urlsafe(24)
    if not est.get("public_token"):
        await db.estimates.update_one({"_id": est["_id"]}, {"$set": {"public_token": token}})
    link = f"{FRONTEND_URL}/estimate/{token}"
    deposit = deposit_amount(est)
    rows = "".join(
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee'>{escape(str(li.get('desc','')))}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:center'>{li.get('qty',1)}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right'>${li.get('unit_price',0):,.2f}</td>"
        f"<td style='padding:8px;border-bottom:1px solid #eee;text-align:right'>${li.get('qty',1)*li.get('unit_price',0):,.2f}</td></tr>"
        for li in est.get("line_items", [])
    )
    html = f"""
    <table width='100%' style='font-family:Arial,sans-serif;max-width:600px;margin:auto'>
      <tr><td><h2 style='color:#FF3B30'>{comp.get('name','Hub Trade')} — Estimate</h2>
      <p>Prepared for <b>{est.get('customer_name','')}</b></p>
      <table width='100%' style='border-collapse:collapse'>
        <tr style='background:#111;color:#fff'><th style='padding:8px;text-align:left'>Item</th><th>Qty</th><th style='text-align:right'>Unit</th><th style='text-align:right'>Total</th></tr>
        {rows}
      </table>
      <h3 style='text-align:right'>Total: ${est.get('total',0):,.2f}</h3>
      <p style='color:#555'>{escape(str(est.get('notes','')))}</p>
      <p style='margin:28px 0;text-align:center'><a href='{link}' style='background:#FF3B30;color:#fff;padding:14px 24px;border-radius:6px;text-decoration:none;font-weight:bold'>Review &amp; approve estimate</a></p>
      <p style='color:#555;font-size:13px;text-align:center'>Approve online with your e-signature{f" and pay the ${deposit:,.2f} deposit" if deposit > 0 else ""} to get on the schedule.</p>
      <p style='color:#888;font-size:12px'>Sent by {escape(EMAIL_FROM_NAME)} on behalf of {escape(comp.get('name',''))}. We never ask for your password or card details by email.</p>
      </td></tr>
    </table>"""
    payload = {"to": [est["customer_email"]], "subject": f"Your estimate from {comp.get('name','Hub Trade')}", "html": html, "from_name": EMAIL_FROM_NAME}
    await _post_email(payload)
    status_upd = {"sent_at": now_iso()} if est.get("status") == "approved" else {"status": "sent", "sent_at": now_iso()}
    await db.estimates.update_one({"_id": ObjectId(item_id)}, {"$set": status_upd})
    await log_audit(user["company_id"], user, f"Sent estimate to {est.get('customer_email')}")
    return {"status": "sent", "link": link}


# ---------- Public estimate approval + deposit ----------
def _public_estimate(est: dict, comp: dict) -> dict:
    total = est.get("total", 0)
    pct = est.get("deposit_percent", 25) or 0
    return {
        "company_name": comp.get("name", ""), "customer_name": est.get("customer_name", ""),
        "line_items": est.get("line_items", []), "notes": est.get("notes", ""), "total": total,
        "status": est.get("status", "sent"), "deposit_percent": pct, "deposit_amount": deposit_amount(est),
        "approved_at": est.get("approved_at"), "signature_name": est.get("signature_name"),
        "deposit_paid": bool(est.get("deposit_paid")), "deposit_paid_at": est.get("deposit_paid_at"),
        "created_at": est.get("created_at"), "payment_schedule": est.get("payment_schedule", []),
    }


async def _est_by_token(token: str):
    est = await db.estimates.find_one({"public_token": token})
    if not est:
        raise HTTPException(404, "Estimate not found")
    comp = await db.companies.find_one({"_id": ObjectId(est["company_id"])}, {"name": 1})
    return est, comp or {}


@api.get("/public/estimates/{token}")
async def public_estimate(token: str):
    est, comp = await _est_by_token(token)
    return _public_estimate(est, comp)


def _pdf_response(est: dict, comp: dict) -> Response:
    pdf = build_estimate_pdf(est, comp)
    name = f"estimate-{str(est['_id'])[-6:].upper()}-{(est.get('customer_name') or 'customer').replace(' ', '_')}.pdf"
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="{name}"'})


@api.get("/public/estimates/{token}/pdf")
async def public_estimate_pdf(token: str):
    est, comp = await _est_by_token(token)
    return _pdf_response(est, comp)


@api.get("/estimates/{item_id}/pdf")
async def estimate_pdf(item_id: str, user: dict = Depends(require_role("owner", "foreman"))):
    est = await db.estimates.find_one({"_id": _oid(item_id), "company_id": user["company_id"]})
    if not est:
        raise HTTPException(404, "Estimate not found")
    comp = await db.companies.find_one({"_id": ObjectId(user["company_id"])}, {"name": 1})
    return _pdf_response(est, comp or {})


class ApproveReq(BaseModel):
    signature_name: str = Field(min_length=2, max_length=120)


@api.post("/public/estimates/{token}/approve")
async def approve_estimate(token: str, req: ApproveReq, request: Request, background: BackgroundTasks):
    est, comp = await _est_by_token(token)
    if est.get("status") == "approved":
        return _public_estimate(est, comp)
    upd = {"status": "approved", "approved_at": now_iso(), "signature_name": req.signature_name.strip(),
           "signer_ip": request.client.host if request.client else None}
    await db.estimates.update_one({"_id": est["_id"]}, {"$set": upd})
    await db.notifications.insert_one({"company_id": est["company_id"], "type": "estimate",
                                       "message": f"{est.get('customer_name','Customer')} approved estimate (${est.get('total',0):,.2f}) — signed {upd['signature_name']}",
                                       "estimate_id": str(est["_id"]), "read": False, "created_at": now_iso()})
    await log_audit(est["company_id"], None, f"Customer {upd['signature_name']} e-signed estimate for {est.get('customer_name','')}")
    background.add_task(send_approval_emails, {**est, **upd}, comp, token)
    return _public_estimate({**est, **upd}, comp)


def _approval_html(heading: str, intro: str, est: dict, comp: dict, link: str) -> str:
    return f"""
    <table width='100%' style='font-family:Arial,sans-serif;max-width:600px;margin:auto'>
      <tr><td style='padding:24px'>
      <h2 style='color:#FF3B30;margin:0 0 12px'>{escape(heading)}</h2>
      <p>{intro}</p>
      <table width='100%' style='border-collapse:collapse;margin:16px 0'>
        <tr><td style='padding:6px 0;color:#555'>Company</td><td style='padding:6px 0;text-align:right'><b>{escape(comp.get('name',''))}</b></td></tr>
        <tr><td style='padding:6px 0;color:#555'>Customer</td><td style='padding:6px 0;text-align:right'>{escape(est.get('customer_name',''))}</td></tr>
        <tr><td style='padding:6px 0;color:#555'>Total</td><td style='padding:6px 0;text-align:right'><b>${est.get('total',0):,.2f}</b></td></tr>
        <tr><td style='padding:6px 0;color:#555'>Signed by</td><td style='padding:6px 0;text-align:right'>{escape(est.get('signature_name',''))}</td></tr>
      </table>
      <p>The signed estimate is attached as a PDF for your records.</p>
      <p style='margin:24px 0'><a href='{link}' style='background:#FF3B30;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold'>View estimate</a></p>
      <p style='color:#888;font-size:12px'>Sent by {escape(EMAIL_FROM_NAME)}. We never ask for your password or card details by email.</p>
      </td></tr>
    </table>"""


async def send_approval_emails(est: dict, comp: dict, token: str):
    pdf_b64 = base64.b64encode(build_estimate_pdf(est, comp)).decode()
    attachment = [{"filename": f"estimate-{str(est['_id'])[-6:].upper()}-signed.pdf", "content": pdf_b64}]
    link = f"{FRONTEND_URL}/estimate/{token}"
    deposit = deposit_amount(est)
    subject = f"Signed estimate from {comp.get('name','Hub Trade')} — ${est.get('total',0):,.2f}"
    sends = []
    if est.get("customer_email"):
        intro = (f"Thanks, {escape(est.get('signature_name',''))} — your approval has been recorded."
                 + (f" You can pay the ${deposit:,.2f} deposit any time from the estimate page." if deposit > 0 and not est.get("deposit_paid") else ""))
        sends.append((est["customer_email"], _approval_html("Your estimate is approved", intro, est, comp, link)))
    owners = await db.users.find({"company_id": est["company_id"], "role": "owner"}, {"email": 1}).to_list(10)
    owner_intro = f"{escape(est.get('customer_name',''))} just e-signed your estimate. Deposit due: ${deposit:,.2f}."
    for o in owners:
        sends.append((o["email"], _approval_html("Estimate approved & signed", owner_intro, est, comp, f"{FRONTEND_URL}/app/estimates")))
    for to, html in sends:
        try:
            await _post_email({"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME, "attachments": attachment})
        except HTTPException:
            continue
    await db.estimates.update_one({"_id": est["_id"]}, {"$set": {"approval_emails_sent_at": now_iso()}})


class DepositReq(BaseModel):
    origin_url: str


@api.post("/public/estimates/{token}/deposit")
async def estimate_deposit_checkout(token: str, req: DepositReq):
    est, comp = await _est_by_token(token)
    if est.get("status") != "approved":
        raise HTTPException(400, "Approve the estimate before paying the deposit")
    if est.get("deposit_paid"):
        raise HTTPException(400, "Deposit already paid")
    amount = deposit_amount(est)
    if amount <= 0:
        raise HTTPException(400, "No deposit required for this estimate")
    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=[{"quantity": 1, "price_data": {"currency": "usd", "unit_amount": int(round(amount * 100)),
                     "product_data": {"name": f"Deposit — {comp.get('name','')} estimate for {est.get('customer_name','')}"}}}],
        success_url=f"{req.origin_url}/estimate/{token}?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{req.origin_url}/estimate/{token}",
        customer_email=est.get("customer_email") or None,
        metadata={"kind": "deposit", "estimate_id": str(est["_id"]), "company_id": est["company_id"]},
    )
    await db.payment_transactions.insert_one({
        "session_id": session.id, "kind": "deposit", "estimate_id": str(est["_id"]), "company_id": est["company_id"],
        "amount": amount, "currency": "usd", "status": "initiated", "payment_status": "pending",
        "created_at": now_iso(), "updated_at": now_iso(),
    })
    return {"checkout_url": session.url, "session_id": session.id}


async def _fulfil_payment(rec: dict):
    if rec.get("kind") == "deposit":
        est = await db.estimates.find_one({"_id": ObjectId(rec["estimate_id"])})
        if est and not est.get("deposit_paid"):
            await db.estimates.update_one({"_id": est["_id"]}, {"$set": {"deposit_paid": True, "deposit_paid_at": now_iso(), "deposit_amount": rec["amount"]}})
            await db.notifications.insert_one({"company_id": rec["company_id"], "type": "payment",
                                               "message": f"Deposit of ${rec['amount']:,.2f} received from {est.get('customer_name','customer')}",
                                               "estimate_id": str(est["_id"]), "read": False, "created_at": now_iso()})
            await log_audit(rec["company_id"], None, f"Deposit ${rec['amount']:,.2f} paid on estimate for {est.get('customer_name','')}")
        return
    await db.companies.update_one({"_id": ObjectId(rec["company_id"])},
                                  {"$set": {"plan": rec["plan"], "membership_status": "active", "membership_since": now_iso()},
                                   "$unset": {"archived_at": "", "trial_ended_email_sent": ""}})


_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv", "send us your password",
             "enter your password below", "confirm your card number", "your full card number", "seed phrase",
             "recovery phrase", "verify your card", "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} ≠ real link host {real!r} (G3)")


async def _post_email(payload: dict) -> None:
    _assert_safe_email(payload["subject"], payload["html"])
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            resp = await c.post(f"{EMAIL_BASE_URL}/api/v1/email/send", headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
    except Exception as e:
        logger.error(f"email failed {e}")
        raise HTTPException(502, "Failed to send email")


# ---------- Trial reminder cron ----------
TRIAL_REMINDER_DAYS = int(os.environ.get("TRIAL_REMINDER_DAYS", "5"))


def _trial_reminder_html(owner_name: str, company_name: str, ends: datetime) -> str:
    link = f"{FRONTEND_URL}/app/membership"
    return f"""
    <table width='100%' style='font-family:Arial,sans-serif;max-width:600px;margin:auto'>
      <tr><td style='padding:24px'>
      <h2 style='color:#FF3B30;margin:0 0 12px'>Your Hub Trade trial ends soon</h2>
      <p>Hi {escape(owner_name)},</p>
      <p>The free trial for <b>{escape(company_name)}</b> ends on <b>{ends.strftime('%B %d, %Y')}</b>.
      Keep your jobs, crew, equipment and time cards running without interruption by choosing a plan now.</p>
      <p style='margin:28px 0'><a href='{link}' style='background:#FF3B30;color:#fff;padding:14px 24px;border-radius:6px;text-decoration:none;font-weight:bold'>Upgrade my plan</a></p>
      <p style='color:#555;font-size:13px'>Plans start at $60/mo, billed monthly. Your data is kept safe either way.</p>
      <p style='color:#888;font-size:12px'>Sent by {escape(EMAIL_FROM_NAME)}. We never ask for your password or card details by email.</p>
      </td></tr>
    </table>"""


def _trial_ended_html(owner_name: str, company_name: str) -> str:
    link = f"{FRONTEND_URL}/app/membership"
    return f"""
    <table width='100%' style='font-family:Arial,sans-serif;max-width:600px;margin:auto'>
      <tr><td style='padding:24px'>
      <h2 style='color:#FF3B30;margin:0 0 12px'>Your Hub Trade trial has ended</h2>
      <p>Hi {escape(owner_name)},</p>
      <p>The {TRIAL_DAYS}-day free trial for <b>{escape(company_name)}</b> ended today, so the account is now <b>archived</b>.
      Your jobs, crew, equipment, estimates and time cards are saved for <b>{ARCHIVE_GRACE_DAYS} more days</b> —
      pick a plan before then to reactivate everything in one tap. After that the account and its data are permanently removed.</p>
      <p style='margin:28px 0'><a href='{link}' style='background:#FF3B30;color:#fff;padding:14px 24px;border-radius:6px;text-decoration:none;font-weight:bold'>Reactivate my workspace</a></p>
      <p style='color:#555;font-size:13px'>Plans start at $60/mo, billed monthly.</p>
      <p style='color:#888;font-size:12px'>Sent by {escape(EMAIL_FROM_NAME)}. We never ask for your password or card details by email.</p>
      </td></tr>
    </table>"""


async def _email_owners(comp: dict, subject: str, html_for: callable) -> int:
    owners = await db.users.find({"company_id": str(comp["_id"]), "role": "owner"}, {"email": 1, "name": 1}).to_list(10)
    sent = 0
    for o in owners:
        try:
            await _post_email({"to": [o["email"]], "subject": subject, "html": html_for(o.get("name") or "there"), "from_name": EMAIL_FROM_NAME})
            sent += 1
        except HTTPException:
            continue
    return sent


async def run_trial_reminders() -> int:
    now = datetime.now(timezone.utc)
    horizon = (now + timedelta(days=TRIAL_REMINDER_DAYS)).isoformat()
    comps = await db.companies.find({"membership_status": "trial", "trial_reminder_sent": {"$ne": True},
                                     "trial_ends_at": {"$gt": now.isoformat(), "$lte": horizon}}).to_list(500)
    sent = 0
    for comp in comps:
        ends = datetime.fromisoformat(comp["trial_ends_at"])
        sent += await _email_owners(comp, f"Your Hub Trade free trial ends in {TRIAL_REMINDER_DAYS} days",
                                    lambda n, c=comp: _trial_reminder_html(n, c.get("name", ""), ends))
        await db.companies.update_one({"_id": comp["_id"]}, {"$set": {"trial_reminder_sent": True, "trial_reminder_sent_at": now_iso()}})
    logger.info(f"trial reminders sent: {sent}")
    return sent


async def run_trial_ended() -> int:
    now = datetime.now(timezone.utc)
    comps = await db.companies.find({"membership_status": {"$in": ["trial", "archived"]}, "trial_ended_email_sent": {"$ne": True},
                                     "trial_ends_at": {"$lte": now.isoformat()}}).to_list(500)
    sent = 0
    for comp in comps:
        upd = {"membership_status": "archived", "plan": None, "trial_ended_email_sent": True, "trial_ended_email_sent_at": now_iso()}
        if not comp.get("archived_at"):
            upd["archived_at"] = now_iso()
        await db.companies.update_one({"_id": comp["_id"]}, {"$set": upd})
        sent += await _email_owners(comp, "Your Hub Trade free trial has ended", lambda n, c=comp: _trial_ended_html(n, c.get("name", "")))
    logger.info(f"trial ended emails sent: {sent}")
    return sent


PURGE_COLLECTIONS = ("jobs", "employees", "vehicles", "equipment", "estimates", "timecards", "schedule",
                     "notifications", "audit_logs", "data_entry_tickets", "files", "payment_transactions")


async def run_purge_archived() -> int:
    # Removes companies archived for ARCHIVE_GRACE_DAYS+ days that never paid (explicit trial policy).
    cutoff = (datetime.now(timezone.utc) - timedelta(days=ARCHIVE_GRACE_DAYS)).isoformat()
    comps = await db.companies.find({"membership_status": "archived", "archived_at": {"$lte": cutoff}}).to_list(200)
    removed = 0
    for comp in comps:
        cid = str(comp["_id"])
        for coll in PURGE_COLLECTIONS:
            await db[coll].delete_many({"company_id": cid})
        await db.users.delete_many({"company_id": cid, "is_superadmin": {"$ne": True}})
        await db.companies.delete_one({"_id": comp["_id"], "membership_status": "archived"})
        removed += 1
        logger.info(f"purged archived company {cid} ({comp.get('name','')})")
    return removed


async def run_missed_clock_ins():
    """Flag employees scheduled today who have no clock-in yet (once per employee per day)."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    entries = await db.schedule.find({"date": today, "employee_ids.0": {"$exists": True}}).to_list(5000)
    for e in entries:
        for eid in e.get("employee_ids", []):
            key = f"missed:{eid}:{today}"
            if await db.notifications.find_one({"dedupe_key": key}):
                continue
            if await db.timecards.find_one({"employee_id": eid, "company_id": e["company_id"], "clock_in": {"$regex": f"^{today}"}}):
                continue
            emp = await db.employees.find_one({"_id": ObjectId(eid)}, {"name": 1}) if ObjectId.is_valid(eid) else None
            job = await db.jobs.find_one({"_id": ObjectId(e["job_id"])}) if ObjectId.is_valid(e["job_id"]) else None
            jname = job_display(job)["name"] if job else "today's job"
            await notify(e["company_id"], "missed_clock_in", f"{(emp or {}).get('name', 'Employee')} has not clocked in for {jname} ({today})",
                         employee_id=eid, job_id=e["job_id"], dedupe_key=key)


async def run_trial_jobs():
    await run_trial_reminders()
    await run_trial_ended()
    await run_purge_archived()
    await run_missed_clock_ins()


@api.post("/cron/trial-reminders")
async def cron_trial_reminders(background: BackgroundTasks, authorization: str = Header(None), x_webhook_id: str = Header(None)):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    expected = os.environ["WEBHOOK_CRON_SECRET"]
    token = authorization.split(" ", 1)[1] if authorization and authorization.lower().startswith("bearer ") else ""
    if not hmac.compare_digest(token, expected):
        raise HTTPException(401, "Unauthorized")
    run_id = x_webhook_id or str(uuid.uuid4())
    if await db.cron_runs.find_one({"run_id": run_id}):
        return {"status": "duplicate"}
    await db.cron_runs.insert_one({"run_id": run_id, "job": "trial-reminders", "created_at": now_iso()})
    background.add_task(run_trial_jobs)
    return {"status": "accepted"}


# ---------- File upload ----------
ALLOWED_UPLOAD_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "application/pdf"}
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


@api.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(require_not_archived)):
    ct = (file.content_type or "").lower()
    if ct not in ALLOWED_UPLOAD_TYPES:
        raise HTTPException(400, "Only JPG, PNG, WEBP, GIF, HEIC images and PDF files are allowed")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large (max 10 MB)")
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic", "application/pdf": "pdf"}[ct]
    path = f"{APP_NAME}/{user['company_id']}/{uuid.uuid4()}.{ext}"
    result = put_object(path, data, ct)
    await db.files.insert_one({"storage_path": result["path"], "content_type": ct,
                               "company_id": user["company_id"], "is_deleted": False, "created_at": now_iso()})
    return {"path": result["path"]}


@api.get("/files/{path:path}")
async def download_file(path: str, user: dict = Depends(require_not_archived)):
    record = await db.files.find_one({"storage_path": path, "company_id": user["company_id"], "is_deleted": False})
    if not record:
        raise HTTPException(404, "File not found")
    return _serve_file(record, path)


# ---------- Time cards ----------
@api.post("/timecards/clock-in")
async def clock_in(req: TimeCardAction, user: dict = Depends(require_not_archived)):
    existing = await db.timecards.find_one({"employee_id": req.employee_id, "company_id": user["company_id"], "clock_out": None})
    if existing:
        raise HTTPException(400, "Already clocked in")
    doc = {"employee_id": req.employee_id, "job_id": req.job_id, "company_id": user["company_id"],
           "clock_in": _action_time(req.at).isoformat(), "clock_out": None, "created_at": now_iso(), "offline_synced": bool(req.at)}
    res = await db.timecards.insert_one(doc)
    doc["_id"] = res.inserted_id
    emp = await db.employees.find_one({"_id": ObjectId(req.employee_id)}) if ObjectId.is_valid(req.employee_id) else None
    await _clock_notify(user["company_id"], "clock_in", emp, req.job_id, doc["clock_in"])
    await log_audit(user["company_id"], user, f"Clocked in {emp.get('name') if emp else 'employee'}")
    return clean(doc)


async def _clock_notify(cid: str, ntype: str, emp: Optional[dict], job_id: Optional[str], at_iso: str):
    job = await db.jobs.find_one({"_id": ObjectId(job_id)}, {"name": 1, "job_number": 1, "customer_name": 1, "address": 1}) if job_id and ObjectId.is_valid(job_id) else None
    job_name = job_display(job)["name"] if job else "no job selected"
    t = datetime.fromisoformat(at_iso)
    when = f"{t.strftime('%b %d, %Y')} at {t.strftime('%I:%M %p').lstrip('0')}"
    verb = "clocked in" if ntype == "clock_in" else "clocked out"
    await notify(cid, ntype, f"{(emp or {}).get('name', 'Employee')} {verb} — {job_name} — {when}",
                 employee_id=str(emp["_id"]) if emp else None, job_id=job_id, at=at_iso)


@api.post("/timecards/clock-out")
async def clock_out(req: TimeCardAction, user: dict = Depends(require_not_archived)):
    tc = await db.timecards.find_one({"employee_id": req.employee_id, "company_id": user["company_id"], "clock_out": None})
    if not tc:
        raise HTTPException(400, "Not clocked in")
    ci = datetime.fromisoformat(tc["clock_in"])
    out = max(_action_time(req.at), ci)
    hours = round((out - ci).total_seconds() / 3600, 2)
    await db.timecards.update_one({"_id": tc["_id"]}, {"$set": {"clock_out": out.isoformat(), "hours": hours}})
    tc = await db.timecards.find_one({"_id": tc["_id"]})
    emp = await db.employees.find_one({"_id": ObjectId(req.employee_id)}) if ObjectId.is_valid(req.employee_id) else None
    await _clock_notify(user["company_id"], "clock_out", emp, tc.get("job_id"), tc["clock_out"])
    await log_audit(user["company_id"], user, f"Clocked out {emp.get('name') if emp else 'employee'} ({hours}h)")
    return clean(tc)


@api.get("/timecards")
async def list_timecards(user: dict = Depends(require_not_archived)):
    items = await db.timecards.find({"company_id": user["company_id"]}).sort("_id", -1).to_list(1000)
    return [clean(i) for i in items]


class JobPhoto(BaseModel):
    path: str
    caption: str = ""
    taken_at: Optional[str] = None


@api.post("/jobs/{job_id}/photos")
async def add_job_photo(job_id: str, req: JobPhoto, user: dict = Depends(require_not_archived)):
    job = await db.jobs.find_one({"_id": _oid(job_id), "company_id": user["company_id"]}, {"name": 1})
    if not job:
        raise HTTPException(404, "Job not found")
    photo = {"id": str(uuid.uuid4()), "path": req.path, "caption": req.caption, "taken_at": req.taken_at or now_iso(),
             "by": user.get("name", ""), "created_at": now_iso()}
    await db.jobs.update_one({"_id": job["_id"]}, {"$push": {"photos": photo}})
    await log_audit(user["company_id"], user, f"Added photo to job: {job['name']}")
    return photo


@api.get("/timecards/active")
async def active_timecards(user: dict = Depends(require_not_archived)):
    items = await db.timecards.find({"company_id": user["company_id"], "clock_out": None}).to_list(1000)
    return [clean(i) for i in items]


# ---------- Messages ----------
@api.get("/messages")
async def list_messages(job_id: Optional[str] = None, user: dict = Depends(require_not_archived)):
    q = {"company_id": user["company_id"]}
    if job_id:
        q["job_id"] = job_id
    items = await db.messages.find(q).sort("_id", -1).limit(100).to_list(100)
    return list(reversed([clean(i) for i in items]))


@api.post("/messages")
async def post_message(req: MessageReq, user: dict = Depends(require_not_archived)):
    doc = {"text": req.text, "job_id": req.job_id, "company_id": user["company_id"],
           "author_name": user["name"], "author_role": user["role"], "created_at": now_iso()}
    res = await db.messages.insert_one(doc)
    doc["_id"] = res.inserted_id
    return clean(doc)


# ---------- Dashboard & reports ----------
async def _count(coll, cid: str, **extra) -> int:
    return await db[coll].count_documents({"company_id": cid, **extra})


async def _data_entry_summary(cid: str) -> dict:
    tickets = await db.data_entry_tickets.find({"company_id": cid}).to_list(1000)
    comp = await db.companies.find_one({"_id": ObjectId(cid)}, {"plan": 1})
    data_hours = PLAN_LIMITS.get((comp or {}).get("plan") or "", {}).get("data_hours", 0)
    used = sum(t.get("hours_requested", 0) for t in tickets)
    recent = sorted(
        [t for t in tickets if t.get("updated_at") and (t.get("admin_notes") or t.get("status") != "open")],
        key=lambda t: t["updated_at"], reverse=True)[:5]
    return {
        "data_hours_total": data_hours,
        "data_hours_used": round(used, 1),
        "data_hours_remaining": round(max(data_hours - used, 0), 1),
        "recent_ticket_updates": [clean(t) for t in recent],
    }


@api.get("/dashboard")
async def dashboard(user: dict = Depends(require_not_archived)):
    cid = user["company_id"]
    active_jobs = [job_display(clean(j)) for j in await db.jobs.find({"company_id": cid, "status": {"$nin": ["completed"]}}).sort("_id", -1).to_list(6)]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    active_tcs = await db.timecards.find({"company_id": cid, "clock_out": None}, {"employee_id": 1}).to_list(1000)
    return {
        "active_jobs": await db.jobs.count_documents({"company_id": cid, "status": {"$nin": ["completed"]}}),
        "jobs_behind": await db.jobs.count_documents({"company_id": cid, "status": {"$nin": ["completed"]}, "$or": [{"status": "delayed"}, {"completion_date": {"$lt": today, "$ne": None}}]}),
        "completed_jobs": await _count("jobs", cid, status="completed"),
        "clocked_in": len(active_tcs),
        "clocked_in_ids": [t["employee_id"] for t in active_tcs],
        "vehicles_in_use": await _count("vehicles", cid, status="in-use"),
        "equipment_assigned": await _count("equipment", cid, status="assigned"),
        "total_vehicles": await _count("vehicles", cid),
        "total_equipment": await _count("equipment", cid),
        "total_employees": await _count("employees", cid),
        "upcoming_estimates": await _count("estimates", cid, status="draft"),
        "active_jobs_list": active_jobs,
        "unread_notifications": await _count("notifications", cid, read=False),
        **(await _data_entry_summary(cid)),
    }


@api.get("/reports/weekly")
async def weekly_report(user: dict = Depends(require_not_archived)):
    cid = user["company_id"]
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    tcs = await db.timecards.find(
        {"company_id": cid, "clock_out": {"$ne": None}, "created_at": {"$gte": week_ago.isoformat()}},
        {"hours": 1, "employee_id": 1}).to_list(2000)
    emp_map = await _hourly_rates(cid)
    labor_hours = sum(t.get("hours", 0) for t in tcs)
    labor_cost = sum(t.get("hours", 0) * emp_map.get(t.get("employee_id"), 0) for t in tcs)
    jobs = await db.jobs.find({"company_id": cid}, {"material_cost": 1, "onsite_purchases": 1}).to_list(1000)
    return {
        "labor_hours": round(labor_hours, 1),
        "labor_cost": round(labor_cost, 2),
        "equipment_hours": round(await _sum_field("equipment", cid, "hours_used"), 1),
        "vehicle_hours": round(await _sum_field("vehicles", cid, "hours_used"), 1),
        "completed_jobs": await _count("jobs", cid, status="completed"),
        "material_cost": round(sum(j.get("material_cost", 0) + j.get("onsite_purchases", 0) for j in jobs), 2),
    }


async def _hourly_rates(cid: str) -> dict:
    employees = await db.employees.find({"company_id": cid}, {"hourly_rate": 1}).to_list(1000)
    return {str(e["_id"]): e.get("hourly_rate", 0) for e in employees}


async def _sum_field(coll, cid: str, field: str) -> float:
    docs = await db[coll].find({"company_id": cid}, {field: 1}).to_list(1000)
    return float(sum(d.get(field, 0) or 0 for d in docs))


@api.get("/jobs/{job_id}/cost")
async def job_cost(job_id: str, user: dict = Depends(require_not_archived)):
    job = await db.jobs.find_one({"_id": ObjectId(job_id), "company_id": user["company_id"]})
    if not job:
        raise HTTPException(404, "Job not found")
    tcs = await db.timecards.find({"company_id": user["company_id"], "job_id": job_id, "clock_out": {"$ne": None}}).to_list(1000)
    emp_map = await _hourly_rates(user["company_id"])
    labor_hours = sum(t.get("hours", 0) for t in tcs)
    labor_cost = sum(t.get("hours", 0) * emp_map.get(t.get("employee_id"), 0) for t in tcs)
    material = job.get("material_cost", 0)
    onsite = job.get("onsite_purchases", 0)
    return {"labor_hours": round(labor_hours, 1), "labor_cost": round(labor_cost, 2),
            "material_cost": material, "onsite_purchases": onsite,
            "total": round(labor_cost + material + onsite, 2)}


# ---------- Team members (create foreman/employee accounts) ----------
class TeamMemberReq(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    name: str
    role: str  # foreman or employee


def _gen_username(name: str, cid: str) -> str:
    base = re.sub(r"[^a-z0-9]", "", name.lower()) or "user"
    return f"{base[:12]}{secrets.randbelow(9000) + 1000}@{cid[-6:]}.hubtrade"


def _gen_password() -> str:
    alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(10))


@api.get("/team")
async def list_team(user: dict = Depends(require_not_archived)):
    members = await db.users.find({"company_id": user["company_id"]}).to_list(1000)
    return [clean(m) for m in members]


@api.post("/team")
async def add_team(req: TeamMemberReq, user: dict = Depends(require_role("owner"))):
    if req.role not in ("owner", "foreman", "employee"):
        raise HTTPException(400, "Invalid role")
    email = (req.email or "").strip().lower() or _gen_username(req.name, user["company_id"])
    while await db.users.find_one({"email": email}):
        if req.email:
            raise HTTPException(400, "Email already registered")
        email = _gen_username(req.name, user["company_id"])
    password = req.password or _gen_password()
    doc = {"email": email, "password_hash": hash_password(password), "name": req.name,
           "role": req.role, "company_id": user["company_id"], "created_at": now_iso()}
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    await log_audit(user["company_id"], user, f"Added team member {req.name} ({req.role})")
    out = clean(doc)
    out["credentials"] = {"username": email, "password": password}
    return out


class RoleUpdateReq(BaseModel):
    role: str


@api.put("/team/{user_id}/role")
async def update_role(user_id: str, req: RoleUpdateReq, user: dict = Depends(require_role("owner"))):
    if req.role not in ("owner", "foreman", "employee"):
        raise HTTPException(400, "Invalid role")
    target = await db.users.find_one({"_id": _oid(user_id), "company_id": user["company_id"]})
    if not target:
        raise HTTPException(404, "Member not found")
    if str(target["_id"]) == str(user["_id"]) and req.role != "owner":
        if user.get("is_superadmin"):
            raise HTTPException(400, "Super-admin owner cannot be demoted")
        owners = await db.users.count_documents({"company_id": user["company_id"], "role": "owner"})
        if owners <= 1:
            raise HTTPException(400, "Cannot demote the only owner")
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"role": req.role}})
    target["role"] = req.role
    await log_audit(user["company_id"], user, f"Changed {target.get('name')}'s role to {req.role}")
    return clean(target)


@api.delete("/team/{user_id}")
async def remove_team(user_id: str, user: dict = Depends(require_role("owner"))):
    if str(user_id) == str(user["_id"]):
        raise HTTPException(400, "You cannot remove yourself")
    gone = await db.users.find_one({"_id": ObjectId(user_id), "company_id": user["company_id"]})
    await db.users.delete_one({"_id": ObjectId(user_id), "company_id": user["company_id"]})
    await log_audit(user["company_id"], user, f"Removed team member {gone.get('name') if gone else ''}".strip())
    return {"status": "deleted"}


# ---------- Data-entry assistance tickets ----------
class DataEntryTicketReq(BaseModel):
    title: str
    category: str = "General"
    priority: str = "normal"  # low, normal, high
    description: str = ""
    hours_requested: float = 0
    attachments: List[dict] = []  # {path, name, content_type, size}


TICKET_FILE_TYPES = {
    **{t: t.split("/")[-1].replace("jpeg", "jpg") for t in ("image/jpeg", "image/png", "image/webp", "image/gif", "image/heic")},
    "application/pdf": "pdf", "text/csv": "csv", "text/plain": "txt",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}
TICKET_FILE_EXTS = {v: k for k, v in TICKET_FILE_TYPES.items()}


@api.post("/data-entry-tickets/upload")
async def ticket_upload(file: UploadFile = File(...), user: dict = Depends(require_not_archived)):
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    ext = "jpg" if ext == "jpeg" else ext
    ct = (file.content_type or "").lower()
    if ct not in TICKET_FILE_TYPES:
        ct = TICKET_FILE_EXTS.get(ext)
    if not ct:
        raise HTTPException(400, "Allowed: images, PDF, CSV, TXT, XLS/XLSX, DOC/DOCX")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large (max 10 MB)")
    path = f"{APP_NAME}/{user['company_id']}/tickets/{uuid.uuid4()}.{TICKET_FILE_TYPES[ct]}"
    result = put_object(path, data, ct)
    await db.files.insert_one({"storage_path": result["path"], "content_type": ct, "original_name": file.filename,
                               "company_id": user["company_id"], "is_deleted": False, "created_at": now_iso()})
    return {"path": result["path"], "name": file.filename, "content_type": ct, "size": len(data)}


def _serve_file(record: dict, path: str):
    data, _ = get_object(path)
    ct = record.get("content_type") or "application/octet-stream"
    disposition = "inline" if ct.startswith("image/") or ct == "application/pdf" else "attachment"
    fname = record.get("original_name") or path.rsplit("/", 1)[-1]
    return StarletteResponse(content=data, media_type=ct, headers={
        "X-Content-Type-Options": "nosniff", "Content-Disposition": f'{disposition}; filename="{fname}"',
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox"})


class TicketMessageReq(BaseModel):
    body: str
    attachments: List[dict] = []


def _message(author: str, role: str, body: str, attachments: list) -> dict:
    return {"id": str(uuid.uuid4()), "author": author, "author_role": role, "body": body.strip(),
            "attachments": attachments or [], "created_at": now_iso()}


async def _append_message(ticket: dict, msg: dict, notify_company: bool):
    await db.data_entry_tickets.update_one({"_id": ticket["_id"]}, {"$push": {"messages": msg}, "$set": {"updated_at": msg["created_at"]}})
    if notify_company:
        await create_notification(ticket["company_id"], f'New reply on ticket "{ticket.get("title")}" from the data-entry team.', str(ticket["_id"]))
    return clean(await db.data_entry_tickets.find_one({"_id": ticket["_id"]}))


@api.post("/data-entry-tickets/{ticket_id}/messages")
async def ticket_reply(ticket_id: str, req: TicketMessageReq, user: dict = Depends(require_not_archived)):
    t = await db.data_entry_tickets.find_one({"_id": _oid(ticket_id), "company_id": user["company_id"]})
    if not t:
        raise HTTPException(404, "Ticket not found")
    if not req.body.strip() and not req.attachments:
        raise HTTPException(400, "Message is empty")
    return await _append_message(t, _message(user["name"], "owner", req.body, req.attachments), False)


@api.get("/data-entry-tickets")
async def list_tickets(user: dict = Depends(require_not_archived)):
    items = await db.data_entry_tickets.find({"company_id": user["company_id"]}).sort("_id", -1).to_list(1000)
    return [clean(i) for i in items]


@api.post("/data-entry-tickets")
async def create_ticket(req: DataEntryTicketReq, user: dict = Depends(require_not_archived)):
    comp = await db.companies.find_one({"_id": ObjectId(user["company_id"])})
    doc = {**req.model_dump(), "company_id": user["company_id"],
           "company_name": comp.get("name") if comp else "",
           "created_by": user["name"], "created_by_id": str(user["_id"]),
           "status": "open", "admin_notes": "", "messages": [], "created_at": now_iso()}
    res = await db.data_entry_tickets.insert_one(doc)
    doc["_id"] = res.inserted_id
    await log_audit(user["company_id"], user, f"Submitted data-entry ticket: {req.title}")
    asyncio.create_task(push_admin_control("ticket.created", _ticket_out(dict(doc))))
    return clean(doc)


# ---------- Admin control (super-admin only) ----------
@api.get("/admin/data-entry-tickets")
async def admin_list_tickets(user: dict = Depends(require_superadmin)):
    items = await db.data_entry_tickets.find({}).sort("_id", -1).to_list(2000)
    return [clean(i) for i in items]


class AdminTicketUpdate(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None


@api.put("/admin/data-entry-tickets/{ticket_id}")
async def admin_update_ticket(ticket_id: str, req: AdminTicketUpdate, user: dict = Depends(require_superadmin)):
    existing = await db.data_entry_tickets.find_one({"_id": ObjectId(ticket_id)})
    if not existing:
        raise HTTPException(404, "Ticket not found")
    upd = {k: v for k, v in req.model_dump().items() if v is not None}
    upd["updated_at"] = now_iso()
    note_changed = bool(upd.get("admin_notes")) and upd["admin_notes"] != existing.get("admin_notes", "")
    if note_changed:
        upd_msg = _message(user.get("name") or "Data-entry team", "admin", upd["admin_notes"], [])
        await db.data_entry_tickets.update_one({"_id": ObjectId(ticket_id)}, {"$push": {"messages": upd_msg}})
    await db.data_entry_tickets.update_one({"_id": ObjectId(ticket_id)}, {"$set": upd})
    parts = []
    if upd.get("status") and upd["status"] != existing.get("status"):
        parts.append(f"marked {upd['status'].replace('_', ' ')}")
    if note_changed:
        parts.append("a note was added by the data-entry team")
    if parts:
        await create_notification(existing["company_id"],
            f'Ticket "{existing.get("title")}" was ' + " and ".join(parts) + ".",
            str(existing["_id"]))
    item = await db.data_entry_tickets.find_one({"_id": ObjectId(ticket_id)})
    return clean(item)


@api.post("/admin/data-entry-tickets/{ticket_id}/messages")
async def admin_ticket_reply(ticket_id: str, req: TicketMessageReq, user: dict = Depends(require_superadmin)):
    t = await db.data_entry_tickets.find_one({"_id": _oid(ticket_id)})
    if not t:
        raise HTTPException(404, "Ticket not found")
    if not req.body.strip():
        raise HTTPException(400, "Message is empty")
    return await _append_message(t, _message(user.get("name") or "Data-entry team", "admin", req.body, req.attachments), True)


@api.get("/admin/files/{path:path}")
async def admin_download_file(path: str, user: dict = Depends(require_superadmin)):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(404, "File not found")
    return _serve_file(record, path)


# ---------- Integration API (Admin Control, API-key protected) ----------
INTEGRATION_API_KEY = os.environ.get("INTEGRATION_API_KEY")


async def require_integration_key(x_api_key: str = Header(None), authorization: str = Header(None)):
    supplied = x_api_key or (authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else None)
    if not INTEGRATION_API_KEY or not supplied or not secrets.compare_digest(supplied, INTEGRATION_API_KEY):
        raise HTTPException(401, "Invalid API key")


def _ticket_out(t: dict) -> dict:
    t = clean(t) if "_id" in t else t
    t["ticket_id"] = t["id"]
    return t


@api.get("/integration/clients", dependencies=[Depends(require_integration_key)])
async def integration_clients(scope: str = Query("all")):
    tickets = await db.data_entry_tickets.find({}).sort("_id", -1).to_list(5000)
    by_user: dict = {}
    for t in tickets:
        uid = t.get("created_by_id")
        if not uid:
            continue
        c = by_user.setdefault(uid, {"ticket_count": 0, "open_tickets": 0, "last_ticket_at": t.get("created_at")})
        c["ticket_count"] += 1
        if t.get("status") == "open":
            c["open_tickets"] += 1
    if scope == "ticket_creators":
        if not by_user:
            return []
        uq = {"_id": {"$in": [ObjectId(u) for u in by_user if ObjectId.is_valid(u)]}}
    else:
        uq = {"is_tester": {"$ne": True}}
    users = await db.users.find(uq).sort("_id", -1).to_list(10000)
    comps = {str(c["_id"]): c for c in await db.companies.find({"_id": {"$in": [ObjectId(u["company_id"]) for u in users if ObjectId.is_valid(u.get("company_id", ""))]}}).to_list(10000)}
    counts = {g["_id"]: g["n"] for g in await db.users.aggregate([{"$group": {"_id": "$company_id", "n": {"$sum": 1}}}]).to_list(10000)}
    return [client_record(u, comps.get(u.get("company_id"), {}), counts.get(u.get("company_id"), 0), by_user.get(str(u["_id"]))) for u in users]


@api.get("/integration/health", dependencies=[Depends(require_integration_key)])
async def integration_health():
    return {"ok": True, "users": await db.users.count_documents({}), "companies": await db.companies.count_documents({}),
            "tickets": await db.data_entry_tickets.count_documents({})}


@api.get("/integration/tickets", dependencies=[Depends(require_integration_key)])
async def integration_tickets(since: Optional[str] = Query(None), status: Optional[str] = Query(None)):
    q: dict = {}
    if since:
        q["$or"] = [{"created_at": {"$gte": since}}, {"updated_at": {"$gte": since}}]
    if status:
        q["status"] = status
    items = await db.data_entry_tickets.find(q).sort("_id", -1).to_list(5000)
    return [_ticket_out(t) for t in items]


@api.get("/integration/tickets/{ticket_id}", dependencies=[Depends(require_integration_key)])
async def integration_ticket(ticket_id: str):
    t = await db.data_entry_tickets.find_one({"_id": _oid(ticket_id)})
    if not t:
        raise HTTPException(404, "Ticket not found")
    return _ticket_out(t)


@api.put("/integration/tickets/{ticket_id}", dependencies=[Depends(require_integration_key)])
async def integration_update_ticket(ticket_id: str, req: AdminTicketUpdate):
    if req.status and req.status not in ("open", "in_progress", "completed", "closed"):
        raise HTTPException(400, "status must be open, in_progress, completed or closed")
    system = {"_id": "admin-control", "name": "Admin Control", "email": "admin-control", "role": "superadmin"}
    return await admin_update_ticket(ticket_id, req, system)


class IntegrationMessageReq(TicketMessageReq):
    author: str = "Admin Control"


@api.post("/integration/tickets/{ticket_id}/messages", dependencies=[Depends(require_integration_key)])
async def integration_ticket_reply(ticket_id: str, req: IntegrationMessageReq):
    t = await db.data_entry_tickets.find_one({"_id": _oid(ticket_id)})
    if not t:
        raise HTTPException(404, "Ticket not found")
    if not req.body.strip():
        raise HTTPException(400, "Message is empty")
    return _ticket_out(await _append_message(t, _message(req.author, "admin", req.body, req.attachments), True))


@api.get("/integration/files/{path:path}", dependencies=[Depends(require_integration_key)])
async def integration_download_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(404, "File not found")
    return _serve_file(record, path)


NOTIF_PREF_KEYS = ("clock_in", "clock_out", "schedule_change", "assignment", "missed_clock_in")
MANAGER_ONLY_TYPES = {"clock_in", "clock_out", "missed_clock_in"}


def user_prefs(user: dict) -> dict:
    return {k: bool((user.get("notification_prefs") or {}).get(k, True)) for k in NOTIF_PREF_KEYS}


class NotifPrefs(BaseModel):
    clock_in: bool = True
    clock_out: bool = True
    schedule_change: bool = True
    assignment: bool = True
    missed_clock_in: bool = True


@api.get("/notification-prefs")
async def get_notification_prefs(user: dict = Depends(require_not_archived)):
    return user_prefs(user)


@api.put("/notification-prefs")
async def set_notification_prefs(req: NotifPrefs, user: dict = Depends(require_role("owner", "foreman"))):
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"notification_prefs": req.model_dump()}})
    await log_audit(user["company_id"], user, "Updated notification preferences")
    return req.model_dump()


@api.get("/notifications")
async def list_notifications(user: dict = Depends(require_not_archived)):
    prefs = user_prefs(user)
    off = [k for k, v in prefs.items() if not v]
    if user.get("role") == "employee":
        off += list(MANAGER_ONLY_TYPES)
    q = {"company_id": user["company_id"]}
    if off:
        q["type"] = {"$nin": list(set(off))}
    items = await db.notifications.find(q).sort("_id", -1).limit(50).to_list(50)
    return [clean(i) for i in items]


@api.post("/notifications/{nid}/read")
async def read_notification(nid: str, user: dict = Depends(require_not_archived)):
    try:
        oid = ObjectId(nid)
    except Exception:
        raise HTTPException(400, "Invalid notification id")
    await db.notifications.update_one({"_id": oid, "company_id": user["company_id"]}, {"$set": {"read": True}})
    return {"status": "ok"}


@api.post("/notifications/read-all")
async def read_all_notifications(user: dict = Depends(require_not_archived)):
    await db.notifications.update_many({"company_id": user["company_id"], "read": False}, {"$set": {"read": True}})
    return {"status": "ok"}


# ---------- Audit logs ----------
def _audit_query(company_id: str, start: Optional[str], end: Optional[str]) -> dict:
    q = {"company_id": company_id}
    rng = {}
    if start:
        rng["$gte"] = f"{start}T00:00:00"
    if end:
        rng["$lte"] = f"{end}T23:59:59.999999"
    if rng:
        q["created_at"] = rng
    return q


@api.get("/audit-logs")
async def list_audit_logs(start: Optional[str] = None, end: Optional[str] = None, user: dict = Depends(require_role("owner"))):
    q = _audit_query(user["company_id"], start, end)
    items = await db.audit_logs.find(q).sort("created_at", -1).limit(1000).to_list(1000)
    return [clean(i) for i in items]


def _csv_safe(v) -> str:
    s = str(v if v is not None else "")
    return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s


@api.get("/audit-logs/export")
async def export_audit_logs(start: Optional[str] = None, end: Optional[str] = None, user: dict = Depends(require_role("owner"))):
    q = _audit_query(user["company_id"], start, end)
    items = await db.audit_logs.find(q).sort("created_at", -1).to_list(100000)
    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_ALL)
    writer.writerow(["Timestamp", "User", "Action"])
    for i in items:
        writer.writerow([_csv_safe(i.get("created_at", "")), _csv_safe(i.get("user_name", "")), _csv_safe(i.get("action", ""))])
    filename = f"audit_logs_{start or 'all'}_to_{end or 'all'}.csv"
    return StarletteResponse(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api.get("/admin/stats")
async def admin_stats(user: dict = Depends(require_superadmin)):
    companies = await db.companies.count_documents({})
    users = await db.users.count_documents({})
    tickets = await db.data_entry_tickets.count_documents({})
    open_tickets = await db.data_entry_tickets.count_documents({"status": "open"})
    return {"companies": companies, "users": users, "tickets": tickets, "open_tickets": open_tickets}


# ---------- Payments ----------
class CheckoutRequest(BaseModel):
    plan: str
    origin_url: str


@api.get("/plans")
async def get_plans():
    return PLAN_LIMITS


@api.post("/payments/checkout")
async def create_checkout(req: CheckoutRequest, user: dict = Depends(require_role("owner"))):
    plan = PLAN_LIMITS.get(req.plan)
    if not plan:
        raise HTTPException(400, "Invalid plan")
    prices = stripe.Price.list(lookup_keys=[plan["lookup_key"]], active=True, limit=1).data
    if not prices:
        raise HTTPException(500, f"Price not found: {plan['lookup_key']}")
    price = prices[0]
    session = stripe.checkout.Session.create(
        line_items=[{"price": price.id, "quantity": 1}],
        mode="subscription",
        success_url=f"{req.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{req.origin_url}/membership",
        metadata={"user_id": str(user["_id"]), "company_id": user["company_id"], "plan": req.plan},
        managed_payments={"enabled": True},
    )
    await db.payment_transactions.insert_one({
        "session_id": session.id, "user_id": str(user["_id"]), "company_id": user["company_id"],
        "plan": req.plan, "amount": (price.unit_amount or 0) / 100, "currency": price.currency,
        "status": "initiated", "payment_status": "pending", "created_at": now_iso(), "updated_at": now_iso(),
    })
    return {"checkout_url": session.url, "session_id": session.id}


@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id})
    if not record:
        raise HTTPException(404, "Transaction not found")
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid", "updated_at": now_iso()}})
                await _fulfil_payment(record)
                record = await db.payment_transactions.find_one({"session_id": session_id})
        except stripe.error.StripeError:
            pass
    return {"session_id": record["session_id"], "status": record["status"], "payment_status": record["payment_status"], "plan": record.get("plan"), "kind": record.get("kind")}


@api.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(400, "Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        rec = await db.payment_transactions.find_one({"session_id": obj["id"]})
        await db.payment_transactions.update_one(
            {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": obj.get("payment_status", "paid"), "updated_at": now_iso()}})
        if rec:
            await _fulfil_payment(rec)
        else:
            await _fulfil_payment_link(obj)
    return {"status": "ok"}


async def _fulfil_payment_link(session: dict):
    # Static Stripe Payment Links create no local record: match the payer's email to an owner and infer the plan.
    email = ((session.get("customer_details") or {}).get("email") or session.get("customer_email") or "").lower()
    if not email:
        return
    owner = await db.users.find_one({"email": email, "role": "owner"})
    if not owner:
        return
    amount = (session.get("amount_total") or 0) / 100
    plan = next((k for k, v in PLAN_LIMITS.items() if abs(v["monthly"] - amount) < 0.01), None)
    if not plan:
        try:
            items = stripe.checkout.Session.list_line_items(session["id"], limit=1).data
            lk = (items[0].price.lookup_key or "") if items else ""
            plan = next((k for k, v in PLAN_LIMITS.items() if v["lookup_key"] == lk), None)
        except stripe.error.StripeError:
            plan = None
    if not plan:
        logger.warning(f"payment link session {session.get('id')} for {email}: could not infer plan")
        return
    await db.payment_transactions.insert_one({"session_id": session["id"], "kind": "subscription", "plan": plan, "company_id": owner["company_id"],
                                              "amount": amount, "currency": session.get("currency", "usd"), "status": "completed",
                                              "payment_status": "paid", "source": "payment_link", "created_at": now_iso(), "updated_at": now_iso()})
    await db.companies.update_one({"_id": ObjectId(owner["company_id"])},
                                  {"$set": {"plan": plan, "membership_status": "active", "membership_since": now_iso()},
                                   "$unset": {"archived_at": "", "trial_ended_email_sent": ""}})
    await log_audit(owner["company_id"], owner, f"Membership activated via payment link: {plan}")


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.messages.create_index([("company_id", 1), ("job_id", 1), ("_id", -1)])
    await db.timecards.create_index([("company_id", 1), ("created_at", -1)])
    await db.timecards.create_index([("company_id", 1), ("clock_out", 1)])
    await db.audit_logs.create_index([("company_id", 1), ("created_at", -1)])
    for c in ("jobs", "employees", "vehicles", "equipment", "estimates"):
        await db[c].create_index("company_id")
    try:
        init_storage()
    except Exception as e:
        logger.error(f"storage init failed {e}")
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        comp = await db.companies.insert_one({"name": "Jones Construction Co.", "plan": "medium", "membership_status": "active", "trade": "General", "created_at": now_iso()})
        await db.users.insert_one({"email": admin_email, "password_hash": hash_password(admin_password),
                                   "name": "Robin Jones", "role": "owner", "is_superadmin": True, "company_id": str(comp.inserted_id), "created_at": now_iso()})
    else:
        upd = {}
        if not verify_password(admin_password, existing["password_hash"]):
            upd["password_hash"] = hash_password(admin_password)
        if not existing.get("is_superadmin"):
            upd["is_superadmin"] = True
        if existing.get("role") != "owner":
            upd["role"] = "owner"
        if upd:
            await db.users.update_one({"email": admin_email}, {"$set": upd})
    await seed_tester()


async def seed_tester():
    email = os.environ.get("TESTER_EMAIL")
    password = os.environ.get("TESTER_PASSWORD")
    if not email or not password:
        return
    email = email.lower()
    active = {"plan": "large", "membership_status": "active", "membership_since": now_iso(), "is_tester": True}
    existing = await db.users.find_one({"email": email})
    if existing is None:
        comp = await db.companies.insert_one({"name": "Tester Construction LLC", "trade": "General", "created_at": now_iso(), **active})
        await db.users.insert_one({"email": email, "password_hash": hash_password(password), "name": "App Tester", "role": "owner",
                                   "is_superadmin": False, "company_id": str(comp.inserted_id), "created_at": now_iso()})
        return
    if not verify_password(password, existing["password_hash"]):
        await db.users.update_one({"_id": existing["_id"]}, {"$set": {"password_hash": hash_password(password)}})
    await db.companies.update_one({"_id": ObjectId(existing["company_id"])}, {"$set": active})


@app.on_event("shutdown")
async def shutdown():
    client.close()
