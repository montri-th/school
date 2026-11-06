/**
 * Dataset vocabulary, decoding, shared filter and summary helpers.
 *
 * Rows are the school records of “CityMETER School Thailand — Research Master 2026-10-31” (data/schools.json, built by
 * scripts/build-data.py). One row = one CityMETER school UUID of the 2026 baseline the owner confirmed: a school or
 * other institution (02_SCHOOLS) or a child development centre (03_CHILD_CENTERS). Nothing here merges, moves or
 * mutates a row.
 *
 * Two measures (a contract, see DATA_METHOD.md §2):
 *   students (default) — Σ student_count of CityMETER 2026 (“คน”). A record with unknown students adds nothing to a
 *                        student total and is counted apart (“ไม่ทราบจำนวนนักเรียน”), never as zero.
 *   count              — schools and centres (“แห่ง”).
 * Tuition (บาท/คน/ปี, tuition only) is published per school as the school announced it, never summed or averaged
 * across schools. Assessment results (ONESQA, B.E. 2564–2567) are shown verbatim with their year, never as a score.
 *
 * Area = the เขต/อำเภอ (DISTRICT) of CityMETER production the source lists the school under (row.admin: source · name ·
 * province · none). Points are the sheet's checked registry points (row.coordRole says what they are).
 */
import {seriesOf} from './cues.js';

/** Short labels for tight places (matrix columns); the full Thai label stays in titles, legends and lists. */
export const GROUP_SHORT = Object.freeze({
  public: 'สพฐ.', local: 'ท้องถิ่น', private: 'เอกชน', international: 'นานาชาติ', vocational: 'อาชีวะ', nonformal: 'สกร.',
  childcare: 'ศพด.', other: 'รัฐอื่น',
});

/**
 * Measures: `students` (default), `count` (school records) and `learning` (0.2.0: learning-service records of
 * data/learning.json — a different set of rows, counted apart from the schools and never added to them).
 */
export const METRICS = Object.freeze({
  students: Object.freeze({id: 'students', one: 'คน', label: 'นักเรียน', subject: 'นักเรียน', per: 'คน'}),
  count: Object.freeze({id: 'count', one: 'แห่ง', label: 'สถานศึกษา', subject: 'สถานศึกษา', per: 'แห่ง'}),
  learning: Object.freeze({id: 'learning', one: 'แห่ง', label: 'เรียนเสริม', subject: 'สถานที่เรียนเสริม', per: 'แห่ง'}),
});
/** A measure that counts records (one row = 1): school records or learning records. */
export const countsRecords = metric => metric === 'count' || metric === 'learning';
export const metricOf = id => METRICS[id] || METRICS.students;
/** Unit words for a measure ('' = students). */
export const unitWords = (metric = '') => ({...metricOf(metric), mode: metricOf(metric).id});

/** Student-size bands of CityMETER production (SchoolSize XS–3,500+); unknown students are in none. */
export const SIZE_BANDS = Object.freeze([
  Object.freeze({id: 'z1', th: 'ไม่ถึง 20 คน', short: '<20', min: 1, max: 19}),
  Object.freeze({id: 'z2', th: '20–119 คน', short: '20–119', min: 20, max: 119}),
  Object.freeze({id: 'z3', th: '120–719 คน', short: '120–719', min: 120, max: 719}),
  Object.freeze({id: 'z4', th: '720–1,679 คน', short: '720–1,679', min: 720, max: 1679}),
  Object.freeze({id: 'z5', th: '1,680–3,499 คน', short: '1,680–3,499', min: 1680, max: 3499}),
  Object.freeze({id: 'z6', th: '3,500 คนขึ้นไป', short: '3,500+', min: 3500, max: Infinity}),
]);
export const sizeOf = n => (Number.isFinite(n) && n > 0 ? SIZE_BANDS.find(b => n >= b.min && n <= b.max)?.id || '' : '');

