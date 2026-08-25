import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Plus, LogIn, Copy, Share2, Gamepad2, Clapperboard, Music, Users as UsersIcon, Loader2, RefreshCw, DoorOpen, Lock, Trophy, Settings } from 'lucide-react'
import FloatingNav from '@/components/FloatingNav'
import GameBackground from '@/components/GameBackground'
import ModeGuideModal, { type GuideSection } from '@/components/ModeGuideModal'
import { useUserStore } from '@/store/userStore'
import { usePoseTemplates } from '@/hooks/usePoseTemplates'
import { useLevelConfigs } from '@/hooks/useLevelConfigs'
import { resolveLevelPoses, resolveRhythmPoses } from '@/utils/levelConfigs'
import type { LevelConfig } from '@/utils/levelConfigs'
import type { PoseTemplate } from '@/utils/poseMatcher'
import { fetchTemplatesByIds } from '@/utils/poseTemplateService'
import { cn } from '@/lib/utils'

type TabKey = 'lobby' | 'create' | 'join' | 'my-room'
type ModeTab = 'challenge' | 'rhythm' | 'follow'

interface RoomInfo {
  id: number
  room_code: string
  host_id: number
  game_mode: string
  level_name: string
  status: string
  max_players: number
  created_at: string
  players: Array<{ id: number; nickname: string; is_host: boolean }>
}

const MODE_LABELS: Record<ModeTab, { label: string; icon: any; color: string; desc: string }> = {
  challenge: { label: '闯关模式', icon: Gamepad2, color: 'from-cyan-400 to-blue-500', desc: '达标即过，比拼速度' },
  rhythm: { label: '节拍模式', icon: Clapperboard, color: 'from-purple-500 to-pink-600', desc: '固定节奏，比拼得分' },
  follow: { label: '跟练模式', icon: Music, color: 'from-emerald-500 to-cyan-500', desc: '视频跟练，各自评分' },
}

