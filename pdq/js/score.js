import {
  CONDUCT_ITEMS,
  IMPULSE_ITEMS,
  QUESTIONS,
  SCALES,
  SUSPECT_YES,
  TOO_GOOD_REVERSE,
  TOO_GOOD_YES,
} from "./data.js";

function assertAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length) {
    throw new Error("需要 126 道题的作答");
  }
  answers.forEach((value, index) => {
    if (value !== 0 && value !== 1) {
      throw new Error(`第 ${index + 1} 题的答案无效`);
    }
  });
}

function yes(answers, n) {
  return answers[n - 1] === 1 ? 1 : 0;
}

function sumItems(answers, items) {
  return items.reduce((total, n) => total + yes(answers, n), 0);
}

function composite(answers, items, need) {
  const count = sumItems(answers, items);
  return { count, need, point: count >= need ? 1 : 0 };
}

export function scorePdq4(answers) {
  assertAnswers(answers);
  const impulse = composite(answers, IMPULSE_ITEMS, 2);
  const conduct = composite(answers, CONDUCT_ITEMS, 3);

  const scales = SCALES.map((scale) => {
    let score = sumItems(answers, scale.items);
    if (scale.extra === "impulse") score += impulse.point;
    if (scale.extra === "conduct") score += conduct.point;
    const max = scale.items.length + (scale.extra ? 1 : 0);
    const positive = score >= scale.cutoff;
    return {
      id: scale.id,
      name: scale.name,
      alias: scale.alias || "",
      cluster: scale.cluster,
      about: scale.about,
      portrait: scale.portrait,
      score,
      max,
      cutoff: scale.cutoff,
      positive,
      items: scale.items.slice(),
    };
  });

  const tooGoodHits = [
    ...TOO_GOOD_REVERSE.filter((n) => answers[n - 1] === 0),
    ...TOO_GOOD_YES.filter((n) => answers[n - 1] === 1),
  ];
  const suspectHits = SUSPECT_YES.filter((n) => answers[n - 1] === 1);
  const tooGood = {
    score: tooGoodHits.length,
    max: TOO_GOOD_REVERSE.length + TOO_GOOD_YES.length,
    cutoff: 2,
    flagged: tooGoodHits.length >= 2,
    items: tooGoodHits,
  };
  const suspect = {
    score: suspectHits.length,
    max: SUSPECT_YES.length,
    cutoff: 1,
    flagged: suspectHits.length >= 1,
    items: suspectHits,
  };
  const positiveScales = scales.filter((scale) => scale.positive);
  const total = scales.reduce((sum, scale) => sum + scale.score, 0);

  return {
    scales,
    positiveScales,
    positiveCount: positiveScales.length,
    total,
    impulse,
    conduct,
    tooGood,
    suspect,
    verdict: buildVerdict(positiveScales, tooGood, suspect),
  };
}

function buildVerdict(positiveScales, tooGood, suspect) {
  const names = positiveScales.map((scale) => scale.name).join("、");
  if (suspect.flagged && tooGood.flagged) {
    return {
      id: "invalid",
      title: "作答本身先要打折",
      text: `有题目提示问卷可疑，同时也有掩饰倾向。下面的分数仍然按规则算出${names ? `，达到划界的是${names}` : ""}，但不宜直接当成你的人格画像。`,
    };
  }
  if (suspect.flagged) {
    return {
      id: "suspect",
      title: "这份问卷可疑",
      text: `第 64 题或第 76 题的回答使结果不可靠。分数照常列出${names ? `，其中${names}达到划界` : ""}，请先看效度，再决定要不要重做。`,
    };
  }
  if (tooGood.flagged && positiveScales.length === 0) {
    return {
      id: "too-good-clear",
      title: "没有维度达到划界，但回答偏完美",
      text: "12 个分量表都低于划界分。同时，几道几乎人人都会承认的小题被否认了，分数有可能被压低。",
    };
  }
  if (tooGood.flagged) {
    return {
      id: "too-good",
      title: `${positiveScales.length} 个维度达到划界，回答仍偏完美`,
      text: `${names}达到筛查划界。掩饰分也偏高，实际倾向可能比卷面更明显。这仍是筛查，不是诊断。`,
    };
  }
  if (positiveScales.length === 0) {
    return {
      id: "clear",
      title: "没有维度达到划界",
      text: "12 个分量表都低于各自的划界分。这表示以这份问卷的标准，目前看不到需要标记的人格障碍筛查阳性。它排除不了所有问题，也不能代替面谈。",
    };
  }
  if (positiveScales.length === 1) {
    return {
      id: "one",
      title: `${positiveScales[0].name}达到划界`,
      text: "只有这一个维度达到筛查划界。它提示一种相对稳定的相处和感受方式，不是诊断，也不能说明严重程度。",
    };
  }
  return {
    id: "several",
    title: `${positiveScales.length} 个维度达到划界`,
    text: `${names}达到各自的划界分。阳性越多，说明这些模式叠在一起的范围越广，但不等于更重，也不等于可以给自己下诊断。`,
  };
}

export function rushCheck(times) {
  const gaps = [];
  for (let i = 1; i < times.length; i += 1) {
    if (times[i] == null || times[i - 1] == null) continue;
    gaps.push(times[i] - times[i - 1]);
  }
  const fast = gaps.filter((gap) => gap < 1500).length;
  const ratio = gaps.length === 0 ? 0 : fast / gaps.length;
  return { fast, gaps: gaps.length, ratio, tooFast: gaps.length > 0 && ratio > 0.5 };
}
