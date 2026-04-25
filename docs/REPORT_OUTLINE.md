# BASIRET — Graduation Report Outline

**Course:** MIS400 — Graduation Project
**Institution:** Near East University
**Student:** Manasik Ibnouf · ID 20234610
**Supervisor:** Nomazwe Sibanda
**Status:** Outline — chapters expanded as drafted

This is a working skeleton. Each chapter lists the points it must cover, sourced from the actual implementation captured in [CLAUDE.md](../CLAUDE.md) so the report stays grounded in what was actually built rather than what was planned. Replace bullets with prose chapter-by-chapter. Standard target length for an undergraduate MIS thesis at NEU is 60–90 pages; this outline assumes ~70 pages.

---

## Front matter (≈ 6 pages)

- Cover page (title, course code, student info, supervisor, NEU logo, date)
- Approval / Declaration page (signed by supervisor + student)
- Plagiarism statement
- Acknowledgements
- Abstract — English (~250 words)
- Abstract — Arabic (~250 words, mirror translation)
- Table of contents
- List of figures
- List of tables
- List of abbreviations (FastAPI, OAuth, JWT, K-means, NLP, OCR, RTL, SaaS, SME, SUS, …)

**To draft once chapters stabilise.** The abstract should lead with the differentiator: per-comment multilingual sentiment classification, which Meta Business Suite does not offer.

---

## Chapter 1 — Introduction (≈ 6 pages)

### 1.1 Background and motivation
- SME social-media gap: small businesses post into a void, no time to interpret analytics dashboards.
- Existing tools (Meta Business Suite, Hootsuite, Buffer) surface metrics but not actions.
- Arabic-speaking SMEs are underserved — no production tool offers per-comment Arabic sentiment.

### 1.2 Problem statement
- SMEs need *what to do next*, not more charts.
- Multilingual audience analysis (Arabic + English) is treated as a future feature by competitors, not a day-one capability.
- Comment-level sentiment, the strongest signal of audience reaction, is locked behind enterprise tooling.

### 1.3 Objectives
1. Deliver an end-to-end SaaS that ingests Instagram data, classifies comment sentiment per language, and surfaces 3 daily actions.
2. Reach ≥ 85% F1 on the EN+AR sentiment pipeline (cardiffnlp/twitter-xlm-roberta-base-sentiment baseline).
3. Multi-tenant architecture from day one, RTL-ready frontend, locked-not-hidden Pro features.
4. Score ≥ 70 on SUS usability (industry "good" threshold).

### 1.4 Scope and limitations
- Scope: Instagram Business Login (one platform end-to-end). Architecture is platform-agnostic; LinkedIn / X / TikTok stubbed as Coming Soon.
- Limitations: Free-tier Instagram API does not expose `reach` / `impressions`; Gemini free-tier rate limits; Meta App Review pending for `instagram_business_manage_comments` scope.

### 1.5 Significance
- Academic: contributes a working artefact demonstrating per-comment multilingual sentiment at SME scale.
- Practical: 90-day usable runway for a non-technical owner, not a research prototype.

### 1.6 Report structure
- One paragraph per chapter, summarising flow.

---

## Chapter 2 — Literature Review (≈ 10 pages)

### 2.1 Social-media analytics for SMEs
- Survey of academic + industry literature on small-business social adoption.
- Gap: most literature targets enterprise dashboards or consumer behaviour, not 3-action recommendations for owners.

### 2.2 Multilingual sentiment classification
- Transformer architectures (BERT, RoBERTa, XLM-R).
- Cross-lingual transfer for low-resource Arabic dialects.
- Cardiff NLP's `twitter-xlm-roberta-base-sentiment` — chosen baseline. Justify against alternatives: AraBERT, MARBERT, GPT-4 zero-shot.

### 2.3 Audience segmentation
- K-means vs. hierarchical vs. DBSCAN for behavioural clustering.
- Silhouette score for k-selection.
- Why we cluster *posts* (not followers) given Instagram Basic Display API constraints.

