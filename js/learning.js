/**
 * The learning-service layer (เรียนเสริมและพัฒนาทักษะ, 0.2.0): data/learning.json, read from tabs 27–29 of the same
 * research master (scripts/build-learning.py). Pure: no DOM, no map.
 *
 * One row = one record of 27_LEARNING_SERVICES: an OPEC nonformal-school code the research team classed as tutoring,
 * language, arts or child development, or a provider-confirmed service point. A licence record of the register, not a
 * count of places that teach today; counted apart from the 40,828 school records and never added to them. A record
 * may carry several services, so service figures overlap and a total counts each record once.
 *
 * Membership is the district the register lists; a point is the registry point the build kept because it falls inside
 * that district (pointState 'pin'); every other record counts in its district without a pin. The measure `learning`
 * counts records (“แห่ง”) on the LDS `count` family, like the school records.
 *
 * Learning rows carry the row interface the shared code reads (id, area, province, latitude/longitude, rail, series,
 * name, haystack, importance), so the Aha, the area model, the province frames, the station and building panels and
 * the pins work on them unchanged; kind === 'learning' tells the views apart.
 */
const lower = v => String(v || '').toLocaleLowerCase('th-TH');
const COLLATOR = new Intl.Collator('th');

/** LDS DATAVIZ-05 series of the learning records: 8 (ring) — free in School; the star (6) is never used. */
export const LEARNING_SERIES = 8;
/** Symbol size of a learning record (no student count): the size of a 200-student school, always filled. */
export const LEARNING_PIN_SIZE = 200;
/** Nearby learning records of a school (straight line, published points only). */
export const LEARNING_NEAR_M = 1000;
export const LEARNING_NEAR_LIMIT = 8;
/** Learning filter fields (the school filters group · level · size · aff do not apply to these records). */
export const LEARNING_FIELDS = Object.freeze(['search', 'province', 'service']);
export const SERVICE_PICTOGRAM = Object.freeze({tutor: 'tutor', language: 'language', arts: 'arts', child: 'child'});
/** Why a record has no pin (the build's point check), for its “ที่มาและพิกัด”. */
export const POINT_TH = Object.freeze({
  pin: '',
  none: 'ทะเบียนไม่มีพิกัด',
  otherDistrict: 'จุดตามทะเบียนอยู่นอกเขต/อำเภอที่ทะเบียนระบุ จึงไม่ปักหมุด',
  otherProvince: 'จุดตามทะเบียนอยู่นอกจังหวัดที่ทะเบียนระบุ จึงไม่ปักหมุด',
  unusable: 'ค่าพิกัดในทะเบียนใช้ไม่ได้',
});

export const isLearning = r => r?.kind === 'learning';

/**
 * Decode data/learning.json. `index` = the area index (every district must exist); `stationById` = the stations of
 * data/schools.json (the same CityMETER · Transit commit).
 */
