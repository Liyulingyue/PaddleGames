import { useEffect, useRef, useState, useCallback } from 'react'
import { Header, Layout, Camera } from '../../components'
import { useGameStore } from '../../store/gameStore'
import { Direction } from '../../hooks/usePoseDetection'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 800
const BLOCK_SIZE = 12
const STEP_SIZE = 8
const GAME_SPEED = 60

interface Point {
  x: number
  y: number
}

export default function PoseSnake2() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { connected } = useGameStore()
  
  const [score, setScore] = useState(0)
  const [playerName, setPlayerName] = useState('')
  const [controlMode, setControlMode] = useState<'pose' | 'keyboard'>('pose')
  const [gameStarted, setGameStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [showInstructions, setShowInstructions] = useState(true)
  const [displayMode, setDisplayMode] = useState<'original' | 'drawing' | 'overlay'>('overlay')
  const [mirrored, setMirrored] = useState(true)
  const [splitRatio, setSplitRatio] = useState(25)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const snakeRef = useRef<Point>({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 })
  const bodyRef = useRef<Point[]>([{ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }])
  const directionRef = useRef(0)
  const baseDirectionRef = useRef(Math.PI / 2)
  const foodRef = useRef<Point>({ x: 0, y: 0 })
  const bodySizeRef = useRef(1)
  const gameStartedRef = useRef(false)
  const gameOverRef = useRef(false)
  const animationRef = useRef<number | null>(null)
  const lastTimeRef = useRef(0)

  const generateFood = useCallback(() => {
    foodRef.current = {
      x: Math.random() * (CANVAS_WIDTH - 40) + 20,
      y: Math.random() * (CANVAS_HEIGHT - 40) + 20
    }
  }, [])

  const resetGame = useCallback(() => {
    snakeRef.current = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }
    bodyRef.current = [{ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }]
    directionRef.current = 0
    baseDirectionRef.current = Math.PI / 2
    bodySizeRef.current = 1
    gameStartedRef.current = false
    gameOverRef.current = false
    setScore(0)
    setGameOver(false)
    setGameStarted(false)
    setShowInstructions(true)
    generateFood()
  }, [generateFood])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const name = params.get('player') || sessionStorage.getItem('playerName') || 'Player1'
    setPlayerName(name)
    generateFood()
  }, [generateFood])

  const directionToAngle = (dir: Direction): number => {
    switch (dir) {
      case 'left': return -0.3
      case 'right': return 0.3
      case 'forward': return 0
      default: return 0
    }
  }

  const handlePoseDirection = useCallback((dir: Direction) => {
    if (!gameStartedRef.current && dir !== 'idle') {
      gameStartedRef.current = true
      setGameStarted(true)
      setShowInstructions(false)
    }
    if (dir !== 'idle') {
      directionRef.current = directionToAngle(dir)
    }
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const newRatio = ((e.clientX - rect.left) / rect.width) * 100
    setSplitRatio(Math.max(15, Math.min(70, newRatio)))
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (showInstructions && ['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D'].includes(e.key)) {
      gameStartedRef.current = true
      setGameStarted(true)
      setShowInstructions(false)
    }
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        directionRef.current = -0.3
        break
      case 'ArrowRight':
      case 'd':
      case 'D':
        directionRef.current = 0.3
        break
    }
  }, [showInstructions])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    ctx.strokeStyle = '#2a2a4e'
    for (let x = 0; x < CANVAS_WIDTH; x += 50) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, CANVAS_HEIGHT)
      ctx.stroke()
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += 50) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(CANVAS_WIDTH, y)
      ctx.stroke()
    }

    bodyRef.current.forEach((point, i) => {
      ctx.fillStyle = i === 0 ? '#4ade80' : '#22c55e'
      ctx.beginPath()
      ctx.arc(point.x, point.y, BLOCK_SIZE, 0, Math.PI * 2)
      ctx.fill()
    })

    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.arc(foodRef.current.x, foodRef.current.y, BLOCK_SIZE, 0, Math.PI * 2)
    ctx.fill()
  }, [])

  const gameLoop = useCallback((timestamp: number) => {
    if (!gameStartedRef.current || gameOverRef.current) {
      animationRef.current = requestAnimationFrame(gameLoop)
      render()
      return
    }

    if (timestamp - lastTimeRef.current >= GAME_SPEED) {
      lastTimeRef.current = timestamp

      if (controlMode === 'pose') {
        baseDirectionRef.current += directionRef.current
        directionRef.current = 0
        
        if (baseDirectionRef.current > 2 * Math.PI) {
          baseDirectionRef.current -= 2 * Math.PI
        }
        if (baseDirectionRef.current < -2 * Math.PI) {
          baseDirectionRef.current += 2 * Math.PI
        }
      }

      const dx = Math.cos(baseDirectionRef.current) * STEP_SIZE
      const dy = Math.sin(baseDirectionRef.current) * STEP_SIZE

      snakeRef.current.x += dx
      snakeRef.current.y += dy

      if (snakeRef.current.x >= CANVAS_WIDTH) {
        snakeRef.current.x -= CANVAS_WIDTH
      }
      if (snakeRef.current.x < 0) {
        snakeRef.current.x += CANVAS_WIDTH
      }
      if (snakeRef.current.y >= CANVAS_HEIGHT) {
        snakeRef.current.y -= CANVAS_HEIGHT
      }
      if (snakeRef.current.y < 0) {
        snakeRef.current.y += CANVAS_HEIGHT
      }

      const newBody = [...bodyRef.current]
      for (let i = 0; i < bodySizeRef.current - 1; i++) {
        newBody[i] = newBody[i + 1]
      }
      newBody[bodySizeRef.current - 1] = { ...snakeRef.current }

      const dist = Math.sqrt(
        Math.pow(snakeRef.current.x - foodRef.current.x, 2) +
        Math.pow(snakeRef.current.y - foodRef.current.y, 2)
      )

      if (dist <= BLOCK_SIZE * 2) {
        newBody.push({ ...snakeRef.current })
        bodySizeRef.current++
        setScore(s => s + 1)
        generateFood()
      }

      bodyRef.current = newBody
    }

    render()
    animationRef.current = requestAnimationFrame(gameLoop)
  }, [controlMode, generateFood, render])

  useEffect(() => {
    animationRef.current = requestAnimationFrame(gameLoop)
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [gameLoop])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return (
    <Layout>
      <Header title="🎮 PoseSnake 2" showBack />
      
      <main ref={containerRef} className="flex h-[calc(100vh-80px)] select-none">
        <div style={{ width: `${splitRatio}%` }} className="flex-shrink-0 p-6 flex flex-col gap-5 overflow-y-auto h-full">
          <div className="flex items-center justify-center bg-slate-800/50 rounded-xl px-4 py-4">
            <span className="text-white text-2xl font-bold">得分: {score}</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setControlMode('pose')}
              className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors ${
                controlMode === 'pose' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              📷 体感
            </button>
            <button
              onClick={() => setControlMode('keyboard')}
              className={`flex-1 px-3 py-2 rounded-lg font-medium transition-colors ${
                controlMode === 'keyboard' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              ⌨️ 键盘
            </button>
          </div>

          {controlMode === 'pose' ? (
            <>
              <Camera
                onDirectionChange={handlePoseDirection}
                enabled={true}
                width={340}
                height={255}
                mirrored={mirrored}
                displayMode={displayMode}
              />
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs">显示:</span>
                  <div className="flex gap-1">
                    {(['original', 'drawing', 'overlay'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setDisplayMode(mode)}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          displayMode === mode
                            ? 'bg-primary-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {mode === 'original' ? '原图' : mode === 'drawing' ? '绘制' : '叠加'}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-slate-300 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mirrored}
                    onChange={(e) => setMirrored(e.target.checked)}
                    className="rounded"
                  />
                  镜像
                </label>
              </div>

              <div className="bg-slate-800/50 rounded-xl p-4 space-y-2">
                <p className="text-white text-sm">🎮 体感: 左手左转，右手右转</p>
                <p className="text-white text-sm">⌨️ 键盘: ← → 转向</p>
                <p className="text-white text-sm">🐍 吃到食物得分，穿墙得分</p>
              </div>
            </>
          ) : (
            <div className="bg-slate-800/50 rounded-xl p-4 text-center">
              <p className="text-slate-300 mb-2 text-sm">按 ← → 开始转向</p>
              <div className="flex flex-col items-center gap-1 text-xs">
                <span className="px-3 py-1 bg-slate-700 rounded text-slate-300">← → 左右转向</span>
                <span className="px-3 py-1 bg-slate-700 rounded text-slate-300">A/D 键也可以</span>
              </div>
            </div>
          )}

          {!gameStarted && !gameOver && showInstructions && (
            <div className="text-center text-slate-400 text-sm">
              <p className="mb-2">举起左手向左转</p>
              <p>举起右手向右转</p>
            </div>
          )}

          {gameOver && (
            <div className="flex flex-col items-center gap-3">
              <span className="text-red-400 font-bold text-2xl">Game Over!</span>
              <button
                onClick={resetGame}
                className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg"
              >
                重新开始
              </button>
            </div>
          )}

          <div className="flex gap-3 mt-auto">
            {!gameStarted && !gameOver && (
              <button
                onClick={() => {
                  gameStartedRef.current = true
                  setGameStarted(true)
                  setShowInstructions(false)
                }}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg"
              >
                开始游戏
              </button>
            )}
            {(gameStarted || gameOver) && (
              <button
                onClick={resetGame}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg"
              >
                重新开始
              </button>
            )}
          </div>
        </div>

        <div
          onMouseDown={handleMouseDown}
          className="w-1 bg-gray-300 cursor-col-resize flex-shrink-0 hover:bg-primary-400 transition-colors"
        />

        <div className="flex-1 flex items-center justify-center p-4">
          <canvas
            ref={canvasRef}
            width={800}
            height={800}
            className="border-2 border-slate-600 rounded-lg shadow-lg w-full h-full"
            style={{ maxWidth: 'calc(100vh - 120px)', maxHeight: 'calc(100vh - 120px)' }}
          />
          
          {showInstructions && (
            <div className="mt-4 text-center text-slate-400 max-w-md">
              <p className="text-lg font-semibold text-white mb-2">🎮 PoseSnake 2</p>
              <p className="text-sm">
                {controlMode === 'pose' 
                  ? '💡 举起左手向左转，举起右手向右转' 
                  : '💡 ← → 左右转向，蛇一直前进'}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                蛇从屏幕另一侧穿出，吃到食物得分
              </p>
            </div>
          )}
        </div>
      </main>
    </Layout>
  )
}
