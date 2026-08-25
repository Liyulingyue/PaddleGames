export interface LevelConfig {
  id: number | string
  name: string
  desc: string
  poseIds: (number | string)[]
  timeLimit?: number
  minMatch?: number
  isFinal?: boolean
  tag?: string
  icon?: string
  isAll?: boolean
}

export const LEVEL_CONFIGS: LevelConfig[] = [
  // ============ 新手上路 ============
  {
    id: 1,
    name: '[F] 第一关 · 初学乍练',
    desc: '基础热身动作，快速入门',
    poseIds: [1, 2, 22, 33],
    timeLimit: 45,
    minMatch: 60,
    tag: '新手上路',
  },
  {
    id: 2,
    name: '[F] 第二关 · 小试牛刀',
    desc: '单侧动作，打好基础',
    poseIds: [3, 4, 53, 54, 1],
    timeLimit: 60,
    minMatch: 65,
    tag: '新手上路',
  },
  // ============ 肩颈 ============
  {
    id: 3,
    name: '[F] 第三关 · 渐入佳境',
    desc: '肩部多角度练习',
    poseIds: [21, 51, 52, 23, 24, 2],
    timeLimit: 75,
    minMatch: 70,
    tag: '肩颈',
  },
  // ============ 瑜伽 ============
  {
    id: 4,
    name: '[F] 第四关 · 身轻如燕',
    desc: '瑜伽入门体式',
    poseIds: [6, 7, 8, 32, 34, 22],
    timeLimit: 90,
    minMatch: 70,
    tag: '瑜伽',
  },
  // ============ 八段锦 ============
  {
    id: 5,
    name: '[F] 第五关 · 八段锦·上',
    desc: '八段锦前四式，调理气血',
    poseIds: [11, 12, 13, 14],
    timeLimit: 60,
    minMatch: 65,
    tag: '八段锦',
  },
  {
    id: 6,
    name: '[F] 第六关 · 八段锦·下',
    desc: '八段锦后四式，强筋健骨',
    poseIds: [15, 16, 17, 18],
    timeLimit: 60,
    minMatch: 65,
    tag: '八段锦',
  },
  // ============ 进阶 ============
  {
    id: 7,
    name: '[F] 第七关 · 炉火纯青',
    desc: '综合挑战，考验反应',
    poseIds: [5, 2, 1, 22, 32, 53, 24],
    timeLimit: 90,
    minMatch: 75,
    tag: '进阶',
  },
  {
    id: 8,
    name: '[F] 第八关 · 登峰造极',
    desc: '终极挑战，全部动作',
    poseIds: [],
    timeLimit: 120,
    minMatch: 80,
    isFinal: true,
    tag: '进阶',
  },
  // ============ 破釜沉舟（大动作量挑战） ============
  {
    id: 9,
    name: '[F] 破釜沉舟 · 第一战 · 初探深渊',
    desc: '50 个动作连环挑战，考验耐力起点',
    poseIds: genChallengePoses(50),
    timeLimit: 250,
    minMatch: 70,
    tag: '破釜沉舟',
  },
  {
    id: 10,
    name: '[F] 破釜沉舟 · 第二战 · 渐入状态',
    desc: '80 个动作持续输出，节奏初显',
    poseIds: genChallengePoses(80),
    timeLimit: 400,
    minMatch: 70,
    tag: '破釜沉舟',
  },
  {
    id: 11,
    name: '[F] 破釜沉舟 · 第三战 · 稳扎稳打',
    desc: '120 个动作耐力对决，突破百关',
    poseIds: genChallengePoses(120),
    timeLimit: 600,
    minMatch: 72,
    tag: '破釜沉舟',
  },
  {
    id: 12,
    name: '[F] 破釜沉舟 · 第四战 · 突破极限',
    desc: '160 个动作高频切换，挑战反应',
    poseIds: genChallengePoses(160),
    timeLimit: 800,
    minMatch: 72,
    tag: '破釜沉舟',
  },
  {
    id: 13,
    name: '[F] 破釜沉舟 · 第五战 · 意志考验',
    desc: '200 个动作长途跋涉，意志为王',
    poseIds: genChallengePoses(200),
    timeLimit: 1000,
    minMatch: 75,
    tag: '破釜沉舟',
  },
  {
    id: 14,
    name: '[F] 破釜沉舟 · 第六战 · 咬紧牙关',
    desc: '250 个动作连环轰炸，咬牙坚持',
    poseIds: genChallengePoses(250),
    timeLimit: 1250,
    minMatch: 75,
    tag: '破釜沉舟',
  },
  {
    id: 15,
    name: '[F] 破釜沉舟 · 第七战 · 超越自我',
    desc: '300 个动作超长续航，超越过往',
    poseIds: genChallengePoses(300),
    timeLimit: 1500,
    minMatch: 78,
    tag: '破釜沉舟',
  },
  {
    id: 16,
    name: '[F] 破釜沉舟 · 第八战 · 精疲力竭',
    desc: '350 个动作极限拉扯，逼近疲惫',
    poseIds: genChallengePoses(350),
    timeLimit: 1750,
    minMatch: 78,
    tag: '破釜沉舟',
  },
  {
    id: 17,
    name: '[F] 破釜沉舟 · 第九战 · 巅峰对决',
    desc: '400 个动作巅峰之战，只为登顶',
    poseIds: genChallengePoses(400),
    timeLimit: 2000,
    minMatch: 80,
    tag: '破釜沉舟',
  },
  {
    id: 18,
    name: '[F] 破釜沉舟 · 终极炼狱',
    desc: '500 个动作终极炼狱，唯有破釜沉舟',
    poseIds: genChallengePoses(500),
    timeLimit: 2500,
    minMatch: 80,
    tag: '破釜沉舟',
  },
]