export function decodeLearning(json, index, stationById = new Map()) {
  if (!json?.cols || !Array.isArray(json.cols.key)) throw new Error('Invalid learning dataset');
  const c = json.cols, n = c.key.length;
  const services = (json.services || []).map((s, i) => ({...s, index: i}));
  const states = json.pointStates || [];
  const rows = [];
  let dropped = 0;
  for (let i = 0; i < n; i++) {
    const area = c.district[i] >= 0 ? json.districts[c.district[i]] : '';
    const province = c.province[i] >= 0 ? json.provinces[c.province[i]] : '';
    if (area && !index?.byId.has(area)) { dropped++; continue; }
    const mine = services.filter(s => (c.svc[i] & s.bit) !== 0);
    const station = c.rail[i] >= 0 ? stationById.get(json.stations[c.rail[i]]) : null;
    const lat = c.lat[i], lon = c.lon[i];
    const row = {
      id: c.key[i], kind: 'learning', index: i, name: c.name[i], nameEn: c.nameEn[i],
      services: mine.map(s => s.id), serviceNames: mine.map(s => s.th), svc: c.svc[i],
      type: c.type[i] >= 0 ? json.types[c.type[i]] : '', evidence: c.ev[i] >= 0 ? json.evidence[c.ev[i]] : '',
      area, province, series: LEARNING_SERIES,
      latitude: Number.isFinite(lat) ? lat : null, longitude: Number.isFinite(lon) ? lon : null, pointState: states[c.pt[i]] || 'none',
      rail: station ? {station, m: c.railM[i]} : null, railNext: null,
      url: c.url[i] >= 0 ? json.urls[c.url[i]] : '', source: c.src[i] === 1 ? 'provider' : 'opec',
      students: null, importance: 0,
    };
    const a = area ? index.byId.get(area) : null;
    row.haystack = lower([row.name, row.nameEn, ...row.serviceNames, row.type, a?.name, a?.nameEn, 'เรียนเสริม'].filter(Boolean).join(' '));
    rows.push(row);
  }
  // Labels rank by importance: records with more services first (a hub reads before a single class), never a size.
  const most = Math.max(1, ...rows.map(r => r.services.length));
  for (const r of rows) r.importance = (r.services.length - 1) / most;
  return {meta: json.meta || {}, services, rows, dropped};
}

/** f = {search, province, service}: every word of the search in the record's names, services, type or district. */
export function filterLearning(rows, f = {}) {
  const terms = lower(f.search).trim().split(/\s+/).filter(Boolean);
  return rows.filter(r => {
    if (f.province && r.province !== f.province) return false;
    if (f.service && !r.services.includes(f.service)) return false;
    return terms.every(t => r.haystack.includes(t));
  });
}

/** Records per service (a record with two services is in both; every service listed, zero kept). */
export function serviceMixOf(rows, services) {
  const by = services.map(s => ({id: s.id, th: s.th, count: 0}));
  const pos = new Map(by.map((s, i) => [s.id, i]));
  for (const r of rows) for (const s of r.services) by[pos.get(s)].count++;
  return by;
}

/** Lists: more services first, then name (Thai order), then id. */
export const learningOrder = (a, b) => b.services.length - a.services.length || COLLATOR.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const distance = (lat1, lon1, lat2, lon2) => {
  const R = 6371008.8, rad = Math.PI / 180;
  const p1 = lat1 * rad, p2 = lat2 * rad, dp = (lat2 - lat1) * rad, dl = (lon2 - lon1) * rad;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Rows with a published point within `radius` m (straight line) of a point, nearest first: [{row, m}]. */
export function nearPoint(rows, lat, lon, radius = LEARNING_NEAR_M, {skip = null} = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  const dLat = radius / 110574, dLon = radius / (111320 * Math.cos((lat * Math.PI) / 180));
  const out = [];
  for (const r of rows) {
    if (r === skip || !Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) continue;
    if (Math.abs(r.latitude - lat) > dLat || Math.abs(r.longitude - lon) > dLon) continue;
    const m = distance(lat, lon, r.latitude, r.longitude);
    if (m <= radius) out.push({row: r, m});
  }
  return out.sort((a, b) => a.m - b.m || COLLATOR.compare(a.row.name, b.row.name));
}

/**
 * The learning context of a place for the school views: the records the register lists in a district (every record,
 * by service) and, round a point, the records with a published point within `radius` (nearest first).
 */
export function learningContext(rows, {area = '', lat = null, lon = null, radius = LEARNING_NEAR_M, limit = LEARNING_NEAR_LIMIT, services = []} = {}) {
  const inArea = area ? rows.filter(r => r.area === area) : [];
  const near = nearPoint(rows, lat, lon, radius);
  return {area, count: inArea.length, points: inArea.filter(r => Number.isFinite(r.latitude)).length, services: serviceMixOf(inArea, services),
    radius, near: near.slice(0, limit), nearCount: near.length};
}
