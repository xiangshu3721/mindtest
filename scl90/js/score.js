import { FACTORS, GLOBAL_NORMS, QUESTIONS, RUSH, SCREEN } from "./data.js";

const LEVELS = [
  { id: "none", label: "无明显症状", max: 2 },
  { id: "mild", label: "轻度", max: 3 },
  { id: "moderate", label: "中度", max: 4 },
  { id: "severe", label: "重度", max: 5 },
];

const GSI_BANDS = [
  { id: "clear", label: "没有明显症状", max: 1.5, text: "总症状指数在 1.5 及以下，表示你感觉量表里这些情况最近一周基本没有出现。" },
  { id: "occasional", label: "有症状，并不频繁", max: 2.5, text: "总症状指数在 1.5 到 2.5 之间，表示有一些不适，但发生得并不频繁。" },
  { id: "mildModerate", label: "轻到中度", max: 3.5, text: "总症状指数在 2.5 到 3.5 之间，表示不适已经比较明确，程度为轻到中度。" },
  { id: "moderateSevere", label: "中到严重", max: 4.5, text: "总症状指数在 3.5 到 4.5 之间，表示不适的程度为中到严重。" },
  { id: "extreme", label: "十分严重", max: 5, text: "总症状指数高于 4.5，表示这些感受在频度和强度上都十分重。" },
];

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function factorLevel(mean) {
  const found = LEVELS.find((level) => mean <= level.max) ?? LEVELS[LEVELS.length - 1];
  return { id: found.id, label: found.label };
}

export function gsiBand(gsi) {
  const found = GSI_BANDS.find((band) => gsi <= band.max) ?? GSI_BANDS[GSI_BANDS.length - 1];
  return { id: found.id, label: found.label, text: found.text };
}

function assertAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length) {
    throw new Error("需要 90 道题的作答");
  }
  answers.forEach((value, index) => {
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new Error(`第 ${index + 1} 题的分数无效`);
    }
  });
}

function meanOf(values) {
  const sum = values.reduce((total, value) => total + value, 0);
  return sum / values.length;
}

/**
 * Score a completed SCL-90.
 * answers[0] is item 1, values are 1–5.
 */
export function scoreScl90(answers) {
  assertAnswers(answers);
  const total = answers.reduce((sum, value) => sum + value, 0);
  const positiveItems = answers
    .map((value, index) => ({ n: index + 1, text: QUESTIONS[index], score: value }))
    .filter((item) => item.score >= 2);
  const negativeCount = answers.filter((value) => value === 1).length;
  const positiveCount = positiveItems.length;
  const positiveSum = positiveItems.reduce((sum, item) => sum + item.score, 0);
  const gsi = total / answers.length;
  const positiveMean = positiveCount === 0 ? null : positiveSum / positiveCount;

  const factors = FACTORS.map((factor) => {
    const scores = factor.items.map((n) => answers[n - 1]);
    const raw = scores.reduce((sum, value) => sum + value, 0);
    const mean = raw / factor.items.length;
    const level = factorLevel(mean);
    const normCut = factor.norm ? round2(factor.norm.mean + factor.norm.sd) : null;
    return {
      id: factor.id,
      name: factor.name,
      about: factor.about,
      count: factor.items.length,
      raw,
      mean: round2(mean),
      level: level.id,
      levelLabel: level.label,
      narrative: factor.levels[level.id],
      norm: factor.norm,
      normCut,
      aboveNorm: normCut != null && mean > factor.norm.mean + factor.norm.sd,
      screened: mean > SCREEN.factorMean,
    };
  });

  const rules = [
    {
      id: "total",
      label: "总分超过 160",
      hit: total > SCREEN.total,
      detail: `总分 ${total}，界值 ${SCREEN.total}`,
    },
    {
      id: "positive",
      label: "阳性项目数超过 43",
      hit: positiveCount > SCREEN.positiveCount,
      detail: `阳性项目 ${positiveCount} 项，界值 ${SCREEN.positiveCount}`,
    },
    {
      id: "factor",
      label: "九个症状因子里，有均分超过 2",
      hit: factors.some((factor) => factor.norm && factor.screened),
      detail: factors
        .filter((factor) => factor.norm && factor.screened)
        .map((factor) => `${factor.name} ${factor.mean.toFixed(2)}`)
        .join("、") || "没有因子超过 2 分",
    },
  ];

  const band = gsiBand(gsi);
  const positive = rules.some((rule) => rule.hit);
  const order = new Map(FACTORS.map((factor, index) => [factor.id, index]));
  const ranked = [...factors].sort((a, b) => b.mean - a.mean || order.get(a.id) - order.get(b.id));
  const notable = positiveItems
    .filter((item) => item.score >= 4)
    .sort((a, b) => b.score - a.score || a.n - b.n);

  const above = (value, norm) => value > norm.mean + norm.sd;
  return {
    total,
    gsi: round2(gsi),
    gsiLabel: band.label,
    gsiText: band.text,
    positiveCount,
    negativeCount,
    positiveMean: positiveMean == null ? null : round2(positiveMean),
    totalAboveNorm: above(total, GLOBAL_NORMS.total),
    gsiAboveNorm: above(gsi, GLOBAL_NORMS.gsi),
    positiveCountAboveNorm: above(positiveCount, GLOBAL_NORMS.positiveCount),
    positiveMeanAboveNorm: positiveMean != null && above(positiveMean, GLOBAL_NORMS.positiveMean),
    factors,
    ranked,
    rules,
    positive,
    notable,
    norms: GLOBAL_NORMS,
    crisis: crisisNotice(answers),
    guidance: buildGuidance(positive, ranked, answers),
    verdictTitle: positive ? "筛查阳性" : "筛查阴性",
    verdictText: positive
      ? "按国内常用筛查标准，总分、阳性项目数、九个症状因子这三条里，至少有一条超过界值。这表示最近一周的不适，在范围或强度上需要认真看一看。它是筛查，不是诊断。"
      : "按国内常用筛查标准，总分未超过 160，阳性项目数未超过 43，九个症状因子的均分都没有超过 2。最近一周的这些感受，整体还在常用界值以内。量表不能排除所有问题。",
  };
}

