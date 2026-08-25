from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
from ..database import get_db, engine, SessionLocal
from ..models.custom_level import CustomLevel
from ..models.pose_template import PoseTemplate
from ..models.user import User
from ..models.favorite import Favorite

router = APIRouter(prefix="/api/custom-levels", tags=["闯关/节拍关卡"])

MAX_LEVELS_PER_TYPE = 5
MAX_PAGE_SIZE = 24
SYSTEM_OWNER_ID = 0  # 系统预设的 owner_id


class LevelCreateRequest(BaseModel):
    owner_id: int
    name: str
    description: str = ""
    target_mode: str = "challenge"
    input_mode: str = "video"
    pose_ids: Optional[List[int]] = None
    frame_count: int = 0
    total_duration: int = 0
    source_duration_sec: Optional[float] = None
    source_resolution: Optional[str] = None


class PresetLevelCreateRequest(BaseModel):
    """管理员创建预设关卡"""
    name: str
    description: str = ""
    target_mode: str = "challenge"
    pose_ids: List[int] = []
    tag: Optional[str] = ""
    icon: Optional[str] = "🧘"
    time_limit: Optional[int] = None
    min_match: Optional[int] = None
    is_final: Optional[bool] = False
    is_all: Optional[bool] = False
    sort_order: Optional[int] = 0


class ForkRequest(BaseModel):
    user_id: int


class RenameRequest(BaseModel):
    """重命名关卡（仅 name/description，轻量更新）"""
    user_id: int
    name: Optional[str] = None
    description: Optional[str] = None


# ==================== 默认预设数据 ====================

_CHALLENGE_POOL = [1,2,3,4,5,6,7,8,11,12,13,14,15,16,17,18,21,22,23,24,31,32,33,34,41,42,43,44,51,52,53,54,61,62,63,64,65,66,67,68,69,70,71,72]

def _gen_challenge_poses(count: int) -> list:
    return [_CHALLENGE_POOL[i % len(_CHALLENGE_POOL)] for i in range(count)]


