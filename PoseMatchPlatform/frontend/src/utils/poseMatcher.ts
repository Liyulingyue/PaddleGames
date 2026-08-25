import type { Keypoint } from '@/types/pose'

export type ScoringRuleType = 'angle_dir' | 'angle_3pt' | 'coordinate' | 'distance' | 'symmetry'

/**
 * 归一化策略：以双肩中心为原点，双肩距离为单位 1
 * - 消除位置偏移（人在画面左/右/上/下不影响）
 * - 消除距离影响（离镜头远/近不影响）
 * - 消除体型差异（不同身高臂长比例统一）
 *
 * 归一化后：左肩 (-0.5, 0)，右肩 (0.5, 0)，鼻头约 (0, -1)
 */
export function normalizeLandmarks<T extends { x: number; y: number; name?: string }>(
  landmarks: T[]
): T[] {
  const ls = landmarks.find((l) => l.name === 'LEFT_SHOULDER')
  const rs = landmarks.find((l) => l.name === 'RIGHT_SHOULDER')
  if (!ls || !rs) return landmarks

  const cx = (ls.x + rs.x) / 2
  const cy = (ls.y + rs.y) / 2
  const dx = ls.x - rs.x
  const dy = ls.y - rs.y
  const scale = Math.sqrt(dx * dx + dy * dy)
  if (scale < 1e-6) return landmarks

  return landmarks.map((l) => ({
    ...l,
    x: (l.x - cx) / scale,
    y: (l.y - cy) / scale,
  }))
}

export interface ScoringRule {
  type: ScoringRuleType
  points: string[]
  targetValue?: number | { x: number; y: number }
  tolerance: number
  weight: number
  required: boolean
  modes?: ScoringMode[]
}

export interface TemplateLandmark {
  name: string
  x: number
  y: number
  z?: number
}

export interface PoseTemplate {
  id: number | string
  name: string
  description: string
  category: string
  difficulty: number
  icon: string
  landmarks: TemplateLandmark[]
  scoring_rules: ScoringRule[]
  duration: number
  /** 创建者用户ID，null=系统预设 */
  created_by?: number | null
  /** 是否公开到市场 */
  is_public?: boolean
  /** Fork 来源 ID（溯源） */
  forked_from?: number | null
  /** 视频跟练：该帧在原视频中的时间点（秒） */
  timestamp?: number
  /** 视频跟练：该帧持续到下一帧的时间（秒），自动推进用 */
  sourceDuration?: number
  /** 视频跟练：原始帧缩略图（dataURL），可选 */
  thumbnail?: string
}

export function getKeypoint(landmarks: Keypoint[], name: string): Keypoint | null {
  const idx = landmarks.findIndex((k) => k.name === name)
  return idx >= 0 ? landmarks[idx] : null
}

export function angleDiff(a: number, b: number): number {
  let diff = Math.abs(a - b)
  while (diff > Math.PI) diff = Math.abs(diff - 2 * Math.PI)
  return diff
}

export function directionAngle(p1: Keypoint | TemplateLandmark, p2: Keypoint | TemplateLandmark): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x)
}

/**
 * 计算两点构成的向量 (p1 -> p2)
 */
export function directionVector(p1: { x: number; y: number }, p2: { x: number; y: number }): { x: number; y: number } {
  return { x: p2.x - p1.x, y: p2.y - p1.y }
}

/**
 * 向量余弦相似度：cos(θ) = v1·v2 / (|v1|*|v2|)
 * 范围 [-1, 1]：1=完全同向，0=垂直，-1=完全反向
 */
export function vectorCosineSimilarity(
  v1: { x: number; y: number },
  v2: { x: number; y: number }
): number {
  const dot = v1.x * v2.x + v1.y * v2.y
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y)
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y)
  if (mag1 < 1e-6 || mag2 < 1e-6) return 0
  return Math.max(-1, Math.min(1, dot / (mag1 * mag2)))
}

export function threePointAngle(
  p1: Keypoint | TemplateLandmark,
  vertex: Keypoint | TemplateLandmark,
  p3: Keypoint | TemplateLandmark
): number {
  const v1 = { x: p1.x - vertex.x, y: p1.y - vertex.y }
  const v2 = { x: p3.x - vertex.x, y: p3.y - vertex.y }
  const dot = v1.x * v2.x + v1.y * v2.y
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y)
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y)
  if (mag1 === 0 || mag2 === 0) return 0
  return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))))
}

export function pointDistance(
  p1: Keypoint | TemplateLandmark,
  p2: Keypoint | TemplateLandmark
): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

export type ScoringMode = 'minimal' | 'upper' | 'full'

