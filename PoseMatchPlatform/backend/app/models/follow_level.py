from sqlalchemy import Column, Integer, String, DateTime, JSON, Float, Boolean
from sqlalchemy.sql import func
from .base import Base


class FollowLevel(Base):
    """跟练关卡（统一表）：含视频数据，templates 内嵌，is_public 区分私有/公开"""

    __tablename__ = "follow_levels"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500), default="")
    # 输入方式：video（视频切分）/ image（图片上传）
    input_mode = Column(String(20), default="video")
    # PoseTemplate[] JSON 内嵌（含 landmarks + scoring_rules + timestamp + sourceDuration + thumbnail）
    templates = Column(JSON, nullable=True)
    # 实际抽帧数
    frame_count = Column(Integer, default=0)
    # 视频跟练采样帧率
    fps = Column(Integer, nullable=True)
    # 总时长（秒）
    total_duration = Column(Integer, default=0)
    # 原视频时长（秒）
    source_duration_sec = Column(Float, nullable=True)
    # 原视频/图片分辨率
    source_resolution = Column(String(20), nullable=True)
    # 视频文件相对路径（data/videos/ 下）
    video_path = Column(String(255), nullable=True)
    # 骨骼动画视频相对路径
    bone_video_path = Column(String(255), nullable=True)
    # 播放次数
    play_count = Column(Integer, default=0, nullable=False)
    # 收藏次数
    favorite_count = Column(Integer, default=0, nullable=False)
    # 是否公开到市场
    is_public = Column(Boolean, default=False, nullable=False, index=True)
    # Fork 来源的 follow_level.id（溯源）
    forked_from = Column(Integer, nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
