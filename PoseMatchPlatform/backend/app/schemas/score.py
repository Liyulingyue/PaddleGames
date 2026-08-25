from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from enum import Enum


class GameMode(str, Enum):
    """游戏模式枚举：challenge=闯关 / rhythm=节拍 / follow=跟练 / multi=多人对战 / immersive=沉浸"""
    challenge = "challenge"
    rhythm = "rhythm"
    follow = "follow"
    multi = "multi"
    immersive = "immersive"


class ScoreRecordCreate(BaseModel):
    user_id: int
    nickname: str
    template_id: Optional[int] = None
    template_name: str
    score: int
    max_combo: int
    accuracy: int
    duration: Optional[int] = None
    # 新架构默认闯关模式；写入时强制枚举校验
    game_mode: GameMode = GameMode.challenge
    room_id: Optional[int] = None


class ScoreRecordResponse(BaseModel):
    id: int
    user_id: int
    nickname: str
    template_id: Optional[int]
    template_name: str
    score: int
    max_combo: int
    accuracy: int
    duration: int
    # Response 保持 str 以兼容历史数据（旧值如 single）
    game_mode: str
    room_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class LeaderboardEntry(BaseModel):
    rank: int
    nickname: str
    avatar: str
    score: int
    max_combo: int
    accuracy: int
    # 闯关模式下用于展示耗时
    duration: int = 0
    template_name: str
    created_at: datetime


class MyRankResponse(BaseModel):
    rank: int
    best_score: int
    # 闯关模式下为最短达标耗时（秒），其他模式为 0
    best_duration: int = 0
    max_combo: int
    best_template: str
    total_players: int
    has_score: bool