DEFAULT_PRESET_LEVELS = [
    # ============ challenge（闯关）============
    {"target_mode": "challenge", "name": "第一关 · 初学乍练", "description": "基础热身动作，快速入门", "pose_ids": [1, 2, 22, 33], "time_limit": 45, "min_match": 60, "is_final": False, "tag": "新手上路", "icon": "🧘", "sort_order": 1},
    {"target_mode": "challenge", "name": "第二关 · 小试牛刀", "description": "单侧动作，打好基础", "pose_ids": [3, 4, 53, 54, 1], "time_limit": 60, "min_match": 65, "is_final": False, "tag": "新手上路", "icon": "🧘", "sort_order": 2},
    {"target_mode": "challenge", "name": "第三关 · 渐入佳境", "description": "肩部多角度练习", "pose_ids": [21, 51, 52, 23, 24, 2], "time_limit": 75, "min_match": 70, "is_final": False, "tag": "肩颈", "icon": "🧘", "sort_order": 3},
    {"target_mode": "challenge", "name": "第四关 · 身轻如燕", "description": "瑜伽入门体式", "pose_ids": [6, 7, 8, 32, 34, 22], "time_limit": 90, "min_match": 70, "is_final": False, "tag": "瑜伽", "icon": "🧘", "sort_order": 4},
    {"target_mode": "challenge", "name": "第五关 · 八段锦·上", "description": "八段锦前四式，调理气血", "pose_ids": [11, 12, 13, 14], "time_limit": 60, "min_match": 65, "is_final": False, "tag": "八段锦", "icon": "🧘", "sort_order": 5},
    {"target_mode": "challenge", "name": "第六关 · 八段锦·下", "description": "八段锦后四式，强筋健骨", "pose_ids": [15, 16, 17, 18], "time_limit": 60, "min_match": 65, "is_final": False, "tag": "八段锦", "icon": "🧘", "sort_order": 6},
    {"target_mode": "challenge", "name": "第七关 · 炉火纯青", "description": "综合挑战，考验反应", "pose_ids": [5, 2, 1, 22, 32, 53, 24], "time_limit": 90, "min_match": 75, "is_final": False, "tag": "进阶", "icon": "🧘", "sort_order": 7},
    {"target_mode": "challenge", "name": "第八关 · 登峰造极", "description": "终极挑战，全部动作", "pose_ids": [], "time_limit": 120, "min_match": 80, "is_final": True, "tag": "进阶", "icon": "🧘", "sort_order": 8},
    # ---- 破釜沉舟 ----
    {"target_mode": "challenge", "name": "破釜沉舟 · 第一战 · 初探深渊", "description": "50 个动作连环挑战，考验耐力起点", "pose_ids": _gen_challenge_poses(50), "time_limit": 250, "min_match": 70, "is_final": False, "tag": "破釜沉舟", "icon": "🔥", "sort_order": 11},
    {"target_mode": "challenge", "name": "破釜沉舟 · 第二战 · 渐入状态", "description": "80 个动作持续输出，节奏初显", "pose_ids": _gen_challenge_poses(80), "time_limit": 400, "min_match": 70, "is_final": False, "tag": "破釜沉舟", "icon": "🔥", "sort_order": 12},
    {"target_mode": "challenge", "name": "破釜沉舟 · 第三战 · 稳扎稳打", "description": "120 个动作耐力对决，突破百关", "pose_ids": _gen_challenge_poses(120), "time_limit": 600, "min_match": 72, "is_final": False, "tag": "破釜沉舟", "icon": "🔥", "sort_order": 13},
    {"target_mode": "challenge", "name": "破釜沉舟 · 第四战 · 突破极限", "description": "160 个动作高频切换，挑战反应", "pose_ids": _gen_challenge_poses(160), "time_limit": 800, "min_match": 72, "is_final": False, "tag": "破釜沉舟", "icon": "🔥", "sort_order": 14},
    {"target_mode": "challenge", "name": "破釜沉舟 · 第五战 · 意志考验", "description": "200 个动作长途跋涉，意志为王", "pose_ids": _gen_challenge_poses(200), "time_limit": 1000, "min_match": 75, "is_final": False, "tag": "破釜沉舟", "icon": "🔥", "sort_order": 15},
    {"target_mode": "challenge", "name": "破釜沉舟 · 第六战 · 咬紧牙关", "description": "250 个动作连环轰炸，咬牙坚持", "pose_ids": _gen_challenge_poses(250), "time_limit": 1250, "min_match": 75, "is_final": False, "tag": "破釜沉舟", "icon": "🔥", "sort_order": 16},
    {"target_mode": "challenge", "name": "破釜沉舟 · 第七战 · 超越自我", "description": "300 个动作超长续航，超越过往", "pose_ids": _gen_challenge_poses(300), "time_limit": 1500, "min_match": 78, "is_final": False, "tag": "破釜沉舟", "icon": "🔥", "sort_order": 17},
    {"target_mode": "challenge", "name": "破釜沉舟 · 第八战 · 精疲力竭", "description": "350 个动作极限拉扯，逼近疲惫", "pose_ids": _gen_challenge_poses(350), "time_limit": 1750, "min_match": 78, "is_final": False, "tag": "破釜沉舟", "icon": "🔥", "sort_order": 18},
    {"target_mode": "challenge", "name": "破釜沉舟 · 第九战 · 巅峰对决", "description": "400 个动作巅峰之战，只为登顶", "pose_ids": _gen_challenge_poses(400), "time_limit": 2000, "min_match": 80, "is_final": False, "tag": "破釜沉舟", "icon": "🔥", "sort_order": 19},
    {"target_mode": "challenge", "name": "破釜沉舟 · 终极炼狱", "description": "500 个动作终极炼狱，唯有破釜沉舟", "pose_ids": _gen_challenge_poses(500), "time_limit": 2500, "min_match": 80, "is_final": False, "tag": "破釜沉舟", "icon": "🔥", "sort_order": 20},

    # ============ rhythm（节拍）============
    {"target_mode": "rhythm", "name": "八段锦 · 全套", "description": "经典八式，调理全身气血，强筋健骨", "pose_ids": [11, 12, 13, 14, 15, 16, 17, 18], "tag": "八段锦", "icon": "🧧", "is_all": False, "time_limit": None, "min_match": None, "is_final": False, "sort_order": 101},
    {"target_mode": "rhythm", "name": "八段锦 · 上半段", "description": "前四式，侧重上半身与肩颈调理", "pose_ids": [11, 12, 13, 14], "tag": "八段锦", "icon": "🌿", "is_all": False, "time_limit": None, "min_match": None, "is_final": False, "sort_order": 102},
    {"target_mode": "rhythm", "name": "八段锦 · 下半段", "description": "后四式，侧重腰背与下肢锻炼", "pose_ids": [15, 16, 17, 18], "tag": "八段锦", "icon": "🧗", "is_all": False, "time_limit": None, "min_match": None, "is_final": False, "sort_order": 103},
    {"target_mode": "rhythm", "name": "晨间唤醒", "description": "晨起十分钟，唤醒身体，开启活力一天", "pose_ids": [31, 33, 22, 34, 1], "tag": "晨间", "icon": "🌅", "is_all": False, "time_limit": None, "min_match": None, "is_final": False, "sort_order": 104},
    {"target_mode": "rhythm", "name": "办公室减压", "description": "坐着也能练的肩颈放松操，缓解久坐疲劳", "pose_ids": [41, 42, 43, 44, 24], "tag": "办公室", "icon": "🪑", "is_all": False, "time_limit": None, "min_match": None, "is_final": False, "sort_order": 105},
    {"target_mode": "rhythm", "name": "肩颈舒缓", "description": "全方位肩颈拉伸，改善圆肩驼背", "pose_ids": [21, 22, 23, 24, 33], "tag": "肩颈", "icon": "💆", "is_all": False, "time_limit": None, "min_match": None, "is_final": False, "sort_order": 106},
    {"target_mode": "rhythm", "name": "手臂塑形", "description": "手臂全方位训练，紧致拜拜肉杀手", "pose_ids": [51, 52, 53, 54, 22, 2], "tag": "手臂", "icon": "💪", "is_all": False, "time_limit": None, "min_match": None, "is_final": False, "sort_order": 107},
    {"target_mode": "rhythm", "name": "瑜伽入门", "description": "基础瑜伽体式，提升柔韧性", "pose_ids": [6, 7, 8, 22, 2], "tag": "瑜伽", "icon": "🧘", "is_all": False, "time_limit": None, "min_match": None, "is_final": False, "sort_order": 108},
    {"target_mode": "rhythm", "name": "热身组合", "description": "快速活动肩颈，唤醒身体", "pose_ids": [1, 2, 33, 22], "tag": "热身", "icon": "🔥", "is_all": False, "time_limit": None, "min_match": None, "is_final": False, "sort_order": 109},
    {"target_mode": "rhythm", "name": "全身综合", "description": "覆盖所有部位的综合训练", "pose_ids": [], "tag": "综合", "icon": "🌟", "is_all": True, "time_limit": None, "min_match": None, "is_final": False, "sort_order": 110},
    # ---- 健身课程 ----
    {"target_mode": "rhythm", "name": "快速燃脂", "description": "3分钟快速燃脂：推举+开合跳+侧平举，高效燃脂", "pose_ids": [33,34]*10 + [43,44]*10 + [37,38]*10, "tag": "健身", "icon": "🔥", "is_all": False, "time_limit": None, "min_match": None, "is_final": False, "sort_order": 111},
    {"target_mode": "rhythm", "name": "全身塑形", "description": "8分钟全身塑形：推举+弯举+侧平举+前平举+深蹲，五大动作全面覆盖", "pose_ids": [33,34]*15 + [35,36]*15 + [37,38]*15 + [39,40]*15 + [41,42]*15 + [33,34]*15, "tag": "健身", "icon": "💪", "is_all": False, "time_limit": None, "min_match": None, "is_final": False, "sort_order": 112},
    {"target_mode": "rhythm", "name": "深度训练", "description": "20分钟深度训练：多组动作交替循环，持续燃脂塑形", "pose_ids": ([33,34]*20 + [35,36]*20 + [37,38]*20 + [39,40]*20 + [41,42]*20 + [43,44]*20 + [33,34]*20 + [35,36]*20 + [37,38]*20 + [41,42]*20 + [43,44]*20 + [33,34]*20 + [35,36]*20), "tag": "健身", "icon": "🏋️", "is_all": False, "time_limit": None, "min_match": None, "is_final": False, "sort_order": 113},
    {"target_mode": "rhythm", "name": "上肢强化", "description": "5分钟上肢专项：推举+弯举+侧平举+前平举，打造坚实上肢", "pose_ids": [33,34]*12 + [35,36]*12 + [37,38]*12 + [39,40]*12, "tag": "健身", "icon": "💪", "is_all": False, "time_limit": None, "min_match": None, "is_final": False, "sort_order": 114},
    {"target_mode": "rhythm", "name": "间歇燃脂", "description": "6分钟HIIT：开合跳+深蹲+推举+开合跳，高强度间歇燃脂", "pose_ids": [43,44]*12 + [41,42]*12 + [33,34]*12 + [43,44]*12, "tag": "健身", "icon": "⚡", "is_all": False, "time_limit": None, "min_match": None, "is_final": False, "sort_order": 115},
    {"target_mode": "rhythm", "name": "办公微运动", "description": "3分钟轻度运动：侧平举+弯举+前平举，久坐间隙活动筋骨", "pose_ids": [37,38]*8 + [35,36]*8 + [39,40]*8, "tag": "健身", "icon": "🪑", "is_all": False, "time_limit": None, "min_match": None, "is_final": False, "sort_order": 116},
    {"target_mode": "rhythm", "name": "手臂轰炸", "description": "10分钟手臂专训：弯举+侧平举+前平举+推举双循环，紧致拜拜肉", "pose_ids": [35,36]*15 + [37,38]*15 + [39,40]*15 + [33,34]*15 + [35,36]*15 + [37,38]*15, "tag": "健身", "icon": "💪", "is_all": False, "time_limit": None, "min_match": None, "is_final": False, "sort_order": 117},
    {"target_mode": "rhythm", "name": "腿臀特训", "description": "8分钟下肢专项：深蹲+开合跳交替循环，紧实臀腿线条", "pose_ids": [41,42]*15 + [43,44]*15 + [41,42]*15 + [43,44]*10, "tag": "健身", "icon": "🦵", "is_all": False, "time_limit": None, "min_match": None, "is_final": False, "sort_order": 118},
]


