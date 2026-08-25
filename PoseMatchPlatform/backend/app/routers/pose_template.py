from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import inspect, text
from sqlalchemy.orm.attributes import flag_modified
from typing import List, Optional
from pydantic import BaseModel
import math
from ..database import get_db, engine
from ..models.pose_template import PoseTemplate
from ..models.custom_level import CustomLevel
from ..schemas.pose_template import PoseTemplateCreate, PoseTemplateResponse

router = APIRouter(prefix="/api/pose-templates", tags=["动作模板"])


KP_INDEX = {
    "NOSE": 0,
    "LEFT_EYE_INNER": 1,
    "LEFT_EYE": 2,
    "LEFT_EYE_OUTER": 3,
    "RIGHT_EYE_INNER": 4,
    "RIGHT_EYE": 5,
    "RIGHT_EYE_OUTER": 6,
    "LEFT_EAR": 7,
    "RIGHT_EAR": 8,
    "MOUTH_LEFT": 9,
    "MOUTH_RIGHT": 10,
    "LEFT_SHOULDER": 11,
    "RIGHT_SHOULDER": 12,
    "LEFT_ELBOW": 13,
    "RIGHT_ELBOW": 14,
    "LEFT_WRIST": 15,
    "RIGHT_WRIST": 16,
    "LEFT_PINKY": 17,
    "RIGHT_PINKY": 18,
    "LEFT_INDEX": 19,
    "RIGHT_INDEX": 20,
    "LEFT_THUMB": 21,
    "RIGHT_THUMB": 22,
    "LEFT_HIP": 23,
    "RIGHT_HIP": 24,
    "LEFT_KNEE": 25,
    "RIGHT_KNEE": 26,
    "LEFT_ANKLE": 27,
    "RIGHT_ANKLE": 28,
    "LEFT_HEEL": 29,
    "RIGHT_HEEL": 30,
    "LEFT_FOOT_INDEX": 31,
    "RIGHT_FOOT_INDEX": 32,
}


def _kp(name, x, y):
    return {"name": name, "x": round(x, 4), "y": round(y, 4)}


def _rule_angle_dir(start, end, target_angle, tolerance=0.15, weight=1.0, required=True):
    return {
        "type": "angle_dir",
        "points": [start, end],
        "targetValue": {
            "x": round(math.cos(target_angle), 4),
            "y": round(math.sin(target_angle), 4),
        },
        "tolerance": tolerance,
        "weight": weight,
        "required": required,
    }


def _rule_angle_3pt(p1, vertex, p2, target, tolerance=0.4, weight=1.0, required=True):
    return {
        "type": "angle_3pt",
        "points": [p1, vertex, p2],
        "targetValue": round(target, 4),
        "tolerance": tolerance,
        "weight": weight,
        "required": required,
    }


def _base_landmarks():
    cx = 0.5
    shoulder_y = 0.35
    shoulder_half = 0.12
    hip_y = 0.62
    hip_half = 0.08
    head_r = 0.08
    head_cy = shoulder_y - 0.12

    lm = {}
    lm["LEFT_SHOULDER"] = _kp("LEFT_SHOULDER", cx + shoulder_half, shoulder_y)
    lm["RIGHT_SHOULDER"] = _kp("RIGHT_SHOULDER", cx - shoulder_half, shoulder_y)
    lm["LEFT_HIP"] = _kp("LEFT_HIP", cx + hip_half, hip_y)
    lm["RIGHT_HIP"] = _kp("RIGHT_HIP", cx - hip_half, hip_y)

    lm["NOSE"] = _kp("NOSE", cx, head_cy - head_r * 0.3)
    lm["LEFT_EYE"] = _kp("LEFT_EYE", cx + head_r * 0.4, head_cy - head_r * 0.4)
    lm["RIGHT_EYE"] = _kp("RIGHT_EYE", cx - head_r * 0.4, head_cy - head_r * 0.4)
    lm["LEFT_EAR"] = _kp("LEFT_EAR", cx + head_r * 0.8, head_cy - head_r * 0.2)
    lm["RIGHT_EAR"] = _kp("RIGHT_EAR", cx - head_r * 0.8, head_cy - head_r * 0.2)
    lm["LEFT_EYE_INNER"] = _kp("LEFT_EYE_INNER", cx + head_r * 0.2, head_cy - head_r * 0.4)
    lm["RIGHT_EYE_INNER"] = _kp("RIGHT_EYE_INNER", cx - head_r * 0.2, head_cy - head_r * 0.4)
    lm["LEFT_EYE_OUTER"] = _kp("LEFT_EYE_OUTER", cx + head_r * 0.6, head_cy - head_r * 0.4)
    lm["RIGHT_EYE_OUTER"] = _kp("RIGHT_EYE_OUTER", cx - head_r * 0.6, head_cy - head_r * 0.4)
    lm["MOUTH_LEFT"] = _kp("MOUTH_LEFT", cx + head_r * 0.3, head_cy + head_r * 0.2)
    lm["MOUTH_RIGHT"] = _kp("MOUTH_RIGHT", cx - head_r * 0.3, head_cy + head_r * 0.2)

    return lm


