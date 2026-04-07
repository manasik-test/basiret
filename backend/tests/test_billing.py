"""
Billing endpoint tests — plans list, subscription status, create-checkout guard.
"""
from unittest.mock import patch, MagicMock


# ── 1. List plans (public-ish, but needs auth) ─────────────

def test_list_plans(client):
    resp = client.get("/api/v1/billing/plans")
    assert resp.status_code == 200
    plans = resp.json()["data"]["plans"]
    assert len(plans) == 3
    tiers = [p["tier"] for p in plans]
    assert "starter" in tiers
    assert "insights" in tiers
    assert "enterprise" in tiers


# ── 2. Get subscription for authenticated user ─────────────

def test_get_subscription(client, starter_user):
    _, _, token = starter_user
    resp = client.get(
        "/api/v1/billing/subscription",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["plan_tier"] == "starter"
    assert data["status"] == "active"


# ── 3. Get subscription without auth → 403 ─────────────────

def test_get_subscription_no_auth(client):
    resp = client.get("/api/v1/billing/subscription")
    assert resp.status_code == 403  # HTTPBearer missing


# ── 4. Create checkout session (Stripe API mocked) ─────────

def test_create_checkout_session(client, starter_user):
    _, _, token = starter_user
    mock_customer = MagicMock()
    mock_customer.id = "cus_test_123"
    mock_session = MagicMock()
    mock_session.url = "https://checkout.stripe.com/test"

    with patch("app.api.v1.billing.stripe.Customer.create", return_value=mock_customer), \
         patch("app.api.v1.billing.stripe.checkout.Session.create", return_value=mock_session), \
         patch("app.api.v1.billing.settings", wraps=__import__("app.core.config", fromlist=["settings"]).settings) as mock_settings:
        mock_settings.STRIPE_SECRET_KEY = "sk_test_fake"
        resp = client.post(
            "/api/v1/billing/create-checkout",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200
    assert "checkout_url" in resp.json()["data"]


# ── 5. Portal without Stripe customer → 400 ────────────────

def test_portal_no_stripe_customer(client, starter_user):
    _, _, token = starter_user
    resp = client.post(
        "/api/v1/billing/portal",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400
    assert "no active" in resp.json()["detail"].lower()
