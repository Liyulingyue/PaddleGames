import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Play, Users, Trophy, Monitor, Store, HelpCircle, ChevronRight } from 'lucide-react'
import UserMenu from './UserMenu'
import HelpModal from './HelpModal'

const menuItems = [
  { icon: Play, title: '单人模式', desc: '闯关 · 跟练 · 节拍', path: '/single', color: 'from-emerald-500 to-cyan-500', glow: 'shadow-emerald-500/40' },
  { icon: Users, title: '多人对战', desc: '创建房间 · 异步群战', path: '/multi', color: 'from-purple-500 to-pink-500', glow: 'shadow-purple-500/40' },
  { icon: Trophy, title: '排行榜', desc: '全国 · 好友 · 成就', path: '/leaderboard', color: 'from-amber-500 to-orange-500', glow: 'shadow-amber-500/40' },
  { icon: Store, title: '关卡社区', desc: '社区作品 · Fork · 收藏', path: '/market', color: 'from-cyan-500 to-teal-500', glow: 'shadow-cyan-500/40' },
  { icon: Monitor, title: '沉浸模式', desc: '全屏体感 · 大屏适配', path: '/immersive', color: 'from-teal-500 to-emerald-500', glow: 'shadow-teal-500/40' },
]

export default function MainMenu() {
  const [helpOpen, setHelpOpen] = useState(false)

  // 首次访问首页自动弹出游戏指南（localStorage 记忆，仅弹一次）
  useEffect(() => {
    const shown = localStorage.getItem('home_help_shown')
    if (!shown) {
      setHelpOpen(true)
      localStorage.setItem('home_help_shown', '1')
    }
  }, [])

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 text-white">
      {/* 动态背景：渐变 + 光晕 */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-emerald-950/40 to-slate-950" />
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[32rem] h-[32rem] bg-emerald-600/20 rounded-full blur-3xl animate-float-slow" />
        <div
          className="absolute bottom-1/4 right-1/4 w-[32rem] h-[32rem] bg-cyan-600/20 rounded-full blur-3xl animate-float-slow"
          style={{ animationDelay: '1.5s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] bg-teal-600/10 rounded-full blur-3xl animate-float-slow"
          style={{ animationDelay: '0.8s' }}
        />
      </div>

      {/* 网格底纹 */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* 顶部栏：Logo + 右侧操作 */}
      <header className="relative z-20 flex items-center justify-between px-6 sm:px-10 py-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎯</span>
          <span className="text-xl font-black tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            PoseMatch
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setHelpOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 transition-all"
            aria-label="游戏指南"
          >
            <HelpCircle size={18} />
            <span className="text-sm font-medium hidden sm:inline">指南</span>
          </button>
          <UserMenu variant="menu" />
        </div>
      </header>

      {/* 中心主菜单 */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 pb-16" style={{ minHeight: 'calc(100vh - 88px)' }}>
        {/* 标题 */}
        <div className="text-center mb-12 animate-fade-in-up">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight mb-4">
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              PoseMatch
            </span>
          </h1>
          <p className="text-white/60 text-base sm:text-lg tracking-wide">
            AI 体感姿态匹配 · 让健身像游戏一样有趣
          </p>
        </div>

        {/* 玩法入口 */}
        <nav className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 w-full max-w-6xl">
          {menuItems.map((item, i) => (
            <Link
              key={item.path}
              to={item.path}
              className={`group relative p-6 rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-white/30 transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl ${item.glow} animate-fade-in-up overflow-hidden`}
              style={{ animationDelay: `${0.1 + i * 0.08}s`, animationFillMode: 'both' }}
            >
              {/* 顶部渐变条 */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${item.color} opacity-60 group-hover:opacity-100 transition-opacity`} />

              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <item.icon size={28} className="text-white" />
              </div>
              <h3 className="text-xl font-bold mb-1">{item.title}</h3>
              <p className="text-white/50 text-sm mb-4">{item.desc}</p>
              <div className="flex items-center gap-1 text-white/60 group-hover:text-white transition-colors text-sm font-medium">
                <span>进入</span>
                <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </nav>

        {/* 底部提示 */}
        <p className="mt-12 text-white/30 text-xs tracking-widest">
          打开摄像头 · 本地处理 · 隐私安全
        </p>
      </main>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
