import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Upload, Trash2, Play, Clock, Film, AlertCircle, Loader2, Gamepad2, Clapperboard, Users, HardDrive, Search, ChevronLeft, ChevronRight, X, Store, CheckCircle2, Cloud, Pencil, Globe } from 'lucide-react'
import FloatingNav from '@/components/FloatingNav'
import GameBackground from '@/components/GameBackground'
import PoseFigure from '@/components/PoseFigure'
import { useUserStore } from '@/store/userStore'
import type { PoseTemplate } from '@/utils/poseMatcher'
import { getLocalLevels, deleteLocalLevel, getLocalLevelBoneVideoUrl, getLocalLevelOriginalVideoUrl, resolveLocalPoseIds, migrateLocalLevelsToTwoLevel, renameLocalLevel, type LocalLevel } from '@/utils/localLevelStorage'
import { fetchTemplatesByIds } from '@/utils/poseTemplateService'
import { cn } from '@/lib/utils'

interface UserLevel {
  id: number
  owner_id: number  // 替代 user_id
  name: string
  description: string
  target_mode: 'challenge' | 'rhythm'
  pose_ids?: number[] | null
  templates: PoseTemplate[]
  frame_count?: number
  total_duration: number
  is_public: boolean
  forked_from?: number | null
  created_at: string
}

interface FollowLevel {
  id: number
  owner_id: number
  name: string
  description: string
  input_mode: string
  templates: PoseTemplate[]
  fps: number | null
  frame_count?: number
  total_duration: number
  video_path?: string | null
  bone_video_path?: string | null
  is_public: boolean
  forked_from?: number | null
  created_at: string
}

type ServerLevel = UserLevel | FollowLevel
type LevelCardData = UserLevel | FollowLevel | LocalLevel
type TabMode = 'challenge' | 'rhythm' | 'follow'

const TAB_CONFIG: Record<TabMode, {
  label: string
  icon: typeof Gamepad2
  desc: string
}> = {
  challenge: {
    label: '闯关关卡',
    icon: Gamepad2,
    desc: '达标即过，比拼速度',
  },
  rhythm: {
    label: '节拍关卡',
    icon: Clapperboard,
    desc: '固定节奏，比拼得分',
  },
  follow: {
    label: '跟练关卡',
    icon: Users,
    desc: '按视频原节奏推进',
  },
}

const MAX_PER_TYPE = 5