/**
 * Levels a school teaches, from its lowest and highest grade codes (production grade codes: 1–3 อ.1–อ.3, 4–9 ป.1–ป.6,
 * 10–15 ม.1–ม.6, 16–18 ปวช.1–3). A school teaches a level when its grade range meets the level's range; unknown grades
 * (code 0) are in no level.
 */
export const LEVELS = Object.freeze([
  Object.freeze({id: 'kinder', th: 'อนุบาล', lo: 1, hi: 3}),
  Object.freeze({id: 'primary', th: 'ประถม', lo: 4, hi: 9}),
  Object.freeze({id: 'lower', th: 'ม.ต้น', lo: 10, hi: 12}),
  Object.freeze({id: 'upper', th: 'ม.ปลาย · ปวช.', lo: 13, hi: 18}),
]);
/** The level filter's value for records without grade codes (the 2026 source has codes for สพฐ. schools only). */
export const LEVEL_UNKNOWN = 'unknown';
export const levelsOf = (lo, hi) => (lo > 0 && hi >= lo ? LEVELS.filter(l => lo <= l.hi && hi >= l.lo).map(l => l.id) : []);
export const GRADE_NAMES = Object.freeze(['', 'อ.1', 'อ.2', 'อ.3', 'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6', 'ปวช.1', 'ปวช.2', 'ปวช.3']);
/** "อ.1–ป.6" (one name when the range is one grade); '' when unknown. */
export const gradeRange = r => (r?.lo > 0 ? (r.hi > r.lo ? `${GRADE_NAMES[r.lo]}–${GRADE_NAMES[r.hi]}` : GRADE_NAMES[r.lo]) : '');

/**
 * Symbol size on the map (the Hotel contract, owner 2026-11-01): the symbol's AREA grows with the recorded students —
 * radius = k(zoom) · √(students / 400), students capped at STUDENTS_SIZE_CAP (above it the cap size), never below
 * PIN_MIN_RADIUS. A record with unknown students is drawn hollow at the UNKNOWN_STUDENTS_SIZE size (EVID-05: never a
 * measured 0). PIN_SCALE gives k (px of radius for 400 students) by zoom; the legend and the HTML pins use the same numbers.
 */
export const PIN_SCALE = Object.freeze([[6, 0.9], [8, 1.3], [10, 2.0], [12, 3.2], [14, 4.8], [16, 5.8], [18, 6.4]]);
export const STUDENTS_SIZE_CAP = 4000;
export const SIZE_UNIT = 400;
export const PIN_MIN_RADIUS = 1.6;
export const UNKNOWN_STUDENTS_SIZE = 200;
export function pinK(zoom) {
  const s = PIN_SCALE;
  if (!(zoom > s[0][0])) return s[0][1];
  for (let i = 1; i < s.length; i++) if (zoom <= s[i][0]) return s[i - 1][1] + (s[i][1] - s[i - 1][1]) * (zoom - s[i - 1][0]) / (s[i][0] - s[i - 1][0]);
  return s.at(-1)[1];
}
/** Symbol radius in px for a row's students at a zoom (unknown → the UNKNOWN_STUDENTS_SIZE size, drawn hollow by the caller). */
export const pinRadius = (students, zoom) => {
  const n = Number.isFinite(students) && students > 0 ? Math.min(students, STUDENTS_SIZE_CAP) : UNKNOWN_STUDENTS_SIZE;
  return Math.max(PIN_MIN_RADIUS, pinK(zoom) * Math.sqrt(n / SIZE_UNIT));
};
/**
 * The same size as a MapLibre expression of feature property `r` (students, 0 = unknown): min(cap, `factor` × radius)
 * + `add` px (zoom stays the top-level input, as MapLibre requires).
 */