export const SCORING_MODES: Record<ScoringMode, { label: string; desc: string; icon: string }> = {
  minimal: { label: '极简', desc: '肩+肘+腕', icon: '👆' },
  upper: { label: '半身', desc: '肩+肘+腕+髋', icon: '💪' },
  full: { label: '全身', desc: '肩+肘+腕+髋+膝+踝', icon: '🧍' },
}

const MINIMAL_POINTS = new Set([
  'LEFT_SHOULDER', 'RIGHT_SHOULDER',
  'LEFT_ELBOW', 'RIGHT_ELBOW',
  'LEFT_WRIST', 'RIGHT_WRIST',
])
const UPPER_POINTS = new Set([
  'LEFT_SHOULDER', 'RIGHT_SHOULDER',
  'LEFT_ELBOW', 'RIGHT_ELBOW',
  'LEFT_WRIST', 'RIGHT_WRIST',
  'LEFT_HIP', 'RIGHT_HIP',
])
const FULL_POINTS = new Set([
  'LEFT_SHOULDER', 'RIGHT_SHOULDER',
  'LEFT_ELBOW', 'RIGHT_ELBOW',
  'LEFT_WRIST', 'RIGHT_WRIST',
  'LEFT_HIP', 'RIGHT_HIP',
  'LEFT_KNEE', 'RIGHT_KNEE',
  'LEFT_ANKLE', 'RIGHT_ANKLE',
])

export function getEnabledPoints(mode: ScoringMode): Set<string> {
  if (mode === 'minimal') return MINIMAL_POINTS
  if (mode === 'upper') return UPPER_POINTS
  return FULL_POINTS
}

export function ruleUsesEnabledPoints(rule: ScoringRule, enabled: Set<string>): boolean {
  return rule.points.every((p) => enabled.has(p))
}

export function ruleAppliesToMode(rule: ScoringRule, mode: ScoringMode): boolean {
  if (rule.modes && rule.modes.length > 0) {
    return rule.modes.includes(mode)
  }
  return ruleUsesEnabledPoints(rule, getEnabledPoints(mode))
}

export function evaluateRule(rule: ScoringRule, landmarks: Keypoint[]): number | null {
  const points = rule.points.map((name) => getKeypoint(landmarks, name))
  if (points.some((p) => p === null)) return null

  const tol = rule.tolerance
  let target = rule.targetValue ?? 0

  if (rule.type === 'angle_dir') {
    // 向量余弦相似度：计算实时向量与目标向量的余弦值
    const liveVec = directionVector(points[0]!, points[1]!)
    const t = target as { x: number; y: number }
    if (!t || typeof t !== 'object') return null
    const sim = vectorCosineSimilarity(liveVec, t)
    // 容差 tol 是余弦相似度的阈值（比如 0.9 = 约 25.8°）
    // sim >= 1 - tol 时得满分，线性下降到 0
    const simThreshold = 1 - tol
    if (sim <= simThreshold) return 0
    return 100 * ((sim - simThreshold) / tol)
  }

  if (rule.type === 'angle_3pt') {
    const actual = threePointAngle(points[0]!, points[1]!, points[2]!)
    const diff = Math.abs(actual - (target as number))
    if (diff >= tol) return 0
    return 100 * (1 - diff / tol)
  }

  if (rule.type === 'distance') {
    const actual = pointDistance(points[0]!, points[1]!)
    const diff = Math.abs(actual - (target as number))
    if (diff >= tol) return 0
    return 100 * (1 - diff / tol)
  }

  if (rule.type === 'coordinate') {
    const p = points[0]!
    const t = target as { x: number; y: number }
    if (!t || typeof t !== 'object') return null
    const dx = p.x - t.x
    const dy = p.y - t.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist >= tol) return 0
    return 100 * (1 - dist / tol)
  }

  if (rule.type === 'symmetry') {
    if (points.length < 4) return null
    const leftAngle = directionAngle(points[0]!, points[1]!)
    const rightAngle = directionAngle(points[2]!, points[3]!)
    const mirrorRight = -rightAngle
    const diff = angleDiff(leftAngle, mirrorRight)
    if (diff >= tol) return 0
    return 100 * (1 - diff / tol)
  }

  return null
}

