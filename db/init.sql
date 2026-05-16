-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
-- ORGANIZATION (tenant root)
-- ─────────────────────────────────────────
CREATE TABLE organization (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    business_profile JSONB,
    brand_identity JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- USER
-- ─────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('system_admin', 'admin', 'manager', 'viewer');

CREATE TABLE "user" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255),
    full_name VARCHAR(255),
    role user_role NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT TRUE,
    batch_generate_default_action VARCHAR(20),
    batch_generate_remember BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- SUBSCRIPTION
-- ─────────────────────────────────────────
CREATE TYPE plan_tier AS ENUM ('starter', 'insights', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due', 'trialing');

CREATE TABLE subscription (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID UNIQUE NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    plan_tier plan_tier NOT NULL DEFAULT 'starter',
    status subscription_status NOT NULL DEFAULT 'active',
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- SOCIAL ACCOUNT
-- ─────────────────────────────────────────
CREATE TYPE platform AS ENUM ('instagram');

CREATE TABLE social_account (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    platform platform NOT NULL DEFAULT 'instagram',
    platform_account_id VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    access_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    needs_reauth BOOLEAN NOT NULL DEFAULT FALSE,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, platform, platform_account_id)
);

-- ─────────────────────────────────────────
-- POST
-- ─────────────────────────────────────────
CREATE TYPE content_type AS ENUM ('image', 'video', 'reel', 'story', 'carousel', 'text');
CREATE TYPE language_code AS ENUM ('en', 'ar', 'unknown');

CREATE TABLE post (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    social_account_id UUID NOT NULL REFERENCES social_account(id) ON DELETE CASCADE,
    platform_post_id VARCHAR(255) NOT NULL,
    platform platform NOT NULL DEFAULT 'instagram',
    content_type content_type,
    language language_code DEFAULT 'unknown',
    caption TEXT,
    media_url TEXT,
    posted_at TIMESTAMPTZ,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(platform, platform_post_id)
);

-- ─────────────────────────────────────────
-- COMMENT (Instagram comments per post)
-- ─────────────────────────────────────────
CREATE TABLE comment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES post(id) ON DELETE CASCADE,
    platform_comment_id VARCHAR(255) NOT NULL UNIQUE,
    text TEXT,
    author_username VARCHAR(255),
    created_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- ANALYSIS RESULT
-- ─────────────────────────────────────────
CREATE TYPE sentiment_label AS ENUM ('positive', 'neutral', 'negative');

CREATE TABLE analysis_result (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID UNIQUE REFERENCES post(id) ON DELETE CASCADE,
    comment_id UUID UNIQUE REFERENCES comment(id) ON DELETE CASCADE,
    sentiment sentiment_label,
    sentiment_score FLOAT,
    topics JSONB,
    ocr_text TEXT,
    audio_transcript TEXT,
    language_detected language_code,
    model_used VARCHAR(100),
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT analysis_result_target_xor CHECK ((post_id IS NOT NULL) <> (comment_id IS NOT NULL))
);

-- ─────────────────────────────────────────
-- ENGAGEMENT METRIC
-- ─────────────────────────────────────────
CREATE TABLE engagement_metric (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES post(id) ON DELETE CASCADE,
    likes INT DEFAULT 0,
    comments INT DEFAULT 0,
    shares INT DEFAULT 0,
    saves INT DEFAULT 0,
    reach INT DEFAULT 0,
    impressions INT DEFAULT 0,
    engagement_rate FLOAT,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- AUDIENCE SEGMENT
-- ─────────────────────────────────────────
CREATE TABLE audience_segment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    social_account_id UUID NOT NULL REFERENCES social_account(id) ON DELETE CASCADE,
    segment_label VARCHAR(100),
    cluster_id INT,
    characteristics JSONB,
    size_estimate INT,
    -- Per-language partition (Bug 2 fix, 2026-05-15). One row per
    -- (cluster, language) so persona prose can coexist in EN and AR.
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_audience_segment_account_cluster_lang
        UNIQUE (social_account_id, cluster_id, language)
);
CREATE INDEX idx_audience_segment_account_lang
    ON audience_segment(social_account_id, language);

-- ─────────────────────────────────────────
-- INSIGHT RESULT
-- ─────────────────────────────────────────
CREATE TABLE insight_result (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    social_account_id UUID NOT NULL REFERENCES social_account(id) ON DELETE CASCADE,
    week_start TIMESTAMPTZ NOT NULL,
    summary VARCHAR(500),
    score FLOAT,
    score_change FLOAT,
    insights JSONB,
    best_post_id UUID REFERENCES post(id) ON DELETE SET NULL,
    next_best_time VARCHAR(100),
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- AI PAGE CACHE (Gemini output cache, 24h TTL enforced in application)
-- ─────────────────────────────────────────
CREATE TABLE ai_page_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    social_account_id UUID NOT NULL REFERENCES social_account(id) ON DELETE CASCADE,
    page_name VARCHAR(64) NOT NULL,
    language VARCHAR(8) NOT NULL DEFAULT 'en',
    content JSONB NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_user_edit_at TIMESTAMPTZ,
    CONSTRAINT uq_ai_page_cache_key UNIQUE (social_account_id, page_name, language)
);
CREATE INDEX idx_ai_page_cache_lookup ON ai_page_cache(social_account_id, page_name, language);

-- ─────────────────────────────────────────
-- AI USAGE LOG (per-call audit trail for rate limiting + admin visibility)
-- ─────────────────────────────────────────
CREATE TABLE ai_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    social_account_id UUID REFERENCES social_account(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL,
    task VARCHAR(20) NOT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'user',
    tokens_used INTEGER,
    called_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ai_usage_account_called ON ai_usage_log(social_account_id, called_at);
CREATE INDEX idx_ai_usage_provider_called ON ai_usage_log(provider, called_at);

-- ─────────────────────────────────────────
-- GOAL (user-defined Instagram growth targets)
-- ─────────────────────────────────────────
CREATE TYPE goal_metric AS ENUM (
    'avg_engagement_rate', 'posts_per_week',
    'positive_sentiment_pct', 'follower_growth_pct'
);
CREATE TYPE goal_period AS ENUM ('weekly', 'monthly');

CREATE TABLE goal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    social_account_id UUID NOT NULL REFERENCES social_account(id) ON DELETE CASCADE,
    metric goal_metric NOT NULL,
    target_value DOUBLE PRECISION NOT NULL,
    period goal_period NOT NULL DEFAULT 'weekly',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_goal_org_active ON goal(organization_id, is_active);
CREATE INDEX idx_goal_account_active ON goal(social_account_id, is_active);

-- ─────────────────────────────────────────
-- RECOMMENDATION FEEDBACK (private thumbs up/down per action)
-- ─────────────────────────────────────────
CREATE TYPE feedback_kind AS ENUM ('helpful', 'not_helpful');

CREATE TABLE recommendation_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    social_account_id UUID NOT NULL REFERENCES social_account(id) ON DELETE CASCADE,
    insight_result_id UUID REFERENCES insight_result(id) ON DELETE SET NULL,
    recommendation_text TEXT NOT NULL,
    feedback feedback_kind NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_rec_feedback_account_text UNIQUE (social_account_id, recommendation_text)
);
CREATE INDEX idx_rec_feedback_org ON recommendation_feedback(organization_id);

-- ─────────────────────────────────────────
-- FEATURE FLAG
-- ─────────────────────────────────────────
CREATE TABLE feature_flag (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_tier plan_tier NOT NULL,
    feature_name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(plan_tier, feature_name)
);

-- Seed feature flags
INSERT INTO feature_flag (plan_tier, feature_name, is_enabled) VALUES
('starter',    'sentiment_analysis',     FALSE),
('starter',    'audience_segmentation',  FALSE),
('starter',    'recommendations',        FALSE),
('starter',    'content_recommendations', FALSE),
('starter',    'arabic_nlp',            FALSE),
('starter',    'history_12mo',          FALSE),
('insights',   'sentiment_analysis',     TRUE),
('insights',   'audience_segmentation',  TRUE),
('insights',   'recommendations',        TRUE),
('insights',   'content_recommendations', TRUE),
('insights',   'arabic_nlp',            TRUE),
('insights',   'history_12mo',          TRUE),
('enterprise', 'sentiment_analysis',     TRUE),
('enterprise', 'audience_segmentation',  TRUE),
('enterprise', 'recommendations',        TRUE),
('enterprise', 'content_recommendations', TRUE),
('enterprise', 'arabic_nlp',            TRUE),
('enterprise', 'history_12mo',          TRUE);

-- Indexes
CREATE INDEX idx_post_social_account ON post(social_account_id);
CREATE INDEX idx_post_posted_at ON post(posted_at DESC);
CREATE INDEX idx_comment_post ON comment(post_id);
CREATE INDEX idx_comment_created ON comment(created_at);
CREATE INDEX idx_analysis_post ON analysis_result(post_id);
CREATE INDEX idx_analysis_comment ON analysis_result(comment_id);
CREATE INDEX idx_engagement_post ON engagement_metric(post_id);
CREATE INDEX idx_user_org ON "user"(organization_id);
CREATE INDEX idx_social_account_org ON social_account(organization_id);
CREATE INDEX idx_insight_account ON insight_result(social_account_id);
CREATE INDEX idx_insight_account_lang ON insight_result(social_account_id, language);

-- ─────────────────────────────────────────
-- SCHEDULED POST (drafts, scheduled, published from Basiret Post Creator)
-- ─────────────────────────────────────────
CREATE TABLE scheduled_post (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    social_account_id UUID NOT NULL REFERENCES social_account(id) ON DELETE CASCADE,
    media_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    media_type VARCHAR(20),
    caption_ar TEXT,
    caption_en TEXT,
    hashtags JSONB NOT NULL DEFAULT '[]'::jsonb,
    ratio VARCHAR(10),
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    platform_post_id VARCHAR(255),
    -- Public IG URL (shortcode-based). Fetched via GET /{media_id}?fields=permalink
    -- after /media_publish succeeds. NULL = not yet fetched or fetch failed.
    permalink VARCHAR(500),
    ai_generated_media BOOLEAN NOT NULL DEFAULT FALSE,
    ai_generated_caption BOOLEAN NOT NULL DEFAULT FALSE,
    source_image_url TEXT,
    image_analysis JSONB,
    content_plan_day DATE,
    draft_expires_at TIMESTAMPTZ,
    error_message TEXT,
    -- Set by the publisher's atomic claim; NULL means "not currently
    -- publishing". Powers stale-publishing recovery in the dispatcher:
    -- rows where publishing_started_at is >10min old are re-claimable
    -- so a crashed worker can't pin the row in `publishing` forever.
    publishing_started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scheduled_post_org_status ON scheduled_post(organization_id, status);
CREATE INDEX idx_scheduled_post_account_scheduled ON scheduled_post(social_account_id, scheduled_at);
CREATE INDEX idx_scheduled_post_status_expires ON scheduled_post(status, draft_expires_at);
-- Stale-publishing recovery scans this index every minute via the dispatcher.
CREATE INDEX idx_scheduled_post_publishing_started ON scheduled_post(publishing_started_at) WHERE status = 'publishing';

-- ─────────────────────────────────────────
-- BATCH GENERATE PROGRESS (server-side state for "Generate all 7 posts")
-- ─────────────────────────────────────────
CREATE TABLE batch_generate_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    social_account_id UUID NOT NULL REFERENCES social_account(id) ON DELETE CASCADE,
    user_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
    language VARCHAR(8) NOT NULL,
    action VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'running',
    per_day_status JSONB NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT
);

CREATE INDEX idx_batch_progress_account_lang_status ON batch_generate_progress(social_account_id, language, status);
CREATE INDEX idx_batch_progress_org ON batch_generate_progress(organization_id);

-- ─────────────────────────────────────────
-- CULTURAL EVENT (GCC cultural calendar — Week 2 Phase 1A)
-- Single table for fixed-gregorian, lunar-hijri, and seasonal-range events
-- across SA/AE/QA/KW/OM/BH (country_iso NULL = cross-GCC / shared).
-- Lunar events store the Hijri tuple; Gregorian dates are resolved at query
-- time by the Phase 1B utility, so the table needs no annual maintenance.
-- ─────────────────────────────────────────
CREATE TABLE cultural_event (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_key VARCHAR(64) NOT NULL UNIQUE,
    name_en VARCHAR(128) NOT NULL,
    name_ar VARCHAR(128) NOT NULL,
    country_iso CHAR(2),
    event_type VARCHAR(20) NOT NULL,
    gregorian_month SMALLINT,
    gregorian_day SMALLINT,
    hijri_month SMALLINT,
    hijri_day SMALLINT,
    duration_days SMALLINT NOT NULL DEFAULT 1,
    seasonal_start_month SMALLINT,
    seasonal_end_month SMALLINT,
    cultural_significance SMALLINT NOT NULL,
    lead_time_days SMALLINT NOT NULL DEFAULT 7,
    industries_high_relevance TEXT[] NOT NULL DEFAULT '{}'::text[],
    content_guidelines JSONB NOT NULL,
    audience_behavior JSONB NOT NULL,
    year_specific_notes JSONB,
    source_url VARCHAR(512),
    source_confidence VARCHAR(20) NOT NULL DEFAULT 'secondary',
    last_verified DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cultural_event_type_chk
        CHECK (event_type IN ('fixed_gregorian','lunar_hijri','seasonal_range')),
    CONSTRAINT cultural_event_source_conf_chk
        CHECK (source_confidence IN ('verified','secondary','inferred')),
    CONSTRAINT cultural_event_country_chk
        CHECK (country_iso IS NULL OR country_iso IN ('SA','AE','QA','KW','OM','BH')),
    CONSTRAINT cultural_event_significance_chk
        CHECK (cultural_significance BETWEEN 1 AND 10),
    CONSTRAINT cultural_event_duration_chk CHECK (duration_days >= 1),
    CONSTRAINT cultural_event_lead_time_chk CHECK (lead_time_days >= 0),
    -- Per-type date column requirements. Explicit IS NOT NULL guards are
    -- required: without them, `NULL BETWEEN 1 AND 12` evaluates to NULL and
    -- `NULL OR FALSE` is NULL, which Postgres treats as a CHECK pass (only
    -- FALSE rejects). The IS NOT NULL terms force a deterministic boolean.
    CONSTRAINT cultural_event_fixed_dates_chk CHECK (
        (event_type = 'fixed_gregorian'
         AND gregorian_month IS NOT NULL AND gregorian_day IS NOT NULL
         AND gregorian_month BETWEEN 1 AND 12
         AND gregorian_day BETWEEN 1 AND 31
         AND hijri_month IS NULL AND hijri_day IS NULL
         AND seasonal_start_month IS NULL AND seasonal_end_month IS NULL)
        OR event_type <> 'fixed_gregorian'
    ),
    CONSTRAINT cultural_event_lunar_dates_chk CHECK (
        (event_type = 'lunar_hijri'
         AND hijri_month IS NOT NULL AND hijri_day IS NOT NULL
         AND hijri_month BETWEEN 1 AND 12
         AND hijri_day BETWEEN 1 AND 30
         AND gregorian_month IS NULL AND gregorian_day IS NULL
         AND seasonal_start_month IS NULL AND seasonal_end_month IS NULL)
        OR event_type <> 'lunar_hijri'
    ),
    CONSTRAINT cultural_event_seasonal_dates_chk CHECK (
        (event_type = 'seasonal_range'
         AND seasonal_start_month IS NOT NULL AND seasonal_end_month IS NOT NULL
         AND seasonal_start_month BETWEEN 1 AND 12
         AND seasonal_end_month BETWEEN 1 AND 12
         AND gregorian_month IS NULL AND gregorian_day IS NULL
         AND hijri_month IS NULL AND hijri_day IS NULL)
        OR event_type <> 'seasonal_range'
    )
);

CREATE INDEX idx_cultural_event_country_significance
    ON cultural_event(country_iso, cultural_significance DESC);
CREATE INDEX idx_cultural_event_type ON cultural_event(event_type);
CREATE INDEX idx_cultural_event_updated ON cultural_event(updated_at DESC);