export function pinSizeExpression(factor = 1, add = 0, cap = 1e6) {
  const at = k => ['+', add, ['min', cap, ['*', factor, ['max', PIN_MIN_RADIUS, ['*', k, ['sqrt', ['/', ['case', ['>', ['get', 'r'], 0], ['min', ['get', 'r'], STUDENTS_SIZE_CAP], UNKNOWN_STUDENTS_SIZE], SIZE_UNIT]]]]]]];
  return ['interpolate', ['linear'], ['zoom'], ...PIN_SCALE.flatMap(([z, k]) => [z, at(k)])];
}
/** Size class kept for HTML pins and lists: 0 small (< 200 students or unknown), 1 medium (200–999), 2 large (≥ 1,000). */
export const pinSizeOf = n => (Number.isFinite(n) && n >= 1000 ? 2 : Number.isFinite(n) && n >= 200 ? 1 : 0);

/**
 * Importance of a record for labels (the Hotel rule “important first”, owner 2026-11-01): the mean of its percentile
 * among all records by recorded students and by published tuition (the middle of min–max). A record without tuition
 * uses its students percentile only (a fee is never guessed); without students, its tuition percentile only; with
 * neither, 0. Ranking only — never shown as a figure.
 */
export function importanceScores(rows) {
  const feeOf = r => (r.fee ? (r.fee.min + r.fee.max) / 2 : null);
  const pct = values => {
    const sorted = values.filter(v => Number.isFinite(v)).sort((a, b) => a - b);
    const n = sorted.length;
    return v => {
      if (!Number.isFinite(v) || !n) return null;
      let lo = 0, hi = n;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] <= v) lo = mid + 1; else hi = mid; }
      return lo / n;  // share of records at or below v
    };
  };
  const studentsPct = pct(rows.map(r => r.students)), feePct = pct(rows.map(feeOf));
  return rows.map(r => {
    const parts = [studentsPct(r.students), feePct(feeOf(r))].filter(v => v !== null);
    return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
  });
}

/** The value a row adds to a measure: its students (known only) or 1 record. */
export const rowValue = (r, metric = 'students') => (countsRecords(metric) ? 1 : (Number.isFinite(r?.students) && r.students > 0 ? r.students : 0));
/** The value of an aggregate ({count, students}) under a measure. */
export const valueOf = (a, metric = 'students') => (countsRecords(metric) ? a?.count || 0 : a?.students || 0);

/** Every province of the production base info, keyed by the production route code (/v3/citymeter/{code}). */
let PROVINCE_LIST = [];
export function setProvinces(list) { PROVINCE_LIST = Object.freeze((list || []).map(p => Object.freeze({code: p.id, dopa: p.code, th: p.name, en: p.nameEn}))); }
export const provinces = () => PROVINCE_LIST;
export const provinceByCode = code => PROVINCE_LIST.find(p => p.code === String(code || '').toUpperCase()) || null;
/** Accept a production code (BKK), a DOPA code (10) or an English/Thai name; returns the production code or ''. */
export const provinceCodeFrom = value => {
  const v = String(value || '').trim();
  const p = PROVINCE_LIST.find(x => x.code === v.toUpperCase() || x.dopa === v || x.en.toLowerCase() === v.toLowerCase() || x.th === v);
  return p ? p.code : '';
};

/** A usable coordinate inside Thailand's bounding box (never invented). */
export const hasPoint = r => Number.isFinite(r?.latitude) && Number.isFinite(r?.longitude) &&
  r.latitude >= 5 && r.latitude <= 21 && r.longitude >= 97 && r.longitude <= 106;

const lower = v => String(v || '').toLocaleLowerCase('th-TH');
const pos = v => (Number.isFinite(v) && v > 0 ? v : null);

/**
 * Decode data/schools.json into row objects plus dictionaries.
 * `index` is the area index (js/areas.js#buildAreaIndex): every placed district code must exist there.
 */
