import type { Keypoint } from '@/types/pose'
import { detectPoseFromImage } from './poseFromImage'

export interface ExtractedPose {
  index: number
  timestamp: number
  landmarks: Keypoint[]
  thumbnailDataUrl: string
}

export function loadVideoFromFile(file: File, signal?: AbortSignal): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = URL.createObjectURL(file)

    const onAbort = () => {
      video.removeAttribute('src')
      video.load()
      reject(new DOMException('Aborted', 'AbortError'))
    }

    video.onloadedmetadata = () => {
      signal?.removeEventListener('abort', onAbort)
      resolve(video)
    }
    video.onerror = () => {
      signal?.removeEventListener('abort', onAbort)
      reject(new Error('视频加载失败'))
    }

    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) {
      onAbort()
    }
  })
}

export function captureFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

  return canvas.toDataURL('image/jpeg', 0.8)
}

export interface ExtractOptions {
  interval?: number
  frameCount?: number
  alignCenter?: boolean
  onProgress?: (current: number, total: number) => void
  signal?: AbortSignal
}

export async function extractPosesFromVideo(
  video: HTMLVideoElement,
  options: ExtractOptions | number = {},
  legacyOnProgress?: (current: number, total: number) => void
): Promise<ExtractedPose[]> {
  const opts: ExtractOptions = typeof options === 'number' ? { interval: options } : options
  const onProgress = opts.onProgress ?? legacyOnProgress
  const { alignCenter = false, signal } = opts

  const checkAbort = () => {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
  }

  const duration = video.duration
  let totalFrames: number
  let interval: number

  if (opts.frameCount) {
    totalFrames = Math.max(1, opts.frameCount)
    interval = duration / totalFrames
  } else {
    interval = opts.interval ?? 3
    totalFrames = Math.max(1, Math.floor(duration / interval))
  }

  const canvas = document.createElement('canvas')
  const results: ExtractedPose[] = []

  for (let i = 0; i < totalFrames; i++) {
    checkAbort()
    const time = alignCenter
      ? (duration * (i + 0.5)) / totalFrames
      : i * interval
    video.currentTime = time

    await new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked)
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }
      const onAbort = () => {
        video.removeEventListener('seeked', onSeeked)
        reject(new DOMException('Aborted', 'AbortError'))
      }
      video.addEventListener('seeked', onSeeked)
      signal?.addEventListener('abort', onAbort, { once: true })
    })

    checkAbort()
    const thumbnail = captureFrame(video, canvas)

    const img = new Image()
    img.src = thumbnail
    await new Promise<void>((resolve, reject) => {
      const onLoad = () => {
        img.onload = null
        img.onerror = null
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }
      const onError = () => {
        img.onload = null
        img.onerror = null
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }
      const onAbort = () => {
        img.onload = null
        img.onerror = null
        reject(new DOMException('Aborted', 'AbortError'))
      }
      img.onload = onLoad
      img.onerror = onError
      signal?.addEventListener('abort', onAbort, { once: true })
    })

    checkAbort()
    try {
      const landmarks = await new Promise<Keypoint[] | null>((resolve, reject) => {
        let settled = false
        const onAbort = () => {
          if (settled) return
          settled = true
          signal?.removeEventListener('abort', onAbort)
          reject(new DOMException('Aborted', 'AbortError'))
        }
        signal?.addEventListener('abort', onAbort, { once: true })

        detectPoseFromImage(img).then(
          (result) => {
            if (settled) return
            settled = true
            signal?.removeEventListener('abort', onAbort)
            resolve(result)
          },
          (err) => {
            if (settled) return
            settled = true
            signal?.removeEventListener('abort', onAbort)
            reject(err)
          }
        )
      })
      if (landmarks) {
        results.push({
          index: i,
          timestamp: time,
          landmarks,
          thumbnailDataUrl: thumbnail,
        })
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      console.warn(`Frame ${i} pose detection failed:`, e)
    }

    onProgress?.(i + 1, totalFrames)
  }

  return results
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
