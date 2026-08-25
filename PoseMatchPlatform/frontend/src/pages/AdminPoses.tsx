import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '@/store/userStore'
import { cn } from '@/lib/utils'
import FloatingNav from '@/components/FloatingNav'
import GameBackground from '@/components/GameBackground'
import PoseFigure from '@/components/PoseFigure'
import Camera from '@/components/Camera'
import type { PoseTemplate, ScoringRule, ScoringRuleType, TemplateLandmark, ScoringMode } from '@/utils/poseMatcher'
import { directionAngle, threePointAngle, pointDistance, normalizeLandmarks, directionVector, calculatePoseMatchScore, SCORING_MODES, evaluateRule, getEnabledPoints, ruleUsesEnabledPoints, ruleAppliesToMode } from '@/utils/poseMatcher'
import type { Keypoint } from '@/types/pose'
import { Plus, Edit2, Trash2, Save, X, RefreshCw, Shield, GripVertical, RotateCcw, Dumbbell, Trophy, Play, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Search, ZoomIn, Video, Upload, ChevronDown, ImageIcon, Shapes, Users, Loader2, HardDrive, Pencil, Cloud } from 'lucide-react'
import { detectPoseFromImage, loadImageFromFile } from '@/utils/poseFromImage'
import { extractPosesFromVideo, loadVideoFromFile, formatTime, type ExtractedPose } from '@/utils/videoPoseExtractor'
import { getLocalPoses, updateLocalPose, deleteLocalPose, getLocalLevels, deleteLocalLevel, resolveLocalPoseIds, renameLocalLevel, updateLocalLevelPoseIds, type LocalPose, type LocalLevel } from '@/utils/localLevelStorage'

const API_BASE = '/api/pose-templates'

const ALL_KEYPOINTS = [
  { name: 'NOSE', label: '鼻子', group: 'head' },
  { name: 'LEFT_EYE_INNER', label: '左眼内侧', group: 'head' },
  { name: 'LEFT_EYE', label: '左眼', group: 'head' },
  { name: 'LEFT_EYE_OUTER', label: '左眼外侧', group: 'head' },
  { name: 'RIGHT_EYE_INNER', label: '右眼内侧', group: 'head' },
  { name: 'RIGHT_EYE', label: '右眼', group: 'head' },
  { name: 'RIGHT_EYE_OUTER', label: '右眼外侧', group: 'head' },
  { name: 'LEFT_EAR', label: '左耳', group: 'head' },
  { name: 'RIGHT_EAR', label: '右耳', group: 'head' },
  { name: 'MOUTH_LEFT', label: '左嘴角', group: 'head' },
  { name: 'MOUTH_RIGHT', label: '右嘴角', group: 'head' },
  { name: 'LEFT_SHOULDER', label: '左肩', group: 'torso' },
  { name: 'RIGHT_SHOULDER', label: '右肩', group: 'torso' },
  { name: 'LEFT_ELBOW', label: '左肘', group: 'arm' },
  { name: 'RIGHT_ELBOW', label: '右肘', group: 'arm' },
  { name: 'LEFT_WRIST', label: '左腕', group: 'arm' },
  { name: 'RIGHT_WRIST', label: '右腕', group: 'arm' },
  { name: 'LEFT_PINKY', label: '左小指', group: 'hand' },
  { name: 'RIGHT_PINKY', label: '右小指', group: 'hand' },
  { name: 'LEFT_INDEX', label: '左食指', group: 'hand' },
  { name: 'RIGHT_INDEX', label: '右食指', group: 'hand' },
  { name: 'LEFT_THUMB', label: '左拇指', group: 'hand' },
  { name: 'RIGHT_THUMB', label: '右拇指', group: 'hand' },
  { name: 'LEFT_HIP', label: '左髋', group: 'torso' },
  { name: 'RIGHT_HIP', label: '右髋', group: 'torso' },
  { name: 'LEFT_KNEE', label: '左膝', group: 'leg' },
  { name: 'RIGHT_KNEE', label: '右膝', group: 'leg' },
  { name: 'LEFT_ANKLE', label: '左踝', group: 'leg' },
  { name: 'RIGHT_ANKLE', label: '右踝', group: 'leg' },
  { name: 'LEFT_HEEL', label: '左脚跟', group: 'foot' },
  { name: 'RIGHT_HEEL', label: '右脚跟', group: 'foot' },
  { name: 'LEFT_FOOT_INDEX', label: '左脚尖', group: 'foot' },
  { name: 'RIGHT_FOOT_INDEX', label: '右脚尖', group: 'foot' },
]

const KP_LABEL: Record<string, string> = Object.fromEntries(
  ALL_KEYPOINTS.map((k) => [k.name, k.label])
)

const MAIN_JOINTS = new Set([
  'LEFT_SHOULDER', 'RIGHT_SHOULDER',
  'LEFT_ELBOW', 'RIGHT_ELBOW',
  'LEFT_WRIST', 'RIGHT_WRIST',
  'LEFT_HIP', 'RIGHT_HIP',
  'LEFT_KNEE', 'RIGHT_KNEE',
  'LEFT_ANKLE', 'RIGHT_ANKLE',
  'NOSE',
])

const RULE_TYPE_LABELS: Record<ScoringRuleType, string> = {
  angle_dir: '向量相似度(2点)',
  angle_3pt: '三点夹角(3点)',
  distance: '距离(2点)',
  coordinate: '坐标位置(1点)',
  symmetry: '左右对称(4点)',
}

const KP_IDX: Record<string, number> = {
  NOSE: 0, LEFT_EYE_INNER: 1, LEFT_EYE: 2, LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4, RIGHT_EYE: 5, RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7, RIGHT_EAR: 8, MOUTH_LEFT: 9, MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12, LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16, LEFT_PINKY: 17, RIGHT_PINKY: 18,
  LEFT_INDEX: 19, RIGHT_INDEX: 20, LEFT_THUMB: 21, RIGHT_THUMB: 22,
  LEFT_HIP: 23, RIGHT_HIP: 24, LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28, LEFT_HEEL: 29, RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32,
}

function kp(name: string, x: number, y: number): TemplateLandmark {
  return { name, x: Math.round(x * 10000) / 10000, y: Math.round(y * 10000) / 10000 }
}

function buildLandmarksFromParams(p: PoseParams): TemplateLandmark[] {
  const cx = 0.5
  const shoulderY = 0.35
  const shoulderHalf = 0.12
  const hipY = 0.62
  const hipHalf = 0.08
  const headR = 0.08
  const headCy = shoulderY - 0.12
  const armLen = 0.22
  const upperLen = armLen * 0.48
  const foreLen = armLen * 0.52
  const legLen = 0.28
  const thighLen = legLen * 0.5
  const shinLen = legLen * 0.5

  const lm: Record<string, TemplateLandmark> = {}
  lm.LEFT_SHOULDER = kp('LEFT_SHOULDER', cx + shoulderHalf, shoulderY)
  lm.RIGHT_SHOULDER = kp('RIGHT_SHOULDER', cx - shoulderHalf, shoulderY)
  lm.LEFT_HIP = kp('LEFT_HIP', cx + hipHalf, hipY)
  lm.RIGHT_HIP = kp('RIGHT_HIP', cx - hipHalf, hipY)
  lm.NOSE = kp('NOSE', cx, headCy - headR * 0.3)
  lm.LEFT_EYE = kp('LEFT_EYE', cx + headR * 0.4, headCy - headR * 0.4)
  lm.RIGHT_EYE = kp('RIGHT_EYE', cx - headR * 0.4, headCy - headR * 0.4)
  lm.LEFT_EAR = kp('LEFT_EAR', cx + headR * 0.8, headCy - headR * 0.2)
  lm.RIGHT_EAR = kp('RIGHT_EAR', cx - headR * 0.8, headCy - headR * 0.2)
  lm.LEFT_EYE_INNER = kp('LEFT_EYE_INNER', cx + headR * 0.2, headCy - headR * 0.4)
  lm.RIGHT_EYE_INNER = kp('RIGHT_EYE_INNER', cx - headR * 0.2, headCy - headR * 0.4)
  lm.LEFT_EYE_OUTER = kp('LEFT_EYE_OUTER', cx + headR * 0.6, headCy - headR * 0.4)
  lm.RIGHT_EYE_OUTER = kp('RIGHT_EYE_OUTER', cx - headR * 0.6, headCy - headR * 0.4)
  lm.MOUTH_LEFT = kp('MOUTH_LEFT', cx + headR * 0.3, headCy + headR * 0.2)
  lm.MOUTH_RIGHT = kp('MOUTH_RIGHT', cx - headR * 0.3, headCy + headR * 0.2)

  for (const side of ['LEFT', 'RIGHT'] as const) {
    const s = side
    const sign = s === 'LEFT' ? 1 : -1
    const shoulder = lm[`${s}_SHOULDER`]
    const shoulderAngle = p[`${s.toLowerCase()}_shoulder` as keyof PoseParams] as number
    const elbowAngle = p[`${s.toLowerCase()}_elbow` as keyof PoseParams] as number

    const ex = shoulder.x + upperLen * Math.cos(shoulderAngle)
    const ey = shoulder.y + upperLen * Math.sin(shoulderAngle)
    lm[`${s}_ELBOW`] = kp(`${s}_ELBOW`, ex, ey)

    const wx = ex + foreLen * Math.cos(elbowAngle)
    const wy = ey + foreLen * Math.sin(elbowAngle)
    lm[`${s}_WRIST`] = kp(`${s}_WRIST`, wx, wy)

    lm[`${s}_PINKY`] = kp(`${s}_PINKY`, wx - sign * 0.015, wy + 0.02)
    lm[`${s}_INDEX`] = kp(`${s}_INDEX`, wx + sign * 0.01, wy + 0.025)
    lm[`${s}_THUMB`] = kp(`${s}_THUMB`, wx + sign * 0.02, wy - 0.01)

    const hip = lm[`${s}_HIP`]
    const hipAngle = p[`${s.toLowerCase()}_hip` as keyof PoseParams] as number
    const kneeAngle = p[`${s.toLowerCase()}_knee` as keyof PoseParams] as number

    const kx = hip.x + thighLen * Math.cos(hipAngle)
    const ky = hip.y + thighLen * Math.sin(hipAngle)
    lm[`${s}_KNEE`] = kp(`${s}_KNEE`, kx, ky)

    const ax = kx + shinLen * Math.cos(kneeAngle)
    const ay = ky + shinLen * Math.sin(kneeAngle)
    lm[`${s}_ANKLE`] = kp(`${s}_ANKLE`, ax, ay)

    const footLen = 0.05
    lm[`${s}_HEEL`] = kp(`${s}_HEEL`, ax - sign * footLen * 0.3, ay + 0.015)
    lm[`${s}_FOOT_INDEX`] = kp(`${s}_FOOT_INDEX`, ax + sign * footLen * 0.7, ay + 0.01)
  }

  const result: TemplateLandmark[] = new Array(33)
  for (const name of Object.keys(lm)) {
    const idx = KP_IDX[name]
    if (idx !== undefined) result[idx] = lm[name]
  }
  for (let i = 0; i < 33; i++) {
    if (!result[i]) {
      const name = Object.keys(KP_IDX).find((k) => KP_IDX[k] === i)!
      result[i] = kp(name, 0.5, 0.5)
    }
  }
  return result
}

interface PoseParams {
  left_shoulder: number
  right_shoulder: number
  left_elbow: number
  right_elbow: number
  left_hip: number
  right_hip: number
  left_knee: number
  right_knee: number
}

const DEFAULT_PARAMS: PoseParams = {
  left_shoulder: Math.PI / 2,
  right_shoulder: Math.PI / 2,
  left_elbow: Math.PI / 2,
  right_elbow: Math.PI / 2,
  left_hip: Math.PI / 2,
  right_hip: Math.PI / 2,
  left_knee: Math.PI / 2,
  right_knee: Math.PI / 2,
}

function paramsFromLandmarks(lms: TemplateLandmark[]): PoseParams {
  const p = { ...DEFAULT_PARAMS }
  const getKp = (name: string) => lms[KP_IDX[name]]
  const ls = getKp('LEFT_SHOULDER'), le = getKp('LEFT_ELBOW'), lw = getKp('LEFT_WRIST')
  const rs = getKp('RIGHT_SHOULDER'), re = getKp('RIGHT_ELBOW'), rw = getKp('RIGHT_WRIST')
  const lh = getKp('LEFT_HIP'), lk = getKp('LEFT_KNEE'), la = getKp('LEFT_ANKLE')
  const rh = getKp('RIGHT_HIP'), rk = getKp('RIGHT_KNEE'), ra = getKp('RIGHT_ANKLE')
  if (ls && le) p.left_shoulder = directionAngle(ls, le)
  if (rs && re) p.right_shoulder = directionAngle(rs, re)
  if (le && lw) p.left_elbow = directionAngle(le, lw)
  if (re && rw) p.right_elbow = directionAngle(re, rw)
  if (lh && lk) p.left_hip = directionAngle(lh, lk)
  if (rh && rk) p.right_hip = directionAngle(rh, rk)
  if (lk && la) p.left_knee = directionAngle(lk, la)
  if (rk && ra) p.right_knee = directionAngle(rk, ra)
  return p
}

function defaultScoringRules(): ScoringRule[] {
  return [
    { type: 'angle_dir', points: ['LEFT_SHOULDER', 'LEFT_WRIST'], targetValue: { x: 0, y: 1 }, tolerance: 0.15, weight: 1, required: true },
    { type: 'angle_dir', points: ['RIGHT_SHOULDER', 'RIGHT_WRIST'], targetValue: { x: 0, y: 1 }, tolerance: 0.15, weight: 1, required: true },
  ]
}

function buildTemplateFromForm(form: any): PoseTemplate {
  return {
    id: form.id || 0,
    name: form.name,
    description: form.description,
    category: form.category,
    difficulty: Number(form.difficulty),
    icon: form.icon,
    landmarks: form.landmarks,
    scoring_rules: form.scoringRules,
    duration: Number(form.duration),
  }
}

function formFromTemplate(template: PoseTemplate) {
  const params = paramsFromLandmarks(template.landmarks)
  // 数据迁移：angle_dir 规则的 targetValue 如果是 number（旧格式角度），转成向量
  const scoringRules = (template.scoring_rules || []).map((r) => {
    if (r.type === 'angle_dir' && typeof r.targetValue === 'number') {
      const angle = r.targetValue
      return { ...r, targetValue: { x: Math.cos(angle), y: Math.sin(angle) } }
    }
    return { ...r }
  })
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    difficulty: template.difficulty,
    icon: template.icon,
    duration: template.duration,
    landmarks: (template.landmarks || []).map((l) => ({ ...l })),
    params,
    scoringRules,
  }
}

interface LevelData {
  id: number | string
  name: string
  desc: string
  pose_ids: (number | string)[]
  time_limit: number
  min_match: number
  is_final: boolean
  tag: string
}

interface RhythmLevelData {
  id: number | string
  name: string
  desc: string
  pose_ids: (number | string)[]
  tag: string
  icon: string
  is_all: boolean
}

interface FollowLevelData {
  id: number | string
  name: string
  desc: string
  fps: number | null
  frame_count: number
  total_duration: number
  video_path: string | null
  bone_video_path: string | null
  author: string
  play_count: number
  favorite_count: number
}

/** 我的关卡编辑弹窗表单（统一处理云端/本地 × 闯关/节拍/跟练） */
interface MyLevelForm {
  id: number | string
  name: string
  desc: string
  mode: 'challenge' | 'rhythm' | 'follow'
  source: 'myCloud' | 'myLocal'
  pose_ids: (number | string)[]
  // 云端闯关 PUT 需要完整 body，保留以下字段
  time_limit?: number
  min_match?: number
  is_final?: boolean
  tag?: string
  icon?: string
  is_all?: boolean
}

/** 统一关卡 API 基础路径（预设+自定义同表） */
const PRESET_API = '/api/custom-levels'

type TabType = 'poses' | 'levels' | 'rhythmLevels' | 'followLevels'

