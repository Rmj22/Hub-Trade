from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import csv
import uuid
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated

import bcrypt
import jwt
import stripe
import httpx
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Header, Query
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import Response as StarletteResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, BeforeValidator, ConfigDict
from bson import ObjectId

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


def require_role(*roles):
    async def dep(user: dict = Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return dep


async def require_superadmin(user: dict = Depends(get_current_user)):
    if not user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Admin access only")
    return user


def set_cookies(response: Response, token: str):
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")


# ---------- Auth models ----------
class RegisterReq(BaseModel):
    email: EmailStr
    password: str
    name: str
    company_name: str


class LoginReq(BaseModel):
    email: EmailStr
    password: str


# ---------- Auth endpoints ----------
@api.post("/auth/register")
async def register(req: RegisterReq, response: Response):
    email = req.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    company = {"name": req.company_name, "plan": None, "membership_status": "inactive", "trade": "General", "created_at": now_iso()}
    comp_res = await db.companies.insert_one(company)
    company_id = str(comp_res.inserted_id)
    user_doc = {"email": email, "password_hash": hash_password(req.password), "name": req.name,
                "role": "owner", "company_id": company_id, "created_at": now_iso()}
    res = await db.users.insert_one(user_doc)
    token = create_access_token(str(res.inserted_id), email)
    set_cookies(response, token)
    user_doc["_id"] = res.inserted_id
    return clean(user_doc)


@api.post("/auth/login")
async def login(req: LoginReq, response: Response):
    email = req.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
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
async def me(user: dict = Depends(get_current_user)):
    out = clean(user)
    if user.get("company_id"):
        comp = await db.companies.find_one({"_id": ObjectId(user["company_id"])})
        out["company"] = clean(comp) if comp else None
    return out


# ---------- Generic CRUD factory for company-scoped resources ----------
async def scope(user):
    return user["company_id"]


class Job(BaseModel):
    name: str
    address: str = ""
    customer_name: str = ""
    status: str = "active"  # active, behind, completed
    due_date: Optional[str] = None
    description: str = ""
    assigned_employees: List[str] = []
    assigned_vehicles: List[str] = []
    assigned_equipment: List[str] = []
    material_cost: float = 0
    onsite_purchases: float = 0


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
    type: str = "Truck"
    status: str = "available"  # available, in-use
    oil_change_date: Optional[str] = None
    tire_rotation_date: Optional[str] = None
    registration_expiry: Optional[str] = None
    insurance_expiry: Optional[str] = None
    inspection_date: Optional[str] = None
    hours_used: float = 0


class Equipment(BaseModel):
    name: str
    category: str = "General"
    trade: str = "General"
    condition: str = ""
    location: str = ""
    status: str = "available"  # available, assigned
    inspection_date: Optional[str] = None
    service_reminder: Optional[str] = None
    hours_used: float = 0
    repair_history: List[dict] = []


class Estimate(BaseModel):
    customer_name: str
    customer_email: str = ""
    job_id: Optional[str] = None
    line_items: List[dict] = []  # {desc, qty, unit_price}
    notes: str = ""
    photos: List[str] = []
    status: str = "draft"  # draft, sent


class MessageReq(BaseModel):
    text: str
    job_id: Optional[str] = None


class TimeCardAction(BaseModel):
    employee_id: str
    job_id: Optional[str] = None


def crud_router(name: str, collection: str, Model, create_roles=("owner", "foreman")):
    r = APIRouter()

    @r.get(f"/{name}")
    async def list_items(user: dict = Depends(get_current_user)):
        items = await db[collection].find({"company_id": user["company_id"]}).sort("_id", -1).to_list(1000)
        return [clean(i) for i in items]

    label = name[:-1] if name.endswith("s") else name

    @r.post(f"/{name}")
    async def create_item(payload: Model, user: dict = Depends(require_role(*create_roles))):
        doc = payload.model_dump()
        doc["company_id"] = user["company_id"]
        doc["created_at"] = now_iso()
        res = await db[collection].insert_one(doc)
        doc["_id"] = res.inserted_id
        await log_audit(user["company_id"], user, f"Created {label}: {doc.get('name', '')}".strip())
        return clean(doc)

    @r.get(f"/{name}/{{item_id}}")
    async def get_item(item_id: str, user: dict = Depends(get_current_user)):
        item = await db[collection].find_one({"_id": ObjectId(item_id), "company_id": user["company_id"]})
        if not item:
            raise HTTPException(404, "Not found")
        return clean(item)

    @r.put(f"/{name}/{{item_id}}")
    async def update_item(item_id: str, payload: Model, user: dict = Depends(require_role(*create_roles))):
        doc = payload.model_dump()
        await db[collection].update_one({"_id": ObjectId(item_id), "company_id": user["company_id"]}, {"$set": doc})
        item = await db[collection].find_one({"_id": ObjectId(item_id)})
        await log_audit(user["company_id"], user, f"Updated {label}: {doc.get('name', '')}".strip())
        return clean(item)

    @r.delete(f"/{name}/{{item_id}}")
    async def delete_item(item_id: str, user: dict = Depends(require_role("owner"))):
        gone = await db[collection].find_one({"_id": ObjectId(item_id), "company_id": user["company_id"]})
        await db[collection].delete_one({"_id": ObjectId(item_id), "company_id": user["company_id"]})
        await log_audit(user["company_id"], user, f"Deleted {label}: {gone.get('name', '') if gone else ''}".strip())
        return {"status": "deleted"}

    return r


api.include_router(crud_router("jobs", "jobs", Job))
api.include_router(crud_router("employees", "employees", Employee, create_roles=("owner",)))
api.include_router(crud_router("vehicles", "vehicles", Vehicle))
api.include_router(crud_router("equipment", "equipment", Equipment))


# ---------- Estimates (custom for email) ----------
@api.get("/estimates")
async def list_estimates(user: dict = Depends(get_current_user)):
    items = await db.estimates.find({"company_id": user["company_id"]}).sort("_id", -1).to_list(1000)
    return [clean(i) for i in items]


@api.post("/estimates")
async def create_estimate(payload: Estimate, user: dict = Depends(require_role("owner", "foreman"))):
    doc = payload.model_dump()
    doc["company_id"] = user["company_id"]
    doc["total"] = sum(li.get("qty", 1) * li.get("unit_price", 0) for li in payload.line_items)
    doc["created_at"] = now_iso()
    res = await db.estimates.insert_one(doc)
    doc["_id"] = res.inserted_id
    await log_audit(user["company_id"], user, f"Created estimate for {payload.customer_name}")
    return clean(doc)


@api.put("/estimates/{item_id}")
async def update_estimate(item_id: str, payload: Estimate, user: dict = Depends(require_role("owner", "foreman"))):
    doc = payload.model_dump()
    doc["total"] = sum(li.get("qty", 1) * li.get("unit_price", 0) for li in payload.line_items)
    await db.estimates.update_one({"_id": ObjectId(item_id), "company_id": user["company_id"]}, {"$set": doc})
    item = await db.estimates.find_one({"_id": ObjectId(item_id)})
    return clean(item)


@api.delete("/estimates/{item_id}")
async def delete_estimate(item_id: str, user: dict = Depends(require_role("owner"))):
    await db.estimates.delete_one({"_id": ObjectId(item_id), "company_id": user["company_id"]})
    return {"status": "deleted"}


@api.post("/estimates/{item_id}/send")
async def send_estimate(item_id: str, user: dict = Depends(require_role("owner", "foreman"))):
    est = await db.estimates.find_one({"_id": ObjectId(item_id), "company_id": user["company_id"]})
    if not est:
        raise HTTPException(404, "Estimate not found")
    if not est.get("customer_email"):
        raise HTTPException(400, "Customer email required")
    comp = await db.companies.find_one({"_id": ObjectId(user["company_id"])})
    rows = "".join(
        f"<tr><td style='padding:8px;border-bottom:1px solid #eee'>{li.get('desc','')}</td>"
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
      <p style='color:#555'>{est.get('notes','')}</p>
      </td></tr>
    </table>"""
    payload = {"to": [est["customer_email"]], "subject": f"Your estimate from {comp.get('name','Hub Trade')}", "html": html, "from_name": EMAIL_FROM_NAME}
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            resp = await c.post(f"{EMAIL_BASE_URL}/api/v1/email/send", headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
    except Exception as e:
        logger.error(f"email failed {e}")
        raise HTTPException(502, "Failed to send email")
    await db.estimates.update_one({"_id": ObjectId(item_id)}, {"$set": {"status": "sent", "sent_at": now_iso()}})
    await log_audit(user["company_id"], user, f"Sent estimate to {est.get('customer_email')}")
    return {"status": "sent"}


# ---------- File upload ----------
@api.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    path = f"{APP_NAME}/{user['company_id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    result = put_object(path, data, file.content_type or "application/octet-stream")
    await db.files.insert_one({"storage_path": result["path"], "content_type": file.content_type,
                               "company_id": user["company_id"], "is_deleted": False, "created_at": now_iso()})
    return {"path": result["path"]}


@api.get("/files/{path:path}")
async def download_file(path: str, auth: str = Query(None), authorization: str = Header(None)):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(404, "File not found")
    data, ct = get_object(path)
    return StarletteResponse(content=data, media_type=record.get("content_type", ct))


# ---------- Time cards ----------
@api.post("/timecards/clock-in")
async def clock_in(req: TimeCardAction, user: dict = Depends(get_current_user)):
    existing = await db.timecards.find_one({"employee_id": req.employee_id, "company_id": user["company_id"], "clock_out": None})
    if existing:
        raise HTTPException(400, "Already clocked in")
    doc = {"employee_id": req.employee_id, "job_id": req.job_id, "company_id": user["company_id"],
           "clock_in": now_iso(), "clock_out": None, "created_at": now_iso()}
    res = await db.timecards.insert_one(doc)
    doc["_id"] = res.inserted_id
    emp = await db.employees.find_one({"_id": ObjectId(req.employee_id)}) if ObjectId.is_valid(req.employee_id) else None
    await log_audit(user["company_id"], user, f"Clocked in {emp.get('name') if emp else 'employee'}")
    return clean(doc)


@api.post("/timecards/clock-out")
async def clock_out(req: TimeCardAction, user: dict = Depends(get_current_user)):
    tc = await db.timecards.find_one({"employee_id": req.employee_id, "company_id": user["company_id"], "clock_out": None})
    if not tc:
        raise HTTPException(400, "Not clocked in")
    ci = datetime.fromisoformat(tc["clock_in"])
    out = datetime.now(timezone.utc)
    hours = round((out - ci).total_seconds() / 3600, 2)
    await db.timecards.update_one({"_id": tc["_id"]}, {"$set": {"clock_out": out.isoformat(), "hours": hours}})
    tc = await db.timecards.find_one({"_id": tc["_id"]})
    emp = await db.employees.find_one({"_id": ObjectId(req.employee_id)}) if ObjectId.is_valid(req.employee_id) else None
    await log_audit(user["company_id"], user, f"Clocked out {emp.get('name') if emp else 'employee'} ({hours}h)")
    return clean(tc)


@api.get("/timecards")
async def list_timecards(user: dict = Depends(get_current_user)):
    items = await db.timecards.find({"company_id": user["company_id"]}).sort("_id", -1).to_list(1000)
    return [clean(i) for i in items]


@api.get("/timecards/active")
async def active_timecards(user: dict = Depends(get_current_user)):
    items = await db.timecards.find({"company_id": user["company_id"], "clock_out": None}).to_list(1000)
    return [clean(i) for i in items]


# ---------- Messages ----------
@api.get("/messages")
async def list_messages(job_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"company_id": user["company_id"]}
    if job_id:
        q["job_id"] = job_id
    items = await db.messages.find(q).sort("_id", -1).limit(100).to_list(100)
    return list(reversed([clean(i) for i in items]))


@api.post("/messages")
async def post_message(req: MessageReq, user: dict = Depends(get_current_user)):
    doc = {"text": req.text, "job_id": req.job_id, "company_id": user["company_id"],
           "author_name": user["name"], "author_role": user["role"], "created_at": now_iso()}
    res = await db.messages.insert_one(doc)
    doc["_id"] = res.inserted_id
    return clean(doc)


# ---------- Dashboard & reports ----------
@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    cid = user["company_id"]
    jobs = await db.jobs.find({"company_id": cid}).to_list(1000)
    active_jobs = [j for j in jobs if j.get("status") == "active"]
    behind_jobs = [j for j in jobs if j.get("status") == "behind"]
    completed_jobs = [j for j in jobs if j.get("status") == "completed"]
    active_tcs = await db.timecards.find({"company_id": cid, "clock_out": None}).to_list(1000)
    vehicles = await db.vehicles.find({"company_id": cid}).to_list(1000)
    equipment = await db.equipment.find({"company_id": cid}).to_list(1000)
    estimates = await db.estimates.find({"company_id": cid}).to_list(1000)
    employees = await db.employees.find({"company_id": cid}).to_list(1000)
    tickets = await db.data_entry_tickets.find({"company_id": cid}).to_list(1000)
    comp = await db.companies.find_one({"_id": ObjectId(cid)})
    plan = PLAN_LIMITS.get((comp or {}).get("plan") or "", {})
    data_hours = plan.get("data_hours", 0)
    used = sum(t.get("hours_requested", 0) for t in tickets)
    recent_updates = sorted(
        [t for t in tickets if t.get("updated_at") and (t.get("admin_notes") or t.get("status") != "open")],
        key=lambda t: t["updated_at"], reverse=True)[:5]
    unread = await db.notifications.count_documents({"company_id": cid, "read": False})
    return {
        "active_jobs": len(active_jobs),
        "jobs_behind": len(behind_jobs),
        "completed_jobs": len(completed_jobs),
        "clocked_in": len(active_tcs),
        "clocked_in_ids": [t["employee_id"] for t in active_tcs],
        "vehicles_in_use": len([v for v in vehicles if v.get("status") == "in-use"]),
        "equipment_assigned": len([e for e in equipment if e.get("status") == "assigned"]),
        "total_vehicles": len(vehicles),
        "total_equipment": len(equipment),
        "total_employees": len(employees),
        "upcoming_estimates": len([e for e in estimates if e.get("status") == "draft"]),
        "active_jobs_list": [clean(j) for j in active_jobs[:6]],
        "data_hours_total": data_hours,
        "data_hours_used": round(used, 1),
        "data_hours_remaining": round(max(data_hours - used, 0), 1),
        "unread_notifications": unread,
        "recent_ticket_updates": [clean(t) for t in recent_updates],
    }


@api.get("/reports/weekly")
async def weekly_report(user: dict = Depends(get_current_user)):
    cid = user["company_id"]
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    tcs = await db.timecards.find({"company_id": cid, "created_at": {"$gte": week_ago.isoformat()}}).to_list(2000)
    labor_hours = 0.0
    for t in tcs:
        if t.get("clock_out") and t.get("created_at"):
            try:
                if datetime.fromisoformat(t["created_at"]) >= week_ago:
                    labor_hours += t.get("hours", 0)
            except Exception:
                pass
    jobs = await db.jobs.find({"company_id": cid}).to_list(1000)
    vehicles = await db.vehicles.find({"company_id": cid}).to_list(1000)
    equipment = await db.equipment.find({"company_id": cid}).to_list(1000)
    employees = await db.employees.find({"company_id": cid}).to_list(1000)
    labor_cost = 0.0
    emp_map = {str(e["_id"]): e.get("hourly_rate", 0) for e in employees}
    for t in tcs:
        if t.get("clock_out"):
            labor_cost += t.get("hours", 0) * emp_map.get(t.get("employee_id"), 0)
    return {
        "labor_hours": round(labor_hours, 1),
        "labor_cost": round(labor_cost, 2),
        "equipment_hours": round(sum(e.get("hours_used", 0) for e in equipment), 1),
        "vehicle_hours": round(sum(v.get("hours_used", 0) for v in vehicles), 1),
        "completed_jobs": len([j for j in jobs if j.get("status") == "completed"]),
        "material_cost": round(sum(j.get("material_cost", 0) + j.get("onsite_purchases", 0) for j in jobs), 2),
    }


@api.get("/jobs/{job_id}/cost")
async def job_cost(job_id: str, user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"_id": ObjectId(job_id), "company_id": user["company_id"]})
    if not job:
        raise HTTPException(404, "Job not found")
    tcs = await db.timecards.find({"company_id": user["company_id"], "job_id": job_id, "clock_out": {"$ne": None}}).to_list(1000)
    employees = await db.employees.find({"company_id": user["company_id"]}).to_list(1000)
    emp_map = {str(e["_id"]): e.get("hourly_rate", 0) for e in employees}
    labor_hours = sum(t.get("hours", 0) for t in tcs)
    labor_cost = sum(t.get("hours", 0) * emp_map.get(t.get("employee_id"), 0) for t in tcs)
    material = job.get("material_cost", 0)
    onsite = job.get("onsite_purchases", 0)
    return {"labor_hours": round(labor_hours, 1), "labor_cost": round(labor_cost, 2),
            "material_cost": material, "onsite_purchases": onsite,
            "total": round(labor_cost + material + onsite, 2)}


# ---------- Team members (create foreman/employee accounts) ----------
class TeamMemberReq(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str  # foreman or employee


@api.get("/team")
async def list_team(user: dict = Depends(get_current_user)):
    members = await db.users.find({"company_id": user["company_id"]}).to_list(1000)
    return [clean(m) for m in members]


@api.post("/team")
async def add_team(req: TeamMemberReq, user: dict = Depends(require_role("owner"))):
    if req.role not in ("owner", "foreman", "employee"):
        raise HTTPException(400, "Invalid role")
    email = req.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    doc = {"email": email, "password_hash": hash_password(req.password), "name": req.name,
           "role": req.role, "company_id": user["company_id"], "created_at": now_iso()}
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    await log_audit(user["company_id"], user, f"Added team member {req.name} ({req.role})")
    return clean(doc)


class RoleUpdateReq(BaseModel):
    role: str


@api.put("/team/{user_id}/role")
async def update_role(user_id: str, req: RoleUpdateReq, user: dict = Depends(require_role("owner"))):
    if req.role not in ("owner", "foreman", "employee"):
        raise HTTPException(400, "Invalid role")
    target = await db.users.find_one({"_id": ObjectId(user_id), "company_id": user["company_id"]})
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


@api.get("/data-entry-tickets")
async def list_tickets(user: dict = Depends(get_current_user)):
    items = await db.data_entry_tickets.find({"company_id": user["company_id"]}).sort("_id", -1).to_list(1000)
    return [clean(i) for i in items]


@api.post("/data-entry-tickets")
async def create_ticket(req: DataEntryTicketReq, user: dict = Depends(get_current_user)):
    comp = await db.companies.find_one({"_id": ObjectId(user["company_id"])})
    doc = {**req.model_dump(), "company_id": user["company_id"],
           "company_name": comp.get("name") if comp else "",
           "created_by": user["name"], "created_by_id": str(user["_id"]),
           "status": "open", "admin_notes": "", "created_at": now_iso()}
    res = await db.data_entry_tickets.insert_one(doc)
    doc["_id"] = res.inserted_id
    await log_audit(user["company_id"], user, f"Submitted data-entry ticket: {req.title}")
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
    await db.data_entry_tickets.update_one({"_id": ObjectId(ticket_id)}, {"$set": upd})
    parts = []
    if upd.get("status") and upd["status"] != existing.get("status"):
        parts.append(f"marked {upd['status'].replace('_', ' ')}")
    if upd.get("admin_notes") and upd["admin_notes"] != existing.get("admin_notes", ""):
        parts.append("a note was added by the data-entry team")
    if parts:
        await create_notification(existing["company_id"],
            f'Ticket "{existing.get("title")}" was ' + " and ".join(parts) + ".",
            str(existing["_id"]))
    item = await db.data_entry_tickets.find_one({"_id": ObjectId(ticket_id)})
    return clean(item)


@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find({"company_id": user["company_id"]}).sort("_id", -1).limit(50).to_list(50)
    return [clean(i) for i in items]


@api.post("/notifications/{nid}/read")
async def read_notification(nid: str, user: dict = Depends(get_current_user)):
    try:
        oid = ObjectId(nid)
    except Exception:
        raise HTTPException(400, "Invalid notification id")
    await db.notifications.update_one({"_id": oid, "company_id": user["company_id"]}, {"$set": {"read": True}})
    return {"status": "ok"}


@api.post("/notifications/read-all")
async def read_all_notifications(user: dict = Depends(get_current_user)):
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


@api.get("/audit-logs/export")
async def export_audit_logs(start: Optional[str] = None, end: Optional[str] = None, user: dict = Depends(require_role("owner"))):
    q = _audit_query(user["company_id"], start, end)
    items = await db.audit_logs.find(q).sort("created_at", -1).to_list(100000)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Timestamp", "User", "Action"])
    for i in items:
        writer.writerow([i.get("created_at", ""), i.get("user_name", ""), i.get("action", "")])
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
                await db.companies.update_one({"_id": ObjectId(record["company_id"])},
                    {"$set": {"plan": record["plan"], "membership_status": "active", "membership_since": now_iso()}})
                record = await db.payment_transactions.find_one({"session_id": session_id})
        except stripe.error.StripeError:
            pass
    return {"session_id": record["session_id"], "status": record["status"], "payment_status": record["payment_status"], "plan": record.get("plan")}


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
            await db.companies.update_one({"_id": ObjectId(rec["company_id"])},
                {"$set": {"plan": rec["plan"], "membership_status": "active", "membership_since": now_iso()}})
    return {"status": "ok"}


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


@app.on_event("shutdown")
async def shutdown():
    client.close()
