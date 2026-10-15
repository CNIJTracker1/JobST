# Emergent kickoff prompt

Paste this into Emergent after pulling this repo (or uploading the code) into a new task:

---

This repo is the starting code for the **CareerNiche Job Tracker**. It's a React + FastAPI + MongoDB port of our Flutter/Supabase app, already laid out the way you expect (`/backend` FastAPI on port 8001 with every route under `/api`, `/frontend` React/CRA + craco + Tailwind reading `REACT_APP_BACKEND_URL`). Read `README.md` first.

Please:
1. Install dependencies, set up the `.env` files from `.env.example`, start both services, and run `cd backend && pytest -q` (6 tests should pass).
2. Keep the existing features, data model and reward rules (`backend/catalog.py`, `backend/rewards.py`). Don't rewrite working code; extend it.
3. Replace the Google sign-in placeholder in `frontend/src/pages/Auth.js` with Emergent-managed Google Auth, issuing the same JWT our `/api/auth/*` routes use.
4. Wire email with Resend (`RESEND_API_KEY`, `EMAIL_FROM`) for verification, password reset and the weekly report, and schedule `POST /api/reports/weekly/run` daily with the `X-Cron-Secret` header.
5. Polish only where it adds value. Positioning stays "Not another job board — your career community": we connect job seekers, local businesses and CareerNiche coaches. Brand green is #76BC21, and the landing page stays brand-green.
6. When done, list every placeholder I still need to replace: logo, social links, testimonials, Privacy/Terms copy, CareerNiche Club URL and booking links.
