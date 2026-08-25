from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .base import Base


class GameRoom(Base):
    __tablename__ = "game_rooms"

    id = Column(Integer, primary_key=True, index=True)
    room_code = Column(String(8), unique=True, index=True, nullable=False)
    host_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("pose_templates.id"))
    # 游戏模式：challenge / rhythm / follow
    game_mode = Column(String(20), default="rhythm")
    # 关卡名称（展示用）
    level_name = Column(String(100), default="")
    # 关卡模板 JSON（PoseTemplate[]，房主创建时传入，所有玩家用同一套）
    templates = Column(JSON, nullable=True)
    # 每动作时长（秒，仅 rhythm 模式用）
    per_pose_sec = Column(Integer, default=8)
    video_path = Column(String(500), default="")
    bone_video_path = Column(String(500), default="")
    status = Column(String(20), default="waiting")
    max_players = Column(Integer, default=8)
    current_round = Column(Integer, default=1)
    total_rounds = Column(Integer, default=3)
    round_duration = Column(Integer, default=30)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)

    players = relationship("RoomPlayer", back_populates="room", cascade="all, delete-orphan")


class RoomPlayer(Base):
    __tablename__ = "room_players"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("game_rooms.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    nickname = Column(String(100), nullable=False)
    avatar = Column(String(255), default="")
    total_score = Column(Integer, default=0)
    current_score = Column(Integer, default=0)
    is_ready = Column(Boolean, default=False)
    is_host = Column(Boolean, default=False)
    finished = Column(Boolean, default=False)
    duration = Column(Integer, default=0)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    room = relationship("GameRoom", back_populates="players")
