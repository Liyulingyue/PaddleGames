# 架构重构计划：Fork 模型 + 统一表 + 溯源

> 日期：2026-08-03
> 目标：消除数据冗余，引入 Fork/收藏分离机制，支持完整溯源

---

## 一、设计原则

1. **统一表 + 字段区分**：同一实体（动作/关卡/跟练关卡）用一张表，通过 `owner_id` + `is_public` 区分系统预设/用户私有/用户公开
2. **Fork = 深拷贝 + 溯源**：Fork 时自动复制所有引用动作，记录 `forked_from` 原始 ID
3. **收藏 = 轻引用**：仅记 `user_id + target_type + target_id`，不复制数据，不占配额
4. **严格配额**：Fork/新建前检查 `现有数量 + 本次数量 ≤ 上限`，超限直接拒绝
5. **闯关/节拍 vs 跟练分表**：数据结构不同（pose_ids 引用 vs templates 内嵌 + 视频），分表更干净

---

## 二、新表结构

### 2.1 pose_templates（重构）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | |
| name | varchar(100) | |
| description | varchar(500) | |
| category | varchar(50) | |
| difficulty | int | |
| icon | varchar(50) | |
| landmarks | JSON | |
| scoring_rules | JSON | |
| duration | int | |
| created_by | int NULL | null=系统预设, user_id=用户创建 |
| is_public | bool | 系统预设/用户公开=True, 用户私有=False |
| **forked_from** | int NULL | **新增**：Fork 来源的 pose_template.id |
| created_at | datetime | |

配额：私有动作 ≤1000/用户，公开不限

### 2.2 custom_courses（新建，替代 user_courses + community_courses 的 challenge/rhythm 部分）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | |
| owner_id | int | 所有者 user_id |
| name | varchar(100) | |
| description | varchar(500) | |
| target_mode | varchar(20) | challenge / rhythm |
| input_mode | varchar(20) | video / image |
| pose_ids | JSON | 引用 PoseTemplate.id 列表 |
| frame_count | int | |
| total_duration | int | 秒 |
| source_duration_sec | float NULL | |
| source_resolution | varchar(20) NULL | |
| play_count | int | 播放次数（仅公开关卡有意义） |
| favorite_count | int | 收藏次数 |
| is_public | bool | False=私有, True=公开到市场 |
| **forked_from** | int NULL | **新增**：Fork 来源的 custom_course.id |
| published_at | datetime NULL | 公开时间 |
| created_at | datetime | |

配额：私有关卡 ≤5/类/用户，公开不限

### 2.3 follow_courses（新建，替代 user_courses + community_courses 的 follow 部分）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | |
| owner_id | int | |
| name | varchar(100) | |
| description | varchar(500) | |
| input_mode | varchar(20) | video / image |
| templates | JSON | 内嵌 PoseTemplate[]（含 timestamp/sourceDuration/thumbnail） |
| frame_count | int | |
| fps | int NULL | |
| total_duration | int | |
| source_duration_sec | float NULL | |
| source_resolution | varchar(20) NULL | |
| video_path | varchar(255) NULL | 视频文件相对路径 |
| bone_video_path | varchar(255) NULL | 骨骼视频路径 |
| play_count | int | |
| favorite_count | int | |
| is_public | bool | |
| **forked_from** | int NULL | **新增**：Fork 来源的 follow_course.id |
| published_at | datetime NULL | |
| created_at | datetime | |

配额：私有跟练 ≤5/用户，公开不限

### 2.4 favorites（新建，替代 community_favorites）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int PK | |
| user_id | int | |
| target_type | varchar(20) | 'pose' / 'course' / 'follow_course' |
| target_id | int | 对应表的 id |
| created_at | datetime | |
| UNIQUE(user_id, target_type, target_id) | | |

---

## 三、API 设计

