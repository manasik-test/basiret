"""
Billing endpoints — Stripe integration.

GET  /plans         — return available plan details
GET  /subscription  — return current subscription for user's org
POST /create-checkout — create Stripe Checkout session, return URL
POST /portal        — create Stripe billing portal session
POST /webhooks/stripe — Stripe webhook handler (no auth, signature verified)
"""
import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.subscription import Subscription, PlanTier, SubscriptionStatus
from app.models.feature_flag import FeatureFlag

router = APIRouter()
logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY

PLANS = [
    {
        "tier": "starter",
        "name": "Starter",
        "price": 0,
        "currency": "usd",
        "features": ["Basic metrics", "1 account", "30 days history"],
    },
    {
        "tier": "insights",
        "name": "Insights",
        "price": 2900,
        "currency": "usd",
        "features": [
            "Full AI (EN+AR)", "Sentiment analysis", "Audience segmentation",
            "Recommendations", "3 accounts", "12 months history",
        ],
    },
    {
        "tier": "enterprise",
        "name": "Enterprise",
        "price": None,
        "currency": "usd",
        "features": [
            "Unlimited accounts", "White-label", "Arabic dialect tuning",
            "Dedicated support", "Custom integrations",
        ],
    },
]

# Features unlocked per plan tier
TIER_FEATURES = {
    "starter": [],
    "insights": [
        "sentiment_analysis",
        "audience_segmentation",
        "content_recommendations",
    ],
    "enterprise": [
        "sentiment_analysis",
        "audience_segmentation",
        "content_recommendations",
        "white_label",
        "arabic_dialect_tuning",
    ],
}


def _seed_feature_flags(db: Session, plan_tier: str) -> None:
    """Create or update feature flags so the tier's features are enabled."""
    features = TIER_FEATURES.get(plan_tier, [])
    for feature_name in features:
        flag = db.query(FeatureFlag).filter(
            FeatureFlag.plan_tier == plan_tier,
            FeatureFlag.feature_name == feature_name,
        ).first()
        if flag:
            flag.is_enabled = True
        else:
            db.add(FeatureFlag(
                plan_tier=plan_tier,
                feature_name=feature_name,
                is_enabled=True,
            ))
    db.flush()


@router.get("/plans")
def list_plans():
    """Return available plan tiers and pricing."""
    return {"success": True, "data": {"plans": PLANS}}


