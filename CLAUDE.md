# BASIRET — Project Context

## What is BASIRET?
AI-powered social media analytics platform for SMEs.
Name means "insight/vision" in Arabic (بصيرة).
Graduation capstone (MIS400) at Near East University.
Student: Manasik Ibnouf | ID: 20234610 | Supervisor: Nomazwe Sibanda

---

## Current Status
- Sprint 8 in progress — all 11 screens built, inner pages complete, testing + docs phase
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

**Sprint 4 (commit adc9cdd):**
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

**Sprint 5 (current commit):**
- React + Vite + TypeScript frontend scaffolded in `frontend/` with Tailwind CSS v4
- Frontend Docker container added to docker-compose on port 3000 with API proxy to backend
- i18next configured for EN/AR with browser language detection; `dir="rtl"` synced on mount via `useEffect`
- Glassmorphism UI: semi-transparent cards with backdrop-blur on `#F5F3FF` background
- Brand colors as Tailwind theme tokens: primary `#664FA1`, accent `#A5DDEC`, CTA `#BF499B`, text `#484848`
- Fixed left sidebar with 7 nav items (active state in primary), collapses to bottom tab bar on mobile
- Top bar with date range selector and EN/AR language toggle
- KPI cards row: Total Reach, Avg Engagement Rate, Sentiment Score, Active Segments
- Engagement trend area chart (Recharts) with likes + comments, gradient fills
- Sentiment donut chart showing positive/neutral/negative distribution
- Top posts table with content type icons, likes, comments, dates
- All dashboard components connected to real API via React Query hooks
- `GET /api/v1/analytics/accounts` endpoint added to backend (returns active social accounts for frontend)
- Sentiment API response transformed in frontend: nested `sentiment.positive.count` → flat `{ positive, neutral, negative, avg_score }`
- Charts pinned to `dir="ltr"` so axes always read left-to-right in RTL mode; titles use `dir="auto"`
- Chart grid row uses `dir="ltr"` so engagement chart stays left and donut stays right regardless of page direction
- TypeScript 6 clean (zero errors), Vite production build succeeds
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
- Frontend uses relative imports (no path aliases) due to TypeScript 6 deprecating `baseUrl`/`paths`
- Recharts charts wrapped in `dir="ltr"` divs; surrounding text labels use `dir="auto"` for proper RTL
- Engagement chart and top posts table use mock data derived from real API totals (no time-series endpoint yet)
- `.dockerignore` excludes `node_modules` and `dist` from frontend Docker build context
- Vite dev server proxies `/api` to `http://api:8000` inside Docker network
- `useEffect` on `i18n.language` syncs `document.documentElement.dir` on mount (not just on toggle click)

**Sprint 6 (current commit):**
- JWT auth system: `POST /auth/register` (creates user + org + starter subscription), `/auth/login` (access token + httpOnly refresh cookie), `/auth/refresh` (token rotation with Redis blacklist), `/auth/logout`, `GET /auth/me`
- Security module (`app/core/security.py`): bcrypt password hashing, JWT creation/validation, Redis-backed refresh token blacklist with TTL
- Auth dependencies (`app/core/deps.py`): `get_current_user`, `require_admin`, `require_system_admin`, `RequireFeature` (checks feature_flag table by plan tier)
- All `/analytics/*` and `/instagram/*` endpoints now require JWT bearer token; return 401 if missing/invalid
- Hardcoded `organization_id` (`00000000-...`) replaced with real `user.organization_id` from JWT in all endpoints
- All analytics queries scoped to the authenticated user's organization (multi-tenant)
- Feature flag middleware: sentiment and segments endpoints gated by `RequireFeature`; returns 403 with `{locked: true}` for starter plan
- Stripe billing endpoints: `GET /billing/plans`, `GET /billing/subscription`, `POST /billing/create-checkout` (Stripe Checkout session), `POST /billing/portal`, `POST /webhooks/stripe` (signature-verified, updates subscription on payment)
- Admin endpoints (system_admin only): `GET /admin/users`, `PATCH /admin/users/:id`, `GET /admin/orgs`, `GET /admin/flags`, `PATCH /admin/flags/:id`
- CORS middleware added to FastAPI (allows frontend origin + credentials)
- `stripe==9.12.0` added to requirements; `bcrypt==4.0.1` pinned (passlib compatibility fix)
- Frontend: `AuthContext` with in-memory token storage, session restore via refresh cookie on mount
- Frontend: Axios interceptor auto-refreshes on 401, queues concurrent requests, rejects all on failure (no hanging promises)
- Frontend: `ProtectedRoute` wrapper redirects to `/login` if no session; optional `requiredRole` check
- Frontend: Login page with glassmorphism style, password eye toggle, error handling
- Frontend: Multi-step onboarding wizard at `/register` — Step 1 (registration form), Step 2 (Connect Instagram with permissions info), Step 3 ("You're all set!" completion)
- Frontend: Step indicator component (numbered circles with labels, connector lines, checkmarks for completed steps)
- Frontend: Sidebar updated to React Router `Link`, admin nav for system_admin, logout button, user name display
- Frontend: `LockedFeature` component — blurred overlay with lock icon, click opens pricing modal, "Upgrade Now" redirects to Stripe Checkout
- Frontend: Admin panel at `/admin` — user management table (role dropdown, activate/deactivate) + feature flag toggle switches
- Frontend: API error handling fixed — Pydantic validation arrays extracted to readable messages, client-side password validation
- Frontend: i18n translations added for auth, admin, pricing, onboarding (EN + AR)
- `.env.example` updated with `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_INSIGHTS_PRICE_ID`, `FRONTEND_URL`
- TypeScript 6 clean (zero errors), Vite production build succeeds
- Full test suite: 16/16 passed (integration tests updated to verify auth enforcement)

