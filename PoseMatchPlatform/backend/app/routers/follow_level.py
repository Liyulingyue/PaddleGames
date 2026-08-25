from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text
from typing import Optional, List
from datetime import datetime
import json
import threading
from pydantic import BaseModel
from ..database import get_db, engine
from ..models.follow_level import FollowLevel
from ..models.user import User
from ..models.favorite import Favorite
from .video import delete_video_file, save_upload_file
from ..utils.bone_video import generate_bone_video

router = APIRouter(prefix="/api/follow-levels", tags=["跟练关卡"])

MAX_FOLLOW_LEVELS = 5
MAX_PAGE_SIZE = 24


class ForkRequest(BaseModel):
    user_id: int


class RenameRequest(BaseModel):
    """重命名跟练关卡（仅 name/description，轻量更新）"""
    user_id: int
    name: Optional[str] = None
    description: Optional[str] = None


def _author_nickname(db: Session, user_id: int) -> str:
    user = db.query(User).filter(User.id == user_id).first()
    return user.nickname if user else "匿名作者"


def _is_favorited(db: Session, user_id: int, level_id: int) -> bool:
    return (
        db.query(Favorite)
        .filter(
            Favorite.user_id == user_id,
            Favorite.target_type == "follow_level",
            Favorite.target_id == level_id,
        )
        .first()
        is not None
    )


def migrate_follow_levels_table():
    """建表：follow_levels"""
    inspector = inspect(engine)
    existing = inspector.get_table_names()
    if "follow_levels" not in existing:
        FollowLevel.__table__.create(engine, checkfirst=True)
        print("[Migration] 已创建 follow_levels 表")


def _async_generate_bone_video(record_id: int, templates: list, db_session_factory):
    """后台异步生成骨骼视频"""
    try:
        bone_path = generate_bone_video(templates)
        db = db_session_factory()
        try:
            record = db.query(FollowLevel).filter(FollowLevel.id == record_id).first()
            if record:
                record.bone_video_path = bone_path
                db.commit()
        finally:
            db.close()
    except Exception as e:
        print(f"[BoneVideo] 生成失败 id={record_id}: {e}")


