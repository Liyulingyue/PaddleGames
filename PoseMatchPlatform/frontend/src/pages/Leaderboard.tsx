import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, Medal, Award, Clock, User, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import FloatingNav from '@/components/FloatingNav'
import GameBackground from '@/components/GameBackground'
import { useUserStore } from '@/store/userStore'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20
const MAX_RANK = 100

interface LeaderboardEntry {
  rank: number
  nickname: string
  avatar: string
  score: number
  max_combo: number
  accuracy: number
  duration: number
  template_name: string
  created_at: string
}

interface MyRank {
  rank: number
  best_score: number
  best_duration: number
  max_combo: number
  best_template: string
  total_players: number
  has_score: boolean
}

export default function Leaderboard() {
  const navigate = useNavigate()
  const { user, isLoggedIn } = useUserStore()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [myRank, setMyRank] = useState<MyRank | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageLoading, setPageLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [gameMode, setGameMode] = useState<string>('all')

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // 切换模式时重置到第 1 页
  useEffect(() => {
    setPage(1)
  }, [gameMode])

  // 页码或模式变化时加载
  useEffect(() => {
    const fetchPage = async (isFirst: boolean) => {
      if (isFirst) setLoading(true)
      else setPageLoading(true)
      try {
        const offset = (page - 1) * PAGE_SIZE
        let url = `/api/scores/leaderboard?limit=${PAGE_SIZE}&offset=${offset}`
        if (gameMode !== 'all') {
          url += `&game_mode=${gameMode}`
        }
        const [listRes, countRes] = await Promise.all([
          fetch(url),
          fetch(`/api/scores/leaderboard/count${gameMode !== 'all' ? `?game_mode=${gameMode}` : ''}`),
        ])
        const listData = await listRes.json()
        const countData = await countRes.json()
        setEntries(listData || [])
        setTotal(Math.min(countData.total || 0, MAX_RANK))
      } catch (e) {
        console.error('Failed to fetch leaderboard:', e)
        setEntries([])
        setTotal(0)
      } finally {
        setLoading(false)
        setPageLoading(false)
      }
    }

    // 首屏（page===1 且首次）显示全屏 loading，翻页显示轻量 loading
    fetchPage(page === 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, gameMode])

  // 我的排名（仅依赖模式，不随翻页变化）
  useEffect(() => {
    const fetchMyRank = async () => {
      if (!isLoggedIn || !user.id) {
        setMyRank(null)
        return
      }
      try {
        let url = `/api/scores/my-rank/${user.id}`
        if (gameMode !== 'all') {
          url += `?game_mode=${gameMode}`
        }
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setMyRank(data)
        }
      } catch (e) {
        console.error('Failed to fetch my rank:', e)
      }
    }
    fetchMyRank()
  }, [gameMode, isLoggedIn, user.id])

  const goPage = useCallback((p: number) => {
    setPage(Math.max(1, Math.min(totalPages, p)))
  }, [totalPages])

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="text-yellow-400" size={24} />
    if (rank === 2) return <Medal className="text-gray-300" size={24} />
    if (rank === 3) return <Award className="text-amber-600" size={24} />
    return <span className="w-6 text-center font-bold text-white/60">{rank}</span>
  }

  const getRankBg = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border-yellow-500/50'
    if (rank === 2) return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/50'
    if (rank === 3) return 'bg-gradient-to-r from-amber-600/20 to-orange-600/20 border-amber-600/50'
    return 'bg-white/5 border-white/10'
  }

  return (
    <div className="min-h-screen text-white">
      <GameBackground />
      <FloatingNav title="排行榜" subtitle="看看谁是最强的体感大师" />

      <main className="pt-20 pb-12 px-4">
        <div className="mx-auto">

          <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
            <div className="flex gap-2 flex-wrap justify-center">
              {[
                { value: 'all', label: '全部' },
                { value: 'challenge', label: '闯关' },
                { value: 'rhythm', label: '节拍' },
                { value: 'follow', label: '跟练' },
                { value: 'multi', label: '多人' },
                // { value: 'immersive', label: '沉浸' },
              ].map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setGameMode(mode.value)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                    gameMode === mode.value
                      ? 'bg-white text-slate-900'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {isLoggedIn && myRank && (
            <div className="mb-6 glass rounded-2xl p-4 border-2 border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
                  #{myRank.rank || '-'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-purple-400" />
                    <span className="font-bold">{user.nickname}</span>
                    <span className="text-white/40 text-sm">（我的排名）</span>
                  </div>
                  {myRank.has_score ? (
                    <div className="text-sm text-white/50 mt-1">
                      {gameMode === 'challenge' && myRank.best_duration > 0 ? (
                        <>
                          最快耗时 <span className="text-cyan-400 font-bold font-mono">{myRank.best_duration}s</span>
                          {' · '}
                          达标分 <span className="text-yellow-400 font-bold">{myRank.best_score}</span>
                        </>
                      ) : (
                        <>
                          最高分 <span className="text-yellow-400 font-bold">{myRank.best_score.toLocaleString()}</span>
                          {' · '}
                          最高连击 <span className="text-orange-400 font-bold">x{myRank.max_combo}</span>
                        </>
                      )}
                      {' · '}
                      共 {myRank.total_players} 人参与
                    </div>
                  ) : (
                    <div className="text-sm text-white/50 mt-1">
                      还没有记录，快去挑战吧！
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="glass rounded-3xl p-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-white/60">加载中...</p>
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">🎯</div>
                <p className="text-white/60 mb-2">还没有记录</p>
                <p className="text-white/40 text-sm">快去挑战，成为第一名吧！</p>
                <button
                  onClick={() => navigate('/single')}
                  className="mt-6 px-6 py-3 bg-gradient-to-r from-emerald-400 to-cyan-500 rounded-xl font-medium hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
                >
                  立即挑战
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((entry) => (
                  <div
                    key={entry.rank}
                    className={cn(
                      'flex items-center gap-4 p-4 rounded-2xl border transition-all hover:scale-[1.02]',
                      getRankBg(entry.rank)
                    )}
                  >
                    <div className="w-10 flex justify-center">
                      {getRankIcon(entry.rank)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{entry.nickname}</div>
                      <div className="text-sm text-white/50">
                        {entry.template_name}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      {gameMode === 'challenge' ? (
                        <>
                          <div>
                            <div className="text-xl font-bold text-cyan-400 font-mono">
                              {entry.duration}s
                            </div>
                            <div className="text-xs text-white/40">耗时</div>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-yellow-400">
                              {entry.score}
                            </div>
                            <div className="text-xs text-white/40">达标分</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <div className="text-xl font-bold text-yellow-400">
                              {entry.score.toLocaleString()}
                            </div>
                            <div className="text-xs text-white/40">分数</div>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-orange-400">
                              x{entry.max_combo}
                            </div>
                            <div className="text-xs text-white/40">连击</div>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-green-400">
                              {entry.accuracy}%
                            </div>
                            <div className="text-xs text-white/40">准确率</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 分页导航 */}
            {!loading && entries.length > 0 && (
              <div className="mt-6 flex flex-col items-center gap-3">
                {pageLoading && (
                  <div className="flex items-center gap-2 text-white/50 text-sm">
                    <Loader2 size={14} className="animate-spin" />
                    加载中...
                  </div>
                )}
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => goPage(page - 1)}
                      disabled={page <= 1 || pageLoading}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                    >
                      <ChevronLeft size={16} />
                      上一页
                    </button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
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
                      ))}
                    </div>

                    <button
                      onClick={() => goPage(page + 1)}
                      disabled={page >= totalPages || pageLoading}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                    >
                      下一页
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}

                <div className="text-white/40 text-xs">
                  第 {page} / {totalPages} 页 · 共 {total} 名{total >= MAX_RANK ? `（仅展示前 ${MAX_RANK} 名）` : ''}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 text-center text-white/40 text-sm">
            <Clock size={14} className="inline mr-1" />
            排行榜每 5 分钟更新一次
          </div>
        </div>
      </main>
    </div>
  )
}