### Key decisions
- Token encryption uses Fernet with PBKDF2 key derivation from SECRET_KEY (not a separate encryption key)
- Celery tasks use explicit `include` in config (autodiscover wasn't reliable with volume mounts)
- Instagram sync creates one engagement_metric row per sync per post (append, not upsert) to track changes over time
- Sentiment + OCR models are lazy-loaded (once per worker process) to avoid startup cost
- `torch` pinned to CPU-only build (`+cpu` wheel) to keep Docker image size manageable
- OCR runs only on image/carousel posts; video/reel audio transcription deferred to Whisper integration
- Per-post error handling in batch task: failed posts are skipped (logged) without aborting the batch
- Batch commits every 10 posts to avoid long-running DB transactions
- Segmentation clusters **posts** (not followers) since Instagram Basic Display API doesn't expose follower-level engagement
- Frontend uses relative imports (no path aliases) due to TypeScript 6 deprecating `baseUrl`/`paths`
- Recharts charts wrapped in `dir="ltr"` divs; surrounding text labels use `dir="auto"` for proper RTL
- Engagement chart and top posts table use mock data derived from real API totals (no time-series endpoint yet)
- Vite dev server proxies `/api` to `http://api:8000` inside Docker network
- Access token stored in memory (not localStorage) to prevent XSS token theft
- Refresh token sent as httpOnly cookie scoped to `/api/v1/auth` path
- Refresh token rotation: old token blacklisted in Redis on each refresh (prevents replay)
- `bcrypt==4.0.1` pinned to avoid passlib compatibility bug with bcrypt>=4.1
- Registration creates user as `admin` role of a new organization (not `viewer`)
- Onboarding wizard is a single React component with local state transitions (no router navigation between steps) to avoid state-timing bugs
- Stripe webhook endpoint has no JWT auth — verified by Stripe signature instead

### Known issues / TODOs
- `alembic stamp head` needs to be run once to mark existing DB as current before future migrations
- Pydantic V2 deprecation warning: `class Config` → `ConfigDict` in settings (cosmetic)
- SQLAlchemy `declarative_base()` deprecation warning (should use `sqlalchemy.orm.declarative_base`)
- Instagram Basic Display API scope uses `instagram_business_basic` — verify this matches the Meta app type
- Shares, saves, reach, impressions always 0 — these require Instagram Insights API (business/creator accounts)
- Audio transcription with Whisper not yet implemented (Sprint 3 stretch goal → deferred)
- Topic extraction (`analysis_result.topics`) stores empty array — needs keyword/topic model in future sprint
- First analysis run per container is slow (~25 min) due to HuggingFace model download; subsequent runs use cached volume
- `engagement_rate` is 0 for all posts — segments differentiate mainly on likes, comments, content type, and posting time
- Engagement chart uses synthetic trend data — needs dedicated time-series API endpoint
- Top posts table uses mock data — needs `GET /api/v1/analytics/posts` endpoint
- Vite production build chunk >500KB due to Recharts — consider code-splitting in future sprint
- Audience segmentation view with persona cards not yet built (stretch goal for Sprint 5)
- Invite flow (`POST /auth/invite`) not yet implemented
- Forgot password / reset password flow not yet implemented
- Instagram OAuth callback should redirect back to frontend onboarding step 2 after success
- Stripe webhook fully functional — see `docs/STRIPE_SETUP.md` for local testing with Stripe CLI
- Stripe CLI pre-installed in API container; run `docker compose exec api stripe listen --forward-to localhost:8000/api/v1/billing/webhooks/stripe` for local dev
- For production: add webhook endpoint in Stripe Dashboard (Settings → Webhooks → URL: `https://yourdomain/api/v1/billing/webhooks/stripe`)

**Sprint 7 (current commit):**
- Comprehensive test suite: 60 integration tests across 8 test files, all passing against real containers
- Shared `conftest.py` with fixtures: DB session, auth helpers (starter/insights/system_admin/viewer users), test data seeding with auto-cleanup
- `test_auth.py` (9 tests): register, login, logout, refresh token rotation, duplicate email, wrong password, weak password, nonexistent email, `/me` endpoint
- `test_protected_routes.py` (4 tests): 401 without token, 401 bad token, 403 non-admin on admin endpoints, 403 viewer on admin endpoints
- `test_billing.py` (9 tests): list plans, get subscription, no-auth guard, create checkout session, portal guard, webhook checkout.session.completed (verifies plan upgrade + feature flag seeding), webhook payment_failed (past_due), webhook subscription.deleted (downgrade), webhook invalid signature (400)
- `test_feature_flags.py` (4 tests): starter blocked from sentiment, starter blocked from segments, insights can access sentiment with seeded data, disabled flag still blocks
- `test_instagram.py` (5 tests): auth URL generation, auth URL requires auth, sync triggers Celery task, disconnect account, disconnect nonexistent account (404)
- `test_analytics.py` (6 tests): overview empty, overview with seeded data (verifies totals), accounts list, trigger analysis, segments with data, regenerate segments
- `test_admin.py` (7 tests): list users, update user role, invalid role (400), deactivate user, list organizations, list feature flags, toggle feature flag
- GitHub Actions CI pipeline (`.github/workflows/ci.yml`): runs on every push to any branch
  - `backend-tests` job: Python 3.11, real PostgreSQL 15 + Redis 7 service containers, `pytest tests/ -v`
  - `frontend-build` job: Node 20, `npm install` + `tsc --noEmit` + `npm run build`
- Stripe webhook handler rewritten (`app/api/v1/billing.py`):
  - `checkout.session.completed`: upgrades plan to insights, seeds feature flags (`sentiment_analysis`, `audience_segmentation`, `content_recommendations`)
  - `invoice.payment_succeeded`: confirms active status, fetches Stripe subscription for period dates
  - `invoice.payment_failed`: marks subscription `past_due`
  - `customer.subscription.updated`: syncs status + period dates
  - `customer.subscription.deleted`: downgrades to starter, clears Stripe fields
  - `_seed_feature_flags()` helper ensures Pro endpoints unlock immediately after payment
  - Structured logging on every webhook event
- Stripe CLI installed in backend Dockerfile for local webhook testing
- `docs/STRIPE_SETUP.md`: step-by-step guide for local Stripe testing (API keys, price creation, CLI auth, webhook listener, test cards, troubleshooting)
- Full test suite: 60/60 passed in ~16s

### Key decisions
- Token encryption uses Fernet with PBKDF2 key derivation from SECRET_KEY (not a separate encryption key)
- Celery tasks use explicit `include` in config (autodiscover wasn't reliable with volume mounts)
- Instagram sync creates one engagement_metric row per sync per post (append, not upsert) to track changes over time
- Sentiment + OCR models are lazy-loaded (once per worker process) to avoid startup cost
- `torch` pinned to CPU-only build (`+cpu` wheel) to keep Docker image size manageable
- OCR runs only on image/carousel posts; video/reel audio transcription deferred to Whisper integration
- Per-post error handling in batch task: failed posts are skipped (logged) without aborting the batch
- Batch commits every 10 posts to avoid long-running DB transactions
- Segmentation clusters **posts** (not followers) since Instagram Basic Display API doesn't expose follower-level engagement
- Frontend uses relative imports (no path aliases) due to TypeScript 6 deprecating `baseUrl`/`paths`
- Recharts charts wrapped in `dir="ltr"` divs; surrounding text labels use `dir="auto"` for proper RTL
- Engagement chart and top posts table use mock data derived from real API totals (no time-series endpoint yet)
- Vite dev server proxies `/api` to `http://api:8000` inside Docker network
- Access token stored in memory (not localStorage) to prevent XSS token theft
- Refresh token sent as httpOnly cookie scoped to `/api/v1/auth` path
- Refresh token rotation: old token blacklisted in Redis on each refresh (prevents replay)
- `bcrypt==4.0.1` pinned to avoid passlib compatibility bug with bcrypt>=4.1
- Registration creates user as `admin` role of a new organization (not `viewer`)
- Onboarding wizard is a single React component with local state transitions (no router navigation between steps) to avoid state-timing bugs
- Stripe webhook endpoint has no JWT auth — verified by Stripe signature instead
- Webhook tests use HMAC-SHA256 to generate real Stripe-compatible signatures (no mocking of `construct_event`)
- Test fixtures use UUID-suffixed emails/slugs to avoid collisions between parallel test runs
- Tests run against real PostgreSQL + Redis containers — no SQLite or mocks for data layer
- CI uses `npm install` (not `npm ci`) to tolerate minor lock file drift across Node versions
- Stripe CLI installed via official Debian package in Dockerfile so devs can run `stripe listen` inside the container

### What's next — Sprint 8
- Documentation + final report
- SUS usability evaluation
- Performance profiling and optimization
- Production deployment configuration (Nginx, Let's Encrypt, VPS)

---

## Session Log — 2026-04-12

### What was built

**Sprint 8 — Inner Pages + UX Improvements:**
- 5 inner pages built and routed: Analytics, Audience, Sentiment, Recommendations, Settings
- 2 new backend endpoints added for real data on charts
- Mobile UX improvements: top bar with profile dropdown (logout + language toggle)
- Landing page phone mockup section updated
- Vite proxy fix for local dev (outside Docker)
- ~75 new i18n keys added to both EN and AR translation files

**Analytics page (`/analytics`):**
- Content type breakdown bar chart (avg likes/comments per type: image, video, carousel) — real data from `GET /api/v1/analytics/posts/breakdown`
- Posting frequency calendar heatmap (GitHub-style, colored by post count per day) — real data
- 2 action insight cards: "Reels get 3x more reach", "Tuesday mornings are your peak time"
- Top posts table (reused from dashboard)

**Audience page (`/audience`) — Pro feature:**
- 3 K-means segment persona cards from `GET /api/v1/analytics/segments`
- Each card shows: segment label, post count, dominant content type with icon, typical posting time, dominant sentiment, avg engagement
- "Create content for this segment" CTA button per card
- "Regenerate Segments" button triggering `POST /api/v1/analytics/segments/regenerate`
- Wrapped in `LockedFeature` for starter plan users

**Sentiment page (`/sentiment`) — Pro feature:**
- 3 score cards: Positive %, Neutral %, Negative % (computed from real counts)
- Sentiment trend area chart using **real time-series data** from new `GET /api/v1/analytics/sentiment/timeline` endpoint (joins AnalysisResult + Post, groups by date + sentiment label)
- Sentiment donut chart (reused from dashboard)
- Conditional action cards based on sentiment ratios (positive > 60%, neutral > 50%, negative > 30%)

**Recommendations page (`/recommendations`) — Pro feature:**
- 3 ranked recommendation cards with category badges (Timing/Engagement/Format), descriptions, supporting data, confidence bars (High 85%/Medium 60%), "Apply this" CTA
- Best time to post heatmap (7-day x 4-slot grid, intensity from segment data)
- 3 hashtag suggestion cards with copy-to-clipboard functionality

**Settings page (`/settings`):**
- Tab navigation: Profile | Organization | Notifications | Billing
- Profile tab: name + email inputs (prefilled), password change form with validation
- Organization tab: org name (read-only), connected Instagram accounts list
- Notifications tab: toggle switches for email alerts and sentiment alerts (local state)
- Billing tab: current plan display, upgrade CTA for starter users via Stripe Checkout

**Backend endpoints added:**
- `GET /api/v1/analytics/sentiment/timeline` — daily sentiment counts over time (Pro, joins AnalysisResult + Post)
- `GET /api/v1/analytics/posts/breakdown` — per-content-type engagement stats + posting dates calendar

**Mobile UX:**
- Mobile top bar added to `Sidebar.tsx` with Basiret logo and profile button (UserCircle icon)
- Profile dropdown shows: user name, language toggle (Globe icon), logout button
- Dropdown closes on outside click
- `AppLayout` updated with `pt-14 md:pt-0` for mobile top bar spacing

**Infrastructure:**
- `TopBar.tsx` now shows dynamic page title based on current route (was hardcoded to "Dashboard")
- `useBilling.ts` hook created: `useSubscription()` + `useIsFeatureLocked()` for client-side feature gating
- `useRegenerateSegments()` mutation hook with query invalidation on success
- `usePostsBreakdown()` and `useSentimentTimeline()` hooks for new endpoints
- Vite proxy target changed from `http://api:8000` to `process.env.VITE_API_URL || 'http://localhost:8000'` for local dev outside Docker
- Cleaned up unused imports in Landing.tsx (Globe, MoreHorizontal, ToggleRight, glassStyle)

### Bug fixes
- **Audience page crash**: `characteristics.avg_engagement` from JSONB could be a string; `.toFixed()` call threw TypeError. Fixed with `Number()` conversion + `isNaN` guard.
- **502 Bad Gateway on register/login**: Vite proxy targeted `http://api:8000` (Docker-internal hostname) while running frontend outside Docker. Fixed proxy to fallback to `localhost:8000`.

### Key decisions
- Sentiment trend chart uses **real data** (not mock) from new backend endpoint — important for SUS evaluation and academic report
- Settings forms handle missing backend endpoints gracefully (local state feedback, no error throws)
- All Pro pages wrapped in `LockedFeature` component — starter users see blurred content with upgrade modal
- Analytics page intentionally differentiated from Dashboard: bar chart + calendar heatmap vs engagement trend + KPI cards
- Pages are single files with inline sub-components (no sub-component directory sprawl)
- `useIsFeatureLocked()` returns `false` when subscription data is loading (show content first, lock after)

### Known issues / TODOs
- Audience page avg engagement shows "—" for segments where JSONB value is non-numeric
- Top posts table still uses mock data (needs `GET /api/v1/analytics/posts` endpoint)
- Settings profile/password save is local-only — needs backend endpoints (`PATCH /auth/profile`, `POST /auth/change-password`)
- Notification preferences are local state only — no backend persistence
- Vite production build chunk >500KB due to Recharts — consider code-splitting
- Post Detail View page not yet built (screen #8)
- Forgot password / reset password flow not yet implemented
- Invite flow (`POST /auth/invite`) not yet implemented

---

## Session Log — 2026-04-12 (Landing page polish)

### What was built
- **Glassy navbar on scroll**: Navbar gets glassmorphism background (`blur(16px)`, semi-transparent white, border + shadow) when `scrollY > 20`, transparent at top. Uses `useState` + `useEffect` scroll listener with `{ passive: true }`.
- **Larger phone mockup on desktop**: Phone SVG in ProblemStatement section changed from fixed `w-[440px]` to responsive `w-[320px] md:w-[560px]` (~27% larger on desktop).
- **Randomly scattered chips**: Feature chips in ProblemStatement section repositioned from symmetrical grid to organic, asymmetric placement with slight rotations (-5deg to +5deg) for a more natural feel.

### Key decisions
- Scroll threshold of 20px chosen so the glass effect kicks in immediately without being visible on initial load
- Chip rotations kept subtle (±5deg max) to look organic without hurting readability
- Phone SVG uses responsive width classes rather than a fixed size to work across breakpoints

---

## Session Log — 2026-04-17

### What was built

**AI-Powered Insights Generation (Gemini 2.5 Flash Lite):**
- New `insight_result` table: `social_account_id`, `week_start`, `summary`, `score` (1-100), `score_change`, `insights` (JSONB), `best_post_id`, `next_best_time`, `generated_at`
- New SQLAlchemy model `InsightResult` (`app/models/insight_result.py`), registered in `__init__.py`
- `google-generativeai==0.7.2` added to requirements; `protobuf` downgraded to `4.25.3` for compatibility
- `GEMINI_API_KEY` added to `Settings`, `.env.example`

**Celery Task — `generate_weekly_insights`** (`app/tasks/insights.py`):
- Gathers 7-day metrics: total posts, impressions, engagement per post, sentiment breakdown, top 5 posts, best posting time, historical comparison
- Builds structured user message matching the prompt schema from `prompts josn.txt`
- System prompt enforces: 3 actionable insights (not observations) with priority/title/finding/action/timeframe/expected_impact, health score 1-100, best post, next best time
- Calls Gemini 2.5 Flash Lite with `response_mime_type="application/json"` for structured output
- Fallback: if no posts in last 7 days, uses all-time post range
- Resolves `best_post_id` from Gemini response back to a real DB UUID
- Computes `score_change` against previous insight if one exists
- Registered in Celery config (`app/core/celery_app.py`)

**Gemini Persona Descriptions in Segmentation** (`app/tasks/segmentation.py`):
- Added `_generate_persona_descriptions()` — calls Gemini 2.5 Flash Lite to generate 2-3 sentence persona descriptions for each K-means cluster
- Persona stored in `characteristics.persona_description` JSONB field
- Graceful fallback: empty strings if `GEMINI_API_KEY` not set or Gemini call fails

**API Endpoints** (`app/api/v1/analytics.py`):
- `GET /api/v1/analytics/insights` — returns latest AI-generated insight for the user's first active account (Pro, gated by `RequireFeature("content_recommendations")`)
- `POST /api/v1/analytics/insights/generate` — queues Celery task, returns `task_id` (Pro)
- `content_recommendations` feature flag seeded for all 3 plan tiers in `init.sql`

**Frontend — DoThisToday Dashboard Component** (`frontend/src/components/dashboard/DoThisToday.tsx`):
- Shows top 3 AI actions with priority badges (High=CTA pink, Medium=primary purple, Low=accent blue)
- Health score progress bar with +/- change indicator
- AI-written summary text
- "Next best time to post" footer with clock icon
- Generate/Refresh button triggers Celery task
- Empty state with CTA to generate first insights
- Wrapped in `LockedFeature` for starter plan users
- Placed in Dashboard between KPI cards and charts

**Frontend API Layer:**
- `InsightAction` and `InsightData` TypeScript interfaces in `api/analytics.ts`
- `fetchInsights()` and `generateInsights()` fetch functions
- `useInsights()` and `useGenerateInsights()` React Query hooks in `hooks/useAnalytics.ts`
- 10 new i18n keys in both `en.json` and `ar.json` (insights section)

**Infrastructure:**
- `insight_result` table + index added to `db/init.sql`
- `content_recommendations` feature flag seeded for starter/insights/enterprise in `init.sql`
- Celery task list now includes `app.tasks.insights`

### Verified end-to-end
- `POST /insights/generate` → Celery picks up task → gathers 42 posts metrics → calls Gemini 2.5 Flash Lite → stores structured JSON → `GET /insights` returns score=65, 3 prioritized actions, best_post_id resolved, next_best_time="Tuesday, 16:00"
- Task completes in ~3 seconds
- Full test suite: 60/60 passed in ~13s
- TypeScript clean (zero errors), Vite production build succeeds

### Key decisions
- Gemini model: started with `gemini-1.5-flash` (deprecated, 404), then `gemini-2.0-flash` (rate limited on free tier), settled on `gemini-2.5-flash-lite` (available, free tier sufficient)
- `protobuf` downgraded from `5.27.2` to `4.25.3` to resolve dependency conflict with `google-ai-generativelanguage` which requires `protobuf<5.0.0`
- Insights endpoints gated by `content_recommendations` feature flag (matches billing webhook seeding)
- Persona descriptions in segmentation are best-effort — Gemini failure doesn't block K-means results
- `response_mime_type="application/json"` used instead of parsing markdown-wrapped JSON — Gemini returns clean JSON every time
- Score change computed server-side against previous insight (not trusting Gemini's self-reported `score_change`)

### Known issues / TODOs
- Gemini free tier has daily quota limits — production should use a paid API key
- `gemini-2.0-flash` quota was exhausted during testing; `gemini-2.5-flash-lite` used as fallback — can switch back when quota resets
- Audience page persona descriptions only appear after regenerating segments (existing segments don't have them)
- Weekly insight generation should be scheduled via Celery Beat (not just on-demand) for production
- Post Detail View page not yet built (screen #8)
- Forgot password / reset password flow not yet implemented
- Invite flow (`POST /auth/invite`) not yet implemented
- **Regenerate Segments race condition** (fix before real users): `POST /analytics/segments/regenerate` queues a Celery task that does delete-then-insert without locking. Multiple clicks in quick succession queue multiple tasks that interleave — each sees an empty table after its own delete, then all insert their own k rows, producing duplicate segment sets (observed on 2026-04-18: 3 clicks → 9 rows for k=3). Mitigate by debouncing the frontend button while the mutation `isPending`, and/or taking a Postgres advisory lock keyed on `social_account_id` inside the Celery task so regenerations serialize.
- Gemini env var in `.env` was originally named `Gemini_API_Key` but the backend reads `GEMINI_API_KEY` (pydantic is case-sensitive on Linux), so persona-description generation silently skipped on every regeneration until fixed on 2026-04-18. Audit `.env.example` to ensure the uppercase form is documented; consider a startup warning if the key is absent.

---

## Session Log — 2026-04-18

### What was built

**Sprint 8 — Navigation restructure + Home dashboard redesign:**

**Navigation rename + 4 new placeholder pages:**
- Sidebar labels renamed: Dashboard → Home, Analytics → My Posts, Audience → My Audience, Recommendations → Content Plan
- Sentiment removed as a standalone nav entry — merged into Home's "What's working" insights and the Growth Health "Audience fit" bar
- 4 new placeholder pages added, each wrapped in a reusable `ComingSoon` component ([frontend/src/pages/ComingSoon.tsx](frontend/src/pages/ComingSoon.tsx)): `/competitors`, `/trends`, `/my-goals`, `/ask-basiret`. Each shows its page-specific guiding question + "Coming soon" badge (e.g. "Who are your competitors, and how do you compare to them on Instagram?")
- Routes reorganized with semantic paths: `/my-posts`, `/my-audience`, `/content-plan`. Legacy paths (`/analytics`, `/audience`, `/recommendations`, `/sentiment`) redirect to the new URLs so bookmarks keep working
- Mobile bottom tab bar filters to the 5 primary nav items via a `primary: true` flag (Home / My Posts / My Audience / Content Plan / Settings); the 4 coming-soon pages live only in the desktop sidebar
- `TopBar.tsx` `pageTitleMap` updated for all new routes so the page header resolves correctly
- `Sentiment.tsx` page file deleted

**Home dashboard redesign ([frontend/src/pages/Dashboard.tsx](frontend/src/pages/Dashboard.tsx)):**
- **Top greeting**: time-of-day aware ("Good morning/afternoon/evening, {firstName}") with locale-formatted date; first name pulled from `useAuth()` and split off `full_name`
- **Do This Today**: existing `DoThisToday` Gemini insights component kept intact in its slot
- **Two-column middle section**:
  - Left — "Your content patterns" (originally "Who is your audience" — renamed to clarify these are content clusters, not audience personas): top-3 K-means segments by size, each rendered as a `PersonaCard` showing the Gemini-written `characteristics.persona_description` as primary text (falls back to cluster label if description is empty/missing), size percentage pill, and small tags below for dominant content type + typical posting time
  - Right — "What's working": up to 4 insight bullets with green/amber/red dot colors, all derived from real post data (no hardcoded copy). Derivations: (1) content-type winner when one format's avg_likes exceeds runner-up by >20%, (2) sentiment bucket (green ≥60% positive, red ≥30% negative, amber otherwise), (3) posting cadence (green ≥3 posts/week, amber 1-2, red 0), (4) content variety (green ≥3 formats, amber 2, red 1)
- **Bottom — "Your growth health"**:
  - Big score number (from `insights.score` when available, else computed as the average of the four bars × 100) with trend arrow showing `score_change` delta when non-zero
  - Four color-thresholded bars: Consistency (active posting days in last 14 / 7), Audience fit (positive sentiment share), Content variety (distinct content types / 3), Instagram performance (avg engagement per post vs 100-engagement benchmark)
  - Consistency helper text swaps to "Last post: {date}" (locale-formatted) when score is 0% and a last post exists, so users understand why the bar is empty
- Bar color thresholds: ≥70% emerald, ≥40% amber, else red
- Dashboard is wired up entirely through existing React Query hooks (`useOverview`, `useSentiment`, `useSegments`, `usePostsBreakdown`, `useInsights`) — no new hooks needed

**Gemini prompt reframed for content patterns ([backend/app/tasks/segmentation.py](backend/app/tasks/segmentation.py)):**
- System instruction rewritten from "marketing analyst describing audience personas" to "content-performance analyst describing the creator's own post clusters"
- Every description MUST start verbatim with: `Content posted in the <time> performs like this:` where `<time>` is lowercased `typical_posting_time` (morning/afternoon/evening/night) — the system prompt explicitly forbids "this user…" / "they are…" audience-persona framing
- User prompt relabeled "clusters" instead of "segments" to reinforce framing

**i18n updates (EN + AR):**
- `nav.*`: new keys `home`, `myPosts`, `myAudience`, `contentPlan`, `competitors`, `trends`, `myGoals`, `askBasiret` (old `dashboard`/`analytics`/`audience`/`sentiment`/`recommendations` keys removed)
- New namespaces: `comingSoon.*` (badge + 4 guiding questions) and `home.*` (greetings, section headings + subtitles, 4 bar labels + helper hints, 11 bullet variants with interpolation for `{{type}}` / `{{pct}}` / `{{n}}` / `{{date}}` / `{{name}}`)
- New key `home.bar.consistencyLastPost` for the "Last post: {date}" helper
- Content-patterns section labelled "Your content patterns" (EN) / "أنماط محتواك" (AR) with subtitle "How your content performs across different formats and times" (EN) / "كيف يؤدي محتواك عبر مختلف الأنماط والأوقات" (AR)

**Infrastructure / bug fixes:**
- Env-var case fix in `.env`: `Gemini_API_Key` → `GEMINI_API_KEY` so pydantic-settings can read it on Linux (case-sensitive). Before this fix, `_generate_persona_descriptions()` silently hit the `if not settings.GEMINI_API_KEY` guard on every regeneration and returned empty strings. `docker compose up -d api celery` required (not just `restart`) because restart preserves the container's baked-in env
- `LockedFeature` titles on [Audience.tsx](frontend/src/pages/Audience.tsx) and [Recommendations.tsx](frontend/src/pages/Recommendations.tsx) updated to reference the new nav keys (`nav.myAudience`, `nav.contentPlan`)
- Legacy `sentiment.*` i18n block left in place as dead keys (no references) — safe to prune in a later cleanup pass

### Verified end-to-end
- TypeScript check passes with zero errors (`npx tsc --noEmit`)
- Vite production build succeeds (879 KB JS, 47 KB CSS, gzipped 262 KB / 9 KB)
- Dev server (`npx vite --host` → `http://localhost:3000`) reachable; all new routes render with correct labels
- Segments regenerated with new Gemini prompt produce descriptions that begin "Content posted in the morning/afternoon performs like this:" as required
- Home "Your content patterns" cards render Gemini descriptions as primary text with content-type + time-of-day tags below
- Legacy bookmarks (`/analytics`, `/audience`, `/recommendations`, `/sentiment`) correctly redirect

### Key decisions
- URL paths renamed to match the new nav labels (`/my-posts`, `/my-audience`, `/content-plan`) rather than kept as legacy. Redirects added for bookmark continuity
- One reusable `ComingSoon` component parameterized by `titleKey`/`questionKey`/`icon` instead of four near-identical page files. Keeps the "coming soon" surface cheap to add/remove
- Mobile bottom tab bar uses a `primary: true` flag on nav items rather than a slice index, so adding or reordering placeholder items won't accidentally push Settings off the bar
- `ContentPatterns` component name (internal) + `patternsTitle`/`patternsSubtitle`/`patternsEmpty` i18n keys chosen deliberately to stop calling these clusters "audience" anywhere — they're post clusters, not people
- Persona description fallback is "cluster label if description empty", not a hardcoded default sentence — existing segments generated before Gemini integration still render acceptably rather than showing blank cards
- Bar color thresholds (70/40) picked so "green" implies active/healthy, "amber" implies needs attention, "red" implies urgent. Same thresholds used for the "What's working" bullet dot colors to keep visual semantics consistent across the two sections
- `TopBar` page title left showing "Home" on `/dashboard` even though the dashboard body already starts with a greeting — the two serve different roles (breadcrumb vs. hero) and removing the top-bar title produced a visually awkward gap
- Gemini prompt was reframed at the system-instruction level (not by post-processing frontend text) so the DB content is correct for any future consumer (e.g. AI insights job could cite a cluster description verbatim)
- AR translations kept for all new copy — RTL-ready-from-day-one invariant preserved
- Older audience_segment rows (generated before Gemini prompt + env-var fix) were cleaned up in place via `DELETE FROM audience_segment WHERE created_at < (SELECT MAX(created_at) FROM audience_segment)` to resolve the 9-row duplicate set caused by the regenerate race condition

### Known issues / TODOs
- `Regenerate Segments` race condition still present — see entry in previous session's known-issues list. Must be fixed before exposing to more users
- Gemini descriptions are English-only regardless of UI language; Arabic UI users see Arabic chrome but English persona sentences. Acceptable for MVP; a future pass could detect `i18n.language` at generation time and pass it into the Gemini system prompt
- `home.bar.instagramPerf` uses a 100-engagement-per-post benchmark for the 0-100% normalization — arbitrary and may need per-account calibration for low-follower-count users
- `useIsFeatureLocked('audience_segmentation')` wrapping on `/my-audience` page is correct, but the Home "Your content patterns" section does NOT currently lock for starter-plan users — it silently renders whatever segments exist. Decision deferred: should the Home section also respect the feature flag, or should starter users see a preview as a conversion prompt?
- Vite production build chunk still >500 KB due to Recharts — unchanged from prior sprints, same suggested fix (dynamic import of chart components)
- AR translation of "Content posted in the [time] performs like this:" intro isn't applied because the description text itself is produced by Gemini in English; the AR UI shows an English sentence inside an RTL card
