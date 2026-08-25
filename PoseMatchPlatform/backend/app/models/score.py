from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from .base import Base


class ScoreRecord(Base):
    __tablename__ = "score_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    nickname = Column(String(100), nullable=False)
    template_id = Column(Integer, ForeignKey("pose_templates.id"))
    template_name = Column(String(100), nullable=False)
    score = Column(Integer, default=0)
    max_combo = Column(Integer, default=0)
    accuracy = Column(Integer, default=0)
    duration = Column(Integer, default=0)
    game_mode = Column(String(20), default="single")
    room_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
