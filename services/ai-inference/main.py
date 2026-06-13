from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from pose_estimation import router as pose_router
from llm_chat import router as llm_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AI Inference Service starting...")
    yield
    logger.info("AI Inference Service shutting down...")


app = FastAPI(
    title="DeepGames AI Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pose_router, prefix="/api/pose", tags=["Pose Estimation"])
app.include_router(llm_router, prefix="/api/llm", tags=["LLM Chat"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "deepgames-ai"}


@app.get("/")
async def root():
    return {
        "service": "DeepGames AI Service",
        "version": "0.1.0",
        "endpoints": {
            "pose": "/api/pose",
            "llm": "/api/llm"
        }
    }
