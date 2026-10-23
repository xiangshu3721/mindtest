import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { QUESTIONS, REVERSE_ITEMS, TYPES } from "./data.js";
import { scoreEcr } from "./score.js";
import {
  ASSESSMENT_NAME,
  CONSENT_VERSION,
  ECR_READER_GAP,
  ECR_SCREEN_TEXT,
  ECR_VERSION,
  buildEcrResult,
  ecrDimension,
  ecrDimensionIds,
  ecrFlags,
  ecrNickname,
  ecrOutcome,
  ecrTypeIds,
  ecrViewModel,
} from "./cloud-payload.js";

const REVERSE = new Set(REVERSE_ITEMS);

function base(extra) {
  return {
    nickname: "林深",
    reportId: "rpt_abcdefghijk",
    clientSubmissionId: "sub_abcdefghijklmnop",
    completedAt: "2026-10-22T21:00:00+08:00",
    ...extra,
  };
}

function keysOf(value, found = []) {
  if (!value || typeof value !== "object") return found;
  const keys = Array.isArray(value) ? [] : Object.keys(value);
  for (const key of keys) {
    found.push(key);
    keysOf(value[key], found);
  }
  if (Array.isArray(value)) value.forEach((item) => keysOf(item, found));
  return found;
}

function pattern({ avoidance = 1, anxiety = 1 } = {}) {
  return QUESTIONS.map((_, index) => {
    const n = index + 1;
    const want = n % 2 === 1 ? avoidance : anxiety;
    return REVERSE.has(n) ? 8 - want : want;
  });
}

test("称呼取前 12 个字，空称呼和坏答案不上传", () => {
  assert.equal(ecrNickname("  林深  "), "林深");
  assert.equal(ecrNickname(`${"林深".repeat(6)}\uE000\uE001`), "林深".repeat(6));
  assert.equal(ecrNickname("   "), "");
  assert.equal(buildEcrResult(base({ nickname: "  ", answers: Array(36).fill(4) })), null);
  assert.equal(buildEcrResult(base({ answers: Array(35).fill(4) })), null);
  assert.equal(buildEcrResult(base({ answers: Array(36).fill(4), reportId: "" })), null);
  assert.equal(buildEcrResult(base({ answers: Array(36).fill(0) })), null);
  assert.equal(buildEcrResult(base({ answers: Array(36).fill(8) })), null);
  assert.equal(buildEcrResult(base({ answers: Array(36).fill(1.5) })), null);
});

