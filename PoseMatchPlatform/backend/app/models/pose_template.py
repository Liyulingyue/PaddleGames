from sqlalchemy import Column, Integer, String, DateTime, JSON, Boolean
from sqlalchemy.sql import func
from .base import Base


class PoseTemplate(Base):
    __tablename__ = "pose_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500), default="")
    category = Column(String(50), default="general")
    difficulty = Column(Integer, default=1)
    icon = Column(String(50), default="🧘")
    landmarks = Column(JSON, nullable=False)
    scoring_rules = Column(JSON, nullable=False, default=list)
    duration = Column(Integer, default=10)
    created_by = Column(Integer, nullable=True)  # null=系统预设, user_id=用户创建
    is_public = Column(Boolean, default=False, nullable=False, index=True)  # 系统预设/用户公开=True, 用户私有=False
    forked_from = Column(Integer, nullable=True)  # Fork 来源的 pose_template.id（溯源）
    created_at = Column(DateTime(timezone=True), server_default=func.now())