export function decodeDataset(json, index) {
  if (!json?.cols || !Array.isArray(json.cols.key)) throw new Error('Invalid school dataset');
  const c = json.cols, n = c.key.length, V = json.vocab || {};
  const groups = (json.groups || []).map((g, i) => ({...g, index: i, series: seriesOf(g.id), short: GROUP_SHORT[g.id] || g.th}));
  const affs = (json.affiliations || []).map((a, i) => ({...a, index: i}));
  const sources = json.sources || [];
  const stations = (json.stations || []).map((s, i) => ({...s, index: i}));
  const urls = json.urls || [], texts = json.qualityTexts || [], roles = json.coordRoles || [];
  const fees = json.fee || {}, feeEvidence = json.feeEvidence || {}, prog = json.prog || {}, hist = json.hist || {}, closed = json.closed || {};
  const rows = [];
  let dropped = 0;
  for (let i = 0; i < n; i++) {
    const area = c.district[i] >= 0 ? json.districts[c.district[i]] : '';
    const province = c.province[i] >= 0 ? json.provinces[c.province[i]] : '';
    if (area && !index?.byId.has(area)) { dropped++; continue; }
    const group = groups[c.group[i]] || groups.at(-1);
    const aff = affs[c.aff[i]] || null;
    const students = pos(c.students[i]);
    const lat = c.lat[i], lon = c.lon[i];
    const k = String(i);
    const fee = fees[k] ? {min: fees[k].min, max: fees[k].max, year: fees[k].year, grades: fees[k].grades,
      url: fees[k].url >= 0 ? urls[fees[k].url] : '', items: fees[k].items || [], more: fees[k].more || 0} : null;
    const row = {
      id: c.key[i], name: c.name[i], nameEn: c.nameEn[i], index: i,
      group: group.index, groupId: group.id, series: group.series, kind: json.kinds?.[c.kind[i]] || '',
      aff, students, size: sizeOf(students), teachers: pos(c.teachers[i]), classrooms: pos(c.classrooms[i]),
      lo: c.lo[i], hi: c.hi[i], levels: levelsOf(c.lo[i], c.hi[i]),
      area, province, admin: V.admin?.[c.admin[i]] || 'none',
      longitude: Number.isFinite(lon) ? lon : null, latitude: Number.isFinite(lat) ? lat : null, coordRole: c.coord[i] >= 0 ? roles[c.coord[i]] || '' : '',
      source: sources[c.src[i]] || {id: '', th: '', url: ''}, url: c.url[i] >= 0 ? urls[c.url[i]] : '',
      rail: c.rail[i] >= 0 ? {station: stations[c.rail[i]], m: c.railM[i]} : null,
      railNext: c.rail2[i] >= 0 ? {station: stations[c.rail2[i]], m: c.rail2M[i]} : null,
      quality: c.q[i] >= 0 ? {lines: String(texts[c.q[i]] || '').split(' | ').map(s => s.trim()).filter(Boolean), year: c.qy[i], url: c.qurl[i] >= 0 ? urls[c.qurl[i]] : ''} : null,
      fee, feeEvidence: feeEvidence[k] >= 0 ? urls[feeEvidence[k]] : '',
      curriculum: prog[k]?.[0] || '', accreditation: prog[k]?.[1] || '',
      history: Array.isArray(hist[k]) ? hist[k] : null,
      closed: closed[k] ? {on: closed[k][0] || '', url: closed[k][1] >= 0 ? urls[closed[k][1]] : ''} : null,
    };
    const a = area ? index.byId.get(area) : null;
    const p = province ? PROVINCE_LIST.find(x => x.code === province) : null;
    row.haystack = lower([row.name, row.nameEn, aff?.th, aff?.short, a?.name, a?.nameEn, p?.th, p?.en, group.th, row.kind].filter(Boolean).join(' '));
    rows.push(row);
  }
  const scores = importanceScores(rows);
  rows.forEach((r, i) => { r.importance = scores[i]; });
  return {meta: json.meta || {}, rows, groups, affs, stations, sources, history: json.history || [], dropped};
}

/**
 * Shared filter used by map, counters, charts, panel and table.
 * f = {search, group, level, size, province, aff}.
 * Area selection and area focus are applied by the caller (row scopes, see app.js).
 */
