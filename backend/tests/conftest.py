"""
Shared test fixtures for BASIRET integration tests.

All tests run against real PostgreSQL + Redis containers (no mocks).
Each test gets a unique user/org via UUID-suffixed emails to avoid collisions.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import SessionLocal
from app.core.security import hash_password, create_access_token
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.models.subscription import Subscription, PlanTier, SubscriptionStatus
from app.models.social_account import SocialAccount, Platform
from app.models.post import Post, ContentType, LanguageCode
from app.models.engagement_metric import EngagementMetric
from app.models.analysis_result import AnalysisResult
from app.models.feature_flag import FeatureFlag


# ── Test client ────────────────────────────────────────────────

@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


# ── Database session ───────────────────────────────────────────

@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


# ── Unique ID helper ──────────────────────────────────────────

def _uid() -> str:
    return uuid.uuid4().hex[:8]


# ── Create org + user + subscription in DB ────────────────────

def create_test_user(
    db: Session,
    *,
    role: UserRole = UserRole.admin,
    plan_tier: PlanTier = PlanTier.starter,
    email: str | None = None,
    org_name: str | None = None,
    password: str = "TestPass123!",
) -> tuple[User, Organization, str]:
    """Create a full org/user/subscription stack. Returns (user, org, access_token)."""
    uid = _uid()
    email = email or f"test-{uid}@basiret-test.com"
    org_name = org_name or f"TestOrg-{uid}"

    org = Organization(name=org_name, slug=f"test-{uid}")
    db.add(org)
    db.flush()

    user = User(
        organization_id=org.id,
        email=email,
        hashed_password=hash_password(password),
        full_name=f"Test User {uid}",
        role=role,
    )
    db.add(user)
    db.flush()

    sub = Subscription(
        organization_id=org.id,
        plan_tier=plan_tier,
        status=SubscriptionStatus.active,
    )
    db.add(sub)
    db.commit()
    db.refresh(user)
    db.refresh(org)

    token = create_access_token(str(user.id), str(org.id), role.value)
    return user, org, token


# ── Convenience fixtures ──────────────────────────────────────

@pytest.fixture()
def starter_user(db):
    """Admin user on starter plan — Pro features should be locked."""
    user, org, token = create_test_user(db, plan_tier=PlanTier.starter)
    yield user, org, token
    # cleanup
    db.query(Subscription).filter(Subscription.organization_id == org.id).delete()
    db.query(User).filter(User.id == user.id).delete()
    db.query(Organization).filter(Organization.id == org.id).delete()
    db.commit()


@pytest.fixture()
def insights_user(db):
    """Admin user on insights plan — Pro features should be accessible."""
    user, org, token = create_test_user(db, plan_tier=PlanTier.insights)
    yield user, org, token
    db.query(Subscription).filter(Subscription.organization_id == org.id).delete()
    db.query(User).filter(User.id == user.id).delete()
    db.query(Organization).filter(Organization.id == org.id).delete()
    db.commit()


@pytest.fixture()
def system_admin_user(db):
    """System admin user — can access /admin endpoints."""
    user, org, token = create_test_user(db, role=UserRole.system_admin)
    yield user, org, token
    db.query(Subscription).filter(Subscription.organization_id == org.id).delete()
    db.query(User).filter(User.id == user.id).delete()
    db.query(Organization).filter(Organization.id == org.id).delete()
    db.commit()


@pytest.fixture()
def viewer_user(db):
    """Viewer user — should be denied admin access."""
    user, org, token = create_test_user(db, role=UserRole.viewer)
    yield user, org, token
    db.query(Subscription).filter(Subscription.organization_id == org.id).delete()
    db.query(User).filter(User.id == user.id).delete()
    db.query(Organization).filter(Organization.id == org.id).delete()
    db.commit()


# ── Seed social account with posts + engagement ──────────────

def seed_social_account_with_posts(db: Session, org_id, *, num_posts: int = 3):
    """Create a social account with posts and engagement metrics. Returns the account."""
    uid = _uid()
    account = SocialAccount(
        organization_id=org_id,
        platform=Platform.instagram,
        platform_account_id=f"ig_{uid}",
        username=f"testuser_{uid}",
        access_token_encrypted="encrypted_fake_token",
        token_expires_at=datetime.now(timezone.utc) + timedelta(days=60),
        is_active=True,
    )
    db.add(account)
    db.flush()

    for i in range(num_posts):
        post = Post(
            social_account_id=account.id,
            platform_post_id=f"post_{uid}_{i}",
            platform="instagram",
            content_type=ContentType.image,
            language=LanguageCode.en,
            caption=f"Test caption {i}",
            posted_at=datetime.now(timezone.utc) - timedelta(days=i),
        )
        db.add(post)
        db.flush()

        metric = EngagementMetric(
            post_id=post.id,
            likes=10 * (i + 1),
            comments=2 * (i + 1),
            shares=0,
            saves=0,
            reach=0,
            impressions=0,
            engagement_rate=0.0,
        )
        db.add(metric)

    db.commit()
    db.refresh(account)
    return account


def seed_analysis_results(db: Session, account_id):
    """Add analysis results for all posts under a social account."""
    posts = db.query(Post).filter(Post.social_account_id == account_id).all()
    sentiments = ["positive", "neutral", "negative"]
    for i, post in enumerate(posts):
        existing = db.query(AnalysisResult).filter(AnalysisResult.post_id == post.id).first()
        if existing:
            continue
        result = AnalysisResult(
            post_id=post.id,
            sentiment=sentiments[i % 3],
            sentiment_score=0.8 - (i * 0.2),
            topics=[],
            language_detected="en",
            model_used="test",
        )
        db.add(result)
    db.commit()


# ── Feature flag helpers ──────────────────────────────────────

def ensure_feature_flag(db: Session, plan_tier: str, feature_name: str, is_enabled: bool):
    """Create or update a feature flag."""
    flag = db.query(FeatureFlag).filter(
        FeatureFlag.plan_tier == plan_tier,
        FeatureFlag.feature_name == feature_name,
    ).first()
    if flag:
        flag.is_enabled = is_enabled
    else:
        flag = FeatureFlag(plan_tier=plan_tier, feature_name=feature_name, is_enabled=is_enabled)
        db.add(flag)
    db.commit()
    db.refresh(flag)
    return flag
