import { DEFAULT_TEMPLATES, type PoseTemplate } from './poseMatcher'

export type { PoseTemplate }

let cachedTemplates: PoseTemplate[] | null = null
let fetchPromise: Promise<PoseTemplate[]> | null = null

/**
 * 去除本地数据的 [F] 前缀，用于与后端数据按名称匹配去重
 */
function stripLocalPrefix(name: string): string {
  return name.replace(/^\[F\]\s*/, '').trim()
}

/**
 * 获取姿态模板：后端优先 + 本地兜底，重复项只显示后端
 * - 后端请求成功：后端数据 + 本地非重复数据（按名称匹配去重）
 * - 后端请求失败：仅展示本地数据
 */
export async function fetchPoseTemplates(force = false): Promise<PoseTemplate[]> {
  if (cachedTemplates && !force) {
    return cachedTemplates
  }

  if (fetchPromise && !force) {
    return fetchPromise
  }

  fetchPromise = (async () => {
    // 本地数据加 local- 前缀，避免与后端 ID 冲突
    const localTemplates = DEFAULT_TEMPLATES.map(t => ({ ...t, id: `local-${t.id}` }))
    try {
      const res = await fetch('/api/pose-templates')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        const remoteTemplates = data as PoseTemplate[]
        // 后端数据名称集合（用于去重本地数据）
        const remoteNames = new Set(remoteTemplates.map(t => t.name))
        // 本地数据按名称匹配去重：去除 [F] 前缀后比较
        const localOnly = localTemplates.filter(t => !remoteNames.has(stripLocalPrefix(t.name)))
        cachedTemplates = [...remoteTemplates, ...localOnly]
        return cachedTemplates
      }
      throw new Error('Empty templates')
    } catch (e) {
      console.warn('[poseTemplates] 仅展示本地模板（后端获取失败）:', e)
      cachedTemplates = localTemplates
      return cachedTemplates
    }
  })()

  return fetchPromise
}

export function getCachedTemplates(): PoseTemplate[] {
  return cachedTemplates || DEFAULT_TEMPLATES.map(t => ({ ...t, id: `local-${t.id}` }))
}

export function findTemplateById(id: number | string): PoseTemplate | undefined {
  const templates = getCachedTemplates()
  return templates.find((t) => t.id === id)
}

export function getTemplatesByCategory(category: string): PoseTemplate[] {
  const templates = getCachedTemplates()
  return category === '全部'
    ? templates
    : templates.filter((t) => t.category === category)
}

export function getAllCategories(): string[] {
  const templates = getCachedTemplates()
  const cats = new Set<string>()
  templates.forEach((t) => cats.add(t.category))
  return Array.from(cats)
}

/**
 * 按 id 列表批量查询 PoseTemplate（用于两级存储的关卡：pose_ids → templates）
 * 优先从缓存取，未命中的再批量请求后端
 */
export async function fetchTemplatesByIds(ids: number[]): Promise<PoseTemplate[]> {
  if (!ids.length) return []
  const cached = getCachedTemplates()
  const result: PoseTemplate[] = []
  const missing: number[] = []
  for (const id of ids) {
    const found = cached.find((t) => Number(t.id) === Number(id))
    if (found) result.push(found)
    else missing.push(Number(id))
  }
  if (missing.length) {
    try {
      const res = await fetch(`/api/pose-templates?ids=${missing.join(',')}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          for (const t of data as PoseTemplate[]) {
            if (!result.find((r) => Number(r.id) === Number(t.id))) result.push(t)
          }
        }
      }
    } catch (e) {
      console.warn('[poseTemplates] 按 id 批量查询失败:', e)
    }
  }
  // 按传入 ids 顺序排列
  return ids
    .map((id) => result.find((t) => Number(t.id) === Number(id)))
    .filter(Boolean) as PoseTemplate[]
}
