import { useEffect, useRef, useState, useCallback } from 'react'

const GRID_SIZE = 20
const CELL_SIZE = 20

interface SnakeSegment {
  x: number
  y: number
}

interface WSMessage {
  msg_type: string
  game_id?: string
  player_id?: string
  payload: unknown
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [snake, setSnake] = useState<SnakeSegment[]>([{ x: 10, y: 10 }])
  const [food, setFood] = useState<SnakeSegment>({ x: 15, y: 15 })
  const [direction, setDirection] = useState<SnakeSegment>({ x: 1, y: 0 })
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [playerName, setPlayerName] = useState('')
  const [roomId, setRoomId] = useState<string | null>(null)
  const joinedRef = useRef(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const name = params.get('player') || sessionStorage.getItem('playerName') || 'Player1'
    setPlayerName(name)

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    const ws = new WebSocket('ws://localhost:7080/ws')
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      if (!joinedRef.current) {
        ws.send(JSON.stringify({
          msg_type: 'join_game',
          payload: { game_type: 'paddle-snacks', player_name: name }
        }))
        joinedRef.current = true
      }
    }

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        if (msg.msg_type === 'match_found') {
          const payload = msg.payload as { room_id: string; player_id: string }
          setRoomId(payload.room_id)
        }
      } catch {
        console.error('Failed to parse message')
      }
    }

    ws.onclose = () => {
      setConnected(false)
      joinedRef.current = false
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (gameOver) return

    let newDirection = direction
    switch (e.key) {
      case 'ArrowUp':
        newDirection = { x: 0, y: -1 }
        break
      case 'ArrowDown':
        newDirection = { x: 0, y: 1 }
        break
      case 'ArrowLeft':
        newDirection = { x: -1, y: 0 }
        break
      case 'ArrowRight':
        newDirection = { x: 1, y: 0 }
        break
      default:
        return
    }

    if (newDirection.x !== -direction.x || newDirection.y !== -direction.y) {
      setDirection(newDirection)
    }
  }, [direction, gameOver])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    if (gameOver) return

    const interval = setInterval(() => {
      setSnake(prev => {
        const head = prev[0]
        const newHead = {
          x: head.x + direction.x,
          y: head.y + direction.y
        }

        if (newHead.x < 0 || newHead.x >= GRID_SIZE ||
            newHead.y < 0 || newHead.y >= GRID_SIZE) {
          setGameOver(true)
          return prev
        }

        if (prev.some((seg, i) => i > 0 && seg.x === newHead.x && seg.y === newHead.y)) {
          setGameOver(true)
          return prev
        }

        const newSnake = [newHead, ...prev]

        if (newHead.x === food.x && newHead.y === food.y) {
          setScore(s => s + 10)
          setFood({
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
          })
        } else {
          newSnake.pop()
        }

        return newSnake
      })
    }, 150)

    return () => clearInterval(interval)
  }, [direction, food, gameOver])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.strokeStyle = '#333'
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath()
      ctx.moveTo(i * CELL_SIZE, 0)
      ctx.lineTo(i * CELL_SIZE, canvas.height)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i * CELL_SIZE)
      ctx.lineTo(canvas.width, i * CELL_SIZE)
      ctx.stroke()
    }

    snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? '#4ade80' : '#22c55e'
      ctx.fillRect(seg.x * CELL_SIZE + 1, seg.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2)
    })

    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.arc(food.x * CELL_SIZE + CELL_SIZE / 2, food.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2 - 2, 0, Math.PI * 2)
    ctx.fill()

  }, [snake, food])

  const handleRestart = () => {
    setSnake([{ x: 10, y: 10 }])
    setDirection({ x: 1, y: 0 })
    setFood({ x: 15, y: 15 })
    setScore(0)
    setGameOver(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4">
      <div className="mb-4 flex items-center gap-6">
        <h1 className="text-3xl font-bold text-white">🐍 Paddle Snacks</h1>
        <span className="text-white text-xl">Score: {score}</span>
        {roomId && <span className="text-primary-400 text-sm">房间: {roomId.slice(0, 8)}</span>}
      </div>

      <div className="mb-4 flex items-center gap-4">
        <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
          connected 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {connected ? '🟢 已连接' : '🔴 未连接'}
        </span>
        {gameOver && <span className="text-red-400 font-bold text-lg">Game Over!</span>}
      </div>

      <canvas
        ref={canvasRef}
        width={GRID_SIZE * CELL_SIZE}
        height={GRID_SIZE * CELL_SIZE}
        className="border-2 border-slate-600 rounded-lg shadow-lg"
      />

      <div className="mt-6 text-slate-400 text-sm text-center">
        <p className="text-lg mb-2">使用 ↑ ↓ ← → 方向键控制贪吃蛇</p>
        <p className="text-slate-500">提示: 连接服务器即可与其他玩家对战</p>
      </div>

      {gameOver && (
        <button
          onClick={handleRestart}
          className="mt-6 px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-green-500/30"
        >
          重新开始
        </button>
      )}

      <a 
        href="/" 
        className="mt-4 px-6 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm"
      >
        ← 返回大厅
      </a>
    </div>
  )
}