export function filterRows(rows, f = {}) {
  // Every word of the search, anywhere in the school's names, affiliation, area or type (the Hotel 0.3.4 rule).
  const terms = lower(f.search).trim().split(/\s+/).filter(Boolean);
  return rows.filter(r => {
    if (f.group && r.groupId !== f.group) return false;
    if (f.level && (f.level === LEVEL_UNKNOWN ? r.levels.length > 0 : !r.levels.includes(f.level))) return false;
    if (f.size && r.size !== f.size) return false;
    if (f.province && r.province !== f.province) return false;
    if (f.aff && r.aff?.id !== f.aff) return false;
    return terms.every(t => r.haystack.includes(t));
  });
}

/** Totals for a selection: records, known students, records with unknown students, points, placement, affiliations. */
export function summarize(rows) {
  let points = 0, placed = 0, provinced = 0, students = 0, studentsUnknown = 0;
  const affs = new Set(), areas = new Set(), provinces = new Set();
  for (const r of rows) {
    if (hasPoint(r)) points++;
    if (r.area) { placed++; areas.add(r.area); }
    if (r.province) { provinced++; provinces.add(r.province); }
    if (r.students) students += r.students; else studentsUnknown++;
    if (r.aff) affs.add(r.aff.id);
  }
  return {count: rows.length, students, studentsUnknown, points, placed, provinced, affs: affs.size, areas: areas.size, provinces: provinces.size};
}

/** Records and students per group for a selection (every group listed, zero kept as a measured 0). */
export function mixOf(rows, groups) {
  const byGroup = groups.map(g => ({id: g.id, index: g.index, series: g.series, th: g.th, short: g.short, count: 0, students: 0}));
  for (const r of rows) { const g = byGroup[r.group]; g.count++; g.students += r.students || 0; }
  return {byGroup};
}

/** Records and students per size band (unknown students apart). */
export function sizeMixOf(rows) {
  const bands = SIZE_BANDS.map(b => ({...b, count: 0, students: 0}));
  let unknown = 0;
  for (const r of rows) {
    const b = r.size ? bands.find(x => x.id === r.size) : null;
    if (b) { b.count++; b.students += r.students; } else unknown++;
  }
  return {bands, unknown};
}

/** Records per level taught (a school teaching two levels is in both; unknown grades apart). */
export function levelMixOf(rows) {
  const levels = LEVELS.map(l => ({...l, count: 0}));
  let unknown = 0;
  for (const r of rows) {
    if (!r.levels.length) { unknown++; continue; }
    for (const l of levels) if (r.levels.includes(l.id)) l.count++;
  }
  return {levels, unknown};
}

/** Share of the measure that lies within `m` metres (straight line) of an operating rail station; rows with a point only. */
export function railShare(rows, metric = 'students', m = 500) {
  let within = 0, base = 0, noPoint = 0;
  for (const r of rows) {
    const v = rowValue(r, metric);
    if (!hasPoint(r)) { noPoint += v; continue; }
    base += v;
    if (r.rail && r.rail.m <= m) within += v;
  }
  return {within, base, noPoint, share: base ? (within / base) * 100 : null};
}

export const safeURL = value => {
  try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; }
  catch { return ''; }
};

/**
 * Production CityMETER deep links (the route scheme of the production bundle). Production has a school dataset
 * (`?d=school`), so the link opens the same area with it.
 */
export const PRODUCTION = 'https://landometer.com/v3/citymeter';
export function productionLink({province = '', area = ''} = {}) {
  if (!province) return `${PRODUCTION}?d=school`;
  if (area) return `${PRODUCTION}/${province}/D/${area}?d=school`;
  return `${PRODUCTION}/${province}?d=school`;
}
/** CityMETER sibling demos linked by registry id. */
export const TRANSIT_SITE = 'https://montri-th.github.io/transit/';
export const stationLink = s => (s?.id ? `${TRANSIT_SITE}?station=${encodeURIComponent(s.id)}` : '');
