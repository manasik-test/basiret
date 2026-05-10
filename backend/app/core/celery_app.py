from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery = Celery(
    "basiret",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)

celery.conf.update(
    include=[
        "app.tasks.instagram_sync",
        "app.tasks.nlp_analysis",
        "app.tasks.segmentation",
        "app.tasks.insights",
        "app.tasks.account_deletion",
        "app.tasks.draft_cleanup",
        "app.tasks.post_publisher",
    ],
)

# Celery Beat schedule — scheduled batch tasks run by the `celery-beat` service.
# File-based schedule (no DB scheduler dependency) kept simple for V1.
celery.conf.beat_schedule = {
    "weekly-insights-all-accounts": {
        "task": "generate_insights_all_accounts",
        "schedule": crontab(hour=3, minute=0, day_of_week="sunday"),
    },
    "daily-instagram-sync": {
        "task": "sync_all_active_accounts",
        "schedule": crontab(hour=2, minute=0),
    },
    # Post Creator drafts have a 15-day TTL. Cleanup at 02:00 UTC reclaims
    # both the DB row and the R2 media; warn at 09:00 UTC fires a log line
    # for drafts within their last 3 days.
    "daily-cleanup-expired-drafts": {
        "task": "cleanup_expired_drafts",
        "schedule": crontab(hour=2, minute=0),
    },
    "daily-warn-expiring-drafts": {
        "task": "warn_expiring_drafts",
        "schedule": crontab(hour=9, minute=0),
    },
    # Sprint 5: dispatcher polls scheduled_post every minute and queues
    # `publish_scheduled_post.delay(...)` for any due rows + any "Post now"
    # rows the API parked at status='publishing'. Capped at DISPATCH_BATCH_LIMIT
    # per tick to stay under Instagram's per-token publishing rate limit.
    "dispatch-due-posts": {
        "task": "dispatch_due_posts",
        "schedule": crontab(minute="*"),
    },
}
