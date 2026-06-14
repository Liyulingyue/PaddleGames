import { Link } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'

interface HeaderProps {
  title?: string
  showBack?: boolean
}

export default function Header({ title = 'DeepGames', showBack = false }: HeaderProps) {
  const { connected, latency } = useGameStore()

  return (
    <header className="header-gradient backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showBack && (
            <Link 
              to="/" 
              className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm font-medium"
            >
              ← 返回
            </Link>
          )}
          <div>
            <h1 className="text-3xl font-extrabold text-gradient tracking-tight">
              {title}
            </h1>
            <p className="text-gray-500 mt-0.5 text-sm">AI 游戏平台 · 体感 + 智能对战</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {connected && latency !== null && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200">
              <span className="text-blue-600 font-semibold text-sm">延迟: {latency}ms</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-200">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            <span className="text-green-700 font-semibold text-sm">服务正常</span>
          </div>
        </div>
      </div>
    </header>
  )
}
