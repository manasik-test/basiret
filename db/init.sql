-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
-- ORGANIZATION (tenant root)
-- ─────────────────────────────────────────
CREATE TABLE organization (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
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
-- ANALYSIS RESULT
-- ─────────────────────────────────────────
CREATE TYPE sentiment_label AS ENUM ('positive', 'neutral', 'negative');

CREATE TABLE analysis_result (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID UNIQUE NOT NULL REFERENCES post(id) ON DELETE CASCADE,
    sentiment sentiment_label,
    sentiment_score FLOAT,
    topics JSONB,
    ocr_text TEXT,
    audio_transcript TEXT,
    language_detected language_code,
    model_used VARCHAR(100),
    analyzed_at TIMESTAMPTZ DEFAULT NOW()
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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

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
    generated_at TIMESTAMPTZ DEFAULT NOW()
);

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
CREATE INDEX idx_analysis_post ON analysis_result(post_id);
CREATE INDEX idx_engagement_post ON engagement_metric(post_id);
CREATE INDEX idx_user_org ON "user"(organization_id);
CREATE INDEX idx_social_account_org ON social_account(organization_id);
CREATE INDEX idx_insight_account ON insight_result(social_account_id);