### 2.4 Action-oriented analytics (the differentiator)
- "Insights vs. dashboards" framing: prior art (e.g. Sprout Social's content suggestions) treats AI as a sidecar; BASIRET treats action as the surface.
- LLM-as-advisor pattern (Gemini, Claude) for grounded answers over user data — newer, less-surveyed area.

### 2.5 Bilingual (RTL) UI engineering
- Logical CSS properties, `dir="rtl"`, font selection (Tajawal, IBM Plex Sans Arabic).
- Survey of how major SaaS handles Arabic — most retrofit it; the project committed to day-one RTL.

### 2.6 Summary and research positioning
- Where BASIRET sits in the literature: combines (a) per-comment Arabic sentiment, (b) action-first UX, (c) multi-tenant SaaS architecture — none of the surveyed prior work covers all three.

---

## Chapter 3 — System Analysis (≈ 10 pages)

### 3.1 Methodology
- Agile sprints (Sprint 1 → Sprint 8), each ≈ 2 weeks. See sprint-by-sprint log in `CLAUDE.md`.
- "Scalability-first" core principle: every decision audited for "will this need rebuilding at scale?".

### 3.2 Stakeholders
- SME owners (primary) — non-technical, time-poor.
- Content creators / agencies (secondary).
- Supervisor + academic reviewers.

### 3.3 Functional requirements
Drawn from the 36-endpoint API surface and 11 screens. Group by:
- Auth & multi-tenancy (register, login, JWT refresh rotation, invite).
- Instagram OAuth + sync (auth-url, callback, sync, disconnect).
- Sentiment & segmentation (Pro, feature-flag-gated).
- AI insights & content plan (Gemini-backed).
- Billing (Stripe, plan tiers).
- Admin (system_admin scope).

### 3.4 Non-functional requirements
- Multi-tenant isolation (org-scoped queries everywhere).
- RTL from day one.
- Locked-not-hidden Pro features.
- /api/v1 versioning, response envelope `{success, data, error}`.
- Rate-limiting per AI provider per account.
- Graceful AI degradation (cached responses with `meta.status` envelope).

### 3.5 Use-case diagrams
- *Figures: UML use-case for owner / system_admin / Stripe webhook.*

### 3.6 Risk analysis
- Instagram API scope changes (mitigated by graceful degradation).
- Gemini free-tier exhaustion (mitigated by per-account quota gates + multi-provider routing).
- Race conditions (e.g. concurrent segment regenerate) — fixed via Postgres advisory lock.

---

## Chapter 4 — System Design (≈ 12 pages)

### 4.1 Architecture overview
- 4-container Docker stack: FastAPI API, Postgres, Redis, Celery worker (+ frontend container in dev).
- *Figure: high-level architecture diagram.*

### 4.2 Tech-stack rationale
- Backend: FastAPI (async + OpenAPI), SQLAlchemy + Alembic, Celery + Redis.
- DB: Postgres (multi-tenant, JSONB for raw_data + characteristics).
- Frontend: React + Vite + Tailwind v4, React Query, react-i18next.
- NLP: cardiffnlp/twitter-xlm-roberta-base-sentiment (HuggingFace), EasyOCR, faster-whisper.
- AI: Gemini 2.5 Flash Lite (insights, personas, page generation) + OpenAI gpt-4o-mini (captions); abstracted behind `AIProvider` interface for swappability.
- Auth: JWT access + httpOnly refresh cookie, refresh rotation with Redis blacklist.
- Payments: Stripe Checkout + signature-verified webhooks.

### 4.3 Database schema (9 tables)
1. `organization` — tenant root.
2. `user` — roles: system_admin / admin / manager / viewer.
3. `subscription` — Stripe linkage, plan tiers.
4. `social_account` — encrypted OAuth tokens (Fernet, PBKDF2-derived).
5. `post` — platform + content_type + language + raw_data JSONB.
6. `analysis_result` — sentiment + score + topics + ocr_text + audio_transcript; nullable `post_id` and `comment_id` with XOR check constraint.
7. `engagement_metric` — append-only time series.
8. `audience_segment` — K-means clusters with characteristics JSONB.
9. `feature_flag` — runtime access control by plan tier.
- Plus: `comment`, `insight_result`, `ai_page_cache`, `ai_usage_log`, `goal`, `recommendation_feedback` — added across sprints.
- *Figure: ERD.*

### 4.4 API design
- 36 endpoints, all `/api/v1`-prefixed.
- Response envelope `{success, data, error, meta?}` for AI degradation.
- Document each route group as a table: method · path · auth · feature flag · purpose.

### 4.5 Frontend information architecture
- 11 screens (Landing, Auth, Onboarding, Home, My Posts, My Audience, Sentiment, Content Plan, Settings, Pricing, Admin) — list each.
- Screen-to-API mapping table.
- Marketing site (22 routes) ported from a Next.js design source — covered in implementation chapter.

### 4.6 Security design
- Token encryption at rest (Fernet, PBKDF2 from `SECRET_KEY`).
- Refresh-token rotation with Redis blacklist.
- OAuth state JWT (signed, 10-min TTL) instead of bare user JWT through Meta's redirect.
- bcrypt password hashing (pinned 4.0.1 to avoid passlib bug).
- CORS scoped to frontend origin.
- Stripe webhook signature verification (no JWT — verified by HMAC).

### 4.7 NLP / AI architecture
- Model lifecycle: lazy-loaded once per Celery worker.
- Per-comment + per-post sentiment via shared `_run_sentiment_batch` helper.
- Topic extraction is opt-in (`POST_TOPIC_EXTRACTOR=local|gemini|off`) — quota protection.
- AIProvider abstraction → routing table → typed exceptions (Quota, Unavailable, InvalidResponse).
- Server-side cache (`ai_page_cache`, 24h soft / 72h hard TTL, stale-while-revalidate).

### 4.8 RTL / i18n design
- `react-i18next` JSON keys + Tajawal font for Arabic.
- Per-string direction inference (`dir="auto"` for mixed-script comments).
- Charts wrapped in `dir="ltr"` so axes always read LTR.

---

## Chapter 5 — Implementation (≈ 14 pages, sprint-organised)

Drawn from the eight Session Log blocks in `CLAUDE.md`. For each sprint: goal, key components built, decisions, evidence.

### 5.1 Sprint 1 — Docker, schema, baseline
- Repo init, `.gitignore`, Alembic, 9 SQLAlchemy models, baseline migration, 3 smoke tests.

### 5.2 Sprint 2 — Instagram OAuth + sync pipeline
- OAuth endpoints, Fernet token encryption, Celery worker, `sync_instagram_posts` task. 42 real posts ingested.

### 5.3 Sprint 3 — NLP pipeline (the differentiator)
- XLM-RoBERTa lazy-loaded, langdetect, EasyOCR for image posts, batch-of-25 commits.
- Caption + OCR text fed as one document with `[IMAGE TEXT]:` separator (preserves langdetect accuracy).

### 5.4 Sprint 4 — K-means audience segmentation
- 11-feature vector, StandardScaler on numeric, silhouette-based k selection, Postgres advisory lock for race-condition fix.
- Gemini-generated persona descriptions ("Content posted in the morning performs like this:").

### 5.5 Sprint 5 — React dashboard
- Vite + Tailwind v4, `dir`-aware Recharts wrappers, glassmorphism, KPI cards, sentiment donut.

### 5.6 Sprint 6 — Auth, billing, admin
- JWT + refresh rotation, Stripe Checkout + 5 webhook handlers, feature-flag middleware, multi-step onboarding wizard.

### 5.7 Sprint 7 — Testing infrastructure
- 60 → 100 integration tests (auth, billing, feature flags, instagram, analytics, admin, AI resilience).
- GitHub Actions CI: real Postgres + Redis service containers.
- HMAC-SHA256 signed Stripe webhook test fixtures.

### 5.8 Sprint 8 — Insights, comments, deployment
- Weekly Gemini insights with score + 3 prioritised actions.
- Comment ingestion + per-comment sentiment + RTL comment feed.
- Branded weekly PDF (ReportLab + Amiri font + arabic-reshaper + python-bidi).
- VPS deploy via GitHub Actions + SSH key fingerprint verification.
- AI quota audit + multi-provider routing (Gemini for insights, OpenAI for captions).
- Stale-while-revalidate cache.
- Marketing-site port (22 routes from a Next.js source repo, lazy-loaded).

### 5.9 Cross-cutting decisions
- Pull a sub-section from each session's "Key decisions" block. Examples:
    - Token encryption uses Fernet PBKDF2-derived from `SECRET_KEY` (not separate key).
    - Sentiment + OCR models lazy-loaded once per worker.
    - Per-post error handling skips failed posts without aborting the batch.
    - Ask Basiret panel mounts/unmounts on open/close (no persistence).
    - Background SWR refresh uses fresh `SessionLocal()` (request session is closed).

### 5.10 Code organisation
- Backend layout: `app/api/v1/`, `app/core/`, `app/models/`, `app/tasks/`, `app/services/`.
- Frontend layout: `pages/`, `components/`, `hooks/`, `api/`, `i18n/`, `lib/`, `pages/marketing/` (separate marketing tree).

---

## Chapter 6 — Testing & Evaluation (≈ 10 pages)

### 6.1 Test strategy
- 100 integration tests against real Postgres + Redis (no SQLite, no mocks for the data layer).
- Unit tests for segmentation feature engineering.
- AI resilience tests: quota → 503 with degraded meta, stale cache → 200 with degraded meta.

### 6.2 CI pipeline
- GitHub Actions: backend-tests + frontend-build jobs on every push.
- Reproducible fixtures (UUID-suffixed emails to avoid collisions).

### 6.3 Functional test results
- Coverage breakdown table: auth (9), protected routes (4), billing (9), feature flags (4), instagram (5), analytics (6), admin (7), insights, etc. → 100/100 passing.

### 6.4 NLP accuracy evaluation
- F1 / accuracy on a held-out test set of EN + AR Instagram comments.
- Per-language confusion matrix.
- Comparison against the Cardiff NLP paper's reported numbers.
- *Required: actually compute these — the codebase doesn't yet generate this evaluation. Action: write a one-shot Celery task that scores against a manually-labelled comment set, output to `evaluation/nlp_metrics.json`.*

### 6.5 Performance & scale
- Sentiment batch throughput: ~30–60× faster after batching pipeline (500 comments: 8 s → 1–2 s).
- Build size: 924 KB main / 272 KB gz (acceptable for current scope).
- API latency (p50, p95) for `/analytics/overview`, `/insights`, `/ai-pages/posts-insights`.

### 6.6 SUS usability evaluation
- Plan: 10 participants, mix of SME owners and content creators.
- Task list: register → connect Instagram → sync → view dashboard → view sentiment feed → generate caption.
- Standard 10-item SUS questionnaire (English + Arabic versions).
- Hypothesis: ≥ 70 average score (industry "good").
- *Required: actually run the study. Section currently a plan; populate with results when collected.*

### 6.7 Comparison with Meta Business Suite
- Side-by-side feature matrix.
- Headline: per-comment multilingual sentiment classification — present in BASIRET, absent in Meta BSS.
- Other comparisons: action recommendations (BASIRET only), AI advisor chat (BASIRET only), reach/impressions (Meta BSS only — API access).

### 6.8 Limitations encountered
- Free Instagram API → reach/impressions = 0 (likes+comments fallback used in PDF report).
- Gemini quota exhaustion during demo setup (mitigated by routing + caching, surfaced as report appendix).
- Meta App Review for `instagram_business_manage_comments` scope still pending → test accounts only for production.

---

## Chapter 7 — Conclusion & Future Work (≈ 4 pages)

### 7.1 Summary of contributions
- Working end-to-end SaaS deployed to Hetzner VPS at basiret.co.
- 100/100 integration tests, AI resilience, multi-tenant isolation.
- Per-comment Arabic sentiment as the academic-defense-worthy contribution.

### 7.2 Reflection on objectives
- Tick each Ch 1.3 objective against evidence.

### 7.3 Future work
- Meta App Review for full `instagram_business_manage_comments` scope.
- Platform expansion to LinkedIn / X / TikTok (architecture is platform-agnostic).
- Arabic dialect tuning (currently MSA-trained; Gulf and Levantine dialects underperform).
- Migrate marketing copy from `marketing-i18n.tsx` shim into the i18n JSON namespace for unified content management — see `CLAUDE.md` "Known debt".
- Per-account rate-limit dashboard (`tokens_used` is logged but not aggregated yet).
- KeyBERT or yake topic extractor replacing the current regex-based local fallback.

### 7.4 Closing remarks

---

## References (≈ 4 pages, ≥ 30 sources)

- Cardiff NLP — `twitter-xlm-roberta-base-sentiment` model card and paper.
- HuggingFace transformers documentation.
- Brooke, J. (1996). SUS — A quick and dirty usability scale.
- Bangor, A. et al. (2009). Determining what individual SUS scores mean.
- Meta for Developers — Instagram Graph API documentation.
- Stripe API documentation.
- FastAPI documentation.
- ReportLab user guide.
- W3C — Internationalization for the Web (RTL guidance).
- Postgres advisory locks documentation.
- *Plus academic papers from Chapter 2 literature review.*

---

## Appendices

### Appendix A — API endpoint reference
Auto-generated from the FastAPI OpenAPI spec; export `/openapi.json` and reformat as a table.

### Appendix B — Database DDL
`db/init.sql` reproduced (or excerpted with selected tables in full).

### Appendix C — Sample SUS questionnaire
EN + AR versions, 10 items each on a 5-point Likert scale.

### Appendix D — Selected screenshots
- Landing (WebGL hero) — see `landing-live-check.png`.
- Home dashboard — see `analytics-final.png`.
- Sentiment feed (RTL Arabic comments visible) — see `sentiment-check.png`.
- Content plan — see `content-plan-english.png`.
- Settings + reports tab — see `settings-check.png`.

### Appendix E — Source-code structure
`tree -L 3 backend/app frontend/src` listing.

### Appendix F — Deployment runbook
Cross-reference [docs/SERVER_SETUP.md](SERVER_SETUP.md) and [docs/STRIPE_SETUP.md](STRIPE_SETUP.md).

### Appendix G — AI prompt catalogue
The system prompts used for Gemini insights, persona descriptions, content plan, sentiment summary, Ask Basiret. Useful for reproducibility.

---

## Drafting plan

Tackle in this order — earlier chapters are riskier (most novel) so revise them last:

1. **Chapter 5 (Implementation)** — easiest start; CLAUDE.md is already a near-complete draft.
2. **Chapter 4 (System Design)** — well-understood; mostly turning bullets into prose + figures.
3. **Chapter 3 (System Analysis)** — overlap with Ch 4; write together.
4. **Chapter 6 (Testing)** — needs the NLP F1 evaluation script + the SUS data; start the SUS recruitment in parallel.
5. **Chapter 2 (Literature Review)** — requires reading; budget ≥ a week.
6. **Chapter 1 (Introduction)** + **Chapter 7 (Conclusion)** — write last so they reflect what the report actually says.
7. **Front matter** — cover page, abstract, ToC — only after chapters are stable.

**Open prerequisites that block specific chapters:**
- Ch 6.4 (NLP F1) — needs a labelled comment test set + an evaluation script. Roughly half a day.
- Ch 6.6 (SUS) — needs 10 participants + ~2 weeks calendar time (recruit, schedule, run, score). Start now.
- Front matter abstract — needs supervisor sign-off on framing.

---

*Drafted: 2026-04-25. Replace bullets with prose chapter-by-chapter.*