export function calculatePoseMatchScore(
  landmarks: Keypoint[],
  template: PoseTemplate,
  mode: ScoringMode = 'minimal'
): number {
  if (!landmarks || landmarks.length < 17) return 0

  // 归一化：以双肩中心为原点，双肩距离为单位 1
  const normalizedLive = normalizeLandmarks(landmarks)
  const normalizedTemplate = normalizeLandmarks(template.landmarks)

  const enabledPoints = getEnabledPoints(mode)
  const rules = template.scoring_rules.filter((r) => ruleAppliesToMode(r, mode))

  if (rules.length === 0) return 0

  let totalScore = 0
  let totalWeight = 0

  for (const rule of rules) {
    // 使用归一化后的实时数据进行评分
    const score = evaluateRule(rule, normalizedLive)
    if (score !== null) {
      totalScore += score * rule.weight
      totalWeight += rule.weight
    }
  }

  if (totalWeight === 0) return 0

  const baseScore = totalScore / totalWeight

  // 对称性奖励：使用归一化坐标
  const leftShoulder = getKeypoint(normalizedLive, 'LEFT_SHOULDER')
  const rightShoulder = getKeypoint(normalizedLive, 'RIGHT_SHOULDER')
  const leftWrist = getKeypoint(normalizedLive, 'LEFT_WRIST')
  const rightWrist = getKeypoint(normalizedLive, 'RIGHT_WRIST')

  let symmetryBonus = 50
  if (leftShoulder && rightShoulder && leftWrist && rightWrist) {
    const leftUp = directionAngle(leftShoulder, leftWrist) < -0.5
    const rightUp = directionAngle(rightShoulder, rightWrist) < -0.5
    if ((leftUp && rightUp) || (!leftUp && !rightUp)) {
      symmetryBonus = 100
    }
  }

  const finalScore = Math.min(100, baseScore * 0.8 + symmetryBonus * 0.2)

  return Math.round(finalScore)
}

/**
 * 关键点向量余弦相似度（跟练模式专用）
 *
 * 逻辑：选取 enabledPoints 对应的 K 个关键点 → 归一化 → flatten 为 [x1,y1, x2,y2, ..., xk,yk] → 余弦相似度
 * - 闯关/节拍用角度规则（关注"达标"），跟练用向量相似度（关注"全程同步"）
 * - 返回 0~100 分
 */
export function calculateKeypointSimilarity(
  landmarks: Keypoint[],
  template: PoseTemplate,
  mode: ScoringMode = 'upper'
): number {
  if (!landmarks || landmarks.length < 17) return 0

  const enabledPoints = getEnabledPoints(mode)

  // 归一化：Procrustes（双肩中心=原点，双肩距=1）
  const normLive = normalizeLandmarks(landmarks)
  const normTemplate = normalizeLandmarks(template.landmarks)

  // 按 enabledPoints 筛选并 flatten 为 [x1,y1, x2,y2, ...]
  const liveVec: number[] = []
  const tplVec: number[] = []

  for (const lm of normLive) {
    if (lm.name && enabledPoints.has(lm.name)) {
      liveVec.push(lm.x, lm.y)
    }
  }
  for (const lm of normTemplate) {
    if (lm.name && enabledPoints.has(lm.name)) {
      tplVec.push(lm.x, lm.y)
    }
  }

  if (liveVec.length === 0 || tplVec.length === 0) return 0
  // 维度不一致（不应该发生，但防御性处理）
  const len = Math.min(liveVec.length, tplVec.length)

  // 余弦相似度
  let dot = 0, mag1 = 0, mag2 = 0
  for (let i = 0; i < len; i++) {
    dot += liveVec[i] * tplVec[i]
    mag1 += liveVec[i] * liveVec[i]
    mag2 += tplVec[i] * tplVec[i]
  }
  mag1 = Math.sqrt(mag1)
  mag2 = Math.sqrt(mag2)
  if (mag1 < 1e-6 || mag2 < 1e-6) return 0

  const cosine = Math.max(-1, Math.min(1, dot / (mag1 * mag2)))

  // cosine ∈ [-1, 1]，映射到 [0, 100]
  // 归一化后关键点通常在同一象限，cosine 一般 > 0.5
  // 直接线性映射 (cosine+1)/2*100 区分度太低（0.92→96, 0.9→95）
  // 改用阈值映射：cosine 0.5→0分, 1.0→100分，增强区分度
  const threshold = 0.5
  const score = Math.min(100, Math.max(0, (cosine - threshold) / (1 - threshold) * 100))

  return Math.round(score)
}

const _kp = (name: string, x: number, y: number): TemplateLandmark => ({ name, x: Math.round(x * 10000) / 10000, y: Math.round(y * 10000) / 10000 })

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

