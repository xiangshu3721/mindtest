import assert from "node:assert/strict";
import test from "node:test";
import { DIMENSIONS, QUESTIONS, REVERSE_ITEMS, TYPES } from "./data.js";
import { rushCheck, scoreEcr, scoredValue } from "./score.js";

const REVERSE = new Set(REVERSE_ITEMS);

function pattern({ avoidance = 1, anxiety = 1 } = {}) {
  return QUESTIONS.map((_, index) => {
    const n = index + 1;
    const want = n % 2 === 1 ? avoidance : anxiety;
    return REVERSE.has(n) ? 8 - want : want;
  });
}

test("36 items split evenly, reverse key is the Chinese ECR key", () => {
  assert.equal(QUESTIONS.length, 36);
  assert.deepEqual(REVERSE_ITEMS, [3, 15, 19, 22, 25, 27, 29, 31, 33, 35]);
  assert.deepEqual(DIMENSIONS[0].items, Array.from({ length: 18 }, (_, i) => i * 2 + 1));
  assert.deepEqual(DIMENSIONS[1].items, Array.from({ length: 18 }, (_, i) => i * 2 + 2));
  assert.equal(TYPES.map((type) => type.id).join(), "secure,fearful,preoccupied,dismissing");
});

test("reverse scoring flips only the keyed items", () => {
  assert.equal(scoredValue(1, 1), 1);
  assert.equal(scoredValue(3, 1), 7);
  assert.equal(scoredValue(22, 7), 1);
  assert.equal(scoredValue(36, 5), 5);
});

test("all fours sits on the midpoint and classifies as fearful", () => {
  const result = scoreEcr(Array(36).fill(4));
  assert.equal(result.avoidance.mean, 4);
  assert.equal(result.anxiety.mean, 4);
  assert.equal(result.avoidance.sum, 72);
  assert.equal(result.anxiety.sum, 72);
  assert.equal(result.type.id, "fearful");
  assert.equal(result.quadrant, null);
  assert.equal(result.nearMidpoint, true);
  assert.equal(result.types.find((type) => type.win).m, 29.3);
});

test("prototypes land on the four types", () => {
  assert.equal(scoreEcr(pattern({ avoidance: 1, anxiety: 1 })).type.id, "secure");
  assert.equal(scoreEcr(pattern({ avoidance: 1, anxiety: 7 })).type.id, "preoccupied");
  assert.equal(scoreEcr(pattern({ avoidance: 7, anxiety: 1 })).type.id, "dismissing");
  assert.equal(scoreEcr(pattern({ avoidance: 7, anxiety: 7 })).type.id, "fearful");
});

test("raw all-ones and all-sevens follow the reverse key", () => {
  const low = scoreEcr(Array(36).fill(1));
  assert.equal(low.avoidance.mean, 4);
  assert.equal(low.anxiety.mean, 1.33);
  assert.equal(low.type.id, "dismissing");

  const high = scoreEcr(Array(36).fill(7));
  assert.equal(high.avoidance.mean, 4);
  assert.equal(high.anxiety.mean, 6.67);
  assert.equal(high.type.id, "preoccupied");
});

test("a high-anxiety low-avoidance pattern differs from a 4-point grid only when the formula says so", () => {
  const result = scoreEcr(pattern({ avoidance: 2, anxiety: 6 }));
  assert.equal(result.avoidance.mean, 2);
  assert.equal(result.anxiety.mean, 6);
  assert.equal(result.quadrant, "preoccupied");
  assert.equal(result.type.id, "preoccupied");
  assert.equal(result.differsFromQuadrant, false);
  assert.equal(result.avoidance.level, "low");
  assert.equal(result.anxiety.level, "high");
});

test("more than half of the gaps under 1.5 seconds blocks the report", () => {
  const slow = Array.from({ length: 36 }, (_, index) => index * 2000);
  assert.equal(rushCheck(slow).tooFast, false);

  const fast = Array.from({ length: 36 }, (_, index) => index * 400);
  const check = rushCheck(fast);
  assert.equal(check.gaps, 35);
  assert.equal(check.tooFast, true);

  const half = Array.from({ length: 36 }, (_, index) => index * 2000);
  for (let i = 1; i <= 17; i += 1) half[i] = half[i - 1] + 200;
  assert.equal(rushCheck(half).fastGaps, 17);
  assert.equal(rushCheck(half).tooFast, false);
});

test("incomplete answers are rejected", () => {
  assert.throws(() => scoreEcr(Array(35).fill(4)));
  assert.throws(() => scoreEcr(Array(36).fill(0)));
});
