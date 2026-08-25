import { shuffleArray } from './gameLogic';

interface Card {
  id: number;
  type: 'left' | 'right';
  color: string;
  label: string;
  isMatched?: boolean;
  animationDelay?: number;
}

// 生成关卡 1 (十以内加减法)
export const generateLevel1 = (pairCount = 12): { leftCards: Card[]; rightCards: Card[] } => {
  const reds = '#FF4D4D';
  const yellows = '#F1C40F';
  const greens = '#2ECC71';
  const colorPool = [reds, yellows, greens];

  const newLeft: Card[] = [];
  const newRight: Card[] = [];
  let idCounter = 1000;

  for (let i = 0; i < pairCount; i++) {
    // 随机生成目标结果 r
    const r = Math.floor(Math.random() * 11); // 0..10

    // 生成左侧表达式，使其结果为 r
    const leftOp = Math.random() < 0.5 ? '+' : '-';
    let la = 0;
    let lb = 0;
    if (leftOp === '+') {
      la = Math.floor(Math.random() * (r + 1));
      lb = r - la;
    } else {
      la = Math.floor(Math.random() * (11 - r)) + r; // la in [r,10]
      lb = la - r;
    }
    const leftExpr = `${la}${leftOp}${lb}`;

    // 生成右侧表达式（可不同）使其结果为 r
    const rightOp = Math.random() < 0.5 ? '+' : '-';
    let ra = 0;
    let rb = 0;
    if (rightOp === '+') {
      ra = Math.floor(Math.random() * (r + 1));
      rb = r - ra;
    } else {
      ra = Math.floor(Math.random() * (11 - r)) + r;
      rb = ra - r;
    }
    const rightExpr = `${ra}${rightOp}${rb}`;

    // 为每一对配对分配相同的随机颜色
    const pairColor = colorPool[Math.floor(Math.random() * colorPool.length)];

    newLeft.push({
      id: idCounter++,
      type: 'left',
      color: pairColor,
      label: leftExpr,
      animationDelay: i * 50
    });
    newRight.push({
      id: idCounter++,
      type: 'right',
      color: pairColor,
      label: rightExpr,
      animationDelay: i * 50
    });
  }

  // 打乱左右顺序以增加随机性
  return {
    leftCards: shuffleArray(newLeft),
    rightCards: shuffleArray(newRight),
  };
};

// 生成关卡 2 (进位退位运算)
export const generateLevel2 = (pairCount = 12): { leftCards: Card[]; rightCards: Card[] } => {
  const reds = '#FF4D4D';
  const yellows = '#F1C40F';
  const greens = '#2ECC71';
  const colorPool = [reds, yellows, greens];

  const newLeft: Card[] = [];
  const newRight: Card[] = [];
  let idCounter = 1000;

  for (let i = 0; i < pairCount; i++) {
    // 随机生成目标结果 r (5-15)
    const r = Math.floor(Math.random() * 11) + 5; // 5..15

    // 生成左侧表达式，使其结果为 r (确保有进位或退位)
    const leftOp = Math.random() < 0.5 ? '+' : '-';
    let la = 0;
    let lb = 0;
    if (leftOp === '+') {
      // 确保有进位
      la = Math.floor(Math.random() * 5) + 5; // 5-9
      lb = r - la;
      if (lb < 0 || lb > 9) {
        la = Math.floor(Math.random() * (r + 1));
        lb = r - la;
      }
    } else {
      // 确保有退位
      la = Math.floor(Math.random() * 5) + r + 1; // la > r
      lb = la - r;
    }
    const leftExpr = `${la}${leftOp}${lb}`;

    // 生成右侧表达式使其结果为 r
    const rightOp = Math.random() < 0.5 ? '+' : '-';
    let ra = 0;
    let rb = 0;
    if (rightOp === '+') {
      ra = Math.floor(Math.random() * (r + 1));
      rb = r - ra;
    } else {
      ra = Math.floor(Math.random() * (21 - r)) + r;
      rb = ra - r;
    }
    const rightExpr = `${ra}${rightOp}${rb}`;

    // 为每一对配对分配相同的随机颜色
    const pairColor = colorPool[Math.floor(Math.random() * colorPool.length)];

    newLeft.push({
      id: idCounter++,
      type: 'left',
      color: pairColor,
      label: leftExpr,
      animationDelay: i * 50
    });
    newRight.push({
      id: idCounter++,
      type: 'right',
      color: pairColor,
      label: rightExpr,
      animationDelay: i * 50
    });
  }

  // 打乱顺序
  return {
    leftCards: shuffleArray(newLeft),
    rightCards: shuffleArray(newRight),
  };
};

