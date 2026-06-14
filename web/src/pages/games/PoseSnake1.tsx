import { useEffect, useRef, useState, useCallback } from 'react'
import { Header, Layout, Camera } from '../../components'
import { useGameStore } from '../../store/gameStore'
import { Direction } from '../../hooks/usePoseDetection'

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

type ControlMode = 'keyboard' | 'pose'

export default function PaddleSnacks() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const { connected, roomId, connect } = useGameStore()
  const [snake, setSnake] = useState<SnakeSegment[]>([{ x: 10, y: 10 }])
  const [food, setFood] = useState<SnakeSegment>({ x: 15, y: 15 })
  const [direction, setDirection] = useState<SnakeSegment>({ x: 1, y: 0 })
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [playerName, setPlayerName] = useState('')
  const [controlMode, setControlMode] = useState<ControlMode>('pose')
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
      if (!joinedRef.current) {
        ws.send(JSON.stringify({
          msg_type: 'join_game',
          payload: { game_type: 'pose-snake', player_name: name }
        }))
        joinedRef.current = true
      }
    }

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        if (msg.msg_type === 'match_found') {
          const payload = msg.payload as { room_id: string; player_id: string }
        }
      } catch {
        console.error('Failed to parse message')
      }
    }

    ws.onclose = () => {
      joinedRef.current = false
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  const directionToVector = (dir: Direction): SnakeSegment => {
    switch (dir) {
      case 'left': return { x: -1, y: 0 }
      case 'right': return { x: 1, y: 0 }
      case 'up': return { x: 0, y: -1 }
      case 'down': return { x: 0, y: 1 }
      case 'forward': return { x: 0, y: 0 }
      default: return { x: 0, y: 0 }
    }
  }

  const handlePoseDirection = useCallback((dir: Direction) => {
    if (dir === 'idle' || dir === 'forward') return
    
    const newDir = directionToVector(dir)
    setDirection(prev => {
      if (newDir.x !== -prev.x || newDir.y !== -prev.y) {
        return newDir
      }
      return prev
    })
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (controlMode !== 'keyboard') return
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
  }, [direction, gameOver, controlMode])

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
          newHead.x = (newHead.x + GRID_SIZE) % GRID_SIZE
          newHead.y = (newHead.y + GRID_SIZE) % GRID_SIZE
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
    <Layout>
      <Header title="🐍 PoseSnake" showBack />
      
      <main className="p-8 max-w-5xl mx-auto">
        <div className="flex flex-wrap gap-6 justify-center">
          <div className="flex flex-col items-center">
            <div className="mb-3 flex items-center gap-3 bg-slate-800/50 backdrop-blur rounded-full px-4 py-2">
              <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                connected 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {connected ? '🟢 已连接' : '🔴 未连接'}
              </span>
            </div>

            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setControlMode('pose')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  controlMode === 'pose' 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                📷 体感控制
              </button>
              <button
                onClick={() => setControlMode('keyboard')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  controlMode === 'keyboard' 
                    ? 'bg-primary-600 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                ⌨️ 键盘控制
              </button>
            </div>

            {controlMode === 'pose' ? (
              <Camera
                onDirectionChange={handlePoseDirection}
                enabled={true}
                width={320}
                height={240}
              />
            ) : (
              <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 text-center" style={{ width: 320 }}>
                <p className="text-slate-300 mb-2">使用键盘方向键控制</p>
                <div className="flex flex-col items-center gap-1">
                  <span className="px-3 py-1 bg-slate-700 rounded text-slate-300 text-sm">↑</span>
                  <div className="flex gap-1">
                    <span className="px-3 py-1 bg-slate-700 rounded text-slate-300 text-sm">←</span>
                    <span className="px-3 py-1 bg-slate-700 rounded text-slate-300 text-sm">↓</span>
                    <span className="px-3 py-1 bg-slate-700 rounded text-slate-300 text-sm">→</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center">
            <div className="mb-4 flex items-center gap-4">
              <span className="text-white text-2xl font-bold">Score: {score}</span>
              {roomId && <span className="text-primary-400 text-sm">房间: {roomId.slice(0, 8)}</span>}
            </div>

            <canvas
              ref={canvasRef}
              width={GRID_SIZE * CELL_SIZE}
              height={GRID_SIZE * CELL_SIZE}
              className="border-2 border-slate-600 rounded-lg shadow-lg"
            />

            {gameOver && (
              <div className="mt-4 flex flex-col items-center gap-3">
                <span className="text-red-400 font-bold text-2xl">Game Over!</span>
                <button
                  onClick={handleRestart}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg"
                >
                  重新开始
                </button>
              </div>
            )}

            <div className="mt-4 text-slate-400 text-sm text-center max-w-md">
              {controlMode === 'pose' ? (
                <p>💡 通过摄像头检测人体动作，挥手控制蛇的移动方向</p>
              ) : (
                <p>💡 使用键盘方向键 ↑ ↓ ← → 控制蛇的移动方向</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </Layout>
  )
}
