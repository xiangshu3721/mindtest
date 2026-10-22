import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { QUESTIONS, SCALES } from "./data.js";
import { scorePdq4 } from "./score.js";
import {
  ASSESSMENT_NAME,
  buildPdq4Result,
  pdq4Nickname,
  pdq4ScaleIds,
} from "./cloud-payload.js";

const SCALE_IDS = ["par", "szd", "szt", "ant", "bor", "his", "nar", "avo", "dep", "ocp", "pag", "dps"];

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

function honest() {
  const answers = Array(QUESTIONS.length).fill(0);
  [12, 25, 38].forEach((n) => {
    answers[n - 1] = 1;
  });
  return answers;
}

test("称呼取前 12 个字，空称呼不上传", () => {
  assert.equal(pdq4Nickname("  林深  "), "林深");
  assert.equal(pdq4Nickname(`${"林深".repeat(6)}\uE000\uE001`), "林深".repeat(6));
  assert.equal(pdq4Nickname("   "), "");
  assert.equal(buildPdq4Result(base({ nickname: "  ", answers: Array(126).fill(0) })), null);
  assert.equal(buildPdq4Result(base({ answers: Array(125).fill(0) })), null);
  assert.equal(buildPdq4Result(base({ answers: Array(126).fill(0), reportId: "" })), null);
  assert.equal(buildPdq4Result(base({ answers: Array(126).fill(2) })), null);
});

test("payload 与 scorePdq4 一致，且不带性别年龄", () => {
  const answers = honest();
  const par = SCALES.find((scale) => scale.id === "par");
  const bor = SCALES.find((scale) => scale.id === "bor");
  par.items.slice(0, par.cutoff).forEach((n) => {
    answers[n - 1] = 1;
  });
  bor.items.slice(0, bor.cutoff).forEach((n) => {
    answers[n - 1] = 1;
  });
  answers[105] = 1;
  answers[106] = 1;
  const scored = scorePdq4(answers);
  const report = buildPdq4Result(base({
    nickname: `${"林深".repeat(6)}\uE000\uE001`,
    answers,
    gender: "SECRET_GENDER",
    age: "SECRET_AGE",
    profile: { gender: "SECRET_GENDER", age: "SECRET_AGE" },
    rushed: true,
  }));
  const packed = JSON.stringify(report);
  assert.equal(report.assessmentId, "pdq4");
  assert.equal(packed.includes("pdq-4"), false);
  assert.equal(report.assessmentName, ASSESSMENT_NAME);
  assert.equal(report.assessmentName, "人格障碍筛查 PDQ-4");
  assert.equal(report.assessmentName.includes("PDQ-4"), true);
  assert.equal(report.assessmentName.includes("人格障碍"), true);
  assert.equal(report.schemaVersion, "1.0.0");
  assert.equal(report.nickname, "林深".repeat(6));
  assert.equal(packed.includes("\uE000"), false);
  assert.equal(packed.includes("\uE001"), false);
  assert.equal(packed.includes("SECRET_GENDER"), false);
  assert.equal(packed.includes("SECRET_AGE"), false);
  assert.equal(keysOf(report).includes("gender"), false);
  assert.equal(keysOf(report).includes("age"), false);
  assert.equal(keysOf(report).includes("profile"), false);
  assert.deepEqual(report.dimensions.map((item) => item.id), pdq4ScaleIds());
  assert.deepEqual(report.dimensions.map((item) => item.id), SCALE_IDS);
  assert.equal(report.dimensions.length, 12);
  report.dimensions.forEach((item, index) => {
    const scale = scored.scales[index];
    assert.equal(item.kind, "score");
    assert.equal(item.score, scale.score);
    assert.equal(item.max, scale.max);
    assert.equal(item.cutoff, scale.cutoff);
    assert.equal(item.positive, scale.positive);
    assert.equal(item.cluster, scale.cluster);
    assert.equal(item.name, scale.name);
    assert.deepEqual(item.labels, []);
    assert.equal(report.reportContent.viewModel.scales[index].score, scale.score);
    assert.equal(report.reportContent.viewModel.scales[index].max, scale.max);
    assert.equal(report.reportContent.viewModel.scales[index].cutoff, scale.cutoff);
    assert.equal(report.reportContent.viewModel.scales[index].positive, scale.positive);
    assert.equal(report.reportContent.viewModel.scales[index].cluster, scale.cluster);
    assert.equal(report.extensionData.score.scales[index].score, scale.score);
  });
  const view = report.reportContent.viewModel;
  assert.equal(view.answers.length, 126);
  assert.deepEqual(view.answers, answers);
  assert.deepEqual(report.extensionData.answers, answers);
  assert.equal(view.positiveCount, scored.positiveCount);
  assert.equal(view.total, scored.total);
  assert.deepEqual(view.tooGood, scored.tooGood);
  assert.deepEqual(view.suspect, scored.suspect);
  assert.deepEqual(view.impulse, scored.impulse);
  assert.deepEqual(view.conduct, scored.conduct);
  assert.deepEqual(view.verdict, scored.verdict);
  assert.equal(view.rushed, true);
  assert.equal(report.result.headline, scored.verdict.title);
  assert.equal(report.result.summary, scored.verdict.text);
  assert.equal(report.result.label, scored.verdict.title);
  assert.equal(report.result.code, scored.verdict.id);
  assert.equal(report.reportContent.textFallback.includes("筛查，不是诊断"), true);
  assert.equal(report.interpretation.some((item) => item.id === "screen"), true);
  assert.equal(report.source.repo, "mindtest");
  assert.equal(report.source.path, "pdq/index.html");
  assert.equal(report.source.origin, "external-repo");
  assert.equal(report.source.resultKitId, "pdq4");
  assert.equal(report.source.site, "ASVA 常用心理测试");
  assert.equal(report.extensionData.consent.agreed, true);
  assert.equal(report.reportContent.format, "view-model+sections");
});

