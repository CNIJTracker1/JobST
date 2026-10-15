# CareerNiche Job Tracker — React + FastAPI + MongoDB

A full port of the Flutter/Supabase **JobSeekerCNRepo** app to Emergent's default stack, with a redesigned UI and a public landing page.

> **Not another job board — your career community.** Job seekers track applications, grow their network and get coached; businesses connect with prepared candidates through CareerNiche.

```
careerniche-tracker/
├── backend/            FastAPI app (all routes under /api)
│   ├── server.py         app + router wiring + indexes
│   ├── core.py           config, Mongo, JWT auth, time zones
│   ├── catalog.py        statuses, missions, badges, themes, town catalog, hub content
│   ├── rewards.py        goals · missions · points · tokens · badges engine
│   ├── emailer.py        Resend emails (verify, reset, weekly report)
│   ├── routes_auth.py    register/login/verify/reset/password/profile/settings/delete
│   ├── routes_jobs.py    jobs, status pipeline, follow-ups, offers, interviews, documents
│   ├── routes_network.py contacts + touchpoints (informational interviews)
│   ├── routes_growth.py  rewards summary, missions, goals, themes, City Builder
│   ├── routes_misc.py    analytics, reminders, quote, hub, leads, weekly report, demo data
│   └── tests/test_api.py end-to-end API tests (in-memory Mongo)
└── frontend/           React 18 (CRA + craco) + Tailwind
    └── src/
        ├── pages/        Landing, Auth, Onboarding, Dashboard, Board, JobDetail,
        │                 Network, Growth, Analytics, Hub, Settings, Static
        ├── components/   ui/ (design system), app/ (shell, cards, dialogs, CityBuilder)
        ├── context/      AuthContext (session + theme)
        └── lib/          api client, themes, constants, rewards celebration
```

## Run locally

**Backend** (needs MongoDB, e.g. `docker run -d -p 27017:27017 mongo:7`)
```bash
cd backend
cp .env.example .env          # set JWT_SECRET at minimum
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
pytest -q                     # 6 end-to-end tests, uses in-memory Mongo
```

**Frontend**
```bash
cd frontend
cp .env.example .env          # REACT_APP_BACKEND_URL=http://localhost:8001
yarn install
yarn start                    # http://localhost:3000
```

On Emergent, the backend runs on port 8001 behind `/api`, and the frontend reads `REACT_APP_BACKEND_URL`. Both `.env` files follow Emergent's variable names (`MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `REACT_APP_BACKEND_URL`).

## What was ported (Flutter → React)

| Flutter / Supabase | Here |
|---|---|
| `jobtracker` table + 7 status screens | `jobs` collection + one drag-and-drop board (Pipeline / Archived / Bin) |
| `higheststatus` rank logic | Same, but Archived/Deleted no longer count as "higher" than Offered |
| `cardcontroller.dart` actions | Card menu: edit, follow-up (24 h cooldown), accept/decline/renegotiate offer, move, archive, bin, restore, delete forever |
| Job interviews + documents | Interview log per job; documents as file upload (≤5 MB) or link |
| Job contacts + user contacts + informational interviews | One `contacts` collection (optionally linked to a job) with `touchpoints` |
| `RewardService` / `MissionService` / `dailygoals` / `weeklygoals` / `usermissions` / `rewards` | `rewards.py` — one `record_action()` call drives goals, missions, points, tokens and badges |
| `townlayout.tokens` ("stars") | `users.tokens` wallet (starts at 100) |
| `ThemeProvider` (15 themes, costs, CareerNiche unlock-by-visit) | Same themes, costs and unlock rules; dark mode; font size |
| City Builder (Flame + storage images) | Isometric SVG city: unlock, place, facing, rotate, upgrade (3 levels), remove (50 % refund), expand grid |
| Analytics screen | Funnel, status breakdown, response/interview/offer/conversion rates, weekly chart, top priority |
| `weekly-report` edge function | `/api/reports/weekly/preview`, `/send`, and `/run` (cron, `X-Cron-Secret` header) |
| `flutter_local_notifications` | In-app reminders (interviews, touchpoints, stale applications) + browser notification for the daily reminder |
| `QuoteService` | ZenQuotes → fallback list |
| CN Services / Resources ("coming soon" popups) | CareerNiche Hub with "Notify me" interest capture |
| — (new) | Public landing page, business lead form (`/api/leads`), onboarding, sample data |

### Reward rules (same as the Flutter app)
- New job → **bookmark**. First time a job reaches Applied → **apply**, Interviewed → **interview**. Moving back and forth never re-awards.
- Logging an interview → **interview**. Follow-up → **follow_up** (once per job per 24 h). New notes → **research**. New contact or touchpoint → **contacts**. Accepting an offer → **accept_offer**.
- Missions (in `catalog.py`) award points **and** tokens on completion. Goals reset daily at local midnight / weekly on Sunday. Badges: Bookmark Master, Application Spree, Interview Ace, Go-Getter, Goal Crusher, Super Connector.

## Still to wire up (placeholders)
- **Google sign-in**: button shows "coming soon". Ask Emergent to add its managed Google Auth. **LinkedIn** was "coming soon" in Flutter too.
- **Email**: set `RESEND_API_KEY` + `EMAIL_FROM`. Without it, `DEV_MODE=true` returns verification/reset links in API responses for testing.
- **Weekly report scheduler**: call `POST /api/reports/weekly/run` daily with header `X-Cron-Secret: $CRON_SECRET`.
- **Brand assets**: the logo in `components/Logo.js` is a stand-in; social links, testimonials, Privacy/Terms copy and CareerNiche Club URL are placeholders.
- **Data migration** from Supabase is not included (schemas differ slightly — see `catalog.py` and the route files).
