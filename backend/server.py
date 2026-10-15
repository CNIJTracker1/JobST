"""CareerNiche Job Tracker API — FastAPI + MongoDB (Emergent default stack).

Run locally:  uvicorn server:app --reload --port 8001
All routes are served under /api (Emergent's ingress convention).
"""
import os
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from core import get_db, logger
from routes_auth import router as auth_router
from routes_growth import router as growth_router
from routes_jobs import router as jobs_router
from routes_misc import router as misc_router
from routes_network import router as network_router


async def create_indexes():
    db = get_db()
    try:
        await db.users.create_index("id", unique=True)
        await db.users.create_index("email", unique=True)
        for coll in ("jobs", "interviews", "documents", "contacts", "activity", "goals", "user_missions", "user_badges", "buildings"):
            await db[coll].create_index("user_id")
        await db.jobs.create_index("id", unique=True)
        await db.email_tokens.create_index("token", unique=True)
        await db.buildings.create_index([("user_id", 1), ("x", 1), ("y", 1)], unique=True)
    except Exception as exc:  # never block startup on index creation
        logger.warning("Index creation skipped: %s", exc)


@asynccontextmanager
async def lifespan(_app):
    await create_indexes()
    yield


app = FastAPI(title="CareerNiche Job Tracker API", version="1.0.0", lifespan=lifespan)

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "CareerNiche Job Tracker API", "status": "ok"}


for r in (auth_router, jobs_router, network_router, growth_router, misc_router):
    api_router.include_router(r)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


