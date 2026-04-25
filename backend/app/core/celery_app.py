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
}