@router.get("/subscription")
def get_subscription(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return current subscription for the user's organization."""
    sub = db.query(Subscription).filter(
        Subscription.organization_id == user.organization_id,
    ).first()

    if not sub:
        return {
            "success": True,
            "data": {
                "plan_tier": "starter",
                "status": "active",
                "stripe_customer_id": None,
                "current_period_end": None,
            },
        }

    return {
        "success": True,
        "data": {
            "plan_tier": sub.plan_tier.value,
            "status": sub.status.value,
            "stripe_customer_id": sub.stripe_customer_id,
            "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
        },
    }


@router.post("/create-checkout")
def create_checkout(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout session for upgrading to Insights plan."""
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    sub = db.query(Subscription).filter(
        Subscription.organization_id == user.organization_id,
    ).first()

    # Create or reuse Stripe customer
    customer_id = sub.stripe_customer_id if sub else None
    if not customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.full_name,
            metadata={"organization_id": str(user.organization_id)},
        )
        customer_id = customer.id
        if sub:
            sub.stripe_customer_id = customer_id
            db.commit()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": settings.STRIPE_INSIGHTS_PRICE_ID, "quantity": 1}],
        success_url=f"{settings.FRONTEND_URL}/settings?checkout=success",
        cancel_url=f"{settings.FRONTEND_URL}/settings?checkout=cancel",
        metadata={"organization_id": str(user.organization_id)},
    )

    return {"success": True, "data": {"checkout_url": session.url}}


@router.post("/portal")
def create_portal(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe billing portal session for managing subscription."""
    sub = db.query(Subscription).filter(
        Subscription.organization_id == user.organization_id,
    ).first()

    if not sub or not sub.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No active Stripe subscription")

    session = stripe.billing_portal.Session.create(
        customer=sub.stripe_customer_id,
        return_url=f"{settings.FRONTEND_URL}/settings",
    )

    return {"success": True, "data": {"portal_url": session.url}}


# ── Stripe Webhook (no JWT auth — verified by signature) ────

@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe webhook events. Verifies signature, updates subscription."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature")

    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.STRIPE_WEBHOOK_SECRET,
        )
    except ValueError:
        logger.warning("Stripe webhook: invalid payload")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        logger.warning("Stripe webhook: invalid signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    logger.info("Stripe webhook received: %s", event_type)

    # ── checkout.session.completed ────────────────────────────
    # Fired when a customer completes the Checkout flow.
    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        org_id = session.get("metadata", {}).get("organization_id")
        if not org_id:
            logger.warning("checkout.session.completed missing organization_id in metadata")
            return {"success": True}

        sub = db.query(Subscription).filter(
            Subscription.organization_id == org_id,
        ).first()
        if sub:
            sub.plan_tier = PlanTier.insights
            sub.status = SubscriptionStatus.active
            sub.stripe_customer_id = session.get("customer")
            sub.stripe_subscription_id = session.get("subscription")
            # Seed feature flags so Pro endpoints unlock immediately
            _seed_feature_flags(db, "insights")
            db.commit()
            logger.info("Org %s upgraded to insights via checkout", org_id)

    # ── invoice.payment_succeeded ─────────────────────────────
    # Fired on every successful payment (initial + renewals).
    # Confirms the subscription stays active and updates period dates.
    elif event_type == "invoice.payment_succeeded":
        invoice = event["data"]["object"]
        customer_id = invoice.get("customer")
        subscription_id = invoice.get("subscription")

        sub = db.query(Subscription).filter(
            Subscription.stripe_customer_id == customer_id,
        ).first()
        if sub and subscription_id:
            sub.status = SubscriptionStatus.active
            sub.stripe_subscription_id = subscription_id
            # Fetch the Stripe subscription to get current period dates
            try:
                stripe_sub = stripe.Subscription.retrieve(subscription_id)
                from datetime import datetime, timezone
                sub.current_period_start = datetime.fromtimestamp(
                    stripe_sub.current_period_start, tz=timezone.utc,
                )
                sub.current_period_end = datetime.fromtimestamp(
                    stripe_sub.current_period_end, tz=timezone.utc,
                )
            except Exception as e:
                logger.warning("Could not fetch subscription period: %s", e)
            db.commit()
            logger.info("Payment succeeded for customer %s", customer_id)

    # ── customer.subscription.updated ─────────────────────────
    # Fired when a subscription changes (plan change, status change, renewal).
    elif event_type == "customer.subscription.updated":
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")
        sub = db.query(Subscription).filter(
            Subscription.stripe_customer_id == customer_id,
        ).first()
        if sub:
            status_map = {
                "active": SubscriptionStatus.active,
                "past_due": SubscriptionStatus.past_due,
                "canceled": SubscriptionStatus.cancelled,
                "trialing": SubscriptionStatus.trialing,
            }
            stripe_status = subscription.get("status", "active")
            sub.status = status_map.get(stripe_status, SubscriptionStatus.active)

            # Update period dates from the subscription object
            from datetime import datetime, timezone
            period_start = subscription.get("current_period_start")
            period_end = subscription.get("current_period_end")
            if period_start:
                sub.current_period_start = datetime.fromtimestamp(period_start, tz=timezone.utc)
            if period_end:
                sub.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)

            db.commit()
            logger.info("Subscription updated for customer %s: %s", customer_id, stripe_status)

    # ── customer.subscription.deleted ─────────────────────────
    # Fired when a subscription is cancelled / expires.
    elif event_type == "customer.subscription.deleted":
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")
        sub = db.query(Subscription).filter(
            Subscription.stripe_customer_id == customer_id,
        ).first()
        if sub:
            sub.plan_tier = PlanTier.starter
            sub.status = SubscriptionStatus.cancelled
            sub.stripe_subscription_id = None
            sub.current_period_start = None
            sub.current_period_end = None
            db.commit()
            logger.info("Subscription deleted for customer %s, downgraded to starter", customer_id)

    # ── invoice.payment_failed ────────────────────────────────
    # Fired when a payment attempt fails (card declined, etc.).
    elif event_type == "invoice.payment_failed":
        invoice = event["data"]["object"]
        customer_id = invoice.get("customer")
        sub = db.query(Subscription).filter(
            Subscription.stripe_customer_id == customer_id,
        ).first()
        if sub:
            sub.status = SubscriptionStatus.past_due
            db.commit()
            logger.warning("Payment failed for customer %s", customer_id)

    return {"success": True}
