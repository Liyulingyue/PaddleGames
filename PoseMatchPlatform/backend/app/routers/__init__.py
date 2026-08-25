from .user import router as user_router
from .pose_template import router as pose_template_router
from .game_room import router as game_room_router
from .score import router as score_router
from .custom_level import router as custom_level_router
from .follow_level import router as follow_level_router
from .favorite import router as favorite_router

__all__ = [
    "user_router",
    "pose_template_router",
    "game_room_router",
    "score_router",
    "custom_level_router",
    "follow_level_router",
    "favorite_router",
]
