from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func as sql_func
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models.score import ScoreRecord
from ..models.user import User
from ..schemas.score import (
    ScoreRecordCreate,
    ScoreRecordResponse,
    LeaderboardEntry,
    MyRankResponse,
)

router = APIRouter(prefix="/api/scores", tags=["分数与排行榜"])

# 闯关模式达标分数线
CHALLENGE_PASS_SCORE = 80


@router.post("", response_model=ScoreRecordResponse)
def submit_score(score_data: ScoreRecordCreate, db: Session = Depends(get_db)):
    record = ScoreRecord(**score_data.model_dump())
    db.add(record)

    user = db.query(User).filter(User.id == score_data.user_id).first()
    if user:
        user.total_score += score_data.score
        user.games_played += 1

    db.commit()
    db.refresh(record)
    return record


@router.get("/user/{user_id}", response_model=List[ScoreRecordResponse])
def get_user_scores(
    user_id: int,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    records = (
        db.query(ScoreRecord)
        .filter(ScoreRecord.user_id == user_id)
        .order_by(ScoreRecord.created_at.desc())
        .limit(limit)
        .all()
    )
    return records


@router.get("/leaderboard", response_model=List[LeaderboardEntry])
def get_leaderboard(
    template_id: Optional[int] = None,
    game_mode: Optional[str] = None,
    limit: int = 10,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    # 排行榜只保留前 100 名，避免深分页
    limit = max(1, min(limit, 100))
    offset = max(0, min(offset, 100 - limit))

    query = db.query(ScoreRecord)
    if template_id:
        query = query.filter(ScoreRecord.template_id == template_id)
    if game_mode:
        query = query.filter(ScoreRecord.game_mode == game_mode)

    # 闯关模式：按耗时升序（越快越好），且只看达标记录（score >= 80）
    if game_mode == "challenge":
        query = query.filter(ScoreRecord.score >= CHALLENGE_PASS_SCORE)
        records = query.order_by(ScoreRecord.duration.asc()).offset(offset).limit(limit).all()
    else:
        records = query.order_by(ScoreRecord.score.desc()).offset(offset).limit(limit).all()

    result = []
    for i, record in enumerate(records):
        user = db.query(User).filter(User.id == record.user_id).first()
        result.append(
            LeaderboardEntry(
                rank=offset + i + 1,
                nickname=record.nickname,
                avatar=user.avatar if user else "",
                score=record.score,
                max_combo=record.max_combo,
                accuracy=record.accuracy,
                duration=record.duration,
                template_name=record.template_name,
                created_at=record.created_at,
            )
        )
    return result


@router.get("/leaderboard/count")
def get_leaderboard_count(
    template_id: Optional[int] = None,
    game_mode: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """返回符合条件的排行榜记录总数，供前端分页计算总页数"""
    query = db.query(sql_func.count(ScoreRecord.id))
    if template_id:
        query = query.filter(ScoreRecord.template_id == template_id)
    if game_mode:
        query = query.filter(ScoreRecord.game_mode == game_mode)
    # 闯关模式只统计达标记录
    if game_mode == "challenge":
        query = query.filter(ScoreRecord.score >= CHALLENGE_PASS_SCORE)
    # 排行榜只保留前 100 名，count 上限 100
    total = min(query.scalar() or 0, 100)
    return {"total": total}


@router.get("/my-rank/{user_id}", response_model=MyRankResponse)
def get_my_rank(
    user_id: int,
    game_mode: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """获取当前用户在排行榜中的排名"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    base_query = db.query(ScoreRecord)
    if game_mode:
        base_query = base_query.filter(ScoreRecord.game_mode == game_mode)

    # 闯关模式：按最短达标耗时排名（越快越好，需 score >= 80）
    if game_mode == "challenge":
        my_best = (
            base_query.filter(
                ScoreRecord.user_id == user_id,
                ScoreRecord.score >= CHALLENGE_PASS_SCORE,
            )
            .order_by(ScoreRecord.duration.asc())
            .first()
        )

        if not my_best:
            return MyRankResponse(
                rank=0,
                best_score=0,
                best_duration=0,
                max_combo=0,
                best_template="",
                total_players=0,
                has_score=False,
            )

        # 统计达标且耗时比我短的不同用户数
        higher_users = (
            db.query(sql_func.distinct(ScoreRecord.user_id))
            .filter(
                ScoreRecord.game_mode == game_mode,
                ScoreRecord.score >= CHALLENGE_PASS_SCORE,
                ScoreRecord.duration < my_best.duration,
            )
        )
        rank = higher_users.count() + 1
    else:
        my_best = (
            base_query.filter(ScoreRecord.user_id == user_id)
            .order_by(ScoreRecord.score.desc())
            .first()
        )

        if not my_best:
            return MyRankResponse(
                rank=0,
                best_score=0,
                best_duration=0,
                max_combo=0,
                best_template="",
                total_players=0,
                has_score=False,
            )

        higher_users = (
            db.query(sql_func.distinct(ScoreRecord.user_id))
            .filter(ScoreRecord.score > my_best.score)
        )
        if game_mode:
            higher_users = higher_users.filter(ScoreRecord.game_mode == game_mode)
        rank = higher_users.count() + 1

    all_players = db.query(sql_func.distinct(ScoreRecord.user_id))
    if game_mode:
        all_players = all_players.filter(ScoreRecord.game_mode == game_mode)
    total_players = all_players.count()

    return MyRankResponse(
        rank=rank,
        best_score=my_best.score,
        best_duration=my_best.duration,
        max_combo=my_best.max_combo,
        best_template=my_best.template_name,
        total_players=total_players,
        has_score=True,
    )
