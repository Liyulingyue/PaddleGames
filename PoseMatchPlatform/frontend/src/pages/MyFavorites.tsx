import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Film, User, Play, Loader2, X, ChevronLeft, ChevronRight, AlertCircle, Gamepad2, Clapperboard, Users, PersonStanding } from 'lucide-react'
import FloatingNav from '@/components/FloatingNav'
import GameBackground from '@/components/GameBackground'
import PoseFigure from '@/components/PoseFigure'
import { useUserStore } from '@/store/userStore'
import { fetchTemplatesByIds } from '@/utils/poseTemplateService'
import type { PoseTemplate } from '@/utils/poseMatcher'
import { cn } from '@/lib/utils'

type TabMode = 'all' | 'challenge' | 'rhythm' | 'follow' | 'pose'

interface FavoriteItem {
  id: number
  name: string
  description: string
  target_type: 'pose' | 'custom_level' | 'follow_level'
  target_mode?: string  // custom_level 类型有
  input_mode?: string
  frame_count?: number
  fps?: number | null
  total_duration?: number
  play_count?: number
  favorite_count?: number
  category?: string  // pose 类型有
  difficulty?: number  // pose 类型有
  icon?: string  // pose 类型有
  is_public: boolean
  author_nickname: string
  type_label: string
  favorited_at: string
}

interface FavoriteDetail extends FavoriteItem {
  templates: PoseTemplate[] | null
  pose_ids?: number[] | null
  video_path?: string | null
  bone_video_path?: string | null
  is_favorited?: boolean
}

const TAB_CONFIG: { value: TabMode; label: string; icon: typeof Heart }[] = [
  { value: 'all', label: '全部', icon: Heart },
  { value: 'challenge', label: '闯关', icon: Gamepad2 },
  { value: 'rhythm', label: '节拍', icon: Clapperboard },
  { value: 'follow', label: '跟练', icon: Users },
  { value: 'pose', label: '动作', icon: PersonStanding },
]

// 生成唯一 key（不同 target_type 可能存在同 id）
const itemKey = (item: FavoriteItem) => `${item.target_type}-${item.id}`

// 类型标签：闯关 / 节拍 / 跟练 / 动作
const typeLabelOf = (item: { target_type: string; target_mode?: string }): string => {
  if (item.target_type === 'custom_level') {
    return item.target_mode === 'rhythm' ? '节拍' : '闯关'
  }
  if (item.target_type === 'follow_level') return '跟练'
  return '动作'
}

// 类型标签颜色
const typeColorOf = (item: { target_type: string; target_mode?: string }): string => {
  if (item.target_type === 'custom_level') {
    return item.target_mode === 'rhythm' ? 'bg-purple-500/20 text-purple-400' : 'bg-emerald-500/20 text-emerald-400'
  }
  if (item.target_type === 'follow_level') return 'bg-emerald-500/20 text-emerald-400'
  return 'bg-amber-500/20 text-amber-400'
}

