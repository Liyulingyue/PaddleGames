import { useEffect, useRef, useState, useCallback } from 'react'
import { Header, Layout, Camera } from '../../components'
import { useGameStore } from '../../store/gameStore'

const TARGET_WIDTH = 400
const TARGET_HEIGHT = 400

type PoseName = 't-pose' | 'hands-up' | 'left-arm' | 'right-arm' | 'warrior' | 'tree'

interface TargetPose {
  name: string
  label: string
  icon: string
  description: string
  armsAngle: number
  leftArmUp: boolean
  rightArmUp: boolean
  armsForward: boolean
}

const TARGET_POSES: TargetPose[] = [
  { name: 't-pose', label: 'T字站', icon: '🤸', description: '双臂水平展开', armsAngle: 0, leftArmUp: false, rightArmUp: false, armsForward: false },
  { name: 'hands-up', label: '举手', icon: '🙋', description: '双手上举', armsAngle: -1.5, leftArmUp: true, rightArmUp: true, armsForward: false },
  { name: 'left-arm', label: '左手', icon: '👈', description: '左手侧平举', armsAngle: 0, leftArmUp: false, rightArmUp: false, armsForward: false },
  { name: 'right-arm', label: '右手', icon: '👉', description: '右手侧平举', armsAngle: 0, leftArmUp: false, rightArmUp: false, armsForward: false },
  { name: 'warrior', label: '武士', icon: '⚔️', description: '左手前伸右手上举', armsAngle: 0, leftArmUp: false, rightArmUp: true, armsForward: true },
  { name: 'tree', label: '树式', icon: '🧘', description: '双手上举平衡', armsAngle: -1.5, leftArmUp: true, rightArmUp: true, armsForward: false },
]

