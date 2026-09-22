import {
  CLUSTERS,
  CONDUCT_ITEMS,
  IMPULSE_ITEMS,
  QUESTIONS,
  SCALE,
  SCALES,
  SUSPECT_YES,
  TOO_GOOD_REVERSE,
  TOO_GOOD_YES,
} from "./data.js";
import { rushCheck, scorePdq4 } from "./score.js";

const app = document.querySelector("#app");
const STORAGE = "pdq4-session";

const state = {
  step: "cover",
  index: 0,
  answers: Array(QUESTIONS.length).fill(null),
  times: Array(QUESTIONS.length).fill(null),
  result: null,
  rushed: false,
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
    state.index = Number.isInteger(saved.index) ? Math.min(saved.index, QUESTIONS.length - 1) : 0;
    state.step = saved.step || "cover";
    state.rushed = Boolean(saved.rushed);
    if ((state.step === "report" || state.step === "rush") && complete()) {
      state.result = scorePdq4(state.answers);
    } else if (state.step === "report" || state.step === "rush") {
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
    rushed: state.rushed,
  }));
}

function complete() {
  return state.answers.every((value) => value === 0 || value === 1);
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
  return String(n).padStart(3, "0");
}

function today() {
  const date = new Date();
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function render() {
  const view = {
    cover: renderCover,
    test: renderTest,
    rush: renderRush,
    report: renderReport,
  }[state.step];
  app.innerHTML = view();
}

function shell(inner) {
  return `<main class="frame"><article class="sheet">${inner}</article></main>`;
}

function renderCover() {
  const answered = state.answers.filter((value) => value === 0 || value === 1).length;
  const resume = answered > 0 && answered < QUESTIONS.length
    ? `<button class="primary" type="button" data-action="resume">继续第 ${state.index + 1} 题</button>`
    : `<button class="primary" type="button" data-action="start">开始测评</button>`;
  return shell(`
    <p class="kicker">PDQ-4+</p>
    <h1>人格障碍筛查</h1>
    <p class="ename">${esc(SCALE.name)}</p>
    <p class="lead">${esc(SCALE.intro)}</p>
    <p class="lead quiet">${esc(SCALE.instruction)}</p>
    <div class="meta">
      <span>126 题</span>
      <span>是 / 否</span>
      <span>过去几年</span>
      <span>约 15 分钟</span>
    </div>
    <div class="actions">${resume}</div>
    <p class="fine">作答和计分都留在这台设备上，不会上传。冲动的 6 个小项、15 岁前的 15 个小项，会各自合成 1 分后再计入边缘型和反社会型。</p>
  `);
}

function stemNote(index) {
  const n = index + 1;
  if (IMPULSE_ITEMS.includes(n)) {
    return "这 6 题描述的是同一条冲动标准。至少 2 个「是」，边缘型才加上这 1 分。";
  }
  if (CONDUCT_ITEMS.includes(n)) {
    return "这 15 题问的是 15 岁以前。至少 3 个「是」，反社会型才加上这 1 分。";
  }
  if (TOO_GOOD_REVERSE.includes(n) || TOO_GOOD_YES.includes(n) || SUSPECT_YES.includes(n)) {
    return "这题只进入作答效度，不进入 12 个分量表。";
  }
  return "";
}

function renderTest() {
  const index = state.index;
  const answer = state.answers[index];
  const width = ((index + (answer === 0 || answer === 1 ? 1 : 0)) / QUESTIONS.length) * 100;
  const note = stemNote(index);
  const last = index === QUESTIONS.length - 1;
  const prompt = index === 0 ? SCALE.instruction : (note || "按过去几年里的一般情况选择。");
  return shell(`
    <div class="progress" aria-hidden="true"><span style="width:${width}%"></span></div>
    <div class="q-top">
      <span>${pad(index + 1)} / ${QUESTIONS.length}</span>
      <span>过去几年</span>
    </div>
    <h2 class="question">${esc(QUESTIONS[index])}</h2>
    <p class="prompt">${esc(prompt)}</p>
    <div class="options" role="radiogroup" aria-label="第 ${index + 1} 题">
      <button class="option" type="button" data-action="answer" data-value="1" aria-checked="${answer === 1}">
        <b>是</b><span>一般来说适合我</span>
      </button>
      <button class="option" type="button" data-action="answer" data-value="0" aria-checked="${answer === 0}">
        <b>否</b><span>一般来说不适合我</span>
      </button>
    </div>
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
    <p class="lead">相邻题目里，有 ${percent}% 的间隔不到 1.5 秒。超过一半时，原测验会请你放慢再做一遍。</p>
    <p class="lead quiet">下面的结果可以看，但更可能只是手快，而不是过去几年的习惯。</p>
    <div class="actions">
      <button class="primary" type="button" data-action="back-to-test">返回修改</button>
      <button class="ghost" type="button" data-action="force-report">仍然查看结果</button>
    </div>
  `);
}

function scaleBlock(scale) {
  const width = scale.max === 0 ? 0 : (scale.score / scale.max) * 100;
  const cut = (scale.cutoff / scale.max) * 100;
  const stateName = scale.positive ? "达到划界" : "未达到";
  const name = scale.alias ? `${scale.name} · ${scale.alias}` : scale.name;
  const portrait = scale.positive ? `<p>${esc(scale.portrait)}</p>` : "";
  return `
    <section class="factor">
      <header>
        <h3>${esc(name)}</h3>
        <span>${scale.score} / ${scale.max}</span>
      </header>
      <em class="about">${esc(scale.about)}</em>
      <div class="bar" aria-hidden="true">
        <b style="width:${width}%"></b>
        <i style="left:${cut}%"></i>
      </div>
      <p class="sub">${stateName} · 划界 ${scale.cutoff} 分</p>
      ${portrait}
    </section>
  `;
}

function validityLine(label, block, detail) {
  const mark = block.flagged ? "需要注意" : "未触发";
  return `<p><b>${esc(label)} ${block.score} / ${block.max}</b> · ${mark}。${esc(detail)}</p>`;
}

function renderReport() {
  const result = state.result;
  const groups = CLUSTERS.map((cluster) => {
    const scales = result.scales.filter((scale) => scale.cluster === cluster.id).map(scaleBlock).join("");
    return `
      <h2>${esc(cluster.name)}</h2>
      <p class="sub">${esc(cluster.note)}</p>
      ${scales}
    `;
  }).join("");
  const tooGoodDetail = result.tooGood.flagged
    ? `第 ${result.tooGood.items.join("、")} 题按掩饰计了分。第 12、25、38 题答「否」，或第 51 题答「是」，会记入这一项。`
    : "第 12、25、38 题答「否」，或第 51 题答「是」，才记分。2 分及以上视为回答偏完美。";
  const suspectDetail = result.suspect.flagged
    ? `第 ${result.suspect.items.join("、")} 题答了「是」。这两题任一为「是」，问卷就按可疑处理。`
    : "第 64 题或第 76 题答「是」时，这份问卷按可疑处理。";
  const rushNote = state.rushed
    ? `<p class="lead quiet">作答偏快。超过一半的间隔不到 1.5 秒，分数仍按选择计算。</p>`
    : "";
  const ledger = QUESTIONS.map((text, index) => `
    <li><b>${pad(index + 1)}</b><span>${esc(text)}</span><span>${state.answers[index] === 1 ? "是" : "否"}</span></li>
  `).join("");

  return shell(`
    <p class="kicker">测评结果 · ${esc(today())}</p>
    <h1>${esc(result.verdict.title)}</h1>
    <p class="lead">${esc(result.verdict.text)}</p>
    ${rushNote}
    <h2>作答效度</h2>
    ${validityLine("掩饰", result.tooGood, tooGoodDetail)}
    ${validityLine("怀疑", result.suspect, suspectDetail)}
    <p class="sub">十二个维度得分之和 ${result.total}。第 60 题同时计入分裂样和分裂型，所以它会在合计里出现两次。判断看的是每一个维度有没有达到自己的划界，不看这一个总数。</p>
    ${groups}
    <div class="formulas">
      <p>临床题答「是」记 1 分，答「否」记 0 分。各维度把自己的题目相加，大于等于划界分即为筛查阳性。</p>
      <p>反社会型划界 3 分。偏执型、分裂样、回避型、强迫型、被动攻击型划界 4 分。分裂型、表演型、自恋型、边缘型、依赖型、抑郁型划界 5 分。</p>
      <p>边缘型的冲动分：第 106–111 题里至少 2 个「是」，整组记 1 分，否则记 0 分。这次是 ${result.impulse.count} 个「是」，记 ${result.impulse.point} 分。</p>
      <p>反社会型的早年行为：第 112–126 题里至少 3 个「是」，整组记 1 分，否则记 0 分。这次是 ${result.conduct.count} 个「是」，记 ${result.conduct.point} 分。</p>
      <p>第 98–105 题保留在问卷中，不计入这 12 个分量表。掩饰和怀疑的 6 题也不计入。这是筛查，不是诊断。</p>
    </div>
    <details class="ledger">
      <summary>查看 126 题的作答</summary>
      <ol>${ledger}</ol>
    </details>
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

function paintAnswer(value) {
  app.querySelectorAll(".option").forEach((button) => {
    button.setAttribute("aria-checked", String(Number(button.dataset.value) === value));
  });
  const hint = app.querySelector(".hint");
  if (hint) hint.textContent = "";
  const bar = app.querySelector(".progress span");
  if (bar) {
    const done = state.index + 1;
    bar.style.width = `${(done / QUESTIONS.length) * 100}%`;
  }
}

function choose(value) {
  const index = state.index;
  const first = state.answers[index] == null;
  state.answers[index] = value;
  if (state.times[index] == null) state.times[index] = Date.now();
  state.error = "";
  save();
  const token = ++advanceToken;
  if (first && index < QUESTIONS.length - 1) {
    paintAnswer(value);
    window.setTimeout(() => {
      if (token !== advanceToken || state.step !== "test" || state.index !== index) return;
      state.index += 1;
      save();
      render();
    }, 150);
    return;
  }
  render();
}

function finish() {
  if (!complete()) {
    const missing = state.answers.findIndex((value) => value == null);
    state.index = missing;
    state.error = "这一题还没有选择。";
    state.step = "test";
    save();
    render();
    return;
  }
  state.result = scorePdq4(state.answers);
  const check = rushCheck(state.times);
  if (check.tooFast && !state.rushed) {
    go("rush");
    return;
  }
  go("report");
}

app.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === "start") {
    state.index = 0;
    go("test");
  }
  if (action === "resume") go("test");
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
      state.error = "请先选择是或否。";
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
  if (action === "back-to-test") {
    state.index = QUESTIONS.length - 1;
    go("test");
  }
  if (action === "force-report") {
    state.rushed = true;
    state.result = scorePdq4(state.answers);
    go("report");
  }
  if (action === "restart") {
    sessionStorage.removeItem(STORAGE);
    state.step = "cover";
    state.index = 0;
    state.answers = Array(QUESTIONS.length).fill(null);
    state.times = Array(QUESTIONS.length).fill(null);
    state.result = null;
    state.rushed = false;
    state.error = "";
    render();
    window.scrollTo(0, 0);
  }
  if (action === "print") window.print();
});

document.addEventListener("keydown", (event) => {
  if (state.step !== "test") return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === "1" || event.key === "y" || event.key === "Y") {
    event.preventDefault();
    choose(1);
  }
  if (event.key === "2" || event.key === "n" || event.key === "N") {
    event.preventDefault();
    choose(0);
  }
  if (event.key === "ArrowLeft" && state.index > 0) {
    event.preventDefault();
    advanceToken += 1;
    state.index -= 1;
    state.error = "";
    save();
    render();
  }
});

load();
render();

const preview = new URLSearchParams(location.search).get("preview");
if (preview) {
  const answers = Array(QUESTIONS.length).fill(0);
  TOO_GOOD_REVERSE.forEach((n) => {
    answers[n - 1] = 1;
  });
  if (preview === "high") answers.fill(1);
  if (preview === "hit") {
    const take = (id) => {
      const scale = SCALES.find((item) => item.id === id);
      scale.items.slice(0, scale.cutoff).forEach((n) => {
        answers[n - 1] = 1;
      });
    };
    take("par");
    take("bor");
    IMPULSE_ITEMS.slice(0, 2).forEach((n) => {
      answers[n - 1] = 1;
    });
  }
  state.answers = answers;
  state.times = answers.map((_, index) => Date.now() + index * (preview === "rush" ? 200 : 2000));
  state.rushed = false;
  state.result = scorePdq4(answers);
  if (preview === "rush") {
    state.step = "rush";
    save();
    render();
  } else {
    go("report");
  }
}
