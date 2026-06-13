from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
from openai import AsyncOpenAI
from sse_starlette.sse import EventSourceResponse
import json

router = APIRouter()

openai_client: Optional[AsyncOpenAI] = None


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = "gpt-3.5-turbo"
    temperature: Optional[float] = 0.7
    stream: Optional[bool] = True


class ChatResponse(BaseModel):
    content: str
    model: str


def get_openai_client() -> AsyncOpenAI:
    global openai_client
    if openai_client is None:
        api_key = os.getenv("OPENAI_API_KEY", "")
        if not api_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")
        openai_client = AsyncOpenAI(api_key=api_key)
    return openai_client


@router.post("/chat")
async def chat(request: ChatRequest):
    if request.stream:
        return EventSourceResponse(stream_chat(request))

    client = get_openai_client()
    response = await client.chat.completions.create(
        model=request.model,
        messages=[m.model_dump() for m in request.messages],
        temperature=request.temperature,
        stream=False,
    )

    return ChatResponse(
        content=response.choices[0].message.content,
        model=request.model
    )


async def stream_chat(request: ChatRequest):
    client = get_openai_client()
    stream = await client.chat.completions.create(
        model=request.model,
        messages=[m.model_dump() for m in request.messages],
        temperature=request.temperature,
        stream=True,
    )

    async for chunk in stream:
        if chunk.choices[0].delta.content:
            yield {
                "event": "message",
                "data": json.dumps({
                    "content": chunk.choices[0].delta.content,
                    "done": False
                })
            }

    yield {
        "event": "message",
        "data": json.dumps({"content": "", "done": True})
    }


@router.post("/chat/completions")
async def chat_completions(request: Dict[str, Any]):
    client = get_openai_client()

    try:
        response = await client.chat.completions.create(**request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