@router.get("")
def list_follow_levels(
    owner_id: Optional[int] = None,
    is_public: Optional[bool] = None,
    keyword: Optional[str] = None,
    limit: int = 12,
    offset: int = 0,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """列出跟练关卡"""
    limit = max(1, min(limit, MAX_PAGE_SIZE))
    offset = max(0, offset)

    query = db.query(FollowLevel)
    if is_public is not None:
        query = query.filter(FollowLevel.is_public == is_public)
    if owner_id is not None:
        query = query.filter(FollowLevel.owner_id == owner_id)
    if keyword:
        query = query.filter(
            (FollowLevel.name.ilike(f"%{keyword}%"))
            | (FollowLevel.description.ilike(f"%{keyword}%"))
        )

    total = query.count()
    records = query.order_by(FollowLevel.created_at.desc()).offset(offset).limit(limit).all()

    author_ids = {r.owner_id for r in records}
    nickname_map = {}
    if author_ids:
        users = db.query(User).filter(User.id.in_(list(author_ids))).all()
        nickname_map = {u.id: (u.nickname or f"用户{u.id}") for u in users}

    items = []
    for r in records:
        items.append({
            "id": r.id,
            "owner_id": r.owner_id,
            "name": r.name,
            "description": r.description or "",
            "input_mode": r.input_mode,
            "frame_count": r.frame_count,
            "fps": r.fps,
            "total_duration": r.total_duration,
            "play_count": r.play_count or 0,
            "favorite_count": r.favorite_count or 0,
            "is_public": r.is_public,
            "forked_from": r.forked_from,
            "published_at": r.published_at,
            "created_at": r.created_at,
            "author_nickname": nickname_map.get(r.owner_id, "匿名作者"),
            "is_favorited": _is_favorited(db, user_id, r.id) if user_id else False,
        })
    return {"items": items, "total": total}


@router.get("/{level_id}")
def get_follow_level_detail(
    level_id: int,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """获取跟练关卡详情（含 templates + video_path）"""
    record = db.query(FollowLevel).filter(FollowLevel.id == level_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="跟练关卡不存在")

    if not record.is_public:
        if user_id is None or (user_id != record.owner_id and not _is_favorited(db, user_id, level_id)):
            raise HTTPException(status_code=404, detail="该跟练关卡已下架")

    return {
        "id": record.id,
        "owner_id": record.owner_id,
        "name": record.name,
        "description": record.description or "",
        "input_mode": record.input_mode,
        "templates": record.templates,
        "frame_count": record.frame_count,
        "fps": record.fps,
        "total_duration": record.total_duration,
        "source_duration_sec": record.source_duration_sec,
        "source_resolution": record.source_resolution,
        "video_path": record.video_path,
        "bone_video_path": record.bone_video_path,
        "play_count": record.play_count or 0,
        "favorite_count": record.favorite_count or 0,
        "is_public": record.is_public,
        "forked_from": record.forked_from,
        "published_at": record.published_at,
        "created_at": record.created_at,
        "author_nickname": _author_nickname(db, record.owner_id),
        "is_favorited": _is_favorited(db, user_id, level_id) if user_id else False,
    }


@router.post("")
async def create_follow_level(
    user_id: int = Form(...),
    name: str = Form(...),
    description: str = Form(""),
    input_mode: str = Form("video"),
    templates: Optional[str] = Form(None),
    frame_count: int = Form(0),
    fps: Optional[str] = Form(None),
    total_duration: int = Form(0),
    source_duration_sec: Optional[str] = Form(None),
    source_resolution: Optional[str] = Form(None),
    video_file: Optional[UploadFile] = File(None),
    bone_video_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    """创建私有跟练关卡（占配额）"""
    templates_list = None
    if templates and templates.strip():
        try:
            templates_list = json.loads(templates)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="templates 格式错误")

    if not templates_list:
        raise HTTPException(status_code=400, detail="follow 模式必须提供 templates")

    # 配额检查
    count = (
        db.query(FollowLevel)
        .filter(
            FollowLevel.owner_id == user_id,
            FollowLevel.is_public == False,
        )
        .count()
    )
    if count >= MAX_FOLLOW_LEVELS:
        raise HTTPException(
            status_code=403,
            detail=f"私有跟练关卡已达上限({MAX_FOLLOW_LEVELS}个)",
        )

    # 保存视频文件
    video_path = None
    bone_video_path = None
    if video_file:
        video_path = await save_upload_file(video_file, prefix="video_")
    if bone_video_file:
        bone_video_path = await save_upload_file(bone_video_file, prefix="bone_")

    fps_val = None
    if fps and fps.strip():
        try:
            fps_val = int(fps)
        except ValueError:
            fps_val = None

    source_duration_val = None
    if source_duration_sec and source_duration_sec.strip():
        try:
            source_duration_val = float(source_duration_sec)
        except ValueError:
            source_duration_val = None

    record = FollowLevel(
        owner_id=user_id,
        name=name,
        description=description,
        input_mode=input_mode,
        templates=templates_list,
        frame_count=frame_count,
        fps=fps_val,
        total_duration=total_duration,
        source_duration_sec=source_duration_val,
        source_resolution=source_resolution if source_resolution else None,
        video_path=video_path,
        bone_video_path=bone_video_path,
        is_public=False,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    # 后台异步生成骨骼视频
    if not bone_video_path and templates_list and len(templates_list) >= 2:
        from ..database import SessionLocal
        t = threading.Thread(
            target=_async_generate_bone_video,
            args=(record.id, templates_list, SessionLocal),
            daemon=True,
        )
        t.start()

    return {"id": record.id, "name": record.name}


@router.delete("/{level_id}")
def delete_follow_level(level_id: int, user_id: int, db: Session = Depends(get_db)):
    """删除跟练关卡（仅 owner，含视频文件清理）"""
    record = db.query(FollowLevel).filter(FollowLevel.id == level_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="跟练关卡不存在")
    if record.owner_id != user_id:
        raise HTTPException(status_code=403, detail="只能删除自己的关卡")
    delete_video_file(record.video_path)
    delete_video_file(record.bone_video_path)
    db.delete(record)
    db.commit()
    return {"detail": "已删除"}


@router.post("/{level_id}/fork")
def fork_follow_level(level_id: int, req: ForkRequest, db: Session = Depends(get_db)):
    """Fork 跟练关卡到私有（深拷贝 templates，视频文件共享路径）"""
    original = db.query(FollowLevel).filter(FollowLevel.id == level_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="跟练关卡不存在")

    # 配额检查
    count = (
        db.query(FollowLevel)
        .filter(
            FollowLevel.owner_id == req.user_id,
            FollowLevel.is_public == False,
        )
        .count()
    )
    if count >= MAX_FOLLOW_LEVELS:
        raise HTTPException(
            status_code=403,
            detail=f"私有跟练关卡已达上限({MAX_FOLLOW_LEVELS}个)",
        )

    # 深拷贝（templates 内嵌，直接复制 JSON；视频文件共享路径）
    new_level = FollowLevel(
        owner_id=req.user_id,
        name=original.name,
        description=original.description or "",
        input_mode=original.input_mode,
        templates=original.templates,
        frame_count=original.frame_count,
        fps=original.fps,
        total_duration=original.total_duration,
        source_duration_sec=original.source_duration_sec,
        source_resolution=original.source_resolution,
        video_path=original.video_path,
        bone_video_path=original.bone_video_path,
        is_public=False,
        forked_from=original.id,
    )
    db.add(new_level)
    db.commit()
    db.refresh(new_level)
    return {
        "id": new_level.id,
        "name": new_level.name,
        "forked_from": new_level.forked_from,
    }


@router.post("/{level_id}/play")
def play_follow_level(level_id: int, db: Session = Depends(get_db)):
    """记录一次播放"""
    record = db.query(FollowLevel).filter(FollowLevel.id == level_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="跟练关卡不存在")
    record.play_count = (record.play_count or 0) + 1
    db.commit()
    return {"play_count": record.play_count}


@router.patch("/{level_id}/rename")
def rename_follow_level(level_id: int, req: RenameRequest, db: Session = Depends(get_db)):
    """重命名跟练关卡（仅 owner；轻量更新 name/description）"""
    record = db.query(FollowLevel).filter(FollowLevel.id == level_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="跟练关卡不存在")
    if record.owner_id != req.user_id:
        raise HTTPException(status_code=403, detail="只能修改自己的关卡")
    if req.name is not None:
        name = req.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="名称不能为空")
        record.name = name[:100]
    if req.description is not None:
        record.description = req.description[:500]
    db.commit()
    db.refresh(record)
    return {"id": record.id, "name": record.name, "description": record.description}


@router.post("/{level_id}/publish")
def publish_follow_level(level_id: int, req: ForkRequest, db: Session = Depends(get_db)):
    """公开跟练关卡到市场"""
    record = db.query(FollowLevel).filter(FollowLevel.id == level_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="跟练关卡不存在")
    if record.owner_id != req.user_id:
        raise HTTPException(status_code=403, detail="只能公开自己的关卡")

    record.is_public = True
    record.published_at = datetime.utcnow()
    db.commit()
    return {"detail": "已公开", "is_public": True}


@router.post("/{level_id}/unpublish")
def unpublish_follow_level(level_id: int, req: ForkRequest, db: Session = Depends(get_db)):
    """下架跟练关卡"""
    record = db.query(FollowLevel).filter(FollowLevel.id == level_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="跟练关卡不存在")
    if record.owner_id != req.user_id:
        raise HTTPException(status_code=403, detail="只能下架自己的关卡")

    record.is_public = False
    db.commit()
    return {"detail": "已下架", "is_public": False}
