"""Jobs, interviews and documents (port of JobTrackerService, JobInterviewService,
JobDocumentService and the card actions in cardcontroller.dart / kanban_board_screen.dart)."""
import base64
from datetime import timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from catalog import ALL_STATUSES, DOCUMENT_TYPES, FOLLOW_UP_COOLDOWN_HOURS, INTERVIEW_TYPES, PIPELINE, STATUS_ACTIONS, STATUS_RANK
from core import clean, get_current_user, get_db, new_id, now_utc, parse_dt
from rewards import record_action

router = APIRouter()
MAX_DOC_BYTES = 5 * 1024 * 1024


# ── Models ────────────────────────────────────────────────────────────────────
class JobIn(BaseModel):
    job_name: str = Field(min_length=1, max_length=200)
    company_name: str = Field(min_length=1, max_length=200)
    job_link: Optional[str] = ""
    job_pay: Optional[int] = Field(default=None, ge=0)
    status: str = "Bookmarked"
    priority_score: Optional[int] = Field(default=None, ge=1, le=5)
    compare_score: Optional[int] = Field(default=None, ge=0, le=100)
    notes: Optional[str] = None
    description: Optional[str] = ""
    location: Optional[str] = ""


class JobPatch(BaseModel):
    job_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    company_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    job_link: Optional[str] = None
    job_pay: Optional[int] = Field(default=None, ge=0)
    status: Optional[str] = None
    priority_score: Optional[int] = Field(default=None, ge=0, le=5)
    compare_score: Optional[int] = Field(default=None, ge=0, le=100)
    notes: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None


class StatusIn(BaseModel):
    status: str


class OfferIn(BaseModel):
    decision: Literal["accept", "decline", "renegotiate"]
    notes: Optional[str] = None


class InterviewIn(BaseModel):
    interview_type: str = "First round"
    interview_date: Optional[str] = None
    interview_notes: Optional[str] = ""


class InterviewPatch(BaseModel):
    interview_type: Optional[str] = None
    interview_date: Optional[str] = None
    interview_notes: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────
def merge_rewards(results):
    """Combine several record_action() results into one payload for the UI."""
    merged = {"points_earned": 0, "goals_completed": [], "missions_completed": [], "badges_unlocked": [], "actions": []}
    for r in results:
        if not r:
            continue
        merged["points_earned"] += r.get("points_earned", 0)
        for key in ("goals_completed", "missions_completed", "badges_unlocked"):
            merged[key] += r.get(key, [])
        merged["actions"].append(r.get("action"))
        merged["tokens"] = r.get("tokens")
    return merged


async def get_owned_job(job_id, user):
    job = await get_db().jobs.find_one({"id": job_id, "user_id": user["id"]})
    if not job:
        raise HTTPException(404, "Job not found")
    return job


def serialize_job(job):
    j = clean(job)
    last = parse_dt(job.get("last_follow_up_at"))
    j["follow_up_available_at"] = (last + timedelta(hours=FOLLOW_UP_COOLDOWN_HOURS)).isoformat() if last else None
    return j


async def apply_status_change(user, job, new_status):
    """Update status + highest_status and award progress the first time a stage is reached."""
    if new_status not in ALL_STATUSES:
        raise HTTPException(400, f"Status must be one of {', '.join(ALL_STATUSES)}")
    old_status = job["status"]
    if new_status == old_status:
        return [], {}
    update = {"status": new_status, "updated_at": now_utc()}
    if new_status != "Deleted":
        update["status_before_delete"] = None
    if new_status == "Deleted":
        update["status_before_delete"] = old_status
    history_entry = {"status": new_status, "at": now_utc()}
    results = []
    if new_status in STATUS_RANK:
        highest = job.get("highest_status") or old_status
        if STATUS_RANK[new_status] > STATUS_RANK.get(highest, -1):
            update["highest_status"] = new_status
            action = STATUS_ACTIONS.get(new_status)
            if action:
                results.append(await record_action(user, action, job["id"]))
    await get_db().jobs.update_one({"id": job["id"]}, {"$set": update, "$push": {"status_history": history_entry}})
    return results, update


# ── Jobs ──────────────────────────────────────────────────────────────────────
@router.get("/jobs")
async def list_jobs(status: Optional[str] = None, include_deleted: bool = False, user=Depends(get_current_user)):
    query = {"user_id": user["id"]}
    if status:
        query["status"] = status
    elif not include_deleted:
        query["status"] = {"$ne": "Deleted"}
    jobs = await get_db().jobs.find(query).to_list(5000)
    jobs.sort(key=lambda j: j.get("updated_at") or j["created_at"], reverse=True)
    return [serialize_job(j) for j in jobs]


