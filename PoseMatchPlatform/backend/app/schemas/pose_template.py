from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any


class PoseTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = ""
    category: Optional[str] = "general"
    difficulty: Optional[int] = 1
    icon: Optional[str] = "🧘"
    landmarks: List[Any]
    scoring_rules: Optional[List[Any]] = []
    duration: Optional[int] = 10


class PoseTemplateResponse(BaseModel):
    id: int
    name: str
    description: str
    category: str
    difficulty: int
    icon: str
    landmarks: list
    scoring_rules: list
    duration: int
    created_by: Optional[int] = None
    is_public: bool = False
    forked_from: Optional[int] = None
    created_at: datetime
    author_nickname: Optional[str] = None

    class Config:
        from_attributes = True
