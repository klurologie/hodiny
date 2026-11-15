export const STORAGE_KEY = 'hodiny-tracker-v1';
export const VERSION = 1;

export function parseClock(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(':').map(Number);
  return h <= 23 && m <= 59 ? h * 60 + m : null;
}
export function parseDuration(value) {
  if (value === '' || value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 && value <= 10080 ? value : null;
  if (!/^\d{1,3}:\d{2}$/.test(String(value))) return null;
  const [h, m] = String(value).split(':').map(Number);
  return h <= 168 && m < 60 ? h * 60 + m : null;
}
export function fmtDuration(value) {
  const n = Math.max(0, Math.round(Number(value) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}
export function interval(start, end, forceNextDay = false) {
  const a = parseClock(start), b = parseClock(end);
  if (a === null || b === null) return null;
  return { start: a, end: b + ((forceNextDay || b < a) ? 1440 : 0) };
}
export function computeRecord(record) {
  const regularPeriod = interval(record.arrival, record.departure);
  const dutyPeriod = interval(record.dutyStart, record.dutyEnd, Boolean(record.dutyNextDay));
  const regularMinutes = regularPeriod ? regularPeriod.end - regularPeriod.start : 0;
  const dutyMinutes = dutyPeriod ? dutyPeriod.end - dutyPeriod.start : 0;
  const creditedMinutes = Number(record.creditedMinutes) || 0;
  let overlap = 0;
  if (regularPeriod && dutyPeriod) {
    overlap = Math.max(0, Math.min(regularPeriod.end, dutyPeriod.end) - Math.max(regularPeriod.start, dutyPeriod.start));
  }
  const totalMinutes = Number.isInteger(record.manualTotalMinutes) && record.manualTotalMinutes >= 0
    ? record.manualTotalMinutes
    : Math.max(0, regularMinutes + dutyMinutes - overlap + creditedMinutes);
  return { regularMinutes, dutyMinutes, creditedMinutes, overlapMinutes: overlap, totalMinutes,
    isDuty: Boolean(dutyPeriod && dutyMinutes > 0),
    isOvernightDuty: Boolean(dutyPeriod && dutyPeriod.end >= 1440) };
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m-1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m-1 && dt.getUTCDate() === d;
}
export function normalizeRecord(raw) {
  if (!raw || !validDate(raw.date)) throw Error('Záznam obsahuje neplatné datum.');
  const r = {
    date: raw.date,
    arrival: raw.arrival || '', departure: raw.departure || '',
    dutyStart: raw.dutyStart || '', dutyEnd: raw.dutyEnd || '',
    dutyNextDay: Boolean(raw.dutyNextDay),
    type: typeof raw.type === 'string' ? raw.type.slice(0, 40) : '',
    note: typeof raw.note === 'string' ? raw.note.slice(0, 500) : '',
    source: typeof raw.source === 'string' ? raw.source.slice(0, 80) : '',
  };
  for (const key of ['arrival','departure','dutyStart','dutyEnd']) {
    if (r[key] && parseClock(r[key]) === null) throw Error(`Neplatný čas u ${r.date}: ${key}`);
  }
  for (const [first, last] of [['arrival','departure'],['dutyStart','dutyEnd']]) {
    if (Boolean(r[first]) !== Boolean(r[last])) throw Error(`Neúplný časový interval ${r.date}.`);
  }
  // Existing Excel: manually credited standard hours on leave/sick days are
  // separated from the hours truly worked.
  const oldCredit = raw.overrideRegularMin !== undefined && !r.arrival && !r.departure
    ? Number(raw.overrideRegularMin) : 0;
  r.creditedMinutes = Number(raw.creditedMinutes !== undefined ? raw.creditedMinutes : oldCredit) || 0;
  if (!Number.isInteger(r.creditedMinutes) || r.creditedMinutes < 0 || r.creditedMinutes > 10080) throw Error(`Neplatné započtené hodiny: ${r.date}`);
  // May 14 in the source workbook: duty 07:30 → next-day 08:30 = 25 hours.
  // The workbook stored 25 hours in the daily total, though its duty column
  // displayed only 1 hour (24-hour wrap). Carry the explicit overnight flag.
  const oldTotal = raw.overrideTotalMin;
  if (!r.dutyNextDay && oldTotal !== undefined && r.dutyStart && r.dutyEnd) {
    const base = computeRecord(r);
    if (Number(oldTotal) - base.totalMinutes === 1440) r.dutyNextDay = true;
  }
  if (oldTotal !== undefined && Number(oldTotal) !== computeRecord(r).totalMinutes) {
    r.manualTotalMinutes = Number(oldTotal);
  }
  if (raw.manualTotalMinutes !== undefined) r.manualTotalMinutes = Number(raw.manualTotalMinutes);
  if (r.manualTotalMinutes !== undefined && (!Number.isInteger(r.manualTotalMinutes) || r.manualTotalMinutes < 0 || r.manualTotalMinutes > 10080)) throw Error(`Neplatný celkový čas: ${r.date}`);
  return r;
}
export function monthKey(date) { return date.slice(0,7); }
export function isoWeekKey(date) {
  if (!validDate(date)) return '';
  const d = new Date(date + 'T12:00:00Z');
  const weekday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - weekday + 3);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year,0,4,12));
  const yday = (yearStart.getUTCDay() + 6) % 7;
  yearStart.setUTCDate(yearStart.getUTCDate() - yday);
  const week = 1 + Math.round((d - yearStart)/(7*864e5));
  return `${year}-W${String(week).padStart(2,'0')}`;
}
export function totals(records) {
  return records.reduce((sum, r) => {
    const v = computeRecord(r);
    sum.total += v.totalMinutes;
    sum.regular += v.regularMinutes;
    sum.duty += v.dutyMinutes;
    sum.credited += v.creditedMinutes;
    sum.duties += Number(v.isDuty);
    return sum;
  }, { total: 0, regular: 0, duty: 0, credited: 0, duties: 0 });
}
export function localISODate(date = new Date()) {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
