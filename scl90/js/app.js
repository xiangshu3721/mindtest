import { AGES, FACTORS, OPTIONS, QUESTIONS, SCALE } from "./data.js";
import { formatScore, rushCheck, scoreScl90 } from "./score.js";

const app = document.querySelector("#app");
const STORAGE = "scl90-session";

const state = {
  step: "cover",
  profile: { name: "", gender: "", age: "" },
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
    state.profile = { ...state.profile, ...saved.profile };
    state.index = Number.isInteger(saved.index) ? saved.index : 0;
    state.step = saved.step || "cover";
    state.rushed = Boolean(saved.rushed);
    if ((state.step === "report" || state.step === "rush") && complete()) {
      state.result = scoreScl90(state.answers);
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
    profile: state.profile,
    index: state.index,
    answers: state.answers,
    times: state.times,
    rushed: state.rushed,
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

function today() {
  const date = new Date();
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function barPercent(score) {
  return Math.max(0, Math.min(100, ((score - 1) / 4) * 100));
}

function render() {
  const view = {
    cover: renderCover,
    profile: renderProfile,
    test: renderTest,
    rush: renderRush,
    report: renderReport,
  }[state.step];
  app.innerHTML = view();
  const focus = app.querySelector("[data-autofocus]");
  if (focus) focus.focus();
}

function shell(inner, extra = "") {
  return `<main class="frame"><article class="sheet ${extra}">${inner}</article></main>`;
}

function renderCover() {
  const index = FACTORS.map((factor, i) => (
    `<li><b>${pad(i + 1)}</b><span>${esc(factor.name)}</span></li>`
  )).join("");
  return shell(`
    <p class="kicker"><i class="mark"></i> SCL-90</p>
    <h1>症状自评量表</h1>
    <p class="lead">${esc(SCALE.intro)}</p>
    <div class="meta">
      <span>90 题</span>
      <span>最近一星期</span>
      <span>${esc(SCALE.audience)}</span>
      <span>约 15 分钟</span>
    </div>
    <div class="actions">
      <button class="primary" data-action="start" type="button">开始测评</button>
    </div>
    <ol class="index">${index}</ol>
    <p class="fine">作答和计分都留在这台设备上，不会上传。结果用来了解最近一周的感受，不是医学诊断。</p>
  `);
}

function renderProfile() {
  const gender = ["男", "女"].map((value) => `
    <button class="choice" type="button" data-action="gender" data-value="${value}" aria-pressed="${state.profile.gender === value}">
      <span>${value}</span>
    </button>
  `).join("");
  const ages = AGES.map((value) => `
    <button class="choice" type="button" data-action="age" data-value="${esc(value)}" aria-pressed="${state.profile.age === value}">
      <span>${esc(value)}</span>
    </button>
  `).join("");
  return shell(`
    <p class="kicker"><i class="mark"></i> 开始之前</p>
    <h1>你的称谓</h1>
    <p class="lead">姓名、性别和年龄只印在这份报告上。三个都填了，才能进入题目。</p>
    <div class="field">
      <label for="person">姓名</label>
      <input id="person" name="person" type="text" maxlength="20" autocomplete="off" data-autofocus value="${esc(state.profile.name)}" />
    </div>
    <div class="field">
      <div class="section-label">性别</div>
      <div class="choices split">${gender}</div>
    </div>
    <div class="field">
      <div class="section-label">年龄</div>
      <div class="choices split">${ages}</div>
    </div>
    <p class="hint">${esc(state.error)}</p>
    <div class="actions">
      <button class="primary" type="button" data-action="enter">下一页</button>
      <button class="ghost" type="button" data-action="cover">返回</button>
    </div>
  `);
}

function renderTest() {
  const index = state.index;
  const answer = state.answers[index];
  const width = ((index + (answer ? 1 : 0)) / QUESTIONS.length) * 100;
  const options = OPTIONS.map((option) => `
    <button class="option" type="button" data-action="answer" data-value="${option.value}" aria-checked="${answer === option.value}">
      <span>${esc(option.label)}</span>
      <small>${option.value}</small>
    </button>
  `).join("");
  const last = index === QUESTIONS.length - 1;
  const nextLabel = last ? "生成报告" : "下一题";
  return shell(`
    <div class="progress" aria-hidden="true"><span style="width:${width}%"></span></div>
    <div class="q-top">
      <span>${pad(index + 1)} / ${QUESTIONS.length}</span>
      <span>${esc(state.profile.name)}</span>
    </div>
    <h2 class="question" data-autofocus tabindex="-1">${esc(QUESTIONS[index])}</h2>
    ${index === 0 ? `<p class="prompt">${esc(SCALE.instruction)}</p>` : `<p class="prompt">按最近一星期以内的实际感觉选择。</p>`}
    <div class="options" role="radiogroup" aria-label="第 ${index + 1} 题">${options}</div>
    <p class="hint">${esc(state.error)}</p>
    <div class="nav">
      <button class="ghost" type="button" data-action="prev" ${index === 0 ? "disabled" : ""}>上一题</button>
      <button class="primary" type="button" data-action="next">${nextLabel}</button>
    </div>
  `);
}

function renderRush() {
  const check = rushCheck(state.times);
  const percent = Math.round(check.ratio * 100);
  return shell(`
    <p class="kicker"><i class="mark"></i> 作答速度</p>
    <h1>有些题答得太快</h1>
    <p class="lead">相邻题目里，有 ${percent}% 的间隔不到 1.5 秒。超过一半时，这份量表会认为作答可能没有贴近最近一周的实际感觉，结果会偏。</p>
    <div class="actions">
      <button class="primary" type="button" data-action="back-to-test">返回检查</button>
      <button class="ghost" type="button" data-action="force-report">仍然生成</button>
    </div>
  `);
}

function renderReport() {
  const result = state.result;
  const profile = state.profile;
  const verdictClass = result.crisis?.level === "urgent"
    ? "urgent"
    : result.positive ? "positive" : "";
  const metrics = [
    ["总分", String(result.total)],
    ["总症状指数", formatScore(result.gsi)],
    ["阳性项目", String(result.positiveCount)],
    ["阴性项目", String(result.negativeCount)],
    ["阳性症状均分", result.positiveMean == null ? "—" : formatScore(result.positiveMean)],
  ];
  const metricHtml = metrics.map(([label, value]) => `
    <div class="metric">
      <b>${esc(value)}</b>
      <span>${esc(label)}</span>
    </div>
  `).join("");
  const aboveNames = [
    result.totalAboveNorm ? "总分" : "",
    result.gsiAboveNorm ? "总症状指数" : "",
    result.positiveCountAboveNorm ? "阳性项目数" : "",
    result.positiveMeanAboveNorm ? "阳性症状均分" : "",
  ].filter(Boolean);
  const aboveLine = aboveNames.length
    ? `高于常模一个标准差的是${aboveNames.join("、")}。`
    : "总分、总症状指数和阳性项目数都没有超过常模一个标准差。";
  const rules = result.rules.map((rule) => `
    <li>
      <span class="pill ${rule.hit ? "hit" : ""}">${rule.hit ? "超过" : "未超过"}</span>
      <span><strong>${esc(rule.label)}</strong><br />${esc(rule.detail)}</span>
    </li>
  `).join("");
  const factors = result.ranked.map((factor) => {
    const norm = factor.norm
      ? `常模 ${factor.norm.mean.toFixed(2)} ± ${factor.norm.sd.toFixed(2)}，超过 ${(factor.norm.mean + factor.norm.sd).toFixed(2)} 记为高于常模`
      : "这一组没有 1986 年九因子常模，程度仍按均分划分";
    const normTick = factor.norm
      ? `<i class="norm" style="left:${barPercent(factor.norm.mean)}%"></i>`
      : "";
    return `
      <section class="factor">
        <header>
          <h3>${esc(factor.name)}</h3>
          <span class="level ${esc(factor.level)}">${esc(factor.levelLabel)} · ${formatScore(factor.mean)}</span>
        </header>
        <em class="about">${esc(factor.about)}</em>
        <div class="bar" aria-hidden="true">
          <b class="${esc(factor.level)}" style="width:${barPercent(factor.mean)}%"></b>
          <i class="cut" style="left:${barPercent(2)}%"></i>
          ${normTick}
        </div>
        <div class="scale-note">因子总分 ${factor.raw} / ${factor.count} 题 · ${esc(norm)}${factor.aboveNorm ? " · 高于常模" : ""}</div>
        <p>${esc(factor.narrative)}</p>
      </section>
    `;
  }).join("");
  const notable = result.notable.length
    ? `<ul class="symptoms">${result.notable.map((item) => `
        <li><b>${pad(item.n)}</b><span>${esc(item.text)}</span><span>${esc(optionLabel(item.score))}</span></li>
      `).join("")}</ul>`
    : `<p class="sub">没有题目达到偏重或严重。</p>`;
  const crisis = result.crisis
    ? `<div class="verdict ${result.crisis.level === "note" ? "" : "urgent"}"><strong>${result.crisis.level === "note" ? "关于死亡的想法" : "请先看这里"}</strong><p>${esc(result.crisis.text)}</p></div>`
    : "";
  const guidance = result.guidance.map((line) => `<li>${esc(line)}</li>`).join("");
  const ledger = QUESTIONS.map((text, index) => `
    <li><b>${pad(index + 1)}</b><span>${esc(text)}</span><span>${esc(optionLabel(state.answers[index]))}</span></li>
  `).join("");
  const youth = profile.age === "20岁以下"
    ? `<p class="sub">年龄选的是 20 岁以下。常模来自成人样本，16–19 岁只作参考，不宜直接套用成人界值做判断。</p>`
    : "";
  const rushNote = state.rushed
    ? `<div class="verdict positive"><strong>作答偏快</strong><p>超过一半的题目间隔不到 1.5 秒。下面的分数仍然按作答计算，但可能没有反映最近一周的实际感觉。</p></div>`
    : "";

  return shell(`
    <p class="kicker"><i class="mark"></i> 测评报告</p>
    <h1>症状自评量表</h1>
    <div class="who">
      <div><span>姓名</span><b>${esc(profile.name)}</b></div>
      <div><span>性别</span><b>${esc(profile.gender)}</b></div>
      <div><span>年龄</span><b>${esc(profile.age)}</b></div>
      <div><span>日期</span><b>${esc(today())}</b></div>
    </div>
    ${crisis}
    ${rushNote}
    <div class="verdict ${verdictClass}">
      <strong>${esc(result.verdictTitle)}</strong>
      <p>${esc(result.verdictText)}</p>
    </div>
    ${youth}
    <div class="metrics">${metricHtml}</div>
    <p class="sub">${esc(result.gsiText)}${esc(aboveLine)}全国常模里，总分约 ${result.norms.total.mean} ± ${result.norms.total.sd}，阳性项目数约 ${result.norms.positiveCount.mean} ± ${result.norms.positiveCount.sd}。</p>
    <ul class="rules">${rules}</ul>
    <h2>十个方面</h2>
    <p class="sub">横条是因子均分，左端 1 分，右端 5 分。黑线是 2 分筛查界，灰线是常模均分。2 分及以下为无明显症状，其后到 3 分为轻度，到 4 分为中度，再高为重度。</p>
    ${factors}
    <h2>怎么看下一步</h2>
    <ul class="guidance">${guidance}</ul>
    <h2>偏重和严重的条目</h2>
    ${notable}
    <details class="ledger">
      <summary>查看 90 题的作答</summary>
      <ol>${ledger}</ol>
    </details>
    <div class="formulas">
      <p>总分 = 90 题相加。总症状指数 = 总分 ÷ 90。</p>
      <p>阳性项目 = 选了很轻及以上的题。阴性项目 = 选了「没有」的题。阳性症状均分 = 阳性题得分之和 ÷ 阳性题数。</p>
      <p>因子均分 = 该因子题目得分之和 ÷ 题目数。筛查阳性：总分超过 160，或阳性项目超过 43，或九个症状因子里有均分超过 2。因子常模来自 1986 年全国正常成人样本（N=1388）。</p>
      <p>这是筛查，不是诊断，也不能代替面谈。</p>
    </div>
    <div class="actions" style="margin-top:22px">
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

function profileReady() {
  return state.profile.name.trim() && state.profile.gender && state.profile.age;
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
    }, 180);
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
  state.result = scoreScl90(state.answers);
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
  if (action === "start") go("profile");
  if (action === "cover") go("cover");
  if (action === "gender") {
    state.profile.gender = button.dataset.value;
    state.error = "";
    save();
    render();
  }
  if (action === "age") {
    state.profile.age = button.dataset.value;
    state.error = "";
    save();
    render();
  }
  if (action === "enter") {
    state.profile.name = state.profile.name.trim();
    if (!profileReady()) {
      state.error = "请填写姓名，并选择性别和年龄。";
      render();
      return;
    }
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
  if (action === "back-to-test") {
    state.index = QUESTIONS.length - 1;
    go("test");
  }
  if (action === "force-report") {
    state.rushed = true;
    state.result = scoreScl90(state.answers);
    go("report");
  }
  if (action === "restart") {
    sessionStorage.removeItem(STORAGE);
    state.step = "cover";
    state.profile = { name: "", gender: "", age: "" };
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

app.addEventListener("input", (event) => {
  if (event.target.name === "person") {
    state.profile.name = event.target.value;
    save();
  }
});

document.addEventListener("keydown", (event) => {
  if (state.step !== "test") return;
  if (event.target.matches("input, textarea")) return;
  const number = Number(event.key);
  if (number >= 1 && number <= 5) {
    event.preventDefault();
    choose(number);
  }
});

load();
render();

if (new URLSearchParams(location.search).has("debug")) {
  window.__scl = {
    fill(kind) {
      const answers = Array(QUESTIONS.length).fill(1);
      if (kind === "high") answers.fill(4);
      if (kind === "mixed") {
        const set = (id, score) => {
          FACTORS.find((factor) => factor.id === id).items.forEach((n) => {
            answers[n - 1] = score;
          });
        };
        set("som", 2);
        set("oc", 3);
        set("dep", 3);
        set("anx", 4);
        answers[14] = 2;
      }
      if (kind === "crisis") answers[14] = 5;
      state.profile = { name: "林深", gender: "女", age: "25-29岁" };
      state.answers = answers;
      state.times = answers.map((_, index) => Date.now() + index * 2000);
      state.rushed = false;
      state.result = scoreScl90(answers);
      go("report");
    },
  };
}