# ==================== 辅助函数 ====================

def _author_nickname(db: Session, user_id: int) -> str:
    if user_id == SYSTEM_OWNER_ID:
        return "系统预设"
    user = db.query(User).filter(User.id == user_id).first()
    return user.nickname if user else "匿名作者"


def _is_favorited(db: Session, user_id: int, level_id: int) -> bool:
    return (
        db.query(Favorite)
        .filter(
            Favorite.user_id == user_id,
            Favorite.target_type == "custom_level",
            Favorite.target_id == level_id,
        )
        .first()
        is not None
    )


def _level_to_dict(r: CustomLevel, db: Session, user_id: Optional[int] = None) -> dict:
    return {
        "id": r.id,
        "owner_id": r.owner_id,
        "name": r.name,
        "description": r.description or "",
        "target_mode": r.target_mode,
        "input_mode": r.input_mode,
        "frame_count": r.frame_count,
        "total_duration": r.total_duration,
        "source_duration_sec": r.source_duration_sec,
        "source_resolution": r.source_resolution,
        "play_count": r.play_count or 0,
        "favorite_count": r.favorite_count or 0,
        "is_public": r.is_public,
        "is_preset": r.is_preset,
        "forked_from": r.forked_from,
        "published_at": r.published_at,
        "created_at": r.created_at,
        "author_nickname": _author_nickname(db, r.owner_id),
        "is_favorited": _is_favorited(db, user_id, r.id) if user_id else False,
        # 引用的动作 ID 列表（两级存储：关卡引用 pose_templates）
        "pose_ids": r.pose_ids or [],
        # 预设字段
        "tag": r.tag,
        "icon": r.icon,
        "time_limit": r.time_limit,
        "min_match": r.min_match,
        "is_final": r.is_final,
        "is_all": r.is_all,
        "sort_order": r.sort_order,
    }


