from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any


class RoomPlayerResponse(BaseModel):
    id: int
    user_id: int
    nickname: str
    avatar: str
    total_score: int
    current_score: int
    is_ready: bool
    is_host: bool
    finished: bool
    duration: int
    joined_at: datetime

    class Config:
        from_attributes = True


class GameRoomCreate(BaseModel):
    host_id: int
    template_id: Optional[int] = None
    max_players: Optional[int] = 8
    total_rounds: Optional[int] = 3
    round_duration: Optional[int] = 30
    # 房主选择的关卡配置
    game_mode: str = "rhythm"
    level_name: str = ""
    templates: Optional[List[Any]] = None
    per_pose_sec: int = 8
    video_path: str = ""
    bone_video_path: str = ""


class GameRoomResponse(BaseModel):
    id: int
    room_code: str
    host_id: int
    template_id: Optional[int]
    game_mode: str
    level_name: str
    templates: Optional[List[Any]] = None
    per_pose_sec: int
    video_path: str = ""
    bone_video_path: str = ""
    status: str
    max_players: int
    current_round: int
    total_rounds: int
    round_duration: int
    created_at: datetime
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    players: List[RoomPlayerResponse] = []

    class Config:
        from_attributes = True


class JoinRoomRequest(BaseModel):
    room_code: str
    user_id: int
    nickname: str
    avatar: Optional[str] = ""


class SubmitScoreRequest(BaseModel):
    user_id: int
    score: int
    max_combo: int
    accuracy: int
    duration: int
    is_final: bool = True  # True=最终提交, False=实时同步
