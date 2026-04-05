from celery import Celery
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
    include=["app.tasks.instagram_sync"],
)