# ==================== 迁移 & 初始化 ====================

def migrate_custom_levels_table():
    """建表 + 迁移：为已有表添加新列 + 从 preset_levels/旧表迁移数据"""
    inspector = inspect(engine)
    existing = inspector.get_table_names()
    if "custom_levels" not in existing:
        CustomLevel.__table__.create(engine, checkfirst=True)
        print("[Migration] 已创建 custom_levels 表")
    else:
        # 已有表：逐列检查并添加
        columns = [c['name'] for c in inspector.get_columns('custom_levels')]
        new_cols = [
            ("is_preset", "BOOLEAN DEFAULT 0 NOT NULL"),
            ("tag", "VARCHAR(50)"),
            ("icon", "VARCHAR(50)"),
            ("time_limit", "INTEGER"),
            ("min_match", "INTEGER"),
            ("is_final", "BOOLEAN DEFAULT 0"),
            ("is_all", "BOOLEAN DEFAULT 0"),
            ("sort_order", "INTEGER DEFAULT 0"),
        ]
        for col_name, col_def in new_cols:
            if col_name not in columns:
                with engine.connect() as conn:
                    conn.execute(text(f"ALTER TABLE custom_levels ADD COLUMN {col_name} {col_def}"))
                    conn.commit()
                print(f"[Migration] custom_levels 表已添加 {col_name} 列")

        # 删除旧的 forked_from_type 列（如果存在）
        if 'forked_from_type' in columns:
            # SQLite 不支持 DROP COLUMN < 3.35，用 try/except
            try:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE custom_levels DROP COLUMN forked_from_type"))
                    conn.commit()
                print("[Migration] custom_levels 表已删除 forked_from_type 列")
            except Exception:
                pass  # 忽略不支持 DROP COLUMN 的数据库

    # 从 preset_levels 表迁移数据（如果存在）
    if "preset_levels" in existing:
        db = SessionLocal()
        try:
            # 只迁移还没迁移过的（custom_levels 中没有 is_preset=true 的记录）
            already = db.query(CustomLevel).filter(CustomLevel.is_preset == True).count()
            if already == 0:
                rows = db.execute(text(
                    "SELECT mode, name, desc, pose_ids, tag, icon, time_limit, min_match, is_final, is_all, sort_order FROM preset_levels ORDER BY sort_order, id"
                )).fetchall()
                for row in rows:
                    db.add(CustomLevel(
                        owner_id=SYSTEM_OWNER_ID,
                        name=row[1],
                        description=row[2] or "",
                        target_mode=row[0],
                        input_mode="video",
                        pose_ids=row[3] or [],
                        frame_count=len(row[3] or []),
                        is_public=True,
                        is_preset=True,
                        tag=row[4],
                        icon=row[5],
                        time_limit=row[6],
                        min_match=row[7],
                        is_final=row[8] or False,
                        is_all=row[9] or False,
                        sort_order=row[10] or 0,
                    ))
                db.commit()
                if rows:
                    print(f"[Migration] 已从 preset_levels 迁移 {len(rows)} 条到 custom_levels")
        finally:
            db.close()

    # 从旧 levels/courses 表迁移（首次部署兜底）
    db = SessionLocal()
    try:
        already = db.query(CustomLevel).filter(CustomLevel.is_preset == True).count()
        if already > 0:
            return

        if "levels" in existing:
            rows = db.execute(text(
                "SELECT id, name, desc, pose_ids, time_limit, min_match, is_final, tag FROM levels ORDER BY id"
            )).fetchall()
            for row in rows:
                db.add(CustomLevel(
                    owner_id=SYSTEM_OWNER_ID,
                    name=row[1],
                    description=row[2] or "",
                    target_mode="challenge",
                    pose_ids=row[3] or [],
                    frame_count=len(row[3] or []),
                    is_public=True,
                    is_preset=True,
                    tag=row[7] or "",
                    icon="🧘",
                    time_limit=row[4],
                    min_match=row[5],
                    is_final=row[6] or False,
                    sort_order=row[0],
                ))

        if "courses" in existing:
            rows = db.execute(text(
                "SELECT id, name, desc, pose_ids, tag, icon, is_all FROM courses ORDER BY id"
            )).fetchall()
            for idx, row in enumerate(rows, start=100):
                db.add(CustomLevel(
                    owner_id=SYSTEM_OWNER_ID,
                    name=row[1],
                    description=row[2] or "",
                    target_mode="rhythm",
                    pose_ids=row[3] or [],
                    frame_count=len(row[3] or []),
                    is_public=True,
                    is_preset=True,
                    tag=row[4] or "",
                    icon=row[5] or "🧘",
                    is_all=row[6] or False,
                    sort_order=idx,
                ))

        db.commit()
    finally:
        db.close()