function crisisNotice(answers) {
  const wish = answers[14];
  const deathThought = answers[58];
  if (wish >= 4) {
    return {
      level: "urgent",
      text: "第 15 题是“想结束自己的生命”，你选了偏重或严重。如果这个想法最近反复出现，或者你担心自己可能行动，请现在就联系能马上回应你的人：全国心理援助热线 12356，或当地急救 120。这份量表不能代替危机帮助。",
    };
  }
  if (wish >= 2) {
    return {
      level: "alert",
      text: "第 15 题是“想结束自己的生命”，这次的选择已经离开了「没有」。如果它变频繁，或你开始觉得自己可能行动，请联系全国心理援助热线 12356，或告诉一个此刻能陪着你的人。",
    };
  }
  if (deathThought >= 4) {
    return {
      level: "note",
      text: "你在“想到有关死亡的事”上选了偏重或严重。这不等于要结束生命，但如果这些想法停不下来，可以打全国心理援助热线 12356，让另一个人帮你把它放到台面上。",
    };
  }
  return null;
}

function buildGuidance(positive, ranked, answers) {
  const lines = [];
  const top = ranked.filter((factor) => factor.screened).slice(0, 2);
  if (!positive) {
    const extra = ranked.filter((factor) => factor.screened);
    if (extra.length) {
      lines.push(`三条筛查界值都没有超过。不过${extra.map((factor) => factor.name).join("、")}的均分超过了 2，报告里这一段值得单独看。`);
    } else {
      lines.push("三条界值都没有超过，不需要为这份分数本身去做一组矫正计划。睡眠、日间走动、和一个人说上几句实在话，通常比反复重测更有用。");
    }
    lines.push("如果某几天突然变重，或者分数不高但你自己很痛苦，仍然可以找咨询师。界值是筛子，不是感不感到难受的裁判。");
    return lines;
  }

  if (top.length) {
    const names = top.map((factor) => factor.name).join("、");
    lines.push(`目前更突出的是${names}。前面这两项的说明，比总分更接近你这一周的实际形状。`);
  }

  const severe = ranked.filter((factor) => factor.level === "severe" || factor.level === "moderate");
  if (severe.length) {
    lines.push("已经有因子到了中度或重度。下一步是专业评估：心理咨询师、医院心理科或精神科都可以，把这份报告带去当谈话的底稿，而不是当结论。");
  } else {
    lines.push("超过界值的因子还停在轻度。可以先用两周看它是否跟着睡眠、人际或压力一起波动；如果没有减轻，或已经影响工作、学习和关系，就去评估。");
  }

  const odd = [7, 16, 35].filter((n) => answers[n - 1] >= 4);
  if (odd.length) {
    lines.push("“思想被控制”“听到别人听不见的声音”“别人知道你的私下想法”里，有条目到了偏重或严重。请把这些体验直接告诉专业人员，不要只把它理解成性格或最近压力大。");
  }
  return lines;
}

/**
 * Mirrors the site's pre-submit speed check.
 * times[i] is the timestamp when item i+1 was answered.
 * More than half of the 89 gaps shorter than 1.5s counts as too fast.
 */
export function rushCheck(times) {
  if (!Array.isArray(times) || times.length !== QUESTIONS.length) {
    return { tooFast: false, ratio: 0, fastGaps: 0, gaps: 0 };
  }
  let fastGaps = 0;
  let gaps = 0;
  for (let i = 1; i < times.length; i += 1) {
    if (times[i] == null || times[i - 1] == null) continue;
    gaps += 1;
    if (times[i] - times[i - 1] < RUSH.gapMs) fastGaps += 1;
  }
  const ratio = gaps === 0 ? 0 : fastGaps / gaps;
  return {
    tooFast: gaps > 0 && ratio > RUSH.ratio,
    ratio: round2(ratio),
    fastGaps,
    gaps,
  };
}

export function formatScore(value) {
  return value.toFixed(2);
}
