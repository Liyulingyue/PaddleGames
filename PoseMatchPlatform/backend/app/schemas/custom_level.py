from pydantic import BaseModel
from datetime import datetime
from typing import Any, Optional, List


class CustomLevelCreate(BaseModel):
    name: str
    description: str = ""
    target_mode: str = "challenge"  # challenge / rhythm
    input_mode: str = "video"
    pose_ids: Optional[List[int]] = None
    frame_count: int = 0
    total_duration: int = 0
    source_duration_sec: Optional[float] = None
    source_resolution: Optional[str] = None


class CustomLevelResponse(BaseModel):
    id: int
    owner_id: int
    name: str
    description: str
    target_mode: str
    input_mode: str
    pose_ids: Optional[List[int]] = None
    frame_count: int
    total_duration: int
    source_duration_sec: Optional[float]
    source_resolution: Optional[str]
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


class CustomLevelSummary(BaseModel):
    """列表摘要（不含 pose_ids，减少传输量）"""
    id: int
    owner_id: int
    name: str
    description: str
    target_mode: str
    input_mode: str
    frame_count: int
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