def _set_arm(lm, side, shoulder_angle, elbow_bend=3.0):
    shoulder = lm[f"{side}_SHOULDER"]
    arm_len = 0.22
    upper_len = arm_len * 0.48
    fore_len = arm_len * 0.52

    ex = shoulder["x"] + upper_len * math.cos(shoulder_angle)
    ey = shoulder["y"] + upper_len * math.sin(shoulder_angle)
    lm[f"{side}_ELBOW"] = _kp(f"{side}_ELBOW", ex, ey)

    sign = 1 if side == "LEFT" else -1
    wrist_angle = shoulder_angle + sign * (math.pi - elbow_bend)
    wx = ex + fore_len * math.cos(wrist_angle)
    wy = ey + fore_len * math.sin(wrist_angle)
    lm[f"{side}_WRIST"] = _kp(f"{side}_WRIST", wx, wy)

    if side == "LEFT":
        sign = 1
    else:
        sign = -1
    lm[f"{side}_PINKY"] = _kp(f"{side}_PINKY", wx - sign * 0.015, wy + 0.02)
    lm[f"{side}_INDEX"] = _kp(f"{side}_INDEX", wx + sign * 0.01, wy + 0.025)
    lm[f"{side}_THUMB"] = _kp(f"{side}_THUMB", wx + sign * 0.02, wy - 0.01)


def _set_leg(lm, side, hip_angle, knee_bend=2.9):
    hip = lm[f"{side}_HIP"]
    leg_len = 0.28
    thigh_len = leg_len * 0.5
    shin_len = leg_len * 0.5

    kx = hip["x"] + thigh_len * math.cos(hip_angle)
    ky = hip["y"] + thigh_len * math.sin(hip_angle)
    lm[f"{side}_KNEE"] = _kp(f"{side}_KNEE", kx, ky)

    sign = 1 if side == "LEFT" else -1
    ankle_angle = hip_angle + sign * (math.pi - knee_bend)
    ax = kx + shin_len * math.cos(ankle_angle)
    ay = ky + shin_len * math.sin(ankle_angle)
    lm[f"{side}_ANKLE"] = _kp(f"{side}_ANKLE", ax, ay)

    foot_len = 0.05
    if side == "LEFT":
        sign = 1
    else:
        sign = -1
    lm[f"{side}_HEEL"] = _kp(f"{side}_HEEL", ax - sign * foot_len * 0.3, ay + 0.015)
    lm[f"{side}_FOOT_INDEX"] = _kp(f"{side}_FOOT_INDEX", ax + sign * foot_len * 0.7, ay + 0.01)


def _lm_to_list(lm_dict):
    result = [None] * 33
    for name, kp in lm_dict.items():
        idx = KP_INDEX.get(name)
        if idx is not None:
            result[idx] = kp
    for i in range(33):
        if result[i] is None:
            name = list(KP_INDEX.keys())[list(KP_INDEX.values()).index(i)]
            result[i] = _kp(name, 0.5, 0.5)
    return result


def build_template(
    name, description, category, difficulty, icon, duration,
    left_shoulder_angle=math.pi / 2,
    right_shoulder_angle=math.pi / 2,
    left_elbow_bend=3.0,
    right_elbow_bend=3.0,
    left_hip_angle=math.pi / 2,
    right_hip_angle=math.pi / 2,
    left_knee_bend=2.9,
    right_knee_bend=2.9,
    scoring_rules=None,
):
    lm = _base_landmarks()
    _set_arm(lm, "LEFT", left_shoulder_angle, left_elbow_bend)
    _set_arm(lm, "RIGHT", right_shoulder_angle, right_elbow_bend)
    _set_leg(lm, "LEFT", left_hip_angle, left_knee_bend)
    _set_leg(lm, "RIGHT", right_hip_angle, right_knee_bend)

    if scoring_rules is None:
        scoring_rules = []

    return {
        "name": name,
        "description": description,
        "category": category,
        "difficulty": difficulty,
        "icon": icon,
        "landmarks": _lm_to_list(lm),
        "scoring_rules": scoring_rules,
        "duration": duration,
    }


def _shoulder_rules(left_angle, right_angle, tol=0.15):
    return [
        _rule_angle_dir("LEFT_SHOULDER", "LEFT_WRIST", left_angle, tol),
        _rule_angle_dir("RIGHT_SHOULDER", "RIGHT_WRIST", right_angle, tol),
    ]


def _elbow_rules(left_bend, right_bend, tol=0.4):
    return [
        _rule_angle_3pt("LEFT_SHOULDER", "LEFT_ELBOW", "LEFT_WRIST", left_bend, tol),
        _rule_angle_3pt("RIGHT_SHOULDER", "RIGHT_ELBOW", "RIGHT_WRIST", right_bend, tol),
    ]


def _hip_rules(left_angle, right_angle, tol=0.15):
    return [
        _rule_angle_dir("LEFT_HIP", "LEFT_ANKLE", left_angle, tol),
        _rule_angle_dir("RIGHT_HIP", "RIGHT_ANKLE", right_angle, tol),
    ]


def _knee_rules(left_bend, right_bend, tol=0.4):
    return [
        _rule_angle_3pt("LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE", left_bend, tol),
        _rule_angle_3pt("RIGHT_HIP", "RIGHT_KNEE", "RIGHT_ANKLE", right_bend, tol),
    ]


