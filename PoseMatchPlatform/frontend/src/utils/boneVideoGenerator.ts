import type { PoseTemplate, TemplateLandmark } from './poseMatcher'
import { Muxer, ArrayBufferTarget } from 'webm-muxer'

const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 480
const FPS = 30

const BONE_PAIRS: [string, string][] = [
  ['LEFT_SHOULDER', 'RIGHT_SHOULDER'],
  ['LEFT_SHOULDER', 'LEFT_ELBOW'],
  ['RIGHT_SHOULDER', 'RIGHT_ELBOW'],
  ['LEFT_ELBOW', 'LEFT_WRIST'],
  ['RIGHT_ELBOW', 'RIGHT_WRIST'],
  ['LEFT_SHOULDER', 'LEFT_HIP'],
  ['RIGHT_SHOULDER', 'RIGHT_HIP'],
  ['LEFT_HIP', 'RIGHT_HIP'],
  ['LEFT_HIP', 'LEFT_KNEE'],
  ['RIGHT_HIP', 'RIGHT_KNEE'],
  ['LEFT_KNEE', 'LEFT_ANKLE'],
  ['RIGHT_KNEE', 'RIGHT_ANKLE'],
]

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpLandmark(a: TemplateLandmark, b: TemplateLandmark, t: number): TemplateLandmark {
  return {
    name: a.name,
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z ?? 0, b.z ?? 0, t),
  }
}

function getLandmarkByName(landmarks: TemplateLandmark[], name: string): TemplateLandmark | undefined {
  return landmarks.find((l) => l.name === name)
}

function drawPose(ctx: CanvasRenderingContext2D, landmarks: TemplateLandmark[], w: number, h: number) {
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, w, h)

  const scaleX = w
  const scaleY = h

  ctx.strokeStyle = '#00ff88'
  ctx.lineWidth = 4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const [aName, bName] of BONE_PAIRS) {
    const a = getLandmarkByName(landmarks, aName)
    const b = getLandmarkByName(landmarks, bName)
    if (!a || !b) continue
    ctx.beginPath()
    ctx.moveTo(a.x * scaleX, a.y * scaleY)
    ctx.lineTo(b.x * scaleX, b.y * scaleY)
    ctx.stroke()
  }

  ctx.fillStyle = '#ffffff'
  for (const lm of landmarks) {
    ctx.beginPath()
    ctx.arc(lm.x * scaleX, lm.y * scaleY, 3, 0, Math.PI * 2)
    ctx.fill()
  }
}

function getInterpolatedPose(templates: PoseTemplate[], time: number): TemplateLandmark[] {
  if (templates.length === 0) return []
  if (templates.length === 1) return templates[0].landmarks

  let segStart = 0
  let segEnd = 0
  let segIdx = 0

  for (let i = 0; i < templates.length - 1; i++) {
    segStart = segEnd
    segEnd = segStart + (templates[i + 1].timestamp! - templates[i].timestamp!)
    if (time < segEnd) { segIdx = i; break }
    segIdx = i
  }

  if (time >= segEnd) {
    segIdx = templates.length - 2
    segStart = segEnd
    segEnd = segStart + (templates[templates.length - 1].sourceDuration ?? 1)
  }

  const segDuration = segEnd - segStart
  const segT = segDuration > 0 ? Math.min(1, Math.max(0, (time - segStart) / segDuration)) : 0
  const a = templates[segIdx]
  const b = templates[Math.min(segIdx + 1, templates.length - 1)]
  return a.landmarks.map((lm, i) => lerpLandmark(lm, b.landmarks[i], segT))
}

export interface BoneVideoOptions {
  /** 视频宽度，默认 640 */
  width?: number
  /** 视频高度，默认 480 */
  height?: number
}

export async function generateBoneVideoBlob(
  templates: PoseTemplate[],
  onProgress?: (current: number, total: number) => void,
  options?: BoneVideoOptions
): Promise<Blob> {
  if (templates.length === 0) throw new Error('没有模板数据')

  const w = options?.width || DEFAULT_WIDTH
  const h = options?.height || DEFAULT_HEIGHT

  // WebCodecs 需要安全上下文（HTTPS 或 localhost）
  const hasWebCodecs = 'VideoEncoder' in window && 'VideoFrame' in window && window.isSecureContext

  if (hasWebCodecs) {
    try {
      return await generateWithWebCodecs(templates, onProgress, w, h)
    } catch (e) {
      console.warn('WebCodecs 生成失败，回退到 MediaRecorder:', e)
    }
  }

  // fallback：MediaRecorder（实时录制，较慢）
  return await generateWithMediaRecorder(templates, onProgress, w, h)
}

