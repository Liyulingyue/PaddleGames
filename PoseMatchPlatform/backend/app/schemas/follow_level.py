from pydantic import BaseModel
from datetime import datetime
from typing import Any, Optional, List


class FollowLevelCreate(BaseModel):
    name: str
    description: str = ""
    input_mode: str = "video"
    templates: Optional[List[Any]] = None
    frame_count: int = 0
    fps: Optional[int] = None
    total_duration: int = 0
    source_duration_sec: Optional[float] = None
    source_resolution: Optional[str] = None
    video_path: Optional[str] = None
    bone_video_path: Optional[str] = None


class FollowLevelResponse(BaseModel):
    id: int
    owner_id: int
    name: str
    description: str
    input_mode: str
    templates: Optional[List[Any]] = None
    frame_count: int
    fps: Optional[int]
    total_duration: int
    source_duration_sec: Optional[float]
    source_resolution: Optional[str]
    video_path: Optional[str]
    bone_video_path: Optional[str]
    play_count: int
    favorite_count: int
    is_public: bool
    forked_from: Optional[int] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    author_nickname: Optional[str] = None
    is_favorited: bool = False

    class Config:
        from_attributes = True


class FollowLevelSummary(BaseModel):
    """列表摘要（不含 templates，减少传输量）"""
    id: int
    owner_id: int
    name: str
    description: str
    input_mode: str
    frame_count: int
    fps: Optional[int]
    total_duration: int
    play_count: int
    favorite_count: int
    is_public: bool
    forked_from: Optional[int] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    author_nickname: Optional[str] = None

    class Config:
        from_attributes = True