def init_default_preset_levels():
    """初始化默认预设数据（upsert：按 target_mode+name 匹配）"""
    db = SessionLocal()
    try:
        existing = {(r.target_mode, r.name): r for r in db.query(CustomLevel).filter(CustomLevel.is_preset == True).all()}
        for item in DEFAULT_PRESET_LEVELS:
            key = (item["target_mode"], item["name"])
            if key in existing:
                rec = existing[key]
                rec.description = item["description"]
                rec.pose_ids = item["pose_ids"]
                rec.tag = item["tag"]
                rec.icon = item["icon"]
                rec.time_limit = item.get("time_limit")
                rec.min_match = item.get("min_match")
                rec.is_final = item.get("is_final", False)
                rec.is_all = item.get("is_all", False)
                rec.sort_order = item.get("sort_order", 0)
            else:
                db.add(CustomLevel(
                    owner_id=SYSTEM_OWNER_ID,
                    name=item["name"],
                    description=item["description"],
                    target_mode=item["target_mode"],
                    input_mode="video",
                    pose_ids=item["pose_ids"],
                    frame_count=len(item["pose_ids"]),
                    is_public=True,
                    is_preset=True,
                    tag=item.get("tag"),
                    icon=item.get("icon"),
                    time_limit=item.get("time_limit"),
                    min_match=item.get("min_match"),
                    is_final=item.get("is_final", False),
                    is_all=item.get("is_all", False),
                    sort_order=item.get("sort_order", 0),
                ))
        db.commit()
    finally:
        db.close()