export default function PoseMatch() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { connected } = useGameStore()
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [score, setScore] = useState(0)
  const [gameStarted, setGameStarted] = useState(false)
  const [timeLeft, setTimeLeft] = useState(30)
  const [currentPose, setCurrentPose] = useState<TargetPose>(TARGET_POSES[0])
  const [matchScore, setMatchScore] = useState(0)
  const [displayMode, setDisplayMode] = useState<'original' | 'drawing' | 'overlay'>('overlay')
  const [mirrored, setMirrored] = useState(true)
  const [splitRatio, setSplitRatio] = useState(25)
  const [isDragging, setIsDragging] = useState(false)
  const [matched, setMatched] = useState(false)
  
  const gameLoopRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const poseLandmarksRef = useRef<any[] | null>(null)
  const lastPoseMatchRef = useRef(0)

  const drawTargetPose = useCallback((ctx: CanvasRenderingContext2D, pose: TargetPose, width: number, height: number) => {
    const cx = width / 2
    const cy = height / 2
    const scale = Math.min(width, height) * 0.15

    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 3

    ctx.beginPath()
    ctx.arc(cx, cy - scale * 2, 12, 0, Math.PI * 2)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(cx, cy - scale * 1.5)
    ctx.lineTo(cx, cy + scale * 1)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(cx - scale * 1.5, cy - scale)
    ctx.lineTo(cx + scale * 1.5, cy - scale)
    ctx.stroke()

    if (pose.name === 'hands-up' || pose.name === 'tree') {
      ctx.beginPath()
      ctx.moveTo(cx, cy - scale)
      ctx.lineTo(cx - scale * 0.8, cy - scale * 3)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx, cy - scale)
      ctx.lineTo(cx + scale * 0.8, cy - scale * 3)
      ctx.stroke()
    } else if (pose.name === 'warrior') {
      ctx.beginPath()
      ctx.moveTo(cx, cy - scale)
      ctx.lineTo(cx - scale * 1.2, cy - scale * 0.5)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx, cy - scale)
      ctx.lineTo(cx + scale * 0.5, cy - scale * 3)
      ctx.stroke()
    } else if (pose.name === 'left-arm') {
      ctx.beginPath()
      ctx.moveTo(cx, cy - scale)
      ctx.lineTo(cx - scale * 2, cy - scale)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx, cy - scale)
      ctx.lineTo(cx + scale * 0.5, cy - scale * 0.5)
      ctx.stroke()
    } else if (pose.name === 'right-arm') {
      ctx.beginPath()
      ctx.moveTo(cx, cy - scale)
      ctx.lineTo(cx + scale * 2, cy - scale)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx, cy - scale)
      ctx.lineTo(cx - scale * 0.5, cy - scale * 0.5)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.moveTo(cx, cy - scale)
      ctx.lineTo(cx - scale * 1.5, cy - scale)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx, cy - scale)
      ctx.lineTo(cx + scale * 1.5, cy - scale)
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx - scale * 0.8, cy + scale * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + scale * 0.8, cy + scale * 2)
    ctx.stroke()

    ctx.fillStyle = '#ef4444'
    ctx.font = `bold ${Math.max(16, scale * 0.4)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(pose.label, cx, height - 20)
  }, [])

  const calculateMatch = useCallback((landmarks: any[]): number => {
    if (!landmarks || landmarks.length < 17) return 0

    const getKeypoint = (name: string) => {
      const idx = ['NOSE', 'LEFT_EYE_INNER', 'LEFT_EYE', 'LEFT_EYE_OUTER', 
                 'RIGHT_EYE_INNER', 'RIGHT_EYE', 'RIGHT_EYE_OUTER',
                 'LEFT_EAR', 'RIGHT_EAR', 'MOUTH_LEFT', 'MOUTH_RIGHT',
                 'LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_ELBOW', 'RIGHT_ELBOW',
                 'LEFT_WRIST', 'RIGHT_WRIST'].indexOf(name)
      return idx >= 0 ? landmarks[idx] : null
    }

    const leftShoulder = getKeypoint('LEFT_SHOULDER')
    const rightShoulder = getKeypoint('RIGHT_SHOULDER')
    const leftElbow = getKeypoint('LEFT_ELBOW')
    const rightElbow = getKeypoint('RIGHT_ELBOW')
    const leftWrist = getKeypoint('LEFT_WRIST')
    const rightWrist = getKeypoint('RIGHT_WRIST')

    if (!leftShoulder || !rightShoulder || !leftElbow || !rightElbow || !leftWrist || !rightWrist) return 0

    const leftArmAngle = Math.atan2(leftWrist.y - leftShoulder.y, leftWrist.x - leftShoulder.x)
    const rightArmAngle = Math.atan2(rightWrist.y - rightShoulder.y, rightWrist.x - rightShoulder.x)

    const leftArmUp = leftArmAngle < -0.5
    const rightArmUp = rightArmAngle < -0.5
    const armsForward = Math.abs(leftArmAngle) < 0.3 || Math.abs(rightArmAngle) < 0.3

    let score = 0

    if (currentPose.name === 't-pose') {
      const leftDiff = Math.abs(leftArmAngle - 0)
      const rightDiff = Math.abs(rightArmAngle - 0)
      const leftCorrect = leftDiff < 0.4 && !leftArmUp
      const rightCorrect = rightDiff < 0.4 && !rightArmUp
      if (leftCorrect) score += 50
      if (rightCorrect) score += 50
    } else if (currentPose.name === 'hands-up' || currentPose.name === 'tree') {
      if (leftArmUp) score += 50
      if (rightArmUp) score += 50
    } else if (currentPose.name === 'left-arm') {
      const leftDiff = Math.abs(leftArmAngle - 0)
      if (leftDiff < 0.4 && !leftArmUp) score += 50
      if (!rightArmUp && Math.abs(rightArmAngle) > 1) score += 50
    } else if (currentPose.name === 'right-arm') {
      const rightDiff = Math.abs(rightArmAngle - 0)
      if (rightDiff < 0.4 && !rightArmUp) score += 50
      if (!leftArmUp && Math.abs(leftArmAngle) > 1) score += 50
    } else if (currentPose.name === 'warrior') {
      if (armsForward) score += 50
      if (rightArmUp) score += 50
    }

    return Math.min(100, score)
  }, [currentPose])

  const startGame = useCallback(() => {
    setGameStarted(true)
    setScore(0)
    setTimeLeft(30)
    setMatched(false)
    const randomPose = TARGET_POSES[Math.floor(Math.random() * TARGET_POSES.length)]
    setCurrentPose(randomPose)
  }, [])

  const resetGame = useCallback(() => {
    setGameStarted(false)
    setScore(0)
    setTimeLeft(30)
    setMatched(false)
    setMatchScore(0)
    if (timerRef.current) clearInterval(timerRef.current)
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current)
  }, [])

  useEffect(() => {
    if (!gameStarted) return

    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          resetGame()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [gameStarted, resetGame])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawTargetPose(ctx, currentPose, canvas.width, canvas.height)
  }, [currentPose, drawTargetPose])

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

  const handlePoseResult = useCallback((hasPerson: boolean, landmarks: any[] | null) => {
    if (!gameStarted || matched) return
    
    if (hasPerson && landmarks) {
      poseLandmarksRef.current = landmarks
      const match = calculateMatch(landmarks)
      setMatchScore(match)
      
      const now = Date.now()
      if (match >= 80 && now - lastPoseMatchRef.current > 1000) {
        setScore(prev => prev + 1)
        setMatched(true)
        lastPoseMatchRef.current = now
        
        setTimeout(() => {
          const randomPose = TARGET_POSES[Math.floor(Math.random() * TARGET_POSES.length)]
          setCurrentPose(randomPose)
          setMatched(false)
        }, 500)
      }
    }
  }, [gameStarted, matched, calculateMatch])

  return (
    <Layout>
      <Header title="🎯 Pose Match" showBack />
      
      <main ref={containerRef} className="flex h-[calc(100vh-80px)] select-none">
        <div style={{ width: `${splitRatio}%` }} className="flex-shrink-0 p-6 flex flex-col gap-5 overflow-y-auto">
          <div className="bg-slate-800/50 rounded-xl px-4 py-4 text-center">
            <span className="text-white text-2xl font-bold">得分: {score}</span>
          </div>

          {gameStarted && (
            <div className="bg-slate-800/50 rounded-xl px-4 py-3 text-center">
              <span className={`text-2xl font-bold ${timeLeft <= 10 ? 'text-red-400' : 'text-white'}`}>
                {timeLeft}秒
              </span>
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <div className={`text-4xl ${matched ? 'animate-bounce' : ''}`}>{currentPose.icon}</div>
            <div className="text-center">
              <div className="text-white text-xl font-bold">{currentPose.label}</div>
              <div className="text-slate-400 text-sm">{currentPose.description}</div>
            </div>
          </div>

          {gameStarted && (
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">匹配度</span>
                <span className={`font-bold ${matchScore >= 80 ? 'text-green-400' : matchScore >= 50 ? 'text-yellow-400' : 'text-white'}`}>
                  {matchScore}%
                </span>
              </div>
              <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-200 ${matchScore >= 80 ? 'bg-green-500' : matchScore >= 50 ? 'bg-yellow-500' : 'bg-primary-500'}`}
                  style={{ width: `${matchScore}%` }}
                />
              </div>
              {matchScore >= 80 && (
                <div className="text-center text-green-400 font-bold mt-2 animate-pulse">✓ 匹配成功!</div>
              )}
            </div>
          )}

          <Camera
            onDirectionChange={() => {}}
            enabled={gameStarted}
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

          <div className="mt-auto flex gap-3">
            {!gameStarted && (
              <button
                onClick={startGame}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg"
              >
                开始游戏
              </button>
            )}
            {gameStarted && (
              <button
                onClick={resetGame}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-bold rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all shadow-lg"
              >
                结束游戏
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
            width={500}
            height={500}
            className="border-2 border-slate-600 rounded-lg shadow-lg w-full h-full"
            style={{ maxWidth: 'calc(100vh - 120px)', maxHeight: 'calc(100vh - 120px)' }}
          />
        </div>
      </main>
    </Layout>
  )
}
