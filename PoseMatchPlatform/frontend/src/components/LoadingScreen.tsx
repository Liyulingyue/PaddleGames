import { useEffect, useState } from 'react'

const MEDIAPIPE_SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js',
]

interface LoadingScreenProps {
  onComplete: () => void
}

declare global {
  interface Window {
    Pose: any
  }
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('初始化中...')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadScript = (src: string) =>
      new Promise<void>((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve()
          return
        }
        const script = document.createElement('script')
        script.src = src
        script.crossOrigin = 'anonymous'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error(`加载失败: ${src}`))
        document.head.appendChild(script)
      })

    const boot = async () => {
      try {
        // 阶段 1：加载核心脚本（0-50%）
        for (let i = 0; i < MEDIAPIPE_SCRIPTS.length; i++) {
          setStage(`加载核心模块 (${i + 1}/${MEDIAPIPE_SCRIPTS.length})`)
          await loadScript(MEDIAPIPE_SCRIPTS[i])
          if (!mounted) return
          setProgress(Math.round(((i + 1) / MEDIAPIPE_SCRIPTS.length) * 50))
        }

        // 阶段 2：初始化姿态检测模型（50-80%）
        if (typeof window.Pose === 'undefined') {
          throw new Error('Pose 模块未就绪')
        }
        setStage('初始化姿态检测模型...')
        setProgress(60)

        const pose = new window.Pose({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        })
        pose.setOptions({
          modelComplexity: 0,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })

        // 阶段 3：预热 —— 发送一帧空白图像触发 WASM/模型文件下载（80-95%）
        setStage('预热模型（下载推理引擎）...')
        setProgress(80)

        const warmupCanvas = document.createElement('canvas')
        warmupCanvas.width = 640
        warmupCanvas.height = 480
        const wctx = warmupCanvas.getContext('2d')!
        wctx.fillStyle = '#000'
        wctx.fillRect(0, 0, 640, 480)

        await new Promise<void>((resolve) => {
          let done = false
          const finish = () => {
            if (!done) { done = true; resolve() }
          }
          pose.onResults(() => finish())
          pose.send({ image: warmupCanvas }).then(finish).catch(finish)
          // 安全超时，避免卡死
          setTimeout(finish, 10000)
        })

        if (!mounted) return

        try { await pose.close() } catch {}

        // 阶段 4：完成（95-100%）
        setProgress(100)
        setStage('准备就绪')
        setTimeout(() => {
          if (mounted) setReady(true)
        }, 500)
      } catch (e: any) {
        if (!mounted) return
        setError(e.message || '加载失败')
        // 失败也允许进入，后续页面会再次尝试加载
        setProgress(100)
        setReady(true)
      }
    }

    boot()
    return () => { mounted = false }
  }, [])

  // 任意键进入
  useEffect(() => {
    if (!ready) return
    const onKey = () => onComplete()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ready, onComplete])

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black overflow-hidden">
      {/* 背景光晕动效 */}
      <div className="absolute inset-0 opacity-50">
        <div className="absolute top-1/4 left-1/4 w-[28rem] h-[28rem] bg-emerald-600/30 rounded-full blur-3xl animate-pulse-slow" />
        <div
          className="absolute bottom-1/4 right-1/4 w-[28rem] h-[28rem] bg-cyan-600/30 rounded-full blur-3xl animate-pulse-slow"
          style={{ animationDelay: '1.2s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[24rem] h-[24rem] bg-teal-600/20 rounded-full blur-3xl animate-pulse-slow"
          style={{ animationDelay: '0.6s' }}
        />
      </div>

      {/* 中心内容 */}
      <div className="relative z-10 flex flex-col items-center px-6 max-w-2xl w-full">
        {/* Logo / 标题 */}
        <div className="mb-12 text-center">
          <div className="text-7xl mb-4 animate-bounce-slow">🎯</div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight bg-gradient-to-r from-emerald-400 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
            PoseMatch
          </h1>
          <p className="text-white/50 text-sm mt-3 tracking-[0.3em] uppercase">
            AI Pose Matching
          </p>
        </div>

        {!ready ? (
          <>
            {/* 加载条 */}
            <div className="w-full max-w-md">
              <div className="flex items-center justify-between mb-2 text-xs text-white/60">
                <span className="truncate mr-3">{stage}</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 via-cyan-500 to-cyan-600 transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {error && (
              <p className="mt-6 text-xs text-amber-400/80 text-center max-w-md">
                部分模块加载失败（{error}），仍可进入。首次进入游戏时将再次尝试加载。
              </p>
            )}
          </>
        ) : (
          <>
            {/* Press Start */}
            <button
              onClick={onComplete}
              className="group mt-2 px-12 py-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-500 hover:shadow-2xl hover:shadow-cyan-500/40 transition-all duration-300 hover:scale-105 animate-press-pulse"
            >
              <span className="text-xl font-bold tracking-wider">按任意键开始</span>
            </button>
            <p className="mt-4 text-white/40 text-xs tracking-wider">
              点击按钮或按任意键进入主菜单
            </p>

            {error && (
              <p className="mt-4 text-xs text-amber-400/70 text-center max-w-md">
                模型预热失败，仍可进入（游戏内首次使用摄像头时会再次加载）
              </p>
            )}
          </>
        )}
      </div>

      <div className="absolute bottom-6 text-white/30 text-xs tracking-wider">
        v1.0 · Powered by MediaPipe Pose
      </div>
    </div>
  )
}
