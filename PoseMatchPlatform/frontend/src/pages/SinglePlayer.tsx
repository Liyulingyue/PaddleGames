import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Clock, Zap, Upload, ChevronRight, ChevronLeft, Gamepad2, Clapperboard, Users, Film, Trash2, Loader2, HardDrive, Search, X, Settings, GitFork, CheckCircle2, Heart } from 'lucide-react'
import FloatingNav from '@/components/FloatingNav'
import GameBackground from '@/components/GameBackground'
import PoseFigure from '@/components/PoseFigure'
import ModeGuideModal, { type GuideSection } from '@/components/ModeGuideModal'
import { usePoseTemplates } from '@/hooks/usePoseTemplates'
import { useLevelConfigs } from '@/hooks/useLevelConfigs'
import { resolveLevelPoses, resolveRhythmPoses } from '@/utils/levelConfigs'
import { useUserStore } from '@/store/userStore'
import type { PoseTemplate } from '@/utils/poseMatcher'
import { getLocalLevels, deleteLocalLevel, getLocalLevelBoneVideoUrl, getLocalLevelOriginalVideoUrl, resolveLocalPoseIds, migrateLocalLevelsToTwoLevel, type LocalLevel } from '@/utils/localLevelStorage'
import { fetchTemplatesByIds } from '@/utils/poseTemplateService'
import { cn } from '@/lib/utils'

type ModeTab = 'challenge' | 'rhythm' | 'follow'

// 用户自定义关卡类型（与 MyLevels 一致，混入各 tab 展示）
interface UserLevel {
  id: number
  owner_id: number  // 替代 user_id
  name: string
  description: string
  target_mode: 'challenge' | 'rhythm' | 'follow'
  // 闯关/节拍：引用 PoseTemplate.id 列表（两级存储）；跟练：为 null
  pose_ids?: number[] | null
  // 跟练：内嵌 PoseTemplate[]；闯关/节拍：前端解析 pose_ids 后填充（始终为数组）
  templates: PoseTemplate[]
  fps: number | null
  total_duration: number
  created_at: string
  video_path?: string | null
  bone_video_path?: string | null
  input_mode?: string
  frame_count?: number
  is_public?: boolean
  forked_from?: number | null
}

