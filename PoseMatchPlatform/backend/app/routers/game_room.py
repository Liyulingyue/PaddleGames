import random
import string
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text
from typing import Dict, List
from ..database import get_db, SessionLocal, engine
from ..models.game_room import GameRoom, RoomPlayer
from ..models.user import User
from ..models.score import ScoreRecord
from ..schemas.game_room import (
    GameRoomCreate,
    GameRoomResponse,
    RoomPlayerResponse,
    JoinRoomRequest,
    SubmitScoreRequest,
)
from ..schemas.score import GameMode


async def broadcast_event(room_code: str, event_type: str, data: dict):
    """通过 WebSocket 向房间内所有客户端广播事件"""
    message = {"type": event_type, **data}
    await manager.broadcast(room_code, message)

router = APIRouter(prefix="/api/rooms", tags=["游戏房间"])


def generate_room_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


def migrate_game_rooms_table():
    """迁移：给已有 game_rooms 表添加缺失列"""
    inspector = inspect(engine)
    if "game_rooms" not in inspector.get_table_names():
        return
    columns = [c["name"] for c in inspector.get_columns("game_rooms")]
    new_columns = [
        ("game_mode", "VARCHAR(20) DEFAULT 'rhythm'"),
        ("level_name", "VARCHAR(100) DEFAULT ''"),
        ("templates", "TEXT"),
        ("per_pose_sec", "INTEGER DEFAULT 8"),
        ("video_path", "VARCHAR(500) DEFAULT ''"),
        ("bone_video_path", "VARCHAR(500) DEFAULT ''"),
    ]
    added = []
    for col_name, col_def in new_columns:
        if col_name not in columns:
            with engine.connect() as conn:
                conn.execute(text(f"ALTER TABLE game_rooms ADD COLUMN {col_name} {col_def}"))
                conn.commit()
            added.append(col_name)
    if added:
        print(f"[Migration] game_rooms 表已添加列: {', '.join(added)}")

    # room_players 表添加 finished / duration 列
    if "room_players" in inspector.get_table_names():
        player_columns = [c["name"] for c in inspector.get_columns("room_players")]
        if "finished" not in player_columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE room_players ADD COLUMN finished BOOLEAN DEFAULT 0"))
                conn.commit()
            print("[Migration] room_players 表已添加列: finished")
        if "duration" not in player_columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE room_players ADD COLUMN duration INTEGER DEFAULT 0"))
                conn.commit()
            print("[Migration] room_players 表已添加列: duration")


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, room_code: str, websocket: WebSocket):
        await websocket.accept()
        if room_code not in self.active_connections:
            self.active_connections[room_code] = []
        self.active_connections[room_code].append(websocket)

    def disconnect(self, room_code: str, websocket: WebSocket):
        if room_code in self.active_connections:
            self.active_connections[room_code].remove(websocket)
            if len(self.active_connections[room_code]) == 0:
                del self.active_connections[room_code]

    async def broadcast(self, room_code: str, message: dict):
        if room_code in self.active_connections:
            broken = []
            for connection in self.active_connections[room_code]:
                try:
                    await connection.send_json(message)
                except Exception:
                    broken.append(connection)
            # 清理已断开的连接，防止下次继续报错
            for conn in broken:
                try:
                    self.active_connections[room_code].remove(conn)
                except ValueError:
                    pass
            if not self.active_connections.get(room_code):
                del self.active_connections[room_code]


manager = ConnectionManager()


@router.get("", response_model=List[GameRoomResponse])
def list_rooms(status: str = "waiting", db: Session = Depends(get_db)):
    """大厅房间列表，默认只返回 waiting 状态的房间"""
    query = db.query(GameRoom).filter(GameRoom.status == status)
    rooms = query.order_by(GameRoom.created_at.desc()).all()
    return rooms