### 3.1 动作 API（/api/pose-templates，增强）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 列表（支持 public/owner_id/category/keyword/ids 筛选） |
| GET | /{id} | 详情 |
| POST | / | 创建（私有，占配额） |
| PUT | /{id} | 编辑（仅 owner 或 admin） |
| DELETE | /{id} | 删除（仅 owner 或 admin） |
| **POST** | **/{id}/fork** | **新增**：Fork 动作到私有（深拷贝 + forked_from） |
| **POST** | **/{id}/publish** | **新增**：公开动作（is_public=True） |
| **POST** | **/{id}/unpublish** | **新增**：取消公开（is_public=False，软删除） |

### 3.2 关卡 API（/api/courses，新建）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 列表（支持 target_mode/owner_id/is_public/keyword 筛选，分页） |
| GET | /{id} | 详情（含 is_favorited） |
| POST | / | 创建（私有，占配额，闯关/节拍） |
| PUT | /{id} | 编辑 |
| DELETE | /{id} | 删除 |
| **POST** | **/{id}/fork** | **新增**：Fork 关卡 + 自动 Fork 所有引用动作 |
| **POST** | **/{id}/play** | 记录播放 |
| **POST** | **/{id}/publish** | 公开 |
| **POST** | **/{id}/unpublish** | 下架 |

### 3.3 跟练关卡 API（/api/follow-courses，新建）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 列表（同上） |
| GET | /{id} | 详情 |
| POST | / | 创建（含视频上传，占配额） |
| PUT | /{id} | 编辑 |
| DELETE | /{id} | 删除（含视频文件清理） |
| **POST** | **/{id}/fork** | **新增**：Fork 跟练关卡（深拷贝 templates） |
| **POST** | **/{id}/play** | 记录播放 |
| **POST** | **/{id}/publish** | 公开 |
| **POST** | **/{id}/unpublish** | 下架 |

### 3.4 收藏 API（/api/favorites，新建）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 列表（支持 target_type 筛选） |
| POST | / | 收藏（target_type + target_id） |
| DELETE | / | 取消收藏 |
| GET | /check | 检查是否已收藏 |

### 3.5 旧 API 兼容

