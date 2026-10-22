import { OPTIONS, QUESTIONS, REVERSE_ITEMS, SCALE, TYPES } from "./data.js";
import { formatScore, rushCheck, scoreEcr, scoredValue } from "./score.js";

const app = document.querySelector("#app");
const STORAGE = "ecr-session";
const REVERSE = new Set(REVERSE_ITEMS);

const state = {
  step: "cover",
  index: 0,
  answers: Array(QUESTIONS.length).fill(null),
  times: Array(QUESTIONS.length).fill(null),
  result: null,
  error: "",
};

let advanceToken = 0;

function load() {
  try {
    const raw = sessionStorage.getItem(STORAGE);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved.answers) || saved.answers.length !== QUESTIONS.length) return;
    state.answers = saved.answers;
    state.times = Array.isArray(saved.times) && saved.times.length === QUESTIONS.length
      ? saved.times
      : state.times;
    state.index = Number.isInteger(saved.index) ? saved.index : 0;
    state.step = saved.step || "cover";
    if (state.step === "report" && complete()) {
      state.result = scoreEcr(state.answers);
    } else if (state.step === "report") {
      state.step = "test";
    }
  } catch {
    sessionStorage.removeItem(STORAGE);
  }
}

function save() {
  sessionStorage.setItem(STORAGE, JSON.stringify({
    step: state.step,
    index: state.index,
    answers: state.answers,
    times: state.times,
  }));
}

