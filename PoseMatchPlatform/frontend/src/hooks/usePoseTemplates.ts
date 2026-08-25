import { useState, useEffect } from 'react'
import { fetchPoseTemplates, getCachedTemplates, type PoseTemplate } from '@/utils/poseTemplateService'

export function usePoseTemplates() {
  const [templates, setTemplates] = useState<PoseTemplate[]>(getCachedTemplates())
  const [loading, setLoading] = useState(false)
  // source: 'remote' = 后端数据（含本地非重复项）, 'local' = 仅本地兜底
  const [source, setSource] = useState<'remote' | 'local'>('local')

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetchPoseTemplates(true).then((data) => {
      if (cancelled) return
      setTemplates(data)
      // 后端请求成功后，数据中存在非 local- 前缀的项即为 remote
      setSource(data.some(t => typeof t.id === 'number' || !String(t.id).startsWith('local-')) ? 'remote' : 'local')
      setLoading(false)
    }).catch(() => {
      if (cancelled) return
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  const findById = (id: number | string) => templates.find((t) => t.id === id)

  const byIds = (ids: (number | string)[]) =>
    ids.map((id) => findById(id)).filter(Boolean) as PoseTemplate[]

  const byCategory = (category: string) =>
    category === '全部'
      ? templates
      : templates.filter((t) => t.category === category)

  const categories = Array.from(new Set(templates.map((t) => t.category)))

  return {
    templates,
    loading,
    source,
    findById,
    byIds,
    byCategory,
    categories,
  }
}
