"""Growth: points, goals, missions, badges, themes and the City Builder game."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from catalog import (
    ACTIONS,
    FREE_THEMES,
    THEMES,
    TOWN_CATEGORIES,
    TOWN_FACINGS,
    TOWN_MAX_EXPANSION,
    TOWN_MAX_LEVEL,
    town_expand_cost,
    town_grid_size,
    town_item,
)
from core import clean, get_current_user, get_db, new_id, now_utc
from rewards import add_tokens, list_badges, list_goals, list_missions, points_summary, set_goal, spend_tokens

router = APIRouter()


# ── Rewards summary ───────────────────────────────────────────────────────────
@router.get("/rewards/summary")
async def rewards_summary(user=Depends(get_current_user)):
    fresh = await get_db().users.find_one({"id": user["id"]})
    return {
        "points": await points_summary(fresh),
        "tokens": fresh.get("tokens", 0),
        "badges": await list_badges(fresh),
        "goals": await list_goals(fresh),
        "goals_completed_lifetime": fresh.get("stats", {}).get("goals_completed", 0),
        "actions": ACTIONS,
    }


@router.get("/rewards/activity")
async def reward_activity(limit: int = 30, user=Depends(get_current_user)):
    rows = await get_db().activity.find({"user_id": user["id"]}).to_list(100000)
    rows.sort(key=lambda r: r["created_at"], reverse=True)
    return [clean(r) for r in rows[: max(1, min(limit, 200))]]


# ── Missions & goals ──────────────────────────────────────────────────────────
@router.get("/missions")
async def missions(user=Depends(get_current_user)):
    return await list_missions(user)


class GoalIn(BaseModel):
    goal_type: Literal["daily", "weekly"]
    action_type: str
    target: int = Field(ge=1, le=500)


@router.get("/goals")
async def goals(user=Depends(get_current_user)):
    return await list_goals(user)


@router.post("/goals")
async def upsert_goal(body: GoalIn, user=Depends(get_current_user)):
    if body.action_type not in ACTIONS:
        raise HTTPException(400, "Unknown action")
    await set_goal(user, body.goal_type, body.action_type, body.target)
    return await list_goals(user)


@router.delete("/goals/{goal_type}/{action_type}")
async def delete_goal(goal_type: str, action_type: str, user=Depends(get_current_user)):
    await get_db().goals.delete_one({"user_id": user["id"], "goal_type": goal_type, "action_type": action_type})
    return await list_goals(user)


# ── Themes ────────────────────────────────────────────────────────────────────
@router.get("/themes")
async def themes(user=Depends(get_current_user)):
    unlocked = set(user.get("unlocked_themes", FREE_THEMES))
    return {
        "tokens": user.get("tokens", 0),
        "current": user.get("settings", {}).get("app_theme"),
        "themes": [{"key": k, **v, "unlocked": k in unlocked} for k, v in THEMES.items()],
    }


@router.post("/themes/{key}/unlock")
async def unlock_theme(key: str, user=Depends(get_current_user)):
    theme = THEMES.get(key)
    if not theme:
        raise HTTPException(404, "Unknown theme")
    if key in user.get("unlocked_themes", []):
        return await themes(user)
    if theme["unlock"] != "tokens":
        raise HTTPException(400, "This theme can't be bought with tokens")
    if not await spend_tokens(user["id"], theme["cost"]):
        raise HTTPException(400, f"You need {theme['cost']} tokens to unlock {theme['label']}")
    await get_db().users.update_one({"id": user["id"]}, {"$addToSet": {"unlocked_themes": key}})
    return await themes(await get_db().users.find_one({"id": user["id"]}))


@router.post("/themes/careerniche/visit")
async def visit_careerniche(user=Depends(get_current_user)):
    """Called when the user opens careerniche.ca from the app (legal_section.dart)."""
    newly = "careerNiche" not in user.get("unlocked_themes", [])
    await get_db().users.update_one({"id": user["id"]}, {"$addToSet": {"unlocked_themes": "careerNiche"}})
    return {"unlocked": newly}


# ── City Builder (port of game_screen.dart + town_service.dart) ───────────────
def _town_state(user, buildings):
    town = user.get("town", {"expansion_level": 1, "unlocked_items": []})
    level = town.get("expansion_level", 1)
    return {
        "tokens": user.get("tokens", 0),
        "expansion_level": level,
        "grid_size": town_grid_size(level),
        "max_expansion": TOWN_MAX_EXPANSION,
        "next_expand_cost": town_expand_cost(level) if level < TOWN_MAX_EXPANSION else None,
        "max_level": TOWN_MAX_LEVEL,
        "unlocked_items": town.get("unlocked_items", []),
        "categories": TOWN_CATEGORIES,
        "facings": TOWN_FACINGS,
        "buildings": [clean(b) for b in buildings],
    }


async def _load_town(user_id):
    db = get_db()
    user = await db.users.find_one({"id": user_id})
    buildings = await db.buildings.find({"user_id": user_id}).to_list(1000)
    return _town_state(user, buildings)


class UnlockItemIn(BaseModel):
    kind: str


class PlaceIn(BaseModel):
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    kind: str
    facing: str = "se"


class TileIn(BaseModel):
    x: int = Field(ge=0)
    y: int = Field(ge=0)


@router.get("/town")
async def get_town(user=Depends(get_current_user)):
    return await _load_town(user["id"])


@router.post("/town/unlock")
async def unlock_item(body: UnlockItemIn, user=Depends(get_current_user)):
    _, cost = town_item(body.kind)
    if cost is None:
        raise HTTPException(404, "Unknown building")
    if body.kind in user.get("town", {}).get("unlocked_items", []):
        return await _load_town(user["id"])
    if not await spend_tokens(user["id"], cost):
        raise HTTPException(400, f"You need {cost} tokens to unlock this building")
    await get_db().users.update_one({"id": user["id"]}, {"$addToSet": {"town.unlocked_items": body.kind}})
    return await _load_town(user["id"])


@router.post("/town/place")
async def place_building(body: PlaceIn, user=Depends(get_current_user)):
    category, _ = town_item(body.kind)
    if category is None:
        raise HTTPException(404, "Unknown building")
    if body.kind not in user.get("town", {}).get("unlocked_items", []):
        raise HTTPException(403, "Unlock this building first")
    if body.facing not in TOWN_FACINGS:
        raise HTTPException(400, "Invalid facing")
    size = town_grid_size(user.get("town", {}).get("expansion_level", 1))
    if body.x >= size or body.y >= size:
        raise HTTPException(400, "Tile is outside your town")
    db = get_db()
    await db.buildings.delete_one({"user_id": user["id"], "x": body.x, "y": body.y})
    await db.buildings.insert_one(
        {"id": new_id(), "user_id": user["id"], "x": body.x, "y": body.y, "kind": body.kind, "category": category, "facing": body.facing, "level": 1, "placed_at": now_utc()}
    )
    return await _load_town(user["id"])


@router.post("/town/upgrade")
async def upgrade_building(body: TileIn, user=Depends(get_current_user)):
    db = get_db()
    b = await db.buildings.find_one({"user_id": user["id"], "x": body.x, "y": body.y})
    if not b:
        raise HTTPException(404, "No building on this tile")
    if b["level"] >= TOWN_MAX_LEVEL:
        raise HTTPException(400, "Already at max level")
    _, base = town_item(b["kind"])
    cost = base * b["level"]
    if not await spend_tokens(user["id"], cost):
        raise HTTPException(400, f"You need {cost} tokens to upgrade")
    await db.buildings.update_one({"id": b["id"]}, {"$inc": {"level": 1}})
    return await _load_town(user["id"])


@router.post("/town/rotate")
async def rotate_building(body: TileIn, user=Depends(get_current_user)):
    db = get_db()
    b = await db.buildings.find_one({"user_id": user["id"], "x": body.x, "y": body.y})
    if not b:
        raise HTTPException(404, "No building on this tile")
    nxt = TOWN_FACINGS[(TOWN_FACINGS.index(b.get("facing", "se")) + 1) % len(TOWN_FACINGS)]
    await db.buildings.update_one({"id": b["id"]}, {"$set": {"facing": nxt}})
    return await _load_town(user["id"])


@router.post("/town/remove")
async def remove_building(body: TileIn, user=Depends(get_current_user)):
    db = get_db()
    b = await db.buildings.find_one({"user_id": user["id"], "x": body.x, "y": body.y})
    if b and b["level"] > 1:  # refund half of upgrade spend
        _, base = town_item(b["kind"])
        await add_tokens(user["id"], sum(base * lvl for lvl in range(1, b["level"])) // 2)
    await db.buildings.delete_one({"user_id": user["id"], "x": body.x, "y": body.y})
    return await _load_town(user["id"])


@router.post("/town/expand")
async def expand_town(user=Depends(get_current_user)):
    level = user.get("town", {}).get("expansion_level", 1)
    if level >= TOWN_MAX_EXPANSION:
        raise HTTPException(400, "Your town is already at max size")
    cost = town_expand_cost(level)
    if not await spend_tokens(user["id"], cost):
        raise HTTPException(400, f"You need {cost} tokens to expand")
    await get_db().users.update_one({"id": user["id"]}, {"$set": {"town.expansion_level": level + 1}})
    return await _load_town(user["id"])