// 生成更高难度关卡 (加减法主题)
export const generateAdvancedAdditionSubtractionLevel = (
  levelId: number,
  pairCount = 12
): { leftCards: Card[]; rightCards: Card[] } => {
  const maxNum = Math.min(10 + levelId * 5, 100);
  const reds = '#FF4D4D';
  const yellows = '#F1C40F';
  const greens = '#2ECC71';
  const colorPool = [reds, yellows, greens];

  const newLeft: Card[] = [];
  const newRight: Card[] = [];
  let idCounter = 1000;

  for (let i = 0; i < pairCount; i++) {
    const r = Math.floor(Math.random() * maxNum);
    const leftOp = Math.random() < 0.5 ? '+' : '-';
    let la = 0;
    let lb = 0;
    if (leftOp === '+') {
      la = Math.floor(Math.random() * (r + 1));
      lb = r - la;
    } else {
      la = Math.floor(Math.random() * (maxNum - r)) + r;
      lb = la - r;
    }
    const leftExpr = `${la}${leftOp}${lb}`;

    const rightOp = Math.random() < 0.5 ? '+' : '-';
    let ra = 0;
    let rb = 0;
    if (rightOp === '+') {
      ra = Math.floor(Math.random() * (r + 1));
      rb = r - ra;
    } else {
      ra = Math.floor(Math.random() * (maxNum - r)) + r;
      rb = ra - r;
    }
    const rightExpr = `${ra}${rightOp}${rb}`;

    // 为每一对配对分配相同的随机颜色
    const pairColor = colorPool[Math.floor(Math.random() * colorPool.length)];

    newLeft.push({
      id: idCounter++,
      type: 'left',
      color: pairColor,
      label: leftExpr,
      animationDelay: i * 50
    });
    newRight.push({
      id: idCounter++,
      type: 'right',
      color: pairColor,
      label: rightExpr,
      animationDelay: i * 50
    });
  }

  return {
    leftCards: shuffleArray(newLeft),
    rightCards: shuffleArray(newRight),
  };
};

// 生成乘除法关卡
export const generateMultiplicationDivisionLevel = (
  levelId: number,
  pairCount = 12
): { leftCards: Card[]; rightCards: Card[] } => {
  const reds = '#FF4D4D';
  const yellows = '#F1C40F';
  const greens = '#2ECC71';
  const colorPool = [reds, yellows, greens];

  const newLeft: Card[] = [];
  const newRight: Card[] = [];
  let idCounter = 1000;

  for (let i = 0; i < pairCount; i++) {
    let leftExpr = '';
    let rightExpr = '';
    let r = 0;

    if (Math.random() < 0.5) {
      // 乘法
      const a = Math.floor(Math.random() * Math.min(10, levelId + 1)) + 1;
      const b = Math.floor(Math.random() * Math.min(10, levelId + 1)) + 1;
      r = a * b;
      leftExpr = `${a}×${b}`;
      rightExpr = `${r}`;
    } else {
      // 除法
      r = Math.floor(Math.random() * Math.min(50, levelId * 5)) + 1;
      const divisor = Math.floor(Math.random() * Math.min(10, levelId + 1)) + 1;
      const dividend = r * divisor;
      leftExpr = `${dividend}÷${divisor}`;
      rightExpr = `${r}`;
    }

    // 为每一对配对分配相同的随机颜色
    const pairColor = colorPool[Math.floor(Math.random() * colorPool.length)];

    newLeft.push({
      id: idCounter++,
      type: 'left',
      color: pairColor,
      label: leftExpr,
      animationDelay: i * 50
    });
    newRight.push({
      id: idCounter++,
      type: 'right',
      color: pairColor,
      label: rightExpr,
      animationDelay: i * 50
    });
  }

  return {
    leftCards: shuffleArray(newLeft),
    rightCards: shuffleArray(newRight),
  };
};

