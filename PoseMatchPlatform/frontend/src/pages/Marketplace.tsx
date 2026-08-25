import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, Download, Clock, Film, User, Loader2, ChevronLeft, ChevronRight, Search, X, HardDrive, Cloud, CheckCircle2, Gamepad2, Clapperboard, Users, Heart, Play, GitFork } from 'lucide-react'
import FloatingNav from '@/components/FloatingNav'
import GameBackground from '@/components/GameBackground'
import PoseFigure from '@/components/PoseFigure'
import { useUserStore } from '@/store/userStore'
import { saveLocalLevel, saveLocalPoses } from '@/utils/localLevelStorage'
import { fetchTemplatesByIds } from '@/utils/poseTemplateService'
import type { PoseTemplate } from '@/utils/poseMatcher'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 12

type TabMode = 'all' | 'challenge' | 'rhythm' | 'follow' | 'pose'

/** 统一的市场列表项（闯关/节拍关卡、跟练关卡、动作） */
interface MarketItem {
  id: number
  name: string
  description: string
  /** 'custom_level' = 闯关/节拍关卡, 'follow_level' = 跟练关卡, 'pose' = 动作 */
  kind: 'custom_level' | 'follow_level' | 'pose'
  target_mode: string
  input_mode?: string
  frame_count: number
  fps?: number | null
  total_duration: number
  play_count: number
  favorite_count: number
  author_nickname: string
  is_favorited: boolean
  created_at: string
  forked_from?: number | null
  /** 动作专属：原始 PoseTemplate 数据 */
  template?: PoseTemplate
  category?: string
  difficulty?: number
  icon?: string
  duration?: number
}

/** 预览弹窗详情 */
interface PreviewDetail {
  item: MarketItem
  templates: PoseTemplate[]
  video_path: string | null
  bone_video_path: string | null
  fps: number | null
  total_duration: number
  source_duration_sec: number | null
  source_resolution: string | null
  input_mode: string
  frame_count: number
}

const TAB_CONFIG: { value: TabMode; label: string; icon: typeof Store }[] = [
  { value: 'all', label: '全部', icon: Store },
  { value: 'challenge', label: '闯关', icon: Gamepad2 },
  { value: 'rhythm', label: '节拍', icon: Clapperboard },
  { value: 'follow', label: '跟练', icon: Users },
  { value: 'pose', label: '动作', icon: Film },
]

// ============ API 响应 → 统一 MarketItem 转换 ============

function levelToItem(c: any): MarketItem {
  return {
    id: c.id,
    name: c.name,
    description: c.description || '',
    kind: 'custom_level',
    target_mode: c.target_mode,
    input_mode: c.input_mode,
    frame_count: c.frame_count || 0,
    fps: null,
    total_duration: c.total_duration || 0,
    play_count: c.play_count || 0,
    favorite_count: c.favorite_count || 0,
    author_nickname: c.author_nickname || '匿名作者',
    is_favorited: c.is_favorited || false,
    created_at: c.created_at || '',
    forked_from: c.forked_from,
  }
}

function followToItem(f: any): MarketItem {
  return {
    id: f.id,
    name: f.name,
    description: f.description || '',
    kind: 'follow_level',
    target_mode: 'follow',
    input_mode: f.input_mode,
    frame_count: f.frame_count || 0,
    fps: f.fps ?? null,
    total_duration: f.total_duration || 0,
    play_count: f.play_count || 0,
    favorite_count: f.favorite_count || 0,
    author_nickname: f.author_nickname || '匿名作者',
    is_favorited: f.is_favorited || false,
    created_at: f.created_at || '',
    forked_from: f.forked_from,
  }
}

