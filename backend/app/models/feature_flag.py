import uuid
from sqlalchemy import Column, String, Boolean, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class FeatureFlag(Base):
    __tablename__ = "feature_flag"
    __table_args__ = (
        UniqueConstraint("plan_tier", "feature_name"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_tier = Column(Enum("starter", "insights", "enterprise", name="plan_tier", create_type=False), nullable=False)
    feature_name = Column(String(100), nullable=False)
    is_enabled = Column(Boolean, nullable=False, default=False)
