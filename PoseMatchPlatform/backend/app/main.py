from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from dotenv import load_dotenv
import logging
import os

load_dotenv()

from app.database import engine, Base
from app.models import User, PoseTemplate, GameRoom, RoomPlayer, ScoreRecord, CustomLevel, FollowLevel, Favorite
from app.routers import user_router, pose_template_router, game_room_router, score_router, custom_level_router, follow_level_router, favorite_router
from app.routers.video import router as video_router
from app.routers.pose_template import init_default_templates, migrate_pose_templates_table
from app.routers.custom_level import init_default_preset_levels, migrate_custom_levels_table
from app.routers.user import init_admin_user, migrate_users_table
from app.routers.follow_level import migrate_follow_levels_table
from app.routers.favorite import migrate_favorites_table
from app.routers.game_room import migrate_game_rooms_table

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("PoseMatch 服务启动中...")
    os.makedirs("data", exist_ok=True)
    Base.metadata.create_all(bind=engine)
    migrate_users_table()
    migrate_pose_templates_table()
    migrate_custom_levels_table()
    migrate_follow_levels_table()
    migrate_favorites_table()
    migrate_game_rooms_table()
    init_default_templates()
    init_default_preset_levels()
    init_admin_user()
    logger.info("数据库初始化完成")
    yield
    logger.info("PoseMatch 服务关闭中...")


app = FastAPI(
    title="PoseMatch API",
    description="AI 体感姿态匹配互动健身平台 - 后端 API",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router)
app.include_router(pose_template_router)
app.include_router(game_room_router)
app.include_router(score_router)
app.include_router(custom_level_router)
app.include_router(follow_level_router)
app.include_router(favorite_router)
app.include_router(video_router)

# 静态视频文件服务
_video_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "videos")
_video_dir = os.path.abspath(_video_dir)
os.makedirs(_video_dir, exist_ok=True)
app.mount("/videos", StaticFiles(directory=_video_dir), name="videos")


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "posematch-api"}


@app.get("/")
async def root():
    return {
        "service": "PoseMatch API",
        "version": "2.0.0",
        "docs": "/docs",
        "endpoints": {
            "users": "/api/users",
            "pose_templates": "/api/pose-templates",
            "custom_levels": "/api/custom-levels",
            "follow_levels": "/api/follow-levels",
            "favorites": "/api/favorites",
            "rooms": "/api/rooms",
            "scores": "/api/scores",
            "websocket": "/api/rooms/ws/{room_code}",
        },
    }