export function AdminPoses() {
  const navigate = useNavigate()
  const { user, isLoggedIn } = useUserStore()
  const [activeTab, setActiveTab] = useState<TabType>('poses')
  const [templates, setTemplates] = useState<PoseTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | string | null>(null)
  const [form, setForm] = useState(formFromTemplate({
    id: 0, name: '', description: '', category: '热身', difficulty: 1, icon: '🏋️',
    landmarks: buildLandmarksFromParams(DEFAULT_PARAMS),
    scoring_rules: defaultScoringRules(),
    duration: 5,
  }))

  const [levels, setLevels] = useState<LevelData[]>([])
  const [showLevelModal, setShowLevelModal] = useState(false)
  const [editingLevelId, setEditingLevelId] = useState<number | string | null>(null)
  const [levelForm, setLevelForm] = useState<LevelData>({
    id: 0, name: '', desc: '', pose_ids: [], time_limit: 45, min_match: 60, is_final: false, tag: '',
  })

  const [rhythmLevels, setRhythmLevels] = useState<RhythmLevelData[]>([])
  const [showRhythmLevelModal, setShowRhythmLevelModal] = useState(false)
  const [editingRhythmLevelId, setEditingRhythmLevelId] = useState<number | string | null>(null)
  const [rhythmLevelForm, setRhythmLevelForm] = useState<RhythmLevelData>({
    id: '', name: '', desc: '', pose_ids: [], tag: '', icon: '🧘', is_all: false,
  })

  // 跟练关卡（浏览所有公开跟练关卡，无预设机制）
  const [followLevels, setFollowLevels] = useState<FollowLevelData[]>([])
  const [followLevelSearch, setFollowLevelSearch] = useState('')
  const [followLevelsLoading, setFollowLevelsLoading] = useState(false)

  // 我的云端关卡（闯关/节拍/跟练，私有）
  const [myCloudChallenge, setMyCloudChallenge] = useState<LevelData[]>([])
  const [myCloudRhythm, setMyCloudRhythm] = useState<RhythmLevelData[]>([])
  const [myCloudFollow, setMyCloudFollow] = useState<FollowLevelData[]>([])
  // 我的本地关卡（全部模式，按 target_mode 在渲染时过滤）
  const [myLocalLevels, setMyLocalLevels] = useState<LocalLevel[]>([])

  // 我的关卡编辑弹窗（统一改名 + 闯关/节拍动作编排）
  const [showMyLevelModal, setShowMyLevelModal] = useState(false)
  const [myLevelForm, setMyLevelForm] = useState<MyLevelForm>({
    id: '', name: '', desc: '', mode: 'challenge', source: 'myCloud', pose_ids: [],
  })
  const [myLevelPreviewIdx, setMyLevelPreviewIdx] = useState(0)
  const [myLevelSelectorOpen, setMyLevelSelectorOpen] = useState(false)
  const [myLevelPoseSearch, setMyLevelPoseSearch] = useState('')
  const myLevelSelectorRef = useRef<HTMLDivElement>(null)

  const [levelPreviewIdx, setLevelPreviewIdx] = useState(0)
  const [rhythmLevelPreviewIdx, setRhythmLevelPreviewIdx] = useState(0)
  const [levelSearch, setLevelSearch] = useState('')
  const [rhythmLevelSearch, setRhythmLevelSearch] = useState('')
  const [poseSearch, setPoseSearch] = useState('')
  // 本地动作（IndexedDB poses store，闯关/节拍两级存储的独立动作单元）
  const [localPoses, setLocalPoses] = useState<LocalPose[]>([])
  // 当前编辑目标来源：'server' 走 API，'local' 走 IndexedDB
  const [editingSource, setEditingSource] = useState<'server' | 'local'>('server')
  const [levelSelectorOpen, setLevelSelectorOpen] = useState(false)
  const [rhythmLevelSelectorOpen, setRhythmLevelSelectorOpen] = useState(false)
  const levelSelectorRef = useRef<HTMLDivElement>(null)
  const rhythmLevelSelectorRef = useRef<HTMLDivElement>(null)

  const [showPreviewTest, setShowPreviewTest] = useState(false)
  const [previewScore, setPreviewScore] = useState(0)
  const [previewHasPerson, setPreviewHasPerson] = useState(false)
  const [previewRuleScores, setPreviewRuleScores] = useState<{ rule: ScoringRule; score: number | null }[]>([])
  const [previewScoringMode, setPreviewScoringMode] = useState<ScoringMode>('full')
  const [extractingFromImage, setExtractingFromImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imagePoseInputRef = useRef<HTMLInputElement>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)

  const [showVideoGenModal, setShowVideoGenModal] = useState(false)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)
  const [extractInterval, setExtractInterval] = useState(3)
  const [extracting, setExtracting] = useState(false)
  const [extractProgress, setExtractProgress] = useState({ current: 0, total: 0 })
  const [extractedPoses, setExtractedPoses] = useState<(ExtractedPose & { name: string; icon: string })[]>([])
  const [levelName, setLevelName] = useState('')
  const [levelDesc, setLevelDesc] = useState('')
  const [videoGenType, setVideoGenType] = useState<'level' | 'stage' | 'pose'>('level')
  const videoFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (levelSelectorRef.current && !levelSelectorRef.current.contains(e.target as Node)) {
        setLevelSelectorOpen(false)
      }
      if (rhythmLevelSelectorRef.current && !rhythmLevelSelectorRef.current.contains(e.target as Node)) {
        setRhythmLevelSelectorOpen(false)
      }
      if (myLevelSelectorRef.current && !myLevelSelectorRef.current.contains(e.target as Node)) {
        setMyLevelSelectorOpen(false)
      }
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isAdmin = isLoggedIn && user.isAdmin

  // 判断模板是否可编辑：管理员可编辑所有，普通用户只能编辑自己创建的
  function canEditTemplate(t: PoseTemplate): boolean {
    if (isAdmin) return true
    if (!isLoggedIn) return false
    return t.created_by === user.id
  }

  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/')
      return
    }
    loadTemplates()
    loadLevels()
    loadRhythmLevels()
    loadFollowLevels()
    loadMyCloudLevels()
    loadMyLocalLevels()
  }, [isLoggedIn, navigate])

  async function loadTemplates() {
    setLoading(true)
    try {
      const res = await fetch(API_BASE)
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
      }
    } catch (e) {
      console.error('加载模板失败:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'poses' && localPoses.length === 0) {
      loadLocalPoses()
    }
  }, [activeTab])

  // 加载本地动作（IndexedDB poses store）
  async function loadLocalPoses() {
    try {
      const data = await getLocalPoses()
      setLocalPoses(data.sort((a, b) => b.created_at - a.created_at))
    } catch (e) {
      console.error('加载本地动作失败:', e)
      setLocalPoses([])
    }
  }

  function openCreate() {
    setEditingSource('server')
    setEditingId(null)
    setForm(formFromTemplate({
      id: 0, name: '', description: '',
      category: templates[0]?.category || '热身',
      difficulty: 1, icon: '🏋️',
      landmarks: buildLandmarksFromParams({ ...DEFAULT_PARAMS, left_shoulder: 0, right_shoulder: Math.PI }),
      scoring_rules: [
        { type: 'angle_dir', points: ['LEFT_SHOULDER', 'LEFT_WRIST'], targetValue: 0, tolerance: 0.5, weight: 1, required: true },
        { type: 'angle_dir', points: ['RIGHT_SHOULDER', 'RIGHT_WRIST'], targetValue: Math.PI, tolerance: 0.5, weight: 1, required: true },
      ],
      duration: 5,
    }))
    setShowModal(true)
  }

  // 从图片生成动作：点击下拉项 → 选图 → 检测姿态 → 打开编辑弹窗
  function openCreateFromImage() {
    setAddMenuOpen(false)
    imagePoseInputRef.current?.click()
  }

  async function handleImagePoseCreate(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      return
    }
    setExtractingFromImage(true)
    try {
      const img = await loadImageFromFile(file)
      const landmarks = await detectPoseFromImage(img)
      if (!landmarks) {
        alert('未检测到人体姿态，请确保照片中人物清晰可见')
        return
      }
      const templateLms: TemplateLandmark[] = landmarks.map((lm, idx) => ({
        name: lm.name || ALL_KEYPOINTS[idx]?.name || `LM_${idx}`,
        x: lm.x, y: lm.y, z: lm.z,
      }))
      const newParams = paramsFromLandmarks(templateLms)
      const newRules = buildDefaultRulesFromLandmarks(templateLms)
      setEditingId(null)
      setForm({
        ...formFromTemplate({
          id: 0, name: '', description: '',
          category: templates[0]?.category || '热身',
          difficulty: 1, icon: '🏋️',
          landmarks: templateLms,
          scoring_rules: newRules,
          duration: 5,
        }),
        params: newParams,
        landmarks: templateLms,
        scoringRules: newRules,
      })
      setShowModal(true)
    } catch (err: any) {
      alert(`提取失败: ${err.message || '未知错误'}`)
    } finally {
      setExtractingFromImage(false)
    }
  }

  // 从视频生成动作
  function openCreateFromVideo() {
    setAddMenuOpen(false)
    setVideoFile(null)
    setVideoElement(null)
    setExtractedPoses([])
    setExtractProgress({ current: 0, total: 0 })
    setLevelName('')
    setLevelDesc('')
    setVideoGenType('pose')
    setShowVideoGenModal(true)
  }

  // 直接新增动作
  function openCreateDirect() {
    setAddMenuOpen(false)
    openCreate()
  }

  function openEdit(template: PoseTemplate) {
    setEditingSource('server')
    setEditingId(template.id)
    setForm(formFromTemplate(template))
    setShowModal(true)
  }

  // 编辑本地动作（IndexedDB poses store）
  function openEditLocalPose(pose: LocalPose) {
    setEditingSource('local')
    setEditingId(pose.id)
    const tpl: PoseTemplate = {
      id: pose.id,
      name: pose.name,
      description: pose.description,
      category: pose.category,
      difficulty: pose.difficulty,
      icon: pose.icon,
      landmarks: pose.landmarks,
      scoring_rules: pose.scoring_rules,
      duration: pose.duration,
    }
    setForm(formFromTemplate(tpl))
    setShowModal(true)
  }

  function quickEditPose(template: PoseTemplate) {
    setShowLevelModal(false)
    setShowRhythmLevelModal(false)
    openEdit(template)
  }

  function quickCreatePose() {
    setShowLevelModal(false)
    setShowRhythmLevelModal(false)
    openCreate()
  }

  async function handleSave() {
    if (!form.name.trim()) {
      alert('请输入动作名称')
      return
    }
    if (form.scoringRules.length === 0) {
      alert('至少添加一条评分规则')
      return
    }

    const template = buildTemplateFromForm(form)
    try {
      // 本地动作：走 IndexedDB（updateLocalPose），不调用服务器 API
      if (editingSource === 'local' && editingId) {
        const existing = localPoses.find((p) => p.id === editingId)
        if (!existing) throw new Error('本地动作不存在')
        const updated: LocalPose = {
          ...existing,
          name: template.name,
          description: template.description || '',
          category: template.category || 'general',
          difficulty: template.difficulty ?? 1,
          icon: template.icon || '🧘',
          landmarks: template.landmarks || [],
          scoring_rules: template.scoring_rules || [],
          duration: template.duration ?? 5,
        }
        await updateLocalPose(updated)
        setShowModal(false)
        loadLocalPoses()
        return
      }
      // 云端动作：走 API
      let res
      if (editingId) {
        res = await fetch(`${API_BASE}/${editingId}?user_id=${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(template),
        })
      } else {
        res = await fetch(`${API_BASE}?user_id=${user.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(template),
        })
      }
      if (!res.ok) throw new Error('保存失败')
      setShowModal(false)
      loadTemplates()
    } catch (e: any) {
      alert(e.message || '保存失败')
    }
  }

  async function handleDelete(id: number | string) {
    if (!confirm('确定要删除这个动作吗？')) return
    try {
      // 本地动作：检查是否被本地关卡引用，被引用则禁止删除
      const isLocal = typeof id === 'string' && localPoses.some((p) => p.id === id)
      if (isLocal) {
        const rhythmLevels = await getLocalLevels()
        const referencing = rhythmLevels.filter((c) => c.pose_ids?.includes(id as string))
        if (referencing.length > 0) {
          alert(`该动作被 ${referencing.length} 个本地关卡引用，请先删除或调整引用关卡后再删除动作`)
          return
        }
        await deleteLocalPose(id as string)
        loadLocalPoses()
        return
      }
      const res = await fetch(`${API_BASE}/${id}?user_id=${user.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || '删除失败')
      }
      loadTemplates()
    } catch (e: any) {
      alert(e.message || '删除失败')
    }
  }

  // ========== 关卡管理 ==========
  async function loadLevels() {
    try {
      const res = await fetch(`${PRESET_API}?is_preset=true&target_mode=challenge&limit=100`)
      if (res.ok) {
        const data = await res.json()
        const arr = Array.isArray(data) ? data : (data.items ?? [])
        setLevels(arr.map((r: any) => ({
          id: r.id, name: r.name, desc: r.desc || r.description || '',
          pose_ids: r.pose_ids || [], time_limit: r.time_limit ?? 45,
          min_match: r.min_match ?? 60, is_final: r.is_final ?? false, tag: r.tag ?? '',
        })))
      }
    } catch (e) {
      console.error('加载关卡失败:', e)
    }
  }

  function openLevelCreate() {
    setEditingLevelId(null)
    setLevelForm({
      id: 0, name: '', desc: '', pose_ids: [], time_limit: 45, min_match: 60, is_final: false, tag: '',
    })
    setShowLevelModal(true)
  }

  function openLevelEdit(level: LevelData) {
    setEditingLevelId(level.id)
    setLevelForm({ ...level })
    setShowLevelModal(true)
  }

  async function saveLevel() {
    if (!levelForm.name.trim()) {
      alert('请输入关卡名称')
      return
    }
    try {
      const body = { ...levelForm, description: levelForm.desc, target_mode: 'challenge' }
      let res
      if (editingLevelId) {
        res = await fetch(`${PRESET_API}/${editingLevelId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch(`${PRESET_API}/preset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }
      if (!res.ok) throw new Error('保存失败')
      setShowLevelModal(false)
      loadLevels()
    } catch (e: any) {
      alert(e.message || '保存失败')
    }
  }

  async function deleteLevel(id: number | string) {
    if (!confirm('确定要删除这个关卡吗？')) return
    try {
      const res = await fetch(`${PRESET_API}/${id}?user_id=${user.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('删除失败')
      loadLevels()
    } catch (e: any) {
      alert(e.message || '删除失败')
    }
  }

  function openVideoGenModal() {
    setVideoFile(null)
    setVideoElement(null)
    setExtractedPoses([])
    setExtractProgress({ current: 0, total: 0 })
    setLevelName('')
    setLevelDesc('')
    setVideoGenType(activeTab === 'rhythmLevels' ? 'stage' : 'level')
    setShowVideoGenModal(true)
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('video/')) {
      alert('请选择视频文件')
      return
    }

    setVideoFile(file)
    setExtractedPoses([])

    try {
      const video = await loadVideoFromFile(file)
      setVideoElement(video)
      setLevelName(file.name.replace(/\.[^/.]+$/, ''))
    } catch (err: any) {
      alert(err.message || '视频加载失败')
    }
  }

  async function startExtract() {
    if (!videoElement) return

    setExtracting(true)
    setExtractProgress({ current: 0, total: 0 })
    setExtractedPoses([])

    try {
      const poses = await extractPosesFromVideo(
        videoElement,
        extractInterval,
        (current, total) => setExtractProgress({ current, total })
      )

      const namedPoses = poses.map((p, i) => ({
        ...p,
        name: `动作 ${i + 1}`,
        icon: '🧘',
      }))

      setExtractedPoses(namedPoses)

      if (poses.length === 0) {
        alert('未检测到有效人体姿态，请检查视频内容')
      }
    } catch (err: any) {
      console.error('提取失败:', err)
      alert(`提取失败: ${err.message || '未知错误'}`)
    } finally {
      setExtracting(false)
    }
  }

  function updateExtractedPoseName(idx: number, name: string) {
    const newPoses = [...extractedPoses]
    newPoses[idx] = { ...newPoses[idx], name }
    setExtractedPoses(newPoses)
  }

  function removeExtractedPose(idx: number) {
    setExtractedPoses(extractedPoses.filter((_, i) => i !== idx))
  }

  function moveExtractedPose(idx: number, dir: -1 | 1) {
    const newPoses = [...extractedPoses]
    const target = idx + dir
    if (target < 0 || target >= newPoses.length) return
    ;[newPoses[idx], newPoses[target]] = [newPoses[target], newPoses[idx]]
    setExtractedPoses(newPoses)
  }

  async function generateLevelFromVideo() {
    if (extractedPoses.length === 0) {
      alert('没有可生成的动作')
      return
    }

    if (videoGenType !== 'pose' && !levelName.trim()) {
      alert(`请输入${videoGenType === 'level' ? '关卡' : '课程'}名称`)
      return
    }

    try {
      const createdPoseIds: number[] = []

      for (const pose of extractedPoses) {
        const templateLms: TemplateLandmark[] = pose.landmarks.map((lm, idx) => ({
          name: ALL_KEYPOINTS[idx]?.name || lm.name || `LM_${idx}`,
          x: lm.x,
          y: lm.y,
          z: lm.z,
        }))

        const rules = buildDefaultRulesFromLandmarks(templateLms)

        const poseData = {
          name: pose.name,
          icon: pose.icon,
          description: `从视频第 ${formatTime(pose.timestamp)} 提取`,
          landmarks: templateLms,
          scoring_rules: rules,
          difficulty: 2,
          category: '自定义',
        }

        const res = await fetch(`${API_BASE}?user_id=${user.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(poseData),
        })

        if (!res.ok) throw new Error(`创建动作失败: ${pose.name}`)
        const data = await res.json()
        createdPoseIds.push(data.id)
      }

      if (videoGenType === 'level') {
        const levelData = {
          target_mode: 'challenge',
          name: levelName,
          description: levelDesc || `从视频生成，共 ${createdPoseIds.length} 个动作`,
          pose_ids: createdPoseIds,
          time_limit: 60,
          min_match: 60,
          is_final: false,
          tag: '',
        }

        const res = await fetch(`${PRESET_API}/preset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(levelData),
        })

        if (!res.ok) throw new Error('创建关卡失败')
      } else if (videoGenType === 'stage') {
        const rhythmLevelData = {
          target_mode: 'rhythm',
          name: levelName,
          description: levelDesc || `从视频生成，共 ${createdPoseIds.length} 个动作`,
          pose_ids: createdPoseIds,
          tag: '视频生成',
          icon: '🎬',
          is_all: false,
        }

        const res = await fetch(`${PRESET_API}/preset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rhythmLevelData),
        })

        if (!res.ok) throw new Error('创建课程失败')
      }

      const typeNames: Record<string, string> = { level: '关卡', stage: '课程', pose: '' }
      const typeName = typeNames[videoGenType]
      alert(`成功生成！\n动作：${createdPoseIds.length} 个${typeName ? `\n${typeName}：${levelName}` : ''}`)
      setShowVideoGenModal(false)
      loadTemplates()
      loadLevels()
      loadRhythmLevels()
    } catch (err: any) {
      console.error('生成失败:', err)
      alert(`生成失败: ${err.message || '未知错误'}`)
    }
  }

  function moveLevelPose(idx: number, dir: -1 | 1) {
    const ids = [...levelForm.pose_ids]
    const target = idx + dir
    if (target < 0 || target >= ids.length) return
    ;[ids[idx], ids[target]] = [ids[target], ids[idx]]
    setLevelForm({ ...levelForm, pose_ids: ids })
  }

  function addLevelPose(poseId: number | string) {
    setLevelForm({ ...levelForm, pose_ids: [...levelForm.pose_ids, poseId] })
  }

  function removeLevelPose(idx: number) {
    setLevelForm({ ...levelForm, pose_ids: levelForm.pose_ids.filter((_, i) => i !== idx) })
  }

  function toggleLevelPose(poseId: number) {
    const exists = levelForm.pose_ids.includes(poseId)
    if (exists) {
      setLevelForm({ ...levelForm, pose_ids: levelForm.pose_ids.filter((id) => id !== poseId) })
    } else {
      setLevelForm({ ...levelForm, pose_ids: [...levelForm.pose_ids, poseId] })
    }
  }

  // ========== 关卡管理 ==========
  async function loadRhythmLevels() {
    try {
      const res = await fetch(`${PRESET_API}?is_preset=true&target_mode=rhythm&limit=100`)
      if (res.ok) {
        const data = await res.json()
        const arr = Array.isArray(data) ? data : (data.items ?? [])
        setRhythmLevels(arr.map((r: any) => ({
          id: r.id, name: r.name, desc: r.desc || r.description || '',
          pose_ids: r.pose_ids || [], tag: r.tag ?? '', icon: r.icon ?? '🧘',
          is_all: r.is_all ?? false,
        })))
      }
    } catch (e) {
      console.error('加载课程失败:', e)
    }
  }

  // ========== 跟练关卡浏览（所有公开跟练关卡，无预设机制） ==========
  async function loadFollowLevels() {
    setFollowLevelsLoading(true)
    try {
      const res = await fetch(`/api/follow-levels?is_public=true&limit=100`)
      if (res.ok) {
        const data = await res.json()
        const arr = Array.isArray(data) ? data : (data.items ?? [])
        setFollowLevels(arr.map((r: any) => ({
          id: r.id,
          name: r.name,
          desc: r.desc || r.description || '',
          fps: r.fps ?? null,
          frame_count: r.frame_count ?? 0,
          total_duration: r.total_duration ?? 0,
          video_path: r.video_path ?? null,
          bone_video_path: r.bone_video_path ?? null,
          author: r.author_nickname || r.author || '匿名作者',
          play_count: r.play_count ?? 0,
          favorite_count: r.favorite_count ?? 0,
        })))
      }
    } catch (e) {
      console.error('加载跟练关卡失败:', e)
    } finally {
      setFollowLevelsLoading(false)
    }
  }

  // ========== 我的云端关卡（私有，闯关/节拍/跟练） ==========
  async function loadMyCloudLevels() {
    if (!isLoggedIn) return
    try {
      // 闯关 + 节拍：同一 API 按 target_mode 拉取
      const [chRes, rhRes, fcRes] = await Promise.all([
        fetch(`${PRESET_API}?owner_id=${user.id}&is_preset=false&target_mode=challenge&limit=50`),
        fetch(`${PRESET_API}?owner_id=${user.id}&is_preset=false&target_mode=rhythm&limit=50`),
        fetch(`/api/follow-levels?owner_id=${user.id}&limit=50`),
      ])
      if (chRes.ok) {
        const data = await chRes.json()
        const arr = Array.isArray(data) ? data : (data.items ?? [])
        setMyCloudChallenge(arr.map((r: any) => ({
          id: r.id, name: r.name, desc: r.desc || r.description || '',
          pose_ids: r.pose_ids || [], time_limit: r.time_limit ?? 45,
          min_match: r.min_match ?? 60, is_final: r.is_final ?? false, tag: r.tag ?? '',
        })))
      }
      if (rhRes.ok) {
        const data = await rhRes.json()
        const arr = Array.isArray(data) ? data : (data.items ?? [])
        setMyCloudRhythm(arr.map((r: any) => ({
          id: r.id, name: r.name, desc: r.desc || r.description || '',
          pose_ids: r.pose_ids || [], tag: r.tag ?? '', icon: r.icon ?? '🧘',
          is_all: r.is_all ?? false,
        })))
      }
      if (fcRes.ok) {
        const data = await fcRes.json()
        const arr = Array.isArray(data) ? data : (data.items ?? [])
        setMyCloudFollow(arr.map((r: any) => ({
          id: r.id, name: r.name, desc: r.desc || r.description || '',
          fps: r.fps ?? null, frame_count: r.frame_count ?? 0,
          total_duration: r.total_duration ?? 0, video_path: r.video_path ?? null,
          bone_video_path: r.bone_video_path ?? null,
          author: r.author_nickname || r.author || '我',
          play_count: r.play_count ?? 0, favorite_count: r.favorite_count ?? 0,
        })))
      }
    } catch (e) {
      console.error('加载我的云端关卡失败:', e)
    }
  }

  // ========== 我的本地关卡（IndexedDB levels store，全部模式） ==========
  async function loadMyLocalLevels() {
    try {
      const data = await getLocalLevels()
      setMyLocalLevels(data.sort((a, b) => b.created_at - a.created_at))
    } catch (e) {
      console.error('加载我的本地关卡失败:', e)
      setMyLocalLevels([])
    }
  }

  // ========== 我的关卡编辑（统一改名 + 闯关/节拍动作编排） ==========
  function openMyCloudLevelEdit(level: LevelData | RhythmLevelData | FollowLevelData, mode: 'challenge' | 'rhythm' | 'follow') {
    if (mode === 'challenge') {
      const l = level as LevelData
      setMyLevelForm({
        id: l.id, name: l.name, desc: l.desc, mode, source: 'myCloud', pose_ids: l.pose_ids,
        time_limit: l.time_limit, min_match: l.min_match, is_final: l.is_final, tag: l.tag,
      })
    } else if (mode === 'rhythm') {
      const l = level as RhythmLevelData
      setMyLevelForm({
        id: l.id, name: l.name, desc: l.desc, mode, source: 'myCloud', pose_ids: l.pose_ids,
        tag: l.tag, icon: l.icon, is_all: l.is_all,
      })
    } else {
      const l = level as FollowLevelData
      setMyLevelForm({ id: l.id, name: l.name, desc: l.desc, mode, source: 'myCloud', pose_ids: [] })
    }
    setMyLevelPreviewIdx(0)
    setMyLevelPoseSearch('')
    setShowMyLevelModal(true)
  }

  function openMyLocalLevelEdit(level: LocalLevel) {
    setMyLevelForm({
      id: level.id,
      name: level.name,
      desc: level.description,
      mode: level.target_mode,
      source: 'myLocal',
      pose_ids: level.target_mode === 'follow' ? [] : (level.pose_ids || []),
    })
    setMyLevelPreviewIdx(0)
    setMyLevelPoseSearch('')
    setShowMyLevelModal(true)
  }

  async function saveMyLevel() {
    if (!myLevelForm.name.trim()) { alert('请输入名称'); return }
    const { id, name, desc, mode, source, pose_ids } = myLevelForm
    try {
      if (source === 'myCloud') {
        if (mode === 'follow') {
          const res = await fetch(`/api/follow-levels/${id}/rename`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, name, description: desc }),
          })
          if (!res.ok) throw new Error('改名失败')
        } else if (mode === 'challenge') {
          const body = {
            id, name, desc, description: desc, pose_ids, target_mode: 'challenge',
            time_limit: myLevelForm.time_limit, min_match: myLevelForm.min_match,
            is_final: myLevelForm.is_final, tag: myLevelForm.tag,
          }
          const res = await fetch(`${PRESET_API}/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!res.ok) throw new Error('保存失败')
        } else {
          const body = {
            id, name, desc, description: desc, pose_ids, target_mode: 'rhythm',
            tag: myLevelForm.tag, icon: myLevelForm.icon, is_all: myLevelForm.is_all,
          }
          const res = await fetch(`${PRESET_API}/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!res.ok) throw new Error('保存失败')
        }
      } else {
        // 本地：改名 + 闯关/节拍动作编排
        await renameLocalLevel(String(id), name, desc)
        if (mode !== 'follow') {
          await updateLocalLevelPoseIds(String(id), pose_ids.map(String))
        }
      }
      setShowMyLevelModal(false)
      loadMyCloudLevels()
      loadMyLocalLevels()
    } catch (e: any) {
      alert(e.message || '保存失败')
    }
  }

  async function deleteMyCloudLevel(id: number | string, mode: 'challenge' | 'rhythm' | 'follow') {
    if (!confirm('确定删除这个关卡？')) return
    try {
      const base = mode === 'follow' ? '/api/follow-levels' : PRESET_API
      const res = await fetch(`${base}/${id}?user_id=${user.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('删除失败')
      loadMyCloudLevels()
    } catch (e: any) {
      alert(e.message || '删除失败')
    }
  }

  async function deleteMyLocalLevel(id: string) {
    if (!confirm('确定删除这个本地关卡？')) return
    try {
      await deleteLocalLevel(id)
      loadMyLocalLevels()
    } catch (e: any) {
      alert(e.message || '删除失败')
    }
  }

  // 本地闯关/节拍关卡发布到社区：上传动作+创建云端关卡+发布+删除本地副本
  async function handlePublishLocalLevel(level: LocalLevel) {
    if (!isLoggedIn || !user) { alert('请先登录'); return }
    if (level.target_mode === 'follow') { alert('跟练关卡请在视频导入页发布'); return }
    if (!confirm(`将「${level.name}」发布到社区？\n发布后所有用户可浏览游玩。`)) return
    try {
      const templatesToUpload = await resolveLocalPoseIds(level.pose_ids || [])
      if (templatesToUpload.length === 0) { alert('该关卡没有可发布的动作'); return }
      const poseIds: number[] = []
      for (let i = 0; i < templatesToUpload.length; i++) {
        const t = templatesToUpload[i]
        const pres = await fetch(`/api/pose-templates?user_id=${user.id}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `${level.name}-动作${i + 1}`, icon: t.icon || '🧘',
            description: t.description || `第 ${i + 1} 帧`,
            landmarks: t.landmarks, scoring_rules: t.scoring_rules,
            difficulty: t.difficulty || 2, category: '自定义',
          }),
        })
        if (!pres.ok) throw new Error(`创建动作 ${i + 1} 失败`)
        poseIds.push((await pres.json()).id)
      }
      const cres = await fetch('/api/custom-levels', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: user.id, name: level.name,
          description: level.description || `共 ${templatesToUpload.length} 帧`,
          target_mode: level.target_mode, input_mode: level.input_mode,
          pose_ids: poseIds, frame_count: level.frame_count,
          total_duration: level.total_duration,
          source_duration_sec: level.source_duration_sec,
          source_resolution: level.source_resolution,
        }),
      })
      if (!cres.ok) throw new Error('创建云端关卡失败')
      const cdata = await cres.json()
      const pres2 = await fetch(`/api/custom-levels/${cdata.id}/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      if (!pres2.ok) throw new Error('发布到社区失败')
      await deleteLocalLevel(level.id)
      alert('发布成功')
      loadMyCloudLevels()
      loadMyLocalLevels()
    } catch (e: any) {
      alert(e.message || '发布失败')
    }
  }

  // 我的关卡动作编排辅助
  function moveMyLevelPose(idx: number, dir: -1 | 1) {
    const ids = [...myLevelForm.pose_ids]
    const target = idx + dir
    if (target < 0 || target >= ids.length) return
    ;[ids[idx], ids[target]] = [ids[target], ids[idx]]
    setMyLevelForm({ ...myLevelForm, pose_ids: ids })
  }
  function addMyLevelPose(poseId: number | string) {
    setMyLevelForm({ ...myLevelForm, pose_ids: [...myLevelForm.pose_ids, poseId] })
  }
  function removeMyLevelPose(idx: number) {
    setMyLevelForm({ ...myLevelForm, pose_ids: myLevelForm.pose_ids.filter((_, i) => i !== idx) })
  }
  // 预览：根据来源从云端动作库或本地动作库解析 PoseTemplate
  function getMyLevelPoseTemplate(pid: number | string): PoseTemplate | undefined {
    if (myLevelForm.source === 'myLocal') {
      const p = localPoses.find((lp) => lp.id === pid)
      if (!p) return undefined
      return {
        id: p.id, name: p.name, description: p.description, category: p.category,
        difficulty: p.difficulty, icon: p.icon, landmarks: p.landmarks,
        scoring_rules: p.scoring_rules, duration: p.duration,
      }
    }
    return templates.find((t) => t.id === pid)
  }

  function openRhythmLevelCreate() {
    setEditingRhythmLevelId(null)
    setRhythmLevelForm({
      id: '', name: '', desc: '', pose_ids: [], tag: '', icon: '🧘', is_all: false,
    })
    setShowRhythmLevelModal(true)
  }

  function openRhythmLevelEdit(level: RhythmLevelData) {
    setEditingRhythmLevelId(level.id)
    setRhythmLevelForm({ ...level })
    setShowRhythmLevelModal(true)
  }

  async function saveRhythmLevel() {
    if (!rhythmLevelForm.name.trim()) {
      alert('请输入课程名称')
      return
    }
    try {
      const body = { ...rhythmLevelForm, description: rhythmLevelForm.desc, target_mode: 'rhythm' }
      let res
      if (editingRhythmLevelId) {
        res = await fetch(`${PRESET_API}/${editingRhythmLevelId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch(`${PRESET_API}/preset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }
      if (!res.ok) throw new Error('保存失败')
      setShowRhythmLevelModal(false)
      loadRhythmLevels()
    } catch (e: any) {
      alert(e.message || '保存失败')
    }
  }

  async function deleteRhythmLevel(id: number | string) {
    if (!confirm('确定要删除这个课程吗？')) return
    try {
      const res = await fetch(`${PRESET_API}/${id}?user_id=${user.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('删除失败')
      loadRhythmLevels()
    } catch (e: any) {
      alert(e.message || '删除失败')
    }
  }

  function moveRhythmLevelPose(idx: number, dir: -1 | 1) {
    const ids = [...rhythmLevelForm.pose_ids]
    const target = idx + dir
    if (target < 0 || target >= ids.length) return
    ;[ids[idx], ids[target]] = [ids[target], ids[idx]]
    setRhythmLevelForm({ ...rhythmLevelForm, pose_ids: ids })
  }

  function addRhythmLevelPose(poseId: number | string) {
    setRhythmLevelForm({ ...rhythmLevelForm, pose_ids: [...rhythmLevelForm.pose_ids, poseId] })
  }

  function removeRhythmLevelPose(idx: number) {
    setRhythmLevelForm({ ...rhythmLevelForm, pose_ids: rhythmLevelForm.pose_ids.filter((_, i) => i !== idx) })
  }

  function toggleRhythmLevelPose(poseId: number) {
    const exists = rhythmLevelForm.pose_ids.includes(poseId)
    if (exists) {
      setRhythmLevelForm({ ...rhythmLevelForm, pose_ids: rhythmLevelForm.pose_ids.filter((id) => id !== poseId) })
    } else {
      setRhythmLevelForm({ ...rhythmLevelForm, pose_ids: [...rhythmLevelForm.pose_ids, poseId] })
    }
  }

  function updateParam(key: keyof PoseParams, value: number) {
    const newParams = { ...form.params, [key]: value }
    const newLandmarks = buildLandmarksFromParams(newParams)
    setForm({ ...form, params: newParams, landmarks: newLandmarks })
  }

  function resetParams() {
    const newLandmarks = buildLandmarksFromParams(DEFAULT_PARAMS)
    setForm({ ...form, params: { ...DEFAULT_PARAMS }, landmarks: newLandmarks })
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件')
      return
    }

    setExtractingFromImage(true)
    try {
      const img = await loadImageFromFile(file)
      const landmarks = await detectPoseFromImage(img)

      if (!landmarks) {
        alert('未检测到人体姿态，请确保照片中人物清晰可见')
        return
      }

      const templateLms: TemplateLandmark[] = landmarks.map((lm, idx) => ({
        name: lm.name || ALL_KEYPOINTS[idx]?.name || `LM_${idx}`,
        x: lm.x,
        y: lm.y,
        z: lm.z,
      }))

      const newParams = paramsFromLandmarks(templateLms)
      const newRules = buildDefaultRulesFromLandmarks(templateLms)

      setForm({
        ...form,
        landmarks: templateLms,
        params: newParams,
        scoringRules: newRules,
      })
    } catch (err: any) {
      console.error('提取姿态失败:', err)
      alert(`提取失败: ${err.message || '未知错误'}`)
    } finally {
      setExtractingFromImage(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  function buildDefaultRulesFromLandmarks(lms: TemplateLandmark[]): ScoringRule[] {
    const rules: ScoringRule[] = []
    const getKp = (name: string) => lms[KP_IDX[name]]

    const ls = getKp('LEFT_SHOULDER'), le = getKp('LEFT_ELBOW'), lw = getKp('LEFT_WRIST')
    const rs = getKp('RIGHT_SHOULDER'), re = getKp('RIGHT_ELBOW'), rw = getKp('RIGHT_WRIST')
    const lh = getKp('LEFT_HIP'), lk = getKp('LEFT_KNEE'), la = getKp('LEFT_ANKLE')
    const rh = getKp('RIGHT_HIP'), rk = getKp('RIGHT_KNEE'), ra = getKp('RIGHT_ANKLE')

    if (ls && lw) {
      const leftArmAngle = directionAngle(ls, lw)
      rules.push({
        type: 'angle_dir',
        points: ['LEFT_SHOULDER', 'LEFT_WRIST'],
        targetValue: { x: Math.cos(leftArmAngle), y: Math.sin(leftArmAngle) },
        tolerance: 0.15,
        weight: 1,
        required: true,
      })
    }

    if (rs && rw) {
      const rightArmAngle = directionAngle(rs, rw)
      rules.push({
        type: 'angle_dir',
        points: ['RIGHT_SHOULDER', 'RIGHT_WRIST'],
        targetValue: { x: Math.cos(rightArmAngle), y: Math.sin(rightArmAngle) },
        tolerance: 0.15,
        weight: 1,
        required: true,
      })
    }

    if (ls && le && lw) {
      const leftElbowAngle = threePointAngle(ls, le, lw)
      if (leftElbowAngle > 0.2) {
        rules.push({
          type: 'angle_3pt',
          points: ['LEFT_SHOULDER', 'LEFT_ELBOW', 'LEFT_WRIST'],
          targetValue: leftElbowAngle,
          tolerance: 0.4,
          weight: 1,
          required: true,
        })
      }
    }

    if (rs && re && rw) {
      const rightElbowAngle = threePointAngle(rs, re, rw)
      if (rightElbowAngle > 0.2) {
        rules.push({
          type: 'angle_3pt',
          points: ['RIGHT_SHOULDER', 'RIGHT_ELBOW', 'RIGHT_WRIST'],
          targetValue: rightElbowAngle,
          tolerance: 0.4,
          weight: 1,
          required: true,
        })
      }
    }

    if (lh && la) {
      const leftLegAngle = directionAngle(lh, la)
      rules.push({
        type: 'angle_dir',
        points: ['LEFT_HIP', 'LEFT_ANKLE'],
        targetValue: { x: Math.cos(leftLegAngle), y: Math.sin(leftLegAngle) },
        tolerance: 0.2,
        weight: 1,
        required: false,
        modes: ['full'],
      })
    }

    if (rh && ra) {
      const rightLegAngle = directionAngle(rh, ra)
      rules.push({
        type: 'angle_dir',
        points: ['RIGHT_HIP', 'RIGHT_ANKLE'],
        targetValue: { x: Math.cos(rightLegAngle), y: Math.sin(rightLegAngle) },
        tolerance: 0.2,
        weight: 1,
        required: false,
        modes: ['full'],
      })
    }

    if (lh && lk && la) {
      const leftKneeAngle = threePointAngle(lh, lk, la)
      if (leftKneeAngle > 0.2) {
        rules.push({
          type: 'angle_3pt',
          points: ['LEFT_HIP', 'LEFT_KNEE', 'LEFT_ANKLE'],
          targetValue: leftKneeAngle,
          tolerance: 0.5,
          weight: 1,
          required: false,
          modes: ['full'],
        })
      }
    }

    if (rh && rk && ra) {
      const rightKneeAngle = threePointAngle(rh, rk, ra)
      if (rightKneeAngle > 0.2) {
        rules.push({
          type: 'angle_3pt',
          points: ['RIGHT_HIP', 'RIGHT_KNEE', 'RIGHT_ANKLE'],
          targetValue: rightKneeAngle,
          tolerance: 0.5,
          weight: 1,
          required: false,
          modes: ['full'],
        })
      }
    }

    return rules
  }

  function updateLandmark(idx: number, field: 'x' | 'y', value: number) {
    const newLms = [...form.landmarks]
    newLms[idx] = { ...newLms[idx], [field]: value }
    const newParams = paramsFromLandmarks(newLms)
    setForm({ ...form, landmarks: newLms, params: newParams })
  }

  function addRule() {
    const newRule: ScoringRule = {
      type: 'angle_dir',
      points: ['LEFT_SHOULDER', 'LEFT_WRIST'],
      targetValue: { x: 0, y: 1 },
      tolerance: 0.15,
      weight: 1,
      required: true,
    }
    setForm({ ...form, scoringRules: [...form.scoringRules, newRule] })
  }

  function removeRule(idx: number) {
    setForm({ ...form, scoringRules: form.scoringRules.filter((_: ScoringRule, i: number) => i !== idx) })
  }

  function updateRule(idx: number, field: string, value: any) {
    const newRules = [...form.scoringRules]
    newRules[idx] = { ...newRules[idx], [field]: value }
    setForm({ ...form, scoringRules: newRules })
  }

  function updateRulePoint(ruleIdx: number, pointIdx: number, name: string) {
    const newRules = [...form.scoringRules]
    const newPoints = [...newRules[ruleIdx].points]
    newPoints[pointIdx] = name
    newRules[ruleIdx] = { ...newRules[ruleIdx], points: newPoints }
    setForm({ ...form, scoringRules: newRules })
  }

  function toggleRuleMode(ruleIdx: number, mode: ScoringMode) {
    const newRules = [...form.scoringRules]
    const rule = newRules[ruleIdx]
    const allModes: ScoringMode[] = ['minimal', 'upper', 'full']
    let currentModes = rule.modes
      ? [...rule.modes]
      : allModes.filter((m) => ruleUsesEnabledPoints(rule, getEnabledPoints(m)))

    if (currentModes.includes(mode)) {
      currentModes = currentModes.filter((m) => m !== mode)
    } else {
      currentModes.push(mode)
    }

    newRules[ruleIdx] = { ...newRules[ruleIdx], modes: currentModes }
    setForm({ ...form, scoringRules: newRules })
  }

  function recalcRuleTarget(ruleIdx: number) {
    const rule = form.scoringRules[ruleIdx]
    // 使用归一化后的坐标计算目标值（与评分时一致）
    const normLms = normalizeLandmarks(form.landmarks)
    const getKp = (name: string) => normLms[KP_IDX[name]]

    if (rule.type === 'angle_dir' && rule.points.length >= 2) {
      const p1 = getKp(rule.points[0]), p2 = getKp(rule.points[1])
      if (p1 && p2) {
        const vec = directionVector(p1, p2)
        // 归一化为单位向量
        const mag = Math.sqrt(vec.x * vec.x + vec.y * vec.y)
        if (mag > 1e-6) {
          const unitVec = { x: vec.x / mag, y: vec.y / mag }
          updateRule(ruleIdx, 'targetValue', {
            x: Math.round(unitVec.x * 10000) / 10000,
            y: Math.round(unitVec.y * 10000) / 10000,
          })
        }
      }
    } else if (rule.type === 'angle_3pt' && rule.points.length >= 3) {
      const p1 = getKp(rule.points[0]), v = getKp(rule.points[1]), p3 = getKp(rule.points[2])
      if (p1 && v && p3) {
        const target = threePointAngle(p1, v, p3)
        updateRule(ruleIdx, 'targetValue', Math.round(target * 10000) / 10000)
      }
    } else if (rule.type === 'distance' && rule.points.length >= 2) {
      const p1 = getKp(rule.points[0]), p2 = getKp(rule.points[1])
      if (p1 && p2) {
        const target = pointDistance(p1, p2)
        updateRule(ruleIdx, 'targetValue', Math.round(target * 10000) / 10000)
      }
    }
  }

  function expectedPointCount(type: ScoringRuleType): number {
    if (type === 'angle_dir') return 2
    if (type === 'angle_3pt') return 3
    if (type === 'distance') return 2
    if (type === 'coordinate') return 1
    if (type === 'symmetry') return 4
    return 2
  }

  function adjustRulePoints(ruleIdx: number, newType: ScoringRuleType) {
    const expected = expectedPointCount(newType)
    const newRules = [...form.scoringRules]
    let points = [...newRules[ruleIdx].points]
    while (points.length < expected) points.push('LEFT_SHOULDER')
    points = points.slice(0, expected)
    let newTarget: number | { x: number; y: number } = newType === 'angle_dir' ? { x: 0, y: 1 } : 0
    newRules[ruleIdx] = { ...newRules[ruleIdx], type: newType, points, targetValue: newTarget }
    setForm({ ...form, scoringRules: newRules })
  }

  if (!isLoggedIn) return null

  const categories = Array.from(new Set(templates.map((t) => t.category)))
  const previewTemplate = buildTemplateFromForm(form)
  const lastUpdateRef = useRef<number>(0)
  const UPDATE_INTERVAL = 100

  function handlePoseResult(hasPerson: boolean, landmarks: Keypoint[] | null) {
    const now = Date.now()
    if (now - lastUpdateRef.current < UPDATE_INTERVAL) return
    lastUpdateRef.current = now

    setPreviewHasPerson(hasPerson)
    if (!hasPerson || !landmarks) {
      setPreviewScore(0)
      setPreviewRuleScores([])
      return
    }

    const score = calculatePoseMatchScore(landmarks, previewTemplate, previewScoringMode)
    setPreviewScore(score)

    const rules = previewTemplate.scoring_rules.filter((r) => ruleAppliesToMode(r, previewScoringMode))
    const normalizedLive = normalizeLandmarks(landmarks)

    const ruleScores = rules.map((rule) => ({
      rule,
      score: evaluateRule(rule, normalizedLive),
    }))
    setPreviewRuleScores(ruleScores)
  }

  const tabs = [
    { key: 'poses' as const, label: '动作浏览', desc: '动作模板', icon: Dumbbell },
    { key: 'levels' as const, label: isAdmin ? '关卡管理' : '关卡浏览', desc: '闯关关卡', icon: Trophy },
    { key: 'rhythmLevels' as const, label: isAdmin ? '关卡管理' : '关卡浏览', desc: '节拍关卡', icon: Play },
    { key: 'followLevels' as const, label: '关卡浏览', desc: '跟练关卡', icon: Users },
  ]

  function handleRefresh() {
    if (activeTab === 'poses') { loadTemplates(); loadLocalPoses() }
    if (activeTab === 'levels') { loadLevels(); loadMyCloudLevels(); loadMyLocalLevels() }
    if (activeTab === 'rhythmLevels') { loadRhythmLevels(); loadMyCloudLevels(); loadMyLocalLevels() }
    if (activeTab === 'followLevels') { loadFollowLevels(); loadMyCloudLevels(); loadMyLocalLevels() }
  }

  function handleAdd() {
    if (activeTab === 'poses') openCreate()
    if (activeTab === 'levels') openLevelCreate()
    if (activeTab === 'rhythmLevels') openRhythmLevelCreate()
    // followLevels 无预设/创建入口，仅浏览
  }

  // 本地关卡按模式分组（用于分区渲染与统计）
  const myLocalChallenge = myLocalLevels.filter((l) => l.target_mode === 'challenge')
  const myLocalRhythm = myLocalLevels.filter((l) => l.target_mode === 'rhythm')
  const myLocalFollow = myLocalLevels.filter((l) => l.target_mode === 'follow')

  function getHeaderStats() {
    if (activeTab === 'poses') return `共 ${templates.length} 个动作，${categories.length} 个分类`
    if (activeTab === 'levels') return `系统预设 ${levels.length} · 我的云端 ${myCloudChallenge.length} · 我的本地 ${myLocalChallenge.length}`
    if (activeTab === 'rhythmLevels') return `系统预设 ${rhythmLevels.length} · 我的云端 ${myCloudRhythm.length} · 我的本地 ${myLocalRhythm.length}`
    if (activeTab === 'followLevels') return `公开 ${followLevels.length} · 我的云端 ${myCloudFollow.length} · 我的本地 ${myLocalFollow.length}`
    return ''
  }

  // 当前 tab 的搜索值
  const currentSearchValue = activeTab === 'poses' ? poseSearch
    : activeTab === 'levels' ? levelSearch
    : activeTab === 'rhythmLevels' ? rhythmLevelSearch
    : followLevelSearch
  const setCurrentSearchValue = (v: string) => {
    if (activeTab === 'poses') setPoseSearch(v)
    else if (activeTab === 'levels') setLevelSearch(v)
    else if (activeTab === 'rhythmLevels') setRhythmLevelSearch(v)
    else setFollowLevelSearch(v)
  }

  // ========== 统一关卡卡片 ==========
  type LevelSource = 'preset' | 'myCloud' | 'myLocal'
  type LevelMode = 'challenge' | 'rhythm' | 'follow'

  function renderUnifiedLevelCard(cfg: {
    key: string
    name: string
    desc: string
    source: LevelSource
    mode: LevelMode
    iconEmoji?: string
    index?: number
    is_final?: boolean
    is_all?: boolean
    actionCount?: number
    frameCount?: number
    duration?: number
    time_limit?: number
    min_match?: number
    tag?: string
    fps?: number | null
    author?: string
    play_count?: number
    favorite_count?: number
    canEdit: boolean
    canDelete: boolean
    canPublish?: boolean
    onEdit: () => void
    onDelete: () => void
    onPublish?: () => void
  }) {
    const isChallenge = cfg.mode === 'challenge'
    const isRhythm = cfg.mode === 'rhythm'
    const isFollow = cfg.mode === 'follow'
    // 图标区
    let iconArea: React.ReactNode
    if (isChallenge) {
      iconArea = (
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center font-bold text-sm flex-shrink-0">
          {cfg.index ?? '#'}
        </div>
      )
    } else if (isRhythm) {
      iconArea = <span className="text-2xl flex-shrink-0">{cfg.iconEmoji || '🧘'}</span>
    } else {
      iconArea = (
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
          <Users size={18} />
        </div>
      )
    }
    // 来源徽章
    const sourceBadge = cfg.source === 'myCloud' ? (
      <span className="badge badge-cloud">
        <Cloud size={8} />云端
      </span>
    ) : cfg.source === 'myLocal' ? (
      <span className="badge badge-local">
        <HardDrive size={8} />本地
      </span>
    ) : null
    // 副标题（模式特定）
    let subtitle: string
    if (isChallenge) {
      subtitle = cfg.is_final ? '全部动作' : `${cfg.actionCount ?? 0}个动作`
    } else if (isRhythm) {
      subtitle = `${cfg.tag || '未分类'} · ${cfg.is_all ? '全部动作' : `${cfg.actionCount ?? 0}个动作`}`
    } else {
      subtitle = cfg.author || '匿名作者'
    }
    // 底部信息
    const footerInfo: React.ReactNode[] = []
    if (isChallenge) {
      footerInfo.push(<span key="tl" className="flex items-center gap-1"><span>⏱</span>{cfg.time_limit ?? 45}s</span>)
      footerInfo.push(<span key="mm" className="flex items-center gap-1"><span>🎯</span>{cfg.min_match ?? 60}%</span>)
      if (cfg.tag) footerInfo.push(<span key="tag" className="flex items-center gap-1"><span>🏷️</span>{cfg.tag}</span>)
    } else if (isFollow) {
      footerInfo.push(<span key="fc" className="flex items-center gap-1"><span>🎬</span>{cfg.frameCount ?? 0}帧</span>)
      if (cfg.fps) footerInfo.push(<span key="fps" className="flex items-center gap-1"><span>⚡</span>{cfg.fps}fps</span>)
      if (cfg.duration != null) footerInfo.push(<span key="dur" className="flex items-center gap-1"><span>⏱</span>{cfg.duration.toFixed(1)}s</span>)
      if (cfg.play_count != null) footerInfo.push(<span key="pc" className="flex items-center gap-1"><span>▶️</span>{cfg.play_count}</span>)
      if (cfg.favorite_count != null) footerInfo.push(<span key="fc2" className="flex items-center gap-1"><span>❤</span>{cfg.favorite_count}</span>)
    }
    return (
      <div
        key={cfg.key}
        className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all group"
      >
        <div className="flex items-start gap-3 mb-2">
          <div className="w-14 h-14 flex items-center justify-center bg-black/30 rounded-xl flex-shrink-0 overflow-hidden">
            {iconArea}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <h3 className="font-semibold truncate">{cfg.name}</h3>
              {isChallenge && cfg.is_final && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-medium flex-shrink-0">最终</span>
              )}
              {sourceBadge}
            </div>
            <p className="text-white/50 text-xs line-clamp-2">{cfg.desc || subtitle}</p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60 truncate">{subtitle}</span>
            {footerInfo.length > 0 && (
              <span className="flex items-center gap-2 text-white/40">{footerInfo}</span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {cfg.canEdit && (
              <button
                onClick={cfg.onEdit}
                className="p-1 rounded text-white/30 hover:text-emerald-400 hover:bg-emerald-500/20 transition-all"
                title="编辑"
              >
                {cfg.source === 'preset' ? <Edit2 size={12} /> : <Pencil size={12} />}
              </button>
            )}
            {cfg.canPublish && (
              <button
                onClick={cfg.onPublish}
                className="p-1 rounded text-white/30 hover:text-cyan-400 hover:bg-cyan-500/20 transition-all"
                title="发布到社区"
              >
                <Upload size={12} />
              </button>
            )}
            {cfg.canDelete && (
              <button
                onClick={cfg.onDelete}
                className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/20 transition-all"
                title="删除"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 分区标题
  function renderSectionHeader(title: string, count: number, icon: React.ReactNode, accent: string) {
    return (
      <div className="flex items-center gap-2 mb-3 mt-2">
        <span className={accent}>{icon}</span>
        <h3 className="text-sm font-semibold text-white/80">{title}</h3>
        <span className="text-xs text-white/40">（{count} 个）</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-white">
      <GameBackground />
      <FloatingNav title="内容管理" subtitle="管理动作模板、闯关关卡、跟练关卡" />
      <main className="pt-20 pb-12 px-4">
        <div className="mx-auto">
        {/* 操作栏：搜索 + 新增动作 + 新增关卡（整体居中） */}
        <div className="flex items-center justify-center mb-6 gap-3 flex-wrap">
          {/* 搜索框 */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={currentSearchValue}
              onChange={(e) => setCurrentSearchValue(e.target.value)}
              placeholder={`搜索${activeTab === 'poses' ? '动作' : activeTab === 'levels' ? '关卡' : activeTab === 'rhythmLevels' ? '关卡' : '跟练关卡'}...`}
              className="w-48 pl-9 pr-4 py-2.5 glass rounded-xl bg-white/5 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            />
          </div>

          {/* 新增动作下拉框 + 新增关卡按钮（跟练关卡 tab 为只读浏览，隐藏创建入口） */}
          {activeTab !== 'followLevels' && (
            <>
              {/* 新增动作下拉框 */}
              <div ref={addMenuRef} className="relative">
                <button
                  onClick={() => setAddMenuOpen(!addMenuOpen)}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all flex items-center gap-2 font-medium"
                >
                  <Plus size={18} />
                  <span>新增动作</span>
                  <ChevronDown size={16} className={cn('transition-transform', addMenuOpen && 'rotate-180')} />
                </button>
                {addMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl py-1 z-50">
                    <button
                      onClick={openCreateFromImage}
                      className="flex items-center gap-3 px-4 py-2.5 w-full hover:bg-white/10 transition-colors text-left"
                    >
                      <ImageIcon size={18} className="text-emerald-400" />
                      <span className="text-sm">从图片生成</span>
                    </button>
                    <button
                      onClick={openCreateFromVideo}
                      className="flex items-center gap-3 px-4 py-2.5 w-full hover:bg-white/10 transition-colors text-left"
                    >
                      <Video size={18} className="text-purple-400" />
                      <span className="text-sm">从视频生成</span>
                    </button>
                    <div className="my-1 border-t border-white/10" />
                    <button
                      onClick={openCreateDirect}
                      className="flex items-center gap-3 px-4 py-2.5 w-full hover:bg-white/10 transition-colors text-left"
                    >
                      <Plus size={18} className="text-emerald-400" />
                      <span className="text-sm">直接增加</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 新增关卡按钮 */}
              <button
                onClick={openLevelCreate}
                className="px-6 py-3 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl hover:from-cyan-500 hover:to-blue-600 transition-all flex items-center gap-2 font-medium"
              >
                <Plus size={18} />
                <span>新增关卡</span>
              </button>
            </>
          )}
        </div>

        {/* 隐藏的图片上传输入（从图片生成动作） */}
        <input
          type="file"
          accept="image/*"
          ref={imagePoseInputRef}
          onChange={handleImagePoseCreate}
          className="hidden"
        />

        {/* Tab 切换（与 SinglePlayer 一致） */}
        <div className="mb-6 max-w-3xl mx-auto">
          <div className="glass rounded-2xl p-1 flex">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex-1 flex flex-col items-center justify-center gap-1 py-3 px-4 rounded-xl font-medium transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-lg'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={18} />
                    <span>{tab.label}</span>
                  </div>
                  <span className={cn('text-xs', isActive ? 'text-white/80' : 'text-white/40')}>
                    {tab.desc}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {activeTab === 'poses' && (
          <>
            {loading && templates.length === 0 ? (
              <div className="text-center py-20 text-white/50">加载中...</div>
            ) : (
              <>
                {/* 我的本地动作（闯关/节拍两级存储的独立动作，可编辑/复用） */}
                {(() => {
                  const filtered = localPoses.filter((p) => p.name.toLowerCase().includes(poseSearch.toLowerCase()))
                  if (filtered.length === 0) return null
                  return (
                    <>
                      <div className="flex items-center gap-2 mb-3 mt-2">
                        <HardDrive size={16} className="text-amber-400" />
                        <h3 className="text-sm font-semibold text-white/80">我的本地动作</h3>
                        <span className="text-xs text-white/40">（{filtered.length} 个 · 可跨关卡复用）</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mx-auto mb-6">
                        {filtered.map((p) => {
                          const tpl: PoseTemplate = {
                            id: p.id, name: p.name, description: p.description, category: p.category,
                            difficulty: p.difficulty, icon: p.icon, landmarks: p.landmarks,
                            scoring_rules: p.scoring_rules, duration: p.duration,
                          }
                          return (
                            <div
                              key={p.id}
                              className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-amber-400/30 hover:border-amber-400/60 transition-all group"
                            >
                              <div className="flex items-start gap-3 mb-2">
                                <div className="w-14 h-14 flex items-center justify-center bg-black/30 rounded-xl flex-shrink-0 overflow-hidden">
                                  <PoseFigure template={tpl} size={56} scoringMode="minimal" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                    <h3 className="font-semibold truncate">{p.name}</h3>
                                    <span className="badge badge-local">
                                      <HardDrive size={8} />本地
                                    </span>
                                  </div>
                                  <p className="text-white/50 text-xs line-clamp-2">{p.description || '暂无描述'}</p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                                  {p.category} · {'⭐'.repeat(p.difficulty)}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="text-white/40">{p.scoring_rules?.length || 0} 条规则</span>
                                  <button
                                    onClick={() => openEditLocalPose(p)}
                                    className="p-1 rounded text-white/30 hover:text-emerald-400 hover:bg-emerald-500/20 transition-all"
                                    title="编辑"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(p.id)}
                                    className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/20 transition-all"
                                    title="删除"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}

                {/* 云端动作 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mx-auto">
                {templates
                  .filter((t) => t.name.toLowerCase().includes(poseSearch.toLowerCase()))
                  .map((t) => (
                  <div
                    key={`${t.id}-${t.name}`}
                    className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all group"
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <div className="w-14 h-14 flex items-center justify-center bg-black/30 rounded-xl flex-shrink-0 overflow-hidden">
                        <PoseFigure template={t} size={56} scoringMode="minimal" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <h3 className="font-semibold truncate">{t.name}</h3>
                          {t.created_by == null && (
                            <span className="badge badge-system">系统</span>
                          )}
                          {t.created_by != null && (
                            <span className="badge badge-custom">自定义</span>
                          )}
                        </div>
                        <p className="text-white/50 text-xs line-clamp-2">{t.description || '暂无描述'}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                        {t.category} · {'⭐'.repeat(t.difficulty)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-white/40">{t.scoring_rules?.length || 0} 条规则</span>
                        {canEditTemplate(t) && (
                          <>
                            <button
                              onClick={() => openEdit(t)}
                              className="p-1 rounded text-white/30 hover:text-emerald-400 hover:bg-emerald-500/20 transition-all"
                              title="编辑"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDelete(t.id)}
                              className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/20 transition-all"
                              title="删除"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              </>
            )}
          </>
        )}

        {activeTab === 'levels' && (
          <>
            {/* 系统预设区 */}
            {renderSectionHeader('系统预设', levels.filter((l) => l.name.toLowerCase().includes(levelSearch.toLowerCase())).length, <Trophy size={16} className="text-amber-400" />, '')}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mx-auto mb-6">
              {levels
                .filter((lvl) => lvl.name.toLowerCase().includes(levelSearch.toLowerCase()))
                .map((lvl, idx) => renderUnifiedLevelCard({
                  key: `preset-${lvl.id}`, name: lvl.name, desc: lvl.desc, source: 'preset', mode: 'challenge',
                  index: idx + 1, is_final: lvl.is_final, actionCount: lvl.pose_ids.length,
                  time_limit: lvl.time_limit, min_match: lvl.min_match, tag: lvl.tag,
                  canEdit: isAdmin, canDelete: isAdmin,
                  onEdit: () => openLevelEdit(lvl), onDelete: () => deleteLevel(lvl.id),
                }))}
              {levels.length === 0 && (
                <div className="col-span-full text-center py-10 text-white/50">暂无系统预设</div>
              )}
            </div>

            {/* 我的云端关卡区 */}
            {myCloudChallenge.length > 0 && (
              <>
                {renderSectionHeader('我的云端关卡', myCloudChallenge.filter((l) => l.name.toLowerCase().includes(levelSearch.toLowerCase())).length, <Cloud size={16} className="text-emerald-400" />, '')}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mx-auto mb-6">
                  {myCloudChallenge
                    .filter((lvl) => lvl.name.toLowerCase().includes(levelSearch.toLowerCase()))
                    .map((lvl) => renderUnifiedLevelCard({
                      key: `mycloud-${lvl.id}`, name: lvl.name, desc: lvl.desc, source: 'myCloud', mode: 'challenge',
                      is_final: lvl.is_final, actionCount: lvl.pose_ids.length,
                      time_limit: lvl.time_limit, min_match: lvl.min_match, tag: lvl.tag,
                      canEdit: true, canDelete: true,
                      onEdit: () => openMyCloudLevelEdit(lvl, 'challenge'), onDelete: () => deleteMyCloudLevel(lvl.id, 'challenge'),
                    }))}
                </div>
              </>
            )}

            {/* 我的本地关卡区 */}
            {myLocalChallenge.length > 0 && (
              <>
                {renderSectionHeader('我的本地关卡', myLocalChallenge.filter((l) => l.name.toLowerCase().includes(levelSearch.toLowerCase())).length, <HardDrive size={16} className="text-amber-400" />, '')}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mx-auto">
                  {myLocalChallenge
                    .filter((lvl) => lvl.name.toLowerCase().includes(levelSearch.toLowerCase()))
                    .map((lvl) => renderUnifiedLevelCard({
                      key: `mylocal-${lvl.id}`, name: lvl.name, desc: lvl.description, source: 'myLocal', mode: 'challenge',
                      actionCount: lvl.pose_ids?.length ?? 0, time_limit: 45,
                      canEdit: true, canDelete: true, canPublish: true,
                      onEdit: () => openMyLocalLevelEdit(lvl), onDelete: () => deleteMyLocalLevel(lvl.id),
                      onPublish: () => handlePublishLocalLevel(lvl),
                    }))}
                </div>
              </>
            )}
            {levels.length === 0 && myCloudChallenge.length === 0 && myLocalChallenge.length === 0 && (
              <div className="text-center py-20 text-white/50">暂无关卡</div>
            )}
          </>
        )}

        {activeTab === 'rhythmLevels' && (
          <>
            {/* 系统预设区 */}
            {renderSectionHeader('系统预设', rhythmLevels.filter((l) => l.name.toLowerCase().includes(rhythmLevelSearch.toLowerCase())).length, <Trophy size={16} className="text-amber-400" />, '')}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mx-auto mb-6">
              {rhythmLevels
                .filter((c) => c.name.toLowerCase().includes(rhythmLevelSearch.toLowerCase()))
                .map((c) => renderUnifiedLevelCard({
                  key: `preset-${c.id}`, name: c.name, desc: c.desc, source: 'preset', mode: 'rhythm',
                  iconEmoji: c.icon, tag: c.tag, is_all: c.is_all, actionCount: c.pose_ids.length,
                  canEdit: isAdmin, canDelete: isAdmin,
                  onEdit: () => openRhythmLevelEdit(c), onDelete: () => deleteRhythmLevel(c.id),
                }))}
              {rhythmLevels.length === 0 && (
                <div className="col-span-full text-center py-10 text-white/50">暂无系统预设</div>
              )}
            </div>

            {/* 我的云端关卡区 */}
            {myCloudRhythm.length > 0 && (
              <>
                {renderSectionHeader('我的云端关卡', myCloudRhythm.filter((l) => l.name.toLowerCase().includes(rhythmLevelSearch.toLowerCase())).length, <Cloud size={16} className="text-emerald-400" />, '')}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mx-auto mb-6">
                  {myCloudRhythm
                    .filter((c) => c.name.toLowerCase().includes(rhythmLevelSearch.toLowerCase()))
                    .map((c) => renderUnifiedLevelCard({
                      key: `mycloud-${c.id}`, name: c.name, desc: c.desc, source: 'myCloud', mode: 'rhythm',
                      iconEmoji: c.icon, tag: c.tag, is_all: c.is_all, actionCount: c.pose_ids.length,
                      canEdit: true, canDelete: true,
                      onEdit: () => openMyCloudLevelEdit(c, 'rhythm'), onDelete: () => deleteMyCloudLevel(c.id, 'rhythm'),
                    }))}
                </div>
              </>
            )}

            {/* 我的本地关卡区 */}
            {myLocalRhythm.length > 0 && (
              <>
                {renderSectionHeader('我的本地关卡', myLocalRhythm.filter((l) => l.name.toLowerCase().includes(rhythmLevelSearch.toLowerCase())).length, <HardDrive size={16} className="text-amber-400" />, '')}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mx-auto">
                  {myLocalRhythm
                    .filter((lvl) => lvl.name.toLowerCase().includes(rhythmLevelSearch.toLowerCase()))
                    .map((lvl) => renderUnifiedLevelCard({
                      key: `mylocal-${lvl.id}`, name: lvl.name, desc: lvl.description, source: 'myLocal', mode: 'rhythm',
                      iconEmoji: '🧘', actionCount: lvl.pose_ids?.length ?? 0,
                      canEdit: true, canDelete: true, canPublish: true,
                      onEdit: () => openMyLocalLevelEdit(lvl), onDelete: () => deleteMyLocalLevel(lvl.id),
                      onPublish: () => handlePublishLocalLevel(lvl),
                    }))}
                </div>
              </>
            )}
            {rhythmLevels.length === 0 && myCloudRhythm.length === 0 && myLocalRhythm.length === 0 && (
              <div className="text-center py-20 text-white/50">暂无课程</div>
            )}
          </>
        )}

        {/* ========== 跟练关卡 tab：公开浏览 + 我的云端 + 我的本地 ========== */}
        {activeTab === 'followLevels' && (
          <>
            <div className="mb-4 flex items-center justify-center gap-2 text-sm">
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">Beta</span>
              <span className="text-white/50 text-xs">公开跟练关卡仅浏览；我的关卡可改名/删除</span>
            </div>
            {followLevelsLoading ? (
              <div className="text-center py-20 text-white/50 flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                加载中...
              </div>
            ) : (
              <>
                {/* 公开跟练区 */}
                {renderSectionHeader('公开跟练关卡', followLevels.filter((c) => c.name.toLowerCase().includes(followLevelSearch.toLowerCase())).length, <Users size={16} className="text-purple-400" />, '')}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mx-auto mb-6">
                  {followLevels
                    .filter((c) => c.name.toLowerCase().includes(followLevelSearch.toLowerCase()))
                    .map((c) => renderUnifiedLevelCard({
                      key: `public-${c.id}`, name: c.name, desc: c.desc, source: 'preset', mode: 'follow',
                      frameCount: c.frame_count, fps: c.fps, duration: c.total_duration,
                      author: c.author, play_count: c.play_count, favorite_count: c.favorite_count,
                      canEdit: false, canDelete: false, onEdit: () => {}, onDelete: () => {},
                    }))}
                  {followLevels.length === 0 && (
                    <div className="col-span-full text-center py-10 text-white/50">暂无公开跟练关卡</div>
                  )}
                </div>

                {/* 我的云端跟练区 */}
                {myCloudFollow.length > 0 && (
                  <>
                    {renderSectionHeader('我的云端关卡', myCloudFollow.filter((l) => l.name.toLowerCase().includes(followLevelSearch.toLowerCase())).length, <Cloud size={16} className="text-emerald-400" />, '')}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mx-auto mb-6">
                      {myCloudFollow
                        .filter((c) => c.name.toLowerCase().includes(followLevelSearch.toLowerCase()))
                        .map((c) => renderUnifiedLevelCard({
                          key: `mycloud-${c.id}`, name: c.name, desc: c.desc, source: 'myCloud', mode: 'follow',
                          frameCount: c.frame_count, fps: c.fps, duration: c.total_duration,
                          author: c.author, play_count: c.play_count, favorite_count: c.favorite_count,
                          canEdit: true, canDelete: true,
                          onEdit: () => openMyCloudLevelEdit(c, 'follow'), onDelete: () => deleteMyCloudLevel(c.id, 'follow'),
                        }))}
                    </div>
                  </>
                )}

                {/* 我的本地跟练区 */}
                {myLocalFollow.length > 0 && (
                  <>
                    {renderSectionHeader('我的本地关卡', myLocalFollow.filter((l) => l.name.toLowerCase().includes(followLevelSearch.toLowerCase())).length, <HardDrive size={16} className="text-amber-400" />, '')}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mx-auto">
                      {myLocalFollow
                        .filter((lvl) => lvl.name.toLowerCase().includes(followLevelSearch.toLowerCase()))
                        .map((lvl) => renderUnifiedLevelCard({
                          key: `mylocal-${lvl.id}`, name: lvl.name, desc: lvl.description, source: 'myLocal', mode: 'follow',
                          frameCount: lvl.frame_count, fps: lvl.fps, duration: lvl.total_duration, author: '我',
                          canEdit: true, canDelete: true,
                          onEdit: () => openMyLocalLevelEdit(lvl), onDelete: () => deleteMyLocalLevel(lvl.id),
                        }))}
                    </div>
                  </>
                )}
                {followLevels.length === 0 && myCloudFollow.length === 0 && myLocalFollow.length === 0 && (
                  <div className="text-center py-20 text-white/50">暂无跟练关卡</div>
                )}
              </>
            )}
          </>
        )}

        </div>
      </main>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 glass border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {editingId ? '编辑动作' : '新增动作'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-xl hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/70 mb-1.5">动作名称</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                      placeholder="如：双手举高"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1.5">图标 (emoji)</label>
                    <input
                      value={form.icon}
                      onChange={(e) => setForm({ ...form, icon: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xl focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-white/70 mb-1.5">动作描述</label>
                  <input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                    placeholder="简单描述这个动作"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm text-white/70 mb-1.5">分类</label>
                    <input
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1.5">难度</label>
                    <select
                      value={form.difficulty}
                      onChange={(e) => setForm({ ...form, difficulty: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                    >
                      <option value={1} className="bg-slate-800">⭐ 简单</option>
                      <option value={2} className="bg-slate-800">⭐⭐ 中等</option>
                      <option value={3} className="bg-slate-800">⭐⭐⭐ 困难</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1.5">持续(秒)</label>
                    <input
                      type="number"
                      value={form.duration}
                      onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                  <details open>
                    <summary className="cursor-pointer font-semibold flex items-center gap-2">
                      <GripVertical size={18} className="text-white/40" />
                      姿态参数（8 个方向角）
                      <span className="text-xs text-white/40 font-normal">
                        统一弧度制，0=右 π/2=下 π=左 -π/2=上
                      </span>
                    </summary>
                    <div className="space-y-4 mt-3">
                      {([
                        { left: 'left_shoulder', right: 'right_shoulder', label: '肩部（上臂）' },
                        { left: 'left_elbow', right: 'right_elbow', label: '肘部（前臂）' },
                        { left: 'left_hip', right: 'right_hip', label: '髋部（大腿）' },
                        { left: 'left_knee', right: 'right_knee', label: '膝部（小腿）' },
                      ] as const).map(({ left, right, label }) => {
                        const leftVal = form.params[left]
                        const rightVal = form.params[right]
                        const expectedRight = Math.PI - leftVal
                        const diff = Math.abs(((rightVal - expectedRight) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI)
                        const isSymmetric = diff < 0.05
                        const leftDeg = Math.round(leftVal * 180 / Math.PI)
                        const rightDeg = Math.round(rightVal * 180 / Math.PI)

                        function mirrorToRight() {
                          updateParam(right, Math.PI - form.params[left])
                        }
                        function mirrorToLeft() {
                          updateParam(left, Math.PI - form.params[right])
                        }

                        const dirText = (rad: number) => {
                          const normalized = ((rad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
                          if (normalized < Math.PI / 8 || normalized > Math.PI * 15 / 8) return '→ 右'
                          if (normalized < Math.PI * 3 / 8) return '↘ 右下'
                          if (normalized < Math.PI * 5 / 8) return '↓ 下'
                          if (normalized < Math.PI * 7 / 8) return '↙ 左下'
                          if (normalized < Math.PI * 9 / 8) return '← 左'
                          if (normalized < Math.PI * 11 / 8) return '↖ 左上'
                          if (normalized < Math.PI * 13 / 8) return '↑ 上'
                          return '↗ 右上'
                        }
                        const dirColor = (rad: number) => {
                          const normalized = ((rad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
                          if (normalized < Math.PI / 8 || normalized > Math.PI * 15 / 8) return 'text-sky-400'
                          if (normalized < Math.PI * 3 / 8) return 'text-sky-400'
                          if (normalized < Math.PI * 5 / 8) return 'text-emerald-400'
                          if (normalized < Math.PI * 7 / 8) return 'text-amber-400'
                          if (normalized < Math.PI * 9 / 8) return 'text-amber-400'
                          if (normalized < Math.PI * 11 / 8) return 'text-rose-400'
                          if (normalized < Math.PI * 13 / 8) return 'text-emerald-400'
                          return 'text-sky-400'
                        }

                        return (
                          <div key={label} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-white/80">{label}</span>
                              <div className="flex items-center gap-2">
                                {!isSymmetric && (
                                  <button
                                    onClick={mirrorToRight}
                                    className="text-xs px-2 py-0.5 bg-sky-500/20 text-sky-400 rounded-full hover:bg-sky-500/30 transition-colors"
                                    title="将左侧镜像到右侧"
                                  >
                                    左 → 右
                                  </button>
                                )}
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  isSymmetric
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-amber-500/20 text-amber-400'
                                }`}>
                                  {isSymmetric ? '✓ 左右对称' : '⚠ 不对称'}
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-6">
                              {([
                                { key: left, sideLabel: '左' },
                                { key: right, sideLabel: '右' },
                              ] as const).map(({ key, sideLabel }) => {
                                const val = form.params[key]
                                const deg = Math.round(val * 180 / Math.PI)
                                return (
                                  <div key={key}>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs text-white/50">{sideLabel}</span>
                                      <div className="flex items-center gap-2">
                                        <span className={`text-xs ${dirColor(val)} font-medium`}>
                                          {dirText(val)}
                                        </span>
                                        <span className="text-xs text-white/50 font-mono">
                                          {val.toFixed(2)}·{deg}°
                                        </span>
                                      </div>
                                    </div>
                                    <input
                                      type="range"
                                      min={-Math.PI}
                                      max={Math.PI}
                                      step={0.05}
                                      value={val}
                                      onChange={(e) => updateParam(key, Number(e.target.value))}
                                      className="w-full accent-emerald-500"
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </details>
                </div>

                {/* 坐标点显示 */}
                <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                  <details>
                    <summary className="cursor-pointer font-semibold flex items-center gap-2">
                      <GripVertical size={18} className="text-white/40" />
                      坐标点（归一化）
                      <span className="text-xs text-white/40 font-normal">
                        双肩中心=原点，肩宽=1
                      </span>
                    </summary>
                    <div className="space-y-1 mt-3 max-h-60 overflow-y-auto pr-2">
                      {(() => {
                        const normLms = normalizeLandmarks(form.landmarks)
                        return normLms.map((lm, idx) => {
                          const label = KP_LABEL[lm.name] || lm.name
                          const isMain = MAIN_JOINTS.has(lm.name)
                          const isShoulder = lm.name === 'LEFT_SHOULDER' || lm.name === 'RIGHT_SHOULDER'
                          return (
                            <div
                              key={idx}
                              className={`flex items-center gap-2 text-xs py-1 px-2 rounded ${isShoulder ? 'bg-amber-500/10' : isMain ? 'bg-emerald-500/10' : ''}`}
                            >
                              <span className={`w-16 shrink-0 ${isShoulder ? 'text-amber-300' : isMain ? 'text-emerald-300' : 'text-white/50'}`}>
                                {label}
                              </span>
                              <div className="flex items-center gap-1 flex-1">
                                <span className="text-white/30">x</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={lm.x.toFixed(3)}
                                  onChange={(e) => updateLandmark(idx, 'x', Number(e.target.value))}
                                  className="w-16 px-1.5 py-0.5 bg-white/10 rounded text-center font-mono text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                />
                                <span className="text-white/30 ml-1">y</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={lm.y.toFixed(3)}
                                  onChange={(e) => updateLandmark(idx, 'y', Number(e.target.value))}
                                  className="w-16 px-1.5 py-0.5 bg-white/10 rounded text-center font-mono text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                />
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  </details>
                </div>

                {/* 评分规则 */}
                <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                  <details open>
                    <summary className="cursor-pointer font-semibold flex items-center gap-2">
                      <GripVertical size={18} className="text-white/40" />
                      评分规则
                      <span className="text-xs text-white/40 font-normal">
                        支持向量相似度、三点夹角
                      </span>
                    </summary>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-sm text-white/50">已配置 {form.scoringRules.length} 条规则</span>
                      <button
                        onClick={addRule}
                        className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      >
                        <Plus size={14} /> 添加规则
                      </button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 mt-2">
                      {form.scoringRules.map((rule: ScoringRule, idx: number) => (
                        <div key={idx} className="p-3 bg-slate-900/50 rounded-xl border border-white/10">
                          <div className="flex items-center gap-2 mb-2">
                            <select
                              value={rule.type}
                              onChange={(e) => adjustRulePoints(idx, e.target.value as ScoringRuleType)}
                              className="px-3 py-1.5 bg-white/10 rounded-lg text-sm text-white focus:outline-none"
                            >
                              <option value="angle_dir" className="bg-slate-800">向量相似度(2点)</option>
                              <option value="angle_3pt" className="bg-slate-800">三点夹角(3点)</option>
                            </select>
                            <button
                              onClick={() => recalcRuleTarget(idx)}
                              className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm transition-colors"
                              title="从当前姿态计算目标值"
                            >
                              取当前姿态
                            </button>
                            <div className="flex-1" />
                            <button
                              onClick={() => removeRule(idx)}
                              className="p-1.5 text-white/40 hover:text-red-400"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {rule.points.map((pname, pidx) => (
                              <select
                                key={pidx}
                                value={pname}
                                onChange={(e) => updateRulePoint(idx, pidx, e.target.value)}
                                className="px-2 py-1 bg-white/10 rounded-lg text-xs text-white focus:outline-none"
                              >
                                {ALL_KEYPOINTS.map((o) => (
                                  <option key={o.name} value={o.name} className="bg-slate-800">{o.label}</option>
                                ))}
                              </select>
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm">
                            {rule.type === 'angle_dir' ? (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-white/50">V<sub>x</sub></span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={typeof rule.targetValue === 'object' && rule.targetValue ? rule.targetValue.x.toFixed(3) : '1.000'}
                                    onChange={(e) => {
                                      const cur = typeof rule.targetValue === 'object' && rule.targetValue ? rule.targetValue : { x: 1, y: 0 }
                                      updateRule(idx, 'targetValue', { ...cur, x: Number(e.target.value) })
                                    }}
                                    className="w-16 px-2 py-1 bg-white/10 rounded-lg text-center font-mono text-white focus:outline-none"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-white/50">V<sub>y</sub></span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={typeof rule.targetValue === 'object' && rule.targetValue ? rule.targetValue.y.toFixed(3) : '0.000'}
                                    onChange={(e) => {
                                      const cur = typeof rule.targetValue === 'object' && rule.targetValue ? rule.targetValue : { x: 1, y: 0 }
                                      updateRule(idx, 'targetValue', { ...cur, y: Number(e.target.value) })
                                    }}
                                    className="w-16 px-2 py-1 bg-white/10 rounded-lg text-center font-mono text-white focus:outline-none"
                                  />
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-white/50">目标值</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={typeof rule.targetValue === 'number' ? rule.targetValue : 0}
                                  onChange={(e) => updateRule(idx, 'targetValue', Number(e.target.value))}
                                  className="w-20 px-2 py-1 bg-white/10 rounded-lg text-center text-white focus:outline-none"
                                />
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <span className="text-white/50">±容差</span>
                              <input
                                type="number"
                                step="0.01"
                                value={rule.tolerance}
                                onChange={(e) => updateRule(idx, 'tolerance', Number(e.target.value))}
                                className="w-16 px-2 py-1 bg-white/10 rounded-lg text-center text-white focus:outline-none"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-white/50">权重</span>
                              <input
                                type="number"
                                step="0.5"
                                min="0.5"
                                value={rule.weight}
                                onChange={(e) => updateRule(idx, 'weight', Number(e.target.value))}
                                className="w-14 px-2 py-1 bg-white/10 rounded-lg text-center text-white focus:outline-none"
                              />
                            </div>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={rule.required}
                                onChange={(e) => updateRule(idx, 'required', e.target.checked)}
                                className="accent-emerald-500"
                              />
                              <span className="text-white/70">必须</span>
                            </label>
                            <div className="flex items-center gap-1">
                              <span className="text-white/50 text-xs">适用：</span>
                              <div className="flex gap-0.5">
                                {(Object.keys(SCORING_MODES) as ScoringMode[]).map((mode) => {
                                  const checked = rule.modes
                                    ? rule.modes.includes(mode)
                                    : ruleUsesEnabledPoints(rule, getEnabledPoints(mode))
                                  return (
                                    <button
                                      key={mode}
                                      onClick={() => toggleRuleMode(idx, mode)}
                                      className={`px-1.5 py-0.5 text-[10px] rounded transition-all ${
                                        checked
                                          ? 'bg-sky-500/30 text-sky-400'
                                          : 'bg-white/5 text-white/30 hover:bg-white/10'
                                      }`}
                                      title={SCORING_MODES[mode].label}
                                    >
                                      {SCORING_MODES[mode].icon}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-white/70">实时预览</label>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={extractingFromImage}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Upload size={14} />
                        {extractingFromImage ? '提取中...' : '上传照片'}
                      </button>
                      <button
                        onClick={() => setShowPreviewTest(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 rounded-lg transition-colors"
                      >
                        <Video size={14} />
                        摄像头测试
                      </button>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <div className="bg-white/5 rounded-2xl p-6 flex items-center justify-center min-h-[300px]">
                    <PoseFigure template={previewTemplate} size={260} scoringMode="full" />
                  </div>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 space-y-2 text-sm">
                  <h4 className="font-semibold text-white/80">评分规则说明</h4>
                  <ul className="space-y-1.5 text-white/50 text-xs">
                    <li>• <span className="text-emerald-400">向量相似度</span>：两点连线的方向向量夹角（适合判断手臂、腿的伸展方向）</li>
                    <li>• <span className="text-emerald-400">三点夹角</span>：以中间点为顶点的夹角（适合判断肘、膝弯曲程度）</li>
                    <li>• 点击「取当前姿态」可快速将预览姿态的计算值填入目标值</li>
                    <li>• 角度单位为弧度：0=向右，π/2=向下，π=向左，-π/2=向上</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 glass border-t border-white/10 px-6 py-4 flex items-center justify-between">
              <button
                onClick={resetParams}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all flex items-center gap-2 font-medium"
              >
                <RotateCcw size={18} />
                重置为站立姿态
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 rounded-xl hover:bg-white/10 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all flex items-center gap-2 font-medium"
                >
                  <Save size={18} />
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPreviewTest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 glass border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Video size={22} className="text-sky-400" />
                摄像头预览测试
                <span className="text-sm font-normal text-white/50 ml-2">{previewTemplate.icon} {previewTemplate.name}</span>
              </h2>
              <button
                onClick={() => setShowPreviewTest(false)}
                className="p-2 rounded-xl hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/70">评分范围：</span>
                    <div className="flex gap-1">
                      {(Object.keys(SCORING_MODES) as ScoringMode[]).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setPreviewScoringMode(mode)}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                            previewScoringMode === mode
                              ? 'bg-sky-500/30 text-sky-400 border border-sky-500/50'
                              : 'bg-white/5 text-white/60 hover:bg-white/10 border border-transparent'
                          }`}
                        >
                          {SCORING_MODES[mode].icon} {SCORING_MODES[mode].label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-xs text-white/50 text-center">实时画面</div>
                    <div className="relative bg-black rounded-2xl overflow-hidden">
                      <Camera
                        enabled={showPreviewTest}
                        width={320}
                        height={240}
                        mirrored={true}
                        displayMode="overlay"
                        template={previewTemplate}
                        scoringMode={previewScoringMode}
                        onPoseResult={handlePoseResult}
                        className="w-full aspect-[4/3]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs text-white/50 text-center">目标姿态</div>
                    <div className="bg-white/5 rounded-2xl flex items-center justify-center aspect-[4/3]">
                      <PoseFigure template={previewTemplate} size={200} scoringMode={previewScoringMode} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="bg-white/5 rounded-2xl p-5 text-center">
                  <div className="text-sm text-white/50 mb-1">实时匹配分数</div>
                  <div className={`text-5xl font-bold mb-2 ${
                    previewScore >= 80 ? 'text-emerald-400' :
                    previewScore >= 60 ? 'text-amber-400' :
                    'text-rose-400'
                  }`}>
                    {previewHasPerson ? previewScore : '--'}
                  </div>
                  <div className="text-xs text-white/40">
                    {previewHasPerson ? (previewScore >= 80 ? '优秀匹配' : previewScore >= 60 ? '基本匹配' : '差距较大') : '未检测到人体'}
                  </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                  <h4 className="font-semibold text-white/80 text-sm flex items-center gap-2">
                    <Shield size={16} className="text-sky-400" />
                    规则详情 ({previewRuleScores.length}条)
                  </h4>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {previewRuleScores.length === 0 && (
                      <div className="text-xs text-white/40 text-center py-4">
                        {previewHasPerson ? '当前评分范围无可用规则' : '等待检测...'}
                      </div>
                    )}
                    {previewRuleScores.map(({ rule, score }, idx) => {
                      const isGood = score !== null && score >= 70
                      const isMid = score !== null && score >= 40 && score < 70
                      return (
                        <div key={idx} className="bg-white/5 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-white/80">
                              {RULE_TYPE_LABELS[rule.type]}
                            </span>
                            <span className={`text-sm font-bold ${
                              score === null ? 'text-white/30' :
                              isGood ? 'text-emerald-400' :
                              isMid ? 'text-amber-400' :
                              'text-rose-400'
                            }`}>
                              {score !== null ? Math.round(score) : '--'}
                            </span>
                          </div>
                          <div className="text-xs text-white/40 mb-2">
                            {rule.points.map((p) => KP_LABEL[p] || p).join(' → ')}
                          </div>
                          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-200 ${
                                isGood ? 'bg-emerald-500' :
                                isMid ? 'bg-amber-500' :
                                'bg-rose-500'
                              }`}
                              style={{ width: `${score !== null ? Math.max(0, score) : 0}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 space-y-2 text-xs">
                  <h4 className="font-semibold text-white/80 text-sm">提示</h4>
                  <ul className="space-y-1 text-white/50">
                    <li>• 调整动作参数后，实时评分会同步更新</li>
                    <li>• 绿色=优秀(≥70)，黄色=一般(40-70)，红色=较差</li>
                    <li>• 可切换评分范围测试不同模式下的效果</li>
                    <li>• 镜像显示，左右与实际相反</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showVideoGenModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 glass border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Video size={22} className="text-violet-400" />
                从视频生成{videoGenType === 'level' ? '关卡' : videoGenType === 'stage' ? '课程' : '动作'}
              </h2>
              <button
                onClick={() => setShowVideoGenModal(false)}
                className="p-2 rounded-xl hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {!videoFile ? (
                <div
                  onClick={() => videoFileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/20 rounded-2xl p-12 text-center cursor-pointer hover:border-violet-500/50 hover:bg-violet-500/5 transition-all"
                >
                  <Upload size={48} className="mx-auto mb-4 text-white/40" />
                  <div className="text-lg font-medium mb-2">点击上传视频</div>
                  <div className="text-sm text-white/50">支持 MP4、WebM、MOV 等常见视频格式</div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-white/70 mb-2 block">视频信息</label>
                        <div className="bg-white/5 rounded-xl p-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-white/50">文件名</span>
                            <span className="text-white/80 truncate ml-4">{videoFile.name}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-white/50">大小</span>
                            <span className="text-white/80">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</span>
                          </div>
                          {videoElement && (
                            <div className="flex justify-between text-sm">
                              <span className="text-white/50">时长</span>
                              <span className="text-white/80">{formatTime(videoElement.duration)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm text-white/70 mb-2 block">
                          抽帧间隔：每 <span className="text-violet-400 font-medium">{extractInterval}</span> 秒
                          <span className="text-white/40 ml-2">
                            （约 {videoElement ? Math.floor(videoElement.duration / extractInterval) : '--'} 帧）
                          </span>
                        </label>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          step={0.5}
                          value={extractInterval}
                          onChange={(e) => setExtractInterval(Number(e.target.value))}
                          disabled={extracting}
                          className="w-full accent-violet-500"
                        />
                        <div className="flex justify-between text-xs text-white/40 mt-1">
                          <span>1秒（更密）</span>
                          <span>10秒（更疏）</span>
                        </div>
                      </div>

                      {!extracting && extractedPoses.length === 0 && (
                        <button
                          onClick={startExtract}
                          className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-500 rounded-xl hover:from-violet-600 hover:to-purple-600 transition-all font-medium flex items-center justify-center gap-2"
                        >
                          <Play size={18} />
                          开始提取姿态
                        </button>
                      )}

                      {extracting && (
                        <div className="bg-white/5 rounded-xl p-4 space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-white/70">正在提取...</span>
                            <span className="text-violet-400">{extractProgress.current} / {extractProgress.total}</span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all"
                              style={{ width: `${extractProgress.total > 0 ? (extractProgress.current / extractProgress.total * 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {extractedPoses.length > 0 && (
                        <div className="bg-white/5 rounded-xl p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-white/70">提取结果</span>
                            <span className="text-sm text-emerald-400">{extractedPoses.length} 个有效动作</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-white/70 mb-2 block">生成类型</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setVideoGenType('pose')}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                              videoGenType === 'pose'
                                ? 'bg-violet-500/30 text-violet-400 border border-violet-500/50'
                                : 'bg-white/5 text-white/50 hover:bg-white/10 border border-transparent'
                            }`}
                          >
                            🧘 仅动作
                          </button>
                          <button
                            onClick={() => setVideoGenType('level')}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                              videoGenType === 'level'
                                ? 'bg-violet-500/30 text-violet-400 border border-violet-500/50'
                                : 'bg-white/5 text-white/50 hover:bg-white/10 border border-transparent'
                            }`}
                          >
                            🏆 关卡
                          </button>
                          <button
                            onClick={() => setVideoGenType('stage')}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                              videoGenType === 'stage'
                                ? 'bg-violet-500/30 text-violet-400 border border-violet-500/50'
                                : 'bg-white/5 text-white/50 hover:bg-white/10 border border-transparent'
                            }`}
                          >
                            🎓 课程
                          </button>
                        </div>
                      </div>
                      {videoGenType !== 'pose' && (
                        <>
                          <div>
                            <label className="text-sm text-white/70 mb-2 block">{videoGenType === 'level' ? '关卡' : '课程'}名称</label>
                            <input
                              type="text"
                              value={levelName}
                              onChange={(e) => setLevelName(e.target.value)}
                              placeholder={`输入${videoGenType === 'level' ? '关卡' : '课程'}名称`}
                              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-white/70 mb-2 block">{videoGenType === 'level' ? '关卡' : '课程'}描述（可选）</label>
                            <textarea
                              value={levelDesc}
                              onChange={(e) => setLevelDesc(e.target.value)}
                              placeholder="输入描述"
                              rows={2}
                              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {extractedPoses.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-white/70">动作列表（可编辑名称、调整顺序、删除）</label>
                        <span className="text-xs text-white/40">共 {extractedPoses.length} 个动作</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2">
                        {extractedPoses.map((pose, idx) => (
                          <div
                            key={idx}
                            className="bg-white/5 rounded-xl p-3 space-y-2"
                          >
                            <div className="flex items-start justify-between">
                              <span className="text-xs text-white/40">#{idx + 1} · {formatTime(pose.timestamp)}</span>
                              <button
                                onClick={() => removeExtractedPose(idx)}
                                className="p-1 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400"
                                title="删除"
                              >
                                <X size={20} />
                              </button>
                            </div>
                            <div className="flex justify-center py-2 bg-white/5 rounded-lg">
                              <PoseFigure
                              template={{
                                id: idx,
                                name: pose.name,
                                icon: pose.icon,
                                description: '',
                                category: '',
                                difficulty: 1,
                                duration: 0,
                                landmarks: pose.landmarks.map((lm, i) => ({
                                  name: ALL_KEYPOINTS[i]?.name || lm.name || '',
                                  x: lm.x,
                                  y: lm.y,
                                  z: lm.z || 0,
                                })),
                                scoring_rules: [],
                              }}
                              size={80}
                              scoringMode="minimal"
                            />
                            </div>
                            <input
                              type="text"
                              value={pose.name}
                              onChange={(e) => updateExtractedPoseName(idx, e.target.value)}
                              className="w-full px-2 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                            />
                            <div className="flex gap-1">
                              <button
                                onClick={() => moveExtractedPose(idx, -1)}
                                disabled={idx === 0}
                                className="flex-1 py-1 text-xs bg-white/5 hover:bg-white/10 rounded-lg text-white/60 disabled:opacity-30"
                              >
                                ↑ 上移
                              </button>
                              <button
                                onClick={() => moveExtractedPose(idx, 1)}
                                disabled={idx === extractedPoses.length - 1}
                                className="flex-1 py-1 text-xs bg-white/5 hover:bg-white/10 rounded-lg text-white/60 disabled:opacity-30"
                              >
                                下移 ↓
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {extractedPoses.length > 0 && (
                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                      <button
                        onClick={() => setShowVideoGenModal(false)}
                        className="px-6 py-3 rounded-xl hover:bg-white/10 transition-all"
                      >
                        取消
                      </button>
                      <button
                        onClick={generateLevelFromVideo}
                        className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all font-medium flex items-center gap-2"
                      >
                        <Save size={18} />
                        生成 {extractedPoses.length} 个动作{videoGenType !== 'pose' ? ' + ' + (videoGenType === 'level' ? '关卡' : '课程') : ''}
                      </button>
                    </div>
                  )}
                </>
              )}

              <input
                ref={videoFileInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>
      )}

      {showLevelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 glass border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {editingLevelId ? '编辑关卡' : '新增关卡'}
              </h2>
              <button
                onClick={() => setShowLevelModal(false)}
                className="p-2 rounded-xl hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 左侧：编辑 + 动作选择 */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/70 mb-1.5">关卡名称</label>
                    <input
                      value={levelForm.name}
                      onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                      placeholder="如：第一关·初学乍练"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1.5">关卡序号</label>
                    <input
                      type="number"
                      value={levelForm.id}
                      onChange={(e) => setLevelForm({ ...levelForm, id: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1.5">关卡描述</label>
                  <input
                    value={levelForm.desc}
                    onChange={(e) => setLevelForm({ ...levelForm, desc: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                    placeholder="简单描述这个关卡"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-white/70 mb-1.5">时间(秒)</label>
                    <input
                      type="number"
                      value={levelForm.time_limit}
                      onChange={(e) => setLevelForm({ ...levelForm, time_limit: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1.5">最低匹配(%)</label>
                    <input
                      type="number"
                      value={levelForm.min_match}
                      onChange={(e) => setLevelForm({ ...levelForm, min_match: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm text-white/70 mb-1.5">分类标签</label>
                  <input
                    type="text"
                    value={levelForm.tag}
                    onChange={(e) => setLevelForm({ ...levelForm, tag: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                    placeholder="如：新手上路、破釜沉舟、肩颈..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="level-is-final"
                    checked={levelForm.is_final}
                    onChange={(e) => setLevelForm({ ...levelForm, is_final: e.target.checked })}
                    className="accent-emerald-500"
                  />
                  <label htmlFor="level-is-final" className="text-sm text-white/70">
                    最终关（包含全部动作）
                  </label>
                </div>
                {!levelForm.is_final && (
                  <div className="space-y-3">
                    {/* 已选动作有序列表 */}
                    {levelForm.pose_ids.length > 0 && (
                      <div className="space-y-1">
                        <label className="text-xs text-white/50">已选动作（{levelForm.pose_ids.length}个，按顺序）</label>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {levelForm.pose_ids.map((pid, idx) => {
                            const t = templates.find((tp) => tp.id === pid)
                            if (!t) return null
                            return (
                              <div key={idx} className="flex items-center gap-2 px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                                <span className="text-xs text-white/40 w-4 shrink-0">{idx + 1}</span>
                                <span className="text-sm flex-1 truncate">{t.icon} {t.name}</span>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    onClick={() => setLevelPreviewIdx(idx)}
                                    className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-emerald-400"
                                    title="预览此动作"
                                  >
                                    <ZoomIn size={14} />
                                  </button>
                                  <button
                                    onClick={() => moveLevelPose(idx, -1)}
                                    disabled={idx === 0}
                                    className="p-1 rounded hover:bg-white/10 text-white/50 disabled:opacity-20"
                                  >
                                    <ArrowUp size={14} />
                                  </button>
                                  <button
                                    onClick={() => moveLevelPose(idx, 1)}
                                    disabled={idx === levelForm.pose_ids.length - 1}
                                    className="p-1 rounded hover:bg-white/10 text-white/50 disabled:opacity-20"
                                  >
                                    <ArrowDown size={14} />
                                  </button>
                                  <button
                                    onClick={() => removeLevelPose(idx)}
                                    className="p-1 rounded hover:bg-red-500/20 text-white/50 hover:text-red-400"
                                  >
                                    <X size={20} />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* 搜索下拉选择器 */}
                    <div ref={levelSelectorRef} className="relative">
                      <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                        <input
                          value={levelSearch}
                          onChange={(e) => setLevelSearch(e.target.value)}
                          onFocus={() => setLevelSelectorOpen(true)}
                          className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                          placeholder="搜索并选择动作..."
                        />
                      </div>
                      {levelSelectorOpen && (
                        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-gray-800/95 backdrop-blur border border-white/20 rounded-xl shadow-xl">
                          {templates
                            .filter((t) =>
                              !levelSearch ||
                              t.name.toLowerCase().includes(levelSearch.toLowerCase()) ||
                              t.category.toLowerCase().includes(levelSearch.toLowerCase())
                            )
                            .map((t) => {
                              const count = levelForm.pose_ids.filter((id) => id === t.id).length
                              return (
                                <button
                                  key={t.id}
                                  onClick={() => addLevelPose(t.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-white/10 text-white/70"
                                >
                                  <Plus size={14} className="text-emerald-400 shrink-0" />
                                  <span>{t.icon}</span>
                                  <span className="truncate flex-1">{t.name}</span>
                                  {count > 0 && (
                                    <span className="text-xs text-emerald-400 shrink-0">×{count}</span>
                                  )}
                                  <span className="text-white/30 shrink-0">{t.category}</span>
                                </button>
                              )
                            })}
                          {templates.filter((t) =>
                            !levelSearch ||
                            t.name.toLowerCase().includes(levelSearch.toLowerCase()) ||
                            t.category.toLowerCase().includes(levelSearch.toLowerCase())
                          ).length === 0 && (
                            <div className="px-3 py-4 text-center text-white/40 text-sm">无匹配动作</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 右侧：已选动作大图预览 */}
              <div className="space-y-3">
                {(() => {
                  const previewPoses = levelForm.is_final
                    ? templates
                    : levelForm.pose_ids.map((pid) => templates.find((t) => t.id === pid)!).filter(Boolean)
                  const idx = Math.min(levelPreviewIdx, previewPoses.length - 1)
                  const current = previewPoses[idx]
                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-white/70">
                          {levelForm.is_final ? '全部动作预览' : `已选动作预览（${previewPoses.length}个）`}
                        </label>
                        {previewPoses.length > 0 && (
                          <span className="text-xs text-white/50">{idx + 1} / {previewPoses.length}</span>
                        )}
                      </div>
                      {current ? (
                        <div className="flex flex-col items-center gap-3 p-4 bg-white/5 rounded-xl">
                          <div className="flex items-center gap-3 w-full">
                            <button
                              onClick={() => setLevelPreviewIdx((idx - 1 + previewPoses.length) % previewPoses.length)}
                              className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white shrink-0"
                            >
                              <ChevronLeft size={24} />
                            </button>
                            <div className="flex-1 flex flex-col items-center gap-2">
                              <PoseFigure template={current} size={200} scoringMode="minimal" />
                              <span className="text-sm text-white/80">{current.icon} {current.name}</span>
                              <div className="flex gap-2 mt-1">
                                <button
                                  onClick={() => quickEditPose(current)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white/80"
                                >
                                  <Edit2 size={12} />
                                  编辑此动作
                                </button>
                                <button
                                  onClick={quickCreatePose}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg transition-colors text-emerald-400"
                                >
                                  <Plus size={12} />
                                  新增动作
                                </button>
                              </div>
                            </div>
                            <button
                              onClick={() => setLevelPreviewIdx((idx + 1) % previewPoses.length)}
                              className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white shrink-0"
                            >
                              <ChevronRight size={24} />
                            </button>
                          </div>
                          {/* 缩略图条 */}
                          {previewPoses.length > 1 && (
                            <div className="flex gap-1.5 overflow-x-auto w-full justify-center pt-2">
                              {previewPoses.map((t, i) => (
                                <button
                                  key={i}
                                  onClick={() => setLevelPreviewIdx(i)}
                                  className={`shrink-0 w-2.5 h-2.5 rounded-full transition-all ${
                                    i === idx ? 'bg-emerald-400 w-6' : 'bg-white/20 hover:bg-white/40'
                                  }`}
                                  title={t.name}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-48 text-white/40 text-sm">
                          未选择动作
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
            <div className="sticky bottom-0 glass border-t border-white/10 px-6 py-4 flex items-center justify-between">
              <div />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLevelModal(false)}
                  className="px-6 py-3 rounded-xl hover:bg-white/10 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={saveLevel}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all flex items-center gap-2 font-medium"
                >
                  <Save size={18} />
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRhythmLevelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 glass border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {editingRhythmLevelId ? '编辑关卡' : '新增关卡'}
              </h2>
              <button
                onClick={() => setShowRhythmLevelModal(false)}
                className="p-2 rounded-xl hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 左侧：编辑 + 动作选择 */}
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-white/70 mb-1.5">课程ID</label>
                    <input
                      value={rhythmLevelForm.id}
                      onChange={(e) => setRhythmLevelForm({ ...rhythmLevelForm, id: e.target.value })}
                      disabled={!!editingRhythmLevelId}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-cyan-500/50 focus:outline-none disabled:opacity-50"
                      placeholder="如：yoga-basic"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1.5">图标 (emoji)</label>
                    <input
                      value={rhythmLevelForm.icon}
                      onChange={(e) => setRhythmLevelForm({ ...rhythmLevelForm, icon: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-xl focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-1.5">标签分类</label>
                    <input
                      value={rhythmLevelForm.tag}
                      onChange={(e) => setRhythmLevelForm({ ...rhythmLevelForm, tag: e.target.value })}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                      placeholder="如：八段锦"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1.5">课程名称</label>
                  <input
                    value={rhythmLevelForm.name}
                    onChange={(e) => setRhythmLevelForm({ ...rhythmLevelForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                    placeholder="如：八段锦·全套"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1.5">课程描述</label>
                  <input
                    value={rhythmLevelForm.desc}
                    onChange={(e) => setRhythmLevelForm({ ...rhythmLevelForm, desc: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                    placeholder="简单描述这个课程"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="rhythm-level-is-all"
                    checked={rhythmLevelForm.is_all}
                    onChange={(e) => setRhythmLevelForm({ ...rhythmLevelForm, is_all: e.target.checked })}
                    className="accent-emerald-500"
                  />
                  <label htmlFor="rhythm-level-is-all" className="text-sm text-white/70">
                    包含全部动作
                  </label>
                </div>
                {!rhythmLevelForm.is_all && (
                  <div className="space-y-3">
                    {/* 已选动作有序列表 */}
                    {rhythmLevelForm.pose_ids.length > 0 && (
                      <div className="space-y-1">
                        <label className="text-xs text-white/50">已选动作（{rhythmLevelForm.pose_ids.length}个，按顺序）</label>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {rhythmLevelForm.pose_ids.map((pid, idx) => {
                            const t = templates.find((tp) => tp.id === pid)
                            if (!t) return null
                            return (
                              <div key={idx} className="flex items-center gap-2 px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                                <span className="text-xs text-white/40 w-4 shrink-0">{idx + 1}</span>
                                <span className="text-sm flex-1 truncate">{t.icon} {t.name}</span>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    onClick={() => setRhythmLevelPreviewIdx(idx)}
                                    className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-emerald-400"
                                    title="预览此动作"
                                  >
                                    <ZoomIn size={14} />
                                  </button>
                                  <button
                                    onClick={() => moveRhythmLevelPose(idx, -1)}
                                    disabled={idx === 0}
                                    className="p-1 rounded hover:bg-white/10 text-white/50 disabled:opacity-20"
                                  >
                                    <ArrowUp size={14} />
                                  </button>
                                  <button
                                    onClick={() => moveRhythmLevelPose(idx, 1)}
                                    disabled={idx === rhythmLevelForm.pose_ids.length - 1}
                                    className="p-1 rounded hover:bg-white/10 text-white/50 disabled:opacity-20"
                                  >
                                    <ArrowDown size={14} />
                                  </button>
                                  <button
                                    onClick={() => removeRhythmLevelPose(idx)}
                                    className="p-1 rounded hover:bg-red-500/20 text-white/50 hover:text-red-400"
                                  >
                                    <X size={20} />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* 搜索下拉选择器 */}
                    <div ref={rhythmLevelSelectorRef} className="relative">
                      <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                        <input
                          value={rhythmLevelSearch}
                          onChange={(e) => setRhythmLevelSearch(e.target.value)}
                          onFocus={() => setRhythmLevelSelectorOpen(true)}
                          className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                          placeholder="搜索并选择动作..."
                        />
                      </div>
                      {rhythmLevelSelectorOpen && (
                        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-gray-800/95 backdrop-blur border border-white/20 rounded-xl shadow-xl">
                          {templates
                            .filter((t) =>
                              !rhythmLevelSearch ||
                              t.name.toLowerCase().includes(rhythmLevelSearch.toLowerCase()) ||
                              t.category.toLowerCase().includes(rhythmLevelSearch.toLowerCase())
                            )
                            .map((t) => {
                              const count = rhythmLevelForm.pose_ids.filter((id) => id === t.id).length
                              return (
                                <button
                                  key={t.id}
                                  onClick={() => addRhythmLevelPose(t.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-white/10 text-white/70"
                                >
                                  <Plus size={14} className="text-emerald-400 shrink-0" />
                                  <span>{t.icon}</span>
                                  <span className="truncate flex-1">{t.name}</span>
                                  {count > 0 && (
                                    <span className="text-xs text-emerald-400 shrink-0">×{count}</span>
                                  )}
                                  <span className="text-white/30 shrink-0">{t.category}</span>
                                </button>
                              )
                            })}
                          {templates.filter((t) =>
                            !rhythmLevelSearch ||
                            t.name.toLowerCase().includes(rhythmLevelSearch.toLowerCase()) ||
                            t.category.toLowerCase().includes(rhythmLevelSearch.toLowerCase())
                          ).length === 0 && (
                            <div className="px-3 py-4 text-center text-white/40 text-sm">无匹配动作</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 右侧：已选动作大图预览 */}
              <div className="space-y-3">
                {(() => {
                  const previewPoses = rhythmLevelForm.is_all
                    ? templates
                    : rhythmLevelForm.pose_ids.map((pid) => templates.find((t) => t.id === pid)!).filter(Boolean)
                  const idx = Math.min(rhythmLevelPreviewIdx, previewPoses.length - 1)
                  const current = previewPoses[idx]
                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-white/70">
                          {rhythmLevelForm.is_all ? '全部动作预览' : `已选动作预览（${previewPoses.length}个）`}
                        </label>
                        {previewPoses.length > 0 && (
                          <span className="text-xs text-white/50">{idx + 1} / {previewPoses.length}</span>
                        )}
                      </div>
                      {current ? (
                        <div className="flex flex-col items-center gap-3 p-4 bg-white/5 rounded-xl">
                          <div className="flex items-center gap-3 w-full">
                            <button
                              onClick={() => setRhythmLevelPreviewIdx((idx - 1 + previewPoses.length) % previewPoses.length)}
                              className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white shrink-0"
                            >
                              <ChevronLeft size={24} />
                            </button>
                            <div className="flex-1 flex flex-col items-center gap-2">
                              <PoseFigure template={current} size={200} scoringMode="minimal" />
                              <span className="text-sm text-white/80">{current.icon} {current.name}</span>
                              <div className="flex gap-2 mt-1">
                                <button
                                  onClick={() => quickEditPose(current)}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white/80"
                                >
                                  <Edit2 size={12} />
                                  编辑此动作
                                </button>
                                <button
                                  onClick={quickCreatePose}
                                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg transition-colors text-emerald-400"
                                >
                                  <Plus size={12} />
                                  新增动作
                                </button>
                              </div>
                            </div>
                            <button
                              onClick={() => setRhythmLevelPreviewIdx((idx + 1) % previewPoses.length)}
                              className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white shrink-0"
                            >
                              <ChevronRight size={24} />
                            </button>
                          </div>
                          {/* 缩略图条 */}
                          {previewPoses.length > 1 && (
                            <div className="flex gap-1.5 overflow-x-auto w-full justify-center pt-2">
                              {previewPoses.map((t, i) => (
                                <button
                                  key={t.id}
                                  onClick={() => setRhythmLevelPreviewIdx(i)}
                                  className={`shrink-0 w-2.5 h-2.5 rounded-full transition-all ${
                                    i === idx ? 'bg-emerald-400 w-6' : 'bg-white/20 hover:bg-white/40'
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-48 text-white/40 text-sm">
                          未选择动作
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
            <div className="sticky bottom-0 glass border-t border-white/10 px-6 py-4 flex items-center justify-between">
              <div />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRhythmLevelModal(false)}
                  className="px-6 py-3 rounded-xl hover:bg-white/10 transition-all"
                >
                  取消
                </button>
                <button
                  onClick={saveRhythmLevel}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all flex items-center gap-2 font-medium"
                >
                  <Save size={18} />
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== 我的关卡编辑弹窗（统一改名 + 闯关/节拍动作编排） ========== */}
      {showMyLevelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 glass border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                编辑我的关卡
                <span className="ml-3 text-xs font-normal text-white/50">
                  {myLevelForm.source === 'myCloud' ? '云端' : '本地'} · {myLevelForm.mode === 'challenge' ? '闯关' : myLevelForm.mode === 'rhythm' ? '节拍' : '跟练'}
                </span>
              </h2>
              <button onClick={() => setShowMyLevelModal(false)} className="p-2 rounded-xl hover:bg-white/10">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 左侧：改名 + 动作编排 */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/70 mb-1.5">名称</label>
                  <input
                    value={myLevelForm.name}
                    onChange={(e) => setMyLevelForm({ ...myLevelForm, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                    placeholder="关卡名称"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1.5">描述</label>
                  <textarea
                    value={myLevelForm.desc}
                    onChange={(e) => setMyLevelForm({ ...myLevelForm, desc: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-cyan-500/50 focus:outline-none resize-none"
                    placeholder="简单描述这个关卡"
                  />
                </div>

                {myLevelForm.mode === 'follow' ? (
                  <div className="p-4 bg-white/5 rounded-xl text-sm text-white/50">
                    跟练关卡仅支持改名/改描述，动作数据为内嵌视频帧，请在视频导入页重新生成。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* 已选动作有序列表 */}
                    {myLevelForm.pose_ids.length > 0 && (
                      <div className="space-y-1">
                        <label className="text-xs text-white/50">已选动作（{myLevelForm.pose_ids.length}个，按顺序）</label>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {myLevelForm.pose_ids.map((pid, idx) => {
                            const t = getMyLevelPoseTemplate(pid)
                            if (!t) return (
                              <div key={idx} className="flex items-center gap-2 px-2 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg">
                                <span className="text-xs text-white/40 w-4 shrink-0">{idx + 1}</span>
                                <span className="text-sm flex-1 truncate text-red-300">动作已失效</span>
                                <button onClick={() => removeMyLevelPose(idx)} className="p-1 rounded hover:bg-red-500/20 text-white/50 hover:text-red-400">
                                  <X size={20} />
                                </button>
                              </div>
                            )
                            return (
                              <div key={idx} className="flex items-center gap-2 px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                                <span className="text-xs text-white/40 w-4 shrink-0">{idx + 1}</span>
                                <span className="text-sm flex-1 truncate">{t.icon} {t.name}</span>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button onClick={() => setMyLevelPreviewIdx(idx)} className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-emerald-400" title="预览">
                                    <ZoomIn size={14} />
                                  </button>
                                  <button onClick={() => moveMyLevelPose(idx, -1)} disabled={idx === 0} className="p-1 rounded hover:bg-white/10 text-white/50 disabled:opacity-20">
                                    <ArrowUp size={14} />
                                  </button>
                                  <button onClick={() => moveMyLevelPose(idx, 1)} disabled={idx === myLevelForm.pose_ids.length - 1} className="p-1 rounded hover:bg-white/10 text-white/50 disabled:opacity-20">
                                    <ArrowDown size={14} />
                                  </button>
                                  <button onClick={() => removeMyLevelPose(idx)} className="p-1 rounded hover:bg-red-500/20 text-white/50 hover:text-red-400">
                                    <X size={20} />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* 搜索下拉选择器 */}
                    <div ref={myLevelSelectorRef} className="relative">
                      <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                        <input
                          value={myLevelPoseSearch}
                          onChange={(e) => setMyLevelPoseSearch(e.target.value)}
                          onFocus={() => setMyLevelSelectorOpen(true)}
                          className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                          placeholder={myLevelForm.source === 'myLocal' ? '搜索本地动作...' : '搜索云端动作...'}
                        />
                      </div>
                      {myLevelSelectorOpen && (
                        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-gray-800/95 backdrop-blur border border-white/20 rounded-xl shadow-xl">
                          {(myLevelForm.source === 'myLocal'
                            ? localPoses.map((p) => ({ id: p.id, name: p.name, icon: p.icon, category: p.category }))
                            : templates.map((t) => ({ id: t.id, name: t.name, icon: t.icon, category: t.category }))
                          )
                            .filter((t) =>
                              !myLevelPoseSearch ||
                              t.name.toLowerCase().includes(myLevelPoseSearch.toLowerCase()) ||
                              t.category.toLowerCase().includes(myLevelPoseSearch.toLowerCase())
                            )
                            .map((t) => {
                              const count = myLevelForm.pose_ids.filter((id) => id === t.id).length
                              return (
                                <button
                                  key={t.id}
                                  onClick={() => addMyLevelPose(t.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-white/10 text-white/70"
                                >
                                  <Plus size={14} className="text-emerald-400 shrink-0" />
                                  <span>{t.icon}</span>
                                  <span className="truncate flex-1">{t.name}</span>
                                  {count > 0 && <span className="text-xs text-emerald-400 shrink-0">×{count}</span>}
                                  <span className="text-white/30 shrink-0">{t.category}</span>
                                </button>
                              )
                            })}
                          {(myLevelForm.source === 'myLocal' ? localPoses : templates).filter((t) =>
                            !myLevelPoseSearch ||
                            t.name.toLowerCase().includes(myLevelPoseSearch.toLowerCase()) ||
                            t.category.toLowerCase().includes(myLevelPoseSearch.toLowerCase())
                          ).length === 0 && (
                            <div className="px-3 py-4 text-center text-white/40 text-sm">无匹配动作</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 右侧：预览（仅闯关/节拍） */}
              {myLevelForm.mode !== 'follow' && (
                <div className="space-y-3">
                  {(() => {
                    const previewPoses = myLevelForm.pose_ids.map((pid) => getMyLevelPoseTemplate(pid)).filter(Boolean) as PoseTemplate[]
                    const idx = Math.min(myLevelPreviewIdx, previewPoses.length - 1)
                    const current = previewPoses[idx]
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-white/70">已选动作预览（{previewPoses.length}个）</label>
                          {previewPoses.length > 0 && (
                            <span className="text-xs text-white/50">{idx + 1} / {previewPoses.length}</span>
                          )}
                        </div>
                        {current ? (
                          <div className="flex flex-col items-center gap-3 p-4 bg-white/5 rounded-xl">
                            <div className="flex items-center gap-3 w-full">
                              <button
                                onClick={() => setMyLevelPreviewIdx((idx - 1 + previewPoses.length) % previewPoses.length)}
                                className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white shrink-0"
                              >
                                <ChevronLeft size={24} />
                              </button>
                              <div className="flex-1 flex flex-col items-center gap-2">
                                <PoseFigure template={current} size={200} scoringMode="minimal" />
                                <span className="text-sm text-white/80">{current.icon} {current.name}</span>
                              </div>
                              <button
                                onClick={() => setMyLevelPreviewIdx((idx + 1) % previewPoses.length)}
                                className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white shrink-0"
                              >
                                <ChevronRight size={24} />
                              </button>
                            </div>
                            {previewPoses.length > 1 && (
                              <div className="flex gap-1.5 overflow-x-auto w-full justify-center pt-2">
                                {previewPoses.map((t, i) => (
                                  <button
                                    key={i}
                                    onClick={() => setMyLevelPreviewIdx(i)}
                                    className={`shrink-0 w-2.5 h-2.5 rounded-full transition-all ${
                                      i === idx ? 'bg-emerald-400 w-6' : 'bg-white/20 hover:bg-white/40'
                                    }`}
                                    title={t.name}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-48 text-white/40 text-sm">未选择动作</div>
                        )}
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
            <div className="sticky bottom-0 glass border-t border-white/10 px-6 py-4 flex items-center justify-between">
              <div />
              <div className="flex gap-3">
                <button onClick={() => setShowMyLevelModal(false)} className="px-6 py-3 rounded-xl hover:bg-white/10 transition-all">取消</button>
                <button
                  onClick={saveMyLevel}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all flex items-center gap-2 font-medium"
                >
                  <Save size={18} />
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
