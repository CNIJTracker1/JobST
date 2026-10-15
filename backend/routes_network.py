"""Network: job contacts + personal network with informational interviews.

The Flutter app had two tables (job contacts and "user contacts"/friends) plus an
informational-interview table. Here they're one `contacts` collection: `job_id`
is optional, and each contact keeps a list of `touchpoints` (coffee chats,
informational interviews, calls).
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from catalog import CONTACT_FORMATS
from core import clean, get_current_user, get_db, new_id, now_utc
from rewards import record_action
from routes_jobs import merge_rewards

router = APIRouter()


class ContactIn(BaseModel):
    contact_name: str = Field(min_length=1, max_length=120)
    job_title: Optional[str] = ""
    company: Optional[str] = ""
    email: Optional[str] = ""
    phone_number: Optional[str] = ""
    description: Optional[str] = ""
    linkedin_url: Optional[str] = ""
    relationship: Optional[str] = "Professional"  # Professional | Recruiter | Hiring manager | Friend | Mentor
    job_id: Optional[str] = None
    next_touchpoint: Optional[str] = None  # ISO date


class ContactPatch(BaseModel):
    contact_name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    job_title: Optional[str] = None
    company: Optional[str] = None
    email: Optional[str] = None
    phone_number: Optional[str] = None
    description: Optional[str] = None
    linkedin_url: Optional[str] = None
    relationship: Optional[str] = None
    job_id: Optional[str] = None
    next_touchpoint: Optional[str] = None


class TouchpointIn(BaseModel):
    format: str = "Video"
    date: Optional[str] = None
    notes: Optional[str] = ""
    kind: Optional[str] = "Informational interview"


async def _owned(contact_id, user):
    c = await get_db().contacts.find_one({"id": contact_id, "user_id": user["id"]})
    if not c:
        raise HTTPException(404, "Contact not found")
    return c


async def _check_job(job_id, user):
    if job_id and not await get_db().jobs.find_one({"id": job_id, "user_id": user["id"]}):
        raise HTTPException(400, "Linked job not found")


@router.get("/contacts")
async def list_contacts(job_id: Optional[str] = None, user=Depends(get_current_user)):
    query = {"user_id": user["id"]}
    if job_id:
        query["job_id"] = job_id
    contacts = await get_db().contacts.find(query).to_list(5000)
    jobs = {j["id"]: j for j in await get_db().jobs.find({"user_id": user["id"]}, {"id": 1, "job_name": 1, "company_name": 1}).to_list(5000)}
    out = []
    for c in sorted(contacts, key=lambda c: c["contact_name"].lower()):
        item = clean(c)
        job = jobs.get(c.get("job_id"))
        item["job"] = {"id": job["id"], "job_name": job["job_name"], "company_name": job.get("company_name")} if job else None
        out.append(item)
    return out


@router.post("/contacts")
async def create_contact(body: ContactIn, user=Depends(get_current_user)):
    await _check_job(body.job_id, user)
    row = {"id": new_id(), "user_id": user["id"], **body.model_dump(), "touchpoints": [], "created_at": now_utc(), "updated_at": now_utc()}
    await get_db().contacts.insert_one(dict(row))
    result = await record_action(user, "contacts", body.job_id)
    return {"contact": clean(row), "rewards": merge_rewards([result])}


@router.patch("/contacts/{contact_id}")
async def update_contact(contact_id: str, body: ContactPatch, user=Depends(get_current_user)):
    await _owned(contact_id, user)
    changes = body.model_dump(exclude_unset=True)
    if "job_id" in changes:
        await _check_job(changes["job_id"], user)
    changes["updated_at"] = now_utc()
    await get_db().contacts.update_one({"id": contact_id}, {"$set": changes})
    return clean(await _owned(contact_id, user))


@router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, user=Depends(get_current_user)):
    await get_db().contacts.delete_one({"id": contact_id, "user_id": user["id"]})
    return {"ok": True}


@router.post("/contacts/{contact_id}/touchpoints")
async def add_touchpoint(contact_id: str, body: TouchpointIn, user=Depends(get_current_user)):
    contact = await _owned(contact_id, user)
    if body.format not in CONTACT_FORMATS:
        raise HTTPException(400, f"Format must be one of {', '.join(CONTACT_FORMATS)}")
    tp = {"id": new_id(), **body.model_dump(), "created_at": now_utc().isoformat()}
    await get_db().contacts.update_one({"id": contact_id}, {"$push": {"touchpoints": tp}, "$set": {"updated_at": now_utc()}})
    result = await record_action(user, "contacts", contact.get("job_id"))
    return {"contact": clean(await _owned(contact_id, user)), "rewards": merge_rewards([result])}


@router.delete("/contacts/{contact_id}/touchpoints/{tp_id}")
async def delete_touchpoint(contact_id: str, tp_id: str, user=Depends(get_current_user)):
    await _owned(contact_id, user)
    await get_db().contacts.update_one({"id": contact_id}, {"$pull": {"touchpoints": {"id": tp_id}}})
    return clean(await _owned(contact_id, user))
