# DeepGames AI Inference Service

Python AI 推理服务，提供姿态检测和 LLM 对话能力。

## 环境变量

```bash
export OPENAI_API_KEY=your_api_key_here
```

## 运行

```bash
cd services/ai-inference
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

## API 端点

- `GET /health` - 健康检查
- `POST /api/pose/estimate` - 姿态检测
- `POST /api/llm/chat` - LLM 对话
