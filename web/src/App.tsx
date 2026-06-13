import { useState } from 'react'

interface Game {
  id: string
  name: string
  players: string
  description: string
}

const games: Game[] = [
  { id: 'paddle-snacks', name: 'Paddle Snacks', players: '1-1', description: '贪吃蛇体感版' },
  { id: 'paddle-cars', name: 'Paddle Cars', players: '1-2', description: '飙车躲避游戏' },
  { id: 'rl-battle', name: 'RL Battle', players: '2-4', description: 'AI 对战' },
]

function App() {
  const [playerName, setPlayerName] = useState('Player1')
  const [connected, setConnected] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      <header className="p-6 border-b border-gray-700">
        <h1 className="text-3xl font-bold">DeepGames</h1>
        <p className="text-gray-400">AI 游戏平台</p>
      </header>

      <main className="p-6">
        <div className="mb-6 flex items-center gap-4">
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="玩家名称"
            className="px-4 py-2 rounded bg-gray-700 border border-gray-600 text-white"
          />
          <button
            onClick={() => setConnected(!connected)}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              connected
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {connected ? '断开连接' : '连接服务器'}
          </button>
          <span className={`px-2 py-1 rounded text-sm ${connected ? 'bg-green-600' : 'bg-red-600'}`}>
            {connected ? '已连接' : '未连接'}
          </span>
        </div>

        <h2 className="text-xl font-semibold mb-4">选择游戏</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map(game => (
            <div key={game.id} className="bg-gray-800 rounded-lg shadow-md p-4">
              <h3 className="text-lg font-semibold mb-2">{game.name}</h3>
              <p className="text-gray-400 text-sm mb-2">{game.description}</p>
              <p className="text-sm text-gray-500">玩家: {game.players}</p>
              <a
                href={`/games/${game.id}`}
                className="mt-3 block w-full text-center px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition-colors"
              >
                加入游戏
              </a>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

export default App
