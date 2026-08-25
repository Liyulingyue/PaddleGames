import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Upload, Film, Play, Save, Loader2, CheckCircle2, AlertCircle, Gamepad2, Clapperboard, Users, Image, Video, Plus, X, ChevronUp, ChevronDown, GripVertical, Pause, SkipBack, SkipForward, Hand, XCircle } from 'lucide-react'
import FloatingNav from '@/components/FloatingNav'
import GameBackground from '@/components/GameBackground'
import PoseFigure from '@/components/PoseFigure'
import { directionAngle, threePointAngle, type PoseTemplate, type TemplateLandmark, type ScoringRule } from '@/utils/poseMatcher'
import { POSE_KEYPOINTS } from '@/types/pose'
import { useUserStore } from '@/store/userStore'
import { loadVideoFromFile, extractPosesFromVideo, captureFrame, formatTime } from '@/utils/videoPoseExtractor'
import { detectPoseFromImage, loadImageFromFile } from '@/utils/poseFromImage'
import { generateBoneVideoBlob, isFastEncodeAvailable } from '@/utils/boneVideoGenerator'
import { saveLocalLevel, saveLocalPoses, type LocalLevel } from '@/utils/localLevelStorage'
import { HardDrive, Cloud } from 'lucide-react'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'loading' | 'processing' | 'done'
type ExtractMode = 'action' | 'follow'
type TargetMode = 'challenge' | 'rhythm' | 'follow'
type InputMode = 'video' | 'image'
type EditorMode = 'auto' | 'manual'

// 手动选帧模式下的帧条目
interface ManualFrame {
  id: string
  timestamp: number
  thumbnailDataUrl: string
  landmarks: any[]
  sourceDuration?: number
}

// 目标模式配置：决定抽取方式、文案、保存与跳转
const TARGET_CONFIG: Record<TargetMode, {
  label: string
  icon: typeof Gamepad2
  extractMode: ExtractMode
  desc: string
  defaultName: string
}> = {
  challenge: {
    label: '闯关模式',
    icon: Gamepad2,
    extractMode: 'action',
    desc: '提取关键帧作为独立挑战，达标即过，比拼速度',
    defaultName: '我的闯关关卡',
  },
  rhythm: {
    label: '节拍模式',
    icon: Clapperboard,
    extractMode: 'action',
    desc: '提取关键帧，固定时长切换，比拼得分',
    defaultName: '我的节拍关卡',
  },
  follow: {
    label: '跟练模式',
    icon: Users,
    extractMode: 'follow',
    desc: '高帧率采样，按视频原节奏连续推进',
    defaultName: '我的跟练关卡',
  },
}

