import { useEffect, useRef, useState, useCallback } from 'react'
import { Direction } from './usePoseDetection'

interface Keypoint {
  x: number
  y: number
  name?: string
}

interface PoseResult {
  direction: Direction
  timestamp: number
  hasPerson: boolean
  keypoints?: Keypoint[]
}

declare global {
  interface Window {
    Pose: any
    Camera: any
    drawConnectors: any
    drawLandmarks: any
    POSE_CONNECTIONS: any
  }
}

export function useMediaPipePose(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  onDirectionChange?: (direction: Direction) => void,
  enabled?: boolean,
  onPoseResult?: (hasPerson: boolean, landmarks: any[] | null) => void
) {
  const [poseResult, setPoseResult] = useState<PoseResult>({ 
    direction: 'idle', 
    timestamp: Date.now(), 
    hasPerson: false 
  })
  const [isDetecting, setIsDetecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const poseRef = useRef<any>(null)
  const lastDirectionTimeRef = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastArmStateRef = useRef<'left' | 'right' | 'idle'>('idle')
  const lastLandmarksRef = useRef<any[] | null>(null)

  const setCanvasRef = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el
  }, [])

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

    const initPose = () => {
      if (!window.Pose) {
        console.log('Waiting for Pose to load...')
        setTimeout(initPose, 500)
        return
      }

      console.log('Initializing MediaPipe Pose...')

      const pose = new window.Pose({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        }
      })

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      })

      pose.onResults((results: any) => {
        if (!results.poseLandmarks) {
          setPoseResult(prev => ({ ...prev, hasPerson: false, direction: 'idle' }))
          onDirectionChange?.('idle')
          onPoseResult?.(false, null)
          lastArmStateRef.current = 'idle'
          lastLandmarksRef.current = null
          return
        }

        const canvas = canvasRef.current
        const video = videoRef.current
        if (canvas && video) {
          canvas.width = video.videoWidth || 640
          canvas.height = video.videoHeight || 480
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            
            if (window.drawConnectors && window.drawLandmarks && window.POSE_CONNECTIONS) {
              ctx.save()
              ctx.scale(-1, 1)
              ctx.translate(-canvas.width, 0)
              window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, {
                color: '#00FF00',
                lineWidth: 2
              })
              window.drawLandmarks(ctx, results.poseLandmarks, {
                color: '#FF0000',
                lineWidth: 1,
                radius: 3
              })
              ctx.restore()
            }
          }
        }

        const landmarks = results.poseLandmarks.map((lm: any, idx: number) => ({
          x: lm.x,
          y: lm.y,
          name: ['NOSE', 'LEFT_EYE_INNER', 'LEFT_EYE', 'LEFT_EYE_OUTER', 
                 'RIGHT_EYE_INNER', 'RIGHT_EYE', 'RIGHT_EYE_OUTER',
                 'LEFT_EAR', 'RIGHT_EAR', 'MOUTH_LEFT', 'MOUTH_RIGHT',
                 'LEFT_SHOULDER', 'RIGHT_SHOULDER', 'LEFT_ELBOW', 'RIGHT_ELBOW',
                 'LEFT_WRIST', 'RIGHT_WRIST'][idx]
        }))

        const getKeypoint = (name: string) => landmarks.find((k: any) => k.name === name)

        const leftShoulder = getKeypoint('LEFT_SHOULDER')
        const rightShoulder = getKeypoint('RIGHT_SHOULDER')
        const leftWrist = getKeypoint('LEFT_WRIST')
        const rightWrist = getKeypoint('RIGHT_WRIST')

        let direction: Direction = 'idle'

        if (leftShoulder && rightShoulder && leftWrist && rightWrist) {
          const leftArmAngle = Math.atan2(
            leftWrist.y - leftShoulder.y,
            leftWrist.x - leftShoulder.x
          )
          const rightArmAngle = Math.atan2(
            rightWrist.y - rightShoulder.y,
            rightWrist.x - rightShoulder.x
          )

          const leftArmUp = leftArmAngle < -0.5
          const rightArmUp = rightArmAngle < -0.5

          const now = Date.now()
          const cooldown = now - lastDirectionTimeRef.current < 500

          if (leftArmUp && !rightArmUp && !cooldown) {
            direction = 'left'
            lastDirectionTimeRef.current = now
            lastArmStateRef.current = 'left'
          } else if (rightArmUp && !leftArmUp && !cooldown) {
            direction = 'right'
            lastDirectionTimeRef.current = now
            lastArmStateRef.current = 'right'
          } else if (!leftArmUp && !rightArmUp) {
            lastArmStateRef.current = 'idle'
            direction = 'forward'
          } else {
            direction = lastArmStateRef.current === 'left' ? 'left' : 
                       lastArmStateRef.current === 'right' ? 'right' : 'forward'
          }
        } else {
          direction = 'idle'
          lastArmStateRef.current = 'idle'
        }

        setPoseResult({
          direction,
          timestamp: Date.now(),
          hasPerson: true,
          keypoints: landmarks
        })

        onDirectionChange?.(direction)
        onPoseResult?.(true, landmarks)
        lastLandmarksRef.current = landmarks

      })

      poseRef.current = pose
      setIsDetecting(true)
      setError(null)
      console.log('MediaPipe Pose initialized successfully')
    }

    initPose()

    return () => {
      if (poseRef.current) {
        poseRef.current.close()
        poseRef.current = null
      }
    }
  }, [enabled, onDirectionChange])

  useEffect(() => {
    if (!enabled || !poseRef.current) return

    const video = videoRef.current
    if (!video) return

    let animationId: number
    let lastSendTime = 0
    const minSendInterval = 100

    function sendFrame(timestamp: number) {
      if (timestamp - lastSendTime >= minSendInterval) {
        if (video.readyState >= 2 && poseRef.current) {
          try {
            poseRef.current.send({ image: video })
          } catch (e) {
            // Ignore send errors
          }
        }
        lastSendTime = timestamp
      }
      animationId = requestAnimationFrame(sendFrame)
    }

    animationId = requestAnimationFrame(sendFrame)

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [enabled])

  return {
    poseResult,
    isDetecting,
    hasPerson: poseResult.hasPerson,
    error,
    canvasRef: setCanvasRef
  }
}
