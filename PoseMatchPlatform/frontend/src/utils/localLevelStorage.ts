import { openDB, type IDBPDatabase } from 'idb'
import type { PoseTemplate, TemplateLandmark, ScoringRule } from './poseMatcher'

const DB_NAME = 'posematch-local'
const DB_VERSION = 3
const LEVEL_STORE = 'levels'
const POSE_STORE = 'poses'

// 本地动作（闯关/节拍两级存储的独立动作单元）
export interface LocalPose {
  id: string // UUID
  name: string
  description: string
  category: string
  difficulty: number
  icon: string
  landmarks: TemplateLandmark[]
  scoring_rules: ScoringRule[]
  duration: number
  source_name?: string // 溯源：原始动作名称（Fork 来源）
  created_at: number
}

export interface LocalLevel {
  id: string // UUID
  name: string
  description: string
  target_mode: 'challenge' | 'rhythm' | 'follow'
  input_mode: 'video' | 'image'
  // 闯关/节拍：引用 LocalPose.id 列表（两级存储）；跟练：空数组
  pose_ids: string[]
  // 跟练：内嵌 PoseTemplate[]（含 timestamp/sourceDuration/thumbnail 等视频专属字段）；闯关/节拍：空数组
  templates: PoseTemplate[]
  frame_count: number
  fps: number | null
  total_duration: number
  source_duration_sec: number | null
  source_resolution: string | null
  bone_video_blob?: Blob // 骨骼视频存本地
  original_video_blob?: Blob // 原视频存本地
  created_at: number // timestamp
  synced: boolean // 是否已同步到服务器
}

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // v3: 创建新的 levels store（替代旧的 courses）
        if (!db.objectStoreNames.contains(LEVEL_STORE)) {
          db.createObjectStore(LEVEL_STORE, { keyPath: 'id' })
        }
        // poses store（v2 引入）
        if (!db.objectStoreNames.contains(POSE_STORE)) {
          db.createObjectStore(POSE_STORE, { keyPath: 'id' })
        }
        // 旧 courses store 不主动删除，由 migrateLocalLevelsStore 迁移数据后保留
      },
    })
  }
  return dbPromise
}

// ============ 本地动作（poses store）CRUD ============

function toLocalPose(t: PoseTemplate): LocalPose {
  return {
    id: crypto.randomUUID(),
    name: t.name || '未命名动作',
    description: t.description || '',
    category: t.category || 'general',
    difficulty: t.difficulty ?? 1,
    icon: t.icon || '🧘',
    landmarks: (t.landmarks || []).map((l) => ({ ...l })),
    scoring_rules: (t.scoring_rules || []).map((r) => ({ ...r })),
    duration: t.duration ?? 5,
    source_name: t.name || '未命名动作',
    created_at: Date.now(),
  }
}

function localPoseToTemplate(p: LocalPose): PoseTemplate {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    difficulty: p.difficulty,
    icon: p.icon,
    landmarks: p.landmarks,
    scoring_rules: p.scoring_rules,
    duration: p.duration,
  }
}

/** 保存单个 PoseTemplate 为本地动作，返回生成的 LocalPose */
export async function saveLocalPose(t: PoseTemplate): Promise<LocalPose> {
  const db = await getDB()
  const pose = toLocalPose(t)
  await db.put(POSE_STORE, pose)
  return pose
}

/** 批量保存 PoseTemplate[] 为本地动作，返回 id 列表（闯关/节拍两级存储用） */
export async function saveLocalPoses(templates: PoseTemplate[]): Promise<string[]> {
  console.log('[LocalSave.saveLocalPoses] 开始, 数量:', templates.length)
  const db = await getDB()
  console.log('[LocalSave.saveLocalPoses] DB ready, objectStoreNames:', Array.from(db.objectStoreNames))
  const poses = templates.map((t) => toLocalPose(t))
  try {
    const tx = db.transaction(POSE_STORE, 'readwrite')
    await Promise.all(poses.map((p) => tx.store.put(p)))
    await tx.done
    console.log('[LocalSave.saveLocalPoses] 写入成功, ids:', poses.map((p) => p.id))
    return poses.map((p) => p.id)
  } catch (e: any) {
    console.error('[LocalSave.saveLocalPoses] 写入失败:', {
      message: e?.message,
      name: e?.name,
      code: e?.code,
      poseCount: poses.length,
    })
    throw e
  }
}

export async function getLocalPose(id: string): Promise<LocalPose | undefined> {
  const db = await getDB()
  return db.get(POSE_STORE, id)
}

export async function getLocalPoses(): Promise<LocalPose[]> {
  const db = await getDB()
  return db.getAll(POSE_STORE)
}