test("payload 名称、版本、文案、viewModel、flags、compat 对齐已部署协议", () => {
  const answers = pattern({ avoidance: 2, anxiety: 6 });
  const scored = scoreEcr(answers);
  const report = buildEcrResult(base({
    nickname: `${"林深".repeat(6)}\uE000\uE001`,
    answers,
    gender: "SECRET_GENDER",
    age: "SECRET_AGE",
    profile: { gender: "SECRET_GENDER", age: "SECRET_AGE" },
    rushed: true,
  }));
  const packed = JSON.stringify(report);
  assert.equal(report.assessmentId, "ecr");
  assert.equal(report.assessmentName, ASSESSMENT_NAME);
  assert.equal(report.assessmentName, "亲密关系经历量表 ECR");
  assert.equal(report.assessmentName.includes("ECR"), true);
  assert.equal(report.assessmentName.includes("亲密关系经历量表"), true);
  assert.equal(report.assessmentVersion, ECR_VERSION);
  assert.equal(report.assessmentVersion, "ecr-h5-v1");
  assert.equal(report.schemaVersion, "1.0.0");
  assert.equal(report.extensionData.consent.version, CONSENT_VERSION);
  assert.equal(report.extensionData.consent.version, "consent-assessment-ecr-1");
  assert.equal(report.assessmentVersion === report.extensionData.consent.version, false);
  assert.equal(report.nickname, "林深".repeat(6));
  assert.equal(packed.includes("\uE000"), false);
  assert.equal(packed.includes("\uE001"), false);
  assert.equal(packed.includes("SECRET_GENDER"), false);
  assert.equal(packed.includes("SECRET_AGE"), false);
  assert.equal(keysOf(report).includes("gender"), false);
  assert.equal(keysOf(report).includes("age"), false);
  assert.equal(keysOf(report).includes("profile"), false);
  assert.deepEqual(report.dimensions, scored.dimensions.map(ecrDimension));
  assert.deepEqual(report.dimensions.map((item) => item.id), ecrDimensionIds());
  assert.deepEqual(report.dimensions.map((item) => item.id), ["avoidance", "anxiety"]);
  report.dimensions.forEach((item, index) => {
    const dimension = scored.dimensions[index];
    assert.equal(item.kind, "score");
    assert.equal(item.score, dimension.mean);
    assert.equal(item.raw, dimension.sum);
    assert.equal(item.max, 7);
    assert.equal(item.level, dimension.level);
    assert.equal(item.levelLabel, dimension.levelLabel);
    assert.equal(item.narrative, dimension.narrative);
    assert.deepEqual(item.labels, []);
    assert.equal(report.extensionData.score.dimensions[index].mean, dimension.mean);
  });
  const view = report.reportContent.viewModel;
  assert.deepEqual(view, ecrViewModel(scored, answers, true));
  assert.deepEqual(Object.keys(view), [
    "answers", "avoidance", "anxiety", "types", "type",
    "tied", "margin", "closeCall", "nearMidpoint",
    "quadrant", "quadrantName", "differsFromQuadrant", "rushed",
  ]);
  assert.deepEqual(Object.keys(view.avoidance), ["id", "name", "sum", "mean", "level", "levelLabel"]);
  assert.equal(Object.hasOwn(view.avoidance, "score"), false);
  assert.equal(Object.hasOwn(view, "dimensions"), false);
  assert.equal(view.answers.length, 36);
  assert.deepEqual(view.answers, answers);
  assert.equal(view.answers[2], 6);
  assert.equal(report.extensionData.score.scored[2], 2);
  assert.deepEqual(report.extensionData.answers, answers);
  assert.deepEqual(report.extensionData.score, scored);
  assert.equal(view.avoidance.mean, scored.avoidance.mean);
  assert.equal(view.anxiety.mean, scored.anxiety.mean);
  assert.deepEqual(view.types.map((type) => type.id), ecrTypeIds());
  assert.deepEqual(view.types.map((type) => type.id), TYPES.map((type) => type.id));
  assert.deepEqual(view.types.map((type) => type.id), ["secure", "fearful", "preoccupied", "dismissing"]);
  view.types.forEach((type, index) => {
    assert.deepEqual(Object.keys(type), ["id", "name", "m", "win"]);
    assert.equal(type.m, scored.types[index].m);
    assert.equal(type.win, scored.types[index].win);
    assert.equal(type.name, scored.types[index].name);
  });
  assert.deepEqual(Object.keys(view.type), ["id", "name", "short"]);
  assert.equal(view.type.id, scored.type.id);
  assert.equal(view.type.name, scored.type.name);
  assert.equal(view.type.short, scored.type.short);
  assert.equal(view.quadrant, scored.quadrant);
  assert.equal(view.rushed, true);
  assert.deepEqual(report.result, ecrOutcome(scored));
  assert.equal(report.result.headline, `${scored.type.name}：${scored.type.short}`);
  assert.equal(report.result.summary, scored.type.text);
  assert.equal(report.result.label, scored.type.name);
  assert.equal(report.result.code, "preoccupied");
  assert.deepEqual(report.result.flags, ecrFlags(scored));
  assert.deepEqual(report.result.flags, ["preoccupied"]);
  assert.equal(ECR_SCREEN_TEXT, "这是你在恋爱经历里常常有的感觉，不是对某一次吵架的结论，也不是诊断。");
  assert.equal(report.interpretation[1].text, ECR_SCREEN_TEXT);
  assert.equal(report.interpretation[1].title, "筛查不是诊断");
  assert.equal(report.recommendations[0].text, ECR_SCREEN_TEXT);
  assert.equal(report.reportContent.sections.some((item) => item.x === ECR_SCREEN_TEXT), true);
  assert.equal(report.reportContent.textFallback.includes(ECR_SCREEN_TEXT), true);
  assert.equal(report.reportContent.textFallback, `${report.result.headline}。依恋回避 2.00，低于中点。依恋焦虑 6.00，高于中点。${ECR_SCREEN_TEXT}`);
  assert.equal(report.interpretation.some((item) => item.id === "verdict"), true);
  assert.equal(report.interpretation.some((item) => item.id === "avoidance"), true);
  assert.equal(report.interpretation.some((item) => item.id === "anxiety"), true);
  assert.equal(report.interpretation.some((item) => item.id === "secure"), false);
  assert.equal(report.extensionData.compat.level, "partial");
  assert.equal(ECR_READER_GAP, "阅读页若尚未重绘 ECR，类型说明在 interpretation、sections 与 textFallback。");
  assert.deepEqual(report.extensionData.compat.gaps, [ECR_READER_GAP]);
  assert.equal(report.source.repo, "mindtest");
  assert.equal(report.source.path, "ecr/index.html");
  assert.equal(report.source.origin, "external-repo");
  assert.equal(report.source.resultKitId, "ecr");
  assert.equal(report.source.site, "ASVA 常用心理测试");
  assert.equal(report.source.localKey, "ecr-session");
  assert.equal(report.extensionData.consent.agreed, true);
  assert.deepEqual(report.extensionData.consent.scopes, ["store", "share_link", "mentor_read"]);
  assert.equal(report.extensionData.quality.rushed, true);
  assert.equal(report.reportContent.format, "view-model+sections");
});

