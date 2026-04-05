# BASIRET — Project Context

## What is BASIRET?
AI-powered social media analytics platform for SMEs.
Name means "insight/vision" in Arabic (بصيرة).
Graduation capstone (MIS400) at Near East University.
Student: Manasik Ibnouf | ID: 20234610 | Supervisor: Nomazwe Sibanda

---

## Current Status
- Sprint 1 in progress — Docker + DB + GitHub setup
- Docker environment running: FastAPI + PostgreSQL + Redis

---

## Tech Stack (locked)
- **Backend:** Python + FastAPI, SQLAlchemy, Alembic, Celery + Redis
- **Database:** PostgreSQL (multi-tenant)
- **Frontend:** React + Tailwind CSS (RTL-ready from day one)
- **NLP:** cardiffnlp/twitter-xlm-roberta-base-sentiment (HuggingFace)
- **OCR:** EasyOCR | **Audio:** OpenAI Whisper
- **Auth:** Instagram OAuth 2.0 + JWT
- **Payments:** Stripe (test mode)
- **Infra:** Docker Compose locally, VPS + Nginx + Let's Encrypt in production

---

## Core Principles (never violate)
1. Scalability-first — every decision: "will this need rebuilding at scale?"
2. Platform-agnostic connectors — Instagram V1, designed to add more platforms later
3. Model-agnostic AI layer — HuggingFace V1, swappable to GPT-4/Gemini without touching other code
4. Multilingual from day one — Arabic is V1, not a future feature
5. Locked-not-hidden UI — Free tier sees Pro features locked, not absent
6. Multi-tenant from day one — every table scoped to organization_id
7. RTL-ready from day one — no retrofitting later
8. /api/v1/ versioning always
9. Raw content stored separately from analysis results

---

## Database — 9 Tables
1. organization — tenant root
2. user — roles: system_admin / admin / manager / viewer
3. subscription — Stripe, plan tiers
4. social_account — OAuth tokens (encrypted)
5. post — platform + content_type + language + raw_data (JSONB)
6. analysis_result — sentiment + score + topics + ocr_text + audio_transcript
7. engagement_metric — likes, comments, shares, saves, reach, impressions
8. audience_segment — K-means clusters
9. feature_flag — plan_tier + feature_name + is_enabled (runtime access control, no redeploy needed)

---

## Pricing Tiers
- **Starter** (Free): basic metrics, 1 account, 30 days history, AI features locked-not-hidden
- **Insights** ($29/mo): full AI EN+AR, segmentation, recommendations, 3 accounts, 12mo history
- **Enterprise** (custom): unlimited accounts, white-label, Arabic dialect tuning

---

## Sprint Plan
- S1 Wk1-2: Docker + DB + GitHub (CURRENT)
- S2 Wk3-4: Instagram OAuth + data pipeline
- S3 Wk5-6: NLP pipeline (85%+ F1 target)
- S4 Wk7-8: Behavior engine + K-means segmentation
- S5 Wk9-10: React dashboard
- S6 Wk11-12: Auth + Stripe + admin panel
- S7 Wk13-14: Testing + SUS evaluation
- S8 Wk15-16: Documentation + final report

---

## Screens (11)
1. Landing page
2. Auth (Register / Login / Forgot Password / Reset / Invite Accept)
3. Onboarding — Connect Instagram
4. Main Dashboard — KPI cards, engagement chart, sentiment donut, top posts table
5. Audience Segmentation (Pro) — persona cards, detail drawer, K-means
6. Sentiment Analysis (Pro) — score cards, trend chart, labeled comments feed, topic word cloud
7. Content Recommendations (Pro) — recommendation cards, best-time heatmap, hashtag suggestions
8. Post Detail View — metrics, OCR results, audio transcript, sentiment breakdown
9. Pricing & Upgrade — plan comparison, Stripe checkout
10. Settings — profile, team, billing, danger zone
11. Admin Dashboard (/admin, system_admin only) — user management, feature flag control

---

## API Endpoints (36, all prefixed /api/v1/)
Response envelope: { success, data, error }

### Auth (7) — public or JWT
POST /auth/register, /auth/login, /auth/refresh, /auth/logout
POST /auth/forgot-password, /auth/reset-password, /auth/invite

### Instagram OAuth (5) — JWT
GET /instagram/auth-url, /instagram/callback, /instagram/accounts
DELETE /instagram/accounts/:id
POST /instagram/accounts/:id/refresh

### Analytics (9) — JWT, some Pro only
GET /analytics/overview, /posts, /posts/:id, /engagement
GET /analytics/sentiment (Pro), /segments (Pro), /recommendations (Pro), /best-time (Pro)
POST /analytics/segments/regenerate (Pro) — queues Celery task, returns task_id

### Billing (5) — JWT
GET /billing/plans, /billing/subscription
POST /billing/create-checkout, /billing/portal, /webhooks/stripe

### Admin (7) — system_admin only
GET /admin/users, /admin/orgs, /admin/flags, /admin/health, /admin/audit
PATCH /admin/users/:id, /admin/flags/:id

### Error codes
400 validation | 401 invalid JWT | 403 wrong role/plan | 404 not found
422 business logic | 429 rate limit | 500 never expose stack traces

---

## Environment
- Dev: Windows 11, Docker Desktop, Cursor + Claude Code
- Ports: API=8000, Postgres=5432, Redis=6380
- Never commit .env
