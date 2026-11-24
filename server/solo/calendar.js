// The daily challenge's calendar: which days a player took part in, their streaks,
// and the days of a month. All in UTC days ('YYYY-MM-DD'), as the challenge itself is,
// so the same day is the same day wherever the player is.

const DAY_MS = 86400000;

export const dayNumber = (day) => Math.floor(Date.parse(day + 'T00:00:00Z') / DAY_MS);
export const dayFromNumber = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);

/** The days of a month ('YYYY-MM') as 'YYYY-MM-DD', or null when it isn't one. */
export function monthDays(month) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month || '');
  if (!m) return null;
  const first = dayNumber(`${month}-01`);
  const next = Number(m[2]) === 12 ? `${Number(m[1]) + 1}-01-01` : `${m[1]}-${String(Number(m[2]) + 1).padStart(2, '0')}-01`;
  const out = [];
  for (let n = first; n < dayNumber(next); n++) out.push(dayFromNumber(n));
  return out;
}

/** The month before or after one ('YYYY-MM'). */
export function shiftMonth(month, by) {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + (m - 1) + by;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

/** How many days the first of a month falls after Monday (0 for a Monday), for laying out a week grid. */
export const weekOffset = (month) => (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7;

/**
 * The longest run of days in a row, and the run that's still going: today's if today is
 * done, else yesterday's (the day isn't over, so a streak isn't lost until it is).
 */
export function streaks(days, today) {
  const have = new Set([...days].map(dayNumber));
  let longest = 0;
  for (const n of have) {
    if (have.has(n - 1)) continue; // not the start of a run
    let len = 1;
    while (have.has(n + len)) len++;
    longest = Math.max(longest, len);
  }
  const t = dayNumber(today);
  let n = have.has(t) ? t : t - 1;
  let current = 0;
  while (have.has(n)) {
    current++;
    n--;
  }
  return { longest, current };
}