# ==================== API ====================

@router.get("")
def list_levels(
    target_mode: Optional[str] = None,
    owner_id: Optional[int] = None,
    is_public: Optional[bool] = None,
    is_preset: Optional[bool] = None,
    keyword: Optional[str] = None,
    limit: int = 12,
    offset: int = 0,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """列出关卡：预设 / 公开市场 / 用户私有 / 全部"""
    limit = max(1, min(limit, MAX_PAGE_SIZE))
    offset = max(0, offset)

    query = db.query(CustomLevel)
    if is_public is not None:
        query = query.filter(CustomLevel.is_public == is_public)
    if is_preset is not None:
        query = query.filter(CustomLevel.is_preset == is_preset)
    if owner_id is not None:
        query = query.filter(CustomLevel.owner_id == owner_id)
    if target_mode and target_mode != "all":
        query = query.filter(CustomLevel.target_mode == target_mode)
    if keyword:
        query = query.filter(
            (CustomLevel.name.ilike(f"%{keyword}%"))
            | (CustomLevel.description.ilike(f"%{keyword}%"))
        )

    total = query.count()
    # 预设按 sort_order，非预设按 created_at
    if is_preset:
        records = query.order_by(CustomLevel.sort_order, CustomLevel.id).offset(offset).limit(limit).all()
    else:
        records = query.order_by(CustomLevel.created_at.desc()).offset(offset).limit(limit).all()

    items = [_level_to_dict(r, db, user_id) for r in records]
    return {"items": items, "total": total}


@router.get("/{level_id}")
def get_level_detail(
    level_id: int,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """获取关卡详情（含 pose_ids）"""
    record = db.query(CustomLevel).filter(CustomLevel.id == level_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="关卡不存在")

    # 已下架的关卡，仅作者和已收藏用户可访问（预设始终可访问）
    if not record.is_public and not record.is_preset:
        if user_id is None or (user_id != record.owner_id and not _is_favorited(db, user_id, level_id)):
            raise HTTPException(status_code=404, detail="该关卡已下架")

    d = _level_to_dict(record, db, user_id)
    return d


@router.post("")
def create_level(req: LevelCreateRequest, db: Session = Depends(get_db)):
    """创建私有关卡（占配额）"""
    if req.target_mode not in ("challenge", "rhythm"):
        raise HTTPException(status_code=400, detail="target_mode 必须为 challenge 或 rhythm")
    if not req.pose_ids:
        raise HTTPException(status_code=400, detail=f"{req.target_mode} 模式必须提供 pose_ids")

    # 配额检查（仅非预设关卡）
    count = (
        db.query(CustomLevel)
        .filter(
            CustomLevel.owner_id == req.owner_id,
            CustomLevel.is_public == False,
            CustomLevel.is_preset == False,
            CustomLevel.target_mode == req.target_mode,
        )
        .count()
    )
    if count >= MAX_LEVELS_PER_TYPE:
        raise HTTPException(
            status_code=403,
            detail=f"{req.target_mode}模式私有关卡已达上限({MAX_LEVELS_PER_TYPE}个)",
        )

    record = CustomLevel(
        owner_id=req.owner_id,
        name=req.name,
        description=req.description,
        target_mode=req.target_mode,
        input_mode=req.input_mode,
        pose_ids=req.pose_ids,
        frame_count=req.frame_count,
        total_duration=req.total_duration,
        source_duration_sec=req.source_duration_sec,
        source_resolution=req.source_resolution,
        is_public=False,
        is_preset=False,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"id": record.id, "name": record.name}


@router.post("/preset")
def create_preset_level(req: PresetLevelCreateRequest, db: Session = Depends(get_db)):
    """管理员创建预设关卡（不占配额）"""
    if req.target_mode not in ("challenge", "rhythm"):
        raise HTTPException(status_code=400, detail="target_mode 必须为 challenge 或 rhythm")
    record = CustomLevel(
        owner_id=SYSTEM_OWNER_ID,
        name=req.name,
        description=req.description,
        target_mode=req.target_mode,
        input_mode="video",
        pose_ids=req.pose_ids,
        frame_count=len(req.pose_ids),
        is_public=True,
        is_preset=True,
        tag=req.tag or "",
        icon=req.icon or "🧘",
        time_limit=req.time_limit,
        min_match=req.min_match,
        is_final=req.is_final or False,
        is_all=req.is_all or False,
        sort_order=req.sort_order or 0,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"id": record.id, "name": record.name}


@router.put("/{level_id}")
def update_level(level_id: int, req: PresetLevelCreateRequest, db: Session = Depends(get_db)):
    """更新关卡（预设和自定义通用）"""
    record = db.query(CustomLevel).filter(CustomLevel.id == level_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="关卡不存在")
    record.name = req.name
    record.description = req.description
    record.target_mode = req.target_mode
    record.pose_ids = req.pose_ids
    record.frame_count = len(req.pose_ids)
    record.tag = req.tag
    record.icon = req.icon
    record.time_limit = req.time_limit
    record.min_match = req.min_match
    record.is_final = req.is_final or False
    record.is_all = req.is_all or False
    record.sort_order = req.sort_order or 0
    db.commit()
    db.refresh(record)
    return {"id": record.id, "name": record.name}


@router.delete("/{level_id}")
def delete_level(level_id: int, user_id: int, db: Session = Depends(get_db)):
    """删除关卡（仅 owner；管理员可删预设）"""
    record = db.query(CustomLevel).filter(CustomLevel.id == level_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="关卡不存在")

    # 管理员可删除预设，普通用户只能删自己的非预设关卡
    if record.is_preset:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_admin:
            raise HTTPException(status_code=403, detail="预设关卡仅管理员可删除")
    elif record.owner_id != user_id:
        raise HTTPException(status_code=403, detail="只能删除自己的关卡")

    db.delete(record)
    db.commit()
    return {"detail": "已删除"}


@router.post("/{level_id}/fork")
def fork_level(level_id: int, req: ForkRequest, db: Session = Depends(get_db)):
    """Fork 关卡到私有：自动深拷贝所有引用动作（预设/社区关卡通用）"""
    original = db.query(CustomLevel).filter(CustomLevel.id == level_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="关卡不存在")

    # 关卡配额检查
    level_count = (
        db.query(CustomLevel)
        .filter(
            CustomLevel.owner_id == req.user_id,
            CustomLevel.is_public == False,
            CustomLevel.is_preset == False,
            CustomLevel.target_mode == original.target_mode,
        )
        .count()
    )
    if level_count >= MAX_LEVELS_PER_TYPE:
        raise HTTPException(
            status_code=403,
            detail=f"{original.target_mode}模式私有关卡已达上限({MAX_LEVELS_PER_TYPE}个)",
        )

    # 动作配额检查（现有私有 + 本次 ≤ 1000）
    pose_ids = original.pose_ids or []
    pose_count = (
        db.query(PoseTemplate)
        .filter(
            PoseTemplate.created_by == req.user_id,
            PoseTemplate.is_public == False,
        )
        .count()
    )
    if pose_count + len(pose_ids) > 1000:
        raise HTTPException(
            status_code=403,
            detail=f"Fork后将超过私有动作上限(1000)，当前{pose_count}+本次{len(pose_ids)}",
        )

    # 自动深拷贝所有引用动作
    new_pose_ids = []
    for pid in pose_ids:
        orig_pose = db.query(PoseTemplate).filter(PoseTemplate.id == pid).first()
        if orig_pose:
            new_pose = PoseTemplate(
                name=orig_pose.name,
                description=orig_pose.description,
                category=orig_pose.category,
                difficulty=orig_pose.difficulty,
                icon=orig_pose.icon,
                landmarks=orig_pose.landmarks,
                scoring_rules=orig_pose.scoring_rules,
                duration=orig_pose.duration,
                created_by=req.user_id,
                is_public=False,
                forked_from=orig_pose.id,
            )
            db.add(new_pose)
            db.flush()
            new_pose_ids.append(new_pose.id)

    # 创建关卡副本
    new_level = CustomLevel(
        owner_id=req.user_id,
        name=original.name,
        description=original.description or "",
        target_mode=original.target_mode,
        input_mode=original.input_mode,
        pose_ids=new_pose_ids,
        frame_count=len(new_pose_ids),
        total_duration=original.total_duration,
        source_duration_sec=original.source_duration_sec,
        source_resolution=original.source_resolution,
        is_public=False,
        is_preset=False,
        forked_from=original.id,
    )
    db.add(new_level)
    db.commit()
    db.refresh(new_level)
    return {
        "id": new_level.id,
        "name": new_level.name,
        "forked_from": new_level.forked_from,
        "forked_poses": len(new_pose_ids),
    }


@router.post("/{level_id}/play")
def play_level(level_id: int, db: Session = Depends(get_db)):
    """记录一次播放"""
    record = db.query(CustomLevel).filter(CustomLevel.id == level_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="关卡不存在")
    record.play_count = (record.play_count or 0) + 1
    db.commit()
    return {"play_count": record.play_count}


@router.patch("/{level_id}/rename")
def rename_level(level_id: int, req: RenameRequest, db: Session = Depends(get_db)):
    """重命名关卡（仅 owner；轻量更新 name/description，不触碰 pose_ids 等字段）"""
    record = db.query(CustomLevel).filter(CustomLevel.id == level_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="关卡不存在")
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
def publish_level(level_id: int, req: ForkRequest, db: Session = Depends(get_db)):
    """公开关卡到市场"""
    record = db.query(CustomLevel).filter(CustomLevel.id == level_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="关卡不存在")
    if record.owner_id != req.user_id:
        raise HTTPException(status_code=403, detail="只能公开自己的关卡")

    # 把引用的 PoseTemplate 标记为公开
    if record.pose_ids:
        for pid in record.pose_ids:
            tpl = db.query(PoseTemplate).filter(PoseTemplate.id == pid).first()
            if tpl and not tpl.is_public:
                tpl.is_public = True

    record.is_public = True
    record.published_at = datetime.utcnow()
    db.commit()
    return {"detail": "已公开", "is_public": True}


@router.post("/{level_id}/unpublish")
def unpublish_level(level_id: int, req: ForkRequest, db: Session = Depends(get_db)):
    """下架关卡（软删除，已收藏用户仍可使用）"""
    record = db.query(CustomLevel).filter(CustomLevel.id == level_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="关卡不存在")
    if record.owner_id != req.user_id:
        raise HTTPException(status_code=403, detail="只能下架自己的关卡")

    record.is_public = False
    db.commit()
    return {"detail": "已下架", "is_public": False}