@router.post("/jobs")
async def create_job(body: JobIn, user=Depends(get_current_user)):
    if body.status not in PIPELINE + ["Archived"]:
        raise HTTPException(400, "Invalid status for a new job")
    now = now_utc()
    job = {
        "id": new_id(),
        "user_id": user["id"],
        **body.model_dump(),
        "status": "Bookmarked",
        "highest_status": "Bookmarked",
        "complete": None,
        "converted_to_token": False,
        "status_history": [{"status": "Bookmarked", "at": now}],
        "last_follow_up_at": None,
        "created_at": now,
        "updated_at": now,
    }
    await get_db().jobs.insert_one(dict(job))
    # Every new job counts as a bookmark (same as the Flutter app) …
    results = [await record_action(user, "bookmark", job["id"])]
    # … then advances to the chosen stage, earning stage rewards on the way.
    if body.status != "Bookmarked":
        stage_results, _ = await apply_status_change(user, job, body.status)
        results += stage_results
    fresh = await get_db().jobs.find_one({"id": job["id"]})
    return {"job": serialize_job(fresh), "rewards": merge_rewards(results)}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str, user=Depends(get_current_user)):
    job = await get_owned_job(job_id, user)
    db = get_db()
    interviews = await db.interviews.find({"job_id": job_id}).to_list(200)
    interviews.sort(key=lambda i: i.get("interview_date") or "", reverse=True)
    documents = await db.documents.find({"job_id": job_id}, {"data": 0}).to_list(200)
    contacts = await db.contacts.find({"job_id": job_id, "user_id": user["id"]}).to_list(200)
    return {
        "job": serialize_job(job),
        "interviews": [clean(i) for i in interviews],
        "documents": [clean(d) for d in documents],
        "contacts": [clean(c) for c in contacts],
    }


@router.patch("/jobs/{job_id}")
async def update_job(job_id: str, body: JobPatch, user=Depends(get_current_user)):
    job = await get_owned_job(job_id, user)
    changes = body.model_dump(exclude_unset=True)
    new_status = changes.pop("status", None)
    if changes.get("priority_score") == 0:
        changes["priority_score"] = None
    results = []
    if changes:
        changes["updated_at"] = now_utc()
        await get_db().jobs.update_one({"id": job_id}, {"$set": changes})
    # Saving new, non-empty notes counts as research (cardcontroller.saveNotes)
    if "notes" in changes:
        new_notes = (changes["notes"] or "").strip()
        if new_notes and new_notes != (job.get("notes") or "").strip():
            results.append(await record_action(user, "research", job_id))
    if new_status:
        job = await get_owned_job(job_id, user)
        stage_results, _ = await apply_status_change(user, job, new_status)
        results += stage_results
    fresh = await get_owned_job(job_id, user)
    return {"job": serialize_job(fresh), "rewards": merge_rewards(results)}


@router.post("/jobs/{job_id}/status")
async def set_status(job_id: str, body: StatusIn, user=Depends(get_current_user)):
    job = await get_owned_job(job_id, user)
    results, _ = await apply_status_change(user, job, body.status)
    fresh = await get_owned_job(job_id, user)
    return {"job": serialize_job(fresh), "rewards": merge_rewards(results)}


@router.post("/jobs/{job_id}/follow-up")
async def follow_up(job_id: str, user=Depends(get_current_user)):
    job = await get_owned_job(job_id, user)
    last = parse_dt(job.get("last_follow_up_at"))
    if last and now_utc() < last + timedelta(hours=FOLLOW_UP_COOLDOWN_HOURS):
        raise HTTPException(429, "You already followed up on this job in the last 24 hours")
    await get_db().jobs.update_one({"id": job_id}, {"$set": {"last_follow_up_at": now_utc(), "updated_at": now_utc()}, "$inc": {"follow_up_count": 1}})
    result = await record_action(user, "follow_up", job_id)
    fresh = await get_owned_job(job_id, user)
    return {"job": serialize_job(fresh), "rewards": merge_rewards([result])}


@router.post("/jobs/{job_id}/offer")
async def offer_decision(job_id: str, body: OfferIn, user=Depends(get_current_user)):
    job = await get_owned_job(job_id, user)
    results = []
    if body.decision == "renegotiate":
        notes = (body.notes or "").strip()
        if notes and notes != (job.get("notes") or "").strip():
            await get_db().jobs.update_one({"id": job_id}, {"$set": {"notes": notes, "updated_at": now_utc()}})
            results.append(await record_action(user, "research", job_id))
    else:
        accepted = body.decision == "accept"
        await get_db().jobs.update_one({"id": job_id}, {"$set": {"complete": accepted}})
        job = await get_owned_job(job_id, user)
        stage_results, _ = await apply_status_change(user, job, "Archived")
        results += stage_results
        if accepted:
            results.append(await record_action(user, "accept_offer", job_id))
    fresh = await get_owned_job(job_id, user)
    return {"job": serialize_job(fresh), "rewards": merge_rewards(results)}


@router.post("/jobs/{job_id}/restore")
async def restore_job(job_id: str, user=Depends(get_current_user)):
    job = await get_owned_job(job_id, user)
    target = job.get("status_before_delete") or job.get("highest_status") or "Bookmarked"
    if target in ("Deleted",):
        target = "Bookmarked"
    await get_db().jobs.update_one({"id": job_id}, {"$set": {"status": target, "status_before_delete": None, "updated_at": now_utc()}})
    return {"job": serialize_job(await get_owned_job(job_id, user))}


