# DeepGames

基于 AI 的深度学习游戏平台，支持体感游戏和 RL 对战。

## 项目结构

```
DeepGames/
├── packages/
│   ├── core/           # 核心库
│   │   ├── game-engine/   # 游戏引擎
│   │   ├── protocol/      # 通信协议
│   │   └── utils/         # 工具函数
│   └── gateway/        # Rust API 网关
├── services/
│   └── ai-inference/   # Python AI 推理服务
└── web/                # React 前端
```

## 快速开始

### 前端

```bash
cd web
pnpm install
pnpm dev
```

### Rust 网关

```bash
cargo build --release
cargo run -p gateway
```

### Python AI 服务

```bash
cd services/ai-inference
pip install -r requirements.txt
uvicorn main:app --port 7081
```

## 技术栈

| 组件 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite |
| 后端核心 | Axum (Rust) |
| AI 推理 | Python + FastAPI |
| 实时通信 | WebSocket |
