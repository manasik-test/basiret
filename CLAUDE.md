# BASIRET — Project Context

## What is BASIRET?
AI-powered social media analytics platform for SMEs.
Name means "insight/vision" in Arabic (بصيرة).
Graduation capstone (MIS400) at Near East University.
Student: Manasik Ibnouf | ID: 20234610 | Supervisor: Nomazwe Sibanda

---

## Current Status
- Sprint 2 complete — Instagram data pipeline operational
- Docker environment: FastAPI + PostgreSQL + Redis + Celery worker (4 containers)

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
- Ports: API=8000, Postgres=5433 (host), Redis=6382 (host)
- Never commit .env

---

## Session Log — 2026-04-05

### What was built

**Sprint 1 (commits ab8ddfc → 085c78b):**
- Git repo initialized on `main`, pushed to GitHub
- `.gitignore` configured for Python/Node/Docker/IDE files
- Alembic initialized in `backend/`, wired to `DATABASE_URL` from settings
- 9 SQLAlchemy models created matching `db/init.sql` (with enums, relationships, indexes, constraints)
- Baseline migration generated (empty — DB already has schema from init.sql)
- 3 pytest smoke tests: app starts, health endpoint, all 9 tables exist

**Sprint 2 (commit fc97a15):**
- Instagram OAuth endpoints: `GET /auth-url`, `GET /callback` (short → long-lived token exchange)
- Fernet token encryption (`app/core/encryption.py`) using PBKDF2-derived key from SECRET_KEY
- Celery app + worker container added to docker-compose
- `sync_instagram_posts` Celery task: fetches `/me/media`, upserts posts with raw JSONB, records engagement metrics
- `POST /api/v1/instagram/sync` endpoint: triggers sync, auto-bootstraps test org/account from INSTAGRAM_TEST_TOKEN
- `GET /api/v1/analytics/overview` endpoint: returns KPI totals (posts, likes, comments, engagement, connected accounts)
- Verified end-to-end: 42 real posts synced from Instagram with engagement data

