import { scoreScl90 } from "./score.js";

export const SCL90_VERSION = "scl90-cn-1986-v1";
export const CONSENT_VERSION = "consent-assessment-scl90-1";
export const SCHEMA_VERSION = "1.0.0";
export const ASSESSMENT_ID = "scl90";
export const ASSESSMENT_NAME = "SCL-90 症状自评量表";

const FACTOR_IDS = ["som", "oc", "is", "dep", "anx", "hos", "phob", "par", "psy", "add"];

function chars(value) {
  return Array.from(String(value || ""));
}

/** 云端昵称沿用本机姓名，去掉首尾空白后最多 12 个字。 */
export function scl90Nickname(value) {
  return chars(String(value || "").trim()).slice(0, 12).join("");
}

function answersOk(list) {
  return Array.isArray(list)
    && list.length === 90
    && list.every((value) => Number.isInteger(value) && value >= 1 && value <= 5);
}

/**
 * 把这一次 SCL-90 收成统一结果协议。
 * 分数只来自 scoreScl90，不在这里另算。性别、年龄和超出 12 字的姓名不进入 payload。
 * 失败返回 null，不上传。
 */
export function buildScl90Result(input) {
  const nickname = scl90Nickname(input && input.nickname);
  const answers = input && input.answers;
  if (!nickname || !answersOk(answers)) return null;
  if (!input.reportId || !input.clientSubmissionId || !input.completedAt) return null;

  let scored;
  try {
    scored = scoreScl90(answers);
  } catch {
    return null;
  }

  const answerCopy = answers.slice();
  const factors = scored.factors.map((factor) => ({
    id: factor.id,
    name: factor.name,
    raw: factor.raw,
    score: factor.mean,
    mean: factor.mean,
    level: factor.level,
    levelLabel: factor.levelLabel,
    screened: factor.screened,
    aboveNorm: factor.aboveNorm,
  }));
  const dimensions = scored.factors.map((factor) => ({
    id: factor.id,
    name: factor.name,
    kind: "score",
    score: factor.mean,
    raw: factor.raw,
    max: 5,
    level: factor.level,
    levelLabel: factor.levelLabel,
    narrative: factor.narrative,
    labels: [],
  }));
  const headline = scored.verdictTitle;
  const summary = scored.verdictText;
  const code = scored.positive ? "positive" : "negative";
  const flags = scored.positive ? ["positive"] : [];
  const interpretation = [];
  if (scored.crisis) {
    interpretation.push({
      id: "crisis",
      title: scored.crisis.level === "note" ? "关于死亡的想法" : "请先看这里",
      text: scored.crisis.text,
    });
  }
  interpretation.push({ id: "gsi", title: scored.gsiLabel, text: scored.gsiText });
  for (const factor of scored.factors) {
    interpretation.push({
      id: factor.id,
      title: factor.name,
      text: `${factor.levelLabel}，均分 ${factor.mean.toFixed(2)}。${factor.narrative}`,
    });
  }
  const recommendations = scored.guidance.map((text, index) => ({
    id: `guide-${index + 1}`,
    title: null,
    text,
  }));
  const factorLine = factors.map((factor) => `${factor.name} ${factor.score.toFixed(2)}`).join("、");
  const textFallback = [
    scored.crisis ? scored.crisis.text : "",
    `${headline}。${summary}`,
    `总分 ${scored.total}，总症状指数 ${scored.gsi.toFixed(2)}，阳性项目 ${scored.positiveCount}。`,
    factorLine,
    scored.guidance.join(""),
  ].filter(Boolean).join("");
  const sections = [];
  if (scored.crisis) sections.push({ t: "p", x: scored.crisis.text });
  sections.push(
    { t: "h", l: 2, x: headline },
    { t: "p", x: summary },
    { t: "p", x: scored.gsiText },
    {
      t: "ul",
      it: factors.map((factor) => ({
        x: `${factor.name} ${factor.score.toFixed(2)} · ${factor.levelLabel}`,
        d: 0,
        n: 0,
      })),
    },
  );
  for (const line of scored.guidance) sections.push({ t: "p", x: line });

  return {
    reportId: input.reportId,
    assessmentId: ASSESSMENT_ID,
    assessmentName: ASSESSMENT_NAME,
    assessmentVersion: SCL90_VERSION,
    nickname,
    completedAt: input.completedAt,
    dimensions,
    result: {
      headline,
      code,
      label: headline,
      summary,
      flags,
    },
    interpretation,
    recommendations,
    reportContent: {
      format: "view-model+sections",
      viewModel: {
        answers: answerCopy,
        total: scored.total,
        gsi: scored.gsi,
        gsiLabel: scored.gsiLabel,
        gsiText: scored.gsiText,
        positiveCount: scored.positiveCount,
        negativeCount: scored.negativeCount,
        positiveMean: scored.positiveMean,
        positive: scored.positive,
        verdictTitle: scored.verdictTitle,
        verdictText: scored.verdictText,
        factors,
        rules: scored.rules,
        crisis: scored.crisis,
        guidance: scored.guidance.slice(),
        rushed: Boolean(input.rushed),
      },
      sections,
      textFallback,
    },
    extensionData: {
      answers: answerCopy.slice(),
      score: scored,
      quality: { rushed: Boolean(input.rushed) },
      consent: {
        agreed: true,
        version: CONSENT_VERSION,
        at: input.completedAt,
        scopes: ["store", "share_link", "mentor_read"],
      },
      compat: {
        level: "partial",
        gaps: ["阅读页若尚未重绘 SCL-90，安全提示在 interpretation、sections 与 textFallback。"],
      },
    },
    source: {
      site: "ASVA 常用心理测试",
      path: "scl90/index.html",
      repo: "mindtest",
      origin: "external-repo",
      pageUrl: "https://xiangshu3721.github.io/mindtest/scl90/",
      clientSubmissionId: input.clientSubmissionId,
      resultKitId: "scl90",
      localKey: "scl90-session",
    },
    schemaVersion: SCHEMA_VERSION,
  };
}

export function scl90FactorIds() {
  return FACTOR_IDS.slice();
}
