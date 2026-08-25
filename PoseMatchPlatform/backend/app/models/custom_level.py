from sqlalchemy import Column, Integer, String, DateTime, JSON, Float, Boolean
from sqlalchemy.sql import func
from .base import Base


class CustomLevel(Base):
    """闯关/节拍关卡（统一表）：
    - is_preset=true: 系统预设，自动展示给所有用户（owner_id=0 代表系统）
    - is_public=true: 公开到市场，用户可收藏后使用
    - is_public=false: 用户私有
    - forked_from: 溯源（custom_levels.id）
    """

    __tablename__ = "custom_levels"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, nullable=False, index=True)  # 0=系统预设
    name = Column(String(100), nullable=False)
    description = Column(String(500), default="")
    # 目标模式：challenge（闯关）/ rhythm（节拍）
    target_mode = Column(String(20), default="challenge", nullable=False)
    # 输入方式：video（视频切分）/ image（图片上传）
    input_mode = Column(String(20), default="video")
    # 引用 PoseTemplate.id 列表（两级存储）
    pose_ids = Column(JSON, nullable=True)
    # 实际抽帧数
    frame_count = Column(Integer, default=0)
    # 总时长（秒）
    total_duration = Column(Integer, default=0)
    # 原视频时长（秒），image 模式为 null
    source_duration_sec = Column(Float, nullable=True)
    # 原视频/图片分辨率
    source_resolution = Column(String(20), nullable=True)
    # 播放次数（公开关卡有意义）
    play_count = Column(Integer, default=0, nullable=False)
    # 收藏次数
    favorite_count = Column(Integer, default=0, nullable=False)
    # 是否公开到市场
    is_public = Column(Boolean, default=False, nullable=False, index=True)
    # 是否系统预设（自动同步展示）
    is_preset = Column(Boolean, default=False, nullable=False, index=True)
    # Fork 来源的 custom_levels.id（溯源）
    forked_from = Column(Integer, nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # ---- 预设关卡手调参数（自定义关卡为 null）----
    tag = Column(String(50), nullable=True)
    icon = Column(String(50), nullable=True)
    # challenge 特有
    time_limit = Column(Integer, nullable=True)
    min_match = Column(Integer, nullable=True)
    is_final = Column(Boolean, default=False)
    # rhythm 特有
    is_all = Column(Boolean, default=False)
    # 排序
    sort_order = Column(Integer, default=0)