export default function SinglePlayer() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { templates, loading } = usePoseTemplates()
  const { levels: levelConfigs, rhythmLevels: rhythmConfigs } = useLevelConfigs()
  const { user, isLoggedIn } = useUserStore()
  const [activeTab, setActiveTab] = useState<ModeTab>(
    (searchParams.get('mode') as ModeTab) || 'challenge'
  )
  const [activeTag, setActiveTag] = useState<string>('全部')
  const [perPoseSec, setPerPoseSec] = useState(8)
  const [previewPoses, setPreviewPoses] = useState<{ name: string; poses: PoseTemplate[] } | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [guideOpen, setGuideOpen] = useState(false)

  // 单人模式指南内容（闯关/节拍/跟练三模式通用操作说明）
  const guideSections: GuideSection[] = useMemo(() => [
    {
      icon: Gamepad2,
      title: '闯关模式',
      desc: '达标即过，比拼速度',
      color: 'from-emerald-500 to-cyan-500',
      visual: (
        <div className="space-y-2.5">
          {/* 主流程 */}
          <div className="flex items-center justify-center gap-1.5 text-xs flex-wrap">
            <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-medium">开始</span>
            <span className="text-white/30">→</span>
            <span className="px-2 py-1 rounded-lg bg-white/10 text-white/70">动作</span>
            <span className="text-white/30">→</span>
            <span className="px-2 py-1 rounded-lg bg-white/10 text-white/70">实时评分</span>
            <span className="text-white/30">→</span>
            <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 font-medium">≥80?</span>
          </div>
          {/* 分支 */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2">
              <div className="text-emerald-400 font-bold mb-1">✓ 达标</div>
              <div className="text-white/60">切换下一动作 → 记录用时</div>
            </div>
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-2">
              <div className="text-rose-400 font-bold mb-1">✗ 未达标</div>
              <div className="text-white/60">60s 超时跳过 · 记 0 分</div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-xs">
            <span className="text-white/30">全部完成或时限到 →</span>
            <span className="px-2 py-1 rounded-lg bg-purple-500/20 text-purple-400 font-medium">上传排行榜</span>
          </div>
        </div>
      ),
      items: [
        { label: '达标即过', desc: '实时评分达到 80 分自动切换下一动作', tag: '≥80分', tagColor: 'bg-emerald-500/20 text-emerald-400' },
        { label: '比拼速度', desc: '评价为总耗时，越短越好', tag: '计时', tagColor: 'bg-blue-500/20 text-blue-400' },
        { label: '单动作超时', desc: '每个动作 60s 未达标自动跳过（记 0 分），防止卡关', tag: '60s', tagColor: 'bg-amber-500/20 text-amber-400' },
        { label: '关卡总时限', desc: '到时自动结束，未完成动作记 0 分', tag: '限时', tagColor: 'bg-rose-500/20 text-rose-400' },
        { label: '完成数统计', desc: '仅统计达标动作（≥80 分），未达标不计入' },
      ],
    },
    {
      icon: Clapperboard,
      title: '节拍模式',
      desc: '固定节奏，比拼得分',
      color: 'from-purple-500 to-pink-500',
      visual: (
        <div className="space-y-2">
          {/* 时间轴 */}
          <div className="flex items-center text-[10px] text-white/40 justify-between px-1">
            <span>0s</span><span>8s</span><span>16s</span><span>24s</span>
          </div>
          <div className="flex gap-1">
            {['动作1', '动作2', '动作3', '动作4'].map((t, i) => (
              <div key={i} className="flex-1 text-center">
                <div className={cn(
                  'h-7 rounded-md flex items-center justify-center text-[11px] font-medium',
                  i === 1 ? 'bg-gradient-to-r from-purple-500/40 to-pink-500/40 text-white ring-1 ring-pink-400/50' : 'bg-white/10 text-white/60'
                )}>{t}</div>
              </div>
            ))}
          </div>
          {/* 倒计时进度条示意 */}
          <div className="flex items-center gap-2 text-[10px] text-white/50">
            <span className="text-pink-400 font-bold">▼</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-1/3 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full" />
            </div>
            <span className="font-mono">5.3s</span>
          </div>
        </div>
      ),
      items: [
        { label: '固定节奏', desc: '每个动作固定时长切换（默认 8s，可调整）', tag: '8s/动作', tagColor: 'bg-purple-500/20 text-purple-400' },
        { label: '比拼得分', desc: '倒计时结束取最后瞬间分，评价为平均分', tag: '平均分', tagColor: 'bg-pink-500/20 text-pink-400' },
        { label: '标签分类', desc: '热身/基础/进阶/瑜伽等分类，自定义关卡在「自定义」标签' },
      ],
    },
    {
      icon: Users,
      title: '跟练模式',
      desc: '跟着视频，连续跟做',
      color: 'from-green-500 to-emerald-500',
      visual: (
        <div className="space-y-2">
          {/* 帧序列进度 */}
          <div className="flex items-center gap-1 text-[10px] text-white/40 justify-between">
            <span>视频帧序列</span>
            <span className="text-emerald-400">▶ 播放中</span>
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'flex-1 h-8 rounded-sm flex items-center justify-center text-[8px]',
                  i < 6 ? 'bg-emerald-500/30 text-emerald-300' : i === 6 ? 'bg-gradient-to-b from-emerald-400 to-emerald-500 text-white ring-1 ring-emerald-300' : 'bg-white/10 text-white/30'
                )}
              >
                {i < 6 ? '✓' : i === 6 ? '▶' : ''}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-[10px] text-white/50">
            <span className="font-mono">已评 6 帧</span>
            <span className="font-mono">当前第 7 帧</span>
          </div>
        </div>
      ),
      items: [
        { label: '跟着视频', desc: '按视频原节奏连续推进，无需手动切换' },
        { label: '评价方式', desc: '取各帧平均分', tag: '平均分', tagColor: 'bg-emerald-500/20 text-emerald-400' },
        { label: 'Beta 功能', desc: '暂不稳定，建议登录后体验', tag: 'Beta', tagColor: 'bg-amber-500/20 text-amber-400' },
      ],
    },
    {
      icon: Settings,
      title: '通用操作',
      desc: '所有模式通用的设置与机制',
      color: 'from-yellow-500 to-orange-500',
      visual: (
        <div className="grid grid-cols-3 gap-2">
          {[
            { name: '极简', points: '6 点', color: 'from-slate-500 to-slate-600' },
            { name: '半身', points: '8 点', color: 'from-emerald-500 to-cyan-500', def: true },
            { name: '全身', points: '12 点', color: 'from-purple-500 to-pink-500' },
          ].map((m, i) => (
            <div key={i} className={cn('p-2 rounded-lg bg-gradient-to-br relative', m.color)}>
              {m.def && <span className="absolute top-1 right-1 px-1 rounded text-[8px] font-bold bg-white/30">默认</span>}
              <div className="text-xs font-bold text-white">{m.name}</div>
              <div className="text-[10px] text-white/80">{m.points}</div>
            </div>
          ))}
        </div>
      ),
      items: [
        { label: '评分范围', desc: '极简/半身/全身三档可选，默认半身（8 点）' },
        { label: '镜像翻转', desc: '游戏内可切换镜像，适配不同朝向' },
        { label: '隐私保护', desc: '摄像头数据本地处理，仅上传匿名分数', tag: '隐私', tagColor: 'bg-green-500/20 text-green-400' },
      ],
    },
  ], [])

  // 用户自定义关卡（登录后加载，混入各 tab 展示）
  const [userLevels, setUserLevels] = useState<UserLevel[]>([])
  const [deletingLevelId, setDeletingLevelId] = useState<number | null>(null)
  // 本地关卡（IndexedDB，无需登录）
  const [localLevels, setLocalLevels] = useState<LocalLevel[]>([])
  const [deletingLocalId, setDeletingLocalId] = useState<string | null>(null)
  const [forkingPresetId, setForkingPresetId] = useState<number | null>(null)
  const [forkedPresetIds, setForkedPresetIds] = useState<Set<number | string>>(new Set())

  const loadUserLevels = useCallback(async () => {
    if (!isLoggedIn || !user) {
      setUserLevels([])
      return
    }
    try {
      // 闯关/节拍关卡：列表 + 逐个详情获取 pose_ids → 解析 templates
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
            fps: null,
            total_duration: item.total_duration || 0,
            created_at: item.created_at,
            is_public: !!item.is_public,
            forked_from: item.forked_from ?? null,
          }
        })
      )

      // 跟练关卡：列表 + 逐个详情获取 templates + 视频路径
      const fcRes = await fetch(`/api/follow-levels?owner_id=${user.id}&limit=24`)
      if (!fcRes.ok) throw new Error('加载失败')
      const fcData = await fcRes.json()
      const fcItems = (fcData.items || []) as any[]
      const fcResolved: UserLevel[] = await Promise.all(
        fcItems.map(async (item): Promise<UserLevel> => {
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
            target_mode: 'follow',
            templates,
            fps: item.fps ?? null,
            total_duration: item.total_duration || 0,
            created_at: item.created_at,
            video_path,
            bone_video_path,
            is_public: !!item.is_public,
            forked_from: item.forked_from ?? null,
          }
        })
      )

      setUserLevels([...crResolved, ...fcResolved])
    } catch {
      setUserLevels([])
    }
  }, [isLoggedIn, user])

  useEffect(() => {
    loadUserLevels()
  }, [loadUserLevels])

  // 用户收藏的社区关卡（按当前模式展示在「收藏」tag 下，复用 UserLevel 结构直接开玩）
  const [favoriteLevels, setFavoriteLevels] = useState<UserLevel[]>([])
  const loadFavoriteLevels = useCallback(async () => {
    if (!isLoggedIn || !user) {
      setFavoriteLevels([])
      return
    }
    try {
      const res = await fetch(`/api/favorites?user_id=${user.id}`)
      if (!res.ok) throw new Error('加载收藏失败')
      const data = await res.json()
      const items = (data.items || []) as any[]
      // 仅保留关卡收藏（custom_level / follow_level），过滤掉动作收藏
      const levelFavs = items.filter(
        (it) => it.target_type === 'custom_level' || it.target_type === 'follow_level'
      )
      const resolved: UserLevel[] = await Promise.all(
        levelFavs.map(async (item): Promise<UserLevel> => {
          let templates: PoseTemplate[] = []
          let video_path: string | null = null
          let bone_video_path: string | null = null
          let pose_ids: number[] | null = null
          let fps: number | null = null
          try {
            if (item.target_type === 'custom_level') {
              const dres = await fetch(`/api/custom-levels/${item.id}?user_id=${user.id}`)
              if (dres.ok) {
                const d = await dres.json()
                pose_ids = Array.isArray(d.pose_ids) ? d.pose_ids : null
                if (pose_ids?.length) templates = await fetchTemplatesByIds(pose_ids)
              }
            } else {
              const dres = await fetch(`/api/follow-levels/${item.id}?user_id=${user.id}`)
              if (dres.ok) {
                const d = await dres.json()
                templates = Array.isArray(d.templates) ? d.templates : []
                video_path = d.video_path ?? null
                bone_video_path = d.bone_video_path ?? null
                fps = d.fps ?? null
              }
            }
          } catch { /* 详情拉取失败时降级为空动作 */ }
          return {
            id: item.id,
            owner_id: 0,
            name: item.name,
            description: item.description || '',
            target_mode:
              item.target_type === 'follow_level'
                ? 'follow'
                : (item.target_mode === 'rhythm' ? 'rhythm' : 'challenge'),
            pose_ids,
            templates,
            fps,
            total_duration: item.total_duration || 0,
            created_at: item.favorited_at || '',
            video_path,
            bone_video_path,
            is_public: !!item.is_public,
            forked_from: null,
          }
        })
      )
      setFavoriteLevels(resolved)
    } catch {
      setFavoriteLevels([])
    }
  }, [isLoggedIn, user])

  useEffect(() => {
    loadFavoriteLevels()
  }, [loadFavoriteLevels])

  // 加载本地关卡（闯关/节拍两级存储：解析 pose_ids 填充 templates 供展示）
  const loadLocalLevels = useCallback(async () => {
    try {
      await migrateLocalLevelsToTwoLevel() // 旧数据迁移（幂等）
      const levels = await getLocalLevels()
      const resolved = await Promise.all(
        levels.map(async (c) => {
          if ((c.target_mode === 'challenge' || c.target_mode === 'rhythm') && c.pose_ids?.length && !(c.templates?.length)) {
            const tpls = await resolveLocalPoseIds(c.pose_ids)
            return { ...c, templates: tpls }
          }
          return c
        })
      )
      setLocalLevels(resolved)
    } catch {
      setLocalLevels([])
    }
  }, [])

  useEffect(() => {
    loadLocalLevels()
  }, [loadLocalLevels])

  const handleDeleteLevel = useCallback(async (e: React.MouseEvent, levelId: number) => {
    e.stopPropagation()
    if (deletingLevelId !== null) return
    if (!user?.id) return
    if (!confirm('确定删除这套关卡？删除后不可恢复。')) return
    setDeletingLevelId(levelId)
    try {
      // 根据 target_mode 选择对应 API
      const level = userLevels.find(c => c.id === levelId)
      const isFollow = level?.target_mode === 'follow'
      const base = isFollow ? '/api/follow-levels' : '/api/custom-levels'
      const res = await fetch(`${base}/${levelId}?user_id=${user.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('删除失败')
      setUserLevels((prev) => prev.filter((c) => c.id !== levelId))
    } catch (e: any) {
      alert(e.message || '删除失败')
    } finally {
      setDeletingLevelId(null)
    }
  }, [deletingLevelId, userLevels, user?.id])

  // Fork 系统预设关卡到私有
  const handleForkPreset = useCallback(async (e: React.MouseEvent, presetId: number | string) => {
    e.stopPropagation()
    if (!user?.id) {
      alert('请先登录')
      return
    }
    if (forkingPresetId !== null) return
    setForkingPresetId(presetId as number)
    try {
      const res = await fetch(`/api/custom-levels/${presetId}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.detail || 'Fork 失败')
      setForkedPresetIds((prev) => new Set(prev).add(presetId))
      loadUserLevels()
      alert(`已 Fork 到我的关卡（深拷贝 ${d.forked_poses ?? 0} 个动作）`)
    } catch (e: any) {
      alert(e.message || 'Fork 失败')
    } finally {
      setForkingPresetId(null)
    }
  }, [forkingPresetId, user?.id, loadUserLevels])

  // 按 target_mode 分组，便于各 tab 混入
  const userLevelsByMode = useMemo(() => {
    const grouped: Record<'challenge' | 'rhythm' | 'follow', UserLevel[]> = {
      challenge: [],
      rhythm: [],
      follow: [],
    }
    for (const c of userLevels) {
      const m = (c.target_mode || 'follow') as 'challenge' | 'rhythm' | 'follow'
      if (m in grouped) grouped[m].push(c)
    }
    return grouped
  }, [userLevels])

  // 本地关卡按 target_mode 分组
  const localLevelsByMode = useMemo(() => {
    const grouped: Record<'challenge' | 'rhythm' | 'follow', LocalLevel[]> = {
      challenge: [],
      rhythm: [],
      follow: [],
    }
    for (const c of localLevels) {
      const m = (c.target_mode || 'follow') as 'challenge' | 'rhythm' | 'follow'
      if (m in grouped) grouped[m].push(c)
    }
    return grouped
  }, [localLevels])

  const handleDeleteLocalLevel = useCallback(async (e: React.MouseEvent, levelId: string) => {
    e.stopPropagation()
    if (deletingLocalId !== null) return
    if (!confirm('确定删除本地关卡？删除后不可恢复。')) return
    setDeletingLocalId(levelId)
    try {
      await deleteLocalLevel(levelId)
      setLocalLevels((prev) => prev.filter((c) => c.id !== levelId))
    } catch (e: any) {
      alert(e.message || '删除失败')
    } finally {
      setDeletingLocalId(null)
    }
  }, [deletingLocalId])

  const handleTabChange = (tab: ModeTab) => {
    setActiveTab(tab)
    setActiveTag('全部')
    setSearchParams({ mode: tab })
  }

  const levels = useMemo(() => {
    return levelConfigs.map((lvl) => {
      const poseIds = resolveLevelPoses(lvl, templates)
      const poses = poseIds
        .map((id) => templates.find((t) => String(t.id) === String(id)))
        .filter(Boolean) as typeof templates
      return { ...lvl, poseIds, poses }
    })
  }, [levelConfigs, templates])

  const rhythmLevels = useMemo(() => {
    return rhythmConfigs.map((c) => {
      const poseIds = resolveRhythmPoses(c, templates)
      const levelTemplates = poseIds
        .map((id) => templates.find((t) => String(t.id) === String(id)))
        .filter(Boolean) as typeof templates
      return { ...c, templates: levelTemplates }
    })
  }, [rhythmConfigs, templates])

  const startLevel = (level: (typeof levels)[0]) => {
    navigate(`/play?mode=challenge&level=${level.id}`)
  }

  const startRhythmLevel = (level: (typeof rhythmLevels)[0]) => {
    navigate(`/play?mode=rhythm&level=${level.id}&duration=${perPoseSec}`)
  }

  // 用户关卡统一走 location.state 传 templates（不经后端 level/level 解析）
  const startUserLevel = (level: UserLevel) => {
    const videoUrl = level.video_path ? `/videos/${level.video_path}` : undefined
    const boneVideoUrl = level.bone_video_path ? `/videos/${level.bone_video_path}` : undefined
    navigate('/play', {
      state: {
        templates: level.templates,
        name: level.name,
        mode: level.target_mode,
        videoUrl,
        boneVideoUrl,
      },
    })
  }

  // 本地关卡启动：从 IndexedDB 获取 blob URL
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

  const tabs = [
    { key: 'challenge' as ModeTab, label: '闯关模式', icon: Gamepad2, desc: '达标即过，比拼速度' },
    { key: 'rhythm' as ModeTab, label: '节拍模式', icon: Clapperboard, desc: '固定节奏，比拼得分' },
    { key: 'follow' as ModeTab, label: '跟练模式', icon: Users, desc: '跟着视频，连续跟做' },
  ]

  // 节拍/跟练模式标签：全部 + 系统关卡实际存在的 tag 去重 + 自定义 + 收藏
  const rhythmTags = useMemo(() => {
    const tags = Array.from(new Set(rhythmLevels.map((c) => c.tag).filter(Boolean))) as string[]
    return ['全部', ...tags, '自定义', '收藏']
  }, [rhythmLevels])

  // 系统关卡过滤：「全部」显示全部，「自定义」「收藏」不显示系统关卡，其余按 tag
  const filteredRhythmLevels = activeTag === '全部'
    ? rhythmLevels
    : (activeTag === '自定义' || activeTag === '收藏')
      ? []
      : rhythmLevels.filter((c) => c.tag === activeTag)

  // 用户/本地关卡只在「全部」或「自定义」标签下显示
  const showUserLevels = activeTag === '全部' || activeTag === '自定义'

  // 闯关模式标签：全部 + 关卡实际存在的 tag 去重 + 自定义 + 收藏
  const levelTags = useMemo(() => {
    const tags = Array.from(new Set(levels.map((l) => l.tag).filter(Boolean))) as string[]
    return ['全部', ...tags, '自定义', '收藏']
  }, [levels])

  // 系统关卡过滤：「全部」显示全部，「自定义」「收藏」不显示系统关卡，其余按 tag
  const filteredLevels = activeTag === '全部'
    ? levels
    : (activeTag === '自定义' || activeTag === '收藏')
      ? []
      : levels.filter((l) => l.tag === activeTag)

  // 收藏的关卡按 target_mode 分组（仅登录后展示）
  const favoriteLevelsByMode = useMemo(() => {
    const grouped: Record<'challenge' | 'rhythm' | 'follow', UserLevel[]> = {
      challenge: [],
      rhythm: [],
      follow: [],
    }
    for (const c of favoriteLevels) {
      const m = (c.target_mode || 'follow') as 'challenge' | 'rhythm' | 'follow'
      if (m in grouped) grouped[m].push(c)
    }
    return grouped
  }, [favoriteLevels])

  // 跟练模式 tag 栏：仅有「全部」和「收藏」两个（跟练无系统 tag 分类）
  const followTags = useMemo(() => ['全部', '收藏'], [])
  const showFavoriteLevels = activeTag === '收藏'

  // 收藏关卡卡片渲染（三个模式通用，玫瑰色徽章 + Heart 图标，点击直接开玩）
  const renderFavoriteLevelCard = (level: UserLevel, mode: 'challenge' | 'rhythm' | 'follow') => {
    const totalDur = level.total_duration || level.templates.reduce(
      (sum, t) => sum + (t.sourceDuration ?? t.duration ?? 0), 0
    )
    return (
      <div
        key={`fav-${mode}-${level.id}`}
        className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-rose-400/30 hover:border-rose-400/60 transition-all group"
      >
        <div
          onClick={() => startUserLevel(level)}
          className="w-full text-left cursor-pointer"
        >
          <div className="flex items-start gap-3 mb-2">
            <div className="w-14 h-14 flex items-center justify-center bg-black/30 rounded-xl flex-shrink-0 overflow-hidden">
              {level.templates[0] ? (
                <PoseFigure template={level.templates[0]} size={56} />
              ) : (
                <Film size={28} className="text-white/40" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <h3 className="font-semibold truncate">{level.name}</h3>
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-medium flex items-center gap-0.5 flex-shrink-0">
                  <Heart size={8} fill="currentColor" />收藏
                </span>
                {!level.is_public && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-medium flex-shrink-0">
                    已下架
                  </span>
                )}
              </div>
              <p className="text-white/50 text-xs line-clamp-2">{level.description || '社区作品'}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setPreviewPoses({ name: level.name, poses: level.templates }); setPreviewIndex(0) }}
              className="p-1.5 rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-500/20 transition-all"
              title="预览动作"
            >
              <Search size={16} />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400">
            {level.templates.length}帧
          </span>
          <span className="text-white/40 flex items-center gap-1">
            <Clock size={10} />
            {totalDur.toFixed(1)}s
            {mode === 'rhythm' && level.templates.length > 0 && ` · ${Math.round(level.templates.length * perPoseSec / 60)}分钟`}
          </span>
        </div>
      </div>
    )
  }

  // 收藏 tag 下空状态提示
  const renderFavoriteEmpty = () => (
    <div className="col-span-full text-center py-16">
      <Heart size={40} className="mx-auto text-white/20 mb-3" />
      <p className="text-white/60 mb-1">还没有收藏的关卡</p>
      <p className="text-white/40 text-sm mb-5">去关卡市场收藏喜欢的作品吧</p>
      <button
        onClick={() => navigate('/market')}
        className="px-5 py-2.5 bg-gradient-to-r from-rose-400 to-pink-500 rounded-xl font-medium hover:shadow-lg hover:shadow-rose-500/30 transition-all"
      >
        前往关卡市场
      </button>
    </div>
  )

  return (
    <div className="min-h-screen text-white">
      <GameBackground />
      <FloatingNav title="单人模式" subtitle="闯关 · 跟练 · 节拍，三种玩法任你选" onHelpClick={() => setGuideOpen(true)} />
      <main className="pt-20 pb-12 px-4">
        <div className="mx-auto">
          {/* 三模式切换 */}
          <div className="mb-6 max-w-3xl mx-auto">
            <div className="glass rounded-2xl p-1 flex">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleTabChange(tab.key)}
                    className={cn(
                      'flex-1 flex flex-col items-center justify-center gap-1 py-3 px-4 rounded-xl font-medium transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-lg'
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={18} />
                      <span>{tab.label}</span>
                    </div>
                    <span className={cn('text-xs', isActive ? 'text-white/80' : 'text-white/40')}>
                      {tab.desc}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ========== 闯关模式 ========== */}
          {activeTab === 'challenge' && (
            <>
            <div className="mb-4 flex items-center justify-center gap-2 text-sm">
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">Hit</span>
              <span className="text-white/50 text-xs">尝试快速对齐示例动作，最短时间完成吧</span>
            </div>
            <div className="mb-4 flex items-center justify-center gap-2 flex-wrap">
              {levelTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                    activeTag === tag
                      ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mx-auto">
              {/* 上传视频生成关卡（收藏 tag 下隐藏） */}
              {!showFavoriteLevels && (
              <button
                onClick={() => navigate('/import?target=challenge')}
                className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-400/30 transition-all group text-left"
              >
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-cyan-600/20 rounded-xl flex-shrink-0">
                    <Upload size={28} className="text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-0.5">上传视频生成关卡</h3>
                    <p className="text-white/50 text-xs">AI 自动提取视频关键帧，生成专属动作关卡</p>
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
              )}

              {/* 随机选择（收藏 tag 下隐藏） */}
              {!showFavoriteLevels && (
              <button
                onClick={() => {
                  const randomLevel = levels[Math.floor(Math.random() * levels.length)]
                  if (randomLevel) startLevel(randomLevel)
                }}
                className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-400/30 transition-all group text-left"
              >
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-600/20 rounded-xl flex-shrink-0">
                    <Zap size={28} className="text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-0.5">随机选择</h3>
                    <p className="text-white/50 text-xs">让系统随机挑选一个关卡挑战</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">随机</span>
                  <span className="text-purple-400/60 flex items-center gap-1">
                    <Zap size={10} />
                    随机挑战
                  </span>
                </div>
              </button>
              )}

              {/* 用户自定义关卡（混入展示，带「自定义」徽章） */}
              {showUserLevels && userLevelsByMode.challenge.map((level) => {
                const totalDur = level.total_duration || level.templates.reduce(
                  (sum, t) => sum + (t.sourceDuration ?? t.duration ?? 0), 0
                )
                const isDeleting = deletingLevelId === level.id
                return (
                  <div
                    key={`user-${level.id}`}
                    className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-emerald-400/30 hover:border-emerald-400/60 transition-all group"
                  >
                    <div
                      onClick={() => startUserLevel(level)}
                      className="w-full text-left cursor-pointer"
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-14 h-14 flex items-center justify-center bg-black/30 rounded-xl flex-shrink-0 overflow-hidden">
                          {level.templates[0] ? (
                            <PoseFigure template={level.templates[0]} size={56} />
                          ) : (
                            <Film size={28} className="text-white/40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <h3 className="font-semibold truncate">{level.name}</h3>
                            <span className="badge badge-custom">
                              自定义
                            </span>
                          </div>
                          <p className="text-white/50 text-xs line-clamp-2">{level.description || '从视频生成'}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewPoses({ name: level.name, poses: level.templates }); setPreviewIndex(0) }}
                          className="p-1.5 rounded-lg text-white/30 hover:text-emerald-400 hover:bg-emerald-500/20 transition-all"
                          title="预览动作"
                        >
                          <Search size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="badge badge-custom">
                        {level.templates.length}帧
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-white/40 flex items-center gap-1">
                          <Clock size={10} />
                          {totalDur.toFixed(1)}s
                        </span>
                        <button
                          onClick={(e) => handleDeleteLevel(e, level.id)}
                          disabled={isDeleting}
                          className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                          title="删除"
                        >
                          {isDeleting ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* 本地关卡卡片（闯关） */}
              {showUserLevels && localLevelsByMode.challenge.map((level) => {
                const totalDur = level.total_duration || level.templates.reduce(
                  (sum, t) => sum + (t.sourceDuration ?? t.duration ?? 0), 0
                )
                const isDeleting = deletingLocalId === level.id
                return (
                  <div
                    key={`local-${level.id}`}
                    className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-amber-400/30 hover:border-amber-400/60 transition-all group"
                  >
                    <div
                      onClick={() => startLocalLevel(level)}
                      className="w-full text-left cursor-pointer"
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-14 h-14 flex items-center justify-center bg-black/30 rounded-xl flex-shrink-0 overflow-hidden">
                          {level.templates[0] ? (
                            <PoseFigure template={level.templates[0]} size={56} />
                          ) : (
                            <Film size={28} className="text-white/40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <h3 className="font-semibold truncate">{level.name}</h3>
                            <span className="badge badge-local">
                              <HardDrive size={8} />本地
                            </span>
                          </div>
                          <p className="text-white/50 text-xs line-clamp-2">{level.description || '从视频生成'}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewPoses({ name: level.name, poses: level.templates }); setPreviewIndex(0) }}
                          className="p-1.5 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-500/20 transition-all"
                          title="预览动作"
                        >
                          <Search size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="badge badge-local">
                        {level.templates.length}帧
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-white/40 flex items-center gap-1">
                          <Clock size={10} />
                          {totalDur.toFixed(1)}s
                        </span>
                        <button
                          onClick={(e) => handleDeleteLocalLevel(e, level.id)}
                          disabled={isDeleting}
                          className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                          title="删除"
                        >
                          {isDeleting ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {filteredLevels.map((level) => {
                const poses = level.poses
                const isForked = forkedPresetIds.has(level.id)
                const isForking = forkingPresetId === level.id
                return (
                  <div
                    key={`${level.id}-${level.name}`}
                    onClick={() => startLevel(level)}
                    className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-400/30 transition-all group cursor-pointer"
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <div className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex-shrink-0 text-white text-lg font-bold">
                        {level.id}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold mb-0.5">{level.name}</h3>
                        <p className="text-white/50 text-xs line-clamp-2">{level.desc}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setPreviewPoses({ name: level.name, poses }); setPreviewIndex(0) }}
                        className="p-1.5 rounded-lg text-white/30 hover:text-emerald-400 hover:bg-emerald-500/20 transition-all"
                        title="预览动作"
                      >
                        <Search size={16} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                        {level.timeLimit}s
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-white/40 flex items-center gap-1">
                          <Zap size={10} />
                          {poses.length}动作
                        </span>
                        {isLoggedIn && (
                          <button
                            onClick={(e) => handleForkPreset(e, level.id)}
                            disabled={isForking || isForked}
                            className={cn(
                              'p-1 rounded transition-all disabled:opacity-50',
                              isForked
                                ? 'text-emerald-400'
                                : 'text-white/30 hover:text-cyan-400 hover:bg-cyan-500/20'
                            )}
                            title={isForked ? '已 Fork' : 'Fork 到我的关卡'}
                          >
                            {isForking ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : isForked ? (
                              <CheckCircle2 size={12} />
                            ) : (
                              <GitFork size={12} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* 收藏关卡卡片（仅「收藏」tag 下显示） */}
              {showFavoriteLevels && (
                <>
                  {favoriteLevelsByMode.challenge.length > 0
                    ? favoriteLevelsByMode.challenge.map((c) => renderFavoriteLevelCard(c, 'challenge'))
                    : renderFavoriteEmpty()}
                </>
              )}
            </div>
            </>
          )}

          {/* ========== 节拍模式 ========== */}
          {activeTab === 'rhythm' && (
            <>
              <div className="mb-4 flex items-center justify-center gap-2 text-sm">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">Hit</span>
                <span className="text-white/50 text-xs">跟着每个动作，做的标准吧</span>
              </div>
              <div className="mb-4 flex items-center justify-center gap-2 flex-wrap">
                {rhythmTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(tag)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                      activeTag === tag
                        ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <div className="mb-4 flex items-center justify-center gap-3 text-sm">
                <span className="text-white/60">每个动作</span>
                <div className="flex gap-1.5">
                  {[3, 5, 8, 10].map((s) => (
                    <button
                      key={s}
                      onClick={() => setPerPoseSec(s)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                        perPoseSec === s ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
                      )}
                    >
                      {s}秒
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mx-auto">
                {/* 上传视频生成关卡（收藏 tag 下隐藏） */}
                {!showFavoriteLevels && (
                <button
                  onClick={() => navigate('/import?target=rhythm')}
                  className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-400/30 transition-all group text-left"
                >
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-cyan-600/20 rounded-xl flex-shrink-0">
                      <Upload size={28} className="text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold mb-0.5">上传视频生成关卡</h3>
                      <p className="text-white/50 text-xs">AI 提取关键帧，生成专属练习关卡</p>
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
                )}

                {/* 随机选择（收藏 tag 下隐藏） */}
                {!showFavoriteLevels && (
                <button
                  onClick={() => {
                    const randomLevel = rhythmLevels[Math.floor(Math.random() * rhythmLevels.length)]
                    if (randomLevel) startRhythmLevel(randomLevel)
                  }}
                  className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-400/30 transition-all group text-left"
                >
                  <div className="flex items-start gap-3 mb-2">
                    <div className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-600/20 rounded-xl flex-shrink-0">
                      <Zap size={28} className="text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold mb-0.5">随机选择</h3>
                      <p className="text-white/50 text-xs">让系统随机挑选一套关卡练习</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">随机</span>
                    <span className="text-purple-400/60 flex items-center gap-1">
                      <Zap size={10} />
                      随机练习
                    </span>
                  </div>
                </button>
                )}

                {/* 用户自定义节拍关卡（混入展示，不受 tag 筛选影响） */}
                {showUserLevels && userLevelsByMode.rhythm.map((level) => {
                  const totalDur = level.total_duration || level.templates.reduce(
                    (sum, t) => sum + (t.sourceDuration ?? t.duration ?? 0), 0
                  )
                  const isDeleting = deletingLevelId === level.id
                  return (
                    <div
                      key={`user-${level.id}`}
                      className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-emerald-400/30 hover:border-emerald-400/60 transition-all group"
                    >
                      <button
                        onClick={() => startUserLevel(level)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start gap-3 mb-2">
                          <div className="w-14 h-14 flex items-center justify-center bg-black/30 rounded-xl flex-shrink-0 overflow-hidden">
                            {level.templates[0] ? (
                              <PoseFigure template={level.templates[0]} size={56} />
                            ) : (
                              <Film size={28} className="text-white/40" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <h3 className="font-semibold truncate">{level.name}</h3>
                              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-medium flex-shrink-0">
                                自定义
                              </span>
                            </div>
                            <p className="text-white/50 text-xs line-clamp-2">{level.description || '从视频生成'}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setPreviewPoses({ name: level.name, poses: level.templates }); setPreviewIndex(0) }}
                            className="p-1.5 rounded-lg text-white/30 hover:text-emerald-400 hover:bg-emerald-500/20 transition-all"
                            title="预览动作"
                          >
                            <Search size={16} />
                          </button>
                        </div>
                      </button>
                      <div className="flex items-center justify-between text-xs">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                          {level.templates.length}帧
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-white/40 flex items-center gap-1">
                            <Clock size={10} />
                            {totalDur.toFixed(1)}s · {Math.round(level.templates.length * perPoseSec / 60)}分钟
                          </span>
                          <button
                            onClick={(e) => handleDeleteLevel(e, level.id)}
                            disabled={isDeleting}
                            className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                            title="删除"
                          >
                            {isDeleting ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Trash2 size={12} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* 本地关卡卡片（节拍） */}
                {showUserLevels && localLevelsByMode.rhythm.map((level) => {
                  const totalDur = level.total_duration || level.templates.reduce(
                    (sum, t) => sum + (t.sourceDuration ?? t.duration ?? 0), 0
                  )
                  const isDeleting = deletingLocalId === level.id
                  return (
                    <div
                      key={`local-${level.id}`}
                      className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-amber-400/30 hover:border-amber-400/60 transition-all group"
                    >
                      <button
                        onClick={() => startLocalLevel(level)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start gap-3 mb-2">
                          <div className="w-14 h-14 flex items-center justify-center bg-black/30 rounded-xl flex-shrink-0 overflow-hidden">
                            {level.templates[0] ? (
                              <PoseFigure template={level.templates[0]} size={56} />
                            ) : (
                              <Film size={28} className="text-white/40" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <h3 className="font-semibold truncate">{level.name}</h3>
                              <span className="badge badge-local">
                                <HardDrive size={8} />本地
                              </span>
                            </div>
                            <p className="text-white/50 text-xs line-clamp-2">{level.description || '从视频生成'}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setPreviewPoses({ name: level.name, poses: level.templates }); setPreviewIndex(0) }}
                            className="p-1.5 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-500/20 transition-all"
                            title="预览动作"
                          >
                            <Search size={16} />
                          </button>
                        </div>
                      </button>
                      <div className="flex items-center justify-between text-xs">
                        <span className="badge badge-local">
                          {level.templates.length}帧
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-white/40 flex items-center gap-1">
                            <Clock size={10} />
                            {totalDur.toFixed(1)}s
                          </span>
                          <button
                            onClick={(e) => handleDeleteLocalLevel(e, level.id)}
                            disabled={isDeleting}
                            className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                            title="删除"
                          >
                            {isDeleting ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Trash2 size={12} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {filteredRhythmLevels.map((level) => {
                  const isForked = forkedPresetIds.has(level.id)
                  const isForking = forkingPresetId === level.id
                  return (
                  <div
                    key={`${level.id}-${level.name}`}
                    className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-400/30 transition-all group"
                  >
                    <div
                      onClick={() => startRhythmLevel(level)}
                      className="w-full text-left cursor-pointer"
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-14 h-14 flex items-center justify-center bg-black/30 rounded-xl flex-shrink-0">
                          {level.templates[0] ? (
                            <PoseFigure template={level.templates[0]} size={56} />
                          ) : (
                            <span className="text-2xl">{level.icon || '🎬'}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold mb-0.5">{level.name}</h3>
                          <p className="text-white/50 text-xs line-clamp-2">{level.desc}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewPoses({ name: level.name, poses: level.templates }); setPreviewIndex(0) }}
                          className="p-1.5 rounded-lg text-white/30 hover:text-emerald-400 hover:bg-emerald-500/20 transition-all"
                          title="预览动作"
                        >
                          <Search size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full',
                        level.tag === '八段锦' && 'bg-amber-500/20 text-amber-400',
                        level.tag === '晨间' && 'bg-orange-500/20 text-orange-400',
                        level.tag === '办公室' && 'bg-blue-500/20 text-blue-400',
                        level.tag === '肩颈' && 'bg-pink-500/20 text-pink-400',
                        level.tag === '手臂' && 'bg-purple-500/20 text-purple-400',
                        level.tag === '瑜伽' && 'bg-emerald-500/20 text-emerald-400',
                        level.tag === '热身' && 'bg-red-500/20 text-red-400',
                        level.tag === '综合' && 'bg-cyan-500/20 text-cyan-400',
                      )}>
                        {level.tag}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-white/40 flex items-center gap-1">
                          <Clock size={10} />
                          {level.templates.length}动作 · {Math.round(level.templates.length * perPoseSec / 60)}分钟
                        </span>
                        {isLoggedIn && (
                          <button
                            onClick={(e) => handleForkPreset(e, level.id)}
                            disabled={isForking || isForked}
                            className={cn(
                              'p-1 rounded transition-all disabled:opacity-50',
                              isForked
                                ? 'text-emerald-400'
                                : 'text-white/30 hover:text-emerald-400 hover:bg-emerald-500/20'
                            )}
                            title={isForked ? '已 Fork' : 'Fork 到我的关卡'}
                          >
                            {isForking ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : isForked ? (
                              <CheckCircle2 size={12} />
                            ) : (
                              <GitFork size={12} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  )
                })}

                {/* 收藏关卡卡片（仅「收藏」tag 下显示） */}
                {showFavoriteLevels && (
                  <>
                    {favoriteLevelsByMode.rhythm.length > 0
                      ? favoriteLevelsByMode.rhythm.map((c) => renderFavoriteLevelCard(c, 'rhythm'))
                      : renderFavoriteEmpty()}
                  </>
                )}
              </div>
            </>
          )}

          {/* ========== 跟练模式 ========== */}
          {activeTab === 'follow' && (
            <>
              <div className="mb-4 flex items-center justify-center gap-2 text-sm">
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">Beta</span>
                <span className="text-white/50 text-xs">跟练模式为Beta功能，暂不稳定，建议登录后体验</span>
              </div>

              {/* 跟练模式 tag 栏（仅「全部」和「收藏」） */}
              <div className="mb-4 flex items-center justify-center gap-2 flex-wrap">
                {followTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(tag)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                      activeTag === tag
                        ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mx-auto">
              {/* 上传视频生成（收藏 tag 下隐藏） */}
              {!showFavoriteLevels && (
              <button
                onClick={() => navigate('/import?target=follow')}
                className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-400/30 transition-all group text-left"
              >
                <div className="flex items-start gap-3 mb-2">
                  <div className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-cyan-600/20 rounded-xl flex-shrink-0">
                    <Upload size={28} className="text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-0.5">上传视频生成</h3>
                    <p className="text-white/50 text-xs">最高30fps采样，按视频原节奏推进</p>
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
              )}

              {/* 用户自定义跟练关卡（混入展示，带「自定义」徽章） */}
              {showUserLevels && userLevelsByMode.follow.map((level) => {
                const totalDur = level.total_duration || level.templates.reduce(
                  (sum, t) => sum + (t.sourceDuration ?? t.duration ?? 0), 0
                )
                const isDeleting = deletingLevelId === level.id
                return (
                  <div
                    key={`user-${level.id}`}
                    className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-emerald-400/30 hover:border-emerald-400/60 transition-all group"
                  >
                    <div
                      onClick={() => startUserLevel(level)}
                      className="w-full text-left cursor-pointer"
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-14 h-14 flex items-center justify-center bg-black/30 rounded-xl flex-shrink-0 overflow-hidden">
                          {level.templates[0] ? (
                            <PoseFigure template={level.templates[0]} size={56} />
                          ) : (
                            <Film size={28} className="text-white/40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <h3 className="font-semibold truncate">{level.name}</h3>
                            <span className="badge badge-custom">
                              自定义
                            </span>
                          </div>
                          <p className="text-white/50 text-xs line-clamp-2">{level.description || '从视频生成'}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewPoses({ name: level.name, poses: level.templates }); setPreviewIndex(0) }}
                          className="p-1.5 rounded-lg text-white/30 hover:text-emerald-400 hover:bg-emerald-500/20 transition-all"
                          title="预览动作"
                        >
                          <Search size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="badge badge-custom">
                        {level.templates.length}帧
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-white/40 flex items-center gap-1">
                          <Clock size={10} />
                          {totalDur.toFixed(1)}s
                        </span>
                        <button
                          onClick={(e) => handleDeleteLevel(e, level.id)}
                          disabled={isDeleting}
                          className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                          title="删除"
                        >
                          {isDeleting ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* 本地跟练关卡卡片 */}
              {showUserLevels && localLevelsByMode.follow.map((level) => {
                const totalDur = level.total_duration || level.templates.reduce(
                  (sum, t) => sum + (t.sourceDuration ?? t.duration ?? 0), 0
                )
                const isDeleting = deletingLocalId === level.id
                return (
                  <div
                    key={`local-${level.id}`}
                    className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-amber-400/30 hover:border-amber-400/60 transition-all group"
                  >
                    <div
                      onClick={() => startLocalLevel(level)}
                      className="w-full text-left cursor-pointer"
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-14 h-14 flex items-center justify-center bg-black/30 rounded-xl flex-shrink-0 overflow-hidden">
                          {level.templates[0] ? (
                            <PoseFigure template={level.templates[0]} size={56} />
                          ) : (
                            <Film size={28} className="text-white/40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <h3 className="font-semibold truncate">{level.name}</h3>
                            <span className="badge badge-local">
                              <HardDrive size={8} />本地
                            </span>
                          </div>
                          <p className="text-white/50 text-xs line-clamp-2">{level.description || '从视频生成'}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewPoses({ name: level.name, poses: level.templates }); setPreviewIndex(0) }}
                          className="p-1.5 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-500/20 transition-all"
                          title="预览动作"
                        >
                          <Search size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="badge badge-local">
                        {level.templates.length}帧
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-white/40 flex items-center gap-1">
                          <Clock size={10} />
                          {totalDur.toFixed(1)}s
                        </span>
                        <button
                          onClick={(e) => handleDeleteLocalLevel(e, level.id)}
                          disabled={isDeleting}
                          className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                          title="删除"
                        >
                          {isDeleting ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Trash2 size={12} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* 收藏关卡卡片（仅「收藏」tag 下显示） */}
              {showFavoriteLevels && (
                <>
                  {favoriteLevelsByMode.follow.length > 0
                    ? favoriteLevelsByMode.follow.map((c) => renderFavoriteLevelCard(c, 'follow'))
                    : renderFavoriteEmpty()}
                </>
              )}
            </div>
            </>
          )}

          {loading && (
            <div className="text-center py-12 text-white/40">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-3"></div>
              加载中...
            </div>
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

      {/* 单人模式指南弹窗 */}
      <ModeGuideModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title="单人模式指南"
        emoji="🎮"
        subtitle="闯关 · 节拍 · 跟练，三种玩法操作说明"
        sections={guideSections}
      />
    </div>
  )
}