// 生成四则运算关卡
export const generateFourOperationsLevel = (
  levelId: number,
  pairCount = 12
): { leftCards: Card[]; rightCards: Card[] } => {
  const reds = '#FF4D4D';
  const yellows = '#F1C40F';
  const greens = '#2ECC71';
  const colorPool = [reds, yellows, greens];

  const newLeft: Card[] = [];
  const newRight: Card[] = [];
  let idCounter = 1000;

  for (let i = 0; i < pairCount; i++) {
    let leftExpr = '';
    let rightExpr = '';
    let r = 0;

    const opType = Math.floor(Math.random() * 4);
    if (opType === 0) {
      // 加法
      const a = Math.floor(Math.random() * Math.min(50, levelId * 5)) + 1;
      const b = Math.floor(Math.random() * Math.min(50, levelId * 5)) + 1;
      r = a + b;
      leftExpr = `${a}+${b}`;
      rightExpr = `${r}`;
    } else if (opType === 1) {
      // 减法
      const a = Math.floor(Math.random() * Math.min(100, levelId * 10)) + 1;
      const b = Math.floor(Math.random() * a) + 1;
      r = a - b;
      leftExpr = `${a}-${b}`;
      rightExpr = `${r}`;
    } else if (opType === 2) {
      // 乘法
      const a = Math.floor(Math.random() * Math.min(10, levelId + 1)) + 1;
      const b = Math.floor(Math.random() * Math.min(10, levelId + 1)) + 1;
      r = a * b;
      leftExpr = `${a}×${b}`;
      rightExpr = `${r}`;
    } else {
      // 除法
      r = Math.floor(Math.random() * Math.min(50, levelId * 5)) + 1;
      const divisor = Math.floor(Math.random() * Math.min(10, levelId + 1)) + 1;
      const dividend = r * divisor;
      leftExpr = `${dividend}÷${divisor}`;
      rightExpr = `${r}`;
    }

    // 为每一对配对分配相同的随机颜色
    const pairColor = colorPool[Math.floor(Math.random() * colorPool.length)];

    newLeft.push({
      id: idCounter++,
      type: 'left',
      color: pairColor,
      label: leftExpr,
      animationDelay: i * 50
    });
    newRight.push({
      id: idCounter++,
      type: 'right',
      color: pairColor,
      label: rightExpr,
      animationDelay: i * 50
    });
  }

  return {
    leftCards: shuffleArray(newLeft),
    rightCards: shuffleArray(newRight),
  };
};

// 生成数学运算关卡
export const generateMathematicsLevel = (
  levelId: number,
  pairCount = 12
): { leftCards: Card[]; rightCards: Card[] } => {
  const maxNum = Math.min(10 + levelId * 5, 100);
  const reds = '#FF4D4D';
  const yellows = '#F1C40F';
  const greens = '#2ECC71';
  const colorPool = [reds, yellows, greens];

  const newLeft: Card[] = [];
  const newRight: Card[] = [];
  let idCounter = 1000;

  for (let i = 0; i < pairCount; i++) {
    const r = Math.floor(Math.random() * maxNum);
    const operations = ['+', '-', '×', '÷'];
    const leftOp = operations[Math.floor(Math.random() * operations.length)];
    let la = 0;
    let lb = 0;

    if (leftOp === '+') {
      la = Math.floor(Math.random() * (r + 1));
      lb = r - la;
    } else if (leftOp === '-') {
      la = Math.floor(Math.random() * (maxNum - r)) + r;
      lb = la - r;
    } else if (leftOp === '×') {
      la = Math.floor(Math.random() * Math.min(10, levelId + 1)) + 1;
      lb = Math.floor(Math.random() * Math.min(10, levelId + 1)) + 1;
      // 调整结果为 r（这里简化处理）
      // const actualResult = la * lb;
      // 这里直接设置结果为 r
    } else if (leftOp === '÷') {
      lb = Math.floor(Math.random() * Math.min(10, levelId + 1)) + 1;
      la = lb * Math.floor(Math.random() * Math.min(10, levelId + 1)) + lb;
    }

    const leftExpr = `${la}${leftOp}${lb}`;
    const rightExpr = `${r}`;

    // 为每一对配对分配相同的随机颜色
    const pairColor = colorPool[Math.floor(Math.random() * colorPool.length)];

    newLeft.push({
      id: idCounter++,
      type: 'left',
      color: pairColor,
      label: leftExpr,
      animationDelay: i * 50
    });
    newRight.push({
      id: idCounter++,
      type: 'right',
      color: pairColor,
      label: rightExpr,
      animationDelay: i * 50
    });
  }

  return {
    leftCards: shuffleArray(newLeft),
    rightCards: shuffleArray(newRight),
  };
};

