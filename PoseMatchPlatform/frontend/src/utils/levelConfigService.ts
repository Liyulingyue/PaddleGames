import { LEVEL_CONFIGS, RHYTHM_LEVEL_CONFIGS, type LevelConfig } from './levelConfigs'

export type { LevelConfig }

let cachedLevels: LevelConfig[] | null = null
let cachedRhythmLevels: LevelConfig[] | null = null
let fetchPromise: Promise<{ levels: LevelConfig[]; rhythmLevels: LevelConfig[] }> | null = null

/** 后端 snake_case → 前端 camelCase（闯关） */
function normalizeLevel(raw: any): LevelConfig {
  return {
    id: raw.id,
    name: raw.name,
    desc: raw.desc || raw.description || '',
    poseIds: raw.pose_ids || raw.poseIds || [],
    timeLimit: raw.time_limit ?? raw.timeLimit ?? 45,
    minMatch: raw.min_match ?? raw.minMatch ?? 60,
    isFinal: raw.is_final ?? raw.isFinal ?? false,
    tag: raw.tag ?? '',
  }
}

/** 后端 snake_case → 前端 camelCase（节拍） */
function normalizeRhythmLevel(raw: any): LevelConfig {
  return {
    id: raw.id,
    name: raw.name,
    desc: raw.desc || raw.description || '',
    poseIds: raw.pose_ids || raw.poseIds || [],
    tag: raw.tag || '',
    icon: raw.icon || '🧘',
    isAll: raw.is_all ?? raw.isAll ?? false,
  }
}

/**
 * 去除本地数据的 [F] 前缀，用于与后端数据按名称匹配去重
 */
function stripLocalPrefix(name: string): string {
  return name.replace(/^\[F\]\s*/, '').trim()
}

/** 构造带 local- 前缀的本地关卡数据（避免与后端 ID 冲突） */
function buildLocalLevels(): LevelConfig[] {
  return LEVEL_CONFIGS.map(l => ({
    ...l,
    id: `local-${l.id}`,
    poseIds: l.poseIds.map(pid => `local-${pid}`),
  }))
}

function buildLocalRhythmLevels(): LevelConfig[] {
  return RHYTHM_LEVEL_CONFIGS.map(c => ({
    ...c,
    id: `local-${c.id}`,
    poseIds: c.poseIds.map(pid => `local-${pid}`),
  }))
}

/**
 * 获取关卡和课程：后端优先 + 本地兜底，重复项只显示后端
 * - 后端请求成功：后端数据 + 本地非重复数据（按名称匹配去重）
 * - 后端请求失败：仅展示本地数据
 */
export async function fetchLevelConfigs(force = false): Promise<{ levels: LevelConfig[]; rhythmLevels: LevelConfig[] }> {
  if (cachedLevels && cachedRhythmLevels && !force) {
    return { levels: cachedLevels, rhythmLevels: cachedRhythmLevels }
  }

  if (fetchPromise && !force) {
    return fetchPromise
  }

  const localLevels = buildLocalLevels()
  const localRhythmLevels = buildLocalRhythmLevels()

  fetchPromise = (async () => {
    try {
      const [levelsRes, rhythmRes] = await Promise.all([
        fetch('/api/custom-levels?is_preset=true&target_mode=challenge&limit=100'),
        fetch('/api/custom-levels?is_preset=true&target_mode=rhythm&limit=100'),
      ])

      let mergedLevels = localLevels
      let mergedRhythmLevels = localRhythmLevels

      if (levelsRes.ok) {
        const data = await levelsRes.json()
        const arr: any[] = Array.isArray(data) ? data : (data.items ?? [])
        if (arr.length > 0) {
          const remoteLevels = arr.map(normalizeLevel)
          const remoteNames = new Set(remoteLevels.map(l => l.name))
          const localOnly = localLevels.filter(l => !remoteNames.has(stripLocalPrefix(l.name)))
          mergedLevels = [...remoteLevels, ...localOnly]
        }
      }

      if (rhythmRes.ok) {
        const data = await rhythmRes.json()
        const arr: any[] = Array.isArray(data) ? data : (data.items ?? [])
        if (arr.length > 0) {
          const remoteRhythmLevels = arr.map(normalizeRhythmLevel)
          const remoteNames = new Set(remoteRhythmLevels.map(c => c.name))
          const localOnly = localRhythmLevels.filter(c => !remoteNames.has(stripLocalPrefix(c.name)))
          mergedRhythmLevels = [...remoteRhythmLevels, ...localOnly]
        }
      }

      cachedLevels = mergedLevels
      cachedRhythmLevels = mergedRhythmLevels
      return { levels: mergedLevels, rhythmLevels: mergedRhythmLevels }
    } catch (e) {
      console.warn('[levelConfigs] 仅展示本地数据（后端获取失败）:', e)
      cachedLevels = localLevels
      cachedRhythmLevels = localRhythmLevels
      return { levels: localLevels, rhythmLevels: localRhythmLevels }
    }
  })()

  return fetchPromise
}

export function getCachedLevels(): LevelConfig[] {
  return cachedLevels || buildLocalLevels()
}

export function getCachedRhythmLevels(): LevelConfig[] {
  return cachedRhythmLevels || buildLocalRhythmLevels()
}