DEFAULT_TEMPLATES = [
    build_template(
        "T字站", "双臂水平展开成T字形", "热身", 1, "🤸", 5,
        left_shoulder_angle=0.0, right_shoulder_angle=math.pi,
        left_elbow_bend=3.0, right_elbow_bend=3.0,
        left_hip_angle=math.pi / 2, right_hip_angle=math.pi / 2,
        left_knee_bend=3.0, right_knee_bend=3.0,
        scoring_rules=(
            _shoulder_rules(0.0, math.pi, 0.5)
            + _elbow_rules(3.0, 3.0, 0.4)
            + _hip_rules(math.pi / 2, math.pi / 2, 0.3)
            + _knee_rules(3.0, 3.0, 0.4)
        ),
    ),
    build_template(
        "双手上举", "双手向上伸直举起", "热身", 1, "🙋", 5,
        left_shoulder_angle=-math.pi / 2, right_shoulder_angle=-math.pi / 2,
        left_elbow_bend=3.1, right_elbow_bend=3.1,
        scoring_rules=(
            _shoulder_rules(-math.pi / 2, -math.pi / 2, 0.6)
            + _elbow_rules(3.1, 3.1, 0.4)
            + _hip_rules(math.pi / 2, math.pi / 2, 0.3)
            + _knee_rules(3.0, 3.0, 0.4)
        ),
    ),
    build_template(
        "左手平举", "左手向左侧水平展开", "基础", 2, "👈", 5,
        left_shoulder_angle=0.0, right_shoulder_angle=math.pi / 2,
        scoring_rules=_shoulder_rules(0.0, math.pi / 2, 0.4),
    ),
    build_template(
        "右手平举", "右手向右侧水平展开", "基础", 2, "👉", 5,
        left_shoulder_angle=math.pi / 2, right_shoulder_angle=math.pi,
        scoring_rules=_shoulder_rules(math.pi / 2, math.pi, 0.4),
    ),
    build_template(
        "武士式", "左手前伸，右手上举", "进阶", 3, "⚔️", 8,
        left_shoulder_angle=0.0, right_shoulder_angle=-math.pi / 2,
        scoring_rules=_shoulder_rules(0.0, -math.pi / 2, 0.5),
    ),
    build_template(
        "树式", "双手上举保持平衡", "瑜伽", 3, "🧘", 10,
        left_shoulder_angle=-math.pi / 2, right_shoulder_angle=-math.pi / 2,
        left_elbow_bend=2.0, right_elbow_bend=2.0,
        right_hip_angle=math.pi * 0.35,
        right_knee_bend=1.8,
        scoring_rules=(
            _shoulder_rules(-math.pi / 2, -math.pi / 2, 0.6)
            + _elbow_rules(2.0, 2.0, 0.5)
            + _hip_rules(math.pi / 2, math.pi * 0.35, 0.3)
            + _knee_rules(3.0, 1.8, 0.5)
        ),
    ),
    build_template(
        "战士二式", "双臂水平展开，身体侧转", "瑜伽", 2, "🏋️", 8,
        left_shoulder_angle=0.0, right_shoulder_angle=math.pi,
        left_elbow_bend=3.0, right_elbow_bend=3.0,
        left_hip_angle=math.pi * 0.6, right_hip_angle=math.pi * 0.4,
        left_knee_bend=2.2, right_knee_bend=2.8,
        scoring_rules=(
            _shoulder_rules(0.0, math.pi, 0.5)
            + _elbow_rules(3.0, 3.0, 0.4)
            + _hip_rules(math.pi * 0.6, math.pi * 0.4, 0.4)
            + _knee_rules(2.2, 2.8, 0.5)
        ),
    ),
    build_template(
        "鹰式手臂", "双臂交叉环绕在胸前", "瑜伽", 3, "🦅", 8,
        left_shoulder_angle=math.pi * 0.4, right_shoulder_angle=-math.pi * 0.4,
        left_elbow_bend=1.8, right_elbow_bend=1.8,
        scoring_rules=(
            _shoulder_rules(math.pi * 0.4, -math.pi * 0.4, 0.4)
            + _elbow_rules(1.8, 1.8, 0.5)
            + _hip_rules(math.pi / 2, math.pi / 2, 0.3)
            + _knee_rules(3.0, 3.0, 0.4)
        ),
    ),
    build_template(
        "托天理三焦", "双手上举，抬头看手 - 八段锦第一式", "八段锦", 2, "🌸", 8,
        left_shoulder_angle=-math.pi / 2, right_shoulder_angle=-math.pi / 2,
        scoring_rules=_shoulder_rules(-math.pi / 2, -math.pi / 2, 0.5),
    ),
    build_template(
        "左右开弓似射雕", "左手前推，右手拉弓 - 八段锦第二式", "八段锦", 3, "🏹", 8,
        left_shoulder_angle=0.0, right_shoulder_angle=0.0,
        scoring_rules=_shoulder_rules(0.0, 0.0, 0.5),
    ),
    build_template(
        "调理脾胃须单举", "左手上托，右手下按 - 八段锦第三式", "八段锦", 2, "🌿", 8,
        left_shoulder_angle=-math.pi / 2, right_shoulder_angle=math.pi / 2,
        scoring_rules=_shoulder_rules(-math.pi / 2, math.pi / 2, 0.5),
    ),
    build_template(
        "五劳七伤往后瞧", "双臂展开，转头后望 - 八段锦第四式", "八段锦", 2, "🦢", 8,
        left_shoulder_angle=-0.3, right_shoulder_angle=math.pi + 0.3,
        scoring_rules=_shoulder_rules(-0.3, math.pi + 0.3, 0.4),
    ),
    build_template(
        "摇头摆尾去心火", "俯身转体，舒展躯干 - 八段锦第五式", "八段锦", 3, "🐉", 10,
        left_shoulder_angle=0.2, right_shoulder_angle=math.pi - 0.2,
        scoring_rules=_shoulder_rules(0.2, math.pi - 0.2, 0.6),
    ),
    build_template(
        "两手攀足固肾腰", "双手下伸，触摸脚尖 - 八段锦第六式", "八段锦", 3, "🧗", 10,
        left_shoulder_angle=math.pi / 2, right_shoulder_angle=math.pi / 2,
        scoring_rules=_shoulder_rules(math.pi / 2, math.pi / 2, 0.6),
    ),
    build_template(
        "攒拳怒目增气力", "握拳前冲，怒目圆睁 - 八段锦第七式", "八段锦", 2, "👊", 8,
        left_shoulder_angle=0.0, right_shoulder_angle=math.pi,
        scoring_rules=_shoulder_rules(0.0, math.pi, 0.5),
    ),
    build_template(
        "背后七颠百病消", "双手背后，踮脚颠颤 - 八段锦第八式", "八段锦", 1, "✨", 8,
        left_shoulder_angle=math.pi * 0.7, right_shoulder_angle=-math.pi * 0.7,
        scoring_rules=_shoulder_rules(math.pi * 0.7, -math.pi * 0.7, 0.5),
    ),
    build_template(
        "肩部环绕上", "双臂从前向上环绕至头顶", "肩颈", 1, "💆", 5,
        left_shoulder_angle=-math.pi / 2, right_shoulder_angle=-math.pi / 2,
        scoring_rules=_shoulder_rules(-math.pi / 2, -math.pi / 2, 0.5),
    ),
    build_template(
        "肩外展90度", "双臂侧平举成90度", "肩颈", 1, "🕊️", 5,
        left_shoulder_angle=0.0, right_shoulder_angle=math.pi,
        scoring_rules=_shoulder_rules(0.0, math.pi, 0.4),
    ),
    build_template(
        "耸肩沉肩", "耸起双肩然后放松下沉", "肩颈", 1, "😌", 5,
        left_shoulder_angle=-math.pi / 3, right_shoulder_angle=-math.pi / 3,
        scoring_rules=_shoulder_rules(-math.pi / 3, -math.pi / 3, 0.5),
    ),
    build_template(
        "反向拉伸", "双手背后合十，挺胸抬头", "肩颈", 2, "🧘‍♀️", 6,
        left_shoulder_angle=math.pi * 0.7, right_shoulder_angle=-math.pi * 0.7,
        scoring_rules=_shoulder_rules(math.pi * 0.7, -math.pi * 0.7, 0.5),
    ),
    build_template(
        "双手合十上举", "双手合十慢慢向上举过头顶", "晨间", 1, "🌅", 6,
        left_shoulder_angle=-math.pi / 2, right_shoulder_angle=-math.pi / 2,
        scoring_rules=_shoulder_rules(-math.pi / 2, -math.pi / 2, 0.5),
    ),
    build_template(
        "侧弯伸展", "一只手向上伸直，身体侧屈", "晨间", 2, "🌊", 6,
        left_shoulder_angle=-math.pi / 2, right_shoulder_angle=math.pi * 0.3,
        scoring_rules=_shoulder_rules(-math.pi / 2, math.pi * 0.3, 0.5),
    ),
    build_template(
        "扩胸运动", "双臂展开挺胸，再合拢抱肩", "晨间", 1, "💪", 5,
        left_shoulder_angle=0.0, right_shoulder_angle=math.pi,
        scoring_rules=_shoulder_rules(0.0, math.pi, 0.5),
    ),
    build_template(
        "转体伸展", "双臂平举，身体左右扭转", "晨间", 2, "🎡", 6,
        left_shoulder_angle=-0.2, right_shoulder_angle=math.pi - 0.2,
        scoring_rules=_shoulder_rules(-0.2, math.pi - 0.2, 0.5),
    ),
    build_template(
        "举臂伸展", "双手上举，拉伸脊柱", "办公室", 1, "🖥️", 6,
        left_shoulder_angle=-math.pi / 2, right_shoulder_angle=-math.pi / 2,
        scoring_rules=_shoulder_rules(-math.pi / 2, -math.pi / 2, 0.5),
    ),
    build_template(
        "肩颈放松", "耸肩、沉肩、转头放松", "办公室", 1, "☕", 5,
        left_shoulder_angle=-math.pi / 3, right_shoulder_angle=-math.pi / 3,
        scoring_rules=_shoulder_rules(-math.pi / 3, -math.pi / 3, 0.5),
    ),
    build_template(
        "手臂交叉拉伸", "一臂横过胸前，另一手辅助拉伸", "办公室", 2, "🪑", 6,
        left_shoulder_angle=math.pi * 0.3, right_shoulder_angle=-math.pi / 4,
        scoring_rules=_shoulder_rules(math.pi * 0.3, -math.pi / 4, 0.4),
    ),
    build_template(
        "手腕放松", "双手上下摆动放松腕部", "办公室", 1, "⌨️", 5,
        left_shoulder_angle=math.pi * 0.15, right_shoulder_angle=-math.pi * 0.15,
        scoring_rules=_shoulder_rules(math.pi * 0.15, -math.pi * 0.15, 0.4),
    ),
    build_template(
        "手臂下压", "双臂向身体两侧下方压", "手臂", 2, "💪", 5,
        left_shoulder_angle=math.pi / 2, right_shoulder_angle=math.pi / 2,
        scoring_rules=_shoulder_rules(math.pi / 2, math.pi / 2, 0.4),
    ),
    build_template(
        "前平举", "双臂向前平举至肩高", "手臂", 2, "🏋️‍♀️", 5,
        left_shoulder_angle=-0.1, right_shoulder_angle=-math.pi + 0.1,
        scoring_rules=_shoulder_rules(-0.1, -math.pi + 0.1, 0.5),
    ),
    build_template(
        "斜上举", "双臂向斜上方45度举起", "手臂", 2, "🎯", 5,
        left_shoulder_angle=-math.pi / 4, right_shoulder_angle=-math.pi * 3 / 4,
        scoring_rules=_shoulder_rules(-math.pi / 4, -math.pi * 3 / 4, 0.5),
    ),
    build_template(
        "V字伸展", "双臂向上展开成V字形", "手臂", 2, "✌️", 5,
        left_shoulder_angle=-math.pi / 3, right_shoulder_angle=-math.pi * 2 / 3,
        scoring_rules=_shoulder_rules(-math.pi / 3, -math.pi * 2 / 3, 0.5),
    ),
    # ============ 健身动作模板 ============
    # 推举：双臂上举 ↔ 双手肩位
    build_template(
        "推举·上举", "双臂向上推举至伸直", "健身", 1, "🏋️", 5,
        left_shoulder_angle=-math.pi / 2, right_shoulder_angle=-math.pi / 2,
        left_elbow_bend=3.0, right_elbow_bend=3.0,
        scoring_rules=_shoulder_rules(-math.pi / 2, -math.pi / 2, 0.3) + _elbow_rules(3.0, 3.0, 0.3),
    ),
    build_template(
        "推举·肩位", "双手降至肩位，准备下一次推举", "健身", 1, "🏋️", 5,
        left_shoulder_angle=-0.3, right_shoulder_angle=-math.pi + 0.3,
        left_elbow_bend=2.2, right_elbow_bend=2.2,
        scoring_rules=_shoulder_rules(-0.3, -math.pi + 0.3, 0.3) + _elbow_rules(2.2, 2.2, 0.3),
    ),
    # 弯举：双手弯举至肩 ↔ 双臂下垂
    build_template(
        "弯举·举至肩", "弯举至肩，收缩肱二头肌", "健身", 1, "💪", 5,
        left_shoulder_angle=math.pi / 2, right_shoulder_angle=math.pi / 2,
        left_elbow_bend=1.2, right_elbow_bend=1.2,
        scoring_rules=_shoulder_rules(math.pi / 2, math.pi / 2, 0.3) + _elbow_rules(1.2, 1.2, 0.3),
    ),
    build_template(
        "弯举·下垂", "双臂自然下垂，准备弯举", "健身", 1, "💪", 5,
        left_shoulder_angle=math.pi / 2, right_shoulder_angle=math.pi / 2,
        left_elbow_bend=3.0, right_elbow_bend=3.0,
        scoring_rules=_shoulder_rules(math.pi / 2, math.pi / 2, 0.3) + _elbow_rules(3.0, 3.0, 0.3),
    ),
    # 侧平举：双臂侧平 ↔ 双臂下垂
    build_template(
        "侧平举·展臂", "双臂侧平举至水平", "健身", 1, "🦅", 5,
        left_shoulder_angle=0.0, right_shoulder_angle=math.pi,
        left_elbow_bend=3.0, right_elbow_bend=3.0,
        scoring_rules=_shoulder_rules(0.0, math.pi, 0.3) + _elbow_rules(3.0, 3.0, 0.3),
    ),
    build_template(
        "侧平举·收臂", "双臂收回体侧", "健身", 1, "🦅", 5,
        left_shoulder_angle=math.pi / 2, right_shoulder_angle=math.pi / 2,
        left_elbow_bend=3.0, right_elbow_bend=3.0,
        scoring_rules=_shoulder_rules(math.pi / 2, math.pi / 2, 0.3) + _elbow_rules(3.0, 3.0, 0.3),
    ),
    # 前平举：双臂前举 ↔ 双臂下垂
    build_template(
        "前平举·举起", "双臂向前举至水平", "健身", 1, "🎯", 5,
        left_shoulder_angle=-0.1, right_shoulder_angle=-math.pi + 0.1,
        left_elbow_bend=3.0, right_elbow_bend=3.0,
        scoring_rules=_shoulder_rules(-0.1, -math.pi + 0.1, 0.3) + _elbow_rules(3.0, 3.0, 0.3),
    ),
    build_template(
        "前平举·落下", "双臂放下至体侧", "健身", 1, "🎯", 5,
        left_shoulder_angle=math.pi / 2, right_shoulder_angle=math.pi / 2,
        left_elbow_bend=3.0, right_elbow_bend=3.0,
        scoring_rules=_shoulder_rules(math.pi / 2, math.pi / 2, 0.3) + _elbow_rules(3.0, 3.0, 0.3),
    ),
    # 深蹲：蹲下 ↔ 站起
    build_template(
        "深蹲·蹲下", "双手前伸保持平衡，屈膝蹲下", "健身", 2, "🦵", 6,
        left_shoulder_angle=-0.1, right_shoulder_angle=-math.pi + 0.1,
        left_elbow_bend=3.0, right_elbow_bend=3.0,
        left_knee_bend=1.6, right_knee_bend=1.6,
        scoring_rules=(
            _shoulder_rules(-0.1, -math.pi + 0.1, 0.3)
            + _elbow_rules(3.0, 3.0, 0.3)
            + _hip_rules(math.pi / 2, math.pi / 2, 0.3)
            + _knee_rules(1.6, 1.6, 0.4)
        ),
    ),
    build_template(
        "深蹲·站起", "站直，双手叉腰", "健身", 2, "🦵", 6,
        left_shoulder_angle=math.pi / 3, right_shoulder_angle=math.pi - math.pi / 3,
        left_elbow_bend=2.5, right_elbow_bend=2.5,
        left_knee_bend=2.9, right_knee_bend=2.9,
        scoring_rules=(
            _shoulder_rules(math.pi / 3, math.pi - math.pi / 3, 0.3)
            + _elbow_rules(2.5, 2.5, 0.3)
            + _hip_rules(math.pi / 2, math.pi / 2, 0.3)
            + _knee_rules(2.9, 2.9, 0.3)
        ),
    ),
    # 开合跳：开（V+开腿）↔ 合（并拢）
    build_template(
        "开合跳·展开", "双臂上V展开，双脚跳开", "健身", 2, "⭐", 5,
        left_shoulder_angle=-math.pi / 3, right_shoulder_angle=-math.pi * 2 / 3,
        left_elbow_bend=3.0, right_elbow_bend=3.0,
        left_hip_angle=math.pi * 0.35, right_hip_angle=math.pi * 0.65,
        left_knee_bend=2.5, right_knee_bend=2.5,
        scoring_rules=(
            _shoulder_rules(-math.pi / 3, -math.pi * 2 / 3, 0.4)
            + _elbow_rules(3.0, 3.0, 0.3)
            + _hip_rules(math.pi * 0.35, math.pi * 0.65, 0.4)
            + _knee_rules(2.5, 2.5, 0.4)
        ),
    ),
    build_template(
        "开合跳·合拢", "双臂贴体，双脚并拢", "健身", 2, "⭐", 5,
        left_shoulder_angle=math.pi / 2, right_shoulder_angle=math.pi / 2,
        left_elbow_bend=3.0, right_elbow_bend=3.0,
        left_knee_bend=2.9, right_knee_bend=2.9,
        scoring_rules=(
            _shoulder_rules(math.pi / 2, math.pi / 2, 0.3)
            + _elbow_rules(3.0, 3.0, 0.3)
            + _hip_rules(math.pi / 2, math.pi / 2, 0.3)
            + _knee_rules(2.9, 2.9, 0.3)
        ),
    ),
]