export function isFastEncodeAvailable(): boolean {
  return 'VideoEncoder' in window && 'VideoFrame' in window && window.isSecureContext
}

async function generateWithWebCodecs(
  templates: PoseTemplate[],
  onProgress?: (current: number, total: number) => void,
  w: number = DEFAULT_WIDTH,
  h: number = DEFAULT_HEIGHT
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  if (!ctx) throw new Error('无法创建 canvas')

  const totalDuration = templates.reduce((sum, t, i) => {
    if (i < templates.length - 1) return sum + (templates[i + 1].timestamp! - t.timestamp!)
    return sum + (t.sourceDuration ?? 1)
  }, 0)
  const totalFrames = Math.ceil(totalDuration * FPS)
  const frameDurationUs = (1 / FPS) * 1_000_000 // 微秒

  const target = new ArrayBufferTarget()
  const muxer = new Muxer({
    target,
    video: {
      codec: 'V_VP8',
      width: w,
      height: h,
    },
    firstTimestampBehavior: 'offset',
  })

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta as any)
    },
    error: (e) => console.error('VideoEncoder error:', e),
  })

  // 检测 VP8 支持
  const vp8Config: VideoEncoderConfig = {
    codec: 'vp8',
    width: w,
    height: h,
    bitrate: 800_000,
    framerate: FPS,
  }

  const vp8Support = await VideoEncoder.isConfigSupported(vp8Config)
  if (!vp8Support.supported) {
    throw new Error('VP8 不支持')
  }

  encoder.configure(vp8Config)

  // 快速喂帧——不受实时限制，多快算多快
  for (let i = 0; i < totalFrames; i++) {
    const time = i / FPS
    const pose = getInterpolatedPose(templates, time)
    drawPose(ctx, pose, w, h)

    const frame = new VideoFrame(canvas, {
      timestamp: i * frameDurationUs,
      duration: frameDurationUs,
    })

    // 关键帧：每秒一个
    const keyFrame = i % FPS === 0
    encoder.encode(frame, { keyFrame })
    frame.close()

    onProgress?.(i + 1, totalFrames)

    // 每编码 60 帧让出一次主线程，避免卡死 UI
    if (i % 60 === 0) {
      await encoder.flush()
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  await encoder.flush()
  encoder.close()
  muxer.finalize()

  return new Blob([target.buffer], { type: 'video/webm' })
}

async function generateWithMediaRecorder(
  templates: PoseTemplate[],
  onProgress?: (current: number, total: number) => void,
  w: number = DEFAULT_WIDTH,
  h: number = DEFAULT_HEIGHT
): Promise<Blob> {
  const totalDuration = templates.reduce((sum, t, i) => {
    if (i < templates.length - 1) return sum + (templates[i + 1].timestamp! - t.timestamp!)
    return sum + (t.sourceDuration ?? 1)
  }, 0)
  const totalFrames = Math.ceil(totalDuration * FPS)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  if (!ctx) throw new Error('无法创建 canvas')

  const stream = canvas.captureStream(FPS)
  const mimeType = ['video/webm;codecs=vp8', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm'

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 800_000 })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

  const frameInterval = 1000 / FPS

  return new Promise((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
    recorder.onerror = () => reject(new Error('录制失败'))

    let frameIdx = 0
    let timer: number | null = null

    const tick = () => {
      if (frameIdx >= totalFrames) { recorder.stop(); return }
      const time = frameIdx / FPS
      drawPose(ctx, getInterpolatedPose(templates, time), w, h)
      frameIdx++
      onProgress?.(frameIdx, totalFrames)
      timer = window.setTimeout(tick, frameInterval)
    }

    recorder.start()
    tick()

    const origStop = recorder.stop.bind(recorder)
    recorder.stop = () => { if (timer !== null) clearTimeout(timer); origStop() }
  })
}

export async function generateBoneVideoUrl(
  templates: PoseTemplate[],
  onProgress?: (current: number, total: number) => void,
  options?: BoneVideoOptions
): Promise<string> {
  const blob = await generateBoneVideoBlob(templates, onProgress, options)
  return URL.createObjectURL(blob)
}
