import { memo, useEffect, useRef, useState } from 'react'
import { useMediaPipePose } from '@/hooks/useMediaPipePose'
import type { Keypoint } from '@/types/pose'
import type { PoseTemplate, ScoringMode } from '@/utils/poseMatcher'
import { cn } from '@/lib/utils'

interface CameraProps {
  enabled?: boolean
  width?: number
  height?: number
  mirrored?: boolean
  displayMode?: 'original' | 'drawing' | 'overlay'
  template?: PoseTemplate | null
  scoringMode?: ScoringMode
  onPoseResult?: (hasPerson: boolean, landmarks: Keypoint[] | null) => void
  className?: string
}

export default memo(function Camera({
  enabled = true,
  width = 640,
  height = 480,
  mirrored = true,
  displayMode = 'overlay',
  template = null,
  scoringMode = 'minimal',
  onPoseResult,
  className,
}: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [videoLoaded, setVideoLoaded] = useState(false)

  const { isDetecting, hasPerson, error, isModelLoaded, canvasRef } = useMediaPipePose({
    videoRef,
    enabled,
    mirrored,
    displayMode,
    template,
    scoringMode,
    onPoseResult,
  })

  useEffect(() => {
    if (!enabled) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
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
            facingMode: 'user',
          },
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
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [enabled, width, height])

  return (
    <div className={cn('relative rounded-2xl overflow-hidden bg-black shadow-lg', className)}>
      {cameraError ? (
        <div
          className="flex flex-col items-center justify-center bg-gray-800 text-white p-6"
          style={{ width, height }}
        >
          <span className="text-5xl mb-4">📷</span>
          <p className="text-center text-base">{cameraError}</p>
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
            className="absolute top-0 left-0"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />

          <div className="absolute inset-0 pointer-events-none">
            {isDetecting && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
                <span
                  className={cn(
                    'w-3 h-3 rounded-full',
                    hasPerson ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                  )}
                ></span>
                <span className="text-white text-sm font-medium">
                  {hasPerson ? '✓ 检测到人体' : '未检测到人体'}
                </span>
              </div>
            )}

            {error && (
              <div className="absolute top-4 right-4 bg-red-500/80 text-white text-sm px-3 py-1.5 rounded-lg">
                模型加载失败
              </div>
            )}

            {!isModelLoaded && enabled && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <span className="text-white text-lg">正在加载 AI 姿态检测模型...</span>
                <span className="text-white/60 text-sm mt-2">首次加载可能需要几秒钟</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
})
