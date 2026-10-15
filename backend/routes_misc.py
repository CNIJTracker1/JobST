"""Analytics, reminders, quotes, CareerNiche Hub, business leads, weekly report and demo data."""
import random
from datetime import timedelta
from typing import Literal, Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr, Field

from catalog import CAREERNICHE_URL, HUB_ARTICLES, HUB_RESOURCES, HUB_SERVICES, PIPELINE, QUOTES, STATUS_RANK
from core import (
    CRON_SECRET,
    FRONTEND_URL,
    clean,
    day_start,
    get_current_user,
    get_db,
    new_id,
    now_utc,
    parse_dt,
    user_tz,
    week_start,
)
from emailer import send_email, weekly_report_email
from rewards import points_summary

router = APIRouter()


# ── Analytics (port of analytics_screen.dart, extended) ───────────────────────
def _reached(job, stage):
    return STATUS_RANK.get(job.get("highest_status") or job["status"], -1) >= STATUS_RANK[stage]


def _pct(a, b):
    return round(a / b * 100, 1) if b else None


@router.get("/analytics")
async def analytics(weeks: int = 8, user=Depends(get_current_user)):
    db = get_db()
    jobs = [j for j in await db.jobs.find({"user_id": user["id"]}).to_list(10000) if j["status"] != "Deleted"]
    total = len(jobs)
    by_status = {s: 0 for s in PIPELINE + ["Archived"]}
    for j in jobs:
        by_status[j["status"]] = by_status.get(j["status"], 0) + 1
    funnel = {s: sum(1 for j in jobs if _reached(j, s)) for s in PIPELINE}
    applied, interviewed, offered = funnel["Applied"], funnel["Interviewed"], funnel["Offered"]
    accepted = sum(1 for j in jobs if j.get("complete") is True)

    weeks = max(4, min(weeks, 26))
    this_week = week_start(user)
    buckets = [this_week - timedelta(weeks=i) for i in range(weeks - 1, -1, -1)]
    activity = await db.activity.find({"user_id": user["id"]}).to_list(100000)
    series = []
    for start in buckets:
        end = start + timedelta(weeks=1)
        rows = [a for a in activity if start <= parse_dt(a["created_at"]) < end]
        series.append(
            {
                "week_start": start.astimezone(user_tz(user)).date().isoformat(),
                "applications": sum(1 for a in rows if a["action"] == "apply"),
                "interviews": sum(1 for a in rows if a["action"] == "interview"),
                "networking": sum(1 for a in rows if a["action"] == "contacts"),
                "points": sum(a.get("points", 0) for a in rows),
            }
        )
    active = [j for j in jobs if j["status"] in PIPELINE]
    top = sorted(active, key=lambda j: (j.get("priority_score") or 0, j.get("compare_score") or 0), reverse=True)[:5]
    return {
        "total": total,
        "by_status": by_status,
        "funnel": funnel,
        "overall_progress": _pct(applied, total),
        "interview_rate": _pct(interviewed, total),
        "offer_rate": _pct(offered, total),
        "response_rate": _pct(interviewed, applied),
        "conversion_rate": _pct(offered, applied),
        "offers_accepted": accepted,
        "weekly": series,
        "top_priority": [clean(j) for j in top],
    }


# ── Reminders (replaces flutter_local_notifications) ──────────────────────────
@router.get("/notifications")
async def notifications(user=Depends(get_current_user)):
    db = get_db()
    now = now_utc()
    soon = now + timedelta(days=7)
    items = []
    jobs = {j["id"]: j for j in await db.jobs.find({"user_id": user["id"], "status": {"$nin": ["Deleted", "Archived"]}}).to_list(5000)}
    for iv in await db.interviews.find({"user_id": user["id"]}).to_list(2000):
        when = parse_dt(iv.get("interview_date"))
        job = jobs.get(iv["job_id"])
        if when and job and now - timedelta(hours=2) <= when <= soon:
            items.append({"id": f"iv-{iv['id']}", "kind": "interview", "title": f"{iv['interview_type']} · {job['company_name']}", "body": job["job_name"], "at": when.isoformat(), "job_id": job["id"]})
    for c in await db.contacts.find({"user_id": user["id"]}).to_list(5000):
        when = parse_dt(c.get("next_touchpoint"))
        if when and when <= soon:
            items.append({"id": f"ct-{c['id']}", "kind": "touchpoint", "title": f"Reach out to {c['contact_name']}", "body": c.get("company") or c.get("job_title") or "", "at": when.isoformat(), "contact_id": c["id"], "overdue": when < day_start(user)})
    for j in jobs.values():
        if j["status"] == "Applied":
            last = parse_dt(j.get("last_follow_up_at")) or parse_dt(j.get("updated_at"))
            if last and now - last > timedelta(days=7):
                items.append({"id": f"fu-{j['id']}", "kind": "follow_up", "title": f"Follow up with {j['company_name']}", "body": f"No update on {j['job_name']} for {(now - last).days} days", "at": now.isoformat(), "job_id": j["id"]})
    items.sort(key=lambda i: i["at"])
    s = user.get("settings", {})
    return {"items": items, "daily_reminder": s.get("daily_reminder", True), "reminder_time": s.get("reminder_time", "09:00"), "quote_notification": s.get("quote_notification", True)}