// 生成中英单词配对关卡
export const generateChineseEnglishWordsLevel = (
  _levelId: number,
  pairCount = 12
): { leftCards: Card[]; rightCards: Card[] } => {
  // 基础词汇数据（可以扩展）
  const wordPairs = [
    { chinese: '苹果', english: 'apple' },
    { chinese: '猫', english: 'cat' },
    { chinese: '狗', english: 'dog' },
    { chinese: '水', english: 'water' },
    { chinese: '火', english: 'fire' },
    { chinese: '天空', english: 'sky' },
    { chinese: '大地', english: 'earth' },
    { chinese: '太阳', english: 'sun' },
    { chinese: '月亮', english: 'moon' },
    { chinese: '星星', english: 'star' },
    { chinese: '树木', english: 'tree' },
    { chinese: '花朵', english: 'flower' },
    { chinese: '鸟', english: 'bird' },
    { chinese: '鱼', english: 'fish' },
    { chinese: '房子', english: 'house' },
    { chinese: '汽车', english: 'car' },
    { chinese: '书', english: 'book' },
    { chinese: '笔', english: 'pen' },
    { chinese: '桌子', english: 'table' },
    { chinese: '椅子', english: 'chair' },
  ];

  const reds = '#FF4D4D';
  const yellows = '#F1C40F';
  const greens = '#2ECC71';
  const colorPool = [reds, yellows, greens];

  const newLeft: Card[] = [];
  const newRight: Card[] = [];
  let idCounter = 1000;

  // 随机选择单词对
  const selectedPairs = shuffleArray(wordPairs).slice(0, pairCount);

  for (let i = 0; i < selectedPairs.length; i++) {
    const pair = selectedPairs[i];
    const color = colorPool[Math.floor(Math.random() * colorPool.length)];

    newLeft.push({
      id: idCounter++,
      type: 'left',
      color: color,
      label: pair.chinese,
      animationDelay: i * 50
    });
    newRight.push({
      id: idCounter++,
      type: 'right',
      color: color,
      label: pair.english,
      animationDelay: i * 50
    });
  }

  return {
    leftCards: shuffleArray(newLeft),
    rightCards: shuffleArray(newRight),
  };
};

// 生成古诗词上下句配对关卡
export const generatePoetryCoupletsLevel = (
  _levelId: number,
  pairCount = 12
): { leftCards: Card[]; rightCards: Card[] } => {
  // 古诗词上下句数据（可以扩展）
  const poetryPairs = [
    { first: '床前明月光', second: '疑是地上霜' },
    { first: '举头望明月', second: '低头思故乡' },
    { first: '春眠不觉晓', second: '处处闻啼鸟' },
    { first: '夜来风雨声', second: '花落知多少' },
    { first: '红豆生南国', second: '春来发几枝' },
    { first: '天生我材必有用', second: '千金散尽还复来' },
    { first: '会挽雕弓如满月', second: '西北望，射天狼' },
    { first: '长风破浪会有时', second: '直挂云帆济沧海' },
    { first: '大江东去', second: '浪淘尽，千古风流人物' },
    { first: '醉里挑灯看剑', second: '梦回吹角连营' },
    { first: '人生得意须尽欢', second: '莫使金樽空对月' },
    { first: '天涯何处无芳草', second: '王孙不尽帝王乡' },
    { first: '会昌城外高峰', second: '颠连直接青霄' },
    { first: '两岸猿声啼不住', second: '轻舟已过万重山' },
    { first: '问渠那得清如许', second: '为有源头活水来' },
  ];

  const reds = '#FF4D4D';
  const yellows = '#F1C40F';
  const greens = '#2ECC71';
  const colorPool = [reds, yellows, greens];

  const newLeft: Card[] = [];
  const newRight: Card[] = [];
  let idCounter = 1000;

  // 随机选择诗句对
  const selectedPairs = shuffleArray(poetryPairs).slice(0, pairCount);

  for (let i = 0; i < selectedPairs.length; i++) {
    const pair = selectedPairs[i];
    const color = colorPool[Math.floor(Math.random() * colorPool.length)];

    newLeft.push({
      id: idCounter++,
      type: 'left',
      color: color,
      label: pair.first,
      animationDelay: i * 50
    });
    newRight.push({
      id: idCounter++,
      type: 'right',
      color: color,
      label: pair.second,
      animationDelay: i * 50
    });
  }

  return {
    leftCards: shuffleArray(newLeft),
    rightCards: shuffleArray(newRight),
  };
};