@router.delete("/jobs/{job_id}")
async def soft_delete_job(job_id: str, user=Depends(get_current_user)):
    job = await get_owned_job(job_id, user)
    await apply_status_change(user, job, "Deleted")
    return {"ok": True}


@router.delete("/jobs/{job_id}/permanent")
async def hard_delete_job(job_id: str, user=Depends(get_current_user)):
    await get_owned_job(job_id, user)
    db = get_db()
    await db.jobs.delete_one({"id": job_id})
    await db.interviews.delete_many({"job_id": job_id})
    await db.documents.delete_many({"job_id": job_id})
    await db.contacts.update_many({"job_id": job_id}, {"$set": {"job_id": None}})
    return {"ok": True}


# ── Interviews ────────────────────────────────────────────────────────────────
@router.post("/jobs/{job_id}/interviews")
async def add_interview(job_id: str, body: InterviewIn, user=Depends(get_current_user)):
    job = await get_owned_job(job_id, user)
    if body.interview_type not in INTERVIEW_TYPES:
        raise HTTPException(400, f"Interview type must be one of {', '.join(INTERVIEW_TYPES)}")
    row = {"id": new_id(), "user_id": user["id"], "job_id": job_id, **body.model_dump(), "created_at": now_utc(), "updated_at": now_utc()}
    await get_db().interviews.insert_one(dict(row))
    results = [await record_action(user, "interview", job_id)]
    # Logging an interview moves the job to Interviewed if it's earlier in the pipeline
    if STATUS_RANK.get(job["status"], 99) < STATUS_RANK["Interviewed"]:
        # Interview already recorded above, so move the card without a second reward
        await get_db().jobs.update_one({"id": job_id}, {"$set": {"status": "Interviewed", "highest_status": "Interviewed", "updated_at": now_utc()}, "$push": {"status_history": {"status": "Interviewed", "at": now_utc()}}})
    return {"interview": clean(row), "rewards": merge_rewards(results)}


@router.patch("/interviews/{interview_id}")
async def update_interview(interview_id: str, body: InterviewPatch, user=Depends(get_current_user)):
    changes = body.model_dump(exclude_unset=True)
    if "interview_type" in changes and changes["interview_type"] not in INTERVIEW_TYPES:
        raise HTTPException(400, "Unknown interview type")
    changes["updated_at"] = now_utc()
    res = await get_db().interviews.update_one({"id": interview_id, "user_id": user["id"]}, {"$set": changes})
    if res.matched_count == 0:
        raise HTTPException(404, "Interview not found")
    return clean(await get_db().interviews.find_one({"id": interview_id}))


@router.delete("/interviews/{interview_id}")
async def delete_interview(interview_id: str, user=Depends(get_current_user)):
    await get_db().interviews.delete_one({"id": interview_id, "user_id": user["id"]})
    return {"ok": True}


# ── Documents ─────────────────────────────────────────────────────────────────
@router.post("/jobs/{job_id}/documents")
async def upload_document(
    job_id: str,
    document_type: str = Form("Resume"),
    document_name: str = Form(""),
    url: str = Form(""),
    file: Optional[UploadFile] = File(None),
    user=Depends(get_current_user),
):
    await get_owned_job(job_id, user)
    if document_type not in DOCUMENT_TYPES:
        raise HTTPException(400, f"Document type must be one of {', '.join(DOCUMENT_TYPES)}")
    row = {"id": new_id(), "user_id": user["id"], "job_id": job_id, "document_type": document_type, "created_at": now_utc()}
    if file is not None and file.filename:
        data = await file.read()
        if len(data) > MAX_DOC_BYTES:
            raise HTTPException(413, "Files must be 5 MB or smaller")
        row.update({"document_name": document_name or file.filename, "filename": file.filename, "mime": file.content_type or "application/octet-stream", "size": len(data), "data": base64.b64encode(data).decode(), "url": None})
    elif url:
        row.update({"document_name": document_name or url, "url": url, "size": 0})
    else:
        raise HTTPException(400, "Attach a file or provide a link")
    await get_db().documents.insert_one(dict(row))
    row.pop("data", None)
    return clean(row)


@router.get("/documents/{doc_id}/download")
async def download_document(doc_id: str, user=Depends(get_current_user)):
    doc = await get_db().documents.find_one({"id": doc_id, "user_id": user["id"]})
    if not doc or not doc.get("data"):
        raise HTTPException(404, "Document not found")
    return Response(
        content=base64.b64decode(doc["data"]),
        media_type=doc.get("mime", "application/octet-stream"),
        headers={"Content-Disposition": f'attachment; filename="{doc.get("filename", "document")}"'},
    )


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, user=Depends(get_current_user)):
    await get_db().documents.delete_one({"id": doc_id, "user_id": user["id"]})
    return {"ok": True}