export default function MyLevels() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, isLoggedIn } = useUserStore()
  // 闯关/节拍关卡（来自 /api/custom-levels）
  const [challengeRhythmLevels, setChallengeRhythmLevels] = useState<UserLevel[]>([])
  // 跟练关卡（来自 /api/follow-levels）
  const [followLevels, setFollowLevels] = useState<FollowLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [publishingId, setPublishingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  // 默认 tab 优先取 URL ?mode= 参数，便于从 VideoImport 保存后跳转定位；无参数时默认闯关
  const [activeTab, setActiveTab] = useState<TabMode>(
    ((): TabMode => {
      const m = searchParams.get('mode')
      return m === 'challenge' || m === 'rhythm' || m === 'follow' ? m : 'challenge'
    })()
  )
  // 本地关卡
  const [localLevels, setLocalLevels] = useState<LocalLevel[]>([])
  const [deletingLocalId, setDeletingLocalId] = useState<string | null>(null)
  const [publishingLocalId, setPublishingLocalId] = useState<string | null>(null)
  // 编辑改名弹窗
  const [editingLevel, setEditingLevel] = useState<{ id: number | string; type: 'server' | 'local'; name: string; description: string } | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  // 动作预览
  const [previewPoses, setPreviewPoses] = useState<{ name: string; poses: PoseTemplate[] } | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)

  const loadLevels = useCallback(async () => {
    if (!isLoggedIn || !user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      // ============ 闯关/节拍关卡 ============
      // 列表接口不返回 pose_ids，需逐个拉取详情（含 pose_ids）后解析 templates
      const crRes = await fetch(`/api/custom-levels?owner_id=${user.id}&limit=24`)
      if (!crRes.ok) throw new Error('加载失败')
      const crData = await crRes.json()
      const crItems = (crData.items || []) as any[]
      const crResolved: UserLevel[] = await Promise.all(
        crItems.map(async (item): Promise<UserLevel> => {
          let poseIds: number[] = []
          try {
            const dres = await fetch(`/api/custom-levels/${item.id}?user_id=${user.id}`)
            if (dres.ok) {
              const d = await dres.json()
              poseIds = Array.isArray(d.pose_ids) ? d.pose_ids : []
            }
          } catch { /* 详情拉取失败时降级为空动作 */ }
          const tpls = poseIds.length ? await fetchTemplatesByIds(poseIds) : []
          return {
            id: item.id,
            owner_id: item.owner_id,
            name: item.name,
            description: item.description || '',
            target_mode: item.target_mode as 'challenge' | 'rhythm',
            pose_ids: poseIds.length ? poseIds : null,
            templates: tpls,
            frame_count: item.frame_count,
            total_duration: item.total_duration || 0,
            is_public: !!item.is_public,
            forked_from: item.forked_from ?? null,
            created_at: item.created_at,
          }
        })
      )
      setChallengeRhythmLevels(crResolved)

      // ============ 跟练关卡 ============
      // 列表接口不返回 templates/视频路径，需逐个拉取详情
      const fcRes = await fetch(`/api/follow-levels?owner_id=${user.id}&limit=24`)
      if (!fcRes.ok) throw new Error('加载失败')
      const fcData = await fcRes.json()
      const fcItems = (fcData.items || []) as any[]
      const fcResolved: FollowLevel[] = await Promise.all(
        fcItems.map(async (item): Promise<FollowLevel> => {
          let templates: PoseTemplate[] = []
          let video_path: string | null = null
          let bone_video_path: string | null = null
          try {
            const dres = await fetch(`/api/follow-levels/${item.id}?user_id=${user.id}`)
            if (dres.ok) {
              const d = await dres.json()
              templates = Array.isArray(d.templates) ? d.templates : []
              video_path = d.video_path ?? null
              bone_video_path = d.bone_video_path ?? null
            }
          } catch { /* 详情拉取失败时降级为空动作 */ }
          return {
            id: item.id,
            owner_id: item.owner_id,
            name: item.name,
            description: item.description || '',
            input_mode: item.input_mode || 'video',
            templates,
            fps: item.fps ?? null,
            frame_count: item.frame_count,
            total_duration: item.total_duration || 0,
            video_path,
            bone_video_path,
            is_public: !!item.is_public,
            forked_from: item.forked_from ?? null,
            created_at: item.created_at,
          }
        })
      )
      setFollowLevels(fcResolved)
    } catch (e: any) {
      setError(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [isLoggedIn, user])

  useEffect(() => {
    loadLevels()
  }, [loadLevels])

  // 加载本地关卡（闯关/节拍两级存储：解析 pose_ids 填充 templates 供展示）
  const loadLocalLevels = useCallback(async () => {
    try {
      await migrateLocalLevelsToTwoLevel() // 旧数据迁移（幂等）
      const data = await getLocalLevels()
      console.log('[MyLevels] 本地关卡总数:', data.length,
        '按模式:', data.reduce((acc, c) => { acc[c.target_mode] = (acc[c.target_mode] || 0) + 1; return acc }, {} as Record<string, number>))
      const resolved = await Promise.all(
        data.map(async (c) => {
          if ((c.target_mode === 'challenge' || c.target_mode === 'rhythm') && c.pose_ids?.length && !(c.templates?.length)) {
            const tpls = await resolveLocalPoseIds(c.pose_ids)
            return { ...c, templates: tpls }
          }
          return c
        })
      )
      console.log('[MyLevels] 解析后关卡:', resolved.map((c) => ({ id: c.id, name: c.name, mode: c.target_mode, tpl_len: c.templates?.length ?? 0 })))
      setLocalLevels(resolved)
    } catch (e: any) {
      console.error('[MyLevels] 加载本地关卡失败:', e?.message || e)
      setLocalLevels([])
    }
  }, [])

  useEffect(() => {
    loadLocalLevels()
  }, [loadLocalLevels])

  const handleDeleteLocal = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (deletingLocalId !== null) return
    if (!confirm('确定删除本地关卡？删除后不可恢复。')) return
    setDeletingLocalId(id)
    try {
      await deleteLocalLevel(id)
      setLocalLevels((prev) => prev.filter((c) => c.id !== id))
    } catch (e: any) {
      setError(e.message || '删除失败')
    } finally {
      setDeletingLocalId(null)
    }
  }

  // 本地关卡发布到社区：先上传动作+关卡到服务器（云端私有），再发布到社区，成功后删除本地副本
  const handlePublishLocal = async (e: React.MouseEvent, level: LocalLevel) => {
    e.stopPropagation()
    if (publishingLocalId !== null) return
    if (!isLoggedIn || !user) {
      setError('请先登录后再发布')
      return
    }
    if (!level.templates?.length) {
      setError('该关卡没有可发布的动作数据')
      return
    }
    if (!confirm(`将「${level.name}」发布到社区？\n发布后所有用户可在关卡社区浏览、收藏、游玩。`)) return
    setPublishingLocalId(level.id)
    try {
      // 1. 上传每帧动作为 PoseTemplate
      const poseIds: number[] = []
      for (let i = 0; i < level.templates.length; i++) {
        const t = level.templates[i]
        const pres = await fetch(`/api/pose-templates?user_id=${user.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${level.name}-动作${i + 1}`,
            icon: t.icon || '🧘',
            description: t.description || `第 ${i + 1} 帧提取`,
            landmarks: t.landmarks,
            scoring_rules: t.scoring_rules,
            difficulty: t.difficulty || 2,
            category: '自定义',
          }),
        })
        if (!pres.ok) {
          const d = await pres.json().catch(() => ({}))
          throw new Error(`创建动作 ${i + 1} 失败：${d.detail || pres.statusText}`)
        }
        poseIds.push((await pres.json()).id)
      }
      // 2. 创建云端私有关卡
      const cres = await fetch('/api/custom-levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: user.id,
          name: level.name,
          description: level.description || `共 ${level.templates.length} 帧`,
          target_mode: level.target_mode,
          input_mode: level.input_mode,
          pose_ids: poseIds,
          frame_count: level.frame_count,
          total_duration: level.total_duration,
          source_duration_sec: level.source_duration_sec,
          source_resolution: level.source_resolution,
        }),
      })
      if (!cres.ok) {
        const d = await cres.json().catch(() => ({}))
        throw new Error(`创建云端关卡失败：${d.detail || cres.statusText}`)
      }
      const cdata = await cres.json()
      const serverLevelId = cdata.id
      // 3. 发布到社区
      const pres2 = await fetch(`/api/custom-levels/${serverLevelId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      if (!pres2.ok) {
        const d = await pres2.json().catch(() => ({}))
        throw new Error(`发布到社区失败：${d.detail || pres2.statusText}`)
      }
      // 4. 发布成功后删除本地副本
      await deleteLocalLevel(level.id)
      setLocalLevels((prev) => prev.filter((c) => c.id !== level.id))
      // 刷新云端列表
      loadLevels()
    } catch (e: any) {
      console.error('[PublishLocal] 发布失败:', e)
      setError(e.message || '发布失败')
    } finally {
      setPublishingLocalId(null)
    }
  }

  // 打开编辑弹窗
  const openEditDialog = (e: React.MouseEvent, level: LevelCardData, type: 'server' | 'local') => {
    e.stopPropagation()
    setEditingLevel({ id: level.id, type, name: level.name, description: level.description || '' })
    setEditName(level.name)
    setEditDesc(level.description || '')
  }

  // 保存编辑（改名/改描述）
  const handleSaveEdit = async () => {
    if (!editingLevel || savingEdit) return
    const name = editName.trim()
    if (!name) {
      setError('名称不能为空')
      return
    }
    setSavingEdit(true)
    try {
      if (editingLevel.type === 'local') {
        await renameLocalLevel(String(editingLevel.id), name, editDesc)
        setLocalLevels((prev) => prev.map((c) => c.id === editingLevel.id ? { ...c, name, description: editDesc } : c))
      } else {
        if (!user?.id) throw new Error('未登录')
        const isFollow = activeTab === 'follow'
        const base = isFollow ? '/api/follow-levels' : '/api/custom-levels'
        const res = await fetch(`${base}/${editingLevel.id}/rename`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, name, description: editDesc }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.detail || '改名失败')
        }
        if (isFollow) {
          setFollowLevels((prev) => prev.map((c) => c.id === editingLevel.id ? { ...c, name, description: editDesc } : c))
        } else {
          setChallengeRhythmLevels((prev) => prev.map((c) => c.id === editingLevel.id ? { ...c, name, description: editDesc } : c))
        }
      }
      setEditingLevel(null)
    } catch (e: any) {
      console.error('[Rename] 改名失败:', e)
      setError(e.message || '改名失败')
    } finally {
      setSavingEdit(false)
    }
  }

  // 区分闯关/节拍关卡与跟练关卡：FollowLevel 没有 target_mode 字段
  const isFollowLevel = (c: ServerLevel): c is FollowLevel => !('target_mode' in c)

  const handleDelete = async (e: React.MouseEvent, level: ServerLevel) => {
    e.stopPropagation()
    if (deletingId !== null) return
    if (!user?.id) return
    if (!confirm('确定删除这套课程？删除后不可恢复。')) return
    setDeletingId(level.id)
    try {
      const isFollow = isFollowLevel(level)
      const base = isFollow ? '/api/follow-levels' : '/api/custom-levels'
      const res = await fetch(`${base}/${level.id}?user_id=${user.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('删除失败')
      if (isFollow) {
        setFollowLevels((prev) => prev.filter((c) => c.id !== level.id))
      } else {
        setChallengeRhythmLevels((prev) => prev.filter((c) => c.id !== level.id))
      }
    } catch (e: any) {
      setError(e.message || '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  // 发布/下架：直接依据 level.is_public 判断状态，调用 publish/unpublish
  const handleTogglePublish = async (e: React.MouseEvent, level: ServerLevel) => {
    e.stopPropagation()
    if (publishingId !== null) return
    if (!user?.id) return
    setPublishingId(level.id)
    try {
      const isFollow = isFollowLevel(level)
      const base = isFollow ? '/api/follow-levels' : '/api/custom-levels'
      const action = level.is_public ? 'unpublish' : 'publish'
      const res = await fetch(`${base}/${level.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || '操作失败')
      }
      const nextPublic = !level.is_public
      if (isFollow) {
        setFollowLevels((prev) => prev.map((c) => (c.id === level.id ? { ...c, is_public: nextPublic } : c)))
      } else {
        setChallengeRhythmLevels((prev) => prev.map((c) => (c.id === level.id ? { ...c, is_public: nextPublic } : c)))
      }
    } catch (e: any) {
      setError(e.message || '操作失败')
    } finally {
      setPublishingId(null)
    }
  }

  const startRhythmLevel = (level: ServerLevel) => {
    let mode: 'challenge' | 'rhythm' | 'follow'
    let videoUrl: string | undefined
    let boneVideoUrl: string | undefined
    if ('target_mode' in level) {
      // 闯关/节拍关卡
      mode = level.target_mode
    } else {
      // 跟练关卡：含原视频与骨骼视频
      mode = 'follow'
      videoUrl = level.video_path ? `/videos/${level.video_path}` : undefined
      boneVideoUrl = level.bone_video_path ? `/videos/${level.bone_video_path}` : undefined
    }
    navigate('/play', {
      state: {
        templates: level.templates,
        name: level.name,
        mode,
        videoUrl,
        boneVideoUrl,
      },
    })
  }

  const startLocalLevel = (level: LocalLevel) => {
    const boneVideoUrl = getLocalLevelBoneVideoUrl(level)
    const originalVideoUrl = getLocalLevelOriginalVideoUrl(level)
    navigate('/play', {
      state: {
        templates: level.templates,
        name: level.name,
        mode: level.target_mode,
        videoUrl: originalVideoUrl,
        boneVideoUrl,
      },
    })
  }

  // 服务器关卡按 tab 分组（闯关/节拍来自同一接口，按 target_mode 拆分；跟练独立）
  const levelsByMode = useMemo(() => {
    const grouped: Record<TabMode, ServerLevel[]> = {
      challenge: [],
      rhythm: [],
      follow: [],
    }
    for (const c of challengeRhythmLevels) {
      if (c.target_mode === 'challenge') grouped.challenge.push(c)
      else if (c.target_mode === 'rhythm') grouped.rhythm.push(c)
    }
    for (const c of followLevels) grouped.follow.push(c)
    return grouped
  }, [challengeRhythmLevels, followLevels])

  // 本地关卡按模式分组
  const localLevelsByMode = useMemo(() => {
    const grouped: Record<TabMode, LocalLevel[]> = {
      challenge: [],
      rhythm: [],
      follow: [],
    }
    for (const c of localLevels) {
      const mode = (c.target_mode || 'follow') as TabMode
      if (mode in grouped) grouped[mode].push(c)
    }
    return grouped
  }, [localLevels])

  const currentLevels = levelsByMode[activeTab]
  const currentLocalLevels = localLevelsByMode[activeTab]
  // 云端关卡按 is_public 拆分：公开（已发布到社区）vs 私有（仅自己可见，占配额）
  const currentPublicLevels = useMemo(
    () => currentLevels.filter((c) => (c as any).is_public === true),
    [currentLevels]
  )
  const currentPrivateLevels = useMemo(
    () => currentLevels.filter((c) => (c as any).is_public !== true),
    [currentLevels]
  )
  const currentConfig = TAB_CONFIG[activeTab]
  const CurrentIcon = currentConfig.icon

  // ============ 关卡卡片渲染（统一风格，与 SinglePlayer 一致） ============
  const renderLevelCard = (
    level: LevelCardData,
    type: 'server' | 'local',
    onStart: () => void,
    onDelete: (e: React.MouseEvent) => void,
    isDeleting: boolean,
    onTogglePublish?: (e: React.MouseEvent) => void,
    isPublishing?: boolean,
    onPublishLocal?: (e: React.MouseEvent) => void,
    isPublishingLocal?: boolean,
    onEdit?: (e: React.MouseEvent) => void,
  ) => {
    const totalDur = level.total_duration || level.templates.reduce(
      (sum, t) => sum + (t.sourceDuration ?? t.duration ?? 0), 0
    )
    // 发布状态直接读取 is_public（仅服务器关卡有此字段）
    const isPublished = type === 'server' && 'is_public' in level && level.is_public === true
    const badge = type === 'local'
      ? <span className="badge badge-local"><HardDrive size={8} />本地</span>
      : <span className="badge badge-custom">自定义</span>
    const borderColor = type === 'local' ? 'border-amber-400/30 hover:border-amber-400/60' : 'border-emerald-400/30 hover:border-emerald-400/60'

    return (
      <div className={`p-4 rounded-xl bg-white/5 hover:bg-white/10 border ${borderColor} transition-all group`}>
        <div onClick={onStart} className="w-full text-left cursor-pointer">
          <div className="flex items-start gap-3 mb-2">
            <div className="w-14 h-14 flex items-center justify-center bg-black/30 rounded-xl flex-shrink-0 overflow-hidden">
              {level.templates[0] ? (
                <PoseFigure template={level.templates[0]} size={56} />
              ) : (
                <Film size={28} className="text-white/40" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <h3 className="font-semibold truncate">{level.name}</h3>
                {badge}
                {isPublished && (
                  <span className="badge badge-published">
                    <CheckCircle2 size={8} />已发布
                  </span>
                )}
              </div>
              <p className="text-white/50 text-xs line-clamp-2">{level.description || '从视频生成'}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setPreviewPoses({ name: level.name, poses: level.templates }); setPreviewIndex(0) }}
              className="p-1.5 rounded-lg text-white/30 hover:text-emerald-400 hover:bg-emerald-500/20 transition-all flex-shrink-0"
              title="预览动作"
            >
              <Search size={16} />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className={`badge ${type === 'local' ? 'badge-local' : 'badge-custom'}`}>
            {level.templates.length}帧
            {'fps' in level && level.fps ? ` · ${level.fps}fps` : ''}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-white/40 flex items-center gap-1">
              <Clock size={10} />
              {totalDur.toFixed(1)}s
            </span>
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-1 rounded text-white/30 hover:text-emerald-400 hover:bg-emerald-500/20 transition-all"
                title="编辑名称"
              >
                <Pencil size={12} />
              </button>
            )}
            {onTogglePublish && type === 'server' && (
              <button
                onClick={onTogglePublish}
                disabled={isPublishing}
                className={cn(
                  'p-1 rounded transition-all disabled:opacity-50',
                  isPublished
                    ? 'text-cyan-400 hover:bg-cyan-500/20'
                    : 'text-white/30 hover:text-cyan-400 hover:bg-cyan-500/20'
                )}
                title={isPublished ? '从社区下架' : '发布到社区'}
              >
                {isPublishing ? <Loader2 size={12} className="animate-spin" /> : <Store size={12} />}
              </button>
            )}
            {onPublishLocal && type === 'local' && (
              <button
                onClick={onPublishLocal}
                disabled={isPublishingLocal}
                className="p-1 rounded text-white/30 hover:text-cyan-400 hover:bg-cyan-500/20 transition-all disabled:opacity-50"
                title="发布到社区"
              >
                {isPublishingLocal ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              </button>
            )}
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
              title="删除"
            >
              {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============ 渲染关卡网格 ============
  const renderGrid = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mx-auto">
        {/* 上传视频生成（与 SinglePlayer 一致的入口卡片） */}
        <button
          onClick={() => navigate(`/import?target=${activeTab}`)}
          className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-400/30 transition-all group text-left"
        >
          <div className="flex items-start gap-3 mb-2">
            <div className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-cyan-600/20 rounded-xl flex-shrink-0">
              <Upload size={28} className="text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold mb-0.5">上传视频生成</h3>
              <p className="text-white/50 text-xs">
                {activeTab === 'follow'
                  ? '最高30fps采样，按视频原节奏推进'
                  : activeTab === 'rhythm'
                    ? 'AI 提取关键帧，生成专属练习课程'
                    : 'AI 自动提取关键帧，生成专属动作关卡'
                }
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="badge badge-custom">自定义</span>
            <span className="text-emerald-400/60 flex items-center gap-1">
              <Upload size={10} />
              上传视频
            </span>
          </div>
        </button>

        {/* 我的公开关卡（已发布到社区，不占配额） */}
        {currentPublicLevels.length > 0 && (
          <div className="col-span-full mt-3 mb-1 flex items-center gap-1.5 text-xs text-cyan-400/80 font-medium">
            <Globe size={13} />
            我的公开关卡（{currentPublicLevels.length}）· 已发布到社区
          </div>
        )}
        {currentPublicLevels.map((level) => (
          <div key={`public-${level.id}`}>
            {renderLevelCard(
              level,
              'server',
              () => startRhythmLevel(level),
              (e) => handleDelete(e, level),
              deletingId === level.id,
              (e) => handleTogglePublish(e, level),
              publishingId === level.id,
              undefined,
              false,
              (e) => openEditDialog(e, level, 'server'),
            )}
          </div>
        ))}

        {/* 我的云端私有关卡（仅自己可见，占配额） */}
        {currentPrivateLevels.length > 0 && (
          <div className="col-span-full mt-3 mb-1 flex items-center gap-1.5 text-xs text-cyan-400/80 font-medium">
            <Cloud size={13} />
            我的云端私有关卡（{currentPrivateLevels.length}/{MAX_PER_TYPE}）· 仅自己可见
          </div>
        )}
        {currentPrivateLevels.map((level) => (
          <div key={`private-${level.id}`}>
            {renderLevelCard(
              level,
              'server',
              () => startRhythmLevel(level),
              (e) => handleDelete(e, level),
              deletingId === level.id,
              (e) => handleTogglePublish(e, level),
              publishingId === level.id,
              undefined,
              false,
              (e) => openEditDialog(e, level, 'server'),
            )}
          </div>
        ))}

        {/* 本地关卡区块 */}
        {currentLocalLevels.length > 0 && (
          <div className="col-span-full mt-3 mb-1 flex items-center gap-1.5 text-xs text-emerald-400/80 font-medium">
            <HardDrive size={13} />
            我的本地关卡（{currentLocalLevels.length}）· 仅存于本浏览器
          </div>
        )}
        {currentLocalLevels.map((level) => (
          <div key={`local-${level.id}`}>
            {renderLevelCard(
              level,
              'local',
              () => startLocalLevel(level),
              (e) => handleDeleteLocal(e, level.id),
              deletingLocalId === level.id,
              undefined,
              false,
              (e) => handlePublishLocal(e, level),
              publishingLocalId === level.id,
              (e) => openEditDialog(e, level, 'local'),
            )}
          </div>
        ))}
      </div>
    )
  }

  const totalCount = currentLevels.length + currentLocalLevels.length

  return (
    <div className="min-h-screen text-white">
      <GameBackground />
      <FloatingNav title="我的关卡" subtitle="你创建和收藏的关卡" />
      <main className="pt-20 pb-12 px-4">
        <div className="mx-auto">
          {/* 社区入口 */}
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => navigate('/market')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-medium transition-all"
            >
              <Store size={14} />
              前往关卡社区
            </button>
          </div>

          {/* 三模式切换（与 SinglePlayer 一致的 tab 样式） */}
          <div className="mb-6 max-w-3xl mx-auto">
            <div className="glass rounded-2xl p-1 flex">
              {(Object.keys(TAB_CONFIG) as TabMode[]).map((mode) => {
                const cfg = TAB_CONFIG[mode]
                const Icon = cfg.icon
                const isActive = activeTab === mode
                const serverCount = levelsByMode[mode].length
                const privateCount = levelsByMode[mode].filter((c) => (c as any).is_public !== true).length
                const publicCount = serverCount - privateCount
                const localCount = localLevelsByMode[mode].length
                return (
                  <button
                    key={mode}
                    onClick={() => setActiveTab(mode)}
                    className={cn(
                      'flex-1 flex flex-col items-center justify-center gap-1 py-3 px-4 rounded-xl font-medium transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-r from-emerald-400 to-cyan-500 text-white shadow-lg'
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={18} />
                      <span>{cfg.label}</span>
                    </div>
                    <span className={cn('text-xs', isActive ? 'text-white/80' : 'text-white/40')}>
                      {isLoggedIn
                        ? `公开 ${publicCount} · 私有 ${privateCount}/${MAX_PER_TYPE} · 本地 ${localCount}`
                        : `本地 ${localCount}`} · {cfg.desc}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 配额说明 tips（常驻） */}
          <div className="mb-4 flex items-center justify-center gap-2.5 text-xs flex-wrap">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-300">
              <Cloud size={11} /> 云端私有：每类最多 {MAX_PER_TYPE} 套（需登录）
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
              <HardDrive size={11} /> 本地浏览器：数量无限（无需登录）
            </span>
          </div>

          {/* 未登录提示 */}
          {!isLoggedIn && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
              <HardDrive size={14} className="flex-shrink-0" />
              未登录状态下，关卡自动保存到浏览器本地
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {isLoggedIn && currentPrivateLevels.length >= MAX_PER_TYPE && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
              <AlertCircle size={14} />
              私有关卡已达 {MAX_PER_TYPE} 套上限，删除旧关卡后可继续上传
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/50">
              <Loader2 size={32} className="animate-spin mb-3" />
              加载中...
            </div>
          ) : (
            renderGrid()
          )}
        </div>
      </main>

      {/* 动作预览弹窗 */}
      {previewPoses && previewPoses.poses.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewPoses(null)}
        >
          <div
            className="glass rounded-2xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold truncate">{previewPoses.name}</h2>
              <button
                onClick={() => setPreviewPoses(null)}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex items-center justify-center mb-4">
              <div className="w-64 h-64 flex items-center justify-center bg-black/30 rounded-2xl">
                <PoseFigure template={previewPoses.poses[previewIndex]} size={240} />
              </div>
            </div>

            <div className="text-center mb-4">
              <p className="text-white/80 font-medium">{previewPoses.poses[previewIndex].name}</p>
              <p className="text-white/40 text-xs mt-1">{previewIndex + 1} / {previewPoses.poses.length}</p>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setPreviewIndex((i) => i - 1)}
                disabled={previewIndex === 0}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex gap-1.5 overflow-x-auto max-w-[200px] py-1">
                {previewPoses.poses.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPreviewIndex(i)}
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0 transition-all',
                      i === previewIndex ? 'bg-white w-4' : 'bg-white/30 hover:bg-white/50'
                    )}
                  />
                ))}
              </div>
              <button
                onClick={() => setPreviewIndex((i) => i + 1)}
                disabled={previewIndex === previewPoses.poses.length - 1}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑改名弹窗 */}
      {editingLevel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => !savingEdit && setEditingLevel(null)}
        >
          <div
            className="glass rounded-2xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">编辑关卡</h2>
              <button
                onClick={() => !savingEdit && setEditingLevel(null)}
                disabled={savingEdit}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all disabled:opacity-30"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-white/60 mb-1.5">关卡名称</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={100}
                  disabled={savingEdit}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-emerald-400/50 focus:outline-none text-white text-sm transition-all disabled:opacity-50"
                  placeholder="输入关卡名称"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1.5">描述（可选）</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  maxLength={500}
                  rows={3}
                  disabled={savingEdit}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 focus:border-emerald-400/50 focus:outline-none text-white text-sm resize-none transition-all disabled:opacity-50"
                  placeholder="关卡描述"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setEditingLevel(null)}
                disabled={savingEdit}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-sm font-medium transition-all disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit || !editName.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:shadow-lg text-white text-sm font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingEdit ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    保存
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
