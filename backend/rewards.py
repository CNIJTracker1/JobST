"""Rewards engine: goals, missions, points, tokens and badges.

Port of RewardService + MissionService + RewardProvider from the Flutter app,
collapsed into one call — `record_action()` — that every feature uses.

Collections:
  activity      one row per rewarded action  {user_id, action, job_id, points, created_at}
  goals         {user_id, goal_type: daily|weekly, action_type, target, current, period_start}
  user_missions {user_id, mission_id, progress, completed, gained_tokens, period_start, change_total, history[]}
  user_badges   {user_id, badge_type, unlocked_at}
Points  = sum of activity.points (total / today / this week)
Tokens  = users.tokens — the spendable wallet ("stars") for themes and the city builder
"""
from datetime import timedelta

from catalog import (
    ACTIONS,
    BADGES,
    DEFAULT_DAILY_TARGET,
    DEFAULT_WEEKLY_TARGET,
    INCREMENTAL_ACTIONS,
    MISSIONS,
)
from core import clean, day_start, get_db, iso, new_id, now_utc, parse_dt, week_start

MISSIONS_BY_ID = {m["id"]: m for m in MISSIONS}


# ── Periods ───────────────────────────────────────────────────────────────────
def goal_period_start(user, goal_type):
    return day_start(user) if goal_type == "daily" else week_start(user)


def mission_period_start(user, repeat_days):
    if repeat_days == 7:
        return week_start(user)
    return day_start(user)


async def normalize_goal(user, goal):
    """Reset a goal's counter when its day/week has rolled over."""
    current_start = goal_period_start(user, goal["goal_type"])
    stored = parse_dt(goal.get("period_start"))
    if stored is None or stored < current_start:
        goal["current"] = 0
        goal["period_start"] = current_start
        goal["completed_at"] = None
        await get_db().goals.update_one(
            {"id": goal["id"]}, {"$set": {"current": 0, "period_start": current_start, "completed_at": None}}
        )
    return goal


async def normalize_user_mission(user, um):
    mission = MISSIONS_BY_ID.get(um["mission_id"])
    if not mission:
        return um
    repeat = max(1, mission["repeat_days"])
    start = parse_dt(um.get("period_start"))
    if start is None or now_utc() >= start + timedelta(days=repeat):
        history = um.get("history", [])
        if start is not None and um.get("progress", 0) > 0:
            history = ([{"period_start": iso(start), "progress": um["progress"], "completed": um.get("completed", False)}] + history)[:12]
        new_start = mission_period_start(user, repeat)
        um.update({"progress": 0, "completed": False, "gained_tokens": 0, "period_start": new_start, "history": history})
        await get_db().user_missions.update_one({"id": um["id"]}, {"$set": {k: um[k] for k in ("progress", "completed", "gained_tokens", "period_start", "history")}})
    return um


async def get_or_create_user_mission(user, mission):
    db = get_db()
    um = await db.user_missions.find_one({"user_id": user["id"], "mission_id": mission["id"]})
    if not um:
        um = {
            "id": new_id(),
            "user_id": user["id"],
            "mission_id": mission["id"],
            "progress": 0,
            "completed": False,
            "gained_tokens": 0,
            "change_total": 0,
            "period_start": mission_period_start(user, mission["repeat_days"]),
            "history": [],
        }
        await db.user_missions.insert_one(dict(um))
    return await normalize_user_mission(user, um)


# ── Goals API helpers ─────────────────────────────────────────────────────────
async def list_goals(user):
    goals = await get_db().goals.find({"user_id": user["id"]}).to_list(100)
    out = []
    for g in goals:
        g = await normalize_goal(user, g)
        c = clean(g)
        c["completed"] = g["current"] >= g["target"]
        c["action"] = ACTIONS.get(g["action_type"], {})
        out.append(c)
    out.sort(key=lambda g: (g["goal_type"] != "daily", g["action_type"]))
    return out


async def set_goal(user, goal_type, action_type, target):
    db = get_db()
    existing = await db.goals.find_one({"user_id": user["id"], "goal_type": goal_type, "action_type": action_type})
    if existing:
        await db.goals.update_one({"id": existing["id"]}, {"$set": {"target": target}})
    else:
        await db.goals.insert_one(
            {
                "id": new_id(),
                "user_id": user["id"],
                "goal_type": goal_type,
                "action_type": action_type,
                "target": target,
                "current": 0,
                "period_start": goal_period_start(user, goal_type),
                "completed_at": None,
                "created_at": now_utc(),
            }
        )


async def _ensure_default_goals(user, action):
    db = get_db()
    for goal_type, target in (("daily", DEFAULT_DAILY_TARGET), ("weekly", DEFAULT_WEEKLY_TARGET)):
        if not await db.goals.find_one({"user_id": user["id"], "goal_type": goal_type, "action_type": action}):
            await set_goal(user, goal_type, action, target)


# ── Points ────────────────────────────────────────────────────────────────────
async def points_summary(user):
    rows = await get_db().activity.find({"user_id": user["id"], "points": {"$gt": 0}}).to_list(100000)
    d0, w0 = day_start(user), week_start(user)
    total = daily = weekly = 0
    for r in rows:
        pts = r.get("points", 0)
        total += pts
        at = parse_dt(r["created_at"])
        if at >= d0:
            daily += pts
        if at >= w0:
            weekly += pts
    return {"total": total, "daily": daily, "weekly": weekly}