function complete() {
  return state.answers.every((value) => value != null);
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function optionLabel(score) {
  return OPTIONS.find((option) => option.value === score)?.label ?? "";
}

function render() {
  const view = {
    cover: renderCover,
    test: renderTest,
    rush: renderRush,
    report: renderReport,
  }[state.step];
  app.innerHTML = view();
  const focus = app.querySelector("[data-autofocus]");
  if (focus) focus.focus();
}

function shell(inner) {
  return `<main class="frame"><article class="sheet">${inner}</article></main>`;
}

function renderCover() {
  const types = TYPES.map((type, index) => `
    <li>
      <b>${pad(index + 1)}</b>
      <span>${esc(type.name)}</span>
      <em>${esc(type.short)}</em>
    </li>
  `).join("");
  return shell(`
    <p class="kicker">ECR</p>
    <h1>成人依恋</h1>
    <p class="ename">${esc(SCALE.name)}</p>
    <p class="lead">${esc(SCALE.intro)}</p>
    <p class="lead quiet">${esc(SCALE.instruction)}</p>
    <div class="meta">
      <span>36 题</span>
      <span>七点作答</span>
      <span>所有恋爱经历</span>
      <span>约 8 分钟</span>
    </div>
    <div class="actions">
      <button class="primary" data-action="start" type="button">开始测评</button>
    </div>
    <h2>两种感觉，四种相处</h2>
    <p class="sub">回避看你对亲近和依赖紧不紧。焦虑看你会不会怕被丢下。两个分数合在一起，归到下面四种里最高的那一型。</p>
    <ol class="types">${types}</ol>
    <p class="fine">作答和计分都留在这台设备上，不会上传。结果用来看你在亲密关系里的习惯，不是诊断。</p>
  `);
}

function renderTest() {
  const index = state.index;
  const answer = state.answers[index];
  const width = ((index + (answer ? 1 : 0)) / QUESTIONS.length) * 100;
  const options = OPTIONS.map((option) => `
    <button class="option" type="button" data-action="answer" data-value="${option.value}" aria-checked="${answer === option.value}">
      <b>${option.value}</b>
      <span>${esc(option.label)}</span>
    </button>
  `).join("");
  const last = index === QUESTIONS.length - 1;
  return shell(`
    <div class="progress" aria-hidden="true"><span style="width:${width}%"></span></div>
    <div class="q-top">
      <span>${pad(index + 1)} / ${QUESTIONS.length}</span>
      <span>亲密关系</span>
    </div>
    <h2 class="question" data-autofocus tabindex="-1">${esc(QUESTIONS[index])}</h2>
    <p class="prompt">${index === 0 ? esc(SCALE.instruction) : "按你在恋爱经历里常常有的感觉来选。"}</p>
    <div class="options" role="radiogroup" aria-label="第 ${index + 1} 题">${options}</div>
    <p class="hint">${esc(state.error)}</p>
    <div class="nav">
      <button class="ghost" type="button" data-action="prev" ${index === 0 ? "disabled" : ""}>上一题</button>
      <button class="primary" type="button" data-action="next">${last ? "生成报告" : "下一题"}</button>
    </div>
  `);
}

function renderRush() {
  const check = rushCheck(state.times);
  const percent = Math.round(check.ratio * 100);
  return shell(`
    <p class="kicker">作答速度</p>
    <h1>有些题答得太快</h1>
    <p class="lead">相邻题目里，有 ${percent}% 的间隔不到 1.5 秒。超过一半时，这份量表不生成结果。</p>
    <p class="lead quiet">稍安勿躁，请再做一遍。</p>
    <div class="actions">
      <button class="primary" type="button" data-action="restart">重新作答</button>
    </div>
  `);
}

function axisNote(result) {
  const avoid = `${result.avoidance.name} ${formatScore(result.avoidance.mean)}，${result.avoidance.levelLabel}`;
  const anxiety = `${result.anxiety.name} ${formatScore(result.anxiety.mean)}，${result.anxiety.levelLabel}`;
  return `${avoid}。${anxiety}。中点是 4 分。`;
}

function renderReport() {
  const result = state.result;
  const x = ((result.avoidance.exactMean - 1) / 6) * 100;
  const y = ((result.anxiety.exactMean - 1) / 6) * 100;
  const metrics = result.dimensions.map((dimension) => `
    <div class="metric">
      <b>${formatScore(dimension.mean)}</b>
      <span>${esc(dimension.name)}</span>
      <em>${esc(dimension.levelLabel)} · 总分 ${dimension.sum}</em>
    </div>
  `).join("");
  const factors = result.dimensions.map((dimension) => `
    <section class="factor">
      <header>
        <h3>${esc(dimension.name)}</h3>
        <span>${formatScore(dimension.mean)}</span>
      </header>
      <em class="about">${esc(dimension.about)}</em>
      <div class="bar" aria-hidden="true">
        <b style="width:${((dimension.exactMean - 1) / 6) * 100}%"></b>
        <i style="left:50%"></i>
      </div>
      <p>${esc(dimension.narrative)}</p>
    </section>
  `).join("");
  const typeRows = result.types.map((type) => `
    <li class="${type.win ? "win" : ""}">
      <span>${esc(type.name)}</span>
      <b>${formatScore(type.m)}</b>
    </li>
  `).join("");
  const notes = [
    result.tied ? "两个类型的判别分相同，并列写在上面。" : "",
    result.closeCall && !result.tied ? `第一型只比第二型高 ${formatScore(result.margin)} 分。可以当作倾向，不必当成唯一标签。` : "",
    result.nearMidpoint ? "两个均分都贴着中点。类型仍然按判别分最高的一项给出，风格并不鲜明。" : "",
    result.differsFromQuadrant
      ? `若只按 4 分切成四格，会落到${result.quadrantName}。这份量表用判别式，最高的是${result.type.name}。`
      : "",
  ].filter(Boolean);
  const noteHtml = notes.length
    ? `<div class="notes">${notes.map((note) => `<p>${esc(note)}</p>`).join("")}</div>`
    : "";
  const ledger = QUESTIONS.map((text, index) => {
    const raw = state.answers[index];
    const scored = scoredValue(index + 1, raw);
    const reversed = REVERSE.has(index + 1);
    return `
      <li>
        <b>${pad(index + 1)}</b>
        <span>${esc(text)}</span>
        <span>${esc(optionLabel(raw))}${reversed ? ` · 计 ${scored}` : ""}</span>
      </li>
    `;
  }).join("");

  return shell(`
    <p class="kicker">测评结果</p>
    <h1>${esc(result.type.name)}</h1>
    <p class="ename">${esc(result.type.short)}</p>
    <p class="lead">${esc(axisNote(result))}</p>
    <div class="plane" style="--x:${x}%;--y:${y}%" role="img" aria-label="回避 ${formatScore(result.avoidance.mean)}，焦虑 ${formatScore(result.anxiety.mean)}">
      <div class="plot"><b class="dot"></b></div>
      <span class="axis-x">回避</span>
      <span class="axis-y">焦虑</span>
    </div>
    <p class="fine plane-note">十字是量表中点，不是分型的切线。点越靠右回避越高，越靠上焦虑越高。</p>
    <div class="metrics">${metrics}</div>
    ${factors}
    <h2>四个判别分</h2>
    <p class="sub">类型是分数最高的一项。回避均分记为 A，焦虑均分记为 B。</p>
    <ol class="scores">${typeRows}</ol>
    ${noteHtml}
    <h2>这一型在说什么</h2>
    <p class="story">${esc(result.type.text)}</p>
    <h2>怎么看</h2>
    <ul class="guidance">
      <li>先看两个均分离 4 有多远。4 是量表从 1 到 7 的中点，不是诊断界值。</li>
      <li>再看四个判别分。最高的一项才是类型，不按“超过 4 分就划进高的一边”来切。</li>
      <li>这是你在恋爱经历里常常有的感觉，不是对某一次吵架的结论，也不能代替两个人具体怎么相处。</li>
    </ul>
    <details class="ledger">
      <summary>查看 36 题的作答</summary>
      <ol>${ledger}</ol>
    </details>
    <div class="formulas">
      <p>反向题是第 ${REVERSE_ITEMS.join("、")} 题，计分用 8 减原始分。其余题用原始分。</p>
      <p>回避均分 A = 奇数题之和 ÷ 18。焦虑均分 B = 偶数题之和 ÷ 18。</p>
      <p>安全型 = A×3.2893296 + B×5.4725318 − 11.5307833</p>
      <p>恐惧型 = A×7.2371075 + B×8.1776448 − 32.3553266</p>
      <p>专注型 = A×3.9246754 + B×9.7102446 − 28.4573220</p>
      <p>冷漠型 = A×7.3654621 + B×4.9392039 − 22.2281088</p>
      <p>四个数里取最高的一项。这是筛查式的自评，不是诊断。</p>
    </div>
    <div class="actions">
      <button class="ghost" type="button" data-action="restart">重新测评</button>
      <button class="ghost" type="button" data-action="print">打印报告</button>
    </div>
  `);
}

function go(step) {
  state.step = step;
  state.error = "";
  save();
  render();
  window.scrollTo(0, 0);
}

function reset() {
  sessionStorage.removeItem(STORAGE);
  state.step = "cover";
  state.index = 0;
  state.answers = Array(QUESTIONS.length).fill(null);
  state.times = Array(QUESTIONS.length).fill(null);
  state.result = null;
  state.error = "";
  render();
  window.scrollTo(0, 0);
}

function choose(value) {
  const index = state.index;
  const first = state.answers[index] == null;
  state.answers[index] = value;
  if (state.times[index] == null) state.times[index] = Date.now();
  state.error = "";
  save();
  const token = ++advanceToken;
  render();
  if (first && index < QUESTIONS.length - 1) {
    window.setTimeout(() => {
      if (token !== advanceToken || state.step !== "test" || state.index !== index) return;
      state.index += 1;
      save();
      render();
    }, 150);
  }
}

function finish() {
  if (!complete()) {
    const missing = state.answers.findIndex((value) => value == null);
    state.index = missing;
    state.error = "还有题目没有选择。";
    state.step = "test";
    save();
    render();
    return;
  }
  if (rushCheck(state.times).tooFast) {
    go("rush");
    return;
  }
  state.result = scoreEcr(state.answers);
  go("report");
}

app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === "start") {
    state.index = state.answers.findIndex((value) => value == null);
    if (state.index < 0) state.index = 0;
    go("test");
  }
  if (action === "answer") choose(Number(button.dataset.value));
  if (action === "prev" && state.index > 0) {
    advanceToken += 1;
    state.index -= 1;
    state.error = "";
    save();
    render();
  }
  if (action === "next") {
    advanceToken += 1;
    if (state.answers[state.index] == null) {
      state.error = "请先选择一个答案。";
      render();
      return;
    }
    if (state.index < QUESTIONS.length - 1) {
      state.index += 1;
      state.error = "";
      save();
      render();
      return;
    }
    finish();
  }
  if (action === "restart") reset();
  if (action === "print") window.print();
});

document.addEventListener("keydown", (event) => {
  if (state.step !== "test") return;
  if (event.target.matches("input, textarea")) return;
  const number = Number(event.key);
  if (number >= 1 && number <= 7) {
    event.preventDefault();
    choose(number);
  }
});

load();
render();

const debugParams = new URLSearchParams(location.search);
if (debugParams.has("debug")) {
  window.__ecr = {
    fill(kind) {
      const answers = Array(QUESTIONS.length).fill(4);
      const setDimension = (odd, even) => {
        QUESTIONS.forEach((_, index) => {
          const n = index + 1;
          const want = n % 2 === 1 ? odd : even;
          answers[index] = REVERSE.has(n) ? 8 - want : want;
        });
      };
      if (kind === "secure") setDimension(2, 2);
      if (kind === "fear") setDimension(6, 6);
      if (kind === "preoccupied") setDimension(2, 6);
      if (kind === "dismissing") setDimension(6, 2);
      if (kind === "mid") answers.fill(4);
      state.answers = answers;
      state.times = answers.map((_, index) => Date.now() + index * 2000);
      state.result = scoreEcr(answers);
      go("report");
    },
  };
  if (debugParams.get("fill")) window.__ecr.fill(debugParams.get("fill"));
}
