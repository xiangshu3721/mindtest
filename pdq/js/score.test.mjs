import assert from "node:assert/strict";
import test from "node:test";
import {
  CONDUCT_ITEMS,
  IMPULSE_ITEMS,
  QUESTIONS,
  SCALES,
  SUSPECT_YES,
  TOO_GOOD_REVERSE,
  TOO_GOOD_YES,
} from "./data.js";
import { rushCheck, scorePdq4 } from "./score.js";

function blank() {
  return Array(QUESTIONS.length).fill(0);
}

function honest() {
  const answers = blank();
  TOO_GOOD_REVERSE.forEach((n) => {
    answers[n - 1] = 1;
  });
  return answers;
}

function mark(answers, items) {
  items.forEach((n) => {
    answers[n - 1] = 1;
  });
  return answers;
}

test("questionnaire length and scale sizes match the published key", () => {
  assert.equal(QUESTIONS.length, 126);
  const expected = {
    par: [7, 4], szd: [7, 4], szt: [9, 5], ant: [8, 3], bor: [9, 5], his: [8, 5],
    nar: [9, 5], avo: [7, 4], dep: [8, 5], ocp: [8, 4], pag: [7, 4], dps: [7, 5],
  };
  for (const scale of SCALES) {
    const extra = scale.extra ? 1 : 0;
    assert.deepEqual([scale.items.length + extra, scale.cutoff], expected[scale.id], scale.id);
  }
});

test("all 否 is below every cutoff and flags 掩饰", () => {
  const result = scorePdq4(blank());
  assert.equal(result.positiveCount, 0);
  assert.equal(result.total, 0);
  assert.equal(result.tooGood.score, 3);
  assert.equal(result.tooGood.flagged, true);
  assert.equal(result.suspect.flagged, false);
  assert.equal(result.verdict.id, "too-good-clear");
});

test("all 是 maxes every scale and flags 怀疑", () => {
  const result = scorePdq4(Array(QUESTIONS.length).fill(1));
  assert.equal(result.positiveCount, 12);
  assert.equal(result.impulse.point, 1);
  assert.equal(result.conduct.point, 1);
  assert.equal(result.tooGood.flagged, false);
  assert.equal(result.suspect.flagged, true);
  assert.equal(result.verdict.id, "suspect");
});

test("cutoff is inclusive and the point below stays negative", () => {
  for (const scale of SCALES) {
    const under = scorePdq4(mark(blank(), scale.items.slice(0, scale.cutoff - 1)));
    const underScale = under.scales.find((item) => item.id === scale.id);
    assert.equal(underScale.positive, false, scale.id);
    assert.equal(underScale.score, scale.cutoff - 1);
    const on = scorePdq4(mark(blank(), scale.items.slice(0, scale.cutoff)));
    const onScale = on.scales.find((item) => item.id === scale.id);
    assert.equal(onScale.positive, true, scale.id);
    assert.equal(onScale.score, scale.cutoff);
  }
});

test("item 60 scores on both 分裂样 and 分裂型", () => {
  const result = scorePdq4(mark(blank(), [60]));
  assert.equal(result.scales.find((scale) => scale.id === "szd").score, 1);
  assert.equal(result.scales.find((scale) => scale.id === "szt").score, 1);
  assert.equal(result.total, 2);
});

test("impulsivity becomes one borderline point only at two yes answers", () => {
  assert.equal(scorePdq4(mark(blank(), [IMPULSE_ITEMS[0]])).impulse.point, 0);
  const two = scorePdq4(mark(blank(), IMPULSE_ITEMS.slice(0, 2)));
  assert.equal(two.impulse.point, 1);
  assert.equal(two.scales.find((scale) => scale.id === "bor").score, 1);
});

test("childhood conduct becomes one antisocial point only at three yes answers", () => {
  assert.equal(scorePdq4(mark(blank(), CONDUCT_ITEMS.slice(0, 2))).conduct.point, 0);
  const three = scorePdq4(mark(blank(), CONDUCT_ITEMS.slice(0, 3)));
  assert.equal(three.conduct.point, 1);
  assert.equal(three.scales.find((scale) => scale.id === "ant").score, 1);
});

test("validity items stay out of the twelve scales", () => {
  const answers = mark(blank(), [...TOO_GOOD_YES, ...SUSPECT_YES]);
  const result = scorePdq4(answers);
  assert.equal(result.total, 0);
  assert.equal(result.tooGood.score, 4);
  assert.equal(result.suspect.score, 2);
  assert.equal(result.verdict.id, "invalid");
});

test("a single positive scale names that scale", () => {
  const par = SCALES.find((scale) => scale.id === "par");
  const result = scorePdq4(mark(honest(), par.items.slice(0, par.cutoff)));
  assert.equal(result.verdict.id, "one");
  assert.equal(result.positiveScales.map((scale) => scale.id).join(), "par");
});

test("rush uses half of the gaps under 1.5 seconds", () => {
  assert.equal(rushCheck(Array.from({ length: 126 }, (_, i) => i * 2000)).tooFast, false);
  const rushed = rushCheck(Array.from({ length: 126 }, (_, i) => i * 400));
  assert.equal(rushed.gaps, 125);
  assert.equal(rushed.tooFast, true);
});
