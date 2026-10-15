"""Static product configuration ported from the Flutter app.

Everything here was hard-coded or stored as lookup rows in Supabase in the
original app. Edit freely: values are read at runtime, and missions are
upserted into Mongo on startup.
"""

# ── Job pipeline ──────────────────────────────────────────────────────────────
PIPELINE = ["Bookmarked", "Applying", "Applied", "Interviewed", "Offered"]
ALL_STATUSES = PIPELINE + ["Archived", "Deleted"]
# Only real pipeline progress counts toward "highest status reached".
# (The Flutter app ranked Archived/Deleted above Offered, which inflated analytics.)
STATUS_RANK = {s: i for i, s in enumerate(PIPELINE)}

# Status reached for the first time → reward action
STATUS_ACTIONS = {"Bookmarked": "bookmark", "Applied": "apply", "Interviewed": "interview"}

INTERVIEW_TYPES = ["Screening call", "First round", "Second round", "Final round", "Practical", "Other"]
DOCUMENT_TYPES = ["Resume", "CoverLetter", "Portfolio", "Other"]
CONTACT_FORMATS = ["Phone", "Video", "In-Person", "Email"]
FOLLOW_UP_COOLDOWN_HOURS = 24

# ── Reward actions ────────────────────────────────────────────────────────────
ACTIONS = {
    "bookmark": {"label": "Bookmark", "emoji": "🔖", "points": 5},
    "apply": {"label": "Apply", "emoji": "📮", "points": 10},
    "interview": {"label": "Interview", "emoji": "🎤", "points": 15},
    "follow_up": {"label": "Follow-up", "emoji": "⚡", "points": 8},
    "contacts": {"label": "Network / Informational Interview", "emoji": "👥", "points": 8},
    "research": {"label": "Research", "emoji": "🔎", "points": 5},
    "accept_offer": {"label": "Accept Offer", "emoji": "🎁", "points": 25},
}
# Actions whose goals auto-create with defaults the first time they happen
INCREMENTAL_ACTIONS = {"follow_up", "interview", "accept_offer", "contacts", "research"}
DEFAULT_DAILY_TARGET = 2
DEFAULT_WEEKLY_TARGET = 10
STARTING_TOKENS = 100

# Goals every new account starts with
STARTER_GOALS = [
    ("daily", "apply", 2),
    ("weekly", "apply", 10),
    ("weekly", "contacts", 3),
]

# ── Missions (was the `missions` table) ───────────────────────────────────────
# repeat_days: 1 = resets daily at local midnight, 7 = resets Sunday, N = every N days
MISSIONS = [
    {"id": "m-bookmark-3", "name": "Scout It Out", "description": "Bookmark 3 jobs that excite you", "action_type": "bookmark", "total": 3, "points": 15, "repeat_days": 1},
    {"id": "m-apply-2", "name": "Daily Applicant", "description": "Apply to 2 jobs today", "action_type": "apply", "total": 2, "points": 20, "repeat_days": 1},
    {"id": "m-apply-10", "name": "Weekly Hustle", "description": "Apply to 10 jobs this week", "action_type": "apply", "total": 10, "points": 100, "repeat_days": 7},
    {"id": "m-interview-1", "name": "Interview Ready", "description": "Land or log an interview this week", "action_type": "interview", "total": 1, "points": 50, "repeat_days": 7},
    {"id": "m-follow-3", "name": "Follow-up Pro", "description": "Follow up on 3 applications this week", "action_type": "follow_up", "total": 3, "points": 40, "repeat_days": 7},
    {"id": "m-contacts-2", "name": "Connector", "description": "Add or meet 2 people in your network this week", "action_type": "contacts", "total": 2, "points": 40, "repeat_days": 7},
    {"id": "m-research-3", "name": "Do Your Homework", "description": "Save research notes on 3 jobs this week", "action_type": "research", "total": 3, "points": 30, "repeat_days": 7},
    {"id": "m-offer-1", "name": "Offer Champion", "description": "Accept a job offer", "action_type": "accept_offer", "total": 1, "points": 250, "repeat_days": 30},
]