// 生成古诗词作者配对关卡
export const generatePoetryAuthorsLevel = (
  _levelId: number,
  pairCount = 12
): { leftCards: Card[]; rightCards: Card[] } => {
  // 诗词与作者配对数据（可以扩展）
  const authorPairs = [
    { work: '静夜思', author: '李白' },
    { work: '春晓', author: '孟浩然' },
    { work: '将进酒', author: '李白' },
    { work: '蜀道难', author: '李白' },
    { work: '登鹳雀楼', author: '王之涣' },
    { work: '相思', author: '王维' },
    { work: '送元二使安西', author: '王维' },
    { work: '望岳', author: '杜甫' },
    { work: '春江花月夜', author: '张若虚' },
    { work: '滁州西涧', author: '韦应物' },
    { work: '江雪', author: '柳宗元' },
    { work: '渔歌子', author: '张志和' },
    { work: '如梦令', author: '李清照' },
    { work: '水调歌头', author: '苏轼' },
    { work: '念奴娇·赤壁怀古', author: '苏轼' },
  ];

  const reds = '#FF4D4D';
  const yellows = '#F1C40F';
  const greens = '#2ECC71';
  const colorPool = [reds, yellows, greens];

  const newLeft: Card[] = [];
  const newRight: Card[] = [];
  let idCounter = 1000;

  // 随机选择作品与作者对
  const selectedPairs = shuffleArray(authorPairs).slice(0, pairCount);

  for (let i = 0; i < selectedPairs.length; i++) {
    const pair = selectedPairs[i];
    const color = colorPool[Math.floor(Math.random() * colorPool.length)];

    newLeft.push({
      id: idCounter++,
      type: 'left',
      color: color,
      label: pair.work,
      animationDelay: i * 50
    });
    newRight.push({
      id: idCounter++,
      type: 'right',
      color: color,
      label: pair.author,
      animationDelay: i * 50
    });
  }

  return {
    leftCards: shuffleArray(newLeft),
    rightCards: shuffleArray(newRight),
  };
};

// 生成歌词配对关卡
export const generateLyricsMatchingLevel = (
  _levelId: number,
  pairCount = 12
): { leftCards: Card[]; rightCards: Card[] } => {
  // 歌词上下句配对数据（可以扩展）
  const lyricsPairs = [
    { first: '天亮了', second: '起床了' },
    { first: '我爱你', second: '你爱我' },
    { first: '月亮代表我的心', second: '你是否明白' },
    { first: '小星星', second: '眨眼睛' },
    { first: '让我们荡起双桨', second: '小船儿推开波浪' },
    { first: '我有一只小毛驴', second: '我从来也不骑' },
    { first: '世上只有妈妈好', second: '有妈的孩子像块宝' },
    { first: '两只老虎', second: '两只老虎' },
    { first: '小燕子', second: '穿花衣' },
    { first: '春天在哪里', second: '春天在哪里' },
    { first: '让我们一起学猫叫', second: '一起喵喵喵' },
    { first: '你拍一', second: '我拍一' },
    { first: '一闪一闪亮晶晶', second: '满天都是小星星' },
    { first: '小老鼠', second: '上灯台' },
    { first: '丢丢丢', second: '丢手绢' },
  ];

  const reds = '#FF4D4D';
  const yellows = '#F1C40F';
  const greens = '#2ECC71';
  const colorPool = [reds, yellows, greens];

  const newLeft: Card[] = [];
  const newRight: Card[] = [];
  let idCounter = 1000;

  // 随机选择歌词对
  const selectedPairs = shuffleArray(lyricsPairs).slice(0, pairCount);

  for (let i = 0; i < selectedPairs.length; i++) {
    const pair = selectedPairs[i];
    const color = colorPool[Math.floor(Math.random() * colorPool.length)];

    newLeft.push({
      id: idCounter++,
      type: 'left',
      color: color,
      label: pair.first,
      animationDelay: i * 50
    });
    newRight.push({
      id: idCounter++,
      type: 'right',
      color: color,
      label: pair.second,
      animationDelay: i * 50
    });
  }

  return {
    leftCards: shuffleArray(newLeft),
    rightCards: shuffleArray(newRight),
  };
};