export default function VideoImport() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isLoggedIn, user } = useUserStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 目标模式：URL ?target= 决定，默认 follow
  const targetMode = useMemo<TargetMode>(() => {
    const t = searchParams.get('target') as TargetMode | null
    return t && t in TARGET_CONFIG ? t : 'follow'
  }, [searchParams])
  const targetConfig = TARGET_CONFIG[targetMode]

  // 抽取模式跟随目标模式（challenge/rhythm → action，follow → follow）
  const [extractMode, setExtractMode] = useState<ExtractMode>(targetConfig.extractMode)

  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [statusMsg, setStatusMsg] = useState('')
  const [frames, setFrames] = useState(6)
  const [templates, setTemplates] = useState<PoseTemplate[]>([])
  const [levelName, setLevelName] = useState(targetConfig.defaultName)
  const [savedCount, setSavedCount] = useState(0)
  const [saving, setSaving] = useState(false)
  // 保存目标：本地 / 服务器
  const [saveTarget, setSaveTarget] = useState<'local' | 'server'>(isLoggedIn ? 'server' : 'local')
  const [fps, setFps] = useState(2)
  // 输入方式：视频 / 图片（仅 action 模式可选图片，follow 只能视频）
  const [inputMode, setInputMode] = useState<InputMode>('video')
  // 编辑器模式：auto（自动抽取）/ manual（手动选帧），仅视频模式可用 manual
  const [editorMode, setEditorMode] = useState<EditorMode>('auto')
  // 来源元信息（保存时入库）
  const [sourceDurationSec, setSourceDurationSec] = useState<number | null>(null)
  const [sourceResolution, setSourceResolution] = useState<string | null>(null)
  // 原视频尺寸（用于骨骼视频生成，确保与原视频等比例）
  const [sourceVideoSize, setSourceVideoSize] = useState<{ width: number; height: number } | null>(null)
  // 原视频文件（保存时上传到后端）
  const [sourceVideoFile, setSourceVideoFile] = useState<File | null>(null)
  // 前端生成的骨骼视频 blob
  const [boneVideoBlob, setBoneVideoBlob] = useState<Blob | null>(null)
  const [generatingBoneVideo, setGeneratingBoneVideo] = useState(false)
  const [boneVideoProgress, setBoneVideoProgress] = useState(0)
  // 预览播放器同步控制
  const previewOriginalRef = useRef<HTMLVideoElement>(null)
  const previewBoneRef = useRef<HTMLVideoElement>(null)
  const [syncPlaying, setSyncPlaying] = useState(false)
  const syncRafRef = useRef<number>(0)
  // 缓存 object URL 避免重复创建
  const originalPreviewUrlRef = useRef<string | null>(null)
  const bonePreviewUrlRef = useRef<string | null>(null)

  // 获取或创建 object URL（带缓存）
  const getOriginalPreviewUrl = useCallback(() => {
    if (!sourceVideoFile) return null
    if (!originalPreviewUrlRef.current) {
      originalPreviewUrlRef.current = URL.createObjectURL(sourceVideoFile)
    }
    return originalPreviewUrlRef.current
  }, [sourceVideoFile])

  const getBonePreviewUrl = useCallback(() => {
    if (!boneVideoBlob) return null
    if (!bonePreviewUrlRef.current) {
      bonePreviewUrlRef.current = URL.createObjectURL(boneVideoBlob)
    }
    return bonePreviewUrlRef.current
  }, [boneVideoBlob])

  // rAF 驱动时间同步：以原视频为主时钟，骨骼视频追随
  const startSyncLoop = () => {
    const loop = () => {
      const v1 = previewOriginalRef.current
      const v2 = previewBoneRef.current
      if (!v1 || !v2 || v1.paused || v2.paused) return
      // 每 100ms 同步一次时间，避免漂移
      const diff = Math.abs(v1.currentTime - v2.currentTime)
      if (diff > 0.15) {
        v2.currentTime = v1.currentTime
      }
      syncRafRef.current = requestAnimationFrame(loop)
    }
    syncRafRef.current = requestAnimationFrame(loop)
  }

  const stopSyncLoop = () => {
    if (syncRafRef.current) {
      cancelAnimationFrame(syncRafRef.current)
      syncRafRef.current = 0
    }
  }

  const toggleSyncPlay = () => {
    const v1 = previewOriginalRef.current
    const v2 = previewBoneRef.current
    if (!v1 || !v2) return

    if (syncPlaying) {
      stopSyncLoop()
      v1.pause()
      v2.pause()
      setSyncPlaying(false)
    } else {
      // 从头开始，同步到时间 0
      v1.currentTime = 0
      v2.currentTime = 0
      v1.play().then(() => {
        v2.play()
        startSyncLoop()
      })
      setSyncPlaying(true)
    }
  }

  const handleSyncEnded = () => {
    if (syncPlaying) {
      stopSyncLoop()
      previewOriginalRef.current?.pause()
      previewBoneRef.current?.pause()
      setSyncPlaying(false)
    }
  }

  // 清理 object URL
  useEffect(() => {
    return () => {
      if (originalPreviewUrlRef.current) URL.revokeObjectURL(originalPreviewUrlRef.current)
      if (bonePreviewUrlRef.current) URL.revokeObjectURL(bonePreviewUrlRef.current)
      stopSyncLoop()
    }
  }, [])
  // 手动选帧模式的视频元素和帧列表
  const videoElRef = useRef<HTMLVideoElement | null>(null)
  const videoCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const [manualFrames, setManualFrames] = useState<ManualFrame[]>([])
  const [capturing, setCapturing] = useState(false)

  // 切换目标模式时重置相关状态
  useEffect(() => {
    setExtractMode(targetConfig.extractMode)
    setLevelName(targetConfig.defaultName)
    // follow 模式只能用视频输入 + 自动抽取 + 服务器保存
    if (targetMode === 'follow') {
      setInputMode('video')
      setEditorMode('auto')
      setSaveTarget('server')
    }
  }, [targetMode, targetConfig.extractMode, targetConfig.defaultName])

  const landmarksToTemplate = (
    landmarks: any[],
    index: number,
    timestamp?: number,
    sourceDuration?: number
  ): PoseTemplate => {
    const getKp = (name: string) => landmarks[POSE_KEYPOINTS.indexOf(name as any)]

    // 中心归一化：以双肩中心为原点，双肩距离为单位 1
    // 然后重新映射到 0-1 范围，与内置模板坐标系一致（肩中心 0.5，肩距 0.24）
    const ls = getKp('LEFT_SHOULDER'), rs = getKp('RIGHT_SHOULDER')
    let cx = 0.5, cy = 0.35, scale = 0.24
    if (ls && rs) {
      cx = (ls.x + rs.x) / 2
      cy = (ls.y + rs.y) / 2
      const dx = ls.x - rs.x
      const dy = ls.y - rs.y
      const rawScale = Math.sqrt(dx * dx + dy * dy)
      if (rawScale > 1e-6) scale = rawScale
    }

    // 归一化 → 0-1 映射：先 Procrustes 归一化，再缩放 0.24 + 平移到 (0.5, 0.35)
    const templateLandmarks: TemplateLandmark[] = POSE_KEYPOINTS.map((name, i) => {
      const lm = landmarks[i]
      if (!lm) return { name, x: 0.5, y: 0.5, z: 0 }
      // Procrustes: (lm - center) / rawScale → 再 * 0.24 + (0.5, 0.35)
      const nx = ((lm.x - cx) / scale) * 0.24 + 0.5
      const ny = ((lm.y - cy) / scale) * 0.24 + 0.35
      return {
        name,
        x: nx,
        y: ny,
        z: lm.z ?? 0,
        visibility: lm.visibility ?? 1,
      }
    })

    // scoring_rules 用归一化前的原始坐标计算角度（角度是平移/缩放不变的，结果一致）
    const rules: ScoringRule[] = []
    const le = getKp('LEFT_ELBOW'), lw = getKp('LEFT_WRIST')
    const re = getKp('RIGHT_ELBOW'), rw = getKp('RIGHT_WRIST')
    const lh = getKp('LEFT_HIP'), lk = getKp('LEFT_KNEE'), la = getKp('LEFT_ANKLE')
    const rh = getKp('RIGHT_HIP'), rk = getKp('RIGHT_KNEE'), ra = getKp('RIGHT_ANKLE')

    // 肩-腕方向角：所有模式都适用（极简模式下也能评分）
    if (ls && lw) {
      const a = directionAngle(ls, lw)
      rules.push({
        type: 'angle_dir',
        points: ['LEFT_SHOULDER', 'LEFT_WRIST'],
        targetValue: { x: Math.cos(a), y: Math.sin(a) },
        tolerance: 0.15,
        weight: 1,
        required: true,
        modes: ['minimal', 'upper', 'full'],
      })
    }
    if (rs && rw) {
      const a = directionAngle(rs, rw)
      rules.push({
        type: 'angle_dir',
        points: ['RIGHT_SHOULDER', 'RIGHT_WRIST'],
        targetValue: { x: Math.cos(a), y: Math.sin(a) },
        tolerance: 0.15,
        weight: 1,
        required: true,
        modes: ['minimal', 'upper', 'full'],
      })
    }
    // 肘部弯曲角：半身+全身适用
    if (ls && le && lw) {
      const a = threePointAngle(ls, le, lw)
      if (a > 0.2) {
        rules.push({
          type: 'angle_3pt',
          points: ['LEFT_SHOULDER', 'LEFT_ELBOW', 'LEFT_WRIST'],
          targetValue: a,
          tolerance: 0.4,
          weight: 1,
          required: true,
          modes: ['upper', 'full'],
        })
      }
    }
    if (rs && re && rw) {
      const a = threePointAngle(rs, re, rw)
      if (a > 0.2) {
        rules.push({
          type: 'angle_3pt',
          points: ['RIGHT_SHOULDER', 'RIGHT_ELBOW', 'RIGHT_WRIST'],
          targetValue: a,
          tolerance: 0.4,
          weight: 1,
          required: true,
          modes: ['upper', 'full'],
        })
      }
    }
    // 下肢规则：仅全身模式
    if (lh && la) {
      const a = directionAngle(lh, la)
      rules.push({
        type: 'angle_dir',
        points: ['LEFT_HIP', 'LEFT_ANKLE'],
        targetValue: { x: Math.cos(a), y: Math.sin(a) },
        tolerance: 0.2,
        weight: 1,
        required: false,
        modes: ['full'],
      })
    }
    if (rh && ra) {
      const a = directionAngle(rh, ra)
      rules.push({
        type: 'angle_dir',
        points: ['RIGHT_HIP', 'RIGHT_ANKLE'],
        targetValue: { x: Math.cos(a), y: Math.sin(a) },
        tolerance: 0.2,
        weight: 1,
        required: false,
        modes: ['full'],
      })
    }
    if (lh && lk && la) {
      const a = threePointAngle(lh, lk, la)
      if (a > 0.2) {
        rules.push({
          type: 'angle_3pt',
          points: ['LEFT_HIP', 'LEFT_KNEE', 'LEFT_ANKLE'],
          targetValue: a,
          tolerance: 0.4,
          weight: 1,
          required: false,
          modes: ['full'],
        })
      }
    }
    if (rh && rk && ra) {
      const a = threePointAngle(rh, rk, ra)
      if (a > 0.2) {
        rules.push({
          type: 'angle_3pt',
          points: ['RIGHT_HIP', 'RIGHT_KNEE', 'RIGHT_ANKLE'],
          targetValue: a,
          tolerance: 0.4,
          weight: 1,
          required: false,
          modes: ['full'],
        })
      }
    }

    return {
      id: 9000 + index,
      name: `动作 ${index + 1}`,
      description: '从视频提取',
      category: '自定义',
      difficulty: 2,
      icon: '🎬',
      landmarks: templateLandmarks,
      scoring_rules: rules,
      duration: 8,
      timestamp,
      sourceDuration,
    }
  }

  const cancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }

  const handleGenerateBoneVideo = async () => {
    if (generatingBoneVideo || templates.length < 2) return
    setGeneratingBoneVideo(true)
    setBoneVideoProgress(0)
    setBoneVideoBlob(null)
    try {
      // 骨骼视频尺寸与原视频一致（归一化仅在评分时使用，视频应保持原比例）
      const opts = sourceVideoSize ? { width: sourceVideoSize.width, height: sourceVideoSize.height } : undefined
      const blob = await generateBoneVideoBlob(templates, (current, total) => {
        setBoneVideoProgress(Math.round((current / total) * 100))
      }, opts)
      setBoneVideoBlob(blob)
    } catch (e) {
      console.warn('骨骼视频生成失败:', e)
      setStatusMsg('骨骼视频生成失败，可使用 canvas 插值跟练')
    } finally {
      setGeneratingBoneVideo(false)
    }
  }

  const processVideo = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setStatusMsg('请上传视频文件')
      return
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    setStatus('loading')
    setStatusMsg('正在加载视频...')
    setProgress(0)
    setTemplates([])
    setSavedCount(0)
    setSourceVideoFile(file)
    setBoneVideoBlob(null)

    try {
      const video = await loadVideoFromFile(file, controller.signal)
      const duration = video.duration
      if (!isFinite(duration) || duration <= 0) throw new Error('无法读取视频时长')

      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')

      // 记录视频元信息
      setSourceDurationSec(duration)
      setSourceResolution(
        video.videoWidth && video.videoHeight
          ? `${video.videoWidth}x${video.videoHeight}`
          : null
      )
      setSourceVideoSize(
        video.videoWidth && video.videoHeight
          ? { width: video.videoWidth, height: video.videoHeight }
          : null
      )
      // 保存 video 元素引用（播放页面需要原视频 URL）
      videoElRef.current = video

      let interval: number
      let totalFrames: number

      if (extractMode === 'follow') {
        // 跟练抽取：按 fps 采样
        interval = 1 / fps
        totalFrames = Math.max(1, Math.floor(duration / interval))
      } else {
        // 动作抽取：固定帧数均匀分布
        totalFrames = frames
        interval = duration / totalFrames
      }

      setStatus('processing')
      setStatusMsg(`正在分析视频（共 ${totalFrames} 帧，预计 ${Math.ceil(totalFrames * 0.05)}s）...`)

      const extractedPoses = await extractPosesFromVideo(video, {
        interval,
        alignCenter: extractMode === 'action',
        signal: controller.signal,
        onProgress: (current, total) => {
          setStatusMsg(`正在分析第 ${current}/${total} 帧...`)
          setProgress((current / total) * 100)
        },
      })

      const resultTemplates: PoseTemplate[] = []
      for (let i = 0; i < extractedPoses.length; i++) {
        if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
        const pose = extractedPoses[i]
        const timestamp = pose.timestamp
        // 每帧持续到下一帧的时间
        const nextTimestamp = i < extractedPoses.length - 1
          ? extractedPoses[i + 1].timestamp
          : duration
        const sourceDuration = Math.max(0.3, nextTimestamp - timestamp)

        resultTemplates.push(
          landmarksToTemplate(
            pose.landmarks as any[],
            i,
            timestamp,
            sourceDuration
          )
        )
      }

      setTemplates(resultTemplates)
      setStatus('done')
      setStatusMsg(
        extractMode === 'follow'
          ? `成功提取 ${resultTemplates.length} 帧（${fps}fps），可开始视频跟练`
          : `成功生成 ${resultTemplates.length} 个动作，可预览或开始跟练`
      )

      // 跟练模式：自动生成骨骼视频（WebCodecs 快速编码，1-3秒完成）
      if (extractMode === 'follow' && resultTemplates.length >= 2) {
        setGeneratingBoneVideo(true)
        setBoneVideoProgress(0)
        const opts = sourceVideoSize ? { width: sourceVideoSize.width, height: sourceVideoSize.height } : undefined
        generateBoneVideoBlob(resultTemplates, (current, total) => {
          setBoneVideoProgress(Math.round((current / total) * 100))
        }, opts)
          .then((blob) => setBoneVideoBlob(blob))
          .catch((e) => console.warn('骨骼视频生成失败:', e))
          .finally(() => setGeneratingBoneVideo(false))
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setStatus('idle')
        setStatusMsg('已取消')
        setProgress(0)
      } else {
        setStatus('idle')
        setStatusMsg('处理失败：' + (e.message || '未知错误'))
      }
    } finally {
      abortControllerRef.current = null
    }
  }

  const processImages = async (files: FileList) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (imageFiles.length < 2) {
      setStatusMsg('请至少上传 2 张图片')
      return
    }
    if (imageFiles.length > 12) {
      setStatusMsg('最多支持 12 张图片')
      return
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    setStatus('processing')
    setStatusMsg(`正在分析 ${imageFiles.length} 张图片...`)
    setProgress(0)
    setTemplates([])
    setSavedCount(0)
    // 图片模式元信息
    setSourceDurationSec(null)

    try {
      const resultTemplates: PoseTemplate[] = []
      let firstResolution: string | null = null
      for (let i = 0; i < imageFiles.length; i++) {
        if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError')
        setStatusMsg(`正在分析第 ${i + 1}/${imageFiles.length} 张图片...`)
        setProgress(((i + 1) / imageFiles.length) * 100)
        try {
          const img = await loadImageFromFile(imageFiles[i])
          // 记录第一张图分辨率作为代表
          if (i === 0 && img.width && img.height) {
            firstResolution = `${img.width}x${img.height}`
          }
          const landmarks = await detectPoseFromImage(img)
          if (landmarks) {
            resultTemplates.push(landmarksToTemplate(landmarks as any[], i))
          }
        } catch (e) {
          console.warn(`Image ${i} pose detection failed:`, e)
        }
      }
      setSourceResolution(firstResolution)

      if (resultTemplates.length === 0) throw new Error('未能从图片中检测到任何姿态')

      setTemplates(resultTemplates)
      setStatus('done')
      setStatusMsg(`成功从 ${resultTemplates.length} 张图片提取动作`)
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setStatus('idle')
        setStatusMsg('已取消')
        setProgress(0)
      } else {
        setStatus('idle')
        setStatusMsg('处理失败：' + (e.message || '未知错误'))
      }
    } finally {
      abortControllerRef.current = null
    }
  }

  const saveToLibrary = async () => {
    if (!isLoggedIn || !user || saving) return
    setSaving(true)
    try {
      const totalDuration = extractMode === 'follow'
        ? templates.reduce((sum, t) => sum + (t.sourceDuration ?? 0), 0)
        : templates.reduce((sum, t) => sum + (t.duration ?? 8), 0)
      const description = `从${inputMode === 'image' ? '图片' : '视频'}生成，共 ${templates.length} 帧`

      if (targetMode === 'challenge' || targetMode === 'rhythm') {
        // ============ 闯关/节拍关卡：JSON API /api/custom-levels ============
        // 先注册每帧为 PoseTemplate，收集 id
        const poseIds: number[] = []
        for (let i = 0; i < templates.length; i++) {
          const t = templates[i]
          const poseData = {
            name: `${levelName}-动作${i + 1}`,
            icon: t.icon || '🧘',
            description: t.description || `从${inputMode === 'image' ? '图片' : '视频'}第 ${i + 1} 帧提取`,
            landmarks: t.landmarks,
            scoring_rules: t.scoring_rules,
            difficulty: t.difficulty || 2,
            category: '自定义',
          }
          const pres = await fetch(`/api/pose-templates?user_id=${user.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(poseData),
          })
          if (!pres.ok) throw new Error(`创建动作 ${i + 1} 失败`)
          const pdata = await pres.json()
          poseIds.push(pdata.id)
        }
        // 创建关卡（JSON body）
        const res = await fetch('/api/custom-levels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner_id: user.id,
            name: levelName,
            description,
            target_mode: targetMode,
            input_mode: inputMode,
            pose_ids: poseIds,
            frame_count: templates.length,
            total_duration: Math.round(totalDuration),
            source_duration_sec: sourceDurationSec,
            source_resolution: sourceResolution || null,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || '保存失败')
        }
      } else {
        // ============ 跟练关卡：FormData API /api/follow-levels ============
        const formData = new FormData()
        formData.append('user_id', String(user.id))
        formData.append('name', levelName)
        formData.append('description', description)
        formData.append('input_mode', inputMode)
        formData.append('templates', JSON.stringify(templates))
        formData.append('frame_count', String(templates.length))
        formData.append('fps', String(fps))
        formData.append('total_duration', String(Math.round(totalDuration)))
        if (sourceDurationSec !== null) {
          formData.append('source_duration_sec', String(sourceDurationSec))
        }
        if (sourceResolution) {
          formData.append('source_resolution', sourceResolution)
        }
        if (sourceVideoFile) {
          formData.append('video_file', sourceVideoFile)
        }
        if (boneVideoBlob) {
          formData.append('bone_video_file', boneVideoBlob, 'bone_video.webm')
        }
        const res = await fetch('/api/follow-levels', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || '保存失败')
        }
      }
      setSavedCount(templates.length)
      // 保存到服务器成功后跳转到「我的关卡」对应 tab
      setTimeout(() => navigate(`/my-levels?mode=${targetMode}`), 900)
    } catch (e: any) {
      setStatusMsg('保存失败：' + (e.message || '未知错误'))
    } finally {
      setSaving(false)
    }
  }

  const saveToLocal = async () => {
    if (saving) return
    setSaving(true)
    console.log('[LocalSave] 开始本地保存', { targetMode, extractMode, inputMode, levelName })
    try {
      const totalDuration = extractMode === 'follow'
        ? templates.reduce((sum, t) => sum + (t.sourceDuration ?? 0), 0)
        : templates.reduce((sum, t) => sum + (t.duration ?? 8), 0)

      // 闯关/节拍：两级存储 —— 动作先写入 poses store，关卡只存 pose_ids 引用
      // 跟练：单级内嵌 templates（含 timestamp/sourceDuration/thumbnail 等视频专属字段）
      const isTwoLevel = targetMode === 'challenge' || targetMode === 'rhythm'
      let pose_ids: string[] = []
      let embeddedTemplates: PoseTemplate[] = []
      if (isTwoLevel) {
        console.log('[LocalSave] 写入动作库 poses store, 数量:', templates.length)
        pose_ids = await saveLocalPoses(templates)
        console.log('[LocalSave] 动作库写入完成, pose_ids:', pose_ids)
      } else {
        embeddedTemplates = templates
      }

      const originalBlob = (!isTwoLevel && sourceVideoFile) ? sourceVideoFile : undefined
      const payload = {
        name: levelName,
        description: `从${inputMode === 'image' ? '图片' : '视频'}生成，共 ${templates.length} 帧`,
        target_mode: targetMode,
        input_mode: inputMode,
        pose_ids,
        templates: embeddedTemplates,
        frame_count: templates.length,
        fps: extractMode === 'follow' ? fps : null,
        total_duration: Math.round(totalDuration),
        source_duration_sec: sourceDurationSec,
        source_resolution: sourceResolution,
        bone_video_blob: boneVideoBlob ?? undefined,
        // 原视频文件较大，仅跟练模式内嵌存储；闯关/节拍两级存储不存原视频，避免本地配额超限
        original_video_blob: originalBlob,
      }
      console.log('[LocalSave] 准备写入 levels store, 数据概况:', {
        isTwoLevel,
        pose_ids_len: pose_ids.length,
        embedded_len: embeddedTemplates.length,
        bone_blob_size: boneVideoBlob ? boneVideoBlob.size : 0,
        original_blob_size: originalBlob ? originalBlob.size : 0,
        frame_count: payload.frame_count,
        total_duration: payload.total_duration,
      })

      await saveLocalLevel(payload)
      console.log('[LocalSave] levels store 写入成功, savedCount:', templates.length)
      setSavedCount(templates.length)
    } catch (e: any) {
      console.error('[LocalSave] 本地保存失败:', {
        message: e?.message,
        name: e?.name,
        code: e?.code,
        stack: e?.stack,
        error: e,
      })
      setStatusMsg('本地保存失败：' + (e?.message || '未知错误'))
    } finally {
      setSaving(false)
      console.log('[LocalSave] 保存流程结束')
    }
  }

  const handleSave = () => {
    if (saveTarget === 'local') saveToLocal()
    else saveToLibrary()
  }

  const reset = () => {
    setStatus('idle')
    setTemplates([])
    setProgress(0)
    setStatusMsg('')
    setSavedCount(0)
    setManualFrames([])
    setIsPlaying(false)
    setCurrentTime(0)
    if (videoElRef.current) {
      videoElRef.current.pause()
      videoElRef.current.src = ''
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  // ============ 手动选帧模式核心逻辑 ============
  const loadVideoForEditor = useCallback(async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setStatusMsg('请上传视频文件')
      return
    }
    setStatus('loading')
    setStatusMsg('正在加载视频...')
    setManualFrames([])
    try {
      const video = await loadVideoFromFile(file)
      videoElRef.current = video
      video.addEventListener('timeupdate', () => {
        setCurrentTime(video.currentTime)
      })
      video.addEventListener('play', () => setIsPlaying(true))
      video.addEventListener('pause', () => setIsPlaying(false))

      setSourceDurationSec(video.duration)
      setSourceResolution(
        video.videoWidth && video.videoHeight
          ? `${video.videoWidth}x${video.videoHeight}`
          : null
      )
      setSourceVideoSize(
        video.videoWidth && video.videoHeight
          ? { width: video.videoWidth, height: video.videoHeight }
          : null
      )

      // 等待 video 元素挂载
      setStatus('processing')
      setStatusMsg('视频已加载，可播放选帧')
      // status 设为 'done' 以进入结果编辑模式（手动选帧是实时编辑）
      // 但这里我们先停留在 processing 状态，直到用户确认
      setStatus('done')
      setStatusMsg(`视频已加载（${Math.round(video.duration)}s），开始选帧吧`)
      // 初始空模板列表，由用户手动添加
      setTemplates([])
    } catch (e: any) {
      setStatus('idle')
      setStatusMsg('加载失败：' + (e.message || '未知错误'))
    }
  }, [])

  // 从当前视频帧捕获+检测姿态，添加到手动帧列表
  const captureCurrentFrame = useCallback(async () => {
    const video = videoElRef.current
    if (!video || capturing) return
    setCapturing(true)
    try {
      if (!videoCanvasRef.current) {
        videoCanvasRef.current = document.createElement('canvas')
      }
      const canvas = videoCanvasRef.current
      const thumbnail = captureFrame(video, canvas)

      const img = document.createElement('img')
      img.src = thumbnail
      await new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.onerror = () => resolve()
      })

      const landmarks = await detectPoseFromImage(img)
      if (!landmarks) {
        setStatusMsg('当前帧未检测到人体，请换个姿势再试')
        setTimeout(() => setStatusMsg(''), 2000)
        return
      }

      const frameId = `frame-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const timestamp = video.currentTime

      setManualFrames((prev) => {
        // 计算 sourceDuration（下一帧 timestamp - 当前，或视频结尾 - 当前）
        const next = prev.findIndex((f) => f.timestamp > timestamp)
        const nextTime = next >= 0 ? prev[next].timestamp : (sourceDurationSec ?? timestamp + 1)
        const sourceDuration = Math.max(0.3, nextTime - timestamp)
        return [...prev, {
          id: frameId,
          timestamp,
          thumbnailDataUrl: thumbnail,
          landmarks,
          sourceDuration,
        }].sort((a, b) => a.timestamp - b.timestamp)
      })
    } finally {
      setCapturing(false)
    }
  }, [capturing, sourceDurationSec])

  const removeManualFrame = useCallback((id: string) => {
    setManualFrames((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const moveManualFrame = useCallback((id: string, dir: -1 | 1) => {
    setManualFrames((prev) => {
      const idx = prev.findIndex((f) => f.id === id)
      if (idx < 0) return prev
      const nextIdx = idx + dir
      if (nextIdx < 0 || nextIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[nextIdx]] = [next[nextIdx], next[idx]]
      return next
    })
  }, [])

  // 手动帧 → PoseTemplate（带重排后的 sourceDuration）
  const manualFramesToTemplates = useCallback((): PoseTemplate[] => {
    const frames = manualFrames
    const result: PoseTemplate[] = []
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i]
      const nextTime = i < frames.length - 1
        ? frames[i + 1].timestamp
        : (sourceDurationSec ?? f.timestamp + 1)
      const sourceDuration = extractMode === 'follow'
        ? Math.max(0.3, nextTime - f.timestamp)
        : undefined
      const tpl = landmarksToTemplate(f.landmarks as any[], i, f.timestamp, sourceDuration)
      tpl.thumbnail = f.thumbnailDataUrl
      result.push(tpl)
    }
    return result
  }, [manualFrames, sourceDurationSec, extractMode])

  // 手动帧模式下：实时同步 templates 给保存/预览用
  useEffect(() => {
    if (editorMode === 'manual' && status === 'done') {
      setTemplates(manualFramesToTemplates())
    }
  }, [manualFrames, editorMode, status, manualFramesToTemplates])

  const togglePlay = useCallback(() => {
    const video = videoElRef.current
    if (!video) return
    if (video.paused) video.play()
    else video.pause()
  }, [])

  const seekBy = useCallback((delta: number) => {
    const video = videoElRef.current
    if (!video) return
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + delta))
  }, [])

  const seekTo = useCallback((time: number) => {
    const video = videoElRef.current
    if (!video) return
    video.currentTime = time
  }, [])

  return (
    <div className="min-h-screen text-white">
      <GameBackground />
      <FloatingNav title={`${inputMode === 'image' ? '图片生成' : '视频生成'}${targetConfig.label.replace('模式', '')}关卡`} subtitle={targetConfig.desc} backTo={`/single?mode=${targetMode}`} backLabel="返回选关" />
      <main className="pt-20 pb-12 px-4">
        <div className="mx-auto">
          {/* 目标模式标签 */}
          <div className="mb-10 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10">
            <targetConfig.icon size={16} className="text-emerald-400" />
            <span className="text-sm font-medium">{targetConfig.label}</span>
            <span className="text-white/40 text-xs">
              · {extractMode === 'action'
                ? (inputMode === 'image' ? '图片直接提取' : '视频均匀切分')
                : '高帧率采样'}
            </span>
          </div>

          {/* 编辑器模式切换（仅视频+动作抽取模式） */}
          {status === 'idle' && inputMode === 'video' && extractMode === 'action' && (
            <div className="mb-6 flex items-center justify-center gap-2">
              <span className="text-sm text-white/40 mr-2">编辑方式</span>
              {([
                { value: 'auto', label: '自动抽取', icon: Film, desc: '一键批量抽帧' },
                { value: 'manual', label: '手动选帧', icon: Hand, desc: '播放视频逐帧选择' },
              ] as const).map((m) => {
                const Icon = m.icon
                return (
                  <button
                    key={m.value}
                    onClick={() => setEditorMode(m.value)}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2',
                      editorMode === m.value
                        ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    )}
                  >
                    <Icon size={18} />
                    {m.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* 帧数/fps 选择（图片模式不需要，手动选帧也不需要） */}
          {status === 'idle' && inputMode === 'video' && editorMode === 'auto' && (
            <div className="mb-8 flex items-center justify-center gap-4">
              {extractMode === 'action' ? (
                <>
                  <span className="text-sm text-white/60">提取动作数</span>
                  <div className="flex gap-2">
                    {[4, 6, 8, 12].map((n) => (
                      <button
                        key={n}
                        onClick={() => setFrames(n)}
                        className={
                          'px-4 py-2 rounded-xl text-sm font-medium transition-all ' +
                          (frames === n
                            ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white'
                            : 'bg-white/10 text-white/70 hover:bg-white/20')
                        }
                      >
                        {n} 个
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <span className="text-sm text-white/60">采样帧率</span>
                  <div className="flex gap-2">
                    {[1, 2, 5, 10, 15, 30].map((f) => (
                      <button
                        key={f}
                        onClick={() => setFps(f)}
                        className={
                          'px-4 py-2 rounded-xl text-sm font-medium transition-all ' +
                          (fps === f
                            ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white'
                            : 'bg-white/10 text-white/70 hover:bg-white/20')
                        }
                      >
                        {f} fps
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 输入方式切换（仅 action 模式：闯关/节拍） */}
          {status === 'idle' && extractMode === 'action' && (
            <div className="mb-6 flex items-center justify-center gap-2">
              {([
                { value: 'video', label: '视频均匀切分', icon: Film, desc: '上传视频，自动均匀抽取' },
                { value: 'image', label: '图片上传', icon: Image, desc: '直接上传多张动作图片' },
              ] as const).map((m) => {
                const Icon = m.icon
                return (
                  <button
                    key={m.value}
                    onClick={() => setInputMode(m.value)}
                    className={
                      'px-6 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 ' +
                      (inputMode === m.value
                        ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20')
                    }
                  >
                    <Icon size={18} />
                    {m.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* 上传区 / 进度 */}
          {status !== 'done' && (
            <div className="max-w-2xl mx-auto">
              {status === 'idle' ? (
                inputMode === 'video' ? (
                  <label
                    className="flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-3xl p-12 cursor-pointer hover:border-white/40 hover:bg-white/5 transition-all"
                    onClick={() => fileRef.current?.click()}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) {
                          if (editorMode === 'manual') {
                            loadVideoForEditor(f)
                          } else {
                            processVideo(f)
                          }
                        }
                      }}
                    />
                    <Upload size={48} className="text-white/60 mb-4" />
                    <p className="text-lg font-medium mb-2">点击上传视频</p>
                    <p className="text-white/40 text-sm">
                      {extractMode === 'action'
                        ? `视频将均匀切分为 ${frames} 个动作帧`
                        : `按 ${fps}fps 采样，保留视频原节奏`}
                    </p>
                  </label>
                ) : (
                  <label
                    className="flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-3xl p-12 cursor-pointer hover:border-white/40 hover:bg-white/5 transition-all"
                    onClick={() => fileRef.current?.click()}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          processImages(e.target.files)
                        }
                      }}
                    />
                    <Upload size={48} className="text-white/60 mb-4" />
                    <p className="text-lg font-medium mb-2">点击上传图片（可多选）</p>
                    <p className="text-white/40 text-sm">支持 jpg / png / webm，2-12 张，每张提取一个动作</p>
                  </label>
                )
              ) : (
                <div className="border-2 border-dashed border-white/20 rounded-3xl p-12">
                  <div className="w-full text-center">
                    <Loader2 size={40} className="animate-spin mx-auto mb-4 text-emerald-400" />
                    <p className="text-lg font-medium mb-3">{statusMsg}</p>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-white/50 text-sm mt-2">{Math.round(progress)}%</p>
                    {(status === 'loading' || status === 'processing') && (
                      <button
                        onClick={cancelProcessing}
                        className="mt-6 px-6 py-2.5 bg-white/10 hover:bg-red-500/20 text-white/70 hover:text-red-400 rounded-xl transition-all flex items-center gap-2 mx-auto"
                      >
                        <XCircle size={18} />
                        取消
                      </button>
                    )}
                  </div>
                </div>
              )}

              {statusMsg && status === 'idle' && (
                <p className="text-center text-red-400 text-sm mt-4">{statusMsg}</p>
              )}
            </div>
          )}

          {/* 结果预览 */}
          {status === 'done' && (
            <div className="max-w-6xl mx-auto">
              {/* 手动选帧模式：视频播放器 + 已选帧列表 */}
              {editorMode === 'manual' && (
                <div className="mb-8">
                  <div className="flex items-center justify-center gap-2 mb-6 text-emerald-400">
                    <CheckCircle2 size={20} />
                    <span className="font-medium">{statusMsg}</span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 左侧：视频播放器 */}
                    <div className="lg:col-span-2">
                      <div className="aspect-video bg-black/50 rounded-2xl overflow-hidden relative">
                        {videoElRef.current && (
                          <video
                            ref={(el) => {
                              if (el && videoElRef.current && el.src !== videoElRef.current.src) {
                                // 已在 ref 中挂载
                              }
                            }}
                            src={videoElRef.current.src}
                            className="w-full h-full object-contain"
                            onLoadedMetadata={(e) => {
                              // 将 ref 指向实际 DOM
                              videoElRef.current = e.currentTarget
                            }}
                          />
                        )}
                      </div>

                      {/* 进度条 */}
                      <div className="mt-4">
                        <input
                          type="range"
                          min={0}
                          max={sourceDurationSec ?? 100}
                          step={0.01}
                          value={currentTime}
                          onChange={(e) => seekTo(parseFloat(e.target.value))}
                          className="w-full h-2 bg-white/10 rounded-full accent-emerald-500"
                        />
                        <div className="flex justify-between text-xs text-white/50 mt-1">
                          <span>{formatTime(currentTime)}</span>
                          <span>{formatTime(sourceDurationSec ?? 0)}</span>
                        </div>
                      </div>

                      {/* 控制按钮 */}
                      <div className="flex items-center justify-center gap-4 mt-4">
                        <button
                          onClick={() => seekBy(-5)}
                          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                          title="后退5秒"
                        >
                          <SkipBack size={20} />
                        </button>
                        <button
                          onClick={() => seekBy(-0.1)}
                          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-sm"
                          title="后退0.1秒"
                        >
                          -0.1s
                        </button>
                        <button
                          onClick={togglePlay}
                          className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:shadow-lg transition-all"
                        >
                          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                        </button>
                        <button
                          onClick={() => seekBy(0.1)}
                          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-sm"
                          title="前进0.1秒"
                        >
                          +0.1s
                        </button>
                        <button
                          onClick={() => seekBy(5)}
                          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                          title="前进5秒"
                        >
                          <SkipForward size={20} />
                        </button>
                        <button
                          onClick={captureCurrentFrame}
                          disabled={capturing}
                          className="ml-4 px-6 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:shadow-lg transition-all flex items-center gap-2 font-medium disabled:opacity-50"
                        >
                          {capturing ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                          捕获当前帧
                        </button>
                      </div>

                      <p className="text-center text-white/40 text-sm mt-3">
                        提示：使用 ±0.1秒 按钮逐帧调整，找到最佳姿态后点击"捕获当前帧"
                      </p>
                    </div>

                    {/* 右侧：已选帧列表 */}
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Film size={18} className="text-emerald-400" />
                          已选帧 ({manualFrames.length})
                        </h3>
                        {manualFrames.length > 0 && (
                          <button
                            onClick={() => setManualFrames([])}
                            className="text-xs text-white/50 hover:text-red-400 transition-colors"
                          >
                            清空
                          </button>
                        )}
                      </div>

                      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                        {manualFrames.length === 0 ? (
                          <div className="text-center py-12 text-white/40 text-sm">
                            <Hand size={32} className="mx-auto mb-2 opacity-50" />
                            还没有选中任何帧<br />
                            播放视频，找到好的姿势后点击"捕获当前帧"
                          </div>
                        ) : (
                          manualFrames.map((f, i) => (
                            <div
                              key={f.id}
                              className="flex items-center gap-3 p-2 rounded-xl bg-black/30 hover:bg-black/50 transition-colors group"
                            >
                              <div className="text-xs text-white/40 w-5 text-center">{i + 1}</div>
                              <img
                                src={f.thumbnailDataUrl}
                                alt={`帧 ${i + 1}`}
                                className="w-16 h-12 object-cover rounded-lg"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-mono">{formatTime(f.timestamp)}</div>
                                <div className="text-xs text-white/40">
                                  {f.sourceDuration?.toFixed(1) ?? '-'}s
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => moveManualFrame(f.id, -1)}
                                  disabled={i === 0}
                                  className="p-1 hover:bg-white/10 rounded disabled:opacity-30"
                                >
                                  <ChevronUp size={14} />
                                </button>
                                <button
                                  onClick={() => moveManualFrame(f.id, 1)}
                                  disabled={i === manualFrames.length - 1}
                                  className="p-1 hover:bg-white/10 rounded disabled:opacity-30"
                                >
                                  <ChevronDown size={14} />
                                </button>
                              </div>
                              <button
                                onClick={() => seekTo(f.timestamp)}
                                className="p-1 hover:bg-white/10 rounded text-white/60 hover:text-white"
                                title="跳转到该帧"
                              >
                                <GripVertical size={14} />
                              </button>
                              <button
                                onClick={() => removeManualFrame(f.id)}
                                className="p-1 hover:bg-red-500/20 rounded text-white/60 hover:text-red-400"
                              >
                                <X size={20} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 状态提示（两种模式共用） */}
              <div className="flex items-center justify-center gap-2 mb-6 text-emerald-400">
                <CheckCircle2 size={20} />
                <span className="font-medium">{statusMsg}</span>
              </div>

              {/* 自动抽取模式：模板预览（可折叠） */}
              {editorMode === 'auto' && templates.length > 0 && (
                <div className="mb-8">
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all mb-3"
                  >
                    <span className="text-sm font-medium text-white/80 flex items-center gap-2">
                      <Film size={16} />
                      动作预览（{templates.length} 个）
                    </span>
                    <ChevronDown
                      size={18}
                      className={`text-white/50 transition-transform ${showPreview ? '' : '-rotate-90'}`}
                    />
                  </button>
                  {showPreview && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {templates.map((t, i) => (
                        <div
                          key={i}
                          className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center"
                        >
                          <div className="flex justify-center mb-2 bg-black/20 rounded-xl py-1">
                            <PoseFigure template={t} size={96} />
                          </div>
                          <div className="text-2xl mb-1">{t.icon}</div>
                          <div className="font-semibold text-sm">{t.name}</div>
                          <div className="text-xs text-white/40">{t.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 手动选帧模式：骨架预览（可折叠） */}
              {editorMode === 'manual' && manualFrames.length > 0 && (
                <div className="mb-8">
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all mb-3"
                  >
                    <span className="text-sm font-medium text-white/80 flex items-center gap-2">
                      <Film size={16} />
                      骨架预览（{templates.length} 个动作）
                    </span>
                    <ChevronDown
                      size={18}
                      className={`text-white/50 transition-transform ${showPreview ? '' : '-rotate-90'}`}
                    />
                  </button>
                  {showPreview && (
                    <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-3">
                      {templates.map((t, i) => (
                        <div
                          key={i}
                          className="p-2 rounded-xl bg-white/5 border border-white/10 text-center"
                        >
                          <div className="flex justify-center bg-black/20 rounded-lg py-1">
                            <PoseFigure template={t} size={60} />
                          </div>
                          <div className="text-xs text-white/50 mt-1">#{i + 1}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 视频预览播放器（跟练模式：原视频 + 骨骼视频并排，同步播放） */}
              {extractMode === 'follow' && templates.length >= 2 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-white/80">视频预览</span>
                    {sourceVideoFile && boneVideoBlob && (
                      <button
                        onClick={toggleSyncPlay}
                        className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-xs flex items-center gap-1.5 transition-all"
                      >
                        {syncPlaying ? <Pause size={12} /> : <Play size={12} />}
                        {syncPlaying ? '暂停' : '同步播放'}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 原视频 */}
                    {sourceVideoFile && (
                      <div>
                        <div className="text-xs text-white/50 mb-1.5">原视频</div>
                        <div className="rounded-xl overflow-hidden bg-black border border-white/10">
                          <video
                            ref={previewOriginalRef}
                            key="original-preview"
                            src={getOriginalPreviewUrl() ?? ''}
                            controls={!syncPlaying}
                            onEnded={handleSyncEnded}
                            className="w-full max-h-52"
                          />
                        </div>
                      </div>
                    )}

                    {/* 骨骼视频 */}
                    <div>
                      <div className="text-xs text-white/50 mb-1.5">骨骼视频</div>
                      <div className="rounded-xl overflow-hidden bg-black border border-white/10">
                        {generatingBoneVideo ? (
                          <div className="flex flex-col items-center justify-center py-10">
                            <Loader2 size={20} className="animate-spin text-emerald-400 mb-2" />
                            <span className="text-xs text-white/60">生成中 {boneVideoProgress}%</span>
                            <div className="mt-2 w-32 h-1 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${boneVideoProgress}%` }} />
                            </div>
                          </div>
                        ) : boneVideoBlob ? (
                          <video
                            ref={previewBoneRef}
                            key="bone-preview"
                            src={getBonePreviewUrl() ?? ''}
                            controls={!syncPlaying}
                            onEnded={handleSyncEnded}
                            className="w-full max-h-52"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center py-10">
                            <Film size={20} className="text-white/30 mb-2" />
                            {!isFastEncodeAvailable() && (
                              <span className="text-xs text-amber-400/80 mb-1">⚠ 需要 HTTPS 才能快速生成</span>
                            )}
                            <span className="text-xs text-white/50 mb-2">未生成</span>
                            <button
                              onClick={handleGenerateBoneVideo}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs hover:bg-emerald-500/30 transition-all"
                            >
                              {isFastEncodeAvailable() ? '立即生成' : '生成（较慢）'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 关卡名称 + 底部按钮（两种模式共用） */}
              <div className="mb-6 flex items-center gap-3">
                <label className="text-sm text-white/60 whitespace-nowrap">关卡名称</label>
                <input
                  value={levelName}
                  onChange={(e) => setLevelName(e.target.value)}
                  className="flex-1 px-4 py-2 bg-white/10 rounded-xl text-white outline-none focus:bg-white/15"
                  placeholder="给关卡起个名字"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => {
                    const boneVideoUrl = boneVideoBlob ? URL.createObjectURL(boneVideoBlob) : undefined
                    const originalVideoUrl = videoElRef.current?.src
                    navigate('/play', {
                      state: {
                        templates,
                        name: levelName,
                        mode: targetMode,
                        videoUrl: originalVideoUrl,
                        boneVideoUrl,
                      },
                    })
                  }}
                  disabled={templates.length === 0}
                  className="flex-1 px-6 py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play size={20} />
                  立即开始{targetConfig.label.replace('模式', '')}
                </button>
                <div className="flex-1 flex flex-col gap-2">
                  {/* 保存目标切换 */}
                  <div className="flex items-center gap-1 self-start">
                    {([
                      { value: 'local' as const, label: '本地', icon: HardDrive, tip: '保存到浏览器本地，无需登录' },
                      { value: 'server' as const, label: '服务器', icon: Cloud, tip: '保存到服务器，跨设备可用' },
                    ]).filter(opt => {
                      // 跟练模式含视频数据较大，不支持本地保存
                      if (opt.value === 'local' && extractMode === 'follow') return false
                      return true
                    }).map((opt) => {
                      const Icon = opt.icon
                      const disabled = opt.value === 'server' && !isLoggedIn
                      return (
                        <button
                          key={opt.value}
                          onClick={() => !disabled && setSaveTarget(opt.value)}
                          disabled={disabled}
                          title={disabled ? '需要登录' : opt.tip}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all',
                            saveTarget === opt.value
                              ? 'bg-white/20 text-white'
                              : 'bg-white/5 text-white/50 hover:bg-white/10',
                            disabled && 'opacity-30 cursor-not-allowed'
                          )}
                        >
                          <Icon size={14} />
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                  {/* 保存按钮 */}
                  <button
                    onClick={handleSave}
                    disabled={saving || templates.length === 0 || (saveTarget === 'server' && !isLoggedIn)}
                    className="w-full px-6 py-4 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        保存中...
                      </>
                    ) : savedCount > 0 ? (
                      <>
                        <CheckCircle2 size={20} />
                        已保存到{saveTarget === 'local' ? '本地' : '我的关卡'}
                      </>
                    ) : (
                      <>
                        <Save size={20} />
                        保存到{saveTarget === 'local' ? '本地' : '我的关卡'}
                      </>
                    )}
                  </button>
                  {savedCount > 0 && (
                    <button
                      onClick={() => navigate(`/my-levels?mode=${targetMode}`)}
                      className="w-full px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:shadow-lg rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm"
                    >
                      <CheckCircle2 size={16} />
                      前往「我的关卡」查看
                    </button>
                  )}
                </div>
                <button
                  onClick={reset}
                  className="px-6 py-4 bg-white/10 hover:bg-white/20 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                >
                  <Film size={20} />
                  重新上传
                </button>
              </div>
            </div>
          )}

          {/* 说明 */}
          {status === 'idle' && (
            <div className="max-w-2xl mx-auto mt-8 p-5 rounded-2xl bg-white/5 border border-white/10 text-sm text-white/60">
              <p className="font-semibold text-white/80 mb-2">如何获得更好的效果？</p>
              <ul className="space-y-1.5 list-disc list-inside">
                <li>视频中人物应面向镜头，全身入镜</li>
                <li>光线充足，背景简洁，动作清晰</li>
                <li>选择动作差异明显的片段，生成的关卡更有趣</li>
                <li>所有视频处理均在本地浏览器完成，不会上传到服务器</li>
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