export default function MyFavorites() {
  const navigate = useNavigate()
  const { user, isLoggedIn } = useUserStore()
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<TabMode>('all')
  const [previewItem, setPreviewItem] = useState<FavoriteDetail | null>(null)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [removingKey, setRemovingKey] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const loadFavorites = useCallback(async () => {
    if (!isLoggedIn || !user?.id) {
      setLoading(false)
      setItems([])
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/favorites?user_id=${user.id}`)
      if (!res.ok) throw new Error('加载失败')
      const data = await res.json()
      setItems(data.items || [])
    } catch (e: any) {
      setError(e.message || '加载失败')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [isLoggedIn, user])

  useEffect(() => {
    loadFavorites()
  }, [loadFavorites])

  const filteredItems = items.filter((it) => {
    if (tab === 'all') return true
    if (tab === 'challenge') return it.target_type === 'custom_level' && it.target_mode === 'challenge'
    if (tab === 'rhythm') return it.target_type === 'custom_level' && it.target_mode === 'rhythm'
    if (tab === 'follow') return it.target_type === 'follow_level'
    if (tab === 'pose') return it.target_type === 'pose'
    return true
  })

  // 预览（按 target_type 拉取详情）
  const handlePreview = async (item: FavoriteItem) => {
    if (!user?.id) return
    setPreviewLoading(true)
    try {
      let detail: FavoriteDetail = { ...item, templates: null }

      if (item.target_type === 'custom_level') {
        // 闯关/节拍关卡：GET /api/custom-levels/{id}?user_id=xxx → pose_ids → templates
        const res = await fetch(`/api/custom-levels/${item.id}?user_id=${user.id}`)
        if (!res.ok) throw new Error('加载失败')
        const data = await res.json()
        detail = { ...item, ...data, templates: null, pose_ids: data.pose_ids }
        if (data.pose_ids?.length && !detail.templates?.length) {
          detail.templates = await fetchTemplatesByIds(data.pose_ids)
        }
      } else if (item.target_type === 'follow_level') {
        // 跟练关卡：GET /api/follow-levels/{id}?user_id=xxx → templates + video_path
        const res = await fetch(`/api/follow-levels/${item.id}?user_id=${user.id}`)
        if (!res.ok) throw new Error('加载失败')
        const data = await res.json()
        detail = {
          ...item,
          ...data,
          templates: data.templates ?? null,
          video_path: data.video_path ?? null,
          bone_video_path: data.bone_video_path ?? null,
        }
      } else if (item.target_type === 'pose') {
        // 动作：列表数据中已有 icon，调用 GET /api/pose-templates/{id} 获取完整 landmarks
        const res = await fetch(`/api/pose-templates/${item.id}`)
        if (!res.ok) throw new Error('加载失败')
        const data: PoseTemplate = await res.json()
        detail = { ...item, templates: [data] }
      }

      setPreviewItem(detail)
      setPreviewIndex(0)
    } catch (e) {
      showToast('加载详情失败')
    } finally {
      setPreviewLoading(false)
    }
  }

  // 取消收藏：DELETE /api/favorites?user_id=xxx body:{target_type, target_id}
  const handleUnfavorite = async (e: React.MouseEvent, item: FavoriteItem) => {
    e.stopPropagation()
    const key = itemKey(item)
    if (removingKey !== null) return
    if (!user?.id) return
    setRemovingKey(key)
    try {
      const res = await fetch(`/api/favorites?user_id=${user.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: item.target_type, target_id: item.id }),
      })
      if (!res.ok) throw new Error('操作失败')
      setItems((prev) => prev.filter((it) => itemKey(it) !== key))
      showToast('已取消收藏')
    } catch (e: any) {
      showToast(e.message || '操作失败')
    } finally {
      setRemovingKey(null)
    }
  }

  // 直接开玩：仅 custom_level / follow_level 支持
  const handlePlay = async () => {
    if (!previewItem) return
    if (!previewItem.templates?.length) {
      showToast('动作数据缺失')
      return
    }
    if (previewItem.target_type === 'custom_level') {
      // 记录播放 POST /api/custom-levels/{id}/play
      fetch(`/api/custom-levels/${previewItem.id}/play`, { method: 'POST' }).catch(() => {})
      navigate('/play', {
        state: {
          templates: previewItem.templates,
          name: previewItem.name,
          mode: previewItem.target_mode,
        },
      })
    } else if (previewItem.target_type === 'follow_level') {
      // 记录播放 POST /api/follow-levels/{id}/play
      fetch(`/api/follow-levels/${previewItem.id}/play`, { method: 'POST' }).catch(() => {})
      const videoUrl = previewItem.video_path ? `/videos/${previewItem.video_path}` : undefined
      const boneVideoUrl = previewItem.bone_video_path ? `/videos/${previewItem.bone_video_path}` : undefined
      navigate('/play', {
        state: {
          templates: previewItem.templates,
          name: previewItem.name,
          mode: 'follow',
          videoUrl,
          boneVideoUrl,
        },
      })
    }
  }

  return (
    <div className="min-h-screen text-white">
      <GameBackground />
      <FloatingNav title="我的收藏" subtitle="你收藏的关卡与动作" />

      <main className="pt-20 pb-12 px-4">
        <div className="w-full max-w-6xl mx-auto">
          {/* 模式 tab */}
          <div className="mb-6 flex items-center justify-center gap-2 flex-wrap">
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

          {!isLoggedIn ? (
            <div className="text-center py-20">
              <AlertCircle size={48} className="mx-auto text-white/30 mb-4" />
              <p className="text-white/60 mb-2">请先登录</p>
              <p className="text-white/40 text-sm">登录后可查看收藏的关卡与动作</p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/50">
              <Loader2 size={32} className="animate-spin mb-3" />
              加载中...
            </div>
          ) : error ? (
            <div className="text-center py-20 text-rose-400">{error}</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">💝</div>
              <p className="text-white/60 mb-2">还没有收藏</p>
              <p className="text-white/40 text-sm mb-6">去关卡市场收藏喜欢的作品吧</p>
              <button
                onClick={() => navigate('/market')}
                className="px-6 py-3 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl font-medium hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
              >
                前往关卡市场
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const key = itemKey(item)
                return (
                  <div
                    key={key}
                    className="text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-rose-400/40 transition-all group"
                  >
                    <button onClick={() => handlePreview(item)} className="w-full text-left">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-14 h-14 flex items-center justify-center bg-black/30 rounded-xl flex-shrink-0">
                          {item.target_type === 'pose' ? (
                            <span className="text-3xl leading-none">{item.icon || '🧍'}</span>
                          ) : (
                            <Film size={28} className="text-white/40 group-hover:text-rose-400 transition-colors" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{item.name}</h3>
                          <p className="text-white/50 text-xs line-clamp-2">{item.description || '社区作品'}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('px-2 py-0.5 rounded-full', typeColorOf(item))}>
                            {typeLabelOf(item)}
                          </span>
                          {!item.is_public && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                              已下架
                            </span>
                          )}
                        </div>
                        <span className="flex items-center gap-0.5 text-white/40">
                          <User size={10} />
                          {item.author_nickname}
                        </span>
                      </div>
                    </button>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-xs text-white/40">
                        <Play size={10} />
                        {item.play_count ?? 0}
                      </span>
                      <button
                        onClick={(e) => handleUnfavorite(e, item)}
                        disabled={removingKey === key}
                        title="取消收藏"
                        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-all disabled:opacity-50"
                      >
                        {removingKey === key ? <Loader2 size={14} className="animate-spin" /> : <Heart size={14} fill="currentColor" />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {/* 预览弹窗 */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => !previewLoading && setPreviewItem(null)}
        >
          <div
            className="glass rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="min-w-0">
                <h2 className="text-lg font-bold truncate">{previewItem.name}</h2>
                <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                  <span className={cn('px-2 py-0.5 rounded-full', typeColorOf(previewItem))}>
                    {typeLabelOf(previewItem)}
                  </span>
                  {!previewItem.is_public && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">已下架</span>
                  )}
                  <span className="flex items-center gap-0.5">
                    <User size={10} />
                    {previewItem.author_nickname}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                disabled={previewLoading}
                className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all flex-shrink-0 disabled:opacity-30"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-white/60 text-sm mb-4">{previewItem.description || '社区作品'}</p>

            {/* 动作预览 */}
            {previewLoading ? (
              <div className="flex items-center justify-center py-12 text-white/50">
                <Loader2 size={28} className="animate-spin" />
              </div>
            ) : previewItem.templates && previewItem.templates.length > 0 ? (
              <div className="mb-4">
                <div className="flex items-center justify-center mb-3">
                  <div className="w-56 h-56 flex items-center justify-center bg-black/30 rounded-2xl">
                    <PoseFigure template={previewItem.templates[previewIndex]} size={220} />
                  </div>
                </div>
                <div className="text-center mb-3">
                  <p className="text-white/80 font-medium text-sm">{previewItem.templates[previewIndex].name}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {previewIndex + 1} / {previewItem.templates.length}
                    {previewItem.frame_count ? ` · 共 ${previewItem.frame_count}帧` : ''}
                    {previewItem.fps ? ` · ${previewItem.fps}fps` : ''}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                    disabled={previewIndex === 0}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="flex gap-1.5 overflow-x-auto max-w-[240px] py-1">
                    {previewItem.templates.map((_, i) => (
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
                    onClick={() => setPreviewIndex((i) => Math.min(previewItem.templates!.length - 1, i + 1))}
                    disabled={previewIndex === previewItem.templates.length - 1}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-10 text-white/40 text-sm">
                动作数据缺失
              </div>
            )}

            {/* 直接开玩按钮：仅 custom_level / follow_level 支持 */}
            {!previewLoading && (previewItem.target_type === 'custom_level' || previewItem.target_type === 'follow_level') && (
              <button
                onClick={handlePlay}
                disabled={!previewItem.templates?.length}
                className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 hover:shadow-lg hover:shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play size={18} />
                直接开玩
              </button>
            )}
            {!previewLoading && !previewItem.is_public && (previewItem.target_type === 'custom_level' || previewItem.target_type === 'follow_level') && (
              <p className="text-[11px] text-amber-400/70 mt-2 text-center">
                该关卡已被作者下架，你仍可继续使用，但新用户无法再收藏
              </p>
            )}
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
