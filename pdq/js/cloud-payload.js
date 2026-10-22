import { QUESTIONS, SCALES } from "./data.js";
import { scorePdq4 } from "./score.js";

export const PDQ4_VERSION = "pdq4-plus-cn-v1";
export const CONSENT_VERSION = "consent-assessment-pdq4-1";
export const SCHEMA_VERSION = "1.0.0";
export const ASSESSMENT_ID = "pdq4";
export const ASSESSMENT_NAME = "人格障碍筛查 PDQ-4";

const SCREEN_TEXT = "这是筛查，不是诊断，也不能代替面谈。达到划界只说明问卷上的一种相处方式，不能据此给自己下人格障碍的诊断。";

function chars(value) {
  return Array.from(String(value || ""));
}

/** 云端昵称沿用封面上的称呼，去掉首尾空白后最多 12 个字。 */
export function pdq4Nickname(value) {
  return chars(String(value || "").trim()).slice(0, 12).join("");
}

export function pdq4ScaleIds() {
  return SCALES.map((scale) => scale.id);
}

function answersOk(list) {
  return Array.isArray(list)
    && list.length === QUESTIONS.length
    && list.every((value) => value === 0 || value === 1);
}

function scaleView(scale) {
  return {
    id: scale.id,
    name: scale.name,
    alias: scale.alias || "",
    cluster: scale.cluster,
    score: scale.score,
    max: scale.max,
    cutoff: scale.cutoff,
    positive: scale.positive,
  };
}

/**
 * 把这一次 PDQ-4 收成统一结果协议。
 * 分数只来自 scorePdq4，不在这里另算。性别、年龄和超出 12 字的称呼不进入 payload。
 * 失败返回 null，不上传。
 */
export function buildPdq4Result(input) {
  const nickname = pdq4Nickname(input && input.nickname);
  const answers = input && input.answers;
  if (!nickname || !answersOk(answers)) return null;
  if (!input.reportId || !input.clientSubmissionId || !input.completedAt) return null;

  let scored;
  try {
    scored = scorePdq4(answers);
  } catch {
    return null;
  }

  const answerCopy = answers.slice();
  const scales = scored.scales.map(scaleView);
  const dimensions = scored.scales.map((scale) => ({
    id: scale.id,
    name: scale.name,
    kind: "score",
    score: scale.score,
    max: scale.max,
    cutoff: scale.cutoff,
    positive: scale.positive,
    cluster: scale.cluster,
    level: scale.positive ? "positive" : "negative",
    levelLabel: scale.positive ? "达到划界" : "未达到",
    narrative: scale.about,
    labels: [],
  }));
  const headline = scored.verdict.title;
  const summary = scored.verdict.text;
  const flags = [];
  if (scored.positiveCount > 0) flags.push("positive");
  if (scored.tooGood.flagged) flags.push("too-good");
  if (scored.suspect.flagged) flags.push("suspect");
  const interpretation = [
    { id: "verdict", title: headline, text: summary },
    { id: "screen", title: "筛查不是诊断", text: SCREEN_TEXT },
    {
      id: "too-good",
      title: "掩饰",
      text: `掩饰 ${scored.tooGood.score} / ${scored.tooGood.max}${scored.tooGood.flagged ? "，达到注意线" : "，未触发"}。`,
    },
    {
      id: "suspect",
      title: "怀疑",
      text: `怀疑 ${scored.suspect.score} / ${scored.suspect.max}${scored.suspect.flagged ? "，问卷按可疑处理" : "，未触发"}。`,
    },
  ];
  for (const scale of scored.scales) {
    const mark = scale.positive ? "达到划界" : "未达到";
    const detail = scale.positive ? scale.portrait : scale.about;
    interpretation.push({
      id: scale.id,
      title: scale.name,
      text: `${mark}，${scale.score} / ${scale.max}，划界 ${scale.cutoff}。${detail}`,
    });
  }
  const recommendations = [
    { id: "screen", title: null, text: SCREEN_TEXT },
  ];
  const scaleLine = scales.map((scale) => `${scale.name} ${scale.score}/${scale.max}`).join("、");
  const textFallback = [
    `${headline}。${summary}`,
    SCREEN_TEXT,
    `十二个维度得分之和 ${scored.total}，达到划界 ${scored.positiveCount} 个。`,
    `掩饰 ${scored.tooGood.score}/${scored.tooGood.max}，怀疑 ${scored.suspect.score}/${scored.suspect.max}。`,
    `冲动合成 ${scored.impulse.point} 分，早年行为合成 ${scored.conduct.point} 分。`,
    scaleLine,
  ].join("");
  const sections = [
    { t: "h", l: 2, x: headline },
    { t: "p", x: summary },
    { t: "p", x: SCREEN_TEXT },
    { t: "p", x: `掩饰 ${scored.tooGood.score} / ${scored.tooGood.max}，怀疑 ${scored.suspect.score} / ${scored.suspect.max}。` },
    {
      t: "ul",
      it: scales.map((scale) => ({
        x: `${scale.name} ${scale.score} / ${scale.max} · ${scale.positive ? "达到划界" : "未达到"}`,
        d: 0,
        n: 0,
      })),
    },
  ];

  return {
    reportId: input.reportId,
    assessmentId: ASSESSMENT_ID,
    assessmentName: ASSESSMENT_NAME,
    assessmentVersion: PDQ4_VERSION,
    nickname,
    completedAt: input.completedAt,
    dimensions,
    result: {
      headline,
      code: scored.verdict.id,
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
        scales,
        positiveCount: scored.positiveCount,
        total: scored.total,
        tooGood: scored.tooGood,
        suspect: scored.suspect,
        impulse: scored.impulse,
        conduct: scored.conduct,
        verdict: scored.verdict,
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
        gaps: ["阅读页若尚未重绘 PDQ-4，筛查说明在 interpretation、sections 与 textFallback。"],
      },
    },
    source: {
      site: "ASVA 常用心理测试",
      path: "pdq/index.html",
      repo: "mindtest",
      origin: "external-repo",
      pageUrl: "https://xiangshu3721.github.io/mindtest/pdq/",
      clientSubmissionId: input.clientSubmissionId,
      resultKitId: "pdq4",
      localKey: "pdq4-session",
    },
    schemaVersion: SCHEMA_VERSION,
  };
}