export default function MultiPlayer() {
  const navigate = useNavigate()
  const { user, isLoggedIn } = useUserStore()
  const { templates, loading: templatesLoading } = usePoseTemplates()
  const { levels, rhythmLevels } = useLevelConfigs()

  const [activeTab, setActiveTab] = useState<TabKey>('lobby')
  const [createMode, setCreateMode] = useState<ModeTab>('rhythm')
  const [selectedLevelId, setSelectedLevelId] = useState<string | number | null>(null)
  const [perPoseSec, setPerPoseSec] = useState(8)
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [isCreating, setIsCreating] = useState(false)
  // 跟练模式：用户课程
  const [userLevels, setUserLevels] = useState<any[]>([])
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState('')

  // 大厅房间列表
  const [rooms, setRooms] = useState<RoomInfo[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

  // 多人对战指南内容
  const guideSections: GuideSection[] = useMemo(() => [
    {
      icon: Users,
      title: '多人对战玩法',
      desc: '创建房间，邀请好友，一起 PK',
      color: 'from-purple-500 to-pink-500',
      visual: (
        <div className="flex items-center justify-center gap-2 text-xs">
          <span className="px-2 py-1 rounded-lg bg-purple-500/20 text-purple-400 font-medium">创建房间</span>
          <span className="text-white/30">→</span>
          <span className="px-2 py-1 rounded-lg bg-white/10 text-white/70">分享房间号</span>
          <span className="text-white/30">→</span>
          <span className="px-2 py-1 rounded-lg bg-white/10 text-white/70">好友加入</span>
          <span className="text-white/30">→</span>
          <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-medium">实时 PK</span>
        </div>
      ),
      items: [
        { label: '创建房间', desc: '选择模式（闯关/节拍/跟练）和动作，生成房间号' },
        { label: '邀请好友', desc: '分享房间号，好友输入即可加入', tag: '最多10人', tagColor: 'bg-purple-500/20 text-purple-400' },
        { label: '异步群战', desc: '各玩家独立挑战相同动作，无需同步开始' },
        { label: '实时排行榜', desc: '房间内分数实时更新，PK 谁更标准', tag: '实时', tagColor: 'bg-emerald-500/20 text-emerald-400' },
      ],
    },
    {
      icon: Trophy,
      title: '评分与排名',
      desc: '与单人模式一致的评分逻辑',
      color: 'from-yellow-500 to-orange-500',
      visual: (
        <div className="space-y-1.5">
          {[
            { name: '玩家A', score: 92, color: 'from-yellow-400 to-amber-500', medal: '🥇' },
            { name: '玩家B', score: 85, color: 'from-slate-300 to-slate-400', medal: '🥈' },
            { name: '玩家C', score: 78, color: 'from-orange-400 to-amber-700', medal: '🥉' },
            { name: '你', score: 73, color: 'from-emerald-500 to-cyan-500', medal: '4', me: true },
          ].map((p, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg',
                p.me ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-white/5'
              )}
            >
              <span className={cn('w-6 h-6 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-bold text-white flex-shrink-0', p.color)}>
                {p.medal}
              </span>
              <span className={cn('text-sm flex-1 truncate', p.me ? 'text-blue-300 font-bold' : 'text-white/70')}>{p.name}</span>
              <span className="text-sm font-mono font-bold tabular-nums">{p.score}</span>
            </div>
          ))}
          <p className="text-[10px] text-white/40 text-center pt-1">实时更新 · 按总分排序</p>
        </div>
      ),
      items: [
        { label: '评分逻辑', desc: '角度规则评分（闯关/节拍）或关键点相似度（跟练）' },
        { label: '达标线', desc: '闯关模式 80 分达标，节拍/跟练取平均分', tag: '≥80分', tagColor: 'bg-emerald-500/20 text-emerald-400' },
        { label: '排名规则', desc: '按总分排序，同分按完成时间' },
      ],
    },
    {
      icon: Settings,
      title: '通用说明',
      desc: '注意事项与隐私',
      color: 'from-emerald-500 to-cyan-500',
      items: [
        { label: '评分范围', desc: '极简/半身/全身三档可选，默认半身' },
        { label: '隐私保护', desc: '摄像头数据本地处理，仅上传匿名分数', tag: '隐私', tagColor: 'bg-green-500/20 text-green-400' },
        { label: '断线重连', desc: '关闭页面视为退出房间，需重新加入', tag: '注意', tagColor: 'bg-amber-500/20 text-amber-400' },
      ],
    },
  ], [])
  const [myRoomCode, setMyRoomCode] = useState<string | null>(null)

  // 加载用户所有自定义关卡（闯关/节拍 + 跟练，新统一 API）
  useEffect(() => {
    if (!isLoggedIn || !user?.id) return
    const load = async () => {
      try {
        // 闯关/节拍关卡
        const crRes = await fetch(`/api/custom-levels?owner_id=${user.id}&limit=24`)
        const crItems = crRes.ok ? (await crRes.json()).items || [] : []
        const crResolved = await Promise.all(
          crItems.map(async (item: any) => {
            let templates: PoseTemplate[] = []
            try {
              const dres = await fetch(`/api/custom-levels/${item.id}?user_id=${user.id}`)
              if (dres.ok) {
                const d = await dres.json()
                if (d.pose_ids?.length) templates = await fetchTemplatesByIds(d.pose_ids)
              }
            } catch { /* ignore */ }
            return { ...item, templates, target_mode: item.target_mode }
          })
        )
        // 跟练关卡
        const fcRes = await fetch(`/api/follow-levels?owner_id=${user.id}&limit=24`)
        const fcItems = fcRes.ok ? (await fcRes.json()).items || [] : []
        const fcResolved = await Promise.all(
          fcItems.map(async (item: any) => {
            let templates: PoseTemplate[] = []
            let video_path: string | null = null
            let bone_video_path: string | null = null
            try {
              const dres = await fetch(`/api/follow-levels/${item.id}?user_id=${user.id}`)
              if (dres.ok) {
                const d = await dres.json()
                templates = d.templates || []
                video_path = d.video_path ?? null
                bone_video_path = d.bone_video_path ?? null
              }
            } catch { /* ignore */ }
            return { ...item, templates, target_mode: 'follow', video_path, bone_video_path }
          })
        )
        setUserLevels([...crResolved, ...fcResolved])
      } catch { /* ignore */ }
    }
    load()
  }, [isLoggedIn, user?.id])

  const fetchRooms = async () => {
    setLoadingRooms(true)
    try {
      const res = await fetch('/api/rooms?status=waiting')
      if (res.ok) {
        const data = await res.json()
        setRooms(data)
      }
    } catch (e) {
      console.error('加载房间列表失败', e)
    } finally {
      setLoadingRooms(false)
    }
  }

  // 合并轮询：大厅列表 + 我的房间，2s 一次
  useEffect(() => {
    if (!isLoggedIn) return
    const poll = async () => {
      // 我的房间检查
      if (user.id) {
        try {
          const res = await fetch(`/api/rooms/my-room?user_id=${user.id}`)
          if (res.ok) {
            const data = await res.json()
            setMyRoomCode(data.room_code)
          }
        } catch { /* ignore */ }
      }
      // 大厅列表
      if (activeTab === 'lobby') {
        setLoadingRooms(true)
        try {
          const res = await fetch('/api/rooms?status=waiting')
          if (res.ok) {
            const data = await res.json()
            setRooms(data)
          }
        } catch (e) {
          console.error('加载房间列表失败', e)
        } finally {
          setLoadingRooms(false)
        }
      }
    }
    poll()
    const timer = setInterval(poll, 2000)
    return () => clearInterval(timer)
  }, [isLoggedIn, user.id, activeTab])

  const handleCreateRoom = async () => {
    if (!user.id) return
    if (selectedLevelId === null) {
      setError('请选择一个关卡')
      return
    }
    // 已在房间中则不允许创建
    if (myRoomCode) {
      setError('你已在房间中，请先退出当前房间')
      return
    }

    let levelName = ''
    let poseList: PoseTemplate[] = []
    let videoPath = ''
    let boneVideoPath = ''

    if (createMode === 'challenge') {
      // 先查用户自定义课程，再查预设关卡
      const userLevel = userLevels.find(c => String(c.id) === String(selectedLevelId) && c.target_mode === 'challenge')
      if (userLevel) {
        levelName = userLevel.name
        poseList = userLevel.templates || []
      } else {
        const level = levels.find(l => String(l.id) === String(selectedLevelId))
        if (level) {
          levelName = level.name
          const poseIds = resolveLevelPoses(level, templates)
          poseList = poseIds
            .map(id => templates.find(t => String(t.id) === String(id)))
            .filter(Boolean) as PoseTemplate[]
        }
      }
    } else if (createMode === 'rhythm') {
      // 先查用户自定义课程，再查预设课程
      const userLevel = userLevels.find(c => String(c.id) === String(selectedLevelId) && c.target_mode === 'rhythm')
      if (userLevel) {
        levelName = userLevel.name
        poseList = userLevel.templates || []
      } else {
        const rhythmLevel = rhythmLevels.find(c => String(c.id) === String(selectedLevelId))
        if (rhythmLevel) {
          levelName = rhythmLevel.name
          const poseIds = resolveRhythmPoses(rhythmLevel, templates)
          poseList = poseIds
            .map(id => templates.find(t => String(t.id) === String(id)))
            .filter(Boolean) as PoseTemplate[]
        }
      }
    } else {
      // follow 模式：只有用户自建跟练课程
      const userLevel = userLevels.find(c => String(c.id) === String(selectedLevelId) && c.target_mode === 'follow')
      if (userLevel) {
        levelName = userLevel.name
        poseList = userLevel.templates || []
        videoPath = userLevel.video_path || ''
        boneVideoPath = userLevel.bone_video_path || ''
      }
    }

    if (poseList.length === 0) {
      setError('关卡数据为空')
      return
    }

    setIsCreating(true)
    setError('')

    try {
      const roomRes = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host_id: user.id,
          max_players: maxPlayers,
          total_rounds: 3,
          round_duration: 30,
          game_mode: createMode,
          level_name: levelName,
          templates: poseList,
          per_pose_sec: perPoseSec,
          video_path: videoPath,
          bone_video_path: boneVideoPath,
        }),
      })
      const roomData = await roomRes.json()
      navigate(`/room/${roomData.room_code}`)
    } catch (e) {
      setError('创建房间失败，请稍后重试')
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinRoom = async (code?: string) => {
    if (!user.id) return
    const targetCode = code || roomCode.toUpperCase().trim()

    // 已在自己房间中 → 直接进入
    if (myRoomCode && myRoomCode === targetCode) {
      navigate(`/room/${myRoomCode}`)
      return
    }

    if (myRoomCode) {
      setError('你已在房间中，请先退出当前房间')
      return
    }

    if (!targetCode) {
      setError('请输入房间号')
      return
    }

    setError('')

    try {
      const joinRes = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_code: targetCode,
          user_id: user.id,
          nickname: user.nickname,
        }),
      })

      if (!joinRes.ok) {
        const err = await joinRes.json()
        throw new Error(err.detail || '加入房间失败')
      }

      navigate(`/room/${targetCode}`)
    } catch (e: any) {
      setError(e.message || '加入房间失败')
    }
  }

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode)
  }

  // 按 target_mode 分组用户自定义课程
  const userLevelsByMode = useMemo(() => {
    const grouped: Record<ModeTab, any[]> = { challenge: [], rhythm: [], follow: [] }
    for (const c of userLevels) {
      const m = (c.target_mode || 'follow') as ModeTab
      if (m in grouped) grouped[m].push(c)
    }
    return grouped
  }, [userLevels])

  // 合并：预设关卡 + 用户自定义课程
  const levelOptions = useMemo(() => {
    const custom = userLevelsByMode[createMode]
    if (createMode === 'challenge') return [...custom, ...levels]
    if (createMode === 'rhythm') return [...custom, ...rhythmLevels]
    return custom.length > 0 ? custom : []  // 跟练模式只有自定义课程
  }, [createMode, userLevelsByMode, levels, rhythmLevels])

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen text-white">
        <GameBackground />
        <FloatingNav title="多人对战" subtitle="创建房间邀请好友，一起PK谁的动作更标准" onHelpClick={() => setGuideOpen(true)} />

        <main className="pt-20 pb-12 px-4 flex items-center justify-center min-h-screen">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-6 shadow-lg"><Lock size={40} className="text-white" /></div>
            <h2 className="text-2xl font-bold mb-4">需要登录</h2>
            <p className="text-white/60 mb-8">
              多人对战需要登录后才能使用，请先登录你的账号
            </p>
            <button
              onClick={() => {
                const loginBtn = document.getElementById('nav-login-btn') as HTMLElement
                loginBtn?.click()
              }}
              className="px-8 py-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
            >
              <span className="flex items-center justify-center gap-2">
                <LogIn size={20} />
                登录
              </span>
            </button>
          </div>
        </main>
        <ModeGuideModal
          open={guideOpen}
          onClose={() => setGuideOpen(false)}
          title="多人对战指南"
          emoji="👥"
          subtitle="创建房间，邀请好友，一起 PK"
          sections={guideSections}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen text-white">
      <GameBackground />
      <FloatingNav title="多人对战" subtitle="创建房间邀请好友，一起PK谁的动作更标准" onHelpClick={() => setGuideOpen(true)} />

      <main className="pt-20 pb-12 px-4">
        <div className="mx-auto">

          {/* Tab 切换 */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-white/5 rounded-2xl p-1 gap-1">
              {[
                { key: 'lobby' as TabKey, label: '大厅', icon: UsersIcon },
                { key: 'create' as TabKey, label: '创建房间', icon: Plus },
                { key: 'join' as TabKey, label: '加入房间', icon: LogIn },
                ...(myRoomCode ? [{ key: 'my-room' as TabKey, label: '我的房间', icon: DoorOpen }] : []),
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => {
                    if (tab.key === 'my-room') {
                      navigate(`/room/${myRoomCode}`)
                    } else {
                      setActiveTab(tab.key)
                      setError('')
                    }
                  }}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all text-sm',
                    tab.key === 'my-room'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-cyan-500/30'
                      : activeTab === tab.key
                        ? 'bg-white/15 text-white'
                        : 'text-white/50 hover:text-white/80'
                  )}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="max-w-md mx-auto mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* 大厅 */}
          {activeTab === 'lobby' && (
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <UsersIcon size={20} className="text-purple-400" />
                  在线房间
                </h2>
                <button
                  onClick={fetchRooms}
                  disabled={loadingRooms}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                  <RefreshCw size={16} className={loadingRooms ? 'animate-spin' : ''} />
                </button>
              </div>

              {loadingRooms && rooms.length === 0 ? (
                <div className="text-center py-12 text-white/40">
                  <Loader2 size={32} className="mx-auto mb-3 animate-spin" />
                  加载中...
                </div>
              ) : rooms.length === 0 ? (
                <div className="text-center py-12 text-white/40">
                  <div className="text-4xl mb-3">🏠</div>
                  <p>暂无等待中的房间</p>
                  <p className="text-sm mt-1">去创建一个吧！</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rooms.map(room => (
                    <div
                      key={room.id}
                      className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center font-bold font-mono">
                          {room.room_code.slice(0, 3)}
                        </div>
                        <div>
                          <div className="font-bold">{room.level_name || '未命名关卡'}</div>
                          <div className="text-sm text-white/50 flex items-center gap-3">
                            <span>房间号: {room.room_code}</span>
                            <span>·</span>
                            <span>{room.game_mode === 'challenge' ? '闯关' : room.game_mode === 'follow' ? '跟练' : '节拍'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-white/60">
                          {room.players?.length || 0}/{room.max_players} 人
                        </div>
                        <button
                          onClick={() => handleJoinRoom(room.room_code)}
                          disabled={(room.players?.length || 0) >= room.max_players || (!!myRoomCode && myRoomCode !== room.room_code)}
                          className={cn(
                            'px-4 py-2 rounded-lg font-medium text-sm transition-all',
                            (room.players?.length || 0) >= room.max_players || (!!myRoomCode && myRoomCode !== room.room_code)
                              ? 'bg-white/10 text-white/30 cursor-not-allowed'
                              : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-lg hover:shadow-cyan-500/30'
                          )}
                        >
                          {myRoomCode === room.room_code ? '进入房间' : myRoomCode ? '已在房间' : '加入'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 创建房间 */}
          {activeTab === 'create' && (
            <div className="glass rounded-2xl p-8">
              {/* 模式选择 */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white/70 mb-3">选择模式</h3>
                <div className="grid grid-cols-3 gap-4">
                  {(Object.keys(MODE_LABELS) as ModeTab[]).map(mode => {
                    const cfg = MODE_LABELS[mode]
                    return (
                      <button
                        key={mode}
                        onClick={() => { setCreateMode(mode); setSelectedLevelId(null) }}
                        className={cn(
                          'p-4 rounded-xl text-left transition-all border-2',
                          createMode === mode
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-transparent bg-white/5 hover:bg-white/10'
                        )}
                      >
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-gradient-to-br',
                          cfg.color
                        )}>
                          <cfg.icon size={20} />
                        </div>
                        <div className="font-bold">{cfg.label}</div>
                        <div className="text-xs text-white/50 mt-1">{cfg.desc}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 关卡选择 */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white/70 mb-3">
                  选择{createMode === 'challenge' ? '关卡' : createMode === 'follow' ? '跟练课程' : '课程'}
                </h3>
                {templatesLoading ? (
                  <div className="text-center py-8 text-white/40">
                    <Loader2 size={24} className="mx-auto mb-2 animate-spin" />
                    加载中...
                  </div>
                ) : levelOptions.length === 0 && createMode === 'follow' ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">🎬</div>
                    <p className="text-white/50 mb-2">暂无跟练课程</p>
                    <p className="text-white/40 text-sm mb-4">跟练模式需要从视频创建课程，才能在多人对战中使用</p>
                    <button
                      onClick={() => navigate('/video-import')}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl font-medium text-sm hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
                    >
                      去创建跟练课程
                    </button>
                  </div>
                ) : levelOptions.length === 0 ? (
                  <div className="text-center py-8 text-white/40">暂无可用关卡</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                    {levelOptions.map(item => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedLevelId(item.id)}
                        className={cn(
                          'p-3 rounded-xl text-left transition-all border-2',
                          selectedLevelId === item.id
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-transparent bg-white/5 hover:bg-white/10'
                        )}
                      >
                        <div className="font-medium text-sm truncate flex items-center gap-1.5">
                          {(item as any).target_mode && <span className="text-[10px] px-1 py-0.5 bg-emerald-500/20 text-emerald-300 rounded">自定义</span>}
                          {item.name}
                        </div>
                        <div className="text-xs text-white/40 mt-1">
                          {(item as any).templates
                            ? `${(item as any).templates.length} 个动作`
                            : createMode === 'challenge'
                            ? `${resolveLevelPoses(item as LevelConfig, templates).length} 个动作`
                            : `${resolveRhythmPoses(item as LevelConfig, templates).length} 个动作`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 设置 */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {createMode === 'rhythm' && (
                  <div>
                    <h3 className="text-sm font-semibold text-white/70 mb-2">每动作时长（秒）</h3>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={3}
                        max={20}
                        step={1}
                        value={perPoseSec}
                        onChange={e => setPerPoseSec(Number(e.target.value))}
                        className="flex-1 accent-purple-500"
                      />
                      <span className="text-white font-semibold min-w-[4ch] text-center">{perPoseSec}s</span>
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-white/70 mb-2">最大人数</h3>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={2}
                      max={10}
                      value={maxPlayers}
                      onChange={e => setMaxPlayers(Number(e.target.value))}
                      className="flex-1 accent-purple-500"
                    />
                    <span className="text-white font-semibold min-w-[3ch] text-center">{maxPlayers} 人</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCreateRoom}
                disabled={isCreating || !selectedLevelId || templatesLoading || !!myRoomCode}
                className={cn(
                  'w-full py-4 rounded-xl font-bold text-lg transition-all',
                  isCreating || !selectedLevelId || templatesLoading || !!myRoomCode
                    ? 'bg-white/20 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-[1.02]'
                )}
              >
                {myRoomCode ? '你已在房间中' : isCreating ? '创建中...' : '创建房间'}
              </button>
            </div>
          )}

          {/* 加入房间 */}
          {activeTab === 'join' && (
            <div className="glass rounded-2xl p-8 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-6">
                <LogIn size={28} />
              </div>
              <h2 className="text-2xl font-bold mb-2">加入房间</h2>
              <p className="text-white/60 mb-6">
                输入好友分享的房间号，加入对战
              </p>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="输入房间号"
                  maxLength={6}
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:ring-2 focus:ring-cyan-500/50 focus:outline-none transition-all font-mono text-center tracking-widest text-xl"
                />
                <button
                  onClick={copyRoomCode}
                  className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
                  title="粘贴"
                >
                  <Copy size={20} />
                </button>
              </div>
              <button
                onClick={() => handleJoinRoom()}
                disabled={!!myRoomCode}
                className={cn(
                  'w-full py-4 rounded-xl font-bold transition-all',
                  myRoomCode
                    ? 'bg-white/20 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-[1.02]'
                )}
              >
                {myRoomCode ? '你已在房间中' : '加入房间'}
              </button>
            </div>
          )}

          <div className="mt-10 text-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/5 rounded-2xl">
              <Share2 className="text-purple-400" size={20} />
              <span className="text-white/60 text-sm">
                分享房间号给好友，最多支持 10 人同时对战
              </span>
            </div>
          </div>
        </div>
      </main>
      <ModeGuideModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title="多人对战指南"
        emoji="👥"
        subtitle="创建房间，邀请好友，一起 PK"
        sections={guideSections}
      />
    </div>
  )
}
