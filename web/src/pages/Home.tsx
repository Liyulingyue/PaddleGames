import { useState, useEffect } from 'react'
import { Header, Layout, GameCard, ConnectionStatus } from '../components'
import { useGameStore } from '../store/gameStore'

interface Game {
  id: string
  name: string
  players: string
  description: string
  icon: string
  gradient: string
  path: string
}

const games: Game[] = [
  { 
    id: 'pose-snake', 
    name: 'PoseSnake (四向)', 
    players: '1-1', 
    description: '姿态控制贪吃蛇 - 挥手操控，上下左右移动',
    icon: '🐍',
    gradient: 'from-green-400 to-emerald-500',
    path: '/games/pose-snake'
  },
  { 
    id: 'pose-snake-2', 
    name: 'PoseSnake 2 (任意方向)', 
    players: '1-1', 
    description: '连续角度控制 - 左右转向，任意方向移动',
    icon: '🐍',
    gradient: 'from-teal-400 to-cyan-500',
    path: '/games/pose-snake-2'
  },
  { 
    id: 'paddle-cars', 
    name: 'Paddle Cars', 
    players: '1-2', 
    description: '飙车躲避游戏，考验反应速度',
    icon: '🏎️',
    gradient: 'from-red-400 to-orange-500',
    path: '/games/paddle-cars'
  },
  { 
    id: 'rl-battle', 
    name: 'RL Battle', 
    players: '2-4', 
    description: 'AI 强化学习对战，极限思考',
    icon: '🤖',
    gradient: 'from-purple-400 to-indigo-500',
    path: '/games/rl-battle'
  },
]

export default function Home() {
  const [playerNameInput, setPlayerNameInput] = useState('Player1')
  const { connected, connect, disconnect, roomId } = useGameStore()

  useEffect(() => {
    const stored = sessionStorage.getItem('playerName')
    if (stored) {
      setPlayerNameInput(stored)
    }
  }, [])

  const handleConnect = () => {
    if (connected) {
      disconnect()
    } else {
      sessionStorage.setItem('playerName', playerNameInput)
      connect(playerNameInput)
    }
  }

  return (
    <Layout>
      <Header />
      
      <main className="p-8 max-w-6xl mx-auto">
        <div className="glass-card rounded-3xl p-7 mb-8 shadow-card">
          <div className="flex flex-wrap items-end gap-6">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-sm text-gray-600 mb-2 font-semibold">玩家名称</label>
              <input
                type="text"
                value={playerNameInput}
                onChange={e => setPlayerNameInput(e.target.value)}
                placeholder="输入你的名字"
                className="input-field w-full px-5 py-3.5 rounded-2xl text-gray-800 placeholder-gray-400 text-lg"
              />
            </div>
            
            <div className="flex items-center gap-5">
              <button
                onClick={handleConnect}
                className={`btn-primary px-8 py-3.5 rounded-2xl font-bold text-white text-lg whitespace-nowrap ${
                  connected ? 'opacity-75' : ''
                }`}
              >
                {connected ? '断开连接' : '连接服务器'}
              </button>
              
              <ConnectionStatus connected={connected} roomId={roomId} />
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-4 mb-3">
            <div className="section-line"></div>
            <h2 className="text-2xl font-bold text-gray-800">选择游戏</h2>
          </div>
          <p className="text-gray-500 ml-12 text-base">选择你喜欢的游戏模式，开始冒险之旅</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game) => (
            <GameCard
              key={game.id}
              {...game}
              playerName={playerNameInput}
            />
          ))}
          
          <div className="game-card rounded-3xl p-7 border-dashed border-2 border-primary-200 flex flex-col items-center justify-center text-center hover:border-primary-400 transition-colors cursor-pointer group">
            <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">✨</div>
            <p className="text-primary-600 font-semibold text-lg">更多游戏</p>
            <p className="text-gray-400 text-sm mt-1">敬请期待...</p>
          </div>
        </div>
      </main>
      
      <footer className="p-8 text-center text-gray-400 text-sm border-t border-gray-200 mt-8 bg-white/50">
        <p>DeepGames Platform · Powered by AI &amp; PaddlePaddle</p>
      </footer>
    </Layout>
  )
}