function _baseLandmarks(): Record<string, TemplateLandmark> {
  const cx = 0.5
  const shoulderY = 0.35
  const shoulderHalf = 0.12
  const hipY = 0.62
  const hipHalf = 0.08
  const headR = 0.08
  const headCy = shoulderY - 0.12

  const lm: Record<string, TemplateLandmark> = {}
  lm.LEFT_SHOULDER = _kp('LEFT_SHOULDER', cx + shoulderHalf, shoulderY)
  lm.RIGHT_SHOULDER = _kp('RIGHT_SHOULDER', cx - shoulderHalf, shoulderY)
  lm.LEFT_HIP = _kp('LEFT_HIP', cx + hipHalf, hipY)
  lm.RIGHT_HIP = _kp('RIGHT_HIP', cx - hipHalf, hipY)
  lm.NOSE = _kp('NOSE', cx, headCy - headR * 0.3)
  lm.LEFT_EYE = _kp('LEFT_EYE', cx + headR * 0.4, headCy - headR * 0.4)
  lm.RIGHT_EYE = _kp('RIGHT_EYE', cx - headR * 0.4, headCy - headR * 0.4)
  lm.LEFT_EAR = _kp('LEFT_EAR', cx + headR * 0.8, headCy - headR * 0.2)
  lm.RIGHT_EAR = _kp('RIGHT_EAR', cx - headR * 0.8, headCy - headR * 0.2)
  lm.LEFT_EYE_INNER = _kp('LEFT_EYE_INNER', cx + headR * 0.2, headCy - headR * 0.4)
  lm.RIGHT_EYE_INNER = _kp('RIGHT_EYE_INNER', cx - headR * 0.2, headCy - headR * 0.4)
  lm.LEFT_EYE_OUTER = _kp('LEFT_EYE_OUTER', cx + headR * 0.6, headCy - headR * 0.4)
  lm.RIGHT_EYE_OUTER = _kp('RIGHT_EYE_OUTER', cx - headR * 0.6, headCy - headR * 0.4)
  lm.MOUTH_LEFT = _kp('MOUTH_LEFT', cx + headR * 0.3, headCy + headR * 0.2)
  lm.MOUTH_RIGHT = _kp('MOUTH_RIGHT', cx - headR * 0.3, headCy + headR * 0.2)
  return lm
}

function _setArm(lm: Record<string, TemplateLandmark>, side: 'LEFT' | 'RIGHT', shoulderAngle: number, elbowAngle: number) {
  const shoulder = lm[`${side}_SHOULDER`]
  const armLen = 0.22
  const upperLen = armLen * 0.48
  const foreLen = armLen * 0.52
  const sign = side === 'LEFT' ? 1 : -1

  const ex = shoulder.x + upperLen * Math.cos(shoulderAngle)
  const ey = shoulder.y + upperLen * Math.sin(shoulderAngle)
  lm[`${side}_ELBOW`] = _kp(`${side}_ELBOW`, ex, ey)

  const wx = ex + foreLen * Math.cos(elbowAngle)
  const wy = ey + foreLen * Math.sin(elbowAngle)
  lm[`${side}_WRIST`] = _kp(`${side}_WRIST`, wx, wy)

  lm[`${side}_PINKY`] = _kp(`${side}_PINKY`, wx - sign * 0.015, wy + 0.02)
  lm[`${side}_INDEX`] = _kp(`${side}_INDEX`, wx + sign * 0.01, wy + 0.025)
  lm[`${side}_THUMB`] = _kp(`${side}_THUMB`, wx + sign * 0.02, wy - 0.01)
}

function _setLeg(lm: Record<string, TemplateLandmark>, side: 'LEFT' | 'RIGHT', hipAngle: number, kneeAngle: number) {
  const hip = lm[`${side}_HIP`]
  const legLen = 0.28
  const thighLen = legLen * 0.5
  const shinLen = legLen * 0.5
  const sign = side === 'LEFT' ? 1 : -1

  const kx = hip.x + thighLen * Math.cos(hipAngle)
  const ky = hip.y + thighLen * Math.sin(hipAngle)
  lm[`${side}_KNEE`] = _kp(`${side}_KNEE`, kx, ky)

  const ax = kx + shinLen * Math.cos(kneeAngle)
  const ay = ky + shinLen * Math.sin(kneeAngle)
  lm[`${side}_ANKLE`] = _kp(`${side}_ANKLE`, ax, ay)

  const footLen = 0.05
  lm[`${side}_HEEL`] = _kp(`${side}_HEEL`, ax - sign * footLen * 0.3, ay + 0.015)
  lm[`${side}_FOOT_INDEX`] = _kp(`${side}_FOOT_INDEX`, ax + sign * footLen * 0.7, ay + 0.01)
}

function _lmToList(lmDict: Record<string, TemplateLandmark>): TemplateLandmark[] {
  const result: TemplateLandmark[] = new Array(33)
  for (const name of Object.keys(lmDict)) {
    const idx = KP_IDX[name]
    if (idx !== undefined) result[idx] = lmDict[name]
  }
  for (let i = 0; i < 33; i++) {
    if (!result[i]) {
      const name = Object.keys(KP_IDX).find((k) => KP_IDX[k] === i)!
      result[i] = _kp(name, 0.5, 0.5)
    }
  }
  return result
}

