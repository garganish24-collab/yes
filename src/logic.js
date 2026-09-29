// Pure logic shared by the app and the tests. No DOM, no Electron.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Logic = factory();
})(this, function () {
  const CHALLENGE_DAYS = 75;
  const MISS_PENALTY = 10;

  const pad = (n) => String(n).padStart(2, '0');

  function dateKey(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(key, n) {
    const d = parseKey(key);
    d.setDate(d.getDate() + n);
    return dateKey(d);
  }

  function emptyData() {
    return { version: 1, habits: [], log: {}, challenge: null };
  }

  // A habit counts on a day if it existed then (and wasn't archived yet),
  // or if it was ticked that day anyway (backfilling old days).
  function habitsForDay(data, key) {
    const done = new Set(data.log[key] || []);
    return data.habits.filter((h) => {
      if (done.has(h.id)) return true;
      if (h.createdAt && key < h.createdAt) return false;
      if (h.archived && h.archivedAt && key >= h.archivedAt) return false;
      if (h.archived && !h.archivedAt) return false;
      return true;
    });
  }

  function dayStats(data, key) {
    const done = new Set(data.log[key] || []);
    const habits = habitsForDay(data, key);
    const non = habits.filter((h) => h.type === 'non');
    const neg = habits.filter((h) => h.type === 'neg');
    const nonDone = non.filter((h) => done.has(h.id));
    const negDone = neg.filter((h) => done.has(h.id));
    return {
      nonTotal: non.length,
      nonDone: nonDone.length,
      negTotal: neg.length,
      negDone: negDone.length,
      missed: non.filter((h) => !done.has(h.id)).map((h) => h.id),
      fill: non.length ? nonDone.length / non.length : 0,
      complete: non.length > 0 && nonDone.length === non.length,
    };
  }

  // Rebuilds 75-day progress from the log every time, so fixing an old day fixes the count.
  // Full day of non-negotiables = +1. Any non-negotiable missed = back 10 days (not below 0).
  // Today only counts once it's complete; it can't be a miss until it's over.
  function challengeProgress(data, todayKey) {
    const ch = data.challenge;
    const result = {
      progress: 0,
      peak: 0,
      penalties: [],
      days: [],
      complete: false,
      completedOn: null,
      todayDone: false,
    };
    if (!ch || !ch.startDate) return result;

    for (let key = ch.startDate; key <= todayKey; key = addDays(key, 1)) {
      const s = dayStats(data, key);
      const isToday = key === todayKey;
      if (s.nonTotal === 0) {
        result.days.push({ date: key, result: 'skip' });
      } else if (s.complete) {
        result.progress += 1;
        result.peak = Math.max(result.peak, result.progress);
        result.days.push({ date: key, result: 'done' });
        if (isToday) result.todayDone = true;
      } else if (isToday) {
        result.days.push({ date: key, result: 'pending' });
      } else {
        const from = result.progress;
        result.progress = Math.max(0, from - MISS_PENALTY);
        result.penalties.push({ date: key, from, to: result.progress, missed: s.missed });
        result.days.push({ date: key, result: 'miss' });
      }
      if (result.progress >= CHALLENGE_DAYS) {
        result.complete = true;
        result.completedOn = key;
        break;
      }
    }
    return result;
  }

  return {
    CHALLENGE_DAYS,
    MISS_PENALTY,
    dateKey,
    parseKey,
    addDays,
    emptyData,
    habitsForDay,
    dayStats,
    challengeProgress,
  };
});
