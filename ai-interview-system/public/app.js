// ---------- DEMO STATE ----------
const state = {
  interviews: [
    { id: 1, name: "jj", project: "individual", date: "10/10/2026", type: "individual", status: "scheduled" },
    { id: 2, name: "LANSEEL", project: "individual", date: "05/10/2026", type: "individual", status: "in-progress" },
    { id: 3, name: "inventory", project: "individual", date: "05/10/2026", type: "individual", status: "completed" }
  ],
  respondents: [
    { name: "lans", project: "inventory", answers: 10 },
    { name: "LANSEEL", project: "individual", answers: 3 },
    { name: "jj", project: "individual", answers: 3 }
  ],
  questions: [
    "What specific tasks do you perform most frequently in the Customer Service Improvement?",
    "What are the most frustrating or difficult parts of using the Customer Service Improvement?",
    "If you could change one thing about the Customer Service Improvement, what would it be?",
    "Have you encountered any errors or unexpected behavior while using the Customer Service Improvement?",
    "Are there any tasks you cannot complete using the Customer Service Improvement tool?",
    "What features or capabilities are missing from the Customer Service Improvement?",
    "What would make the Customer Service Improvement easier and more efficient for you?"
  ],
  responses: [
    { user: "lans", project: "inventory", type: "voice", date: "05/10/2026", q: "What would make the Customer Service Improvement easier and more efficient for s...", a: "voice recording submitted" },
    { user: "lans", project: "inventory", type: "video", date: "05/10/2026", q: "What features or capabilities are missing from the Customer Service Improvement ...", a: "video response submitted" },
    { user: "lans", project: "inventory", type: "text", date: "05/10/2026", q: "What would make the Customer Service Improvement easier and more efficient for s...", a: "JQJOOJSOJOS" },
    { user: "lans", project: "inventory", type: "text", date: "05/10/2026", q: "If you could change one thing about the Customer Service Improvement, what would...", a: "NJSJJSJO" },
    { user: "lans", project: "inventory", type: "text", date: "05/10/2026", q: "Are there any tasks you cannot complete using the Customer Service Improvement t...", a: "n.ksnkS" },
    { user: "lans", project: "inventory", type: "text", date: "05/10/2026", q: "Have you encountered any errors or unexpected behavior while using the Customer ...", a: "nknklml," },
    { user: "lans", project: "inventory", type: "text", date: "05/10/2026", q: "If you could change one thing about the Customer Service Improvement, what would...", a: "mmlmlm l" },
    { user: "lans", project: "inventory", type: "text", date: "05/10/2026", q: "What are the most frustrating or difficult parts of using the Customer Service I...", a: "nknkl," },
    { user: "lans", project: "inventory", type: "text", date: "05/10/2026", q: "Are there any tasks you cannot complete using the Customer Service Improvement t...", a: "jbjbjnknh" },
    { user: "lans", project: "inventory", type: "text", date: "05/10/2026", q: "What specific tasks do you perform most frequently in the Customer Service Impro...", a: "bjbjnjnk" }
  ],
  activity: [
    { date: "10/10/2026", text: 'Interview Created — Session "jj" created' },
    { date: "10/10/2026", text: 'Interview Updated — Session "LANSEEL" marked as in-progress' },
    { date: "05/10/2026", text: 'Interview Created — Session "LANSEEL" created' },
    { date: "05/10/2026", text: 'Interview Deleted — Session "survey" deleted' },
    { date: "05/10/2026", text: 'Interview Completed — Session "survey" marked as completed' },
    { date: "05/10/2026", text: 'Interview Created — Session "survey" created' },
    { date: "05/10/2026", text: 'Interview Completed — Session "inventory" completed with 1 respondent(s)' }
  ]
};

// ---------- HELPERS ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const statusClass = (s) => s === "completed" ? "completed" : s === "in-progress" ? "in-progress" : "scheduled";