function _shoulderRules(leftAngle: number, rightAngle: number, tol = 0.15): ScoringRule[] {
  return [
    { type: 'angle_dir', points: ['LEFT_SHOULDER', 'LEFT_WRIST'], targetValue: { x: Math.cos(leftAngle), y: Math.sin(leftAngle) }, tolerance: tol, weight: 1, required: true },
    { type: 'angle_dir', points: ['RIGHT_SHOULDER', 'RIGHT_WRIST'], targetValue: { x: Math.cos(rightAngle), y: Math.sin(rightAngle) }, tolerance: tol, weight: 1, required: true },
  ]
}

function _elbowRules(left: number, right: number, tol = 0.4): ScoringRule[] {
  return [
    { type: 'angle_3pt', points: ['LEFT_SHOULDER', 'LEFT_ELBOW', 'LEFT_WRIST'], targetValue: left, tolerance: tol, weight: 1, required: true },
    { type: 'angle_3pt', points: ['RIGHT_SHOULDER', 'RIGHT_ELBOW', 'RIGHT_WRIST'], targetValue: right, tolerance: tol, weight: 1, required: true },
  ]
}

function _hipRules(leftAngle: number, rightAngle: number, tol = 0.15): ScoringRule[] {
  return [
    { type: 'angle_dir', points: ['LEFT_HIP', 'LEFT_ANKLE'], targetValue: { x: Math.cos(leftAngle), y: Math.sin(leftAngle) }, tolerance: tol, weight: 1, required: true },
    { type: 'angle_dir', points: ['RIGHT_HIP', 'RIGHT_ANKLE'], targetValue: { x: Math.cos(rightAngle), y: Math.sin(rightAngle) }, tolerance: tol, weight: 1, required: true },
  ]
}

function _kneeRules(left: number, right: number, tol = 0.4): ScoringRule[] {
  return [
    { type: 'angle_3pt', points: ['LEFT_HIP', 'LEFT_KNEE', 'LEFT_ANKLE'], targetValue: left, tolerance: tol, weight: 1, required: true },
    { type: 'angle_3pt', points: ['RIGHT_HIP', 'RIGHT_KNEE', 'RIGHT_ANKLE'], targetValue: right, tolerance: tol, weight: 1, required: true },
  ]
}

function _buildTemplate(
  id: number, name: string, desc: string, cat: string, diff: number, icon: string, dur: number,
  leftShoulder = Math.PI / 2, rightShoulder = Math.PI / 2,
  leftElbowBend = 3.0, rightElbowBend = 3.0,
  leftHip = Math.PI / 2, rightHip = Math.PI / 2,
  leftKneeBend = 2.9, rightKneeBend = 2.9,
  rules: ScoringRule[] = [],
): PoseTemplate {
  const lm = _baseLandmarks()
  const leftElbowAngle = leftShoulder + Math.PI - leftElbowBend
  const rightElbowAngle = rightShoulder - Math.PI + rightElbowBend
  const leftKneeAngle = leftHip + Math.PI - leftKneeBend
  const rightKneeAngle = rightHip - Math.PI + rightKneeBend
  _setArm(lm, 'LEFT', leftShoulder, leftElbowAngle)
  _setArm(lm, 'RIGHT', rightShoulder, rightElbowAngle)
  _setLeg(lm, 'LEFT', leftHip, leftKneeAngle)
  _setLeg(lm, 'RIGHT', rightHip, rightKneeAngle)
  return {
    id, name, description: desc, category: cat, difficulty: diff, icon,
    landmarks: _lmToList(lm), scoring_rules: rules, duration: dur,
  }
}

