from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
import os
import uuid
from ..database import get_db

router = APIRouter(prefix="/api/videos", tags=["视频文件"])

VIDEO_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "data", "videos")
VIDEO_DIR = os.path.abspath(VIDEO_DIR)
os.makedirs(VIDEO_DIR, exist_ok=True)

# 支持的视频格式
ALLOWED_TYPES = {"video/mp4", "video/webm", "video/quicktime", "video/x-matroska"}
# 最大文件大小 1024MB（1GB）
MAX_SIZE_MB = 1024


def get_video_url(relative_path: Optional[str]) -> Optional[str]:
    """根据相对路径生成完整访问 URL 路径"""
    if not relative_path:
        return None
    return f"/videos/{relative_path}"


@router.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    """上传视频文件，返回相对路径供创建课程时关联"""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"不支持的视频格式: {file.content_type}")

    # 读取内容校验大小
    content = await file.read()
    if len(content) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"视频文件过大，最大支持 {MAX_SIZE_MB}MB")

    # 生成唯一文件名
    ext = os.path.splitext(file.filename or ".mp4")[1].lower()
    if ext not in {".mp4", ".webm", ".mov", ".mkv"}:
        ext = ".mp4"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(VIDEO_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    return {
        "video_path": filename,
        "size": len(content),
        "content_type": file.content_type,
        "url": f"/videos/{filename}",
    }


def delete_video_file(relative_path: Optional[str]):
    """删除视频文件（忽略错误）"""
    if not relative_path:
        return
    filepath = os.path.join(VIDEO_DIR, relative_path)
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception:
        pass


async def save_upload_file(file: UploadFile, prefix: str = "") -> str:
    """保存上传文件到视频目录，返回相对文件名"""
    content = await file.read()
    if len(content) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"文件过大，最大支持 {MAX_SIZE_MB}MB")

    ext = os.path.splitext(file.filename or ".mp4")[1].lower()
    if ext not in {".mp4", ".webm", ".mov", ".mkv"}:
        ext = ".webm" if "webm" in (file.content_type or "") else ".mp4"
    filename = f"{prefix}{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(VIDEO_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    return filename