# ── Badges (was the `rewards` table) ──────────────────────────────────────────
BADGES = [
    {"type": "bookmark_master", "name": "Bookmark Master", "description": "Bookmarked 10+ jobs", "icon": "🔖", "rule": ("action_jobs", "bookmark", 10)},
    {"type": "application_spree", "name": "Application Spree", "description": "Applied to 25+ jobs", "icon": "📮", "rule": ("action_jobs", "apply", 25)},
    {"type": "interview_ace", "name": "Interview Ace", "description": "Had 5+ interviews", "icon": "🎤", "rule": ("action_count", "interview", 5)},
    {"type": "go_getter", "name": "Go-Getter", "description": "Earned 50+ reward points", "icon": "⚡", "rule": ("points", None, 50)},
    {"type": "goal_crusher", "name": "Goal Crusher", "description": "Completed 5+ goals", "icon": "🏆", "rule": ("goals", None, 5)},
    {"type": "connector", "name": "Super Connector", "description": "Logged 10+ networking actions", "icon": "🤝", "rule": ("action_count", "contacts", 10)},
]

# ── Themes (was ThemeProvider + `uservisuals`) ────────────────────────────────
# cost=None and unlock="free" → available to everyone
THEMES = {
    "executiveBlue": {"label": "Executive Blue", "emoji": "💼", "unlock": "free", "description": "Trust, wisdom & authority"},
    "growthTeal": {"label": "Growth Teal", "emoji": "📈", "unlock": "free", "description": "Innovation, clarity & growth"},
    "foundationGrey": {"label": "Foundation Grey", "emoji": "🏛️", "unlock": "free", "description": "Sophistication & balance"},
    "obsidian": {"label": "Obsidian", "emoji": "🖤", "unlock": "free"},
    "ocean": {"label": "Ocean", "emoji": "🌊", "unlock": "free"},
    "forest": {"label": "Forest", "emoji": "🌿", "unlock": "free"},
    "slate": {"label": "Slate", "emoji": "🩶", "unlock": "free"},
    "navy": {"label": "Navy", "emoji": "🔵", "unlock": "free"},
    "deepPurple": {"label": "Deep Purple", "emoji": "💜", "unlock": "tokens", "cost": 285},
    "sunset": {"label": "Sunset", "emoji": "🌅", "unlock": "tokens", "cost": 375},
    "midnight": {"label": "Midnight", "emoji": "🌙", "unlock": "tokens", "cost": 425},
    "gold": {"label": "Gold Premium", "emoji": "🏆", "unlock": "tokens", "cost": 445},
    "aurora": {"label": "Aurora", "emoji": "🌌", "unlock": "tokens", "cost": 475},
    "achievementGold": {"label": "Achievement Gold", "emoji": "🥇", "unlock": "tokens", "cost": 1000, "description": "Prestige, success & ambition"},
    "careerNiche": {"label": "CareerNiche", "emoji": "🟢", "unlock": "visit", "description": "Unlock by visiting CareerNiche.ca"},
}
DEFAULT_THEME = "executiveBlue"
FREE_THEMES = [k for k, v in THEMES.items() if v["unlock"] == "free"]
FONT_SIZES = {"defaultSize": 1.0, "large": 1.2, "extraLarge": 1.4}

# ── City builder (was `imagekeys` + storage images) ───────────────────────────
TOWN_CATEGORIES = {
    "housing": {"label": "Housing", "items": {"cottage": 40, "townhouse": 90, "apartment": 180}},
    "roads": {"label": "Roads", "items": {"road": 10, "plaza": 30}},
    "commercial": {"label": "Commercial", "items": {"cafe": 60, "shop": 100, "office": 220}},
    "industrial": {"label": "Industrial", "items": {"workshop": 80, "factory": 160}},
    "parks": {"label": "Parks", "items": {"tree": 15, "garden": 35, "fountain": 70}},
    "terrain": {"label": "Terrain", "items": {"water": 20, "hill": 25, "rocks": 15}},
}
TOWN_MAX_LEVEL = 3
TOWN_FACINGS = ["ne", "nw", "se", "sw"]
TOWN_MAX_EXPANSION = 6