export const DEFAULT_TEMPLATES: PoseTemplate[] = [
  _buildTemplate(1, '[F] T字站', '双臂水平展开成T字形', '热身', 1, '🤸', 5, 0, Math.PI, 3.0, 3.0, Math.PI/2, Math.PI/2, 3.0, 3.0,
    [..._shoulderRules(0, Math.PI, 0.5), ..._elbowRules(3, 3, 0.4), ..._hipRules(Math.PI/2, Math.PI/2, 0.3), ..._kneeRules(3, 3, 0.4)]),
  _buildTemplate(2, '[F] 双手上举', '双手向上伸直举起', '热身', 1, '🙋', 5, -Math.PI/2, -Math.PI/2, 3.1, 3.1, Math.PI/2, Math.PI/2, 3.0, 3.0,
    [..._shoulderRules(-Math.PI/2, -Math.PI/2, 0.6), ..._elbowRules(3.1, 3.1, 0.4), ..._hipRules(Math.PI/2, Math.PI/2, 0.3), ..._kneeRules(3, 3, 0.4)]),
  _buildTemplate(3, '[F] 左手平举', '左手向左侧水平展开', '基础', 2, '👈', 5, 0, Math.PI/2, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(0, Math.PI/2, 0.4)),
  _buildTemplate(4, '[F] 右手平举', '右手向右侧水平展开', '基础', 2, '👉', 5, Math.PI/2, Math.PI, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(Math.PI/2, Math.PI, 0.4)),
  _buildTemplate(5, '[F] 武士式', '左手前伸，右手上举', '进阶', 3, '⚔️', 8, 0, -Math.PI/2, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(0, -Math.PI/2, 0.5)),
  _buildTemplate(6, '[F] 树式', '双手上举保持平衡', '瑜伽', 3, '🧘', 10, -Math.PI/2, -Math.PI/2, 2.0, 2.0, Math.PI/2, Math.PI*0.35, 3.0, 1.8,
    [..._shoulderRules(-Math.PI/2, -Math.PI/2, 0.6), ..._elbowRules(2, 2, 0.5), ..._hipRules(Math.PI/2, Math.PI*0.35, 0.3), ..._kneeRules(3, 1.8, 0.5)]),
  _buildTemplate(7, '[F] 战士二式', '双臂水平展开，身体侧转', '瑜伽', 2, '🏋️', 8, 0, Math.PI, 3.0, 3.0, Math.PI*0.6, Math.PI*0.4, 2.2, 2.8,
    [..._shoulderRules(0, Math.PI, 0.5), ..._elbowRules(3, 3, 0.4), ..._hipRules(Math.PI*0.6, Math.PI*0.4, 0.4), ..._kneeRules(2.2, 2.8, 0.5)]),
  _buildTemplate(8, '[F] 鹰式手臂', '双臂交叉环绕在胸前', '瑜伽', 3, '🦅', 8, Math.PI*0.6, Math.PI*0.4, 1.8, 1.8, Math.PI/2, Math.PI/2, 3.0, 3.0,
    [..._shoulderRules(Math.PI*0.6, Math.PI*0.4, 0.4), ..._elbowRules(1.8, 1.8, 0.5), ..._hipRules(Math.PI/2, Math.PI/2, 0.3), ..._kneeRules(3, 3, 0.4)]),
  _buildTemplate(11, '[F] 托天理三焦', '双手上举，抬头看手 - 八段锦第一式', '八段锦', 2, '🌸', 8, -Math.PI/2, -Math.PI/2, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(-Math.PI/2, -Math.PI/2, 0.5)),
  _buildTemplate(12, '[F] 左右开弓似射雕', '左手前推，右手拉弓 - 八段锦第二式', '八段锦', 3, '🏹', 8, 0, Math.PI*0.65, 3.0, 1.3, Math.PI/2, Math.PI/2, 2.9, 2.9,
    [..._shoulderRules(0, Math.PI*0.65, 0.5), ..._elbowRules(3.0, 1.3, 0.4)]),
  _buildTemplate(13, '[F] 调理脾胃须单举', '左手上托，右手下按 - 八段锦第三式', '八段锦', 2, '🌿', 8, -Math.PI/2, Math.PI/2, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(-Math.PI/2, Math.PI/2, 0.5)),
  _buildTemplate(14, '[F] 五劳七伤往后瞧', '双臂展开，转头后望 - 八段锦第四式', '八段锦', 2, '🦢', 8, -0.3, Math.PI+0.3, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(-0.3, Math.PI+0.3, 0.4)),
  _buildTemplate(15, '[F] 摇头摆尾去心火', '俯身转体，舒展躯干 - 八段锦第五式', '八段锦', 3, '🐉', 10, 0.2, Math.PI-0.2, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(0.2, Math.PI-0.2, 0.6)),
  _buildTemplate(16, '[F] 两手攀足固肾腰', '双手下伸，触摸脚尖 - 八段锦第六式', '八段锦', 3, '🧗', 10, Math.PI/2, Math.PI/2, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(Math.PI/2, Math.PI/2, 0.6)),
  _buildTemplate(17, '[F] 攒拳怒目增气力', '握拳前冲，怒目圆睁 - 八段锦第七式', '八段锦', 2, '👊', 8, 0, Math.PI, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(0, Math.PI, 0.5)),
  _buildTemplate(18, '[F] 背后七颠百病消', '双手背后，踮脚颠颤 - 八段锦第八式', '八段锦', 1, '✨', 8, Math.PI*0.35, Math.PI*0.65, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(Math.PI*0.35, Math.PI*0.65, 0.5)),
  _buildTemplate(21, '[F] 肩部环绕上', '双臂从前向上环绕至头顶', '肩颈', 1, '💆', 5, -Math.PI/2, -Math.PI/2, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(-Math.PI/2, -Math.PI/2, 0.5)),
  _buildTemplate(22, '[F] 肩外展90度', '双臂侧平举成90度', '肩颈', 1, '🕊️', 5, 0, Math.PI, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(0, Math.PI, 0.4)),
  _buildTemplate(23, '[F] 耸肩沉肩', '耸起双肩然后放松下沉', '肩颈', 1, '😌', 5, -Math.PI/3, -Math.PI*2/3, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(-Math.PI/3, -Math.PI*2/3, 0.5)),
  _buildTemplate(24, '[F] 反向拉伸', '双手背后合十，挺胸抬头', '肩颈', 2, '🧘‍♀️', 6, Math.PI*0.35, Math.PI*0.65, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(Math.PI*0.35, Math.PI*0.65, 0.5)),
  _buildTemplate(31, '[F] 双手合十上举', '双手合十慢慢向上举过头顶', '晨间', 1, '🌅', 6, -Math.PI/2, -Math.PI/2, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(-Math.PI/2, -Math.PI/2, 0.5)),
  _buildTemplate(32, '[F] 侧弯伸展', '一只手向上伸直，身体侧屈', '晨间', 2, '🌊', 6, -Math.PI/2, Math.PI*0.3, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(-Math.PI/2, Math.PI*0.3, 0.5)),
  _buildTemplate(33, '[F] 扩胸运动', '双臂展开挺胸，再合拢抱肩', '晨间', 1, '💪', 5, 0, Math.PI, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(0, Math.PI, 0.5)),
  _buildTemplate(34, '[F] 转体伸展', '双臂平举，身体左右扭转', '晨间', 2, '🎡', 6, -0.2, Math.PI+0.2, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(-0.2, Math.PI+0.2, 0.5)),
  _buildTemplate(41, '[F] 举臂伸展', '双手上举，拉伸脊柱', '办公室', 1, '🖥️', 6, -Math.PI/2, -Math.PI/2, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(-Math.PI/2, -Math.PI/2, 0.5)),
  _buildTemplate(42, '[F] 肩颈放松', '耸肩、沉肩、转头放松', '办公室', 1, '☕', 5, -Math.PI/3, -Math.PI*2/3, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(-Math.PI/3, -Math.PI*2/3, 0.5)),
  _buildTemplate(43, '[F] 手臂交叉拉伸', '一臂横过胸前，另一手辅助拉伸', '办公室', 2, '🪑', 6, Math.PI*0.7, Math.PI*0.3, 1.8, 2.5, Math.PI/2, Math.PI/2, 2.9, 2.9,
    [..._shoulderRules(Math.PI*0.7, Math.PI*0.3, 0.4), ..._elbowRules(1.8, 2.5, 0.4)]),
  _buildTemplate(44, '[F] 手腕放松', '双手上下摆动放松腕部', '办公室', 1, '⌨️', 5, Math.PI*0.4, Math.PI*0.6, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(Math.PI*0.4, Math.PI*0.6, 0.4)),
  _buildTemplate(51, '[F] 手臂下压', '双臂向身体两侧下方压', '手臂', 2, '💪', 5, Math.PI/2, Math.PI/2, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(Math.PI/2, Math.PI/2, 0.4)),
  _buildTemplate(52, '[F] 前平举', '双臂向前平举至肩高', '手臂', 2, '🏋️‍♀️', 5, -0.1, -Math.PI+0.1, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(-0.1, -Math.PI+0.1, 0.5)),
  _buildTemplate(53, '[F] 斜上举', '双臂向斜上方45度举起', '手臂', 2, '🎯', 5, -Math.PI/4, -Math.PI*3/4, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(-Math.PI/4, -Math.PI*3/4, 0.5)),
  _buildTemplate(54, '[F] V字伸展', '双臂向上展开成V字形', '手臂', 2, '✌️', 5, -Math.PI/3, -Math.PI*2/3, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    _shoulderRules(-Math.PI/3, -Math.PI*2/3, 0.5)),
  // ============ 健身动作模板 (ID 61-72) ============
  // 推举：双臂上举 ↔ 双手肩位
  _buildTemplate(61, '[F] 推举·上举', '双臂向上推举至伸直', '健身', 1, '🏋️', 5,
    -Math.PI/2, -Math.PI/2, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    [..._shoulderRules(-Math.PI/2, -Math.PI/2, 0.3), ..._elbowRules(3.0, 3.0, 0.3)]),
  _buildTemplate(62, '[F] 推举·肩位', '双手降至肩位，准备下一次推举', '健身', 1, '🏋️', 5,
    0.3, Math.PI-0.3, 1.0, 1.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    [..._shoulderRules(0.3, Math.PI-0.3, 0.3), ..._elbowRules(1.0, 1.0, 0.3)]),
  // 弯举：双手弯举至肩 ↔ 双臂下垂
  _buildTemplate(63, '[F] 弯举·举至肩', '弯举至肩，收缩肱二头肌', '健身', 1, '💪', 5,
    Math.PI/2, Math.PI/2, 1.2, 1.2, Math.PI/2, Math.PI/2, 2.9, 2.9,
    [..._shoulderRules(Math.PI/2, Math.PI/2, 0.3), ..._elbowRules(1.2, 1.2, 0.3)]),
  _buildTemplate(64, '[F] 弯举·下垂', '双臂自然下垂，准备弯举', '健身', 1, '💪', 5,
    Math.PI/2, Math.PI/2, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    [..._shoulderRules(Math.PI/2, Math.PI/2, 0.3), ..._elbowRules(3.0, 3.0, 0.3)]),
  // 侧平举：双臂侧平 ↔ 双臂下垂
  _buildTemplate(65, '[F] 侧平举·展臂', '双臂侧平举至水平', '健身', 1, '🦅', 5,
    0, Math.PI, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    [..._shoulderRules(0, Math.PI, 0.3), ..._elbowRules(3.0, 3.0, 0.3)]),
  _buildTemplate(66, '[F] 侧平举·收臂', '双臂收回体侧', '健身', 1, '🦅', 5,
    Math.PI/2, Math.PI/2, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    [..._shoulderRules(Math.PI/2, Math.PI/2, 0.3), ..._elbowRules(3.0, 3.0, 0.3)]),
  // 前平举：双臂前举 ↔ 双臂下垂
  _buildTemplate(67, '[F] 前平举·举起', '双臂向前举至水平', '健身', 1, '🎯', 5,
    -0.1, -Math.PI+0.1, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    [..._shoulderRules(-0.1, -Math.PI+0.1, 0.3), ..._elbowRules(3.0, 3.0, 0.3)]),
  _buildTemplate(68, '[F] 前平举·落下', '双臂放下至体侧', '健身', 1, '🎯', 5,
    Math.PI/2, Math.PI/2, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    [..._shoulderRules(Math.PI/2, Math.PI/2, 0.3), ..._elbowRules(3.0, 3.0, 0.3)]),
  // 深蹲：蹲下 ↔ 站起
  _buildTemplate(69, '[F] 深蹲·蹲下', '双手前伸保持平衡，屈膝蹲下', '健身', 2, '🦵', 6,
    -0.1, -Math.PI+0.1, 3.0, 3.0, Math.PI/2, Math.PI/2, 1.6, 1.6,
    [..._shoulderRules(-0.1, -Math.PI+0.1, 0.3), ..._elbowRules(3.0, 3.0, 0.3), ..._hipRules(Math.PI/2, Math.PI/2, 0.3), ..._kneeRules(1.6, 1.6, 0.4)]),
  _buildTemplate(70, '[F] 深蹲·站起', '站直，双手叉腰', '健身', 2, '🦵', 6,
    Math.PI/3, Math.PI-Math.PI/3, 2.5, 2.5, Math.PI/2, Math.PI/2, 2.9, 2.9,
    [..._shoulderRules(Math.PI/3, Math.PI-Math.PI/3, 0.3), ..._elbowRules(2.5, 2.5, 0.3), ..._hipRules(Math.PI/2, Math.PI/2, 0.3), ..._kneeRules(2.9, 2.9, 0.3)]),
  // 开合跳：开（V+开腿）↔ 合（并拢）
  _buildTemplate(71, '[F] 开合跳·展开', '双臂上V展开，双脚跳开', '健身', 2, '⭐', 5,
    -Math.PI/3, -Math.PI*2/3, 3.0, 3.0, Math.PI*0.35, Math.PI*0.65, 2.5, 2.5,
    [..._shoulderRules(-Math.PI/3, -Math.PI*2/3, 0.4), ..._elbowRules(3.0, 3.0, 0.3), ..._hipRules(Math.PI*0.35, Math.PI*0.65, 0.4), ..._kneeRules(2.5, 2.5, 0.4)]),
  _buildTemplate(72, '[F] 开合跳·合拢', '双臂贴体，双脚并拢', '健身', 2, '⭐', 5,
    Math.PI/2, Math.PI/2, 3.0, 3.0, Math.PI/2, Math.PI/2, 2.9, 2.9,
    [..._shoulderRules(Math.PI/2, Math.PI/2, 0.3), ..._elbowRules(3.0, 3.0, 0.3), ..._hipRules(Math.PI/2, Math.PI/2, 0.3), ..._kneeRules(2.9, 2.9, 0.3)]),
]
