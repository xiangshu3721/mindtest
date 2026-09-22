import assert from "node:assert/strict";
import test from "node:test";
import { FACTORS, QUESTIONS } from "./data.js";
import { factorLevel, gsiBand, rushCheck, scoreScl90 } from "./score.js";

test("items partition the 90 questions once", () => {
  assert.equal(QUESTIONS.length, 90);
  const seen = new Map();
  for (const factor of FACTORS) {
    for (const n of factor.items) {
      assert.equal(seen.has(n), false, `${n} duplicated`);
      seen.set(n, factor.id);
    }
  }
  assert.equal(seen.size, 90);
  for (let n = 1; n <= 90; n += 1) assert.equal(seen.has(n), true);
});

test("all ones is a negative screen", () => {
  const result = scoreScl90(Array(90).fill(1));
  assert.equal(result.total, 90);
  assert.equal(result.gsi, 1);
  assert.equal(result.positiveCount, 0);
  assert.equal(result.negativeCount, 90);
  assert.equal(result.positiveMean, null);
  assert.equal(result.positive, false);
  assert.equal(result.factors.every((factor) => factor.mean === 1 && factor.level === "none"), true);
  assert.equal(result.crisis, null);
});

test("all fives is a positive screen at the top of every factor", () => {
  const result = scoreScl90(Array(90).fill(5));
  assert.equal(result.total, 450);
  assert.equal(result.gsi, 5);
  assert.equal(result.positiveCount, 90);
  assert.equal(result.negativeCount, 0);
  assert.equal(result.positiveMean, 5);
  assert.equal(result.positive, true);
  assert.equal(result.rules.every((rule) => rule.hit), true);
  assert.equal(result.factors.every((factor) => factor.mean === 5 && factor.level === "severe"), true);
  assert.equal(result.crisis.level, "urgent");
  assert.equal(result.notable.length, 90);
});

test("screening boundaries use strict greater-than", () => {
  const atTotal = Array(90).fill(1);
  for (let i = 0; i < 70; i += 1) atTotal[i] = 2;
  assert.equal(atTotal.reduce((sum, value) => sum + value, 0), 160);
  assert.equal(scoreScl90(atTotal).rules.find((rule) => rule.id === "total").hit, false);

  const overTotal = [...atTotal];
  overTotal[89] = 2;
  assert.equal(overTotal.reduce((sum, value) => sum + value, 0), 161);
  assert.equal(scoreScl90(overTotal).rules.find((rule) => rule.id === "total").hit, true);

  const fortyThree = Array(90).fill(1);
  for (let i = 0; i < 43; i += 1) fortyThree[i] = 2;
  const onLine = scoreScl90(fortyThree);
  assert.equal(onLine.positiveCount, 43);
  assert.equal(onLine.rules.find((rule) => rule.id === "positive").hit, false);

  fortyThree[43] = 2;
  assert.equal(scoreScl90(fortyThree).rules.find((rule) => rule.id === "positive").hit, true);
});

test("factor mean uses its own items only", () => {
  const answers = Array(90).fill(1);
  const som = FACTORS.find((factor) => factor.id === "som");
  for (const n of som.items) answers[n - 1] = 5;
  const result = scoreScl90(answers);
  const scored = result.factors.find((factor) => factor.id === "som");
  assert.equal(scored.raw, 60);
  assert.equal(scored.mean, 5);
  assert.equal(result.total, 78 + 60);
  assert.equal(result.factors.filter((factor) => factor.mean === 1).length, 9);
  assert.equal(scored.aboveNorm, true);
  assert.equal(scored.screened, true);
});

test("positive symptom mean ignores items scored 1", () => {
  const answers = Array(90).fill(1);
  for (let i = 0; i < 10; i += 1) answers[i] = 4;
  const result = scoreScl90(answers);
  assert.equal(result.positiveCount, 10);
  assert.equal(result.negativeCount, 80);
  assert.equal(result.positiveMean, 4);
  assert.equal(result.total, 80 + 40);
});

test("level and symptom-index bands", () => {
  assert.equal(factorLevel(2).id, "none");
  assert.equal(factorLevel(2.01).id, "mild");
  assert.equal(factorLevel(3).id, "mild");
  assert.equal(factorLevel(3.01).id, "moderate");
  assert.equal(factorLevel(4).id, "moderate");
  assert.equal(factorLevel(4.01).id, "severe");
  assert.equal(gsiBand(1.5).id, "clear");
  assert.equal(gsiBand(2.5).id, "occasional");
  assert.equal(gsiBand(2.51).id, "mildModerate");
  assert.equal(gsiBand(3.5).id, "mildModerate");
  assert.equal(gsiBand(4.5).id, "moderateSevere");
  assert.equal(gsiBand(4.51).id, "extreme");
});

test("additional items do not by themselves trigger the nine-factor screen", () => {
  const answers = Array(90).fill(1);
  for (const n of FACTORS.find((factor) => factor.id === "add").items) answers[n - 1] = 5;
  const result = scoreScl90(answers);
  assert.equal(result.rules.find((rule) => rule.id === "factor").hit, false);
  assert.equal(result.positive, false);
  assert.equal(result.factors.find((factor) => factor.id === "add").screened, true);
  assert.match(result.guidance[0], /其他/);
});

test("item 15 drives the crisis notice", () => {
  const calm = Array(90).fill(1);
  calm[58] = 5;
  assert.equal(scoreScl90(calm).crisis.level, "note");
  calm[14] = 2;
  assert.equal(scoreScl90(calm).crisis.level, "alert");
  calm[14] = 4;
  assert.equal(scoreScl90(calm).crisis.level, "urgent");
});

test("rush check uses half of the gaps under 1.5 seconds", () => {
  const start = 1_000_000;
  const steady = Array.from({ length: 90 }, (_, i) => start + i * 2000);
  assert.equal(rushCheck(steady).tooFast, false);
  const rushed = Array.from({ length: 90 }, (_, i) => start + i * 400);
  assert.equal(rushCheck(rushed).tooFast, true);
  const justUnder = Array.from({ length: 90 }, (_, i) => (
    i <= 44 ? start + i * 400 : start + 44 * 400 + (i - 44) * 2000
  ));
  assert.equal(rushCheck(justUnder).fastGaps, 44);
  assert.equal(rushCheck(justUnder).tooFast, false);
  const justOver = Array.from({ length: 90 }, (_, i) => (
    i <= 45 ? start + i * 400 : start + 45 * 400 + (i - 45) * 2000
  ));
  assert.equal(rushCheck(justOver).fastGaps, 45);
  assert.equal(rushCheck(justOver).tooFast, true);
});