test("全否与全是的分数跟着 scorePdq4", () => {
  const lowAnswers = Array(126).fill(0);
  const low = buildPdq4Result(base({ answers: lowAnswers }));
  const lowScore = scorePdq4(lowAnswers);
  assert.equal(low.result.code, lowScore.verdict.id);
  assert.equal(low.result.headline, lowScore.verdict.title);
  assert.equal(low.reportContent.viewModel.positiveCount, 0);
  assert.equal(low.reportContent.viewModel.total, 0);
  assert.equal(low.reportContent.viewModel.tooGood.flagged, true);
  assert.equal(low.reportContent.viewModel.suspect.flagged, false);
  assert.deepEqual(low.result.flags, ["too-good"]);
  assert.equal(low.dimensions.every((item) => item.score === 0 && item.positive === false), true);

  const highAnswers = Array(126).fill(1);
  const high = buildPdq4Result(base({ answers: highAnswers }));
  const highScore = scorePdq4(highAnswers);
  assert.equal(high.result.headline, highScore.verdict.title);
  assert.equal(high.reportContent.viewModel.positiveCount, 12);
  assert.equal(high.reportContent.viewModel.total, highScore.total);
  assert.equal(high.reportContent.viewModel.impulse.point, 1);
  assert.equal(high.reportContent.viewModel.conduct.point, 1);
  assert.equal(high.reportContent.viewModel.suspect.flagged, true);
  assert.equal(high.dimensions.every((item) => item.positive === true && item.kind === "score"), true);
  high.dimensions.forEach((item, index) => {
    assert.equal(item.score, highScore.scales[index].score);
  });
});

test("结果页会自动挂上分享，本地打印还在", async () => {
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const page = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.equal(app.includes("mountPdq4Cloud"), true);
  assert.equal(app.includes("data-cloud-slot"), true);
  assert.equal(app.includes("打印报告"), true);
  assert.equal(app.includes("不会上传"), false);
  assert.equal(app.includes("筛查，不是诊断"), true);
  assert.equal(app.includes("先写一个称呼，再开始。"), true);
  assert.equal(app.includes('maxlength="12"'), true);
  assert.equal(page.includes("不会上传"), false);
  assert.equal(app.includes('assessmentId: "pdq-4"'), false);
  assert.equal(app.includes("gender"), false);
  assert.equal(app.includes("年龄"), true);
});
