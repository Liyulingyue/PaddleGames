"""
骨骼视频生成工具：
- 输入：关键帧 templates（含 landmarks 和 timestamp）
- 输出：30fps 骨骼动画 mp4（黑色背景 + 绿色骨骼）
- 使用 imageio-ffmpeg（pip 安装自带 ffmpeg 二进制，无需系统安装 ffmpeg）
"""
from __future__ import annotations

import os
import uuid
from typing import List, Dict, Any

import numpy as np
from PIL import Image, ImageDraw
import imageio_ffmpeg

VIDEO_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "videos")
os.makedirs(VIDEO_DIR, exist_ok=True)

FPS = 30
WIDTH = 640
HEIGHT = 480
BG_COLOR = (0, 0, 0)
BONE_COLOR = (0, 255, 136)
JOINT_COLOR = (255, 255, 255)
JOINT_RADIUS = 4
BONE_WIDTH = 3

# BlazePose 骨骼连接（与前端 PosePairs 保持一致）
POSE_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 7),  # 左臂
    (0, 4), (4, 5), (5, 6), (6, 8),  # 右臂
    (9, 10),  # 嘴角
    (11, 12),  # 肩
    (11, 13), (13, 15), (15, 17), (17, 19), (19, 21), (15, 21),  # 左臂 + 手
    (12, 14), (14, 16), (16, 18), (18, 20), (20, 22), (16, 22),  # 右臂 + 手
    (11, 23), (12, 24), (23, 24),  # 躯干
    (23, 25), (25, 27), (27, 29), (29, 31), (27, 31),  # 左腿
    (24, 26), (26, 28), (28, 30), (30, 32), (28, 32),  # 右腿
]


def _normalize_landmarks(landmarks: List[Dict[str, float]], w: int, h: int) -> List[tuple]:
    """
    将归一化 landmarks（0~1，肩中心0.5，肩距0.24）映射到画布坐标。
    返回 (x, y, visibility) 列表。
    """
    # 肩中心映射到画布中心
    scale_x = w * 0.9
    scale_y = h * 0.9
    offset_x = w * 0.5
    offset_y = h * 0.45

    result = []
    for pt in landmarks:
        x = (pt["x"] - 0.5) * scale_x + offset_x
        y = (pt["y"] - 0.5) * scale_y + offset_y
        v = pt.get("visibility", 1.0)
        result.append((x, y, v))
    return result


def _draw_frame(landmarks: List[Dict[str, float]]) -> np.ndarray:
    """渲染单帧骨骼图，返回 numpy 数组 (H, W, 3) uint8。"""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    points = _normalize_landmarks(landmarks, WIDTH, HEIGHT)

    # 先画骨骼线
    for a, b in POSE_CONNECTIONS:
        if a >= len(points) or b >= len(points):
            continue
        x1, y1, v1 = points[a]
        x2, y2, v2 = points[b]
        if v1 < 0.1 or v2 < 0.1:
            continue
        draw.line([(x1, y1), (x2, y2)], fill=BONE_COLOR, width=BONE_WIDTH)

    # 再画关节点
    for x, y, v in points:
        if v < 0.1:
            continue
        r = JOINT_RADIUS
        draw.ellipse([(x - r, y - r), (x + r, y + r)], fill=JOINT_COLOR)

    return np.array(img)


def _interp_landmarks(a: List[Dict[str, float]], b: List[Dict[str, float]], t: float) -> List[Dict[str, float]]:
    """线性插值两组 landmarks。"""
    result = []
    for i in range(len(a)):
        pa = a[i]
        pb = b[i]
        result.append({
            "x": pa["x"] + (pb["x"] - pa["x"]) * t,
            "y": pa["y"] + (pb["y"] - pa["y"]) * t,
            "visibility": pa.get("visibility", 1.0) + (pb.get("visibility", 1.0) - pa.get("visibility", 1.0)) * t,
        })
    return result


def generate_bone_video(templates: List[Dict[str, Any]], output_path: str | None = None) -> str:
    """
    根据关键帧生成 30fps 骨骼动画 mp4。

    Args:
        templates: 关键帧列表，每个元素含 landmarks 和 timestamp（秒，可选）。
        output_path: 输出文件路径（相对 VIDEO_DIR 的文件名），不传则自动生成。

    Returns:
        输出文件相对路径（即文件名）。
    """
    if not templates:
        raise ValueError("templates 不能为空")

    # 计算总时长：如果有 timestamp 用最后一个，否则按每帧 1s 估算
    has_timestamps = all(t.get("timestamp") is not None for t in templates)
    if has_timestamps:
        total_duration = templates[-1]["timestamp"] - templates[0]["timestamp"]
    else:
        total_duration = len(templates) * 1.0  # 默认每帧 1s

    if total_duration <= 0:
        total_duration = len(templates) * 1.0

    total_frames = max(1, int(total_duration * FPS))

    if output_path is None:
        output_path = f"bone_{uuid.uuid4().hex}.mp4"

    full_path = os.path.join(VIDEO_DIR, output_path)

    # 获取 ffmpeg 路径
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

    # 启动 ffmpeg 子进程（通过 stdin 喂 rawvideo）
    import subprocess
    cmd = [
        ffmpeg_exe,
        "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{WIDTH}x{HEIGHT}",
        "-pix_fmt", "rgb24",
        "-r", str(FPS),
        "-i", "-",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "fast",
        "-crf", "23",
        full_path,
    ]

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    try:
        for fi in range(total_frames):
            t_sec = fi / FPS  # 当前时间点（相对于起始点）

            # 定位在时间轴上的位置
            if has_timestamps:
                start_ts = templates[0]["timestamp"]
                abs_t = start_ts + t_sec
                # 找到当前在哪两个关键帧之间
                idx = 0
                for i in range(len(templates) - 1):
                    if templates[i]["timestamp"] <= abs_t < templates[i + 1]["timestamp"]:
                        idx = i
                        break
                else:
                    idx = len(templates) - 2

                idx = max(0, min(idx, len(templates) - 2))
                ta = templates[idx]["timestamp"]
                tb = templates[idx + 1]["timestamp"]
                if tb > ta:
                    interp_t = (abs_t - ta) / (tb - ta)
                else:
                    interp_t = 0.0
                lm = _interp_landmarks(templates[idx]["landmarks"], templates[idx + 1]["landmarks"], interp_t)
            else:
                # 无 timestamp，均匀分布
                total_t = total_frames - 1 if total_frames > 1 else 1
                progress = fi / total_t
                pos = progress * (len(templates) - 1)
                idx = int(pos)
                frac = pos - idx
                if idx >= len(templates) - 1:
                    idx = len(templates) - 2
                    frac = 1.0
                lm = _interp_landmarks(templates[idx]["landmarks"], templates[idx + 1]["landmarks"], frac)

            frame = _draw_frame(lm)
            proc.stdin.write(frame.tobytes())

        proc.stdin.close()
        proc.wait()
        if proc.returncode != 0:
            raise RuntimeError(f"ffmpeg 生成视频失败，返回码 {proc.returncode}")

        return output_path
    except Exception:
        proc.kill()
        proc.wait()
        # 清理可能的不完整文件
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
            except Exception:
                pass
        raise