export async function updateLocalPose(pose: LocalPose): Promise<void> {
  const db = await getDB()
  await db.put(POSE_STORE, pose)
}

export async function deleteLocalPose(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(POSE_STORE, id)
}

/** 按 pose_ids 解析出 PoseTemplate[]（闯关/节拍两级存储解析） */
export async function resolveLocalPoseIds(poseIds: string[]): Promise<PoseTemplate[]> {
  if (!poseIds?.length) return []
  const db = await getDB()
  const poses = await Promise.all(poseIds.map((id) => db.get(POSE_STORE, id)))
  return poses.filter(Boolean).map((p) => localPoseToTemplate(p as LocalPose))
}

/** 解析关卡的 templates：闯关/节拍按 pose_ids 读取，跟练直接返回内嵌 templates */
export async function resolveLocalLevelTemplates(level: LocalLevel): Promise<PoseTemplate[]> {
  if (level.target_mode === 'follow') {
    return level.templates ?? []
  }
  // 闯关/节拍：优先用 pose_ids 解析；若无 pose_ids，回退到 templates（兼容旧数据未迁移情况）
  if (level.pose_ids?.length) {
    return resolveLocalPoseIds(level.pose_ids)
  }
  return level.templates ?? []
}

// ============ 本地关卡（levels store）CRUD ============

export async function saveLocalLevel(level: Omit<LocalLevel, 'id' | 'created_at' | 'synced'>): Promise<LocalLevel> {
  console.log('[LocalSave.saveLocalLevel] 开始, target_mode:', level.target_mode,
    ', pose_ids:', level.pose_ids?.length,
    ', templates:', level.templates?.length,
    ', bone_blob:', level.bone_video_blob?.size ?? 0,
    ', original_blob:', level.original_video_blob?.size ?? 0)
  const db = await getDB()
  console.log('[LocalSave.saveLocalLevel] DB ready, objectStoreNames:', Array.from(db.objectStoreNames))
  const record: LocalLevel = {
    ...level,
    pose_ids: level.pose_ids ?? [],
    templates: level.templates ?? [],
    id: crypto.randomUUID(),
    created_at: Date.now(),
    synced: false,
  }
  console.log('[LocalSave.saveLocalLevel] 准备 put, id:', record.id, ', name:', record.name)
  try {
    await db.put(LEVEL_STORE, record)
    console.log('[LocalSave.saveLocalLevel] 写入成功, id:', record.id)
    return record
  } catch (e: any) {
    console.error('[LocalSave.saveLocalLevel] 写入失败:', {
      message: e?.message,
      name: e?.name,
      code: e?.code,
      recordId: record.id,
      recordSizeEstimate: JSON.stringify(record).length + (record.bone_video_blob?.size ?? 0) + (record.original_video_blob?.size ?? 0),
    })
    throw e
  }
}

export async function getLocalLevels(targetMode?: string): Promise<LocalLevel[]> {
  const db = await getDB()
  const all = await db.getAll(LEVEL_STORE)
  if (targetMode) {
    return all.filter((c: LocalLevel) => c.target_mode === targetMode)
  }
  return all
}

export async function getLocalLevel(id: string): Promise<LocalLevel | undefined> {
  const db = await getDB()
  return db.get(LEVEL_STORE, id)
}

export async function deleteLocalLevel(id: string): Promise<void> {
  const db = await getDB()
  const level = await db.get(LEVEL_STORE, id)
  if (!level) return
  await db.delete(LEVEL_STORE, id)
  // 闯关/节拍两级存储：清理只被该关卡引用的孤立本地动作，避免存储泄漏
  if ((level.target_mode === 'challenge' || level.target_mode === 'rhythm') && level.pose_ids?.length) {
    const allLevels: LocalLevel[] = await db.getAll(LEVEL_STORE)
    const stillReferenced = new Set<string>()
    for (const c of allLevels) {
      if (c.id === id) continue
      for (const pid of (c.pose_ids || [])) stillReferenced.add(pid)
    }
    const orphans = level.pose_ids.filter((pid: string) => !stillReferenced.has(pid))
    for (const pid of orphans) {
      await db.delete(POSE_STORE, pid)
    }
  }
}

export async function markLocalLevelSynced(id: string): Promise<void> {
  const db = await getDB()
  const level = await db.get(LEVEL_STORE, id)
  if (level) {
    level.synced = true
    await db.put(LEVEL_STORE, level)
  }
}

/** 更新本地关卡元数据（name/description），不触碰动作数据 */
export async function renameLocalLevel(id: string, name?: string, description?: string): Promise<void> {
  const db = await getDB()
  const level = await db.get(LEVEL_STORE, id)
  if (!level) return
  if (name !== undefined) {
    const trimmed = name.trim()
    if (trimmed) level.name = trimmed.slice(0, 100)
  }
  if (description !== undefined) {
    level.description = description.slice(0, 500)
  }
  await db.put(LEVEL_STORE, level)
}

