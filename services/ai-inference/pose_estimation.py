from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import numpy as np

router = APIRouter()


class Keypoint(BaseModel):
    x: float
    y: float
    confidence: float


class PoseEstimationRequest(BaseModel):
    image: str


class PoseEstimationResponse(BaseModel):
    keypoints: List[Keypoint]
    angles: dict
    direction: Optional[str] = None


def calculate_angle(p1: List[float], p2: List[float], p3: List[float]) -> float:
    v1 = np.array([p1[0] - p2[0], p1[1] - p2[1]])
    v2 = np.array([p3[0] - p2[0], p3[1] - p2[1]])

    cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
    angle = np.arccos(np.clip(cos_angle, -1.0, 1.0))
    return np.degrees(angle)


def get_direction(angles: dict) -> str:
    left_arm = angles.get("left_arm", 180)
    right_arm = angles.get("right_arm", 180)

    diff = left_arm - right_arm

    if abs(diff) < 20:
        return "forward"
    elif diff > 20:
        return "left"
    else:
        return "right"


@router.post("/estimate", response_model=PoseEstimationResponse)
async def estimate_pose(request: PoseEstimationRequest):
    raise HTTPException(status_code=501, detail="Pose estimation not implemented yet")


@router.get("/models")
async def list_models():
    return {
        "models": [
            {"id": "pp-tinypose", "name": "PP-TinyPose", "status": "available"},
            {"id": "moveNet", "name": "MoveNet", "status": "coming_soon"}
        ]
    }
