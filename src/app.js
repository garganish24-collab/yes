/* global Logic */
const L = Logic;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const state = {
  data: L.emptyData(),
  tab: 'home',
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
  openDay: null,
  newType: 'non',
  today: L.dateKey(new Date()),
};

const $view = document.getElementById('view');
const $drawer = document.getElementById('drawer');
const $topRight = document.getElementById('topbar-right');
const $notice = document.getElementById('notice');

// ---------- helpers ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function prettyDate(key, withYear = false) {
  const d = L.parseKey(key);
  const base = `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  return withYear ? `${base}, ${d.getFullYear()}` : base;
}

function monthKeys(year, month) {
  const days = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) => L.dateKey(new Date(year, month, i + 1)));
}

const activeHabits = () => state.data.habits.filter((h) => !h.archived);
const sortedActive = () => [...activeHabits().filter((h) => h.type === 'non'), ...activeHabits().filter((h) => h.type === 'neg')];
const habitName = (id) => (state.data.habits.find((h) => h.id === id) || { name: 'Deleted habit' }).name;

function isDone(key, id) {
  return (state.data.log[key] || []).includes(id);
}

function showNotice(msg, isError = false) {
  $notice.textContent = msg;
  $notice.className = 'notice' + (isError ? ' error' : '');
  $notice.hidden = false;
  clearTimeout(showNotice.t);
  showNotice.t = setTimeout(() => ($notice.hidden = true), 4000);
}

// ---------- saving ----------

let saveChain = Promise.resolve();
function save() {
  const snapshot = JSON.parse(JSON.stringify(state.data));
  saveChain = saveChain
    .then(() => window.store.save(snapshot))
    .catch((err) => showNotice('Could not save: ' + err.message, true));
}

function commit() {
  save();
  render();
}

// ---------- actions ----------

function toggle(key, id) {
  if (key > state.today) return;
  const list = new Set(state.data.log[key] || []);
  list.has(id) ? list.delete(id) : list.add(id);
  if (list.size) state.data.log[key] = [...list];
  else delete state.data.log[key];
  commit();
}

function addHabit(name, type) {
  name = name.trim();
  if (!name) return;
  state.data.habits.push({
    id: 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    type,
    createdAt: state.today,
    archived: false,
  });
  commit();
}

function updateHabit(id, changes) {
  const h = state.data.habits.find((x) => x.id === id);
  if (!h) return;
  Object.assign(h, changes);
  commit();
}

// ---------- top bar ----------

function renderTopbar() {
  const s = L.dayStats(state.data, state.today);
  const ch = challengeInfo();
  $topRight.innerHTML = `
    <div class="pill"><span class="label">Today</span> ${s.nonDone}/${s.nonTotal} <span class="muted">non-neg</span>${s.negDone ? ` <span class="bonus">+${s.negDone}</span>` : ''}</div>
    ${ch.active ? `<div class="pill red"><span class="label">75 Day</span> ${ch.r.progress}/${L.CHALLENGE_DAYS}</div>` : ''}
  `;
}

function challengeInfo() {
  const ch = state.data.challenge;
  const active = !!(ch && ch.active && ch.startDate);
  return { active, r: active ? L.challengeProgress(state.data, state.today) : null };
}

// ---------- month header ----------

function monthNav() {
  return `
    <div class="month-nav">
      <button class="icon-btn" data-action="prev-month" title="Previous month">&#8249;</button>
      <div class="month-label"><span class="muted">MONTH:</span> ${MONTHS[state.month].toUpperCase()} ${state.year}</div>
      <button class="icon-btn" data-action="next-month" title="Next month">&#8250;</button>
      <button class="text-btn" data-action="this-month">Today</button>
    </div>`;
}

function emptyState() {
  return `
    <div class="empty">
      <h2>No habits yet</h2>
      <p>Add your non-negotiables and negotiables first.</p>
      <button class="btn" data-action="goto" data-tab="habits">Add habits</button>
    </div>`;
}

// ---------- Home: fill-bar calendar ----------

function renderHome() {
  if (!activeHabits().length) return monthNav() + emptyState();

  const first = new Date(state.year, state.month, 1).getDay();
  const keys = monthKeys(state.year, state.month);
  const blanks = Array.from({ length: first }, () => '<div class="cal-cell blank"></div>').join('');

  const cells = keys.map((key, i) => {
    const s = L.dayStats(state.data, key);
    const future = key > state.today;
    const pct = Math.round(s.fill * 100);
    const pips = Array.from({ length: s.negDone }, () => '<i></i>').join('');
    const cls = ['cal-cell', future && 'future', key === state.today && 'today', s.complete && 'complete'].filter(Boolean).join(' ');
    return `
      <button class="${cls}" data-action="open-day" data-key="${key}" ${future ? 'disabled' : ''}>
        <div class="bar">
          <div class="fill" style="height:${pct}%"></div>
          ${s.negDone ? `<div class="pips" style="bottom:${pct}%">${pips}</div>` : ''}
        </div>
        <span class="num">${i + 1}</span>
        ${!future && s.nonTotal ? `<span class="frac">${s.nonDone}/${s.nonTotal}${s.negDone ? ` <b>+${s.negDone}</b>` : ''}</span>` : ''}
      </button>`;
  }).join('');

  return `
    ${monthNav()}
    <div class="cal-head">${WEEKDAYS.map((d) => `<div>${d}</div>`).join('')}</div>
    <div class="cal">${blanks}${cells}</div>
    <div class="legend">
      <span><i class="swatch red"></i> Non-negotiables done (the bar)</span>
      <span><i class="swatch tick"></i> Each negotiable done (bonus above the bar)</span>
      <span class="muted">Click a day to update it</span>
    </div>`;
}

// ---------- Day drawer ----------

function renderDrawer() {
  if (!state.openDay) {
    $drawer.hidden = true;
    return;
  }
  const key = state.openDay;
  const s = L.dayStats(state.data, key);
  const habits = L.habitsForDay(state.data, key);
  // Also show active habits created after this day, so old days can be backfilled.
  const extra = activeHabits().filter((h) => !habits.includes(h));
  const all = [...habits, ...extra];

  const row = (h) => `
    <label class="check-row ${isDone(key, h.id) ? 'on' : ''}">
      <input type="checkbox" data-action="toggle" data-key="${key}" data-id="${h.id}" ${isDone(key, h.id) ? 'checked' : ''}>
      <span class="dot ${h.type}"></span>
      <span class="name">${esc(h.name)}</span>
    </label>`;

  const non = all.filter((h) => h.type === 'non');
  const neg = all.filter((h) => h.type === 'neg');

  $drawer.hidden = false;
  $drawer.innerHTML = `
    <div class="drawer-head">
      <div>
        <div class="muted small">${key === state.today ? 'TODAY' : WEEKDAYS[L.parseKey(key).getDay()].toUpperCase()}</div>
        <h2>${prettyDate(key, true)}</h2>
      </div>
      <button class="icon-btn" data-action="close-day" title="Close">&times;</button>
    </div>
    <div class="drawer-bar"><div style="width:${Math.round(s.fill * 100)}%"></div></div>
    <div class="muted small">${s.nonDone}/${s.nonTotal} non-negotiables${s.negDone ? ` &middot; +${s.negDone} extra` : ''}${s.complete ? ' &middot; <span class="red-text">DAY LOCKED IN</span>' : ''}</div>
    <h3 class="section red-text">Non-negotiables</h3>
    ${non.map(row).join('') || '<p class="muted small">None</p>'}
    <h3 class="section">Negotiables</h3>
    ${neg.map(row).join('') || '<p class="muted small">None</p>'}
  `;
}

// ---------- Grid: monthly tracker ----------

function renderGrid() {
  if (!activeHabits().length) return monthNav() + emptyState();
  const keys = monthKeys(state.year, state.month);
  const habits = sortedActive();

  const head = `<tr><th class="habit-col">HABIT</th>${keys.map((k, i) => `<th class="${k === state.today ? 'today' : ''}">${i + 1}</th>`).join('')}</tr>`;

  const rowFor = (h) => `
    <tr>
      <td class="habit-col"><span class="dot ${h.type}"></span>${esc(h.name)}</td>
      ${keys.map((k) => {
        const future = k > state.today;
        const before = k < h.createdAt;
        const cls = [k === state.today && 'today', future && 'future', before && 'before'].filter(Boolean).join(' ');
        return `<td class="${cls}">${future ? '' : `<button class="cell" data-action="toggle" data-key="${k}" data-id="${h.id}">${isDone(k, h.id) ? `<span class="dot ${h.type}"></span>` : ''}</button>`}</td>`;
      }).join('')}
    </tr>`;

  const non = habits.filter((h) => h.type === 'non');
  const neg = habits.filter((h) => h.type === 'neg');
  const section = (label, cls) => `<tr class="group"><td class="habit-col ${cls}">${label}</td><td colspan="${keys.length}"></td></tr>`;

  const scoreRow = `
    <tr class="score">
      <td class="habit-col">DAILY</td>
      ${keys.map((k) => {
        if (k > state.today) return '<td></td>';
        const s = L.dayStats(state.data, k);
        return `<td title="${s.nonDone}/${s.nonTotal} non-neg, +${s.negDone} extra"><div class="mini ${s.complete ? 'complete' : ''}"><div style="height:${Math.round(s.fill * 100)}%"></div>${s.negDone ? '<i></i>' : ''}</div></td>`;
      }).join('')}
    </tr>`;

  return `
    ${monthNav()}
    <div class="grid-wrap">
      <table class="grid">
        <thead>${head}</thead>
        <tbody>
          ${non.length ? section('NON-NEGOTIABLES', 'red-text') + non.map(rowFor).join('') : ''}
          ${neg.length ? section('NEGOTIABLES', 'muted') + neg.map(rowFor).join('') : ''}
          ${scoreRow}
        </tbody>
      </table>
    </div>
    <div class="legend">
      <span><span class="dot non"></span> Non-negotiable done</span>
      <span><span class="dot neg"></span> Negotiable done</span>
      <span class="muted">Click any box to add or remove a dot</span>
    </div>`;
}

// ---------- 75 Day challenge ----------

function renderChallenge() {
  const ch = state.data.challenge;
  const attempts = (ch && ch.attempts) || [];
  const hasNon = activeHabits().some((h) => h.type === 'non');

  const history = attempts.length ? `
    <h3 class="section">Past attempts</h3>
    <ul class="list">${attempts.slice().reverse().map((a) => `
      <li><span>${prettyDate(a.startDate, true)} &rarr; ${prettyDate(a.endDate, true)}</span><span class="${a.completed ? 'red-text' : 'muted'}">${a.completed ? 'COMPLETED 75/75' : `Ended at ${a.progress}/75`}</span></li>`).join('')}
    </ul>` : '';

  if (!ch || !ch.active) {
    return `
      <div class="challenge-start card">
        <h2>75 DAY CHALLENGE</h2>
        <ul class="rules">
          <li>Hit <b>every non-negotiable</b> in a day and it counts as +1.</li>
          <li>Miss any non-negotiable and you go <b class="red-text">back ${L.MISS_PENALTY} days</b>.</li>
          <li>Negotiables don't affect the count. They're bonus.</li>
          <li>Reach 75 to finish.</li>
        </ul>
        ${hasNon ? '' : '<p class="red-text">Add at least one non-negotiable in the Habits tab first.</p>'}
        <div class="row">
          <label class="muted small" for="start-date">Start date</label>
          <input type="date" id="start-date" value="${state.today}" max="${state.today}">
          <button class="btn" data-action="start-challenge" ${hasNon ? '' : 'disabled'}>Start challenge</button>
        </div>
      </div>
      ${history}`;
  }

  const r = L.challengeProgress(state.data, state.today);
  const tS = L.dayStats(state.data, state.today);
  const lost = r.penalties.reduce((n, p) => n + (p.from - p.to), 0);
  // Show the days the latest miss knocked off, until they're earned back.
  const lastMiss = r.penalties[r.penalties.length - 1];
  const lostUpTo = lastMiss ? lastMiss.from : 0;

  const boxes = Array.from({ length: L.CHALLENGE_DAYS }, (_, i) => {
    const n = i + 1;
    let cls = 'box';
    if (n <= r.progress) cls += ' done';
    else if (n <= lostUpTo) cls += ' lost';
    if (!r.complete && !r.todayDone && n === r.progress + 1) cls += ' next';
    return `<div class="${cls}">${n}</div>`;
  }).join('');

  let status;
  if (r.complete) status = `<span class="red-text">CHALLENGE COMPLETE</span> on ${prettyDate(r.completedOn, true)}`;
  else if (r.todayDone) status = `Today is locked in. Day ${r.progress} done.`;
  else status = `${tS.nonTotal - tS.nonDone} non-negotiable${tS.nonTotal - tS.nonDone === 1 ? '' : 's'} left today to lock in day ${r.progress + 1}.`;

  return `
    <div class="challenge-top">
      <div>
        <div class="big"><span class="red-text">${r.progress}</span><span class="muted"> / ${L.CHALLENGE_DAYS}</span></div>
        <div class="muted">Started ${prettyDate(ch.startDate, true)} &middot; ${r.penalties.length} miss${r.penalties.length === 1 ? '' : 'es'}${lost ? ` (&minus;${lost} days)` : ''}</div>
        <div class="status">${status}</div>
      </div>
      <div class="challenge-actions">
        ${r.complete
          ? '<button class="btn" data-action="end-challenge">Save & start new</button>'
          : '<button class="btn ghost" data-action="open-day" data-key="' + state.today + '">Update today</button><button class="text-btn danger" data-action="end-challenge">End challenge</button>'}
      </div>
    </div>
    <div class="boxes">${boxes}</div>
    <div class="legend">
      <span><i class="swatch red"></i> Done</span>
      <span><i class="swatch lost"></i> Lost to a miss</span>
      <span><i class="swatch next"></i> Up next</span>
    </div>
    ${r.penalties.length ? `
      <h3 class="section">Misses</h3>
      <ul class="list">${r.penalties.slice().reverse().map((p) => `
        <li>
          <span><b>${prettyDate(p.date)}</b> <span class="muted">missed ${p.missed.map((id) => esc(habitName(id))).join(', ')}</span></span>
          <span class="red-text">${p.from} &rarr; ${p.to}</span>
        </li>`).join('')}
      </ul>` : ''}
    ${history}`;
}

// ---------- Habits ----------

async function renderHabits() {
  const active = sortedActive();
  const archived = state.data.habits.filter((h) => h.archived);

  const row = (h) => `
    <li class="habit-row">
      <span class="dot ${h.type}"></span>
      <input class="name-input" data-action="rename" data-id="${h.id}" value="${esc(h.name)}" maxlength="60">
      <button class="type-btn ${h.type}" data-action="switch-type" data-id="${h.id}">${h.type === 'non' ? 'Non-negotiable' : 'Negotiable'}</button>
      <button class="text-btn danger" data-action="archive" data-id="${h.id}">Remove</button>
    </li>`;

  return `
    <div class="card">
      <h2>ADD A HABIT</h2>
      <form class="add-form" data-action="add">
        <input id="new-name" placeholder="e.g. Workout 45 min" maxlength="60" autocomplete="off">
        <div class="seg">
          <button type="button" class="${state.newType === 'non' ? 'on' : ''}" data-action="new-type" data-type="non"><span class="dot non"></span> Non-negotiable</button>
          <button type="button" class="${state.newType === 'neg' ? 'on' : ''}" data-action="new-type" data-type="neg"><span class="dot neg"></span> Negotiable</button>
        </div>
        <button class="btn" type="submit">Add</button>
      </form>
    </div>

    <h3 class="section">Your habits</h3>
    ${active.length ? `<ul class="list">${active.map(row).join('')}</ul>` : '<p class="muted">Nothing here yet.</p>'}

    ${archived.length ? `
      <h3 class="section">Removed</h3>
      <p class="muted small">Past dots are kept. Restore a habit to track it again.</p>
      <ul class="list">${archived.map((h) => `
        <li class="habit-row archived"><span class="dot ${h.type}"></span><span class="name">${esc(h.name)}</span><button class="text-btn" data-action="restore" data-id="${h.id}">Restore</button></li>`).join('')}
      </ul>` : ''}

    <h3 class="section">Your data</h3>
    <div class="card data-card">
      <p class="small">Every click saves straight to a file on your computer. A backup copy is kept next to it.</p>
      <p class="small muted mono" id="data-path"></p>
      <div class="row">
        <button class="btn ghost" data-action="export">Export backup</button>
        <button class="btn ghost" data-action="import">Import backup</button>
      </div>
    </div>`;
}

// ---------- render ----------

async function render() {
  state.today = L.dateKey(new Date());
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
  renderTopbar();

  const focused = document.activeElement && document.activeElement.id;
  const views = { home: renderHome, grid: renderGrid, challenge: renderChallenge, habits: renderHabits };
  $view.className = 'view-' + state.tab;
  $view.innerHTML = await views[state.tab]();
  if (focused) document.getElementById(focused)?.focus();

  if (state.tab === 'habits') {
    window.store.path().then((p) => {
      const el = document.getElementById('data-path');
      if (el) el.textContent = p;
    });
  }
  renderDrawer();
}

// ---------- events ----------

document.addEventListener('click', async (e) => {
  const tabBtn = e.target.closest('.tab');
  if (tabBtn) {
    state.tab = tabBtn.dataset.tab;
    state.openDay = null;
    return render();
  }

  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'FORM') return;
  const { action, key, id } = el.dataset;

  switch (action) {
    case 'prev-month':
      if (--state.month < 0) { state.month = 11; state.year--; }
      return render();
    case 'next-month':
      if (++state.month > 11) { state.month = 0; state.year++; }
      return render();
    case 'this-month': {
      const d = new Date();
      state.year = d.getFullYear();
      state.month = d.getMonth();
      return render();
    }
    case 'goto':
      state.tab = el.dataset.tab;
      return render();
    case 'open-day':
      state.openDay = key;
      return renderDrawer();
    case 'close-day':
      state.openDay = null;
      return renderDrawer();
    case 'toggle':
      if (el.tagName === 'INPUT') return; // handled by change event
      return toggle(key, id);
    case 'new-type':
      state.newType = el.dataset.type;
      return render();
    case 'switch-type': {
      const h = state.data.habits.find((x) => x.id === id);
      return updateHabit(id, { type: h.type === 'non' ? 'neg' : 'non' });
    }
    case 'archive': {
      const h = state.data.habits.find((x) => x.id === id);
      if (!confirm(`Remove "${h.name}"? Past dots are kept and you can restore it later.`)) return;
      return updateHabit(id, { archived: true, archivedAt: state.today });
    }
    case 'restore':
      return updateHabit(id, { archived: false, archivedAt: null });
    case 'start-challenge': {
      const start = document.getElementById('start-date').value || state.today;
      const attempts = (state.data.challenge && state.data.challenge.attempts) || [];
      state.data.challenge = { startDate: start > state.today ? state.today : start, active: true, attempts };
      return commit();
    }
    case 'end-challenge': {
      const r = L.challengeProgress(state.data, state.today);
      if (!r.complete && !confirm('End this challenge? It will be saved to your history.')) return;
      const ch = state.data.challenge;
      ch.attempts = [...(ch.attempts || []), { startDate: ch.startDate, endDate: r.completedOn || state.today, progress: r.progress, completed: r.complete }];
      ch.active = false;
      ch.startDate = null;
      return commit();
    }
    case 'export': {
      const p = await window.store.exportBackup(state.data);
      if (p) showNotice('Backup saved to ' + p);
      return;
    }
    case 'import': {
      try {
        const data = await window.store.importBackup();
        if (!data) return;
        if (!confirm('Replace everything in the app with this backup?')) return;
        state.data = normalize(data);
        showNotice('Backup imported.');
        return commit();
      } catch (err) {
        return showNotice(err.message.replace(/^.*Error: /, ''), true);
      }
    }
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.action === 'toggle') return toggle(el.dataset.key, el.dataset.id);
  if (el.dataset.action === 'rename') {
    const name = el.value.trim();
    if (name) updateHabit(el.dataset.id, { name });
    else el.value = habitName(el.dataset.id);
  }
});

document.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.dataset.action === 'add') {
    const input = document.getElementById('new-name');
    addHabit(input.value, state.newType);
    document.getElementById('new-name')?.focus();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.openDay) {
    state.openDay = null;
    renderDrawer();
  }
  if (e.key === 'Enter' && e.target.classList.contains('name-input')) e.target.blur();
});

// Re-draw when the date rolls over while the app is left open.
setInterval(() => {
  if (L.dateKey(new Date()) !== state.today) render();
}, 60 * 1000);
window.addEventListener('focus', () => {
  if (L.dateKey(new Date()) !== state.today) render();
});

// ---------- start ----------

function normalize(d) {
  const base = L.emptyData();
  return {
    ...base,
    ...d,
    habits: Array.isArray(d.habits) ? d.habits : [],
    log: d.log && typeof d.log === 'object' ? d.log : {},
  };
}

(async function init() {
  try {
    const { data, recovered } = await window.store.load();
    if (data) state.data = normalize(data);
    if (recovered) showNotice('Your main data file was damaged, so it was restored from the backup.', true);
  } catch (err) {
    showNotice('Could not load data: ' + err.message, true);
  }
  render();
})();
