import { useEffect, useRef, useState } from 'react'
import { useMediaPipePose } from '../hooks/useMediaPipePose'
import { Direction } from '../hooks/usePoseDetection'

interface CameraProps {
  onDirectionChange: (direction: Direction) => void
  enabled?: boolean
  width?: number
  height?: number
}

export default function Camera({ 
  onDirectionChange, 
  enabled = true, 
  width = 320, 
  height = 240
}: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [mirrored, setMirrored] = useState(true)
  const [videoLoaded, setVideoLoaded] = useState(false)

  const { poseResult, isDetecting, hasPerson, error, canvasRef } = useMediaPipePose(
    videoRef,
    onDirectionChange,
    enabled
  )

  useEffect(() => {
    if (!enabled) {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
        setStream(null)
      }
      return
    }

    let mounted = true

    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: width },
            height: { ideal: height },
            facingMode: 'user'
          }
        })
        if (mounted) {
          setStream(mediaStream)
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream
            videoRef.current.onloadedmetadata = () => {
              setVideoLoaded(true)
            }
          }
          setCameraError(null)
        }
      } catch (err) {
        console.error('Camera error:', err)
        if (mounted) {
          setCameraError('无法访问摄像头，请确保已授权摄像头权限')
        }
      }
    }

    startCamera()

    return () => {
      mounted = false
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [enabled, width, height])

  const directionLabels: Record<Direction, string> = {
    idle: '待机中',
    left: '向左转',
    right: '向右转',
    up: '向上',
    down: '向下',
    forward: '直行'
  }

  const directionColors: Record<Direction, string> = {
    idle: 'bg-gray-500',
    left: 'bg-blue-500',
    right: 'bg-green-500',
    up: 'bg-purple-500',
    down: 'bg-orange-500',
    forward: 'bg-cyan-500'
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative rounded-2xl overflow-hidden bg-black shadow-lg">
        {cameraError ? (
          <div className="flex flex-col items-center justify-center bg-gray-800 text-white p-6 rounded-2xl" style={{ width, height }}>
            <span className="text-4xl mb-3">📷</span>
            <p className="text-center text-sm">{cameraError}</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="hidden"
            />
            <canvas
              ref={canvasRef}
              className={`${mirrored ? 'scale-x-[-1]' : ''}`}
              style={{ width, height, objectFit: 'cover' }}
            />
            
            <div className="absolute inset-0 pointer-events-none">
              {isDetecting && (
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur rounded-full px-3 py-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${hasPerson ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
                  <span className="text-white text-xs font-medium">
                    {hasPerson ? '检测到人体' : '未检测到'}
                  </span>
                </div>
              )}
              
              {error && (
                <div className="absolute top-3 right-3 bg-red-500/80 text-white text-xs px-2 py-1 rounded">
                  模型加载失败
                </div>
              )}
              
              {!isDetecting && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="text-white text-sm">加载 Pose 模型中...</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className={`mt-3 w-full p-4 rounded-xl transition-all duration-300 ${directionColors[poseResult.direction]}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">
              {poseResult.direction === 'idle' ? '⏸️' :
               poseResult.direction === 'left' ? '🔄' :
               poseResult.direction === 'right' ? '🔄' :
               poseResult.direction === 'forward' ? '➡️' : '❓'}
            </span>
            <div>
              <p className="text-white font-bold text-base">
                {directionLabels[poseResult.direction]}
              </p>
              <p className="text-white/70 text-xs">
                MediaPipe Pose · 体感控制
              </p>
            </div>
          </div>
          
          <label className="flex items-center gap-2 text-white/80 text-xs cursor-pointer bg-black/30 px-3 py-2 rounded-lg">
            <input
              type="checkbox"
              checked={mirrored}
              onChange={(e) => setMirrored(e.target.checked)}
              className="rounded"
            />
            镜像
          </label>
        </div>
      </div>
    </div>
  )
}
