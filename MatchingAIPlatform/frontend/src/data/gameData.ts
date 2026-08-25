import type { Theme, GameProgress } from '../types/game';

export const createThemes = (gameProgress: GameProgress): Theme[] => {
  const themes: Theme[] = [
  {
    id: 'addition_subtraction',
    name: '加减运算配对',
    description: '加法和减法运算表达式与结果的匹配挑战',
    icon: '➕➖',
    color: '#FF5722',
    totalLevels: 10,
    completedLevels: gameProgress['addition_subtraction']?.reduce((count, completed) => count + (completed ? 1 : 0), 0) || 0,
    levels: [
      {
        id: 1,
        title: '十以内加减',
        description: '十以内简单加减法运算',
        difficulty: '简单',
        unlocked: true,
        rules: ['同色且结果相同的表达式配对', '每对正确匹配得1分'],
        targetScore: 8,
        completed: gameProgress['addition_subtraction']?.[0] || false,
        mode: 'fixed'
      },
      {
        id: 2,
        title: '进位退位运算',
        description: '包含进位和退位的加减运算',
        difficulty: '简单',
        unlocked: gameProgress['addition_subtraction']?.[0] || false,
        rules: ['同色且结果相同的表达式配对', '包含进位退位', '每对正确匹配得1分'],
        targetScore: 10,
        completed: gameProgress['addition_subtraction']?.[1] || false,
        mode: 'fixed'
      },
      {
        id: 3,
        title: '两位数运算',
        description: '两位数加减法运算',
        difficulty: '中等',
        unlocked: gameProgress['addition_subtraction']?.[1] || false,
        rules: ['同色且结果相同的表达式配对', '每对正确匹配得2分'],
        targetScore: 12,
        completed: gameProgress['addition_subtraction']?.[2] || false,
        mode: 'fixed'
      },
      {
        id: 4,
        title: '混合运算',
        description: '加法和减法混合运算',
        difficulty: '中等',
        unlocked: gameProgress['addition_subtraction']?.[2] || false,
        rules: ['同色且结果相同的表达式配对', '每对正确匹配得2分'],
        targetScore: 15,
        completed: gameProgress['addition_subtraction']?.[3] || false,
        mode: 'fixed'
      },
      {
        id: 5,
        title: '快速加减',
        description: '60秒内完成加减运算挑战',
        difficulty: '困难',
        unlocked: gameProgress['addition_subtraction']?.[3] || false,
        rules: ['同色且结果相同的表达式配对', '60秒时间限制', '每对正确匹配得3分'],
        timeLimit: 60,
        targetScore: 18,
        completed: gameProgress['addition_subtraction']?.[4] || false,
        mode: 'fixed'
      },
      {
        id: 6,
        title: '复杂加减',
        description: '复杂加减法运算挑战',
        difficulty: '困难',
        unlocked: gameProgress['addition_subtraction']?.[4] || false,
        rules: ['同色且结果相同的表达式配对', '多重运算', '每对正确匹配得3分'],
        targetScore: 20,
        completed: gameProgress['addition_subtraction']?.[5] || false,
        mode: 'refresh'
      },
      {
        id: 7,
        title: '高级加减',
        description: '高级加减法运算配对挑战',
        difficulty: '专家',
        unlocked: gameProgress['addition_subtraction']?.[5] || false,
        rules: ['同色且结果相同的表达式配对', '每对正确匹配得4分'],
        targetScore: 22,
        completed: gameProgress['addition_subtraction']?.[6] || false,
        mode: 'refresh'
      },
      {
        id: 8,
        title: '极速加减',
        description: '45秒内完成高难度加减运算',
        difficulty: '专家',
        unlocked: gameProgress['addition_subtraction']?.[6] || false,
        rules: ['同色且结果相同的表达式配对', '45秒时间限制', '每对正确匹配得5分'],
        timeLimit: 45,
        targetScore: 25,
        completed: gameProgress['addition_subtraction']?.[7] || false,
        mode: 'refresh'
      },
      {
        id: 9,
        title: '终极加减',
        description: '加减运算终极挑战',
        difficulty: '专家',
        unlocked: gameProgress['addition_subtraction']?.[7] || false,
        rules: ['同色且结果相同的表达式配对', '每对正确匹配得5分'],
        targetScore: 28,
        completed: gameProgress['addition_subtraction']?.[8] || false,
        mode: 'refresh'
      },
      {
        id: 10,
        title: '加减宗师',
        description: '加减运算的最高境界',
        difficulty: '专家',
        unlocked: gameProgress['addition_subtraction']?.[8] || false,
        rules: ['同色且结果相同的表达式配对', '30秒时间限制', '每对正确匹配得10分'],
        timeLimit: 30,
        targetScore: 30,
        completed: gameProgress['addition_subtraction']?.[9] || false,
        mode: 'refresh'
      }
    ]
  },
  {
    id: 'multiplication_division',
    name: '乘除运算配对',
    description: '乘法和除法运算表达式与结果的匹配挑战',
    icon: '✖️➗',
    color: '#9C27B0',
    totalLevels: 10,
    completedLevels: gameProgress['multiplication_division']?.reduce((count, completed) => count + (completed ? 1 : 0), 0) || 0,
    levels: [
      {
        id: 1,
        title: '九九乘法',
        description: '九九乘法表基础运算',
        difficulty: '简单',
        unlocked: true,
        rules: ['同色且结果相同的表达式配对', '每对正确匹配得1分'],
        targetScore: 8,
        completed: gameProgress['multiplication_division']?.[0] || false,
        mode: 'fixed'
      },
      {
        id: 2,
        title: '简单除法',
        description: '简单除法运算',
        difficulty: '简单',
        unlocked: gameProgress['multiplication_division']?.[0] || false,
        rules: ['同色且结果相同的表达式配对', '每对正确匹配得1分'],
        targetScore: 10,
        completed: gameProgress['multiplication_division']?.[1] || false,
        mode: 'fixed'
      },
      {
        id: 3,
        title: '两位数乘法',
        description: '两位数乘法运算',
        difficulty: '中等',
        unlocked: gameProgress['multiplication_division']?.[1] || false,
        rules: ['同色且结果相同的表达式配对', '每对正确匹配得2分'],
        targetScore: 12,
        completed: gameProgress['multiplication_division']?.[2] || false,
        mode: 'fixed'
      },
      {
        id: 4,
        title: '复杂除法',
        description: '复杂除法运算',
        difficulty: '中等',
        unlocked: gameProgress['multiplication_division']?.[2] || false,
        rules: ['同色且结果相同的表达式配对', '每对正确匹配得2分'],
        targetScore: 15,
        completed: gameProgress['multiplication_division']?.[3] || false,
        mode: 'fixed'
      },
      {
        id: 5,
        title: '快速乘除',
        description: '60秒内完成乘除运算挑战',
        difficulty: '困难',
        unlocked: gameProgress['multiplication_division']?.[3] || false,
        rules: ['同色且结果相同的表达式配对', '60秒时间限制', '每对正确匹配得3分'],
        timeLimit: 60,
        targetScore: 18,
        completed: gameProgress['multiplication_division']?.[4] || false,
        mode: 'fixed'
      },
      {
        id: 6,
        title: '混合乘除',
        description: '乘法和除法混合运算',
        difficulty: '困难',
        unlocked: gameProgress['multiplication_division']?.[4] || false,
        rules: ['同色且结果相同的表达式配对', '每对正确匹配得3分'],
        targetScore: 20,
        completed: gameProgress['multiplication_division']?.[5] || false,
        mode: 'refresh'
      },
      {
        id: 7,
        title: '高级乘除',
        description: '高级乘除法运算配对挑战',
        difficulty: '专家',
        unlocked: gameProgress['multiplication_division']?.[5] || false,
        rules: ['同色且结果相同的表达式配对', '每对正确匹配得4分'],
        targetScore: 22,
        completed: gameProgress['multiplication_division']?.[6] || false,
        mode: 'refresh'
      },
      {
        id: 8,
        title: '极速乘除',
        description: '45秒内完成高难度乘除运算',
        difficulty: '专家',
        unlocked: gameProgress['multiplication_division']?.[6] || false,
        rules: ['同色且结果相同的表达式配对', '45秒时间限制', '每对正确匹配得5分'],
        timeLimit: 45,
        targetScore: 25,
        completed: gameProgress['multiplication_division']?.[7] || false,
        mode: 'refresh'
      },
      {
        id: 9,
        title: '终极乘除',
        description: '乘除运算终极挑战',
        difficulty: '专家',
        unlocked: gameProgress['multiplication_division']?.[7] || false,
        rules: ['同色且结果相同的表达式配对', '每对正确匹配得5分'],
        targetScore: 28,
        completed: gameProgress['multiplication_division']?.[8] || false,
        mode: 'refresh'
      },
      {
        id: 10,
        title: '乘除宗师',
        description: '乘除运算的最高境界',
        difficulty: '专家',
        unlocked: gameProgress['multiplication_division']?.[8] || false,
        rules: ['同色且结果相同的表达式配对', '30秒时间限制', '每对正确匹配得10分'],
        timeLimit: 30,
        targetScore: 30,
        completed: gameProgress['multiplication_division']?.[9] || false,
        mode: 'refresh'
      }
    ]
  },
  {
    id: 'mathematics',
    name: '数学运算配对',
    description: '数学运算表达式与结果的匹配挑战',
    icon: '🔢',
    color: '#4CAF50',
    totalLevels: 10,
    completedLevels: gameProgress['mathematics']?.reduce((count, completed) => count + (completed ? 1 : 0), 0) || 0,
    levels: [
      {
        id: 1,
        title: '基础加减法',
        description: '十以内简单加减法匹配',
        difficulty: '简单',
        unlocked: true,
        rules: ['同色且结果相同的表达式配对', '每对正确匹配得1分'],
        targetScore: 8,
        completed: gameProgress['mathematics']?.[0] || false,
        mode: 'fixed'
      },
      {
        id: 2,
        title: '进位退位运算',
        description: '包含进位和退位的运算',
        difficulty: '简单',
        unlocked: gameProgress['mathematics']?.[0] || false,
        rules: ['同色且结果相同的表达式配对', '包含进位退位运算', '每对正确匹配得1分'],
        targetScore: 10,
        completed: gameProgress['mathematics']?.[1] || false,
        mode: 'fixed'
      },
      {
        id: 3,
        title: '乘除法基础',
        description: '九九乘法表和简单除法匹配',
        difficulty: '中等',
        unlocked: gameProgress['mathematics']?.[1] || false,
        rules: ['同色且结果相同的表达式配对', '每对正确匹配得2分'],
        targetScore: 12,
        completed: gameProgress['mathematics']?.[2] || false,
        mode: 'fixed'
      },
      {
        id: 4,
        title: '四则运算',
        description: '加减乘除混合运算',
        difficulty: '中等',
        unlocked: gameProgress['mathematics']?.[2] || false,
        rules: ['同色且结果相同的表达式配对', '每对正确匹配得2分'],
        targetScore: 15,
        completed: gameProgress['mathematics']?.[3] || false,
        mode: 'fixed'
      },
      {
        id: 5,
        title: '快速运算',
        description: '60秒内完成运算挑战',
        difficulty: '困难',
        unlocked: gameProgress['mathematics']?.[3] || false,
        rules: ['同色且结果相同的表达式配对', '60秒时间限制', '每对正确匹配得3分'],
        timeLimit: 60,
        targetScore: 18,
        completed: gameProgress['mathematics']?.[4] || false,
        mode: 'fixed'
      },
      {
        id: 6,
        title: '复杂运算',
        description: '复杂数学运算挑战',
        difficulty: '困难',
        unlocked: gameProgress['mathematics']?.[4] || false,
        rules: ['同色且结果相同的表达式配对', '多重运算', '每对正确匹配得3分'],
        targetScore: 20,
        completed: gameProgress['mathematics']?.[5] || false,
        mode: 'refresh'
      },
      {
        id: 7,
        title: '高级运算',
        description: '高级数学运算配对挑战',
        difficulty: '专家',
        unlocked: gameProgress['mathematics']?.[5] || false,
        rules: ['同色且结果相同的表达式配对', '每对正确匹配得4分'],
        targetScore: 22,
        completed: gameProgress['mathematics']?.[6] || false,
        mode: 'refresh'
      },
      {
        id: 8,
        title: '极速运算',
        description: '45秒内完成高难度运算',
        difficulty: '专家',
        unlocked: gameProgress['mathematics']?.[6] || false,
        rules: ['同色且结果相同的表达式配对', '45秒时间限制', '每对正确匹配得5分'],
        timeLimit: 45,
        targetScore: 25,
        completed: gameProgress['mathematics']?.[7] || false,
        mode: 'refresh'
      },
      {
        id: 9,
        title: '终极运算',
        description: '数学运算终极挑战',
        difficulty: '专家',
        unlocked: gameProgress['mathematics']?.[7] || false,
        rules: ['同色且结果相同的表达式配对', '每对正确匹配得5分'],
        targetScore: 28,
        completed: gameProgress['mathematics']?.[8] || false,
        mode: 'refresh'
      },
      {
        id: 10,
        title: '运算宗师',
        description: '数学运算的最高境界',
        difficulty: '专家',
        unlocked: gameProgress['mathematics']?.[8] || false,
        rules: ['同色且结果相同的表达式配对', '30秒时间限制', '每对正确匹配得10分'],
        timeLimit: 30,
        targetScore: 30,
        completed: gameProgress['mathematics']?.[9] || false,
        mode: 'refresh'
      }
    ]
  },
  {
    id: 'chinese_english_words',
    name: '中英单词配对',
    description: '中英文单词互译匹配挑战，提升词汇记忆能力',
    icon: '🇨🇳🇺🇸',
    color: '#2196F3',
    totalLevels: 10,
    completedLevels: gameProgress['chinese_english_words']?.reduce((count, completed) => count + (completed ? 1 : 0), 0) || 0,
    levels: [
      {
        id: 1,
        title: '基础词汇',
        description: '日常生活常用单词配对',
        difficulty: '简单',
        unlocked: true,
        rules: ['将对应的中英文单词配对', '每对正确匹配得1分'],
        targetScore: 8,
        completed: gameProgress['chinese_english_words']?.[0] || false,
        mode: 'fixed'
      },
      {
        id: 2,
        title: '动物词汇',
        description: '各种动物的中英文名称',
        difficulty: '简单',
        unlocked: gameProgress['chinese_english_words']?.[0] || false,
        rules: ['动物名称中英文配对', '每对正确匹配得1分'],
        targetScore: 10,
        completed: gameProgress['chinese_english_words']?.[1] || false,
        mode: 'fixed'
      },
      {
        id: 3,
        title: '颜色词汇',
        description: '颜色相关的中英文词汇',
        difficulty: '中等',
        unlocked: gameProgress['chinese_english_words']?.[1] || false,
        rules: ['颜色词汇中英文配对', '每对正确匹配得2分'],
        targetScore: 12,
        completed: gameProgress['chinese_english_words']?.[2] || false,
        mode: 'fixed'
      },
      {
        id: 4,
        title: '食物词汇',
        description: '各种食物的中英文名称',
        difficulty: '中等',
        unlocked: gameProgress['chinese_english_words']?.[2] || false,
        rules: ['食物名称中英文配对', '每对正确匹配得2分'],
        targetScore: 15,
        completed: gameProgress['chinese_english_words']?.[3] || false,
        mode: 'fixed'
      },
      {
        id: 5,
        title: '快速配对',
        description: '60秒内完成词汇配对挑战',
        difficulty: '困难',
        unlocked: gameProgress['chinese_english_words']?.[3] || false,
        rules: ['中英文词汇配对', '60秒时间限制', '每对正确匹配得3分'],
        timeLimit: 60,
        targetScore: 18,
        completed: gameProgress['chinese_english_words']?.[4] || false,
        mode: 'fixed'
      },
      {
        id: 6,
        title: '科技词汇',
        description: '科技领域专业词汇配对',
        difficulty: '困难',
        unlocked: gameProgress['chinese_english_words']?.[4] || false,
        rules: ['科技词汇中英文配对', '每对正确匹配得3分'],
        targetScore: 20,
        completed: gameProgress['chinese_english_words']?.[5] || false,
        mode: 'refresh'
      },
      {
        id: 7,
        title: '抽象词汇',
        description: '抽象概念词汇配对挑战',
        difficulty: '专家',
        unlocked: gameProgress['chinese_english_words']?.[5] || false,
        rules: ['抽象词汇中英文配对', '每对正确匹配得4分'],
        targetScore: 22,
        completed: gameProgress['chinese_english_words']?.[6] || false,
        mode: 'refresh'
      },
      {
        id: 8,
        title: '极速配对',
        description: '45秒内完成高难度词汇配对',
        difficulty: '专家',
        unlocked: gameProgress['chinese_english_words']?.[6] || false,
        rules: ['快速中英文配对', '45秒时间限制', '每对正确匹配得5分'],
        timeLimit: 45,
        targetScore: 25,
        completed: gameProgress['chinese_english_words']?.[7] || false,
        mode: 'refresh'
      },
      {
        id: 9,
        title: '专业词汇',
        description: '各领域专业词汇配对',
        difficulty: '专家',
        unlocked: gameProgress['chinese_english_words']?.[7] || false,
        rules: ['专业词汇中英文配对', '每对正确匹配得5分'],
        targetScore: 28,
        completed: gameProgress['chinese_english_words']?.[8] || false,
        mode: 'refresh'
      },
      {
        id: 10,
        title: '词汇宗师',
        description: '中英词汇配对的最高境界',
        difficulty: '专家',
        unlocked: gameProgress['chinese_english_words']?.[8] || false,
        rules: ['终极词汇配对挑战', '30秒时间限制', '每对正确匹配得10分'],
        timeLimit: 30,
        targetScore: 30,
        completed: gameProgress['chinese_english_words']?.[9] || false,
        mode: 'refresh'
      }
    ]
  },
  {
    id: 'poetry_couplets',
    name: '古诗词上下句配对',
    description: '经典古诗词上下句匹配，感受诗词之美',
    icon: '📜',
    color: '#FF9800',
    totalLevels: 10,
    completedLevels: gameProgress['poetry_couplets']?.reduce((count, completed) => count + (completed ? 1 : 0), 0) || 0,
    levels: [
      {
        id: 1,
        title: '基础对仗',
        description: '简单诗句上下句配对',
        difficulty: '简单',
        unlocked: true,
        rules: ['将对应的诗句上下句配对', '每对正确匹配得1分'],
        targetScore: 8,
        completed: gameProgress['poetry_couplets']?.[0] || false,
        mode: 'fixed'
      },
      {
        id: 2,
        title: '唐诗名句',
        description: '唐代著名诗人的经典名句',
        difficulty: '简单',
        unlocked: gameProgress['poetry_couplets']?.[0] || false,
        rules: ['唐诗上下句配对', '每对正确匹配得1分'],
        targetScore: 10,
        completed: gameProgress['poetry_couplets']?.[1] || false,
        mode: 'fixed'
      },
      {
        id: 3,
        title: '宋词名句',
        description: '宋代词人的经典词句',
        difficulty: '中等',
        unlocked: gameProgress['poetry_couplets']?.[1] || false,
        rules: ['宋词上下句配对', '每对正确匹配得2分'],
        targetScore: 12,
        completed: gameProgress['poetry_couplets']?.[2] || false,
        mode: 'fixed'
      },
      {
        id: 4,
        title: '对仗工整',
        description: '注重对仗工整的诗句配对',
        difficulty: '中等',
        unlocked: gameProgress['poetry_couplets']?.[2] || false,
        rules: ['对仗句配对', '每对正确匹配得2分'],
        targetScore: 15,
        completed: gameProgress['poetry_couplets']?.[3] || false,
        mode: 'fixed'
      },
      {
        id: 5,
        title: '快速配对',
        description: '60秒内完成诗句配对挑战',
        difficulty: '困难',
        unlocked: gameProgress['poetry_couplets']?.[3] || false,
        rules: ['诗句上下句配对', '60秒时间限制', '每对正确匹配得3分'],
        timeLimit: 60,
        targetScore: 18,
        completed: gameProgress['poetry_couplets']?.[4] || false,
        mode: 'fixed'
      },
      {
        id: 6,
        title: '律诗绝句',
        description: '律诗和绝句的上下句配对',
        difficulty: '困难',
        unlocked: gameProgress['poetry_couplets']?.[4] || false,
        rules: ['律诗绝句配对', '每对正确匹配得3分'],
        targetScore: 20,
        completed: gameProgress['poetry_couplets']?.[5] || false,
        mode: 'refresh'
      },
      {
        id: 7,
        title: '诗词大家',
        description: '诗词大家的经典作品配对',
        difficulty: '专家',
        unlocked: gameProgress['poetry_couplets']?.[5] || false,
        rules: ['大家作品配对', '每对正确匹配得4分'],
        targetScore: 22,
        completed: gameProgress['poetry_couplets']?.[6] || false,
        mode: 'refresh'
      },
      {
        id: 8,
        title: '极速配对',
        description: '45秒内完成高难度诗句配对',
        difficulty: '专家',
        unlocked: gameProgress['poetry_couplets']?.[6] || false,
        rules: ['快速诗句配对', '45秒时间限制', '每对正确匹配得5分'],
        timeLimit: 45,
        targetScore: 25,
        completed: gameProgress['poetry_couplets']?.[7] || false,
        mode: 'refresh'
      },
      {
        id: 9,
        title: '诗词精华',
        description: '诗词精华句配对挑战',
        difficulty: '专家',
        unlocked: gameProgress['poetry_couplets']?.[7] || false,
        rules: ['精华句配对', '每对正确匹配得5分'],
        targetScore: 28,
        completed: gameProgress['poetry_couplets']?.[8] || false,
        mode: 'refresh'
      },
      {
        id: 10,
        title: '诗词宗师',
        description: '诗词配对的最高境界',
        difficulty: '专家',
        unlocked: gameProgress['poetry_couplets']?.[8] || false,
        rules: ['终极诗词配对', '30秒时间限制', '每对正确匹配得10分'],
        timeLimit: 30,
        targetScore: 30,
        completed: gameProgress['poetry_couplets']?.[9] || false,
        mode: 'refresh'
      }
    ]
  },
  {
    id: 'poetry_authors',
    name: '古诗词作者配对',
    description: '诗词作品与作者的匹配挑战',
    icon: '👤📖',
    color: '#9C27B0',
    totalLevels: 10,
    completedLevels: gameProgress['poetry_authors']?.reduce((count, completed) => count + (completed ? 1 : 0), 0) || 0,
    levels: [
      {
        id: 1,
        title: '基础作者',
        description: '著名诗人的代表作品配对',
        difficulty: '简单',
        unlocked: true,
        rules: ['作品与作者配对', '每对正确匹配得1分'],
        targetScore: 8,
        completed: gameProgress['poetry_authors']?.[0] || false,
        mode: 'fixed'
      },
      {
        id: 2,
        title: '唐代诗人',
        description: '唐代著名诗人的作品配对',
        difficulty: '简单',
        unlocked: gameProgress['poetry_authors']?.[0] || false,
        rules: ['唐诗与诗人配对', '每对正确匹配得1分'],
        targetScore: 10,
        completed: gameProgress['poetry_authors']?.[1] || false,
        mode: 'fixed'
      },
      {
        id: 3,
        title: '宋代词人',
        description: '宋代著名词人的作品配对',
        difficulty: '中等',
        unlocked: gameProgress['poetry_authors']?.[1] || false,
        rules: ['宋词与词人配对', '每对正确匹配得2分'],
        targetScore: 12,
        completed: gameProgress['poetry_authors']?.[2] || false,
        mode: 'fixed'
      },
      {
        id: 4,
        title: '诗词大家',
        description: '诗词大家的代表作配对',
        difficulty: '中等',
        unlocked: gameProgress['poetry_authors']?.[2] || false,
        rules: ['大家作品配对', '每对正确匹配得2分'],
        targetScore: 15,
        completed: gameProgress['poetry_authors']?.[3] || false,
        mode: 'fixed'
      },
      {
        id: 5,
        title: '快速配对',
        description: '60秒内完成作者配对挑战',
        difficulty: '困难',
        unlocked: gameProgress['poetry_authors']?.[3] || false,
        rules: ['作品作者配对', '60秒时间限制', '每对正确匹配得3分'],
        timeLimit: 60,
        targetScore: 18,
        completed: gameProgress['poetry_authors']?.[4] || false,
        mode: 'fixed'
      },
      {
        id: 6,
        title: '经典名篇',
        description: '经典名篇与作者的配对',
        difficulty: '困难',
        unlocked: gameProgress['poetry_authors']?.[4] || false,
        rules: ['名篇作者配对', '每对正确匹配得3分'],
        targetScore: 20,
        completed: gameProgress['poetry_authors']?.[5] || false,
        mode: 'refresh'
      },
      {
        id: 7,
        title: '文学巨匠',
        description: '文学巨匠的作品配对挑战',
        difficulty: '专家',
        unlocked: gameProgress['poetry_authors']?.[5] || false,
        rules: ['巨匠作品配对', '每对正确匹配得4分'],
        targetScore: 22,
        completed: gameProgress['poetry_authors']?.[6] || false,
        mode: 'refresh'
      },
      {
        id: 8,
        title: '极速配对',
        description: '45秒内完成高难度作者配对',
        difficulty: '专家',
        unlocked: gameProgress['poetry_authors']?.[6] || false,
        rules: ['快速作者配对', '45秒时间限制', '每对正确匹配得5分'],
        timeLimit: 45,
        targetScore: 25,
        completed: gameProgress['poetry_authors']?.[7] || false,
        mode: 'refresh'
      },
      {
        id: 9,
        title: '诗词经典',
        description: '诗词经典作品配对',
        difficulty: '专家',
        unlocked: gameProgress['poetry_authors']?.[7] || false,
        rules: ['经典作品配对', '每对正确匹配得5分'],
        targetScore: 28,
        completed: gameProgress['poetry_authors']?.[8] || false,
        mode: 'refresh'
      },
      {
        id: 10,
        title: '文学宗师',
        description: '文学配对的最高境界',
        difficulty: '专家',
        unlocked: gameProgress['poetry_authors']?.[8] || false,
        rules: ['终极文学配对', '30秒时间限制', '每对正确匹配得10分'],
        timeLimit: 30,
        targetScore: 30,
        completed: gameProgress['poetry_authors']?.[9] || false,
        mode: 'refresh'
      }
    ]
  },
  {
    id: 'lyrics_matching',
    name: '歌词配对',
    description: '经典歌曲歌词的上下句匹配挑战',
    icon: '🎵',
    color: '#E91E63',
    totalLevels: 10,
    completedLevels: gameProgress['lyrics_matching']?.reduce((count, completed) => count + (completed ? 1 : 0), 0) || 0,
    levels: [
      {
        id: 1,
        title: '流行金曲',
        description: '流行歌曲的歌词配对',
        difficulty: '简单',
        unlocked: true,
        rules: ['将对应的歌词上下句配对', '每对正确匹配得1分'],
        targetScore: 8,
        completed: gameProgress['lyrics_matching']?.[0] || false,
        mode: 'fixed'
      },
      {
        id: 2,
        title: '经典老歌',
        description: '经典老歌曲的歌词配对',
        difficulty: '简单',
        unlocked: gameProgress['lyrics_matching']?.[0] || false,
        rules: ['经典歌词配对', '每对正确匹配得1分'],
        targetScore: 10,
        completed: gameProgress['lyrics_matching']?.[1] || false,
        mode: 'fixed'
      },
      {
        id: 3,
        title: '华语金曲',
        description: '华语流行歌曲歌词配对',
        difficulty: '中等',
        unlocked: gameProgress['lyrics_matching']?.[1] || false,
        rules: ['华语歌词配对', '每对正确匹配得2分'],
        targetScore: 12,
        completed: gameProgress['lyrics_matching']?.[2] || false,
        mode: 'fixed'
      },
      {
        id: 4,
        title: '欧美经典',
        description: '欧美经典歌曲歌词配对',
        difficulty: '中等',
        unlocked: gameProgress['lyrics_matching']?.[2] || false,
        rules: ['欧美歌词配对', '每对正确匹配得2分'],
        targetScore: 15,
        completed: gameProgress['lyrics_matching']?.[3] || false,
        mode: 'fixed'
      },
      {
        id: 5,
        title: '快速配对',
        description: '60秒内完成歌词配对挑战',
        difficulty: '困难',
        unlocked: gameProgress['lyrics_matching']?.[3] || false,
        rules: ['歌词上下句配对', '60秒时间限制', '每对正确匹配得3分'],
        timeLimit: 60,
        targetScore: 18,
        completed: gameProgress['lyrics_matching']?.[4] || false,
        mode: 'fixed'
      },
      {
        id: 6,
        title: '网络热歌',
        description: '网络热门歌曲歌词配对',
        difficulty: '困难',
        unlocked: gameProgress['lyrics_matching']?.[4] || false,
        rules: ['热歌歌词配对', '每对正确匹配得3分'],
        targetScore: 20,
        completed: gameProgress['lyrics_matching']?.[5] || false,
        mode: 'refresh'
      },
      {
        id: 7,
        title: '音乐大师',
        description: '音乐大师的作品歌词配对',
        difficulty: '专家',
        unlocked: gameProgress['lyrics_matching']?.[5] || false,
        rules: ['大师作品配对', '每对正确匹配得4分'],
        targetScore: 22,
        completed: gameProgress['lyrics_matching']?.[6] || false,
        mode: 'refresh'
      },
      {
        id: 8,
        title: '极速配对',
        description: '45秒内完成高难度歌词配对',
        difficulty: '专家',
        unlocked: gameProgress['lyrics_matching']?.[6] || false,
        rules: ['快速歌词配对', '45秒时间限制', '每对正确匹配得5分'],
        timeLimit: 45,
        targetScore: 25,
        completed: gameProgress['lyrics_matching']?.[7] || false,
        mode: 'refresh'
      },
      {
        id: 9,
        title: '经典合集',
        description: '经典歌曲合集歌词配对',
        difficulty: '专家',
        unlocked: gameProgress['lyrics_matching']?.[7] || false,
        rules: ['经典合集配对', '每对正确匹配得5分'],
        targetScore: 28,
        completed: gameProgress['lyrics_matching']?.[8] || false,
        mode: 'refresh'
      },
      {
        id: 10,
        title: '音乐宗师',
        description: '歌词配对的最高境界',
        difficulty: '专家',
        unlocked: gameProgress['lyrics_matching']?.[8] || false,
        rules: ['终极歌词配对', '30秒时间限制', '每对正确匹配得10分'],
        timeLimit: 30,
        targetScore: 30,
        completed: gameProgress['lyrics_matching']?.[9] || false,
        mode: 'refresh'
      }
    ]
  }
];

  return themes;
};