export const RHYTHM_LEVEL_CONFIGS: LevelConfig[] = [
  {
    id: 'baduanjin-full',
    name: '[F] 八段锦 · 全套',
    desc: '经典八式，调理全身气血，强筋健骨',
    poseIds: [11, 12, 13, 14, 15, 16, 17, 18],
    tag: '八段锦',
    icon: '🧧',
  },
  {
    id: 'baduanjin-upper',
    name: '[F] 八段锦 · 上半段',
    desc: '前四式，侧重上半身与肩颈调理',
    poseIds: [11, 12, 13, 14],
    tag: '八段锦',
    icon: '🌿',
  },
  {
    id: 'baduanjin-lower',
    name: '[F] 八段锦 · 下半段',
    desc: '后四式，侧重腰背与下肢锻炼',
    poseIds: [15, 16, 17, 18],
    tag: '八段锦',
    icon: '🧗',
  },
  {
    id: 'morning-wake',
    name: '[F] 晨间唤醒',
    desc: '晨起十分钟，唤醒身体，开启活力一天',
    poseIds: [31, 33, 22, 34, 1],
    tag: '晨间',
    icon: '🌅',
  },
  {
    id: 'office-relax',
    name: '[F] 办公室减压',
    desc: '坐着也能练的肩颈放松操，缓解久坐疲劳',
    poseIds: [41, 42, 43, 44, 24],
    tag: '办公室',
    icon: '🪑',
  },
  {
    id: 'neck-shoulder',
    name: '[F] 肩颈舒缓',
    desc: '全方位肩颈拉伸，改善圆肩驼背',
    poseIds: [21, 22, 23, 24, 33],
    tag: '肩颈',
    icon: '💆',
  },
  {
    id: 'arm-sculpt',
    name: '[F] 手臂塑形',
    desc: '手臂全方位训练，紧致拜拜肉杀手',
    poseIds: [51, 52, 53, 54, 22, 2],
    tag: '手臂',
    icon: '💪',
  },
  {
    id: 'yoga-flow',
    name: '[F] 瑜伽入门',
    desc: '基础瑜伽体式，提升柔韧性',
    poseIds: [6, 7, 8, 22, 2],
    tag: '瑜伽',
    icon: '🧘',
  },
  {
    id: 'warmup',
    name: '[F] 热身组合',
    desc: '快速活动肩颈，唤醒身体',
    poseIds: [1, 2, 33, 22],
    tag: '热身',
    icon: '🔥',
  },
  {
    id: 'full-body',
    name: '[F] 全身综合',
    desc: '覆盖所有部位的综合训练',
    poseIds: [],
    tag: '综合',
    icon: '🌟',
    isAll: true,
  },
  // ============ 健身课程 ============
  {
    id: 'fitness-quick',
    name: '[F] 快速燃脂',
    desc: '3分钟快速燃脂：推举+开合跳+侧平举，高效燃脂',
    poseIds: fitnessReps([[61,62],[71,72],[65,66]], [10,10,10]),
    tag: '健身',
    icon: '🔥',
  },
  {
    id: 'fitness-sculpt',
    name: '[F] 全身塑形',
    desc: '8分钟全身塑形：推举+弯举+侧平举+前平举+深蹲，五大动作全面覆盖',
    poseIds: fitnessReps([[61,62],[63,64],[65,66],[67,68],[69,70],[61,62]], [15,15,15,15,15,15]),
    tag: '健身',
    icon: '💪',
  },
  {
    id: 'fitness-deep',
    name: '[F] 深度训练',
    desc: '20分钟深度训练：多组动作交替循环，持续燃脂塑形',
    poseIds: fitnessReps(
      [[61,62],[63,64],[65,66],[67,68],[69,70],[71,72],
       [61,62],[63,64],[65,66],[69,70],[71,72],
       [61,62],[63,64]],
      [20,20,20,20,20,20,20,20,20,20,20,20,20]
    ),
    tag: '健身',
    icon: '🏋️',
  },
  {
    id: 'fitness-upper',
    name: '[F] 上肢强化',
    desc: '5分钟上肢专项：推举+弯举+侧平举+前平举，打造坚实上肢',
    poseIds: fitnessReps([[61,62],[63,64],[65,66],[67,68]], [12,12,12,12]),
    tag: '健身',
    icon: '💪',
  },
  {
    id: 'fitness-hiit',
    name: '[F] 间歇燃脂',
    desc: '6分钟HIIT：开合跳+深蹲+推举+开合跳，高强度间歇燃脂',
    poseIds: fitnessReps([[71,72],[69,70],[61,62],[71,72]], [12,12,12,12]),
    tag: '健身',
    icon: '⚡',
  },
  {
    id: 'fitness-office',
    name: '[F] 办公微运动',
    desc: '3分钟轻度运动：侧平举+弯举+前平举，久坐间隙活动筋骨',
    poseIds: fitnessReps([[65,66],[63,64],[67,68]], [8,8,8]),
    tag: '健身',
    icon: '🪑',
  },
  {
    id: 'fitness-arm',
    name: '[F] 手臂轰炸',
    desc: '10分钟手臂专训：弯举+侧平举+前平举+推举双循环，紧致拜拜肉',
    poseIds: fitnessReps(
      [[63,64],[65,66],[67,68],[61,62],[63,64],[65,66]],
      [15,15,15,15,15,15]
    ),
    tag: '健身',
    icon: '💪',
  },
  {
    id: 'fitness-leg',
    name: '[F] 腿臀特训',
    desc: '8分钟下肢专项：深蹲+开合跳交替循环，紧实臀腿线条',
    poseIds: fitnessReps([[69,70],[71,72],[69,70],[71,72]], [15,15,15,10]),
    tag: '健身',
    icon: '🦵',
  },
]