# ── Quote of the day (QuoteService: API → fallback list) ──────────────────────
@router.get("/quote")
async def quote():
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            resp = await client.get("https://zenquotes.io/api/random")
        data = resp.json()[0]
        if data.get("q") and "Too many requests" not in data["q"]:
            return {"text": data["q"], "author": data.get("a", "Unknown"), "source": "zenquotes"}
    except Exception:
        pass
    text, author = random.choice(QUOTES)
    return {"text": text, "author": author, "source": "fallback"}


# ── CareerNiche Hub (cn_services.dart + cn_resources.dart) ────────────────────
class InterestIn(BaseModel):
    item_id: str
    kind: Literal["service", "resource", "article"]


@router.get("/hub")
async def hub(user=Depends(get_current_user)):
    interested = {r["item_id"] for r in await get_db().hub_interest.find({"user_id": user["id"]}).to_list(500)}
    tag = lambda items: [{**i, "notify": i["id"] in interested} for i in items]
    return {"services": tag(HUB_SERVICES), "resources": tag(HUB_RESOURCES), "articles": tag(HUB_ARTICLES), "website": CAREERNICHE_URL}


@router.post("/hub/notify")
async def hub_notify(body: InterestIn, user=Depends(get_current_user)):
    await get_db().hub_interest.update_one(
        {"user_id": user["id"], "item_id": body.item_id},
        {"$set": {"user_id": user["id"], "item_id": body.item_id, "kind": body.kind, "email": user["email"], "created_at": now_utc()}},
        upsert=True,
    )
    return {"ok": True}


# ── Public: landing page lead capture (job seekers + businesses) ──────────────
class LeadIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    kind: Literal["business", "seeker"] = "business"
    company: Optional[str] = ""
    message: Optional[str] = Field(default="", max_length=2000)


@router.post("/leads")
async def create_lead(body: LeadIn):
    await get_db().leads.insert_one({"id": new_id(), **body.model_dump(), "created_at": now_utc()})
    return {"ok": True}


# ── Weekly report (port of supabase/functions/weekly-report) ──────────────────
async def _report_stats(user):
    jobs = [j for j in await get_db().jobs.find({"user_id": user["id"]}).to_list(10000) if j["status"] != "Deleted"]
    by_status = {}
    for j in jobs:
        by_status[j["status"]] = by_status.get(j["status"], 0) + 1
    w0 = week_start(user)
    applied_week = await get_db().activity.count_documents({"user_id": user["id"], "action": "apply", "created_at": {"$gte": w0}})
    top = sorted([j for j in jobs if j["status"] in PIPELINE], key=lambda j: j.get("priority_score") or 0, reverse=True)[:5]
    local = now_utc().astimezone(user_tz(user))
    return {
        "total": len(jobs),
        "by_status": by_status,
        "applied_this_week": applied_week,
        "points_this_week": (await points_summary(user))["weekly"],
        "top_jobs": top,
        "week_label": f"the week of {w0.astimezone(user_tz(user)).strftime('%b %d')} – {local.strftime('%b %d, %Y')}",
    }


@router.get("/reports/weekly/preview", response_class=HTMLResponse)
async def weekly_preview(user=Depends(get_current_user)):
    return weekly_report_email(user["username"], await _report_stats(user), f"{FRONTEND_URL}/app")


@router.post("/reports/weekly/send")
async def weekly_send_me(user=Depends(get_current_user)):
    sent = await send_email(user["email"], "Your CareerNiche weekly progress", weekly_report_email(user["username"], await _report_stats(user), f"{FRONTEND_URL}/app"))
    return {"sent": sent, "message": "Report sent" if sent else "Email isn't configured yet (set RESEND_API_KEY). Use the preview instead."}


@router.post("/reports/weekly/run")
async def weekly_run(x_cron_secret: str = Header(default="")):
    """Call daily from a scheduler: emails users whose report_day is today (in their timezone)."""
    if not CRON_SECRET or x_cron_secret != CRON_SECRET:
        raise HTTPException(403, "Forbidden")
    db = get_db()
    sent = []
    for user in await db.users.find({"settings.weekly_report": True}).to_list(100000):
        local = now_utc().astimezone(user_tz(user))
        dow = (local.weekday() + 1) % 7  # 0 = Sunday
        if dow != user.get("settings", {}).get("report_day", 1):
            continue
        last = parse_dt(user.get("weekly_report_sent_at"))
        if last and last >= day_start(user):
            continue
        ok = await send_email(user["email"], "Your CareerNiche weekly progress", weekly_report_email(user["username"], await _report_stats(user), f"{FRONTEND_URL}/app"))
        if ok:
            await db.users.update_one({"id": user["id"]}, {"$set": {"weekly_report_sent_at": now_utc()}})
            sent.append(user["email"])
    return {"sent": len(sent)}