function poseToItem(p: any): MarketItem {
  const author = p.author_nickname || (p.created_by ? `用户${p.created_by}` : '系统预设')
  return {
    id: Number(p.id),
    name: p.name,
    description: p.description || '',
    kind: 'pose',
    target_mode: 'pose',
    input_mode: 'image',
    frame_count: 1,
    fps: null,
    total_duration: p.duration || 0,
    play_count: 0,
    favorite_count: 0,
    author_nickname: author,
    is_favorited: false,
    created_at: p.created_at || '',
    forked_from: p.forked_from,
    template: p as PoseTemplate,
    category: p.category,
    difficulty: p.difficulty,
    icon: p.icon,
    duration: p.duration,
  }
}

export default function Marketplace() {
  const navigate = useNavigate()
  const { user, isLoggedIn } = useUserStore()
  const [items, setItems] = useState<MarketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pageLoading, setPageLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<TabMode>('all')
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [previewDetail, setPreviewDetail] = useState<PreviewDetail | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [forking, setForking] = useState(false)
  const [forkTarget, setForkTarget] = useState<'local' | 'cloud'>(isLoggedIn ? 'cloud' : 'local')
  const [forkedIds, setForkedIds] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState('')
  const [favToggling, setFavToggling] = useState<number | null>(null)
  /** 动作列表缓存（/api/pose-templates?public=true 返回全量，前端分页/搜索） */
  const posesCacheRef = useRef<PoseTemplate[] | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  // 切换 tab 重置到第 1 页
  useEffect(() => {
    setPage(1)
  }, [tab])

  // 搜索防抖
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedKeyword(keyword)
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [keyword])

  // 加载列表数据
  useEffect(() => {
    const fetchData = async (isFirst: boolean) => {
      if (isFirst) setLoading(true)
      else setPageLoading(true)
      try {
        const offset = (page - 1) * PAGE_SIZE
        const userIdParam = user?.id ? `&user_id=${user.id}` : ''
        const keywordParam = debouncedKeyword.trim()
          ? `&keyword=${encodeURIComponent(debouncedKeyword.trim())}`
          : ''

        if (tab === 'pose') {
          // 动作 tab：全量拉取 + 前端分页/搜索
          if (!posesCacheRef.current) {
            const res = await fetch('/api/pose-templates?public=true')
            const data = await res.json()
            posesCacheRef.current = Array.isArray(data) ? data : []
          }
          const kw = debouncedKeyword.trim().toLowerCase()
          const filtered = (posesCacheRef.current || []).filter(
            (p) =>
              !kw ||
              p.name.toLowerCase().includes(kw) ||
              (p.description || '').toLowerCase().includes(kw)
          )
          setTotal(filtered.length)
          setItems(filtered.slice(offset, offset + PAGE_SIZE).map(poseToItem))
        } else if (tab === 'all') {
          // 全部 tab：同时拉取闯关/节拍 + 跟练，合并按时间排序
          const [rhythmRes, followRes] = await Promise.all([
            fetch(
              `/api/custom-levels?is_public=true&limit=${PAGE_SIZE}&offset=${offset}${keywordParam}${userIdParam}`
            ),
            fetch(
              `/api/follow-levels?is_public=true&limit=${PAGE_SIZE}&offset=${offset}${keywordParam}${userIdParam}`
            ),
          ])
          const [rhythmData, followData] = await Promise.all([
            rhythmRes.json(),
            followRes.json(),
          ])
          const rhythmItems = (rhythmData.items || []).map(levelToItem)
          const followItems = (followData.items || []).map(followToItem)
          const merged = [...rhythmItems, ...followItems].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          setItems(merged)
          setTotal((rhythmData.total || 0) + (followData.total || 0))
        } else if (tab === 'challenge' || tab === 'rhythm') {
          // 闯关/节拍 tab
          const res = await fetch(
            `/api/custom-levels?is_public=true&target_mode=${tab}&limit=${PAGE_SIZE}&offset=${offset}${keywordParam}${userIdParam}`
          )
          const data = await res.json()
          setItems((data.items || []).map(levelToItem))
          setTotal(data.total || 0)
        } else if (tab === 'follow') {
          // 跟练 tab
          const res = await fetch(
            `/api/follow-levels?is_public=true&limit=${PAGE_SIZE}&offset=${offset}${keywordParam}${userIdParam}`
          )
          const data = await res.json()
          setItems((data.items || []).map(followToItem))
          setTotal(data.total || 0)
        }
      } catch (e) {
        console.error('Failed to fetch marketplace:', e)
        setItems([])
        setTotal(0)
      } finally {
        setLoading(false)
        setPageLoading(false)
      }
    }
    fetchData(page === 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, debouncedKeyword, user?.id])

  const goPage = useCallback(
    (p: number) => {
      setPage(Math.max(1, Math.min(totalPages, p)))
    },
    [totalPages]
  )

  // 预览（拉取详情）
  const handlePreview = async (item: MarketItem) => {
    // 动作：列表项已含完整 template，无需请求详情
    if (item.kind === 'pose') {
      if (!item.template) {
        showToast('动作数据缺失')
        return
      }
      setPreviewDetail({
        item,
        templates: [item.template],
        video_path: null,
        bone_video_path: null,
        fps: null,
        total_duration: item.duration || 0,
        source_duration_sec: null,
        source_resolution: null,
        input_mode: 'image',
        frame_count: 1,
      })
      setPreviewIndex(0)
      setForkTarget(isLoggedIn ? 'cloud' : 'local')
      return
    }

    // 闯关/节拍/跟练：请求详情接口
    try {
      const userIdParam = user?.id ? `?user_id=${user.id}` : ''
      const endpoint =
        item.kind === 'custom_level'
          ? `/api/custom-levels/${item.id}${userIdParam}`
          : `/api/follow-levels/${item.id}${userIdParam}`
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error('加载失败')
      const data = await res.json()

      let templates: PoseTemplate[] = []
      if (item.kind === 'custom_level') {
        // 闯关/节拍两级存储：pose_ids → templates 解析
        if (data.pose_ids?.length) {
          templates = await fetchTemplatesByIds(data.pose_ids)
        }
      } else {
        // 跟练已内嵌 templates
        templates = data.templates || []
      }

      setPreviewDetail({
        item: {
          ...item,
          is_favorited: data.is_favorited ?? item.is_favorited,
          play_count: data.play_count ?? item.play_count,
          favorite_count: data.favorite_count ?? item.favorite_count,
        },
        templates,
        video_path: data.video_path || null,
        bone_video_path: data.bone_video_path || null,
        fps: data.fps ?? null,
        total_duration: data.total_duration || 0,
        source_duration_sec: data.source_duration_sec ?? null,
        source_resolution: data.source_resolution ?? null,
        input_mode: data.input_mode || 'video',
        frame_count: data.frame_count || 0,
      })
      setPreviewIndex(0)
      // 跟练含视频，不支持本地 Fork
      const canLocal = item.kind === 'custom_level'
      setForkTarget(canLocal ? (isLoggedIn ? 'cloud' : 'local') : 'cloud')
    } catch (e) {
      showToast('加载详情失败')
    }
  }

  // Fork 到本地 / 云端
  const handleFork = async () => {
    if (!previewDetail || forking) return
    const { item, templates } = previewDetail
    setForking(true)
    try {
      if (forkTarget === 'local') {
        if (item.kind === 'custom_level') {
          // 闯关/节拍：两级存储 —— 动作写入 poses store，关卡存 pose_ids
          if (!templates.length) {
            showToast('动作数据缺失，无法保存')
            return
          }
          const pose_ids = await saveLocalPoses(templates)
          await saveLocalLevel({
            name: item.name,
            description: item.description,
            target_mode: item.target_mode as 'challenge' | 'rhythm',
            input_mode: (previewDetail.input_mode || 'video') as 'video' | 'image',
            pose_ids,
            templates: [],
            frame_count: previewDetail.frame_count,
            fps: previewDetail.fps,
            total_duration: previewDetail.total_duration,
            source_duration_sec: previewDetail.source_duration_sec,
            source_resolution: previewDetail.source_resolution,
          })
          showToast('已 Fork 到本地课程')
        } else if (item.kind === 'pose') {
          // 动作：保存到本地 poses store
          if (!item.template) {
            showToast('动作数据缺失')
            return
          }
          await saveLocalPoses([item.template])
          showToast('已 Fork 到本地动作库')
        } else {
          // 跟练含视频，不支持本地 Fork
          showToast('跟练课程不支持本地 Fork')
          return
        }
      } else {
        // 云端 Fork：调用 fork API（占配额）
        if (!isLoggedIn || !user?.id) {
          showToast('请先登录')
          return
        }
        const endpoint =
          item.kind === 'custom_level'
            ? `/api/custom-levels/${item.id}/fork`
            : item.kind === 'follow_level'
              ? `/api/follow-levels/${item.id}/fork`
              : `/api/pose-templates/${item.id}/fork`
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.detail || 'Fork 失败')
        }
        showToast(item.kind === 'pose' ? '已 Fork 到我的动作' : '已 Fork 到我的课程')
      }
      setForkedIds((prev) => new Set(prev).add(item.id))
      setPreviewDetail(null)
    } catch (e: any) {
      showToast(e.message || 'Fork 失败')
    } finally {
      setForking(false)
    }
  }

  // 收藏 / 取消收藏（统一收藏 API）
  const handleToggleFavorite = async (item: MarketItem) => {
    if (!isLoggedIn || !user?.id) {
      showToast('请先登录后收藏')
      return
    }
    if (favToggling !== null) return
    setFavToggling(item.id)
    try {
      const isFav = item.is_favorited
      const method = isFav ? 'DELETE' : 'POST'
      const res = await fetch(`/api/favorites?user_id=${user.id}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: item.kind,
          target_id: item.id,
        }),
      })
      if (!res.ok) throw new Error('操作失败')

      const newFav = !isFav
      const newCount = isFav
        ? Math.max(0, item.favorite_count - 1)
        : item.favorite_count + 1

      // 更新列表
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id && it.kind === item.kind
            ? { ...it, is_favorited: newFav, favorite_count: newCount }
            : it
        )
      )
      // 更新预览
      if (previewDetail?.item.id === item.id && previewDetail?.item.kind === item.kind) {
        setPreviewDetail((d) =>
          d
            ? {
                ...d,
                item: { ...d.item, is_favorited: newFav, favorite_count: newCount },
              }
            : d
        )
      }
    } catch (e: any) {
      showToast(e.message || '操作失败')
    } finally {
      setFavToggling(null)
    }
  }

  // 直接开玩
  const handlePlay = async () => {
    if (!previewDetail) return
    if (!previewDetail.templates.length) {
      showToast('动作数据缺失')
      return
    }
    const { item } = previewDetail
    // 记录播放（动作无播放接口）
    if (item.kind === 'custom_level') {
      fetch(`/api/custom-levels/${item.id}/play`, { method: 'POST' }).catch(() => {})
    } else if (item.kind === 'follow_level') {
      fetch(`/api/follow-levels/${item.id}/play`, { method: 'POST' }).catch(() => {})
    }
    const videoUrl = previewDetail.video_path
      ? `/videos/${previewDetail.video_path}`
      : undefined
    const boneVideoUrl = previewDetail.bone_video_path
      ? `/videos/${previewDetail.bone_video_path}`
      : undefined
    navigate('/play', {
      state: {
        templates: previewDetail.templates,
        name: item.name,
        // 动作以 challenge 模式开玩（单帧挑战）
        mode: item.target_mode === 'pose' ? 'challenge' : item.target_mode,
        videoUrl,
        boneVideoUrl,
      },
    })
  }

  const modeLabel = (m: string) => {
    if (m === 'challenge') return '闯关'
    if (m === 'rhythm') return '节拍'
    if (m === 'follow') return '跟练'
    if (m === 'pose') return '动作'
    return m
  }

  const modeColor = (m: string) => {
    if (m === 'challenge') return 'bg-emerald-500/20 text-emerald-400'
    if (m === 'rhythm') return 'bg-purple-500/20 text-purple-400'
    if (m === 'follow') return 'bg-emerald-500/20 text-emerald-400'
    return 'bg-amber-500/20 text-amber-400'
  }

  // 跟练含视频不支持本地 Fork；未登录 + 跟练 = 无法 Fork
  const canForkLocal = previewDetail
    ? previewDetail.item.kind === 'custom_level' || previewDetail.item.kind === 'pose'
    : false
  const canFork = previewDetail
    ? previewDetail.item.kind === 'follow_level'
      ? isLoggedIn
      : true
    : false

  return (
    <div className="min-h-screen text-white">
      <GameBackground />
      <FloatingNav title="关卡市场" subtitle="浏览社区作品，收藏或直接开玩" />

      <main className="pt-20 pb-12 px-4">
        <div className="w-full">
          {/* 顶部说明 */}
          <div className="mb-6 flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30">
            <Store className="text-cyan-400 flex-shrink-0" size={24} />
            <div className="text-sm text-white/70">
              浏览社区玩家发布的关卡与动作，点击卡片预览，可收藏、直接开玩，或 Fork 到本地/云端
            </div>
          </div>

          {/* 模式 tab + 搜索 */}
          <div className="mb-6 flex items-center justify-center gap-3 flex-wrap">
            <div className="flex gap-2 flex-wrap justify-center">
              {TAB_CONFIG.map((t) => {
                const Icon = t.icon
                return (
                  <button
                    key={t.value}
                    onClick={() => setTab(t.value)}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                      tab === t.value
                        ? 'bg-white text-slate-900'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    )}
                  >
                    <Icon size={16} />
                    {t.label}
                  </button>
                )
              })}
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索名称/描述"
                className="pl-9 pr-3 py-2 rounded-xl bg-white/10 border border-white/15 text-sm text-white placeholder-white/40 focus:ring-2 focus:ring-cyan-500/50 focus:outline-none w-44"
              />
            </div>
          </div>

          {/* 列表 */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/50">
              <Loader2 size={32} className="animate-spin mb-3" />
              加载中...
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">{tab === 'pose' ? '🧘' : '📦'}</div>
              <p className="text-white/60 mb-2">
                {tab === 'pose' ? '还没有公开动作' : '社区还没有作品'}
              </p>
              <p className="text-white/40 text-sm mb-6">
                {tab === 'pose'
                  ? '去「动作管理」发布你的第一个动作吧'
                  : '去「我的课程」发布你的第一个作品吧'}
              </p>
              <button
                onClick={() => navigate(tab === 'pose' ? '/poses' : '/my-levels')}
                className="px-6 py-3 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl font-medium hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
              >
                {tab === 'pose' ? '前往动作管理' : '前往我的课程'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {items.map((item) => (
                <div
                  key={`${item.kind}-${item.id}`}
                  className="text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/40 transition-all group"
                >
                  <button
                    onClick={() => handlePreview(item)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      {item.kind === 'pose' && item.template ? (
                        <div className="w-14 h-14 flex items-center justify-center bg-black/30 rounded-xl flex-shrink-0">
                          <PoseFigure template={item.template} size={52} />
                        </div>
                      ) : (
                        <div className="w-14 h-14 flex items-center justify-center bg-black/30 rounded-xl flex-shrink-0">
                          {item.target_mode === 'challenge' ? (
                            <Gamepad2 size={28} className="text-white/40 group-hover:text-cyan-400 transition-colors" />
                          ) : item.target_mode === 'rhythm' ? (
                            <Clapperboard size={28} className="text-white/40 group-hover:text-cyan-400 transition-colors" />
                          ) : (
                            <Users size={28} className="text-white/40 group-hover:text-cyan-400 transition-colors" />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{item.name}</h3>
                        <p className="text-white/50 text-xs line-clamp-2">
                          {item.description || '社区作品'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('px-2 py-0.5 rounded-full', modeColor(item.target_mode))}>
                          {modeLabel(item.target_mode)}
                        </span>
                        {item.kind === 'pose' ? (
                          <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/50">
                            难度{item.difficulty || 1}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/50">
                            {item.frame_count}帧
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-white/40">
                        <span className="flex items-center gap-0.5">
                          <User size={10} />
                          {item.author_nickname}
                        </span>
                      </div>
                    </div>
                  </button>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-white/40">
                      {item.kind !== 'pose' ? (
                        <>
                          <span className="flex items-center gap-0.5">
                            <Play size={10} />
                            {item.play_count}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Heart size={10} />
                            {item.favorite_count}
                          </span>
                        </>
                      ) : (
                        <span className="flex items-center gap-0.5">
                          <Clock size={10} />
                          {item.duration || 5}s
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleFavorite(item)}
                      disabled={favToggling === item.id}
                      title={isLoggedIn ? '收藏' : '登录后可收藏'}
                      className={cn(
                        'p-1.5 rounded-lg transition-all',
                        isLoggedIn
                          ? 'text-white/40 hover:text-rose-400 hover:bg-rose-500/20'
                          : 'text-white/20 cursor-not-allowed'
                      )}
                    >
                      <Heart
                        size={14}
                        fill={item.is_favorited ? 'currentColor' : 'none'}
                        className={item.is_favorited ? 'text-rose-400' : ''}
                      />
                    </button>
                  </div>
                  {forkedIds.has(item.id) && (
                    <div className="mt-2 flex items-center gap-1 text-emerald-400 text-xs">
                      <CheckCircle2 size={12} />
                      已 Fork
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 分页 */}
          {!loading && items.length > 0 && (
            <div className="mt-8 flex flex-col items-center gap-3">
              {pageLoading && (
                <div className="flex items-center gap-2 text-white/50 text-sm">
                  <Loader2 size={14} className="animate-spin" />
                  加载中...
                </div>
              )}
              {totalPages > 1 && (
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <button
                    onClick={() => goPage(page - 1)}
                    disabled={page <= 1 || pageLoading}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                  >
                    <ChevronLeft size={16} />
                    上一页
                  </button>
                  <div className="flex items-center gap-1">
                    {/* 页码省略逻辑：首页 + 当前页前后 + 末页 */}
                    {(() => {
                      const pages: (number | 'ellipsis')[] = []
                      const add = (p: number) => { if (!pages.includes(p)) pages.push(p) }
                      add(1)
                      if (page - 2 > 2) pages.push('ellipsis')
                      for (let p = Math.max(2, page - 2); p <= Math.min(totalPages - 1, page + 2); p++) add(p)
                      if (page + 2 < totalPages - 1) pages.push('ellipsis')
                      if (totalPages > 1) add(totalPages)
                      return pages.map((p, i) =>
                        p === 'ellipsis' ? (
                          <span key={`e-${i}`} className="w-9 h-9 flex items-center justify-center text-white/40 text-sm">···</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => goPage(p)}
                            disabled={pageLoading}
                            className={cn(
                              'w-9 h-9 rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed',
                              page === p
                                ? 'bg-white text-slate-900'
                                : 'bg-white/10 text-white/70 hover:bg-white/20'
                            )}
                          >
                            {p}
                          </button>
                        )
                      )
                    })()}
                  </div>
                  <button
                    onClick={() => goPage(page + 1)}
                    disabled={page >= totalPages || pageLoading}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                  >
                    下一页
                    <ChevronRight size={16} />
                  </button>
                  {/* 手动输入跳转 */}
                  {totalPages > 7 && (
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-white/50 text-xs">跳至</span>
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        placeholder={String(page)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const v = parseInt((e.target as HTMLInputElement).value)
                            if (!isNaN(v)) goPage(v)
                            ;(e.target as HTMLInputElement).value = ''
                          }
                        }}
                        className="w-16 px-2 py-1.5 rounded-lg bg-white/10 border border-white/15 text-sm text-white text-center placeholder-white/30 focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                      />
                      <span className="text-white/50 text-xs">页</span>
                    </div>
                  )}
                </div>
              )}
              <div className="text-white/40 text-xs">
                第 {page} / {totalPages} 页 · 共 {total} 个{tab === 'pose' ? '动作' : '作品'}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 预览弹窗 */}
      {previewDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setPreviewDetail(null)}
        >
          <div
            className="glass rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="min-w-0">
                <h2 className="text-lg font-bold truncate">{previewDetail.item.name}</h2>
                <div className="flex items-center gap-2 mt-1 text-xs text-white/50 flex-wrap">
                  <span className={cn('px-2 py-0.5 rounded-full', modeColor(previewDetail.item.target_mode))}>
                    {modeLabel(previewDetail.item.target_mode)}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <User size={10} />
                    {previewDetail.item.author_nickname}
                  </span>
                  {previewDetail.item.kind !== 'pose' ? (
                    <>
                      <span className="flex items-center gap-0.5">
                        <Play size={10} />
                        {previewDetail.item.play_count}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Heart size={10} />
                        {previewDetail.item.favorite_count}
                      </span>
                    </>
                  ) : (
                    previewDetail.item.difficulty != null && (
                      <span className="px-2 py-0.5 rounded-full bg-white/10">
                        难度 {previewDetail.item.difficulty}
                      </span>
                    )
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* 收藏数显示（收藏操作在底部按钮区） */}
                <span className="flex items-center gap-1 text-white/40 text-xs mr-1">
                  <Heart size={12} fill={previewDetail.item.is_favorited ? 'currentColor' : 'none'} className={previewDetail.item.is_favorited ? 'text-rose-400' : ''} />
                  {previewDetail.item.favorite_count}
                </span>
                <button
                  onClick={() => setPreviewDetail(null)}
                  className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <p className="text-white/60 text-sm mb-4">
              {previewDetail.item.description || '社区作品'}
            </p>

            {/* 动作预览 */}
            {previewDetail.templates.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-center mb-3">
                  <div className="w-56 h-56 flex items-center justify-center bg-black/30 rounded-2xl">
                    <PoseFigure template={previewDetail.templates[previewIndex]} size={220} />
                  </div>
                </div>
                <div className="text-center mb-3">
                  <p className="text-white/80 font-medium text-sm">
                    {previewDetail.templates[previewIndex].name}
                  </p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {previewIndex + 1} / {previewDetail.templates.length}
                    {previewDetail.item.kind !== 'pose' && (
                      <>
                        {' · 共 '}
                        {previewDetail.frame_count}
                        {'帧'}
                        {previewDetail.fps ? ` · ${previewDetail.fps}fps` : ''}
                      </>
                    )}
                  </p>
                </div>
                {previewDetail.templates.length > 1 && (
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                      disabled={previewIndex === 0}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <div className="flex gap-1.5 overflow-x-auto max-w-[240px] py-1">
                      {previewDetail.templates.map((_, i) => (
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
                      onClick={() =>
                        setPreviewIndex((i) =>
                          Math.min(previewDetail.templates.length - 1, i + 1)
                        )
                      }
                      disabled={previewIndex === previewDetail.templates.length - 1}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 元信息 */}
            <div className="flex items-center gap-4 text-xs text-white/50 mb-5">
              {previewDetail.item.kind === 'pose' ? (
                <>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {previewDetail.total_duration}s
                  </span>
                  {previewDetail.item.category && (
                    <span className="px-2 py-0.5 rounded-full bg-white/10">
                      {previewDetail.item.category}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {previewDetail.total_duration}s
                  </span>
                  <span className="flex items-center gap-1">
                    <Film size={12} />
                    {previewDetail.frame_count}帧
                  </span>
                </>
              )}
            </div>

            {/* 直接开玩按钮 */}
            <button
              onClick={handlePlay}
              disabled={!previewDetail.templates.length}
              className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 hover:shadow-lg hover:shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={18} />
              直接开玩
            </button>

            {/* 收藏按钮 */}
            <button
              onClick={() => handleToggleFavorite(previewDetail.item)}
              disabled={favToggling === previewDetail.item.id || !isLoggedIn}
              className={cn(
                'w-full py-2.5 rounded-xl font-medium border transition-all flex items-center justify-center gap-2 mb-2 disabled:opacity-50 disabled:cursor-not-allowed',
                previewDetail.item.is_favorited
                  ? 'bg-rose-500/20 text-rose-400 border-rose-400/50'
                  : 'bg-white/5 text-white/70 border-white/15 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-400/40'
              )}
            >
              {favToggling === previewDetail.item.id ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Heart size={16} fill={previewDetail.item.is_favorited ? 'currentColor' : 'none'} />
              )}
              {previewDetail.item.is_favorited ? '已收藏' : '收藏'}
            </button>
            <p className="text-[11px] text-white/40 mb-4 text-center">
              {isLoggedIn
                ? previewDetail.item.is_favorited
                  ? '已收藏，可在「我的收藏」中随时找到，作者下架也能继续玩'
                  : '收藏后可在「我的收藏」中随时找到，作者下架也能继续玩'
                : '登录后可收藏，作者下架后已收藏用户仍可游玩'}
            </p>

            {/* Fork 目标选择 */}
            <div className="mb-4">
              <p className="text-xs text-white/50 mb-2">或 Fork 到</p>
              <div className="flex gap-2">
                <button
                  onClick={() => canForkLocal && setForkTarget('local')}
                  disabled={!canForkLocal}
                  title={
                    canForkLocal
                      ? '保存到浏览器本地，无需登录'
                      : '跟练含视频，不支持本地 Fork'
                  }
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all border',
                    forkTarget === 'local'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-400/50'
                      : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10',
                    !canForkLocal && 'opacity-30 cursor-not-allowed'
                  )}
                >
                  <HardDrive size={14} />
                  本地（浏览器）
                </button>
                {isLoggedIn && (
                  <button
                    onClick={() => setForkTarget('cloud')}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all border',
                      forkTarget === 'cloud'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-400/50'
                        : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                    )}
                  >
                    <Cloud size={14} />
                    云端（私有）
                  </button>
                )}
              </div>
              {!canForkLocal && (
                <p className="text-[11px] text-white/40 mt-1.5">
                  跟练课程含视频数据，需登录后 Fork 到云端
                </p>
              )}
              {canForkLocal && !isLoggedIn && (
                <p className="text-[11px] text-white/40 mt-1.5">
                  登录后可 Fork 到云端跨设备同步
                </p>
              )}
            </div>

            {/* Fork 按钮 */}
            <button
              onClick={handleFork}
              disabled={forking || !canFork}
              className="w-full py-3 rounded-xl font-bold bg-white/10 hover:bg-white/20 border border-white/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {forking ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Fork 中...
                </>
              ) : !canFork ? (
                <>
                  <Cloud size={18} />
                  需登录后 Fork 跟练课程
                </>
              ) : (
                <>
                  <GitFork size={18} />
                  Fork 到{forkTarget === 'local' ? '本地' : '云端'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-white/20 text-sm text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  )
}
