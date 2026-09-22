import { DIMENSIONS, QUESTIONS, REVERSE_ITEMS, RUSH, TYPES } from "./data.js";

const REVERSE = new Set(REVERSE_ITEMS);
const MIDPOINT = 4;

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function formatScore(value) {
  return value.toFixed(2);
}

export function scoredValue(itemNumber, raw) {
  return REVERSE.has(itemNumber) ? 8 - raw : raw;
}

function sideOf(mean) {
  if (mean < MIDPOINT) return "low";
  if (mean > MIDPOINT) return "high";
  return "mid";
}

const SIDE_LABEL = {
  low: "低于中点",
  mid: "处于中点",
  high: "高于中点",
};

function assertAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length) {
    throw new Error("需要 36 道题的作答");
  }
  answers.forEach((value, index) => {
    if (!Number.isInteger(value) || value < 1 || value > 7) {
      throw new Error(`第 ${index + 1} 题的分数无效`);
    }
  });
}

function quadrantId(avoidance, anxiety) {
  if (avoidance === MIDPOINT || anxiety === MIDPOINT) return null;
  if (avoidance < MIDPOINT && anxiety < MIDPOINT) return "secure";
  if (avoidance < MIDPOINT && anxiety > MIDPOINT) return "preoccupied";
  if (avoidance > MIDPOINT && anxiety < MIDPOINT) return "dismissing";
  return "fearful";
}

/**
 * Score a completed ECR.
 * answers[0] is item 1, values are 1–7 before reverse scoring.
 * Type is the Fisher discriminant with the largest value.
 */
export function scoreEcr(answers) {
  assertAnswers(answers);
  const scored = answers.map((raw, index) => scoredValue(index + 1, raw));

  const dimensions = DIMENSIONS.map((dimension) => {
    const values = dimension.items.map((n) => scored[n - 1]);
    const sum = values.reduce((total, value) => total + value, 0);
    const mean = sum / values.length;
    const level = sideOf(mean);
    return {
      id: dimension.id,
      name: dimension.name,
      about: dimension.about,
      count: dimension.items.length,
      sum,
      mean: round2(mean),
      exactMean: mean,
      level,
      levelLabel: SIDE_LABEL[level],
      narrative: dimension.levels[level],
    };
  });

  const avoidance = dimensions.find((dimension) => dimension.id === "avoidance");
  const anxiety = dimensions.find((dimension) => dimension.id === "anxiety");
  const types = TYPES.map((type) => ({
    id: type.id,
    name: type.name,
    short: type.short,
    text: type.text,
    m: avoidance.exactMean * type.a + anxiety.exactMean * type.b + type.c,
  }));
  const max = Math.max(...types.map((type) => type.m));
  const winners = types.filter((type) => Math.abs(type.m - max) < 1e-8);
  const ranked = [...types].sort((left, right) => right.m - left.m);
  const margin = ranked[0].m - ranked[1].m;
  const quadrant = quadrantId(avoidance.exactMean, anxiety.exactMean);
  const quadrantType = TYPES.find((type) => type.id === quadrant) ?? null;

  return {
    dimensions,
    avoidance,
    anxiety,
    types: types.map((type) => ({
      ...type,
      m: round2(type.m),
      exactM: type.m,
      win: winners.some((winner) => winner.id === type.id),
    })),
    type: {
      id: winners[0].id,
      name: winners.map((winner) => winner.name).join("、"),
      short: winners.length === 1 ? winners[0].short : "两个类型的判别分相同。",
      text: winners.map((winner) => winner.text).join(""),
    },
    tied: winners.length > 1,
    margin: round2(margin),
    closeCall: margin < 0.5,
    nearMidpoint: Math.abs(avoidance.exactMean - MIDPOINT) < 0.25
      && Math.abs(anxiety.exactMean - MIDPOINT) < 0.25,
    quadrant,
    quadrantName: quadrantType?.name ?? null,
    differsFromQuadrant: quadrant != null && !winners.some((winner) => winner.id === quadrant),
    scored,
  };
}

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
