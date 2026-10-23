import { DIMENSIONS, QUESTIONS, TYPES } from "./data.js";
import { formatScore, scoreEcr } from "./score.js";

export const ECR_VERSION = "ecr-cn-v1";
export const CONSENT_VERSION = "consent-assessment-ecr-1";
export const SCHEMA_VERSION = "1.0.0";
export const ASSESSMENT_ID = "ecr";
export const ASSESSMENT_NAME = "成人依恋关系测评";

const SCREEN_TEXT = "这是筛查式的自评，不是诊断。";
const GUIDANCE = [
  "先看两个均分离 4 有多远。4 是量表从 1 到 7 的中点，不是诊断界值。",
  "再看四个判别分。最高的一项才是类型，不按“超过 4 分就划进高的一边”来切。",
  "这是你在恋爱经历里常常有的感觉，不是对某一次吵架的结论，也不能代替两个人具体怎么相处。",
];

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

function axisNote(scored) {
  const avoid = `${scored.avoidance.name} ${formatScore(scored.avoidance.mean)}，${scored.avoidance.levelLabel}`;
  const anxiety = `${scored.anxiety.name} ${formatScore(scored.anxiety.mean)}，${scored.anxiety.levelLabel}`;
  return `${avoid}。${anxiety}。中点是 4 分。`;
}

function dimensionView(dimension) {
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
    about: dimension.about,
    count: dimension.count,
    sum: dimension.sum,
    mean: dimension.mean,
    score: dimension.mean,
    level: dimension.level,
    levelLabel: dimension.levelLabel,
    narrative: dimension.narrative,
  };
}

function typeView(type) {
  return {
    id: type.id,
    name: type.name,
    short: type.short,
    text: type.text,
    score: type.m,
    m: type.m,
    win: type.win,
  };
}

function caveats(scored) {
  const notes = [];
  if (scored.tied) notes.push("两个类型的判别分相同，并列写在上面。");
  if (scored.closeCall && !scored.tied) {
    notes.push(`第一型只比第二型高 ${formatScore(scored.margin)} 分。可以当作倾向，不必当成唯一标签。`);
  }
  if (scored.nearMidpoint) notes.push("两个均分都贴着中点。类型仍然按判别分最高的一项给出，风格并不鲜明。");
  if (scored.differsFromQuadrant) {
    notes.push(`若只按 4 分切成四格，会落到${scored.quadrantName}。这份量表用判别式，最高的是${scored.type.name}。`);
  }
  return notes;
}

/**
 * 把这一次 ECR 收成统一结果协议。
 * 分数只来自 scoreEcr，不在这里另算反向题。性别、年龄和超出 12 字的称呼不进入 payload。
 * 失败返回 null，不上传。
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
  const dimensions = scored.dimensions.map(dimensionView);
  const types = scored.types.map(typeView);
  const headline = scored.type.name;
  const summary = `${axisNote(scored)}${scored.type.short}`;
  const flags = [];
  if (scored.tied) flags.push("tied");
  if (scored.closeCall) flags.push("close");
  if (scored.nearMidpoint) flags.push("near-midpoint");
  if (scored.differsFromQuadrant) flags.push("quadrant-differs");
  const notes = caveats(scored);
  const interpretation = [
    { id: "type", title: headline, text: scored.type.text },
    { id: "screen", title: "不是诊断", text: SCREEN_TEXT },
  ];
  for (const dimension of scored.dimensions) {
    interpretation.push({
      id: dimension.id,
      title: dimension.name,
      text: `${dimension.levelLabel}，均分 ${formatScore(dimension.mean)}。${dimension.narrative}`,
    });
  }
  for (const type of scored.types) {
    const mark = type.win ? "判别分最高。" : "";
    interpretation.push({
      id: type.id,
      title: type.name,
      text: `${mark}判别分 ${formatScore(type.m)}。${type.text}`,
    });
  }
  notes.forEach((text, index) => {
    interpretation.push({ id: `note-${index + 1}`, title: null, text });
  });
  const recommendations = [
    { id: "screen", title: null, text: SCREEN_TEXT },
    ...GUIDANCE.map((text, index) => ({ id: `guide-${index + 1}`, title: null, text })),
  ];
  const dimLine = dimensions.map((item) => `${item.name} ${formatScore(item.score)}（${item.levelLabel}）`).join("、");
  const typeLine = types.map((type) => `${type.name} ${formatScore(type.m)}${type.win ? "（最高）" : ""}`).join("、");
  const textFallback = [
    `${headline}。${summary}`,
    scored.type.text,
    SCREEN_TEXT,
    dimLine,
    typeLine,
    ...notes,
    ...GUIDANCE,
  ].join("");
  const sections = [
    { t: "h", l: 2, x: headline },
    { t: "p", x: summary },
    { t: "p", x: scored.type.text },
    { t: "p", x: SCREEN_TEXT },
    {
      t: "ul",
      it: [
        ...dimensions.map((item) => ({
          x: `${item.name} ${formatScore(item.score)} · ${item.levelLabel}`,
          d: 0,
          n: 0,
        })),
        ...types.map((type) => ({
          x: `${type.name} ${formatScore(type.m)}${type.win ? " · 最高" : ""}`,
          d: 0,
          n: 0,
        })),
      ],
    },
  ];
  for (const line of notes) sections.push({ t: "p", x: line });
  for (const line of GUIDANCE) sections.push({ t: "p", x: line });

  return {
    reportId: input.reportId,
    assessmentId: ASSESSMENT_ID,
    assessmentName: ASSESSMENT_NAME,
    assessmentVersion: ECR_VERSION,
    nickname,
    completedAt: input.completedAt,
    dimensions,
    result: {
      headline,
      code: scored.type.id,
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
        dimensions: scored.dimensions.map(axisView),
        avoidance: axisView(scored.avoidance),
        anxiety: axisView(scored.anxiety),
        types,
        type: {
          id: scored.type.id,
          name: scored.type.name,
          short: scored.type.short,
          text: scored.type.text,
        },
        tied: scored.tied,
        margin: scored.margin,
        closeCall: scored.closeCall,
        nearMidpoint: scored.nearMidpoint,
        quadrant: scored.quadrant,
        quadrantName: scored.quadrantName,
        differsFromQuadrant: scored.differsFromQuadrant,
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
        gaps: ["阅读页若尚未重绘 ECR，类型和两个维度在 interpretation、sections 与 textFallback。"],
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