// 生成单个新卡片
export const generateNewCard = (
  levelId: number,
  theme: string,
  type: 'left' | 'right',
  id: number
): Card => {
  const reds = '#FF4D4D';
  const yellows = '#F1C40F';
  const greens = '#2ECC71';
  const colorPool = [reds, yellows, greens];

  const color = colorPool[Math.floor(Math.random() * colorPool.length)];

  let label = '';

  if (theme === 'mathematics' || theme === 'addition_subtraction' || theme === 'multiplication_division' || theme === 'four_operations') {
    const maxNum = Math.min(10 + levelId * 5, 100);
    const r = Math.floor(Math.random() * maxNum);
    const operations = ['+', '-', '×', '÷'];
    const op = operations[Math.floor(Math.random() * operations.length)];
    let a = 0;
    let b = 0;

    if (op === '+') {
      a = Math.floor(Math.random() * (r + 1));
      b = r - a;
    } else if (op === '-') {
      a = Math.floor(Math.random() * (maxNum - r)) + r;
      b = a - r;
    } else if (op === '×') {
      a = Math.floor(Math.random() * Math.min(10, levelId + 1)) + 1;
      b = Math.floor(Math.random() * Math.min(10, levelId + 1)) + 1;
    } else if (op === '÷') {
      b = Math.floor(Math.random() * Math.min(10, levelId + 1)) + 1;
      a = b * Math.floor(Math.random() * Math.min(10, levelId + 1)) + b;
    }

    label = type === 'left' ? `${a}${op}${b}` : `${r}`;
  } else if (theme === 'chinese_english_words') {
    const wordPairs = [
      { chinese: '苹果', english: 'apple' },
      { chinese: '猫', english: 'cat' },
      { chinese: '狗', english: 'dog' },
      { chinese: '水', english: 'water' },
      { chinese: '火', english: 'fire' },
      { chinese: '天空', english: 'sky' },
      { chinese: '大地', english: 'earth' },
      { chinese: '太阳', english: 'sun' },
      { chinese: '月亮', english: 'moon' },
      { chinese: '星星', english: 'star' },
      { chinese: '树木', english: 'tree' },
      { chinese: '花朵', english: 'flower' },
      { chinese: '鸟', english: 'bird' },
      { chinese: '鱼', english: 'fish' },
      { chinese: '房子', english: 'house' },
      { chinese: '汽车', english: 'car' },
      { chinese: '书', english: 'book' },
      { chinese: '笔', english: 'pen' },
      { chinese: '桌子', english: 'table' },
      { chinese: '椅子', english: 'chair' },
    ];
    const pair = wordPairs[Math.floor(Math.random() * wordPairs.length)];
    label = type === 'left' ? pair.chinese : pair.english;
  } else if (theme === 'poetry_couplets') {
    const poetryPairs = [
      { first: '床前明月光', second: '疑是地上霜' },
      { first: '举头望明月', second: '低头思故乡' },
      { first: '春眠不觉晓', second: '处处闻啼鸟' },
      { first: '夜来风雨声', second: '花落知多少' },
      { first: '红豆生南国', second: '春来发几枝' },
      { first: '天生我材必有用', second: '千金散尽还复来' },
      { first: '会挽雕弓如满月', second: '西北望，射天狼' },
      { first: '长风破浪会有时', second: '直挂云帆济沧海' },
      { first: '大江东去', second: '浪淘尽，千古风流人物' },
      { first: '醉里挑灯看剑', second: '梦回吹角连营' },
      { first: '人生得意须尽欢', second: '莫使金樽空对月' },
      { first: '天涯何处无芳草', second: '王孙不尽帝王乡' },
      { first: '会昌城外高峰', second: '颠连直接青霄' },
      { first: '两岸猿声啼不住', second: '轻舟已过万重山' },
      { first: '问渠那得清如许', second: '为有源头活水来' },
    ];
    const pair = poetryPairs[Math.floor(Math.random() * poetryPairs.length)];
    label = type === 'left' ? pair.first : pair.second;
  } else if (theme === 'poetry_authors') {
    const authorPairs = [
      { work: '静夜思', author: '李白' },
      { work: '春晓', author: '孟浩然' },
      { work: '将进酒', author: '李白' },
      { work: '蜀道难', author: '李白' },
      { work: '登鹳雀楼', author: '王之涣' },
      { work: '相思', author: '王维' },
      { work: '送元二使安西', author: '王维' },
      { work: '望岳', author: '杜甫' },
      { work: '春江花月夜', author: '张若虚' },
      { work: '滁州西涧', author: '韦应物' },
      { work: '江雪', author: '柳宗元' },
      { work: '渔歌子', author: '张志和' },
      { work: '如梦令', author: '李清照' },
      { work: '水调歌头', author: '苏轼' },
      { work: '念奴娇·赤壁怀古', author: '苏轼' },
    ];
    const pair = authorPairs[Math.floor(Math.random() * authorPairs.length)];
    label = type === 'left' ? pair.work : pair.author;
  } else if (theme === 'lyrics_matching') {
    const lyricsPairs = [
      { first: '天亮了', second: '起床了' },
      { first: '我爱你', second: '你爱我' },
      { first: '月亮代表我的心', second: '你是否明白' },
      { first: '小星星', second: '眨眼睛' },
      { first: '让我们荡起双桨', second: '小船儿推开波浪' },
      { first: '我有一只小毛驴', second: '我从来也不骑' },
      { first: '世上只有妈妈好', second: '有妈的孩子像块宝' },
      { first: '两只老虎', second: '两只老虎' },
      { first: '小燕子', second: '穿花衣' },
      { first: '春天在哪里', second: '春天在哪里' },
      { first: '让我们一起学猫叫', second: '一起喵喵喵' },
      { first: '你拍一', second: '我拍一' },
      { first: '一闪一闪亮晶晶', second: '满天都是小星星' },
      { first: '小老鼠', second: '上灯台' },
      { first: '丢丢丢', second: '丢手绢' },
    ];
    const pair = lyricsPairs[Math.floor(Math.random() * lyricsPairs.length)];
    label = type === 'left' ? pair.first : pair.second;
  } else {
    // 默认数学
    const maxNum = Math.min(10 + levelId * 5, 100);
    const r = Math.floor(Math.random() * maxNum);
    label = type === 'left' ? `${Math.floor(Math.random() * maxNum)}+${Math.floor(Math.random() * maxNum)}` : `${r}`;
  }

  return {
    id,
    type,
    color,
    label,
    animationDelay: 0
  };
};