test("并列时类型码是 tied，标记用 close-call 和 differs-from-quadrant", () => {
  const outcome = ecrOutcome({
    type: { id: "secure", name: "安全型、恐惧型", short: "两个类型的判别分相同。", text: "并列说明" },
    tied: true,
    closeCall: true,
    nearMidpoint: true,
    differsFromQuadrant: true,
  });
  assert.equal(outcome.code, "tied");
  assert.equal(outcome.headline, "安全型、恐惧型：两个类型的判别分相同。");
  assert.equal(outcome.summary, "并列说明");
  assert.equal(outcome.label, "安全型、恐惧型");
  assert.deepEqual(outcome.flags, ["secure", "tied", "close-call", "near-midpoint", "differs-from-quadrant"]);
});

test("四种原型和全 4 的类型跟着 scoreEcr，反向题不在 payload 里重算", async () => {
  const source = await readFile(new URL("./cloud-payload.js", import.meta.url), "utf8");
  assert.equal(source.includes("scoreEcr"), true);
  assert.equal(source.includes("8 -"), false);
  assert.equal(source.includes("REVERSE"), false);

  const cases = [
    [pattern({ avoidance: 1, anxiety: 1 }), "secure"],
    [pattern({ avoidance: 1, anxiety: 7 }), "preoccupied"],
    [pattern({ avoidance: 7, anxiety: 1 }), "dismissing"],
    [pattern({ avoidance: 7, anxiety: 7 }), "fearful"],
    [Array(36).fill(4), "fearful"],
    [Array(36).fill(1), "dismissing"],
    [Array(36).fill(7), "preoccupied"],
  ];
  for (const [answers, code] of cases) {
    const scored = scoreEcr(answers);
    const report = buildEcrResult(base({ answers }));
    assert.equal(report.result.code, code);
    assert.equal(report.result.code, scored.tied ? "tied" : scored.type.id);
    assert.equal(report.result.headline, `${scored.type.name}：${scored.type.short}`);
    assert.equal(report.result.summary, scored.type.text);
    assert.deepEqual(report.result.flags, ecrFlags(scored));
    assert.equal(report.dimensions[0].score, scored.avoidance.mean);
    assert.equal(report.dimensions[1].score, scored.anxiety.mean);
    assert.deepEqual(report.reportContent.viewModel, ecrViewModel(scored, answers, false));
    assert.deepEqual(report.reportContent.viewModel.answers, answers);
    report.reportContent.viewModel.types.forEach((type, index) => {
      assert.equal(type.m, scored.types[index].m);
    });
  }

  const mid = buildEcrResult(base({ answers: Array(36).fill(4) }));
  assert.equal(mid.dimensions[0].score, 4);
  assert.equal(mid.dimensions[1].score, 4);
  assert.equal(mid.reportContent.viewModel.nearMidpoint, true);
  assert.equal(mid.reportContent.viewModel.quadrant, null);
  assert.equal(mid.result.flags.includes("near-midpoint"), true);
  assert.equal(mid.result.flags.includes("fearful"), true);
  assert.equal(mid.result.code, "fearful");

  const rawOnes = buildEcrResult(base({ answers: Array(36).fill(1) }));
  assert.equal(rawOnes.dimensions[0].score, 4);
  assert.equal(rawOnes.dimensions[1].score, 1.33);
  assert.equal(rawOnes.reportContent.viewModel.answers.every((value) => value === 1), true);
});

test("结果页会自动挂上分享，封面仍显示成人依恋", async () => {
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const page = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const kit = await readFile(new URL("./cloud-kit.js", import.meta.url), "utf8");
  assert.equal(app.includes("mountEcrCloud"), true);
  assert.equal(app.includes("data-cloud-slot"), true);
  assert.equal(app.includes("打印报告"), true);
  assert.equal(app.includes("不会上传"), false);
  assert.equal(app.includes("先写一个称呼，再开始。"), true);
  assert.equal(app.includes('maxlength="12"'), true);
  assert.equal(app.includes("怎么称呼你"), true);
  assert.equal(app.includes("<h1>成人依恋</h1>"), true);
  assert.equal(page.includes("成人依恋"), true);
  assert.equal(page.includes("不会上传"), false);
  assert.equal(app.includes('assessmentId: "ecr-cn"'), false);
  assert.equal(kit.includes("分享结果"), true);
  assert.equal(kit.includes("ecr-cn-v1"), false);
  assert.equal(kit.includes("成人依恋关系测评"), false);
  assert.equal(kit.includes("二维码"), false);
  assert.equal(kit.includes("微信"), false);
});
