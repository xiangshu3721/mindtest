import { DIMENSIONS, QUESTIONS, TYPES } from "./data.js";
import { scoreEcr } from "./score.js";

export const ECR_VERSION = "ecr-h5-v1";
export const CONSENT_VERSION = "consent-assessment-ecr-1";
export const ECR_SCREEN_TEXT = "这是你在恋爱经历里常常有的感觉，不是对某一次吵架的结论，也不是诊断。";
export const ECR_READER_GAP = "阅读页若尚未重绘 ECR，类型说明在 interpretation、sections 与 textFallback。";
export const SCHEMA_VERSION = "1.0.0";
export const ASSESSMENT_ID = "ecr";
export const ASSESSMENT_NAME = "亲密关系经历量表 ECR";

function chars(value) {
  return Array.from(String(value || ""));
}

/** 云端昵称沿用封面上的称呼，去掉首尾空白后最多 12 个字。 */
export function ecrNickname(value) {
  return chars(String(value || "").trim()).slice(0, 12).join("");
}

export function ecrDimensionIds() {
  return DIMENSIONS.map((dimension) => dimension.id);
}

export function ecrTypeIds() {
  return TYPES.map((type) => type.id);
}

function answersOk(list) {
  return Array.isArray(list)
    && list.length === QUESTIONS.length
    && list.every((value) => Number.isInteger(value) && value >= 1 && value <= 7);
}

export function ecrFlags(scored) {
  const flags = [scored.type.id];
  if (scored.tied) flags.push("tied");
  if (scored.closeCall) flags.push("close-call");
  if (scored.nearMidpoint) flags.push("near-midpoint");
  if (scored.differsFromQuadrant) flags.push("differs-from-quadrant");
  return flags;
}

export function ecrDimension(dimension) {
  return {
    id: dimension.id,
    name: dimension.name,
    kind: "score",
    score: dimension.mean,
    raw: dimension.sum,
    max: 7,
    level: dimension.level,
    levelLabel: dimension.levelLabel,
    narrative: dimension.narrative,
    labels: [],
  };
}

function axisView(dimension) {
  return {
    id: dimension.id,
    name: dimension.name,
    sum: dimension.sum,
    mean: dimension.mean,
    level: dimension.level,
    levelLabel: dimension.levelLabel,
  };
}

export function ecrViewModel(scored, answers, rushed) {
  return {
    answers: answers.slice(),
    avoidance: axisView(scored.avoidance),
    anxiety: axisView(scored.anxiety),
    types: scored.types.map((type) => ({
      id: type.id,
      name: type.name,
      m: type.m,
      win: type.win,
    })),
    type: {
      id: scored.type.id,
      name: scored.type.name,
      short: scored.type.short,
    },
    tied: scored.tied,
    margin: scored.margin,
    closeCall: scored.closeCall,
    nearMidpoint: scored.nearMidpoint,
    quadrant: scored.quadrant,
    quadrantName: scored.quadrantName,
    differsFromQuadrant: scored.differsFromQuadrant,
    rushed: Boolean(rushed),
  };
}

export function ecrOutcome(scored) {
  return {
    headline: `${scored.type.name}：${scored.type.short}`,
    code: scored.tied ? "tied" : scored.type.id,
    label: scored.type.name,
    summary: scored.type.text,
    flags: ecrFlags(scored),
  };
}

/**
 * 把这一次 ECR 收成统一结果协议。
 * 分数只来自 scoreEcr，不在这里另算反向题。性别、年龄和超出 12 字的称呼不进入 payload。
 * 形状与已部署的 vendor ecr-payload 一致。失败返回 null，不上传。
 */
export function buildEcrResult(input) {
  const nickname = ecrNickname(input && input.nickname);
  const answers = input && input.answers;
  if (!nickname || !answersOk(answers)) return null;
  if (!input.reportId || !input.clientSubmissionId || !input.completedAt) return null;

  let scored;
  try {
    scored = scoreEcr(answers);
  } catch {
    return null;
  }

  const answerCopy = answers.slice();
  const outcome = ecrOutcome(scored);
  const dimensions = scored.dimensions.map(ecrDimension);
  const rushed = Boolean(input.rushed);
  const axis = dimensions
    .map((dimension) => `${dimension.name} ${dimension.score.toFixed(2)}，${dimension.levelLabel}`)
    .join("。");
  const interpretation = [
    { id: "verdict", title: outcome.headline, text: outcome.summary },
    { id: "screen", title: "筛查不是诊断", text: ECR_SCREEN_TEXT },
  ];
  for (const dimension of dimensions) {
    interpretation.push({
      id: dimension.id,
      title: dimension.name,
      text: `${dimension.levelLabel}，均分 ${dimension.score.toFixed(2)}。${dimension.narrative}`,
    });
  }
  const recommendations = [
    { id: "screen", title: null, text: ECR_SCREEN_TEXT },
  ];
  const textFallback = `${outcome.headline}。${axis}。${ECR_SCREEN_TEXT}`;
  const sections = [
    { t: "h", l: 2, x: outcome.headline },
    { t: "p", x: outcome.summary },
    { t: "p", x: ECR_SCREEN_TEXT },
    { t: "p", x: `${axis}。` },
  ];

  return {
    reportId: input.reportId,
    assessmentId: ASSESSMENT_ID,
    assessmentName: ASSESSMENT_NAME,
    assessmentVersion: ECR_VERSION,
    nickname,
    completedAt: input.completedAt,
    dimensions,
    result: outcome,
    interpretation,
    recommendations,
    reportContent: {
      format: "view-model+sections",
      viewModel: ecrViewModel(scored, answerCopy, rushed),
      sections,
      textFallback,
    },
    extensionData: {
      answers: answerCopy.slice(),
      score: scored,
      quality: { rushed },
      consent: {
        agreed: true,
        version: CONSENT_VERSION,
        at: input.completedAt,
        scopes: ["store", "share_link", "mentor_read"],
      },
      compat: {
        level: "partial",
        gaps: [ECR_READER_GAP],
      },
    },
    source: {
      site: "ASVA 常用心理测试",
      path: "ecr/index.html",
      repo: "mindtest",
      origin: "external-repo",
      pageUrl: "https://xiangshu3721.github.io/mindtest/ecr/",
      clientSubmissionId: input.clientSubmissionId,
      resultKitId: "ecr",
      localKey: "ecr-session",
    },
    schemaVersion: SCHEMA_VERSION,
  };
}
