import { useMemo } from 'react'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import PlayEngine, { type PlayMode } from '@/components/PlayEngine'
import GameBackground from '@/components/GameBackground'
import { usePoseTemplates } from '@/hooks/usePoseTemplates'
import { useLevelConfigs } from '@/hooks/useLevelConfigs'
import { resolveLevelPoses, resolveRhythmPoses } from '@/utils/levelConfigs'
import type { PoseTemplate } from '@/utils/poseMatcher'

interface CustomState {
  templates?: PoseTemplate[]
  name?: string
  mode?: PlayMode
  videoUrl?: string
  boneVideoUrl?: string
}

/**
 * 统一游玩入口：解析 URL 参数或 location.state，加载 templates 后渲染 PlayEngine
 *
 * 路由：
 * - /play?mode=challenge&level=xxx        闯关模式
 * - /play?mode=rhythm&level=xxx&duration=8 节拍模式
 * - /play?mode=follow&level=xxx          跟练模式（内置关卡）
 * - /play + location.state { templates, name, mode } 视频跟练（VideoImport 跳转）
 */
export default function Play() {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { templates, loading } = usePoseTemplates()
  const { levels, rhythmLevels, loading: levelsLoading } = useLevelConfigs()

  const customState = location.state as CustomState | null

  // location.state 的 mode 优先（VideoImport 跳转用），其次 URL 参数
  const mode: PlayMode = customState?.mode || (params.get('mode') as PlayMode) || 'challenge'
  const levelId = params.get('level')
  const rhythmLevelId = params.get('level')
  const duration = parseInt(params.get('duration') || '8')

  const { playTemplates, levelName, videoUrl, boneVideoUrl, timeLimit } = useMemo(() => {
    // 优先用 location.state 传来的自定义 templates（视频跟练）
    if (customState?.templates?.length) {
      return {
        playTemplates: customState.templates,
        levelName: customState.name || '自定义关卡',
        videoUrl: customState.videoUrl,
        boneVideoUrl: customState.boneVideoUrl,
        timeLimit: undefined,
      }
    }
    if (loading || levelsLoading || templates.length === 0) return { playTemplates: [], levelName: '', videoUrl: undefined, boneVideoUrl: undefined, timeLimit: undefined }

    if (mode === 'challenge' && levelId) {
      const level = levels.find((l) => String(l.id) === String(levelId))
      if (level) {
        const poseIds = resolveLevelPoses(level, templates)
        const poses = poseIds
          .map((id) => templates.find((t) => String(t.id) === String(id)))
          .filter(Boolean) as PoseTemplate[]
        return { playTemplates: poses, levelName: level.name, videoUrl: undefined, boneVideoUrl: undefined, timeLimit: level.timeLimit }
      }
    }
    if ((mode === 'rhythm' || mode === 'follow') && rhythmLevelId) {
      const rhythmLevel = rhythmLevels.find((c) => String(c.id) === String(rhythmLevelId))
      if (rhythmLevel) {
        const poseIds = resolveRhythmPoses(rhythmLevel, templates)
        const poses = poseIds
          .map((id) => templates.find((t) => String(t.id) === String(id)))
          .filter(Boolean) as PoseTemplate[]
        return { playTemplates: poses, levelName: rhythmLevel.name, videoUrl: undefined, boneVideoUrl: undefined, timeLimit: undefined }
      }
    }
    return { playTemplates: [], levelName: '', videoUrl: undefined, boneVideoUrl: undefined, timeLimit: undefined }
  }, [customState, mode, levelId, rhythmLevelId, loading, templates, levels, rhythmLevels])

  if (loading) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <GameBackground />
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (playTemplates.length === 0) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <GameBackground />
        <div className="text-center">
          <p className="text-white/60 mb-4">未找到可用的动作数据</p>
          <button
            onClick={() => navigate('/single')}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl"
          >
            返回选择
          </button>
        </div>
      </div>
    )
  }

  return (
    <PlayEngine
      mode={mode}
      templates={playTemplates}
      levelName={levelName}
      perPoseSec={duration}
      timeLimit={timeLimit}
      videoUrl={videoUrl}
      boneVideoUrl={boneVideoUrl}
      onExit={() => navigate('/single')}
    />
  )
}
