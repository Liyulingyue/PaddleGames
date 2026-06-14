import { useEffect, useRef, useState, useCallback } from 'react'

export type Direction = 'left' | 'right' | 'up' | 'down' | 'forward' | 'idle'

interface UsePoseDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement>
  onDirectionChange?: (direction: Direction) => void
  enabled?: boolean
}

interface PoseResult {
  direction: Direction
  timestamp: number
  hasPerson: boolean
}

export function usePoseDetection({ videoRef, onDirectionChange, enabled = true }: UsePoseDetectionOptions) {
  const [poseResult, setPoseResult] = useState<PoseResult>({ direction: 'idle', timestamp: Date.now(), hasPerson: false })
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastPositionRef = useRef<{ x: number; y: number } | null>(null)
  const frameCountRef = useRef(0)
  const [isDetecting, setIsDetecting] = useState(false)

  const detectMotion = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    let totalR = 0, totalG = 0, totalB = 0
    let skinPixels = 0
    const centerX = Math.floor(canvas.width / 2)
    const centerY = Math.floor(canvas.height / 2)

    for (let i = 0; i < data.length; i += 16) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      totalR += r
      totalG += g
      totalB += b

      const isSkin = (r > 95 && g > 40 && b > 20) &&
        (Math.max(r, g, b) - Math.min(r, g, b) > 15) &&
        (Math.abs(r - g) > 15) &&
        (r > g) && (r > b)

      if (isSkin) {
        skinPixels++
        const x = (i / 4) % canvas.width
        const y = Math.floor((i / 4) / canvas.width)
        if (y > centerY - 50 && y < centerY + 50) {
          totalR += r * 2
          totalG += g * 2
          totalB += b * 2
        }
      }
    }

    const pixelCount = data.length / 16
    const skinRatio = skinPixels / pixelCount
    const hasPerson = skinRatio > 0.01

    let currentDirection: Direction = 'idle'

    if (hasPerson && skinPixels > 100) {
      let skinTotalX = 0, skinTotalY = 0, skinCount = 0

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]

        const isSkin = (r > 95 && g > 40 && b > 20) &&
          (Math.max(r, g, b) - Math.min(r, g, b) > 15) &&
          (Math.abs(r - g) > 15) &&
          (r > g) && (r > b)

        if (isSkin) {
          const x = (i / 4) % canvas.width
          const y = Math.floor((i / 4) / canvas.width)
          skinTotalX += x
          skinTotalY += y
          skinCount++
        }
      }

      if (skinCount > 0) {
        const avgX = skinTotalX / skinCount
        const avgY = skinTotalY / skinCount

        if (lastPositionRef.current) {
          const deltaX = avgX - lastPositionRef.current.x
          const deltaY = avgY - lastPositionRef.current.y
          const threshold = 20

          frameCountRef.current++

          if (frameCountRef.current > 5) {
            if (deltaX > threshold) {
              currentDirection = 'right'
            } else if (deltaX < -threshold) {
              currentDirection = 'left'
            } else if (deltaY > threshold) {
              currentDirection = 'down'
            } else if (deltaY < -threshold) {
              currentDirection = 'up'
            } else if (Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) {
              currentDirection = 'forward'
            }
          }
        }

        lastPositionRef.current = { x: avgX, y: avgY }
      }
    } else {
      lastPositionRef.current = null
      frameCountRef.current = 0
    }

    const result = {
      direction: currentDirection,
      timestamp: Date.now(),
      hasPerson
    }

    setPoseResult(result)
    onDirectionChange?.(currentDirection)
  }, [videoRef, onDirectionChange])

  useEffect(() => {
    if (!enabled) {
      setIsDetecting(false)
      return
    }

    canvasRef.current = document.createElement('canvas')
    setIsDetecting(true)

    const intervalId = setInterval(detectMotion, 100)

    return () => {
      clearInterval(intervalId)
      setIsDetecting(false)
    }
  }, [enabled, detectMotion])

  return {
    poseResult,
    isDetecting,
    hasPerson: poseResult.hasPerson
  }
}
