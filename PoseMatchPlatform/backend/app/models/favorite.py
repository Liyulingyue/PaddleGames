from sqlalchemy import Column, Integer, String, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from .base import Base


class Favorite(Base):
    """统一收藏表：支持动作/关卡/跟练关卡三种实体"""

    __tablename__ = "favorites"
    __table_args__ = (
        UniqueConstraint("user_id", "target_type", "target_id", name="uq_user_favorite_target"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    # 收藏目标类型：'pose' / 'course' / 'follow_course'
    target_type = Column(String(20), nullable=False, index=True)
    # 对应表的 id
    target_id = Column(Integer, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
