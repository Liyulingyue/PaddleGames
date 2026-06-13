import { useEffect, useRef, useState, useCallback } from 'react'

const GRID_SIZE = 20
const CELL_SIZE = 20

interface SnakeSegment {
  x: number
  y: number
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [connected] = useState(false)
  const [snake, setSnake] = useState<SnakeSegment[]>([{ x: 10, y: 10 }])
  const [food, setFood] = useState<SnakeSegment>({ x: 15, y: 15 })
  const [direction, setDirection] = useState<SnakeSegment>({ x: 1, y: 0 })
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)

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
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold text-white mb-4">Paddle Snacks</h1>

      <div className="mb-4 flex items-center gap-4">
        <span className="text-white">Score: {score}</span>
        {gameOver && <span className="text-red-500 font-bold">Game Over!</span>}
        <span className={`px-2 py-1 rounded text-sm ${connected ? 'bg-green-600' : 'bg-red-600'} text-white`}>
          {connected ? 'Connected' : 'Local Mode'}
        </span>
      </div>

      <canvas
        ref={canvasRef}
        width={GRID_SIZE * CELL_SIZE}
        height={GRID_SIZE * CELL_SIZE}
        className="border-2 border-gray-700 rounded"
      />

      <div className="mt-4 text-gray-400 text-sm">
        <p>Use Arrow Keys to control the snake</p>
        <p className="mt-2">Tip: Connect to server for multiplayer mode</p>
      </div>

      {gameOver && (
        <button
          onClick={handleRestart}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Restart
        </button>
      )}
    </div>
  )
}
