from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=6, max_length=100)
    nickname: str = Field(min_length=1, max_length=100)
    avatar: Optional[str] = ""


class UserLogin(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    nickname: Optional[str] = None
    avatar: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    username: str
    nickname: str
    avatar: str
    total_score: int
    games_played: int
    is_admin: bool
    created_at: datetime
    last_active: datetime

    class Config:
        from_attributes = True