### Key decisions
- Token encryption uses Fernet with PBKDF2 key derivation from SECRET_KEY (not a separate encryption key)
- Celery tasks use explicit `include` in config (autodiscover wasn't reliable with volume mounts)
- Test org uses UUID `00000000-0000-0000-0000-000000000000` as placeholder until auth is built
- Instagram sync creates one engagement_metric row per sync per post (append, not upsert) to track changes over time

**Sprint 3 (commit 22e6f29):**
- NLP pipeline Celery task (`app/tasks/nlp_analysis.py`): sentiment analysis + language detection + OCR
- Sentiment model: `cardiffnlp/twitter-xlm-roberta-base-sentiment` (XLM-RoBERTa, multilingual EN+AR)
- Language detection via `langdetect` — updates `post.language` column from `unknown` to detected lang
- EasyOCR integration (en+ar) for image/carousel posts — extracts text from images before analysis
- Combined analysis: caption + OCR text → language detect → sentiment classify → store in `analysis_result`
- Two Celery tasks: `analyze_posts` (batch all unanalyzed) and `analyze_single_post_task` (on-demand by ID)
- `POST /api/v1/analytics/analyze` endpoint: triggers batch analysis, returns task_id
- `GET /api/v1/analytics/sentiment` endpoint: returns sentiment distribution (counts + avg scores)
- HuggingFace model cache persisted via Docker volume (`huggingface_cache`) to survive rebuilds
- Dockerfile updated: `libgl1` + `libglib2.0-0` system deps for EasyOCR/OpenCV, extended pip timeout
- Verified end-to-end: 42/42 posts analyzed (12 positive, 30 neutral, 0 negative)

### Key decisions
- Token encryption uses Fernet with PBKDF2 key derivation from SECRET_KEY (not a separate encryption key)
- Celery tasks use explicit `include` in config (autodiscover wasn't reliable with volume mounts)
- Test org uses UUID `00000000-0000-0000-0000-000000000000` as placeholder until auth is built
- Instagram sync creates one engagement_metric row per sync per post (append, not upsert) to track changes over time
- Sentiment + OCR models are lazy-loaded (once per worker process) to avoid startup cost
- `torch` pinned to CPU-only build (`+cpu` wheel) to keep Docker image size manageable
- OCR runs only on image/carousel posts; video/reel audio transcription deferred to Whisper integration
- Per-post error handling in batch task: failed posts are skipped (logged) without aborting the batch
- Batch commits every 10 posts to avoid long-running DB transactions

**Sprint 4 (current commit):**
- K-means audience segmentation Celery task (`app/tasks/segmentation.py`)
- 11-dimension feature vector per post: engagement (likes, comments, engagement_rate), sentiment (score, is_positive, is_negative), content type (is_image, is_video, is_carousel), temporal (hour_of_day, day_of_week)
- StandardScaler on numeric features; binary features left unscaled
- Automatic k selection via silhouette score (range 2–5); forced k=2 for small datasets (10–19 posts)
- Human-readable cluster labels auto-generated from centroid values (e.g., "Low-Engagement Video Afternoon")
- Rich `characteristics` JSONB per segment: centroid, post_ids, silhouette_score, avg_engagement, dominant_content_type, dominant_sentiment, typical_posting_time
- `POST /api/v1/analytics/segments/regenerate` endpoint: queues Celery task, returns task_id
- `GET /api/v1/analytics/segments` endpoint: returns segments for a social account
- `scikit-learn==1.5.1` added to requirements
- 13 new tests (unit + integration) in `tests/test_segmentation.py`
- Verified end-to-end: 42 posts → 3 segments (silhouette=0.241), task completes in <1s
- Full test suite: 16/16 passed

### Key decisions
- Token encryption uses Fernet with PBKDF2 key derivation from SECRET_KEY (not a separate encryption key)
- Celery tasks use explicit `include` in config (autodiscover wasn't reliable with volume mounts)
- Test org uses UUID `00000000-0000-0000-0000-000000000000` as placeholder until auth is built
- Instagram sync creates one engagement_metric row per sync per post (append, not upsert) to track changes over time
- Sentiment + OCR models are lazy-loaded (once per worker process) to avoid startup cost
- `torch` pinned to CPU-only build (`+cpu` wheel) to keep Docker image size manageable
- OCR runs only on image/carousel posts; video/reel audio transcription deferred to Whisper integration
- Per-post error handling in batch task: failed posts are skipped (logged) without aborting the batch
- Batch commits every 10 posts to avoid long-running DB transactions
- Segmentation clusters **posts** (not followers) since Instagram Basic Display API doesn't expose follower-level engagement
- Posts without engagement_metric rows are excluded from clustering (logged as warning)
- Existing segments are fully replaced on regenerate (delete-then-insert)
- scikit-learn KMeans uses `random_state=42` for reproducible results

### Known issues / TODOs
- `organization_id` is hardcoded in OAuth callback and sync — must wire to JWT in Sprint 6
- `alembic stamp head` needs to be run once to mark existing DB as current before future migrations
- Pydantic V2 deprecation warning: `class Config` → `ConfigDict` in settings (cosmetic)
- SQLAlchemy `declarative_base()` deprecation warning (should use `sqlalchemy.orm.declarative_base`)
- Instagram Basic Display API scope uses `instagram_business_basic` — verify this matches the Meta app type
- Shares, saves, reach, impressions always 0 — these require Instagram Insights API (business/creator accounts)
- Audio transcription with Whisper not yet implemented (Sprint 3 stretch goal → deferred)
- Topic extraction (`analysis_result.topics`) stores empty array — needs keyword/topic model in future sprint
- First analysis run per container is slow (~25 min) due to HuggingFace model download; subsequent runs use cached volume
- `engagement_rate` is 0 for all posts — segments differentiate mainly on likes, comments, content type, and posting time
- Feature flag enforcement for segments endpoint deferred until JWT auth lands in Sprint 6

### What's next — Sprint 5
- React dashboard (frontend)
- KPI cards, engagement chart, sentiment donut, top posts table
- Audience segmentation view with persona cards
- RTL-ready layout from day one