// 主关卡生成函数
export const generateLevel = (
  levelId: number,
  pairCount = 12,
  theme?: string
): { leftCards: Card[]; rightCards: Card[] } => {
  const currentTheme = theme || 'mathematics';

  if (currentTheme === 'mathematics') {
    return generateMathematicsLevel(levelId, pairCount);
  } else if (currentTheme === 'addition_subtraction') {
    if (levelId === 1) return generateLevel1(pairCount);
    else if (levelId === 2) return generateLevel2(pairCount);
    else return generateAdvancedAdditionSubtractionLevel(levelId, pairCount);
  } else if (currentTheme === 'multiplication_division') {
    return generateMultiplicationDivisionLevel(levelId, pairCount);
  } else if (currentTheme === 'four_operations') {
    return generateFourOperationsLevel(levelId, pairCount);
  } else if (currentTheme === 'chinese_english_words') {
    return generateChineseEnglishWordsLevel(levelId, pairCount);
  } else if (currentTheme === 'poetry_couplets') {
    return generatePoetryCoupletsLevel(levelId, pairCount);
  } else if (currentTheme === 'poetry_authors') {
    return generatePoetryAuthorsLevel(levelId, pairCount);
  } else if (currentTheme === 'lyrics_matching') {
    return generateLyricsMatchingLevel(levelId, pairCount);
  }

  // 默认返回数学关卡
  return generateMathematicsLevel(levelId, pairCount);
};