"""
Smoke tests — verify the app boots, health endpoint works,
and all 9 tables exist in the real database.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect

from app.main import app
from app.core.config import settings


EXPECTED_TABLES = sorted([
    "organization",
    "user",
    "subscription",
    "social_account",
    "post",
    "analysis_result",
    "engagement_metric",
    "audience_segment",
    "feature_flag",
])


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def db_engine():
    engine = create_engine(settings.DATABASE_URL)
    yield engine
    engine.dispose()


# ── 1. App starts ────────────────────────────────────────────

def test_app_starts(client):
    response = client.get("/")
    assert response.status_code == 200


# ── 2. Health endpoint ───────────────────────────────────────

def test_health_status_ok(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"


# ── 3. All 9 tables exist ───────────────────────────────────

def test_all_tables_exist(db_engine):
    inspector = inspect(db_engine)
    actual_tables = sorted(inspector.get_table_names())
    for table in EXPECTED_TABLES:
        assert table in actual_tables, f"Table '{table}' missing from database"
    assert len([t for t in actual_tables if t in EXPECTED_TABLES]) == 9