// ---------- RENDER ----------
function renderStats() {
  const total = state.interviews.length;
  const completed = state.interviews.filter(i => i.status === "completed").length;
  $("#stat-total").textContent = total;
  $("#stat-completed").textContent = completed;
  $("#stat-pending").textContent = total - completed;
  $("#stat-respondents").textContent = state.respondents.length;
  $("#stat-questions").textContent = state.questions.length;
  $("#stat-responses").textContent = state.responses.length;

  const pct = total ? Math.round((completed / total) * 100) : 0;
  $("#completion-pct").textContent = pct + "%";
  $("#completion-fill").style.width = pct + "%";
  $("#completion-sub").textContent = `${completed} of ${total} interviews`;
}

function renderResponses(container, limit) {
  const items = limit ? state.responses.slice(0, limit) : state.responses;
  container.innerHTML = items.map(r => `
    <div class="resp">
      <div class="head">
        <div class="avatar">${r.user[0].toUpperCase()}</div>
        <strong>${r.user}</strong>
        <span class="badge">${r.project}</span>
        <span class="tag ${r.type}">${r.type}</span>
        <span class="meta">${r.date}</span>
      </div>
      <div class="q">Q: ${r.q}</div>
      <div class="a">${r.a}</div>
    </div>
  `).join("");
}

function renderInterviews() {
  $("#recent-interviews").innerHTML = state.interviews.map(i => `
    <div class="item">
      <div><strong>${i.name}</strong><div class="meta">${i.project} · ${i.status}</div></div>
      <div class="meta">${i.date}</div>
    </div>
  `).join("");
  $("#interviews-table").innerHTML = state.interviews.map(i => `
    <tr>
      <td>${i.name}</td><td>${i.project}</td><td>${i.date}</td><td>${i.type}</td>
      <td><span class="status ${statusClass(i.status)}">${i.status}</span></td>
    </tr>
  `).join("");
}

function renderRespondents() {
  $("#respondents-table").innerHTML = state.respondents.map(r => `
    <tr><td>${r.name}</td><td>${r.project}</td><td>${r.answers}</td></tr>
  `).join("");
}

function renderQuestions() {
  $("#questions-list").innerHTML = state.questions.map((q, i) => `
    <li class="item">
      <div class="q">Q${i + 1}. ${q}</div>
      <div class="meta">text · audio · video supported</div>
    </li>
  `).join("");
}

function renderActivity() {
  $("#recent-activity").innerHTML = state.activity.slice(0, 7).map(a => `
    <div class="item">
      <div>${a.text}</div>
      <div class="meta">${a.date}</div>
    </div>
  `).join("");
}

function renderTrendChart() {
  const canvas = document.getElementById("trendChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width = canvas.offsetWidth;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const data = [1, 2, 1, 3, 2, 1, 2];
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const max = Math.max(...data);
  const pad = 24;
  const chartW = w - pad * 2;
  const chartH = h - pad * 2;

  ctx.strokeStyle = "#262a44";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad + (chartH / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
  }

  const barW = (chartW / data.length) * 0.5;
  data.forEach((v, i) => {
    const x = pad + (chartW / data.length) * i + (chartW / data.length - barW) / 2;
    const barH = (v / max) * chartH;
    const y = pad + chartH - barH;
    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, "#6c5ce7");
    grad.addColorStop(1, "#00cec9");
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, barW, barH, 4);
    else ctx.rect(x, y, barW, barH);
    ctx.fill();
    ctx.fillStyle = "#8a8fa3";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(labels[i], x + barW / 2, h - 6);
  });
}

// ---------- NAVIGATION ----------
function setupNav() {
  $$(".nav-item").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      $$(".nav-item").forEach(l => l.classList.remove("active"));
      link.classList.add("active");
      const page = link.dataset.page;
      $$(".page").forEach(p => p.classList.remove("active"));
      const target = document.getElementById("page-" + page);
      if (target) target.classList.add("active");
      $("#page-title").textContent = link.textContent.trim().replace(/^[^\w]+/, "");
    });
  });
}

// ---------- INIT ----------
function init() {
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  $("#today").textContent = today;

  renderStats();
  renderResponses($("#recent-responses"), 6);
  renderResponses($("#all-responses"));
  renderInterviews();
  renderRespondents();
  renderQuestions();
  renderActivity();
  renderTrendChart();
  setupNav();
  window.addEventListener("resize", renderTrendChart);
}

document.addEventListener("DOMContentLoaded", init);
