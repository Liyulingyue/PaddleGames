import type { Keypoint } from '@/types/pose'
import { POSE_KEYPOINTS } from '@/types/pose'

declare global {
  interface Window {
    Pose: any
  }
}

const POSE_SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js',
]

let scriptLoadingPromise: Promise<void> | null = null
let poseInstance: any = null
let poseInitPromise: Promise<any> | null = null

async function loadScripts(): Promise<void> {
  if (scriptLoadingPromise) return scriptLoadingPromise

  scriptLoadingPromise = (async () => {
    for (const src of POSE_SCRIPTS) {
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
  })()

  return scriptLoadingPromise
}

async function getPoseInstance(): Promise<any> {
  if (poseInstance) return poseInstance
  if (poseInitPromise) return poseInitPromise

  poseInitPromise = (async () => {
    await loadScripts()

    if (!window.Pose) {
      throw new Error('MediaPipe Pose not loaded')
    }

    const pose = new window.Pose({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      },
    })

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: false,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })

    poseInstance = pose
    return pose
  })()

  return poseInitPromise
}

export async function detectPoseFromImage(
  imageElement: HTMLImageElement | HTMLCanvasElement
): Promise<Keypoint[] | null> {
  const pose = await getPoseInstance()

  return new Promise((resolve, reject) => {
    let resolved = false

    pose.onResults((results: any) => {
      if (resolved) return
      resolved = true

      if (!results.poseLandmarks) {
        resolve(null)
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

      resolve(landmarks)
    })

    pose
      .send({ image: imageElement })
      .catch((err: any) => {
        if (!resolved) {
          resolved = true
          reject(err)
        }
      })
  })
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = URL.createObjectURL(file)
  })
}
