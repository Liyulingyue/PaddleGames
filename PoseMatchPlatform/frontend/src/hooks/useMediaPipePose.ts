import { useEffect, useRef, useState, useCallback } from 'react'
import type { Keypoint } from '@/types/pose'
import { POSE_KEYPOINTS, POSE_CONNECTIONS } from '@/types/pose'
import type { PoseTemplate, ScoringMode } from '@/utils/poseMatcher'

declare global {
  interface Window {
    Pose: any
    Camera: any
    drawConnectors: any
    drawLandmarks: any
    POSE_CONNECTIONS: any
  }
}

interface UseMediaPipePoseOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  enabled?: boolean
  mirrored?: boolean
  displayMode?: 'original' | 'drawing' | 'overlay'
  template?: PoseTemplate | null
  scoringMode?: ScoringMode
  onPoseResult?: (hasPerson: boolean, landmarks: Keypoint[] | null) => void
  modelComplexity?: 0 | 1 | 2
}

const INPUT_MAX_WIDTH = 640

export function useMediaPipePose({
  videoRef,
  enabled = true,
  mirrored = true,
  displayMode = 'overlay',
  template = null,
  scoringMode = 'minimal',
  onPoseResult,
  modelComplexity = 0,
}: UseMediaPipePoseOptions) {
  const [isDetecting, setIsDetecting] = useState(false)
  const [hasPerson, setHasPerson] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isModelLoaded, setIsModelLoaded] = useState(false)

  const poseRef = useRef<any>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const inputCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationIdRef = useRef<number | null>(null)
  const onPoseResultRef = useRef(onPoseResult)
  const hasPersonRef = useRef(false)

  onPoseResultRef.current = onPoseResult

  const setCanvasRef = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el
  }, [])

  const drawResults = useCallback((results: any) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cssW = canvas.clientWidth || canvas.width
    const cssH = canvas.clientHeight || canvas.height
    if (canvas.width !== cssW || canvas.height !== cssH) {
      canvas.width = cssW
      canvas.height = cssH
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (displayMode !== 'drawing' && (results.image || video)) {
      ctx.save()
      if (mirrored) {
        ctx.scale(-1, 1)
        ctx.translate(-canvas.width, 0)
      }
      ctx.drawImage(results.image || video, 0, 0, canvas.width, canvas.height)
      ctx.restore()
    }

    if (displayMode !== 'original' && results.poseLandmarks && window.drawConnectors && window.drawLandmarks) {
      ctx.save()
      if (mirrored) {
        ctx.scale(-1, 1)
        ctx.translate(-canvas.width, 0)
      }

      const scoringPoints = new Set<number>()
      if (scoringMode === 'minimal') {
        scoringPoints.add(11)
        scoringPoints.add(12)
      }
      if (scoringMode === 'upper' || scoringMode === 'full') {
        scoringPoints.add(11)
        scoringPoints.add(12)
        scoringPoints.add(13)
        scoringPoints.add(14)
        scoringPoints.add(15)
        scoringPoints.add(16)
      }
      if (scoringMode === 'full') {
        scoringPoints.add(23)
        scoringPoints.add(24)
        scoringPoints.add(25)
        scoringPoints.add(26)
        scoringPoints.add(27)
        scoringPoints.add(28)
      }

      const hasScoring = scoringPoints.size > 0

      const activeLineColor = '#00FF00'
      const activePointColor = '#FF0000'
      const dimLineColor = '#1a4731'
      const dimPointColor = '#166534'

      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      for (const [a, b] of POSE_CONNECTIONS) {
        const pa = results.poseLandmarks[a]
        const pb = results.poseLandmarks[b]
        if (!pa || !pb) continue
        const isActive = !hasScoring || scoringPoints.has(a) || scoringPoints.has(b)
        ctx.strokeStyle = isActive ? activeLineColor : dimLineColor
        ctx.lineWidth = isActive ? 3 : 2
        ctx.globalAlpha = isActive ? 1 : 0.5
        ctx.beginPath()
        ctx.moveTo(pa.x * canvas.width, pa.y * canvas.height)
        ctx.lineTo(pb.x * canvas.width, pb.y * canvas.height)
        ctx.stroke()
      }

      ctx.globalAlpha = 1
      for (let i = 0; i < results.poseLandmarks.length; i++) {
        const lm = results.poseLandmarks[i]
        if (!lm) continue
        const isActive = !hasScoring || scoringPoints.has(i)
        ctx.fillStyle = isActive ? activePointColor : dimPointColor
        ctx.globalAlpha = isActive ? 1 : 0.4
        const r = isActive ? 4 : 2.5
        ctx.beginPath()
        ctx.arc(lm.x * canvas.width, lm.y * canvas.height, r, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalAlpha = 1
      if (hasScoring) {
        for (const idx of scoringPoints) {
          const lm = results.poseLandmarks[idx]
          if (!lm) continue
          ctx.fillStyle = activeLineColor
          ctx.beginPath()
          ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      ctx.restore()
    }
  }, [videoRef, mirrored, displayMode, template, scoringMode])

  const drawResultsRef = useRef(drawResults)
  drawResultsRef.current = drawResults

  useEffect(() => {
    if (!enabled) {
      setIsDetecting(false)
      if (poseRef.current) {
        poseRef.current.close()
        poseRef.current = null
      }
      return
    }

    if (typeof window === 'undefined') return

    let mounted = true

    const loadScripts = async () => {
      const scripts = [
        'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
        'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js',
        'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
        'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js',
      ]

      for (const src of scripts) {
        if (document.querySelector(`script[src="${src}"]`)) continue
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = src
          script.crossOrigin = 'anonymous'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error(`Failed to load ${src}`))
          document.head.appendChild(script)
        })
      }

      if (!mounted) return

      try {
        const pose = new window.Pose({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
          },
        })

        pose.setOptions({
          modelComplexity,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })

        pose.onResults((results: any) => {
          if (!mounted) return

          drawResultsRef.current(results)

          if (!results.poseLandmarks) {
            if (hasPersonRef.current) {
              hasPersonRef.current = false
              setHasPerson(false)
            }
            onPoseResultRef.current?.(false, null)
            return
          }

          const landmarks: Keypoint[] = results.poseLandmarks.map(
            (lm: any, idx: number) => ({
              x: lm.x,
              y: lm.y,
              z: lm.z,
              visibility: lm.visibility,
              name: POSE_KEYPOINTS[idx],
            })
          )

          if (!hasPersonRef.current) {
            hasPersonRef.current = true
            setHasPerson(true)
          }
          onPoseResultRef.current?.(true, landmarks)
        })

        poseRef.current = pose
        setIsModelLoaded(true)
        setIsDetecting(true)
        setError(null)
      } catch (e: any) {
        setError(e.message || '模型加载失败')
      }
    }

    loadScripts().catch((e) => {
      if (mounted) {
        setError(e.message || '脚本加载失败')
      }
    })

    return () => {
      mounted = false
      if (poseRef.current) {
        poseRef.current.close()
        poseRef.current = null
      }
    }
  }, [enabled, modelComplexity])

  useEffect(() => {
    if (!enabled || !poseRef.current || !isModelLoaded) return

    const video = videoRef.current
    if (!video) return

    let lastSendTime = 0
    const minSendInterval = 100

    if (!inputCanvasRef.current) {
      inputCanvasRef.current = document.createElement('canvas')
    }

    const sendFrame = async (timestamp: number) => {
      if (timestamp - lastSendTime >= minSendInterval) {
        if (video.readyState >= 2 && poseRef.current && inputCanvasRef.current) {
          try {
            const vw = video.videoWidth || 640
            const vh = video.videoHeight || 480
            const scale = INPUT_MAX_WIDTH / vw
            const iw = INPUT_MAX_WIDTH
            const ih = Math.round(vh * scale)

            const ic = inputCanvasRef.current
            if (ic.width !== iw || ic.height !== ih) {
              ic.width = iw
              ic.height = ih
            }
            const ictx = ic.getContext('2d')
            if (ictx) {
              ictx.drawImage(video, 0, 0, iw, ih)
            }
            await poseRef.current.send({ image: ic })
          } catch (e) {
            // Ignore send errors
          }
        }
        lastSendTime = timestamp
      }
      animationIdRef.current = requestAnimationFrame(sendFrame)
    }

    animationIdRef.current = requestAnimationFrame(sendFrame)

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }
    }
  }, [enabled, videoRef, isModelLoaded])

  return {
    isDetecting,
    hasPerson,
    error,
    isModelLoaded,
    canvasRef: setCanvasRef,
  }
}
