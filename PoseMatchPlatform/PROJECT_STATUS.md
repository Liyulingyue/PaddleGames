# PoseMatch 项目现状与待改进点

## 一、已完成功能总览

### 核心游玩
- ✅ 统一 PlayEngine 引擎：闯关 / 节拍 / 跟练 三模式配置化
- ✅ 闯关模式：score≥80 过关，排行榜按时长升序
- ✅ 节拍模式：倒计时结束切换，排行榜按分数降序
- ✅ 跟练模式：sourceDuration 驱动，支持骨骼视频/原视频切换
- ✅ 沉浸模式：右上角入口，自由匹配，分数入库

### 视频导入与课程管理
- ✅ 视频抽帧（动作抽取 4-12 帧 / 跟练抽取 1-30fps）
- ✅ 图片批量上传生成关卡
- ✅ 抽帧过程支持取消（AbortController）
- ✅ 前端骨骼视频生成（WebCodecs + webm-muxer，1-3秒完成）
- ✅ HTTPS 兼容（自签证书 + 安全上下文检测 + MediaRecorder fallback）
- ✅ 视频预览播放器（原视频 + 骨骼视频并排，同步播放）
- ✅ 动作预览可折叠
- ✅ 用户课程 CRUD（每模式5套上限，后端 multipart 上传）
- ✅ SinglePlayer 混合展示系统课程+自定义课程，快捷删除按钮

### 多人游戏
- ✅ 房间创建（房主选模式和关卡）
- ✅ 大厅房间列表（自动刷新 5s）
- ✅ WebSocket 实时消息（game_start/next_round/player_ready/player_joined/game_end）
- ✅ 房主分发关卡（房间存储 templates，全员使用同一套）

### 其他
- ✅ 排行榜：5 种模式筛选，challenge 按时长升序，其余按分降序
- ✅ 登录/注册/管理员
- ✅ 后端骨骼视频异步生成（imageio-ffmpeg，保存课程时后台线程生成）

---

## 二、待改进点

### A. 多人游戏体验（优先级：高）

| 问题 | 现状 | 建议 |
|------|------|------|
| WebSocket 断线重连 | 无重连机制，断线后房间状态丢失 | 加指数退避重连（3次/5s/10s/30s），重连后 fetchRoom 恢复 |
| 玩家掉线处理 | 无 | 后端检测 ws 断开后标记玩家 disconnected，通知其他玩家；允许重连恢复 |
| 准备状态同步 | player_ready 后 fetchRoom 刷新，但有延迟 | WebSocket 推送 player_ready 消息后直接更新本地 state，不依赖 fetchRoom |
| 倒计时同步 | 房主发 game_start，各客户端各自倒计时，可能有 ~1s 漂移 | game_start 消息带 server_start_time，客户端按 server_start_time 对齐 |
| 游戏中的实时排名 | 各玩家只看自己分数 | WebSocket 广播 score_update，前端实时排名面板 |
| 房间内关卡信息展示 | 有展示（名称/模式/帧数），但无骨架预览 | 加一个小的 PoseFigure 预览 |

### B. 前端展示打磨（优先级：中）

| 问题 | 现状 | 建议 |
|------|------|------|
| MyCourses 顶部按钮栏 | 缺少统一的「刷新 \| 搜索 \| 从视频生成 \| 新增课程」布局 | 参照 ActionManagement 页面统一 |
| 首页侧边栏导航 | 未确认是否存在 scroll highlighting + smooth scrolling | 检查 Home.tsx 是否有 #hero/#modes/#requirements/#guide 侧边栏 |
| 跟练模式视频加载 | 从「我的课程」进入时，骨骼视频可能还没生成完 | 加 loading 态，或轮询 bone_video_path 直到有值 |
| PlayEngine 视频切换 UX | 骨骼/原视频切换按钮不够醒目 | 改为 tab 式切换，更直观 |

### C. 跟练模式体验（优先级：中）

| 问题 | 现状 | 建议 |
|------|------|------|
| 后端骨骼视频异步生成延迟 | 保存课程后后台生成，期间 bone_video_path=null | 方案1：前端保存后轮询等待（1s间隔，最多30s）；方案2：前端生成后直接上传，后端不再重复生成 |
| canvas 插值兜底帧率低 | 无视频时走 canvas 3fps，体验差 | 提升到 10fps（FOLLOW_FPS 改为 10），或用 requestAnimationFrame 60fps 渲染 |

### D. 工程质量（优先级：低）

| 问题 | 现状 | 建议 |
|------|------|------|
| WebSocket URL 硬编码 | 用 window.location.host 拼接 | 考虑环境变量配置 |
| 错误边界 | 无 React Error Boundary | 加全局错误边界，避免白屏 |
| 视频文件清理 | 删除课程时删视频，但孤立文件可能残留 | 加定期清理脚本或启动时检查 |

---

## 三、多人游戏详细设计建议

### 状态管理

```
房间状态机：
  waiting → countdown → playing → round_end → (next round) countdown / game_end

每个状态需要同步的信息：
  waiting:    玩家列表、准备状态
  countdown:  倒计时秒数（服务端时间对齐）
  playing:    当前动作索引、各玩家分数
  round_end:  本轮结果、排名
  game_end:   最终排名、总分
```

### WebSocket 消息协议

```
客户端 → 服务端：
  player_ready      { user_id, ready: bool }
  pose_update       { user_id, score, match_percent }  // 游戏中实时分数
  round_complete    { user_id, score, duration }        // 本轮完成

服务端 → 客户端：
  player_joined     { user_id, nickname }
  player_left       { user_id, reason: "disconnect"/"manual" }
  player_ready      { user_id, ready: bool }
  game_start        { server_time, templates, game_mode }
  game_countdown    { seconds_left }                    // 每1s推送
  score_update      { user_id, score, match_percent }   // 广播其他玩家分数
  round_result      { scores: [{user_id, score, rank}] }
  game_end          { final_scores, winner_id }
```

### 断线重连

```
1. WebSocket onclose 触发
2. 前端进入 reconnecting 状态，显示「连接中断，正在重连...」
3. 指数退避：3s → 5s → 10s → 30s（最多4次）
4. 重连成功 → fetchRoom 恢复状态 + 发送 rejoin 消息
5. 后端处理 rejoin：检查房间是否还存在、玩家是否在列表中
6. 超过重连上限 → 显示「连接已断开」，提供「返回大厅」按钮
```

---

## 四、建议执行顺序

1. **多人游戏状态管理**：完善 WebSocket 消息协议 + 断线重连
2. **MyCourses 顶部按钮栏**：统一布局
3. **跟练模式后端视频轮询**：保存后等待 bone_video_path
4. **首页侧边栏检查**：确认 scroll highlighting 正常
5. **工程收尾**：Error Boundary、视频清理