async def add_tokens(user_id, amount):
    await get_db().users.update_one({"id": user_id}, {"$inc": {"tokens": amount}})


async def spend_tokens(user_id, amount) -> bool:
    """Atomically deduct tokens; returns False if the balance is too low."""
    res = await get_db().users.update_one({"id": user_id, "tokens": {"$gte": amount}}, {"$inc": {"tokens": -amount}})
    return res.modified_count == 1


# ── Badges ────────────────────────────────────────────────────────────────────
async def check_badges(user):
    db = get_db()
    owned = {b["badge_type"] for b in await db.user_badges.find({"user_id": user["id"]}).to_list(100)}
    activity = await db.activity.find({"user_id": user["id"]}).to_list(100000)
    fresh_user = await db.users.find_one({"id": user["id"]})
    total_points = sum(a.get("points", 0) for a in activity)
    unlocked = []
    for badge in BADGES:
        if badge["type"] in owned:
            continue
        kind, action, threshold = badge["rule"]
        if kind == "action_jobs":
            value = len({a.get("job_id") for a in activity if a["action"] == action and a.get("job_id")})
        elif kind == "action_count":
            value = sum(1 for a in activity if a["action"] == action)
        elif kind == "points":
            value = total_points
        else:  # goals completed (lifetime)
            value = (fresh_user or {}).get("stats", {}).get("goals_completed", 0)
        if value >= threshold:
            await db.user_badges.insert_one({"id": new_id(), "user_id": user["id"], "badge_type": badge["type"], "unlocked_at": now_utc()})
            unlocked.append({k: badge[k] for k in ("type", "name", "description", "icon")})
    return unlocked


async def list_badges(user):
    owned = {b["badge_type"]: b for b in await get_db().user_badges.find({"user_id": user["id"]}).to_list(100)}
    return [
        {
            **{k: b[k] for k in ("type", "name", "description", "icon")},
            "unlocked": b["type"] in owned,
            "unlocked_at": iso(owned[b["type"]]["unlocked_at"]) if b["type"] in owned else None,
        }
        for b in BADGES
    ]


# ── Missions listing ──────────────────────────────────────────────────────────
async def list_missions(user):
    out = []
    for mission in MISSIONS:
        um = await get_or_create_user_mission(user, mission)
        target = mission["total"] + um.get("change_total", 0)
        repeat = mission["repeat_days"]
        resets_at = parse_dt(um["period_start"]) + timedelta(days=repeat)
        out.append(
            {
                **mission,
                "target": target,
                "progress": min(um["progress"], target),
                "completed": um["completed"],
                "gained_tokens": um.get("gained_tokens", 0),
                "resets_at": iso(resets_at),
                "reset_label": "Resets daily" if repeat <= 1 else ("Resets every Sunday" if repeat == 7 else f"Resets every {repeat} days"),
                "history": um.get("history", []),
            }
        )
    out.sort(key=lambda m: (m["completed"], m["name"].lower()))
    return out


# ── The one entry point ───────────────────────────────────────────────────────
async def record_action(user, action, job_id=None):
    """Record a job-search action and apply goals, missions, points and badges.

    Returns a summary the frontend uses for toasts and confetti.
    """
    db = get_db()
    result = {"action": action, "points_earned": 0, "goals_completed": [], "missions_completed": [], "badges_unlocked": []}
    if action not in ACTIONS:
        return result

    # 1) Goals
    if action in INCREMENTAL_ACTIONS:
        await _ensure_default_goals(user, action)
    goals = await db.goals.find({"user_id": user["id"], "action_type": action}).to_list(10)
    goals_finished = 0
    for goal in goals:
        goal = await normalize_goal(user, goal)
        before = goal["current"]
        after = before + 1
        update = {"current": after}
        if before < goal["target"] <= after:
            update["completed_at"] = now_utc()
            goals_finished += 1
            result["goals_completed"].append({"goal_type": goal["goal_type"], "action_type": action, "target": goal["target"]})
        await db.goals.update_one({"id": goal["id"]}, {"$set": update})
    if goals_finished:
        await db.users.update_one({"id": user["id"]}, {"$inc": {"stats.goals_completed": goals_finished}})

    # 2) Missions → points + tokens on completion
    points = 0
    for mission in (m for m in MISSIONS if m["action_type"] == action):
        um = await get_or_create_user_mission(user, mission)
        if um["completed"]:
            continue
        target = mission["total"] + um.get("change_total", 0)
        progress = um["progress"] + 1
        update = {"progress": progress}
        if target > 0 and progress >= target:
            update.update({"completed": True, "gained_tokens": mission["points"]})
            points += mission["points"]
            result["missions_completed"].append({"id": mission["id"], "name": mission["name"], "points": mission["points"]})
        await db.user_missions.update_one({"id": um["id"]}, {"$set": update})

    await db.activity.insert_one(
        {"id": new_id(), "user_id": user["id"], "action": action, "job_id": job_id, "points": points, "created_at": now_utc()}
    )
    if points:
        await add_tokens(user["id"], points)
    result["points_earned"] = points

    # 3) Badges
    result["badges_unlocked"] = await check_badges(user)
    fresh = await db.users.find_one({"id": user["id"]})
    result["tokens"] = (fresh or {}).get("tokens", 0)
    return result
