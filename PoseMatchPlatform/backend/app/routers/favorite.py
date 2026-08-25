from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import inspect
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from ..database import get_db, engine
from ..models.favorite import Favorite
from ..models.custom_level import CustomLevel
from ..models.follow_level import FollowLevel
from ..models.pose_template import PoseTemplate
from ..models.user import User

router = APIRouter(prefix="/api/favorites", tags=["收藏"])


class FavoriteRequest(BaseModel):
    target_type: str  # 'pose' / 'custom_level' / 'follow_level'
    target_id: int


def migrate_favorites_table():
    """建表：favorites"""
    inspector = inspect(engine)
    existing = inspector.get_table_names()
    if "favorites" not in existing:
        Favorite.__table__.create(engine, checkfirst=True)
        print("[Migration] 已创建 favorites 表")


def _validate_target(db: Session, target_type: str, target_id: int) -> bool:
    """验证目标是否存在"""
    if target_type == "pose":
        return db.query(PoseTemplate).filter(PoseTemplate.id == target_id).first() is not None
    elif target_type == "custom_level":
        return db.query(CustomLevel).filter(CustomLevel.id == target_id).first() is not None
    elif target_type == "follow_level":
        return db.query(FollowLevel).filter(FollowLevel.id == target_id).first() is not None
    return False


def _get_target_info(db: Session, target_type: str, target_id: int) -> dict:
    """获取目标实体的摘要信息（用于收藏列表展示）"""
    if target_type == "pose":
        record = db.query(PoseTemplate).filter(PoseTemplate.id == target_id).first()
        if not record:
            return None
        return {
            "id": record.id,
            "name": record.name,
            "description": record.description or "",
            "category": record.category,
            "difficulty": record.difficulty,
            "icon": record.icon,
            "is_public": record.is_public,
            "author_nickname": _author_nickname(db, record.created_by) if record.created_by else "系统预设",
            "type_label": "动作",
        }
    elif target_type == "custom_level":
        record = db.query(CustomLevel).filter(CustomLevel.id == target_id).first()
        if not record:
            return None
        return {
            "id": record.id,
            "name": record.name,
            "description": record.description or "",
            "target_mode": record.target_mode,
            "input_mode": record.input_mode,
            "frame_count": record.frame_count,
            "total_duration": record.total_duration,
            "play_count": record.play_count or 0,
            "favorite_count": record.favorite_count or 0,
            "is_public": record.is_public,
            "author_nickname": _author_nickname(db, record.owner_id),
            "type_label": "关卡",
        }
    elif target_type == "follow_level":
        record = db.query(FollowLevel).filter(FollowLevel.id == target_id).first()
        if not record:
            return None
        return {
            "id": record.id,
            "name": record.name,
            "description": record.description or "",
            "input_mode": record.input_mode,
            "frame_count": record.frame_count,
            "fps": record.fps,
            "total_duration": record.total_duration,
            "play_count": record.play_count or 0,
            "favorite_count": record.favorite_count or 0,
            "is_public": record.is_public,
            "author_nickname": _author_nickname(db, record.owner_id),
            "type_label": "跟练",
        }
    return None


def _author_nickname(db: Session, user_id: int) -> str:
    user = db.query(User).filter(User.id == user_id).first()
    return user.nickname if user else "匿名作者"


@router.get("")
def list_favorites(
    user_id: int,
    target_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """列出用户收藏（含已下架的，标记 is_public 状态）"""
    query = db.query(Favorite).filter(Favorite.user_id == user_id)
    if target_type:
        query = query.filter(Favorite.target_type == target_type)
    favs = query.order_by(Favorite.created_at.desc()).all()

    result = []
    for fav in favs:
        info = _get_target_info(db, fav.target_type, fav.target_id)
        if not info:
            continue
        info["favorited_at"] = fav.created_at
        info["target_type"] = fav.target_type
        result.append(info)

    return {"items": result, "total": len(result)}


@router.post("")
def add_favorite(req: FavoriteRequest, user_id: int, db: Session = Depends(get_db)):
    """收藏"""
    if not _validate_target(db, req.target_type, req.target_id):
        raise HTTPException(status_code=404, detail="目标不存在")

    existing = (
        db.query(Favorite)
        .filter(
            Favorite.user_id == user_id,
            Favorite.target_type == req.target_type,
            Favorite.target_id == req.target_id,
        )
        .first()
    )
    if existing:
        return {"detail": "已收藏"}

    fav = Favorite(
        user_id=user_id,
        target_type=req.target_type,
        target_id=req.target_id,
    )
    db.add(fav)

    # 更新 favorite_count
    if req.target_type == "custom_level":
        record = db.query(CustomLevel).filter(CustomLevel.id == req.target_id).first()
        if record:
            record.favorite_count = (record.favorite_count or 0) + 1
    elif req.target_type == "follow_level":
        record = db.query(FollowLevel).filter(FollowLevel.id == req.target_id).first()
        if record:
            record.favorite_count = (record.favorite_count or 0) + 1

    db.commit()
    return {"detail": "已收藏"}


@router.delete("")
def remove_favorite(req: FavoriteRequest, user_id: int, db: Session = Depends(get_db)):
    """取消收藏"""
    existing = (
        db.query(Favorite)
        .filter(
            Favorite.user_id == user_id,
            Favorite.target_type == req.target_type,
            Favorite.target_id == req.target_id,
        )
        .first()
    )
    if not existing:
        return {"detail": "未收藏"}

    db.delete(existing)

    # 更新 favorite_count
    if req.target_type == "custom_level":
        record = db.query(CustomLevel).filter(CustomLevel.id == req.target_id).first()
        if record:
            record.favorite_count = max(0, (record.favorite_count or 0) - 1)
    elif req.target_type == "follow_level":
        record = db.query(FollowLevel).filter(FollowLevel.id == req.target_id).first()
        if record:
            record.favorite_count = max(0, (record.favorite_count or 0) - 1)

    db.commit()
    return {"detail": "已取消收藏"}


@router.get("/check")
def check_favorited(
    user_id: int,
    target_type: str,
    target_id: int,
    db: Session = Depends(get_db),
):
    """检查是否已收藏"""
    is_fav = (
        db.query(Favorite)
        .filter(
            Favorite.user_id == user_id,
            Favorite.target_type == target_type,
            Favorite.target_id == target_id,
        )
        .first()
        is not None
    )
    return {"is_favorited": is_fav}
