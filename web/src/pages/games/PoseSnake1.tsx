import { useEffect, useRef, useState, useCallback } from 'react'
import { Header, Layout, Camera } from '../../components'
import { Direction } from '../../hooks/usePoseDetection'

const GRID_SIZE = 25
const CELL_SIZE = 20
const GAME_SPEED = 150

interface Point {
  x: number
  y: number
}

export default function PoseSnake1() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [score, setScore] = useState(0)
  const [controlMode, setControlMode] = useState<'pose' | 'keyboard'>('pose')
  const [gameStarted, setGameStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [showInstructions, setShowInstructions] = useState(true)
  const [displayMode, setDisplayMode] = useState<'original' | 'drawing' | 'overlay'>('overlay')
  const [mirrored, setMirrored] = useState(true)
  const [splitRatio, setSplitRatio] = useState(25)
  const [isDragging, setIsDragging] = useState(false)
  
  const snakeRef = useRef<Point>({ x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) })
  const bodyRef = useRef<Point[]>([{ x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) }])
  const directionRef = useRef<Point>({ x: 1, y: 0 })
  const foodRef = useRef<Point>({ x: 15, y: 15 })
  const bodySizeRef = useRef(1)
  const gameStartedRef = useRef(false)
  const gameOverRef = useRef(false)
  const gameLoopRef = useRef<number | null>(null)
  const lastTimeRef = useRef(0)

  const generateFood = useCallback(() => {
    let newFood: Point
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      }
    } while (bodyRef.current.some(seg => seg.x === newFood.x && seg.y === newFood.y))
    foodRef.current = newFood
  }, [])

  const resetGame = useCallback(() => {
    snakeRef.current = { x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) }
    bodyRef.current = [{ x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) }]
    directionRef.current = { x: 1, y: 0 }
    bodySizeRef.current = 1
    gameStartedRef.current = false
    gameOverRef.current = false
    setScore(0)
    setGameOver(false)
    setGameStarted(false)
    setShowInstructions(true)
    generateFood()
  }, [generateFood])

  const directionToTurn = (currentDir: Point, gesture: 'left' | 'right'): Point => {
    const { x, y } = currentDir
    if (gesture === 'left') {
      // 左手 = 逆时针
      if (y === -1) return { x: -1, y: 0 }  // 上 → 左
      if (x === -1) return { x: 0, y: 1 }   // 左 → 下
      if (y === 1) return { x: 1, y: 0 }   // 下 → 右
      if (x === 1) return { x: 0, y: -1 }  // 右 → 上
    } else {
      // 右手 = 顺时针
      if (y === -1) return { x: 1, y: 0 }  // 上 → 右
      if (x === 1) return { x: 0, y: 1 }   // 右 → 下
      if (y === 1) return { x: -1, y: 0 }  // 下 → 左
      if (x === -1) return { x: 0, y: -1 } // 左 → 上
    }
    return currentDir
  }

  const handlePoseDirection = useCallback((dir: Direction) => {
    if (!gameStartedRef.current && dir !== 'idle') {
      gameStartedRef.current = true
      setGameStarted(true)
      setShowInstructions(false)
    }
    if (dir === 'left' || dir === 'right') {
      directionRef.current = directionToTurn(directionRef.current, dir)
    }
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

    const width = canvas.width
    const height = canvas.height
    const cellSize = width / GRID_SIZE

    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = '#2a2a4e'
    for (let x = 0; x <= GRID_SIZE; x++) {
      ctx.beginPath()
      ctx.moveTo(x * cellSize, 0)
      ctx.lineTo(x * cellSize, height)
      ctx.stroke()
    }
    for (let y = 0; y <= GRID_SIZE; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * cellSize)
      ctx.lineTo(width, y * cellSize)
      ctx.stroke()
    }

    bodyRef.current.forEach((point, i) => {
      ctx.fillStyle = i === 0 ? '#4ade80' : '#22c55e'
      ctx.fillRect(point.x * cellSize + 1, point.y * cellSize + 1, cellSize - 2, cellSize - 2)
    })

    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.arc(foodRef.current.x * cellSize + cellSize / 2, foodRef.current.y * cellSize + cellSize / 2, cellSize / 2 - 2, 0, Math.PI * 2)
    ctx.fill()
  }, [])

  const gameLoop = useCallback((timestamp: number) => {
    if (!gameStartedRef.current || gameOverRef.current) {
      gameLoopRef.current = requestAnimationFrame(gameLoop)
      render()
      return
    }

    if (timestamp - lastTimeRef.current >= GAME_SPEED) {
      lastTimeRef.current = timestamp

      const newHead = {
        x: snakeRef.current.x + directionRef.current.x,
        y: snakeRef.current.y + directionRef.current.y
      }

      if (newHead.x < 0) newHead.x = GRID_SIZE - 1
      if (newHead.x >= GRID_SIZE) newHead.x = 0
      if (newHead.y < 0) newHead.y = GRID_SIZE - 1
      if (newHead.y >= GRID_SIZE) newHead.y = 0

      if (bodyRef.current.slice(1).some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
        gameOverRef.current = true
        setGameOver(true)
        render()
        gameLoopRef.current = requestAnimationFrame(gameLoop)
        return
      }

      const newBody = [...bodyRef.current]
      for (let i = 0; i < bodySizeRef.current - 1; i++) {
        newBody[i] = newBody[i + 1]
      }
      newBody[bodySizeRef.current - 1] = { ...newHead }
      snakeRef.current = newHead

      if (newHead.x === foodRef.current.x && newHead.y === foodRef.current.y) {
        newBody.push({ ...snakeRef.current })
        bodySizeRef.current++
        setScore(s => s + 1)
        generateFood()
      }

      bodyRef.current = newBody
    }

    render()
    gameLoopRef.current = requestAnimationFrame(gameLoop)
  }, [generateFood, render])

  useEffect(() => {
    gameLoopRef.current = requestAnimationFrame(gameLoop)
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current)
    }
  }, [gameLoop])

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
      <Header title="🐍 PoseSnake" showBack />
      
      <main ref={containerRef} className="flex h-[calc(100vh-80px)] select-none relative">
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

          <div className="mt-auto flex gap-3">
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

        <div className="flex-1 flex items-center justify-center p-4 relative">
          <canvas
            ref={canvasRef}
            width={600}
            height={600}
            className="border-2 border-slate-600 rounded-lg shadow-lg"
            style={{ maxWidth: 'calc(100vh - 120px)', maxHeight: 'calc(100vh - 120px)' }}
          />
          
          {showInstructions && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center text-slate-400 max-w-md">
              <p className="text-sm">
                {controlMode === 'pose' 
                  ? '💡 举起左手向左转，举起右手向右转' 
                  : '💡 ← → 左右转向，蛇一直前进'}
              </p>
            </div>
          )}
        </div>

        {gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="bg-slate-800 rounded-2xl p-8 text-center">
              <span className="text-red-400 font-bold text-3xl block mb-4">Game Over!</span>
              <span className="text-white text-xl block mb-6">得分: {score}</span>
              <button
                onClick={resetGame}
                className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg"
              >
                重新开始
              </button>
            </div>
          </div>
        )}
      </main>
    </Layout>
  )
}
