import { useState, useEffect } from 'react'
import { fetchLevelConfigs, getCachedLevels, getCachedRhythmLevels, type LevelConfig } from '@/utils/levelConfigService'

export function useLevelConfigs() {
  const [levels, setLevels] = useState<LevelConfig[]>(getCachedLevels())
  const [rhythmLevels, setRhythmLevels] = useState<LevelConfig[]>(getCachedRhythmLevels())
  const [loading, setLoading] = useState(false)
  // source: 'remote' = 后端数据（含本地非重复项）, 'local' = 仅本地兜底
  const [source, setSource] = useState<'remote' | 'local'>('local')

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetchLevelConfigs(true).then(({ levels: lvls, rhythmLevels: crses }) => {
      if (cancelled) return
      setLevels(lvls)
      setRhythmLevels(crses)
      // 后端请求成功后，数据中存在非 local- 前缀的项即为 remote
      const hasRemote = lvls.some(l => typeof l.id === 'number' || !String(l.id).startsWith('local-'))
        || crses.some(c => typeof c.id === 'number' || !String(c.id).startsWith('local-'))
      setSource(hasRemote ? 'remote' : 'local')
      setLoading(false)
    }).catch(() => {
      if (cancelled) return
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  return { levels, rhythmLevels, loading, source }
}
