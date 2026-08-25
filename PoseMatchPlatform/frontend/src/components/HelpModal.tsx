import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Zap, Monitor, Shield, Heart, Camera, Cpu, MonitorPlay, Settings, Play, Users, Trophy, Info, Gamepad2, Check, ChevronRight, Upload, Store, GitFork, Heart as HeartIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useModal } from '@/hooks/useModal'

interface HelpModalProps {
  open: boolean
  onClose: () => void
}

const features = [
  { icon: Zap, title: '零门槛体验', description: '打开浏览器就能玩，无需下载安装，普通摄像头即可体验专业级体感检测', color: 'from-yellow-400 to-orange-500' },
  { icon: Store, title: '玩家共创', description: '在关卡社区浏览、收藏、Fork 玩家作品，也可把自己的关卡发布到社区分享', color: 'from-cyan-400 to-teal-500' },
  { icon: Shield, title: '隐私保护', description: '所有视频在本地浏览器处理，服务器不存储任何视频流，只上传匿名分数', color: 'from-green-400 to-emerald-500' },
  { icon: Heart, title: '老少皆宜', description: '从青少年到银发群体都能轻松上手，自适应界面设计适配不同年龄层', color: 'from-pink-400 to-rose-500' },
]

const modes: { icon: typeof Gamepad2; title: string; description: string; color: string; badge?: string; path: string }[] = [
  { icon: Gamepad2, title: '单人模式', description: '闯关 18 关含「破釜沉舟」挑战，节拍课程按节奏切换，跟练视频连续推进', color: 'from-emerald-500 to-cyan-500', badge: '3 种玩法', path: '/single' },
  { icon: Users, title: '多人对战', description: '创建房间邀请好友，异步群战，最多 10 人同场 PK，排行榜实时更新', color: 'from-purple-500 to-pink-500', badge: '最多 10 人', path: '/multi' },
  { icon: Store, title: '关卡社区', description: '浏览玩家发布的自创关卡，收藏喜欢的、Fork 到本地或云端，也可上传自己的作品分享给所有人', color: 'from-cyan-500 to-teal-500', badge: 'U GC', path: '/market' },
  { icon: Trophy, title: '排行榜', description: '查看全国排名，挑战最高分，按关卡与模式分类', color: 'from-yellow-500 to-orange-500', path: '/leaderboard' },
  { icon: Monitor, title: '沉浸模式', description: '全屏手势操控，无需触摸，适合大屏与客厅场景', color: 'from-indigo-400 to-purple-500', badge: '体感', path: '/immersive' },
]

const tabs = [
  { id: 'about', label: '关于', icon: Info },
  { id: 'modes', label: '玩法', icon: Play },
  { id: 'requirements', label: '运行要求', icon: Settings },
  { id: 'guide', label: '如何开始', icon: Zap },
] as const

type TabId = typeof tabs[number]['id']