@router.post("", response_model=GameRoomResponse)
def create_room(room_data: GameRoomCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == room_data.host_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    room_code = generate_room_code()
    while db.query(GameRoom).filter(GameRoom.room_code == room_code).first():
        room_code = generate_room_code()

    room = GameRoom(
        room_code=room_code,
        host_id=room_data.host_id,
        template_id=room_data.template_id,
        game_mode=room_data.game_mode or "rhythm",
        level_name=room_data.level_name or "",
        templates=room_data.templates,
        per_pose_sec=room_data.per_pose_sec or 8,
        max_players=room_data.max_players or 8,
        total_rounds=room_data.total_rounds or 3,
        round_duration=room_data.round_duration or 30,
        video_path=room_data.video_path or "",
        bone_video_path=room_data.bone_video_path or "",
    )
    db.add(room)
    db.flush()

    player = RoomPlayer(
        room_id=room.id,
        user_id=user.id,
        nickname=user.nickname,
        avatar=user.avatar,
        is_host=True,
        is_ready=False,
    )
    db.add(player)
    db.commit()
    db.refresh(room)
    return room


@router.get("/my-room")
def get_my_room(user_id: int, db: Session = Depends(get_db)):
    """查找用户当前所在的等待中房间（只有 waiting 状态才显示入口）"""
    players = db.query(RoomPlayer).filter(
        RoomPlayer.user_id == user_id,
    ).order_by(RoomPlayer.joined_at.desc()).all()
    if not players:
        return {"room_code": None}
    for player in players:
        room = db.query(GameRoom).filter(
            GameRoom.id == player.room_id,
            GameRoom.status == "waiting",
        ).first()
        if room:
            return {"room_code": room.room_code}
    return {"room_code": None}


@router.post("/{room_code}/leave")
def leave_room(room_code: str, user_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """玩家退出房间，房主退出则解散房间"""
    room = db.query(GameRoom).filter(GameRoom.room_code == room_code).first()
    if not room:
        raise HTTPException(status_code=404, detail="房间不存在")

    player = db.query(RoomPlayer).filter(
        RoomPlayer.room_id == room.id,
        RoomPlayer.user_id == user_id,
    ).first()
    if not player:
        raise HTTPException(status_code=404, detail="玩家不在房间中")

    # 游戏进行中不允许退出
    if room.status == "playing":
        raise HTTPException(status_code=400, detail="游戏进行中，无法退出")

    nickname = player.nickname

    if player.is_host:
        # 房主退出 = 解散房间
        room.status = "finished"
        from datetime import datetime
        room.ended_at = datetime.utcnow()
        # 删除所有玩家记录（cascade 会处理）
        db.query(RoomPlayer).filter(RoomPlayer.room_id == room.id).delete()
        db.commit()
        background_tasks.add_task(broadcast_event, room_code, "room_dissolved", {})
        return {"action": "dissolved", "room_code": room_code}
    else:
        # 普通玩家退出
        db.delete(player)
        db.commit()
        background_tasks.add_task(
            broadcast_event, room_code, "player_left",
            {"user_id": user_id, "nickname": nickname}
        )
        return {"action": "left", "room_code": room_code}


@router.get("/{room_code}", response_model=GameRoomResponse)
def get_room(room_code: str, db: Session = Depends(get_db)):
    room = db.query(GameRoom).filter(GameRoom.room_code == room_code).first()
    if not room:
        raise HTTPException(status_code=404, detail="房间不存在")
    return room


@router.post("/join", response_model=GameRoomResponse)
def join_room(join_data: JoinRoomRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    room = db.query(GameRoom).filter(GameRoom.room_code == join_data.room_code).first()
    if not room:
        raise HTTPException(status_code=404, detail="房间不存在")

    if room.status != "waiting":
        raise HTTPException(status_code=400, detail="游戏已开始，无法加入")

    if len(room.players) >= room.max_players:
        raise HTTPException(status_code=400, detail="房间已满")

    existing = db.query(RoomPlayer).filter(
        RoomPlayer.room_id == room.id,
        RoomPlayer.user_id == join_data.user_id,
    ).first()
    if existing:
        return room

    player = RoomPlayer(
        room_id=room.id,
        user_id=join_data.user_id,
        nickname=join_data.nickname,
        avatar=join_data.avatar or "",
        is_host=False,
        is_ready=False,
    )
    db.add(player)
    db.commit()
    db.refresh(room)

    # 广播玩家加入事件（包含完整玩家数据，供其他客户端本地更新）
    background_tasks.add_task(
        broadcast_event, room.room_code, "player_joined",
        {
            "user_id": join_data.user_id,
            "nickname": join_data.nickname,
            "avatar": join_data.avatar or "",
            "is_ready": False,
            "is_host": False,
            "total_score": 0,
            "current_score": 0,
        }
    )
    return room


@router.post("/{room_code}/ready")
def toggle_ready(room_code: str, user_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    room = db.query(GameRoom).filter(GameRoom.room_code == room_code).first()
    if not room:
        raise HTTPException(status_code=404, detail="房间不存在")

    player = db.query(RoomPlayer).filter(
        RoomPlayer.room_id == room.id,
        RoomPlayer.user_id == user_id,
    ).first()
    if not player:
        raise HTTPException(status_code=404, detail="玩家不在房间中")

    player.is_ready = not player.is_ready
    db.commit()

    # 广播准备状态变更
    background_tasks.add_task(
        broadcast_event, room_code, "player_ready",
        {"user_id": user_id, "nickname": player.nickname, "is_ready": player.is_ready}
    )
    return {"is_ready": player.is_ready}


@router.post("/{room_code}/start")
def start_game(room_code: str, user_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    room = db.query(GameRoom).filter(GameRoom.room_code == room_code).first()
    if not room:
        raise HTTPException(status_code=404, detail="房间不存在")

    if room.host_id != user_id:
        raise HTTPException(status_code=403, detail="只有房主可以开始游戏")

    if len(room.players) < 2:
        raise HTTPException(status_code=400, detail="至少需要2名玩家")

    all_ready = all(p.is_ready for p in room.players)
    if not all_ready:
        raise HTTPException(status_code=400, detail="所有玩家必须准备就绪才能开始")

    room.status = "playing"
    room.current_round = 1
    from datetime import datetime
    room.started_at = datetime.utcnow()

    for player in room.players:
        player.current_score = 0
        player.total_score = 0
        player.finished = False

    db.commit()
    background_tasks.add_task(broadcast_event, room_code, "game_start", {"round": 1})
    return {"status": "started", "room_code": room_code}


@router.post("/{room_code}/submit-score")
def submit_round_score(room_code: str, score_data: SubmitScoreRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    room = db.query(GameRoom).filter(GameRoom.room_code == room_code).first()
    if not room:
        raise HTTPException(status_code=404, detail="房间不存在")

    player = db.query(RoomPlayer).filter(
        RoomPlayer.room_id == room.id,
        RoomPlayer.user_id == score_data.user_id,
    ).first()
    if not player:
        raise HTTPException(status_code=404, detail="玩家不在房间中")

    if score_data.is_final:
        # 最终提交：累加总分、标记完成
        player.current_score = score_data.score
        player.total_score += score_data.score
        player.finished = True
        player.duration = score_data.duration

        # 检查是否所有玩家都完成了
        all_finished = all(p.finished for p in room.players)
        if all_finished:
            room.status = "finished"
            from datetime import datetime
            room.ended_at = datetime.utcnow()
    else:
        # 实时同步：只更新 current_score，不影响 finished/total_score
        player.current_score = score_data.score

    db.commit()
    db.refresh(player)

    # 广播分数更新
    background_tasks.add_task(
        broadcast_event, room_code, "score_update",
        {
            "user_id": score_data.user_id,
            "nickname": player.nickname,
            "current_score": player.current_score,
            "total_score": player.total_score,
        }
    )
    return {"total_score": player.total_score, "current_score": player.current_score}


@router.post("/{room_code}/next-round")
def next_round(room_code: str, user_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    room = db.query(GameRoom).filter(GameRoom.room_code == room_code).first()
    if not room:
        raise HTTPException(status_code=404, detail="房间不存在")

    if room.host_id != user_id:
        raise HTTPException(status_code=403, detail="只有房主可以操作")

    if room.current_round >= room.total_rounds:
        room.status = "finished"
        from datetime import datetime
        room.ended_at = datetime.utcnow()
        db.commit()
        background_tasks.add_task(broadcast_event, room_code, "game_end", {})
        return {"status": "finished", "final_round": room.current_round}

    room.current_round += 1
    for player in room.players:
        player.current_score = 0

    db.commit()
    background_tasks.add_task(broadcast_event, room_code, "next_round", {"round": room.current_round})
    return {"status": "next_round", "round": room.current_round}


@router.post("/{room_code}/restart")
def restart_room(room_code: str, user_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """游戏结束后返回房间，重置状态以便重新开始"""
    room = db.query(GameRoom).filter(GameRoom.room_code == room_code).first()
    if not room:
        raise HTTPException(status_code=404, detail="房间不存在")

    if room.host_id != user_id:
        raise HTTPException(status_code=403, detail="只有房主可以操作")

    # 重置房间和玩家状态
    room.status = "waiting"
    room.ended_at = None
    for player in room.players:
        player.current_score = 0
        player.total_score = 0
        player.finished = False
        player.is_ready = False

    db.commit()
    background_tasks.add_task(broadcast_event, room_code, "room_restart", {})
    return {"status": "waiting"}


@router.websocket("/ws/{room_code}")
async def websocket_endpoint(websocket: WebSocket, room_code: str):
    await manager.connect(room_code, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "chat":
                await manager.broadcast(room_code, {
                    "type": "chat",
                    "nickname": data.get("nickname", "匿名"),
                    "message": data.get("message", ""),
                })
            elif action == "pose_update":
                await manager.broadcast(room_code, {
                    "type": "pose_update",
                    "user_id": data.get("user_id"),
                    "nickname": data.get("nickname"),
                    "score": data.get("score", 0),
                    "match_percent": data.get("match_percent", 0),
                })
            elif action == "round_finished":
                await manager.broadcast(room_code, {
                    "type": "round_finished",
                    "user_id": data.get("user_id"),
                    "nickname": data.get("nickname"),
                    "score": data.get("score", 0),
                })
            elif action == "game_start":
                await manager.broadcast(room_code, {
                    "type": "game_start",
                    "round": data.get("round", 1),
                })
            elif action == "player_joined":
                await manager.broadcast(room_code, {
                    "type": "player_joined",
                    "user_id": data.get("user_id"),
                    "nickname": data.get("nickname"),
                    "avatar": data.get("avatar", ""),
                    "is_ready": data.get("is_ready", False),
                    "is_host": data.get("is_host", False),
                    "total_score": data.get("total_score", 0),
                    "current_score": data.get("current_score", 0),
                })
            elif action == "player_ready":
                await manager.broadcast(room_code, {
                    "type": "player_ready",
                    "user_id": data.get("user_id"),
                    "nickname": data.get("nickname"),
                    "is_ready": data.get("is_ready", False),
                })
            elif action == "player_left":
                await manager.broadcast(room_code, {
                    "type": "player_left",
                    "user_id": data.get("user_id"),
                    "nickname": data.get("nickname"),
                })
            elif action == "room_dissolved":
                await manager.broadcast(room_code, {
                    "type": "room_dissolved",
                })

    except WebSocketDisconnect:
        manager.disconnect(room_code, websocket)