def town_grid_size(level: int) -> int:
    return 4 + 2 * level  # level 1 → 6×6 … level 6 → 16×16


def town_expand_cost(level: int) -> int:
    return 150 * level


def town_item(kind: str):
    for cat_key, cat in TOWN_CATEGORIES.items():
        if kind in cat["items"]:
            return cat_key, cat["items"][kind]
    return None, None


# ── CareerNiche Hub content ───────────────────────────────────────────────────
HUB_SERVICES = [
    {"id": "resume-review", "title": "Resume Review", "subtitle": "Get expert feedback on your resume", "icon": "FileText"},
    {"id": "mock-interviews", "title": "Mock Interviews", "subtitle": "Practice with a career coach", "icon": "Mic"},
    {"id": "cover-letter", "title": "Cover Letter Writing", "subtitle": "Professionally written cover letters", "icon": "PenLine"},
    {"id": "linkedin", "title": "LinkedIn Optimization", "subtitle": "Stand out to recruiters", "icon": "Linkedin"},
    {"id": "coaching", "title": "Career Coaching", "subtitle": "One-on-one sessions with a career expert", "icon": "Users"},
    {"id": "strategy", "title": "Job Search Strategy", "subtitle": "Build a personalized job search plan", "icon": "Compass"},
]
HUB_RESOURCES = [
    {"id": "resume-templates", "title": "Resume Templates", "subtitle": "ATS-friendly templates for every industry", "icon": "LayoutTemplate"},
    {"id": "interview-prep", "title": "Interview Prep", "subtitle": "Common questions and example answers", "icon": "MessagesSquare"},
    {"id": "salary-guides", "title": "Salary Guides", "subtitle": "Know your worth by role and location", "icon": "DollarSign"},
    {"id": "career-courses", "title": "Career Courses", "subtitle": "Short courses to sharpen your skills", "icon": "GraduationCap"},
    {"id": "cover-letter-examples", "title": "Cover Letter Examples", "subtitle": "Real examples across industries", "icon": "Mail"},
    {"id": "job-search-tips", "title": "Job Search Tips", "subtitle": "Strategies to land interviews faster", "icon": "Lightbulb"},
]
HUB_ARTICLES = [
    {"id": "resume-mistakes", "title": "10 Resume Mistakes to Avoid", "read_minutes": 5, "tag": "Resume"},
    {"id": "negotiate-salary", "title": "How to Negotiate Your Salary Confidently", "read_minutes": 7, "tag": "Offers"},
    {"id": "linkedin-tips", "title": "LinkedIn Profile Tips That Get Recruiters Calling", "read_minutes": 6, "tag": "Networking"},
]
CAREERNICHE_URL = "https://careerniche.ca"

# ── Quotes fallback (QuoteService tier 3) ─────────────────────────────────────
QUOTES = [
    ("The secret of getting ahead is getting started.", "Mark Twain"),
    ("Opportunities don't happen. You create them.", "Chris Grosser"),
    ("It always seems impossible until it's done.", "Nelson Mandela"),
    ("Believe you can and you're halfway there.", "Theodore Roosevelt"),
    ("Hard work beats talent when talent doesn't work hard.", "Tim Notke"),
    ("The only way to do great work is to love what you do.", "Steve Jobs"),
    ("Don't stop when you're tired. Stop when you're done.", "Unknown"),
    ("Great things never come from comfort zones.", "Unknown"),
    ("Do something today that your future self will thank you for.", "Sean Patrick Flanery"),
    ("Don't wait for opportunity. Create it.", "Unknown"),
]