export function resolveLevelPoses(level: LevelConfig, templates: Array<{ id: number | string; difficulty: number }>) {
  if (level.isFinal) {
    return templates.filter((t) => t.difficulty >= 2).slice(0, 12).map((t) => t.id)
  }
  return level.poseIds
}

export function resolveRhythmPoses(level: LevelConfig, templates: Array<{ id: number | string; category: string }>) {
  if (level.isAll) {
    return templates.filter((t) => t.category !== '进阶').map((t) => t.id)
  }
  return level.poseIds
}

/**
 * 破釜沉舟关卡动作生成：从全身动作池循环填充到指定数量（动作可重复）
 */
function genChallengePoses(count: number): number[] {
  const pool = [1,2,3,4,5,6,7,8,11,12,13,14,15,16,17,18,21,22,23,24,31,32,33,34,41,42,43,44,51,52,53,54,61,62,63,64,65,66,67,68,69,70,71,72]
  const result: number[] = []
  for (let i = 0; i < count; i++) {
    result.push(pool[i % pool.length])
  }
  return result
}

/**
 * 健身动作辅助：将多个动作对交替展开为 poseIds 序列
 * 如 reps([[61,62], [63,64]], [10, 10]) => [61,62,61,62...(×10), 63,64,63,64...(×10)]
 */
function fitnessReps(pairs: [number, number][], reps: number[]): number[] {
  const result: number[] = []
  for (let i = 0; i < pairs.length; i++) {
    const [a, b] = pairs[i]
    const n = reps[i] ?? reps[0]
    for (let r = 0; r < n; r++) {
      result.push(a, b)
    }
  }
  return result
}
