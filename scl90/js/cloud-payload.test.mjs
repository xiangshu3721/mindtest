import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { FACTORS } from "./data.js";
import { scoreScl90 } from "./score.js";
import {
  ASSESSMENT_NAME,
  buildScl90Result,
  scl90FactorIds,
  scl90Nickname,
} from "./cloud-payload.js";

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

test("昵称取姓名前 12 个字，空姓名不上传", () => {
  assert.equal(scl90Nickname("  林深  "), "林深");
  assert.equal(scl90Nickname(`${"林深".repeat(6)}\uE000\uE001`), "林深".repeat(6));
  assert.equal(scl90Nickname("   "), "");
  assert.equal(buildScl90Result(base({ nickname: "  ", answers: Array(90).fill(1) })), null);
  assert.equal(buildScl90Result(base({ answers: Array(89).fill(1) })), null);
  assert.equal(buildScl90Result(base({ answers: Array(90).fill(1), reportId: "" })), null);
});

test("payload 与 scoreScl90 一致，且不带性别年龄", () => {
  const answers = Array(90).fill(1);
  FACTORS.find((factor) => factor.id === "som").items.forEach((n) => {
    answers[n - 1] = 3;
  });
  answers[14] = 5;
  const scored = scoreScl90(answers);
  const report = buildScl90Result(base({
    nickname: `${"林深".repeat(6)}\uE000\uE001`,
    answers,
    gender: "SECRET_GENDER",
    age: "SECRET_AGE",
    profile: { gender: "SECRET_GENDER", age: "SECRET_AGE" },
    rushed: true,
  }));
  const packed = JSON.stringify(report);
  assert.equal(report.assessmentId, "scl90");
  assert.equal(report.assessmentName, ASSESSMENT_NAME);
  assert.equal(report.assessmentName, "SCL-90 症状自评量表");
  assert.equal(report.schemaVersion, "1.0.0");
  assert.equal(report.nickname, "林深".repeat(6));
  assert.equal(packed.includes("\uE000"), false);
  assert.equal(packed.includes("\uE001"), false);
  assert.equal(packed.includes("SECRET_GENDER"), false);
  assert.equal(packed.includes("SECRET_AGE"), false);
  assert.equal(keysOf(report).includes("gender"), false);
  assert.equal(keysOf(report).includes("age"), false);
  assert.equal(keysOf(report).includes("profile"), false);
  assert.deepEqual(report.dimensions.map((item) => item.id), scl90FactorIds());
  assert.deepEqual(report.dimensions.map((item) => item.id), FACTORS.map((factor) => factor.id));
  report.dimensions.forEach((item, index) => {
    const factor = scored.factors[index];
    assert.equal(item.kind, "score");
    assert.equal(item.max, 5);
    assert.equal(item.score, factor.mean);
    assert.equal(item.raw, factor.raw);
    assert.equal(item.level, factor.level);
    assert.equal(item.levelLabel, factor.levelLabel);
    assert.equal(item.name, factor.name);
    assert.deepEqual(item.labels, []);
    assert.equal(report.reportContent.viewModel.factors[index].score, factor.mean);
    assert.equal(report.reportContent.viewModel.factors[index].raw, factor.raw);
    assert.equal(report.extensionData.score.factors[index].mean, factor.mean);
    assert.equal(report.extensionData.score.factors[index].raw, factor.raw);
  });
  assert.equal(report.reportContent.viewModel.total, scored.total);
  assert.equal(report.reportContent.viewModel.gsi, scored.gsi);
  assert.equal(report.reportContent.viewModel.positiveCount, scored.positiveCount);
  assert.equal(report.reportContent.viewModel.negativeCount, scored.negativeCount);
  assert.equal(report.reportContent.viewModel.positiveMean, scored.positiveMean);
  assert.equal(report.reportContent.viewModel.positive, scored.positive);
  assert.deepEqual(report.reportContent.viewModel.answers, answers);
  assert.deepEqual(report.extensionData.answers, answers);
  assert.equal(report.result.headline, scored.verdictTitle);
  assert.equal(report.result.summary, scored.verdictText);
  assert.equal(report.result.label, scored.verdictTitle);
  assert.equal(report.result.code, "positive");
  assert.deepEqual(report.result.flags, ["positive"]);
  assert.equal(report.interpretation[0].id, "crisis");
  assert.equal(report.interpretation[0].text, scored.crisis.text);
  assert.equal(report.reportContent.sections[0].x, scored.crisis.text);
  assert.equal(report.reportContent.textFallback.includes(scored.crisis.text), true);
  assert.equal(report.reportContent.textFallback.includes("12356"), true);
  assert.deepEqual(report.recommendations.map((item) => item.text), scored.guidance);
  assert.equal(report.source.repo, "mindtest");
  assert.equal(report.source.path, "scl90/index.html");
  assert.equal(report.source.origin, "external-repo");
  assert.equal(report.source.resultKitId, "scl90");
  assert.equal(report.source.site, "ASVA 常用心理测试");
  assert.equal(report.extensionData.consent.agreed, true);
  assert.equal(report.reportContent.format, "view-model+sections");
  assert.equal(report.reportContent.viewModel.rushed, true);
});

test("全 1 与全 5 的筛查码跟着 scoreScl90", () => {
  const low = buildScl90Result(base({ answers: Array(90).fill(1) }));
  const lowScore = scoreScl90(Array(90).fill(1));
  assert.equal(low.result.code, "negative");
  assert.deepEqual(low.result.flags, []);
  assert.equal(low.result.headline, lowScore.verdictTitle);
  assert.equal(low.reportContent.viewModel.positiveMean, null);
  assert.equal(low.reportContent.viewModel.gsi, 1);
  assert.equal(low.interpretation.some((item) => item.id === "crisis"), false);

  const high = buildScl90Result(base({ answers: Array(90).fill(5) }));
  const highScore = scoreScl90(Array(90).fill(5));
  assert.equal(high.result.headline, highScore.verdictTitle);
  assert.equal(high.reportContent.viewModel.total, 450);
  assert.equal(high.reportContent.viewModel.gsi, 5);
  assert.equal(high.reportContent.viewModel.positiveCount, 90);
  assert.equal(high.reportContent.viewModel.positiveMean, 5);
  assert.equal(high.dimensions.every((item) => item.score === 5 && item.level === "severe"), true);
  assert.equal(high.interpretation[0].text, highScore.crisis.text);
});

test("结果页会自动挂上分享，本地打印还在", async () => {
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const page = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.equal(app.includes("mountScl90Cloud"), true);
  assert.equal(app.includes("data-cloud-slot"), true);
  assert.equal(app.includes("打印报告"), true);
  assert.equal(app.includes("作答和计分都留在这台设备上，不会上传"), false);
  assert.equal(app.includes("性别和年龄不会上传"), true);
  assert.equal(page.includes("不会上传"), false);
  assert.equal(app.includes('assessmentId: "scl-90"'), false);
});
