# PoseMatch - AI 体感姿态匹配互动健身平台

> 🎯 用零门槛的网页体感方案，让健身变得像游戏一样有趣！

## 项目简介

PoseMatch 是一个基于 MediaPipe 的 AI 体感姿态匹配互动健身平台。用户只需打开浏览器、授权摄像头，即可通过实时姿态检测与标准动作进行比对，获得即时反馈和打分。

### 核心特性

- 🎮 **游戏化健身**：将枯燥的健身动作转化为闯关、连击、排行榜等游戏机制
- 📷 **零硬件门槛**：普通电脑摄像头即可体验，无需额外设备
- 🔒 **隐私保护**：所有视频在本地浏览器处理，服务器不存储任何视频流
- 👥 **多人对战**：支持异步群战模式，生成挑战链接与好友 PK
- 🌐 **跨代际适配**：青少年、上班族、老年人都能轻松上手

## 技术栈

### 前端
- **框架**：React 18 + TypeScript
- **构建工具**：Vite
- **样式**：Tailwind CSS + shadcn/ui
- **状态管理**：Zustand
- **路由**：React Router
- **AI 能力**：MediaPipe Pose（浏览器端本地运行）

### 后端
- **框架**：FastAPI (Python)
- **数据库**：SQLite
- **实时通信**：WebSocket
- **ORM**：SQLAlchemy

## 项目结构

```
PoseMatchPlatform/
├── frontend/              # 前端项目
│   ├── src/
│   │   ├── components/    # 通用组件
│   │   ├── hooks/         # 自定义 Hooks（姿态检测等）
│   │   ├── pages/         # 页面组件
│   │   ├── store/         # 状态管理
│   │   ├── types/         # TypeScript 类型定义
│   │   └── utils/         # 工具函数
│   ├── package.json
│   └── vite.config.ts
├── backend/               # 后端项目
│   ├── app/
│   │   ├── models/        # 数据模型
│   │   ├── routers/       # API 路由
│   │   ├── schemas/       # Pydantic 模式
│   │   └── database.py    # 数据库配置
│   ├── main.py            # 入口文件
│   └── requirements.txt
├── references/            # 参考资料
└── README.md
```

## 快速开始

### 前置要求
- Node.js >= 18
- Python >= 3.10
- 摄像头设备

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 `http://localhost:5173`

### 后端启动

```bash
cd backend
pip install -r requirements.txt
python main.py
```

后端默认运行在 `http://localhost:8000`

API 文档：`http://localhost:8000/docs`

## 功能模块

### 单人闯关模式
- 多种动作模板：八段锦、健身操、瑜伽等
- 实时姿态匹配度打分
- 连击系统与关卡进度
- 30秒/60秒/无限模式

### 多人异步群战
- 创建房间，生成挑战链接
- 好友加入，各自完成挑战
- 实时排行榜更新
- 多轮次 PK 机制

### 动作模板库
- 预设多种经典动作
- 支持自定义动作录制
- 难度分级系统

## 隐私说明

- 所有摄像头画面仅在本地浏览器通过 MediaPipe 实时处理
- 服务器不接收、不存储任何视频流
- 仅上传匿名化的骨骼关键点评分数据

## 开发说明

### 前端开发
- 主要 AI 能力（姿态检测）运行在前端
- 后端仅用于联网对战、排行榜、动作模板存储

### 后端开发
- RESTful API + WebSocket
- SQLite 数据库（可切换为 PostgreSQL/MySQL）

## License

MIT