export default function HelpModal({ open, onClose }: HelpModalProps) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabId>('about')
  const { mounted, visible } = useModal(open, onClose)

  // ← → 键切换 Tab
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setTab((t) => {
          const i = tabs.findIndex((x) => x.id === t)
          return tabs[Math.min(tabs.length - 1, i + 1)].id
        })
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setTab((t) => {
          const i = tabs.findIndex((x) => x.id === t)
          return tabs[Math.max(0, i - 1)].id
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // 点击玩法卡跳转并关闭弹窗
  const goMode = (path: string) => {
    onClose()
    navigate(path)
  }

  if (!mounted) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 transition-opacity duration-200',
        visible ? 'opacity-100' : 'opacity-0'
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-slate-900/95 border border-white/20 rounded-3xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden transition-all duration-200',
          visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <h2 className="text-xl font-bold">游戏指南</h2>
              <p className="text-xs text-white/50 mt-0.5">了解 PoseMatch 的玩法、社区与机制</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors" aria-label="关闭">
            <X size={20} />
          </button>
        </div>

        {/* 标签栏 */}
        <div className="flex gap-1 px-4 pt-3 border-b border-white/10 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-white/10 text-white border-b-2 border-cyan-400'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon size={16} />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* 内容区：固定最小高度，避免 Tab 切换时框体跳动 */}
        <div className="flex-1 overflow-y-auto p-6 min-h-[460px]">
          <div key={tab} className="animate-[fadeIn_0.2s_ease-out]">
            {tab === 'about' && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-emerald-400 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                    让健身变得像游戏一样有趣
                  </h3>
                  <p className="text-white/70 leading-relaxed">
                    基于 MediaPipe 的浏览器端实时姿态检测，打开摄像头就能体验专业级动作反馈，
                    闯关挑战、跟练课程、多人对战、沉浸模式，还有玩家共创的关卡社区，多种玩法等你解锁。
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {features.map((f, i) => (
                    <div key={i} className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
                      <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3', f.color)}>
                        <f.icon size={24} className="text-white" />
                      </div>
                      <h4 className="font-bold mb-1">{f.title}</h4>
                      <p className="text-white/60 text-sm">{f.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'modes' && (
              <div className="space-y-4">
                <p className="text-white/60 text-center mb-2">点击下方玩法卡片可直接进入 · 也可用 ← → 切换 Tab</p>
                {modes.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => goMode(m.path)}
                    className="w-full flex items-start gap-4 p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/30 hover:bg-white/10 transition-all text-left group"
                  >
                    <div className={cn('w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform', m.color)}>
                      <m.icon size={28} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-lg font-bold">{m.title}</h4>
                        {m.badge && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-white/70">{m.badge}</span>
                        )}
                      </div>
                      <p className="text-white/70 text-sm">{m.description}</p>
                    </div>
                    <ChevronRight size={20} className="text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            )}

            {tab === 'requirements' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: Camera, title: '摄像头', sub: '需要摄像头权限，建议 720P 及以上', desc: '所有视频数据均在本地浏览器处理，不会上传到服务器，保护你的隐私安全。', color: 'from-emerald-500 to-cyan-500' },
                  { icon: Cpu, title: '浏览器与性能', sub: '推荐 Chrome / Edge 最新版本', desc: '姿态检测在本地运行，需要一定的计算能力。如遇卡顿，可尝试关闭其他占用资源的程序。', color: 'from-purple-500 to-pink-500' },
                  { icon: MonitorPlay, title: '推荐体验环境', sub: '光线充足的室内环境', desc: '确保上半身完整出现在画面中，穿着与背景颜色有差异的衣物，检测效果更佳。', color: 'from-green-500 to-emerald-500' },
                  { icon: Settings, title: '性能优化建议', sub: '默认半身模式，兼顾流畅与体验', desc: '游戏内可切换「极简 / 半身 / 全身」三种评分范围，配置较低的设备建议使用极简模式。', color: 'from-yellow-500 to-orange-500' },
                ].map((r, i) => (
                  <div key={i} className="p-5 rounded-2xl bg-white/5 border border-white/10">
                    <div className="flex items-start gap-3 mb-3">
                      <div className={cn('w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0', r.color)}>
                        <r.icon size={22} className="text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold">{r.title}</h4>
                        <p className="text-white/50 text-xs">{r.sub}</p>
                      </div>
                    </div>
                    <p className="text-white/70 text-sm leading-relaxed">{r.desc}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === 'guide' && (
              <div className="space-y-5">
                <p className="text-white/60 text-center">五步开启你的体感健身之旅</p>
                {/* 5 步流程 */}
                {[
                  { step: '01', title: '授权摄像头', desc: '允许浏览器访问摄像头权限，所有数据仅在本地处理，不上传', icon: Camera, color: 'from-emerald-500 to-cyan-500' },
                  { step: '02', title: '选择玩法', desc: '单人闯关 / 节拍课程 / 跟练视频 / 多人对战 / 沉浸模式 / 关卡社区', icon: Gamepad2, color: 'from-purple-500 to-pink-500' },
                  { step: '03', title: '跟随示例', desc: '画面左侧显示示例动作，右侧显示你的实时姿态与分数', icon: Play, color: 'from-green-500 to-emerald-500' },
                  { step: '04', title: '完成挑战', desc: '闯关达标即过、节拍按节奏切换、跟练按视频推进', icon: Trophy, color: 'from-yellow-500 to-orange-500' },
                  { step: '05', title: '分享与排行', desc: '上传分数到排行榜挑战全国玩家，也可把自创关卡发布到社区供他人游玩', icon: Upload, color: 'from-pink-500 to-rose-500' },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-5 p-5 rounded-2xl bg-white/5 border border-white/10">
                    <div className={cn('w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center flex-shrink-0', s.color)}>
                      <s.icon size={26} className="text-white" />
                    </div>
                    <div className="text-3xl font-black bg-gradient-to-b from-purple-400 to-transparent bg-clip-text text-transparent flex-shrink-0">
                      {s.step}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-lg font-bold mb-1">{s.title}</h4>
                      <p className="text-white/60 text-sm">{s.desc}</p>
                    </div>
                  </div>
                ))}

                {/* 游戏画面布局示意图 */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                  <h4 className="font-bold mb-3 flex items-center gap-2">
                    <MonitorPlay size={16} className="text-cyan-400" />
                    游戏画面布局
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-center">
                      <div className="text-xs text-blue-400 font-bold mb-1">左侧 · 示例</div>
                      <div className="text-[11px] text-white/60">目标动作骨架 + 名称 + 倒计时</div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                      <div className="text-xs text-emerald-400 font-bold mb-1">右侧 · 你的</div>
                      <div className="text-[11px] text-white/60">实时摄像头 + 骨架叠加 + 分数环</div>
                    </div>
                  </div>
                </div>

                {/* 评分模式可视化 */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                  <h4 className="font-bold mb-3 flex items-center gap-2">
                    <Settings size={16} className="text-yellow-400" />
                    评分范围三档
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { name: '极简', points: '6 点', parts: '肩 + 肘 + 腕', color: 'from-slate-500 to-slate-600' },
                      { name: '半身', points: '8 点', parts: '肩 + 肘 + 腕 + 髋', color: 'from-emerald-500 to-cyan-500', default: true },
                      { name: '全身', points: '12 点', parts: '肩肘腕髋膝踝', color: 'from-purple-500 to-pink-500' },
                    ].map((m, i) => (
                      <div key={i} className={cn('p-3 rounded-xl bg-gradient-to-br relative', m.color)}>
                        {m.default && (
                          <span className="absolute top-1.5 right-1.5 px-1 py-0.5 rounded text-[9px] font-bold bg-white/30">默认</span>
                        )}
                        <div className="text-sm font-bold text-white">{m.name}</div>
                        <div className="text-xs text-white/80 mt-0.5">{m.points}</div>
                        <div className="text-[10px] text-white/60 mt-0.5">{m.parts}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 关卡社区介绍 */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-teal-500/10 border border-cyan-500/30">
                  <h4 className="font-bold mb-3 flex items-center gap-2">
                    <Store size={16} className="text-cyan-400" />
                    关卡社区 · 玩家共创
                  </h4>
                  <p className="text-white/70 text-sm mb-4 leading-relaxed">
                    除了系统预设关卡，你还能在社区中发现其他玩家发布的自创作品，也可以把自己的关卡分享给所有人。
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Play size={14} className="text-emerald-400" />
                        <span className="text-xs font-bold text-emerald-400">直接开玩</span>
                      </div>
                      <p className="text-[11px] text-white/60 leading-relaxed">社区关卡无需下载，点击即可在线游玩，支持闯关/节拍/跟练三模式</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <HeartIcon size={14} className="text-rose-400" />
                        <span className="text-xs font-bold text-rose-400">收藏</span>
                      </div>
                      <p className="text-[11px] text-white/60 leading-relaxed">收藏喜欢的关卡，作者下架后仍可在「我的收藏」继续游玩</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <GitFork size={14} className="text-amber-400" />
                        <span className="text-xs font-bold text-amber-400">Fork</span>
                      </div>
                      <p className="text-[11px] text-white/60 leading-relaxed">把社区关卡 Fork 到本地或云端，作为自己的副本自由编辑</p>
                    </div>
                  </div>
                  <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <p className="text-[11px] text-amber-300/80 leading-relaxed">
                      <span className="font-bold">发布提示</span>：闯关/节拍关卡可本地保存无需登录，发布到社区需登录；跟练关卡因含视频文件，创建与发布均需登录。
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 底部操作区 */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-white/5">
          <span className="text-xs text-white/40">← → 切换 · ESC 或点击遮罩关闭</span>
          <button
            onClick={onClose}
            className="flex items-center gap-1 px-5 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-emerald-400 to-cyan-500 hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
          >
            <Check size={16} />
            开始体验
          </button>
        </div>
      </div>
    </div>
  )
}
