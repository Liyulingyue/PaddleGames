import { useEffect, useRef, useState, useCallback } from 'react'
import { Header, Layout, Camera } from '../../components'
import { useGameStore } from '../../store/gameStore'

const GAME_WIDTH = 400
const GAME_HEIGHT = 600
const CAR_WIDTH = 40
const CAR_HEIGHT = 70
const ROAD_LEFT = 50
const ROAD_RIGHT = 350
const LANE_WIDTH = 60

interface Car {
  x: number
  y: number
  speed: number
}

interface PoseResult {
  direction: string
  hasPerson: boolean
  keypoints?: any[]
}

export default function PoseCars() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [score, setScore] = useState(0)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [showInstructions, setShowInstructions] = useState(true)
  const [displayMode, setDisplayMode] = useState<'original' | 'drawing' | 'overlay'>('overlay')
  const [mirrored, setMirrored] = useState(true)
  const [splitRatio, setSplitRatio] = useState(25)
  const [isDragging, setIsDragging] = useState(false)
  const [steerAngle, setSteerAngle] = useState(0)
  
  const playerCarRef = useRef<Car>({ x: GAME_WIDTH / 2, y: GAME_HEIGHT - 100, speed: 5 })
  const enemyCarsRef = useRef<Car[]>([])
  const gameLoopRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const lastTimeRef = useRef(0)
  const steerAngleRef = useRef(0)
  const startTimeRef = useRef(0)
  const lastEnemySpawnRef = useRef(0)

  const resetGame = useCallback(() => {
    playerCarRef.current = { x: GAME_WIDTH / 2, y: GAME_HEIGHT - 100, speed: 5 }
    enemyCarsRef.current = []
    steerAngleRef.current = 0
    setSteerAngle(0)
    setScore(0)
    setGameOver(false)
    setGameStarted(false)
    setShowInstructions(true)
    if (timerRef.current) clearInterval(timerRef.current)
    startTimeRef.current = 0
  }, [])

  const startGame = useCallback(() => {
    setGameStarted(true)
    setShowInstructions(false)
    startTimeRef.current = Date.now()
    lastEnemySpawnRef.current = 0
    
    timerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      const minutes = Math.floor(elapsed / 60)
      const seconds = Math.floor(elapsed % 60)
      setScore(`${minutes}:${seconds.toString().padStart(2, '0')}`)
    }, 1000)
  }, [])

  const handlePoseResult = useCallback((hasPerson: boolean, landmarks: any[] | null) => {
    if (!hasPerson || !landmarks || landmarks.length < 17) {
      steerAngleRef.current = 0
      setSteerAngle(0)
      return
    }

    const leftWrist = landmarks[15]
    const rightWrist = landmarks[16]
    
    if (!leftWrist || !rightWrist) {
      steerAngleRef.current = 0
      setSteerAngle(0)
      return
    }

    const dx = rightWrist.x - leftWrist.x
    const dy = rightWrist.y - leftWrist.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance < 0.08) {
      if (!gameStarted && !gameOver) {
        startGame()
      }
      steerAngleRef.current = 0
      setSteerAngle(0)
      return
    }

    const angle = Math.atan2(dy, dx) - Math.PI / 2
    steerAngleRef.current = angle
    setSteerAngle(angle)

    if (!gameStarted && !gameOver && Math.abs(angle) > 0.2) {
      startGame()
    }
  }, [gameStarted, gameOver, startGame])

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#87CEEB'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    ctx.fillStyle = '#228B22'
    ctx.fillRect(0, 0, ROAD_LEFT, GAME_HEIGHT)
    ctx.fillRect(ROAD_RIGHT, 0, GAME_WIDTH - ROAD_RIGHT, GAME_HEIGHT)

    ctx.fillStyle = '#555'
    ctx.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, GAME_HEIGHT)

    ctx.strokeStyle = '#FFF'
    ctx.setLineDash([30, 20])
    ctx.lineWidth = 3
    for (let lane = 1; lane < 5; lane++) {
      const x = ROAD_LEFT + lane * LANE_WIDTH
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.moveTo(x, GAME_HEIGHT)
      ctx.stroke()
    }
    ctx.setLineDash([])

    ctx.fillStyle = '#4169E1'
    const car = playerCarRef.current
    ctx.fillRect(car.x - CAR_WIDTH / 2, car.y - CAR_HEIGHT / 2, CAR_WIDTH, CAR_HEIGHT)
    ctx.fillStyle = '#1E90FF'
    ctx.fillRect(car.x - CAR_WIDTH / 2 + 5, car.y - CAR_HEIGHT / 2 + 5, 10, 15)
    ctx.fillRect(car.x + CAR_WIDTH / 2 - 15, car.y - CAR_HEIGHT / 2 + 5, 10, 15)
    ctx.fillStyle = '#FF4444'
    ctx.fillRect(car.x - CAR_WIDTH / 2 + 5, car.y + CAR_HEIGHT / 2 - 15, 10, 10)
    ctx.fillRect(car.x + CAR_WIDTH / 2 - 15, car.y + CAR_HEIGHT / 2 - 15, 10, 10)

    ctx.fillStyle = '#DC143C'
    enemyCarsRef.current.forEach(enemy => {
      ctx.fillRect(enemy.x - CAR_WIDTH / 2, enemy.y - CAR_HEIGHT / 2, CAR_WIDTH, CAR_HEIGHT)
      ctx.fillStyle = '#8B0000'
      ctx.fillRect(enemy.x - CAR_WIDTH / 2 + 5, enemy.y - CAR_HEIGHT / 2 + 5, 10, 15)
      ctx.fillRect(enemy.x + CAR_WIDTH / 2 - 15, enemy.y - CAR_HEIGHT / 2 + 5, 10, 15)
      ctx.fillStyle = '#FFFF00'
      ctx.fillRect(enemy.x - CAR_WIDTH / 2 + 5, enemy.y + CAR_HEIGHT / 2 - 15, 10, 10)
      ctx.fillRect(enemy.x + CAR_WIDTH / 2 - 15, enemy.y + CAR_HEIGHT / 2 - 15, 10, 10)
      ctx.fillStyle = '#DC143C'
    })

    ctx.fillStyle = '#333'
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`${score}`, 10, 30)

    if (Math.abs(steerAngleRef.current) > 0.1) {
      ctx.fillStyle = 'rgba(0, 255, 0, 0.3)'
      ctx.beginPath()
      ctx.arc(GAME_WIDTH / 2, GAME_HEIGHT - 50, 40, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#0F0'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(GAME_WIDTH / 2, GAME_HEIGHT - 50)
      ctx.lineTo(
        GAME_WIDTH / 2 + Math.sin(steerAngleRef.current) * 35,
        GAME_HEIGHT - 50 - Math.cos(steerAngleRef.current) * 35
      )
      ctx.stroke()
    }
  }, [score])

  const gameLoop = useCallback((timestamp: number) => {
    if (!gameStarted || gameOver) {
      gameLoopRef.current = requestAnimationFrame(gameLoop)
      render()
      return
    }

    if (timestamp - lastTimeRef.current >= 16) {
      lastTimeRef.current = timestamp

      const angle = steerAngleRef.current
      playerCarRef.current.x += angle * 8

      if (playerCarRef.current.x < ROAD_LEFT + CAR_WIDTH / 2) {
        playerCarRef.current.x = ROAD_LEFT + CAR_WIDTH / 2
      }
      if (playerCarRef.current.x > ROAD_RIGHT - CAR_WIDTH / 2) {
        playerCarRef.current.x = ROAD_RIGHT - CAR_WIDTH / 2
      }

      if (timestamp - lastEnemySpawnRef.current > 800) {
        const lane = Math.floor(Math.random() * 5)
        const x = ROAD_LEFT + LANE_WIDTH / 2 + lane * LANE_WIDTH
        enemyCarsRef.current.push({
          x,
          y: -CAR_HEIGHT,
          speed: 3 + Math.random() * 3
        })
        lastEnemySpawnRef.current = timestamp
      }

      enemyCarsRef.current.forEach(enemy => {
        enemy.y += enemy.speed
      })

      enemyCarsRef.current = enemyCarsRef.current.filter(enemy => enemy.y < GAME_HEIGHT + CAR_HEIGHT)

      for (const enemy of enemyCarsRef.current) {
        if (
          Math.abs(playerCarRef.current.x - enemy.x) < CAR_WIDTH * 0.8 &&
          Math.abs(playerCarRef.current.y - enemy.y) < CAR_HEIGHT * 0.8
        ) {
          setGameOver(true)
          if (timerRef.current) clearInterval(timerRef.current)
          break
        }
      }
    }

    render()
    gameLoopRef.current = requestAnimationFrame(gameLoop)
  }, [gameStarted, gameOver, render])

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
      <Header title="🏎️ Pose Cars" showBack />
      
      <main ref={containerRef} className="flex h-[calc(100vh-80px)] select-none">
        <div style={{ width: `${splitRatio}%` }} className="flex-shrink-0 p-6 flex flex-col gap-5 overflow-y-auto h-full">
          <div className="flex items-center justify-center bg-slate-800/50 rounded-xl px-4 py-4">
            <span className="text-white text-2xl font-bold">得分: {score}</span>
          </div>

          <div className="flex items-center justify-center gap-3 bg-slate-800/50 rounded-xl px-4 py-3">
            <div className={`w-4 h-4 rounded-full ${gameStarted ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
            <span className="text-white text-sm">{gameStarted ? '游戏中' : gameOver ? '结束' : '等待开始'}</span>
          </div>

          <Camera
            onDirectionChange={() => {}}
            enabled={true}
            width={340}
            height={255}
            mirrored={mirrored}
            displayMode={displayMode}
            onPoseResult={handlePoseResult}
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
            <p className="text-white text-sm">🎮 双手举起作为方向盘</p>
            <p className="text-white text-sm">⌨️ 两手交叉开始游戏</p>
            <p className="text-white text-sm">🏎️ 躲避对面来车，坚持更久</p>
          </div>

          <div className="mt-auto flex gap-3">
            {(gameOver || !gameStarted) && (
              <button
                onClick={resetGame}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg"
              >
                {gameOver ? '重新开始' : '开始游戏'}
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
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            className="border-2 border-slate-600 rounded-lg shadow-lg"
            style={{ maxWidth: 'calc(100vh - 120px)', maxHeight: 'calc(100vh - 120px)' }}
          />
          
          {showInstructions && !gameStarted && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center text-slate-400 max-w-md bg-black/50 p-4 rounded-xl">
              <p className="text-sm mb-2">🎮 双手举起作为方向盘</p>
              <p className="text-sm mb-2">✋ 两手交叉开始游戏</p>
              <p className="text-sm">🏎️ 躲避对面来车</p>
            </div>
          )}
        </div>

        {gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="bg-slate-800 rounded-2xl p-8 text-center">
              <span className="text-red-400 font-bold text-3xl block mb-4">撞车了!</span>
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
