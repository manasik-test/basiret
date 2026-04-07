"""
Billing endpoint tests — plans, subscription, checkout, portal, webhook events.
"""
import json
import time
import hmac
import hashlib
from unittest.mock import patch, MagicMock

from app.core.config import settings
from app.models.subscription import Subscription, PlanTier, SubscriptionStatus
from app.models.feature_flag import FeatureFlag


def _sign_stripe_payload(payload: bytes, secret: str) -> str:
    """Generate a valid Stripe webhook signature for testing."""
    timestamp = str(int(time.time()))
    signed_payload = f"{timestamp}.".encode() + payload
    signature = hmac.new(
        secret.encode(), signed_payload, hashlib.sha256,
    ).hexdigest()
    return f"t={timestamp},v1={signature}"


# ── 1. List plans ──────────────────────────────────────────

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


# ── 6. Webhook: checkout.session.completed upgrades plan ────

def test_webhook_checkout_completed(client, db, starter_user):
    _, org, _ = starter_user
    secret = "whsec_test_secret"

    event_payload = json.dumps({
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cus_webhook_test",
                "subscription": "sub_webhook_test",
                "metadata": {"organization_id": str(org.id)},
            },
        },
    }).encode()

    sig = _sign_stripe_payload(event_payload, secret)

    with patch.object(settings, "STRIPE_WEBHOOK_SECRET", secret):
        resp = client.post(
            "/api/v1/billing/webhooks/stripe",
            content=event_payload,
            headers={
                "stripe-signature": sig,
                "content-type": "application/json",
            },
        )

    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # Verify subscription upgraded
    db.expire_all()
    sub = db.query(Subscription).filter(
        Subscription.organization_id == org.id,
    ).first()
    assert sub.plan_tier == PlanTier.insights
    assert sub.status == SubscriptionStatus.active
    assert sub.stripe_customer_id == "cus_webhook_test"
    assert sub.stripe_subscription_id == "sub_webhook_test"

    # Verify feature flags were seeded for insights tier
    flags = db.query(FeatureFlag).filter(
        FeatureFlag.plan_tier == "insights",
        FeatureFlag.is_enabled == True,
    ).all()
    flag_names = [f.feature_name for f in flags]
    assert "sentiment_analysis" in flag_names
    assert "audience_segmentation" in flag_names


# ── 7. Webhook: invoice.payment_failed → past_due ──────────

def test_webhook_payment_failed(client, db, starter_user):
    _, org, _ = starter_user
    secret = "whsec_test_secret"

    # First set a stripe_customer_id on the subscription
    sub = db.query(Subscription).filter(
        Subscription.organization_id == org.id,
    ).first()
    sub.stripe_customer_id = "cus_fail_test"
    db.commit()

    event_payload = json.dumps({
        "type": "invoice.payment_failed",
        "data": {
            "object": {
                "customer": "cus_fail_test",
                "subscription": "sub_fail_test",
            },
        },
    }).encode()

    sig = _sign_stripe_payload(event_payload, secret)

    with patch.object(settings, "STRIPE_WEBHOOK_SECRET", secret):
        resp = client.post(
            "/api/v1/billing/webhooks/stripe",
            content=event_payload,
            headers={
                "stripe-signature": sig,
                "content-type": "application/json",
            },
        )

    assert resp.status_code == 200
    db.expire_all()
    sub = db.query(Subscription).filter(
        Subscription.organization_id == org.id,
    ).first()
    assert sub.status == SubscriptionStatus.past_due


# ── 8. Webhook: customer.subscription.deleted → downgrade ───

def test_webhook_subscription_deleted(client, db, starter_user):
    _, org, _ = starter_user
    secret = "whsec_test_secret"

    sub = db.query(Subscription).filter(
        Subscription.organization_id == org.id,
    ).first()
    sub.stripe_customer_id = "cus_del_test"
    sub.plan_tier = PlanTier.insights
    db.commit()

    event_payload = json.dumps({
        "type": "customer.subscription.deleted",
        "data": {
            "object": {
                "customer": "cus_del_test",
            },
        },
    }).encode()

    sig = _sign_stripe_payload(event_payload, secret)

    with patch.object(settings, "STRIPE_WEBHOOK_SECRET", secret):
        resp = client.post(
            "/api/v1/billing/webhooks/stripe",
            content=event_payload,
            headers={
                "stripe-signature": sig,
                "content-type": "application/json",
            },
        )

    assert resp.status_code == 200
    db.expire_all()
    sub = db.query(Subscription).filter(
        Subscription.organization_id == org.id,
    ).first()
    assert sub.plan_tier == PlanTier.starter
    assert sub.status == SubscriptionStatus.cancelled
    assert sub.stripe_subscription_id is None


# ── 9. Webhook: invalid signature → 400 ────────────────────

def test_webhook_invalid_signature(client):
    secret = "whsec_test_secret"
    payload = json.dumps({"type": "test"}).encode()

    with patch.object(settings, "STRIPE_WEBHOOK_SECRET", secret):
        resp = client.post(
            "/api/v1/billing/webhooks/stripe",
            content=payload,
            headers={
                "stripe-signature": "t=123,v1=badsignature",
                "content-type": "application/json",
            },
        )
    assert resp.status_code == 400
