"""End-to-end API tests against an in-memory Mongo (mongomock-motor).

Run:  cd backend && pytest -q
"""
import os
import sys

import pytest
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import core  # noqa: E402
import server  # noqa: E402


@pytest.fixture()
def client():
    core.init_db(AsyncMongoMockClient())
    with TestClient(server.app) as c:
        yield c


def signup(client, email="sam@example.com"):
    r = client.post("/api/auth/register", json={"email": email, "password": "secret123", "username": "Sam", "timezone": "America/Toronto"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_auth_flow(client):
    h = signup(client)
    assert client.post("/api/auth/register", json={"email": "sam@example.com", "password": "secret123", "username": "Sam"}).status_code == 400
    assert client.post("/api/auth/login", json={"email": "sam@example.com", "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "SAM@example.com", "password": "secret123"}).status_code == 200
    me = client.get("/api/auth/me", headers=h).json()["user"]
    assert me["tokens"] == 100 and "password_hash" not in me
    # forgot / reset (dev link returned because email isn't configured)
    link = client.post("/api/auth/forgot-password", json={"email": "sam@example.com"}).json()["dev_reset_link"]
    token = link.split("token=")[1]
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "newpass1"}).status_code == 200
    assert client.post("/api/auth/reset-password", json={"token": token, "password": "again12"}).status_code == 400
    assert client.post("/api/auth/login", json={"email": "sam@example.com", "password": "newpass1"}).status_code == 200
    r = client.post("/api/auth/change-password", headers=h, json={"current_password": "newpass1", "new_password": "third33"})
    assert r.status_code == 200
    assert client.get("/api/auth/me").status_code == 401


def test_job_pipeline_and_rewards(client):
    h = signup(client)
    created = client.post("/api/jobs", headers=h, json={"job_name": "Dev", "company_name": "Acme", "priority_score": 4}).json()
    job = created["job"]
    assert job["status"] == "Bookmarked" and created["rewards"]["actions"] == ["bookmark"]

    # Applied for the first time → apply action; going back and forward doesn't re-award
    r = client.post(f"/api/jobs/{job['id']}/status", headers=h, json={"status": "Applied"}).json()
    assert r["rewards"]["actions"] == ["apply"] and r["job"]["highest_status"] == "Applied"
    client.post(f"/api/jobs/{job['id']}/status", headers=h, json={"status": "Applying"})
    r = client.post(f"/api/jobs/{job['id']}/status", headers=h, json={"status": "Applied"}).json()
    assert r["rewards"]["actions"] == []

    # Daily apply mission needs 2 → second job completes it (+20 points/tokens)
    j2 = client.post("/api/jobs", headers=h, json={"job_name": "Dev 2", "company_name": "Beta", "status": "Applied"}).json()
    assert {"name": "Daily Applicant", "points": 20, "id": "m-apply-2"} in j2["rewards"]["missions_completed"]
    # Daily apply starter goal (target 2) also completes
    assert any(g["goal_type"] == "daily" and g["action_type"] == "apply" for g in j2["rewards"]["goals_completed"])
    summary = client.get("/api/rewards/summary", headers=h).json()
    assert summary["points"]["total"] >= 20 and summary["tokens"] >= 120

    # Follow-up has a 24h cooldown
    assert client.post(f"/api/jobs/{job['id']}/follow-up", headers=h).status_code == 200
    assert client.post(f"/api/jobs/{job['id']}/follow-up", headers=h).status_code == 429

    # Notes → research
    r = client.patch(f"/api/jobs/{job['id']}", headers=h, json={"notes": "Read their engineering blog"}).json()
    assert r["rewards"]["actions"] == ["research"]

    # Interview log moves card to Interviewed
    r = client.post(f"/api/jobs/{job['id']}/interviews", headers=h, json={"interview_type": "First round", "interview_date": "2030-01-05T15:00:00Z"})
    assert r.status_code == 200
    detail = client.get(f"/api/jobs/{job['id']}", headers=h).json()
    assert detail["job"]["status"] == "Interviewed" and len(detail["interviews"]) == 1

    # Offer accepted → archived + accept_offer
    client.post(f"/api/jobs/{job['id']}/status", headers=h, json={"status": "Offered"})
    r = client.post(f"/api/jobs/{job['id']}/offer", headers=h, json={"decision": "accept"}).json()
    assert r["job"]["status"] == "Archived" and r["job"]["complete"] is True
    assert "accept_offer" in r["rewards"]["actions"]

    # Soft delete / restore / permanent delete
    client.delete(f"/api/jobs/{j2['job']['id']}", headers=h)
    assert len(client.get("/api/jobs?status=Deleted", headers=h).json()) == 1
    assert client.post(f"/api/jobs/{j2['job']['id']}/restore", headers=h).json()["job"]["status"] == "Applied"
    assert client.delete(f"/api/jobs/{j2['job']['id']}/permanent", headers=h).status_code == 200
    assert client.get(f"/api/jobs/{j2['job']['id']}", headers=h).status_code == 404

    a = client.get("/api/analytics", headers=h).json()
    assert a["funnel"]["Offered"] == 1 and a["offers_accepted"] == 1 and len(a["weekly"]) == 8


def test_documents(client):
    h = signup(client)
    job = client.post("/api/jobs", headers=h, json={"job_name": "Dev", "company_name": "Acme"}).json()["job"]
    r = client.post(f"/api/jobs/{job['id']}/documents", headers=h, data={"document_type": "Resume"}, files={"file": ("cv.pdf", b"%PDF-1.4 hello", "application/pdf")})
    assert r.status_code == 200, r.text
    doc = r.json()
    assert "data" not in doc
    dl = client.get(f"/api/documents/{doc['id']}/download", headers=h)
    assert dl.content == b"%PDF-1.4 hello"
    r = client.post(f"/api/jobs/{job['id']}/documents", headers=h, data={"document_type": "Portfolio", "url": "https://me.dev"})
    assert r.status_code == 200
    assert len(client.get(f"/api/jobs/{job['id']}", headers=h).json()["documents"]) == 2


def test_network_and_goals(client):
    h = signup(client)
    c = client.post("/api/contacts", headers=h, json={"contact_name": "Priya", "company": "Northshore"}).json()
    assert c["rewards"]["actions"] == ["contacts"]
    r = client.post(f"/api/contacts/{c['contact']['id']}/touchpoints", headers=h, json={"format": "Video", "notes": "Coffee chat"}).json()
    assert len(r["contact"]["touchpoints"]) == 1
    # Connector mission (2 networking actions) is now complete
    missions = {m["id"]: m for m in client.get("/api/missions", headers=h).json()}
    assert missions["m-contacts-2"]["completed"] is True
    goals = client.post("/api/goals", headers=h, json={"goal_type": "daily", "action_type": "research", "target": 3}).json()
    assert any(g["action_type"] == "research" for g in goals)
    goals = client.delete("/api/goals/daily/research", headers=h).json()
    assert not any(g["action_type"] == "research" and g["goal_type"] == "daily" for g in goals)


def test_themes_and_town(client):
    h = signup(client)
    t = client.get("/api/themes", headers=h).json()
    assert t["tokens"] == 100
    assert client.post("/api/themes/deepPurple/unlock", headers=h).status_code == 400  # costs 285
    assert client.patch("/api/settings", headers=h, json={"app_theme": "careerNiche"}).status_code == 403
    assert client.post("/api/themes/careerniche/visit", headers=h).json()["unlocked"] is True
    s = client.patch("/api/settings", headers=h, json={"app_theme": "careerNiche", "dark_mode": True, "font_size": "large"}).json()
    assert s["app_theme"] == "careerNiche" and s["dark_mode"] is True

    town = client.get("/api/town", headers=h).json()
    assert town["grid_size"] == 6 and "cottage" in town["unlocked_items"]
    town = client.post("/api/town/place", headers=h, json={"x": 1, "y": 2, "kind": "cottage", "facing": "ne"}).json()
    assert len(town["buildings"]) == 1
    assert client.post("/api/town/place", headers=h, json={"x": 9, "y": 9, "kind": "cottage"}).status_code == 400
    assert client.post("/api/town/place", headers=h, json={"x": 0, "y": 0, "kind": "office"}).status_code == 403
    town = client.post("/api/town/unlock", headers=h, json={"kind": "cafe"}).json()  # 60 tokens
    assert town["tokens"] == 40
    town = client.post("/api/town/upgrade", headers=h, json={"x": 1, "y": 2}).json()  # 40 tokens
    assert town["tokens"] == 0 and town["buildings"][0]["level"] == 2
    town = client.post("/api/town/rotate", headers=h, json={"x": 1, "y": 2}).json()
    assert town["buildings"][0]["facing"] == "nw"
    assert client.post("/api/town/expand", headers=h).status_code == 400
    town = client.post("/api/town/remove", headers=h, json={"x": 1, "y": 2}).json()
    assert town["buildings"] == [] and town["tokens"] == 20  # half of upgrade refunded


def test_misc(client):
    h = signup(client)
    assert client.post("/api/leads", json={"name": "Ana", "email": "ana@biz.ca", "kind": "business", "company": "Biz"}).status_code == 200
    assert client.post("/api/demo/seed", headers=h).json()["ok"]
    jobs = client.get("/api/jobs", headers=h).json()
    assert len(jobs) == 10
    assert len(client.get("/api/contacts", headers=h).json()) == 4
    assert client.get("/api/notifications", headers=h).json()["items"]
    hub = client.get("/api/hub", headers=h).json()
    assert len(hub["services"]) == 6
    client.post("/api/hub/notify", headers=h, json={"item_id": "resume-review", "kind": "service"})
    assert next(s for s in client.get("/api/hub", headers=h).json()["services"] if s["id"] == "resume-review")["notify"]
    assert "CareerNiche" in client.get("/api/reports/weekly/preview", headers=h).text
    client.delete("/api/demo", headers=h)
    assert client.get("/api/jobs", headers=h).json() == []
    assert client.delete("/api/me", headers=h).status_code == 200
    assert client.get("/api/auth/me", headers=h).status_code == 401