# ── Demo data ─────────────────────────────────────────────────────────────────
DEMO_JOBS = [
    ("Frontend Developer", "Maple Byte Labs", "Applied", 4, 78000, "Toronto, ON"),
    ("Junior Web Developer", "Northshore Digital", "Interviewed", 5, 65000, "Windsor, ON"),
    ("React Native Developer", "Lakeside Health Tech", "Applying", 4, 82000, "Remote (Canada)"),
    ("UX Engineer", "Harbourfront Studio", "Bookmarked", 3, 72000, "Hamilton, ON"),
    ("Full Stack Developer", "Trillium Logistics", "Offered", 5, 90000, "Mississauga, ON"),
    ("iOS Developer", "Red Pine Mobile", "Applied", 3, 85000, "Ottawa, ON"),
    ("Web Content Specialist", "Bayview Community Co-op", "Bookmarked", 2, 52000, "London, ON"),
    ("QA Analyst", "Granite Fintech", "Archived", 2, 60000, "Waterloo, ON"),
    ("Product Designer", "Cedar & Co. Creative", "Applied", 4, 75000, "Remote (Canada)"),
    ("Mobile App Intern", "Lighthouse Learning", "Interviewed", 3, 42000, "Kitchener, ON"),
]
DEMO_CONTACTS = [
    ("Priya Nair", "Engineering Manager", "Northshore Digital", "Hiring manager"),
    ("Marcus Lee", "Talent Partner", "Trillium Logistics", "Recruiter"),
    ("Sofia Alvarez", "Senior Developer", "Maple Byte Labs", "Professional"),
    ("Daniel Okafor", "Career Coach", "CareerNiche", "Mentor"),
]


@router.post("/demo/seed")
async def seed_demo(user=Depends(get_current_user)):
    db = get_db()
    if await db.jobs.find_one({"user_id": user["id"], "demo": True}):
        return {"ok": True, "already_seeded": True}
    now = now_utc()
    job_ids = {}
    for i, (name, company, status, prio, pay, loc) in enumerate(DEMO_JOBS):
        created = now - timedelta(days=40 - i * 3)
        highest = status if status in STATUS_RANK else "Applied"
        jid = new_id()
        job_ids[company] = jid
        await db.jobs.insert_one(
            {
                "id": jid, "user_id": user["id"], "demo": True, "job_name": name, "company_name": company,
                "job_link": "https://example.com/careers", "job_pay": pay, "location": loc, "status": status,
                "highest_status": highest, "complete": False if status == "Archived" else None,
                "priority_score": prio, "compare_score": random.randint(55, 95), "notes": "", "converted_to_token": False,
                "description": f"{name} role at {company}. Demo data — edit or delete anytime.",
                "status_history": [{"status": "Bookmarked", "at": created}, {"status": status, "at": created + timedelta(days=2)}],
                "last_follow_up_at": None, "created_at": created, "updated_at": created + timedelta(days=2),
            }
        )
        # Activity history so charts look alive (no points: demo shouldn't inflate rewards)
        await db.activity.insert_one({"id": new_id(), "user_id": user["id"], "action": "bookmark", "job_id": jid, "points": 0, "created_at": created, "demo": True})
        if STATUS_RANK.get(highest, 0) >= STATUS_RANK["Applied"]:
            await db.activity.insert_one({"id": new_id(), "user_id": user["id"], "action": "apply", "job_id": jid, "points": 0, "created_at": created + timedelta(days=1), "demo": True})
        if STATUS_RANK.get(highest, 0) >= STATUS_RANK["Interviewed"]:
            when = now + timedelta(days=2 + i % 4, hours=3)
            await db.interviews.insert_one({"id": new_id(), "user_id": user["id"], "job_id": jid, "interview_type": "First round", "interview_date": when.isoformat(), "interview_notes": "Prepare STAR stories.", "created_at": now, "updated_at": now, "demo": True})
            await db.activity.insert_one({"id": new_id(), "user_id": user["id"], "action": "interview", "job_id": jid, "points": 0, "created_at": created + timedelta(days=5), "demo": True})
    for k, (name, title, company, rel) in enumerate(DEMO_CONTACTS):
        await db.contacts.insert_one(
            {
                "id": new_id(), "user_id": user["id"], "demo": True, "contact_name": name, "job_title": title, "company": company,
                "relationship": rel, "email": "", "phone_number": "", "description": "", "linkedin_url": "",
                "job_id": job_ids.get(company), "next_touchpoint": (now + timedelta(days=k * 2 + 1)).isoformat(),
                "touchpoints": [{"id": new_id(), "format": "Video", "kind": "Informational interview", "date": (now - timedelta(days=10 + k)).isoformat(), "notes": "Great chat about the team.", "created_at": now.isoformat()}],
                "created_at": now, "updated_at": now,
            }
        )
    return {"ok": True}


@router.delete("/demo")
async def clear_demo(user=Depends(get_current_user)):
    db = get_db()
    demo_jobs = [j["id"] for j in await db.jobs.find({"user_id": user["id"], "demo": True}).to_list(1000)]
    for coll in ("jobs", "interviews", "contacts", "activity"):
        await db[coll].delete_many({"user_id": user["id"], "demo": True})
    await db.documents.delete_many({"job_id": {"$in": demo_jobs}})
    return {"ok": True}