旧 API（/api/user-courses, /api/community/*）全部删除，前端统一迁移到新 API。

---

## 四、Fork 实现逻辑

### 4.1 Fork 动作

```python
def fork_pose(pose_id, user_id, db):
    original = db.query(PoseTemplate).get(pose_id)
    # 检查动作配额
    count = db.query(PoseTemplate).filter(
        PoseTemplate.created_by == user_id,
        PoseTemplate.is_public == False
    ).count()
    if count >= 1000:
        raise HTTPException(403, "私有动作已达上限(1000)")
    # 深拷贝
    new_pose = PoseTemplate(
        name=original.name, description=original.description,
        category=original.category, difficulty=original.difficulty,
        icon=original.icon, landmarks=original.landmarks,
        scoring_rules=original.scoring_rules, duration=original.duration,
        created_by=user_id, is_public=False,
        forked_from=original.id
    )
    db.add(new_pose)
    db.commit()
    return new_pose
```

### 4.2 Fork 闯关/节拍关卡

```python
def fork_course(course_id, user_id, db):
    original = db.query(CustomCourse).get(course_id)
    # 检查关卡配额
    course_count = db.query(CustomCourse).filter(
        CustomCourse.owner_id == user_id,
        CustomCourse.is_public == False,
        CustomCourse.target_mode == original.target_mode
    ).count()
    if course_count >= 5:
        raise HTTPException(403, "私有关卡已达上限(5)")
    # 检查动作配额
    pose_ids = original.pose_ids or []
    pose_count = db.query(PoseTemplate).filter(
        PoseTemplate.created_by == user_id,
        PoseTemplate.is_public == False
    ).count()
    if pose_count + len(pose_ids) > 1000:
        raise HTTPException(403, f"Fork后将超过私有动作上限(1000)，当前{pose_count}+本次{len(pose_ids)}")
    # 自动 Fork 所有引用动作
    new_pose_ids = []
    for pid in pose_ids:
        orig_pose = db.query(PoseTemplate).get(pid)
        if orig_pose:
            new_pose = PoseTemplate(
                name=orig_pose.name, ..., created_by=user_id,
                is_public=False, forked_from=orig_pose.id
            )
            db.add(new_pose)
            db.flush()  # 获取新 ID
            new_pose_ids.append(new_pose.id)
    # 创建关卡副本
    new_course = CustomCourse(
        owner_id=user_id, name=original.name, ...,
        pose_ids=new_pose_ids, is_public=False,
        forked_from=original.id
    )
    db.add(new_course)
    db.commit()
    return new_course
```

### 4.3 Fork 跟练关卡

```python
def fork_follow_course(course_id, user_id, db):
    original = db.query(FollowCourse).get(course_id)
    # 检查配额
    count = db.query(FollowCourse).filter(
        FollowCourse.owner_id == user_id,
        FollowCourse.is_public == False
    ).count()
    if count >= 5:
        raise HTTPException(403, "私有跟练关卡已达上限(5)")
    # 深拷贝（templates 内嵌，直接复制）
    new_course = FollowCourse(
        owner_id=user_id, name=original.name, ...,
        templates=original.templates,  # 深拷贝 JSON
        video_path=original.video_path,  # 视频文件共享路径
        bone_video_path=original.bone_video_path,
        is_public=False, forked_from=original.id
    )
    db.add(new_course)
    db.commit()
    return new_course
```

---

## 五、文件变更清单

### 5.1 后端新增文件

| 文件 | 说明 |
|------|------|
| `backend/app/models/custom_course.py` | CustomCourse 模型 |
| `backend/app/models/follow_course.py` | FollowCourse 模型 |
| `backend/app/models/favorite.py` | Favorite 模型 |
| `backend/app/schemas/custom_course.py` | CustomCourse Schema |
| `backend/app/schemas/follow_course.py` | FollowCourse Schema |
| `backend/app/schemas/favorite.py` | Favorite Schema |
| `backend/app/routers/course.py` | 关卡路由（challenge/rhythm） |
| `backend/app/routers/follow_course.py` | 跟练关卡路由 |
| `backend/app/routers/favorite.py` | 收藏路由 |

### 5.2 后端修改文件

| 文件 | 变更 |
|------|------|
| `backend/app/models/pose_template.py` | 新增 forked_from 字段 |
| `backend/app/models/__init__.py` | 注册新模型，移除旧模型 |
| `backend/app/routers/__init__.py` | 注册新路由，移除旧路由 |
| `backend/app/routers/pose_template.py` | 新增 fork/publish/unpublish 接口；配额检查 |
| `backend/app/schemas/pose_template.py` | 新增 forked_from 字段 |
| `backend/app/main.py` | 更新模型导入、路由注册、迁移调用 |

### 5.3 后端删除文件

| 文件 | 说明 |
|------|------|
| `backend/app/models/user_course.py` | 被 custom_course + follow_course 替代 |
| `backend/app/models/community_course.py` | 被 custom_course + follow_course + favorite 替代 |
| `backend/app/routers/user_course.py` | 被 course + follow_course 路由替代 |
| `backend/app/routers/community.py` | 被 course + follow_course + favorite 路由替代 |
| `backend/app/schemas/user_course.py` | 被 custom_course + follow_course schema 替代 |

### 5.4 前端修改文件

| 文件 | 变更 |
|------|------|
| `frontend/src/utils/localCourseStorage.ts` | LocalPose 新增 source_name 字段（溯源） |
| `frontend/src/utils/poseTemplateService.ts` | 适配新 API |
| `frontend/src/pages/Marketplace.tsx` | 重构为统一市场，支持动作/关卡/跟练三个 tab，Fork 按钮 |
| `frontend/src/pages/MyCourses.tsx` | 适配新 API（/api/courses + /api/follow-courses） |
| `frontend/src/pages/MyFavorites.tsx` | 适配统一收藏 API（/api/favorites） |
| `frontend/src/components/MainMenu.tsx` | 市场入口文案更新 |
| `frontend/src/App.tsx` | 路由更新（如需要） |

---

## 六、实施顺序

1. **后端模型层**：新建 3 个模型文件 + 重构 pose_template 模型
2. **后端 Schema 层**：新建 3 个 schema 文件 + 更新 pose_template schema
3. **后端路由层**：新建 3 个路由文件 + 增强 pose_template 路由
4. **后端入口**：更新 models/__init__.py, routers/__init__.py, main.py
5. **前端工具层**：更新 localCourseStorage.ts, poseTemplateService.ts
6. **前端页面层**：重构 Marketplace, MyCourses, MyFavorites
7. **前端组件层**：更新 MainMenu
8. **清理**：删除旧文件

---

## 七、完成状态（2026-08-03）

### 后端 ✅ 全部完成

| 任务 | 状态 | 说明 |
|------|------|------|
| CustomCourse 模型 | ✅ | 含 owner_id, is_public, forked_from, 配额字段 |
| FollowCourse 模型 | ✅ | 含内嵌 templates, video_path, forked_from |
| Favorite 模型 | ✅ | 统一收藏表（user_id + target_type + target_id） |
| PoseTemplate 重构 | ✅ | 新增 forked_from, is_public, created_by 字段 |
| Course 路由 | ✅ | CRUD + fork + publish/unpublish + play + 配额检查 |
| FollowCourse 路由 | ✅ | CRUD + fork + publish/unpublish + play + 配额检查 |
| Favorite 路由 | ✅ | list + create + delete + check |
| PoseTemplate 路由增强 | ✅ | fork + publish/unpublish + 配额检查 |
| models/__init__.py | ✅ | 注册新模型，移除旧 user_course |
| routers/__init__.py | ✅ | 注册新路由，移除旧 user_course/community |
| main.py | ✅ | 更新导入、路由注册、迁移调用 |
| 旧文件清理 | ✅ | 删除 user_course.py（模型/路由/Schema）+ __pycache__ |

### 前端 ✅ 全部完成

| 任务 | 状态 | 说明 |
|------|------|------|
| Marketplace.tsx | ✅ | 统一市场（动作/闯关/节拍/跟练 tab），Fork + 收藏 |
| MyCourses.tsx | ✅ | "我的关卡"，适配 /api/courses + /api/follow-courses |
| MyFavorites.tsx | ✅ | 适配统一收藏 API（/api/favorites） |
| SinglePlayer.tsx | ✅ | 替换 user-courses + community API，"关卡市场" tab |
| MultiPlayer.tsx | ✅ | 替换 user-courses 为双 API（courses + follow-courses） |
| ImmersiveMode.tsx | ✅ | 替换 user-courses 为 follow-courses API |
| VideoImport.tsx | ✅ | 闯关/节拍→/api/courses(JSON)，跟练→/api/follow-courses(FormData) |
| AdminPoses.tsx | ✅ | 无需修改（/api/pose-templates/community/list 仍存在） |
| MainMenu.tsx | ✅ | "关卡市场"入口 |
| UserMenu.tsx | ✅ | "我的关卡"菜单项 |
| 全局文案统一 | ✅ | "课程"→"关卡"，"社区"→"市场" |

### 关键设计实现

- **严格配额**：私有关卡 ≤5/类/用户，私有动作 ≤1000/用户，Fork 前检查 `现有+本次 ≤ 上限`
- **溯源**：所有表新增 `forked_from` 字段，Fork 时记录源 ID
- **Fork = 深拷贝**：自动复制所有引用动作，创建独立副本
- **收藏 = 轻引用**：仅记 user_id + target_type + target_id，不复制数据
- **软删除**：下架设 is_public=false，不删除记录，已收藏用户仍可访问