/** 更新本地关卡的动作引用（动作编排），仅闯关/节拍模式 */
export async function updateLocalLevelPoseIds(id: string, pose_ids: string[]): Promise<void> {
  const db = await getDB()
  const level = await db.get(LEVEL_STORE, id)
  if (!level) return
  level.pose_ids = pose_ids
  await db.put(LEVEL_STORE, level)
}

export async function getUnsyncedLevels(): Promise<LocalLevel[]> {
  const all = await getLocalLevels()
  return all.filter((c) => !c.synced)
}

export function getLocalLevelBoneVideoUrl(level: LocalLevel): string | undefined {
  if (level.bone_video_blob) {
    return URL.createObjectURL(level.bone_video_blob)
  }
  return undefined
}

export function getLocalLevelOriginalVideoUrl(level: LocalLevel): string | undefined {
  if (level.original_video_blob) {
    return URL.createObjectURL(level.original_video_blob)
  }
  return undefined
}

// ============ 数据迁移：旧版本地关卡（单级内嵌）转为两级存储 ============

const MIGRATION_KEY = 'local_poses_migrated_v2'
const STORE_MIGRATION_KEY = 'local_store_courses_to_levels_migrated'

/**
 * 迁移旧 courses store 数据到新 levels store。
 * 旧版本（DB v2）使用 'courses' 作为 store 名，v3 改为 'levels'。
 * 幂等执行，迁移完成后删除旧 store。应用启动时调用一次。
 */
export async function migrateLocalLevelsStore(): Promise<void> {
  try {
    if (localStorage.getItem(STORE_MIGRATION_KEY) === '1') return
  } catch { /* ignore */ }
  try {
    const db = await getDB()
    // 检查旧 store 是否存在
    if (!db.objectStoreNames.contains('courses')) {
      try { localStorage.setItem(STORE_MIGRATION_KEY, '1') } catch { /* ignore */ }
      return
    }
    // 读取旧数据
    const oldData = await db.getAll('courses')
    if (oldData.length > 0) {
      const tx = db.transaction(LEVEL_STORE, 'readwrite')
      await Promise.all(oldData.map((item: any) => tx.store.put(item)))
      await tx.done
    }
    // 删除旧 store（需要升级版本，这里用 deleteObjectStore 在新事务中不可行，
    // 改为保留旧 store 不删，数据已复制到新 store，不影响功能）
    // 标记迁移完成
    try { localStorage.setItem(STORE_MIGRATION_KEY, '1') } catch { /* ignore */ }
  } catch { /* ignore */ }
}

/**
 * 迁移旧版本地关卡：闯关/节拍关卡原本内嵌 templates，需拆分到 poses store 并转为 pose_ids 引用。
 * 幂等执行，已迁移则跳过。应用启动时调用一次。
 */
export async function migrateLocalLevelsToTwoLevel(): Promise<void> {
  await migrateLocalLevelsStore() // 先迁移 store 名
  try {
    if (localStorage.getItem(MIGRATION_KEY) === '1') return
  } catch { /* ignore */ }
  const db = await getDB()
  const levels: LocalLevel[] = await db.getAll(LEVEL_STORE)
  // 收集需要迁移的关卡（闯关/节拍且无 pose_ids 但有内嵌 templates）
  const toMigrate = levels.filter((c) =>
    (c.target_mode === 'challenge' || c.target_mode === 'rhythm')
    && (!c.pose_ids || c.pose_ids.length === 0)
    && c.templates?.length
  )
  console.log('[Migrate] 待迁移关卡数:', toMigrate.length, '/', levels.length)
  if (toMigrate.length === 0) {
    try { localStorage.setItem(MIGRATION_KEY, '1') } catch { /* ignore */ }
    return
  }
  // 逐个迁移：每个关卡独立完成「动作保存 + 关卡更新」，
  // 避免单个长事务跨越 await saveLocalPoses 后变成 inactive 导致 TransactionInactiveError
  let migrated = 0
  for (const c of toMigrate) {
    try {
      const poseIds = await saveLocalPoses(c.templates)
      c.pose_ids = poseIds
      c.templates = [] // 清空内嵌副本，改为引用
      await db.put(LEVEL_STORE, c) // 独立事务写入关卡
      migrated++
    } catch (e: any) {
      console.error('[Migrate] 关卡迁移失败:', c.id, c.name, e?.message || e)
    }
  }
  console.log('[Migrate] 迁移完成, 成功:', migrated, '/', toMigrate.length)
  try {
    localStorage.setItem(MIGRATION_KEY, '1')
  } catch { /* ignore */ }
}