def migrate_pose_templates_table():
    inspector = inspect(engine)
    columns = [c["name"] for c in inspector.get_columns("pose_templates")]
    with engine.connect() as conn:
        if "landmarks" not in columns:
            conn.execute(text("ALTER TABLE pose_templates ADD COLUMN landmarks JSON DEFAULT '[]'"))
        if "scoring_rules" not in columns:
            conn.execute(text("ALTER TABLE pose_templates ADD COLUMN scoring_rules JSON DEFAULT '[]'"))
        if "created_by" not in columns:
            conn.execute(text("ALTER TABLE pose_templates ADD COLUMN created_by INTEGER DEFAULT NULL"))
        if "is_public" not in columns:
            conn.execute(text("ALTER TABLE pose_templates ADD COLUMN is_public BOOLEAN DEFAULT 0 NOT NULL"))
        if "forked_from" not in columns:
            conn.execute(text("ALTER TABLE pose_templates ADD COLUMN forked_from INTEGER DEFAULT NULL"))
        conn.commit()
        # 系统预设（created_by IS NULL）默认公开到社区动作库
        conn.execute(text("UPDATE pose_templates SET is_public = 1 WHERE created_by IS NULL AND is_public = 0"))
        conn.commit()

        # 移除旧的 keypoints 字段（SQLite 不支持 DROP COLUMN，需重建表）
        if "keypoints" in columns:
            conn.execute(text("""
                CREATE TABLE pose_templates_new (
                    id INTEGER PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    description VARCHAR(500) DEFAULT '',
                    category VARCHAR(50) DEFAULT 'general',
                    difficulty INTEGER DEFAULT 1,
                    icon VARCHAR(50) DEFAULT '🧘',
                    landmarks JSON NOT NULL DEFAULT '[]',
                    scoring_rules JSON NOT NULL DEFAULT '[]',
                    duration INTEGER DEFAULT 10,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("""
                INSERT INTO pose_templates_new (id, name, description, category, difficulty, icon, landmarks, scoring_rules, duration, created_at)
                SELECT id, name, description, category, difficulty, icon, landmarks, scoring_rules, duration, created_at
                FROM pose_templates
            """))
            conn.execute(text("DROP TABLE pose_templates"))
            conn.execute(text("ALTER TABLE pose_templates_new RENAME TO pose_templates"))
            conn.commit()

    from ..database import SessionLocal
    db = SessionLocal()
    try:
        # 迁移1：为 landmarks 为空的旧记录补填数据
        old_records = db.query(PoseTemplate).filter(
            (PoseTemplate.landmarks == None) | (PoseTemplate.landmarks == '[]') | (PoseTemplate.landmarks == [])
        ).all()
        if old_records:
            for rec in old_records:
                matched = next((t for t in DEFAULT_TEMPLATES if t["name"] == rec.name), None)
                if matched:
                    rec.landmarks = matched["landmarks"]
                    rec.scoring_rules = matched["scoring_rules"]
                else:
                    default = build_template(
                        rec.name, rec.description or "", rec.category or "通用",
                        rec.difficulty or 1, rec.icon or "🧘", rec.duration or 5,
                        left_shoulder_angle=math.pi / 2, right_shoulder_angle=math.pi / 2,
                    )
                    rec.landmarks = default["landmarks"]
                    rec.scoring_rules = default["scoring_rules"]
                flag_modified(rec, "landmarks")
                flag_modified(rec, "scoring_rules")
            db.commit()

        # 迁移2：angle_dir 规则的 targetValue 从角度（number）转为向量（{x, y}）
        all_records = db.query(PoseTemplate).all()
        changed = False
        for rec in all_records:
            rules = rec.scoring_rules or []
            rules_changed = False
            for rule in rules:
                if rule.get("type") == "angle_dir" and isinstance(rule.get("targetValue"), (int, float)):
                    angle = rule["targetValue"]
                    rule["targetValue"] = {
                        "x": round(math.cos(angle), 4),
                        "y": round(math.sin(angle), 4),
                    }
                    # 同步调整容差：旧容差是角度（弧度），新容差是余弦差值
                    # 近似：tol弧度 ≈ 1 - cos(tol)（小角度时）
                    old_tol = rule.get("tolerance", 0.5)
                    rule["tolerance"] = round(1 - math.cos(old_tol), 4)
                    rules_changed = True
            if rules_changed:
                rec.scoring_rules = rules
                flag_modified(rec, "scoring_rules")
                changed = True
        if changed:
            db.commit()

        # 迁移3：为所有规则添加 modes 字段，确保每个动作在三种模式下都有至少一个规则
        all_records = db.query(PoseTemplate).all()
        changed = False

        MINIMAL_POINTS = {'LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_WRIST', 'RIGHT_WRIST'}
        UPPER_POINTS = MINIMAL_POINTS | {'LEFT_ELBOW', 'RIGHT_ELBOW'}
        FULL_POINTS = UPPER_POINTS | {'LEFT_HIP', 'RIGHT_HIP', 'LEFT_KNEE', 'RIGHT_KNEE', 'LEFT_ANKLE', 'RIGHT_ANKLE'}

        for rec in all_records:
            rules = rec.scoring_rules or []
            rules_changed = False

            for rule in rules:
                if "modes" not in rule:
                    rule_points = set(rule.get("points", []))

                    if rule_points.issubset(MINIMAL_POINTS):
                        rule["modes"] = ["minimal", "upper", "full"]
                    elif rule_points.issubset(UPPER_POINTS):
                        rule["modes"] = ["upper", "full"]
                    elif rule_points.issubset(FULL_POINTS):
                        rule["modes"] = ["full"]
                    else:
                        rule["modes"] = ["minimal", "upper", "full"]
                    rules_changed = True

            if rules_changed:
                rec.scoring_rules = rules
                flag_modified(rec, "scoring_rules")
                changed = True

            modes_covered = {"minimal": False, "upper": False, "full": False}
            for rule in rules:
                for mode in rule.get("modes", []):
                    if mode in modes_covered:
                        modes_covered[mode] = True

            for mode, covered in modes_covered.items():
                if not covered:
                    if mode == "minimal":
                        new_rule = _rule_angle_dir("LEFT_SHOULDER", "LEFT_WRIST", math.pi / 2, 0.3, weight=1.0, required=False)
                        new_rule["modes"] = ["minimal"]
                        rules.append(new_rule)
                    elif mode == "upper":
                        new_rule = _rule_angle_dir("LEFT_SHOULDER", "LEFT_WRIST", math.pi / 2, 0.3, weight=1.0, required=False)
                        new_rule["modes"] = ["upper"]
                        rules.append(new_rule)
                    elif mode == "full":
                        new_rule = _rule_angle_dir("LEFT_HIP", "LEFT_ANKLE", math.pi / 2, 0.3, weight=1.0, required=False)
                        new_rule["modes"] = ["full"]
                        rules.append(new_rule)
                    rules_changed = True

            if rules_changed:
                rec.scoring_rules = rules
                flag_modified(rec, "scoring_rules")
                changed = True

        if changed:
            db.commit()
    finally:
        db.close()


def init_default_templates():
    from ..database import SessionLocal
    db = SessionLocal()
    try:
        existing = {t.name: t for t in db.query(PoseTemplate).all()}
        for tpl in DEFAULT_TEMPLATES:
            if tpl["name"] in existing:
                rec = existing[tpl["name"]]
                rec.landmarks = tpl["landmarks"]
                rec.scoring_rules = tpl["scoring_rules"]
                rec.description = tpl["description"]
                rec.category = tpl["category"]
                rec.difficulty = tpl["difficulty"]
                rec.icon = tpl["icon"]
                rec.duration = tpl["duration"]
                rec.is_public = True  # 系统预设始终公开到社区动作库
                flag_modified(rec, "landmarks")
                flag_modified(rec, "scoring_rules")
            else:
                db.add(PoseTemplate(**tpl, is_public=True))  # 系统预设始终公开
        db.commit()
    finally:
        db.close()


@router.get("", response_model=List[PoseTemplateResponse])
def list_templates(
    category: Optional[str] = None,
    difficulty: Optional[int] = None,
    public: Optional[bool] = None,
    ids: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(PoseTemplate)
    if category:
        query = query.filter(PoseTemplate.category == category)
    if difficulty:
        query = query.filter(PoseTemplate.difficulty == difficulty)
    if public is not None:
        query = query.filter(PoseTemplate.is_public == public)
    if ids:
        # 逗号分隔的 id 列表，批量查询
        try:
            id_list = [int(x.strip()) for x in ids.split(",") if x.strip()]
        except ValueError:
            id_list = []
        if id_list:
            query = query.filter(PoseTemplate.id.in_(id_list))
    return query.order_by(PoseTemplate.id).all()


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    from sqlalchemy import func
    result = db.query(
        PoseTemplate.category,
        func.count(PoseTemplate.id).label("count")
    ).group_by(PoseTemplate.category).all()
    return [{"name": r[0], "count": r[1]} for r in result]


@router.get("/community/list", response_model=List[PoseTemplateResponse])
def list_community_templates(
    category: Optional[str] = None,
    keyword: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """社区动作库：仅返回已公开（is_public=true）的用户创建动作（created_by IS NOT NULL）
    返回结果附带 author_nickname（用户昵称），供前端展示作者信息。
    """
    from ..models.user import User
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    query = db.query(PoseTemplate).filter(
        PoseTemplate.is_public == True,
        PoseTemplate.created_by.isnot(None),
    )
    if category:
        query = query.filter(PoseTemplate.category == category)
    if keyword:
        query = query.filter(PoseTemplate.name.ilike(f"%{keyword}%"))
    records = query.order_by(PoseTemplate.created_at.desc()).offset(offset).limit(limit).all()
    if not records:
        return []
    # 批量查询作者昵称，避免 N+1
    author_ids = {r.created_by for r in records if r.created_by is not None}
    nickname_map: dict = {}
    if author_ids:
        users = db.query(User).filter(User.id.in_(list(author_ids))).all()
        nickname_map = {u.id: (u.nickname or f"用户{u.id}") for u in users}
    # 构造带 author_nickname 的响应字典列表
    result = []
    for r in records:
        item = PoseTemplateResponse.model_validate(r).model_dump()
        item["author_nickname"] = nickname_map.get(r.created_by, f"用户{r.created_by}")
        result.append(item)
    return result


@router.get("/community/count")
def count_community_templates(
    category: Optional[str] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """社区动作库总数，供前端分页"""
    query = db.query(PoseTemplate).filter(
        PoseTemplate.is_public == True,
        PoseTemplate.created_by.isnot(None),
    )
    if category:
        query = query.filter(PoseTemplate.category == category)
    if keyword:
        query = query.filter(PoseTemplate.name.ilike(f"%{keyword}%"))
    return {"total": query.count()}


@router.get("/{template_id}", response_model=PoseTemplateResponse)
def get_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(PoseTemplate).filter(PoseTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    return template


MAX_PRIVATE_POSES = 1000


@router.post("", response_model=PoseTemplateResponse)
def create_template(template: PoseTemplateCreate, user_id: Optional[int] = None, db: Session = Depends(get_db)):
    data = template.model_dump()
    if user_id:
        data["created_by"] = user_id
        # 配额检查：私有动作 ≤ 1000
        count = (
            db.query(PoseTemplate)
            .filter(
                PoseTemplate.created_by == user_id,
                PoseTemplate.is_public == False,
            )
            .count()
        )
        if count >= MAX_PRIVATE_POSES:
            raise HTTPException(
                status_code=403,
                detail=f"私有动作已达上限({MAX_PRIVATE_POSES}个)",
            )
    db_template = PoseTemplate(**data)
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template


def _check_template_permission(db_template, user_id: Optional[int], db: Session):
    """检查用户是否有权编辑/删除该模板：管理员无限制，普通用户只能操作自己创建的"""
    if not user_id:
        raise HTTPException(status_code=401, detail="需要登录")
    # 管理员无限制
    from ..models.user import User
    user = db.query(User).filter(User.id == user_id).first()
    if user and user.is_admin:
        return
    # 普通用户只能操作自己创建的
    if db_template.created_by != user_id:
        raise HTTPException(status_code=403, detail="无权操作该模板（系统预设模板仅管理员可编辑）")


@router.put("/{template_id}", response_model=PoseTemplateResponse)
def update_template(template_id: int, template: PoseTemplateCreate, user_id: Optional[int] = None, db: Session = Depends(get_db)):
    db_template = db.query(PoseTemplate).filter(PoseTemplate.id == template_id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="模板不存在")
    _check_template_permission(db_template, user_id, db)
    for key, value in template.model_dump().items():
        setattr(db_template, key, value)
    db.commit()
    db.refresh(db_template)
    return db_template


@router.delete("/{template_id}")
def delete_template(template_id: int, user_id: Optional[int] = None, db: Session = Depends(get_db)):
    db_template = db.query(PoseTemplate).filter(PoseTemplate.id == template_id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="模板不存在")
    _check_template_permission(db_template, user_id, db)
    # 引用检查：禁止删除被任何关卡（私有/社区）引用的动作，避免关卡数据损坏
    # pose_ids 为 JSON 数组，SQLite 下用 Python 层过滤最稳妥
    all_levels = db.query(CustomLevel).all()
    referencing = [c for c in all_levels if c.pose_ids and template_id in c.pose_ids]
    if referencing:
        names = "、".join(c.name for c in referencing[:5])
        more = f" 等 {len(referencing)} 个" if len(referencing) > 5 else ""
        raise HTTPException(
            status_code=409,
            detail=f"该动作被关卡「{names}」{more}引用，请先删除或调整引用关卡后再删除动作"
        )
    db.delete(db_template)
    db.commit()
    return {"status": "ok"}


class ForkPoseRequest(BaseModel):
    user_id: int


@router.post("/{template_id}/fork", response_model=PoseTemplateResponse)
def fork_template(template_id: int, req: ForkPoseRequest, db: Session = Depends(get_db)):
    """Fork 动作到私有（深拷贝 + forked_from 溯源）"""
    original = db.query(PoseTemplate).filter(PoseTemplate.id == template_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="动作不存在")

    # 配额检查
    count = (
        db.query(PoseTemplate)
        .filter(
            PoseTemplate.created_by == req.user_id,
            PoseTemplate.is_public == False,
        )
        .count()
    )
    if count >= MAX_PRIVATE_POSES:
        raise HTTPException(
            status_code=403,
            detail=f"私有动作已达上限({MAX_PRIVATE_POSES}个)",
        )

    new_pose = PoseTemplate(
        name=original.name,
        description=original.description,
        category=original.category,
        difficulty=original.difficulty,
        icon=original.icon,
        landmarks=original.landmarks,
        scoring_rules=original.scoring_rules,
        duration=original.duration,
        created_by=req.user_id,
        is_public=False,
        forked_from=original.id,
    )
    db.add(new_pose)
    db.commit()
    db.refresh(new_pose)
    return new_pose


@router.post("/{template_id}/publish")
def publish_template(template_id: int, req: ForkPoseRequest, db: Session = Depends(get_db)):
    """公开动作到市场"""
    record = db.query(PoseTemplate).filter(PoseTemplate.id == template_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="动作不存在")
    if record.created_by != req.user_id:
        raise HTTPException(status_code=403, detail="只能公开自己的动作")
    record.is_public = True
    db.commit()
    return {"detail": "已公开", "is_public": True}


@router.post("/{template_id}/unpublish")
def unpublish_template(template_id: int, req: ForkPoseRequest, db: Session = Depends(get_db)):
    """取消公开动作（软删除）"""
    record = db.query(PoseTemplate).filter(PoseTemplate.id == template_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="动作不存在")
    if record.created_by != req.user_id:
        raise HTTPException(status_code=403, detail="只能下架自己的动作")
    record.is_public = False
    db.commit()
    return {"detail": "已下架", "is_public": False}
