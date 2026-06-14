import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header, Layout } from '../components'
import { useGameStore } from '../store/gameStore'

interface Game {
  id: string
  name: string
  players: string
  description: string
  icon: string
  gradient: string
  path: string
  instructions?: string[]
  features?: string[]
}

const games: Game[] = [
  { 
    id: 'pose-snake', 
    name: 'PoseSnake (四向)', 
    players: '1-1', 
    description: '姿态控制贪吃蛇 - 挥手操控，上下左右移动',
    icon: '🐍',
    gradient: 'from-green-400 to-emerald-500',
    path: '/games/pose-snake',
    instructions: ['站立在摄像头前', '向左挥手控制蛇向左移动', '向右挥手控制蛇向右移动', '向上挥手控制蛇向上移动', '向下挥手控制蛇向下移动'],
    features: ['体感控制', '无需手柄', 'AI 辅助']
  },
  { 
    id: 'pose-snake-2', 
    name: 'PoseSnake 2 (任意方向)', 
    players: '1-1', 
    description: '连续角度控制 - 左右转向，任意方向移动',
    icon: '🐍',
    gradient: 'from-teal-400 to-cyan-500',
    path: '/games/pose-snake-2',
    instructions: ['站立在摄像头前', '左手向左转控制蛇向左转', '右手向右转控制蛇向右转', '蛇会连续转向移动'],
    features: ['360度方向控制', '流畅转向', '极限操作']
  },
  { 
    id: 'pose-match', 
    name: 'Pose Match', 
    players: '1', 
    description: '摆出指定姿势，匹配即得分',
    icon: '🎯',
    gradient: 'from-yellow-400 to-orange-500',
    path: '/games/pose-match',
    instructions: ['屏幕显示目标姿势', '玩家摆出相同姿势', '匹配度达到80%即可得分', '30秒内尽量多得分数'],
    features: ['姿势识别', '反应训练', '体能挑战']
  },
  { 
    id: 'pose-cars', 
    name: 'Pose Cars', 
    players: '1-2', 
    description: '飙车躲避游戏，考验反应速度',
    icon: '🏎️',
    gradient: 'from-red-400 to-orange-500',
    path: '/games/pose-cars',
    instructions: ['使用左右手控制左右移动', '躲避对面来车', '坚持越久分数越高'],
    features: ['双人对抗', '反应训练', '竞技模式']
  },
  { 
    id: 'rl-battle', 
    name: 'RL Battle', 
    players: '2-4', 
    description: 'AI 强化学习对战，极限思考',
    icon: '🤖',
    gradient: 'from-purple-400 to-indigo-500',
    path: '/games/rl-battle',
    instructions: ['与 AI 进行对战', '思考每一步策略', '击败 AI 获得胜利'],
    features: ['AI 对战', '策略思考', '多人竞技']
  },
]

export default function Home() {
  const playerName = useGameStore(state => state.playerName)
  const navigate = useNavigate()
  const [selectedGame, setSelectedGame] = useState<Game>(games[0])

  const handleStartGame = () => {
    navigate(`${selectedGame.path}?player=${encodeURIComponent(playerName)}`)
  }

  return (
    <Layout>
      <Header />
      
      <main className="p-8">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="section-line"></div>
            <h2 className="text-2xl font-bold text-gray-800">选择游戏</h2>
          </div>
          <p className="text-gray-500 ml-12 text-base">选择你喜欢的游戏模式，开始冒险之旅</p>
        </div>
        
        <div className="flex gap-8 h-[calc(100vh-280px)]">
          <div className="w-80 flex-shrink-0 overflow-y-auto space-y-4">
            {games.map((game) => (
              <div
                key={game.id}
                onClick={() => setSelectedGame(game)}
                className={`glass-card rounded-2xl p-5 cursor-pointer transition-all ${
                  selectedGame.id === game.id 
                    ? 'ring-2 ring-primary-400 shadow-lg' 
                    : 'hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${game.gradient} flex items-center justify-center text-3xl`}>
                    {game.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{game.name}</h3>
                    <p className="text-sm text-gray-500">{game.players}人 · {game.description.split(' - ')[0]}</p>
                  </div>
                </div>
              </div>
            ))}
            
            <div className="glass-card rounded-2xl p-5 border-dashed border-2 border-primary-200 flex flex-col items-center justify-center text-center hover:border-primary-400 transition-colors cursor-pointer group">
              <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">✨</div>
              <p className="text-primary-600 font-semibold">更多游戏</p>
              <p className="text-gray-400 text-sm mt-1">敬请期待...</p>
            </div>
          </div>
          
          <div className="flex-1 glass-card rounded-3xl p-8">
            <div className="flex items-start gap-6 mb-8">
              <div className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${selectedGame.gradient} flex items-center justify-center text-6xl`}>
                {selectedGame.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-3xl font-bold text-gray-800 mb-2">{selectedGame.name}</h3>
                <p className="text-lg text-gray-600 mb-3">{selectedGame.description}</p>
                <div className="flex items-center gap-3">
                  <span className="px-4 py-1.5 bg-primary-100 text-primary-700 rounded-full text-sm font-semibold">
                    {selectedGame.players}人
                  </span>
                  {selectedGame.features?.map((feature, i) => (
                    <span key={i} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mb-8">
              <h4 className="text-lg font-bold text-gray-800 mb-4">游戏说明</h4>
              <ul className="space-y-3">
                {selectedGame.instructions?.map((instruction, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-gray-600 pt-0.5">{instruction}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="flex justify-center">
              <button
                onClick={handleStartGame}
                className="btn-primary px-12 py-4 rounded-2xl text-xl font-bold"
              >
                开始游戏
              </button>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="p-8 text-center text-gray-400 text-sm border-t border-gray-200 mt-4 bg-white/50">
        <p>DeepGames Platform · Powered by AI &amp; PaddlePaddle</p>
      </footer>
    </Layout>
  )
}