from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class FavoriteCreate(BaseModel):
    target_type: str  # 'pose' / 'course' / 'follow_course'
    target_id: int


class FavoriteResponse(BaseModel):
    id: int
    user_id: int
    target_type: str
    target_id: int
    created_at: datetime

    class Config:
        from_attributes = True
