from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
import bcrypt
import os
from ..database import get_db, engine
from ..models.user import User
from ..schemas.user import UserCreate, UserResponse, UserUpdate, UserLogin

router = APIRouter(prefix="/api/users", tags=["用户"])


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def migrate_users_table():
    """迁移：给已有 users 表添加 is_admin 列"""
    from sqlalchemy import inspect
    inspector = inspect(engine)
    columns = [c['name'] for c in inspector.get_columns('users')]
    if 'is_admin' not in columns:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0"))
            conn.commit()
        print("[Migration] users 表已添加 is_admin 列")


def init_admin_user():
    """从环境变量读取管理员账号，启动时自动创建/更新"""
    from ..database import SessionLocal
    admin_username = os.getenv("ADMIN_USERNAME", "admin")
    admin_password = os.getenv("ADMIN_PASSWORD", "admin123")
    admin_nickname = os.getenv("ADMIN_NICKNAME", "管理员")

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.username == admin_username).first()
        if admin:
            if not admin.is_admin:
                admin.is_admin = True
                db.commit()
            return
        db_admin = User(
            username=admin_username,
            password_hash=get_password_hash(admin_password),
            nickname=admin_nickname,
            avatar="",
            is_admin=True,
        )
        db.add(db_admin)
        db.commit()
        print(f"[Admin] 管理员账号已创建: {admin_username}")
    finally:
        db.close()


@router.post("", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")
    db_user = User(
        username=user.username,
        password_hash=get_password_hash(user.password),
        nickname=user.nickname,
        avatar=user.avatar or "",
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.post("/login", response_model=UserResponse)
def login_user(user_login: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == user_login.username).first()
    if not user or not verify_password(user_login.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    return user


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.get("/username/{username}", response_model=UserResponse)
def get_user_by_username(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, user_update: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    if user_update.nickname is not None:
        user.nickname = user_update.nickname
    if user_update.avatar is not None:
        user.avatar = user_update.avatar
    db.commit()
    db.refresh(user)
    return user
