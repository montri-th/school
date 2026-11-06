/**
 * Reading-panel view models. Pure: no DOM, no map.
 *
 * Every profile reads `scopeRows` (filters before any area selection) so ranks and comparisons keep the whole
 * selection as reference. A row is one school record of the research master (one CityMETER school UUID of 2026); the
 * default measure is students recorded (Σ student_count), the other is schools (“แห่ง”). Affiliations are the source's
 * own (99_SOURCE_2026.affiliation_type_id); nothing is joined by a school name. Points are the sheet's checked registry
 * points and are never upgraded; district membership is the production district the source lists the school under.
 *
 * Distances (comparison set, station surroundings) are straight lines between reference points, computed here from
 * the published coordinates; they are not walking routes, travel times, school zones or catchments.
 */
import {mixOf, sizeMixOf, levelMixOf, hasPoint, valueOf, rowValue, railShare} from './model.js';
import {summarizeAreas, byMetric, levelWords} from './areas.js';
import {serviceMixOf, learningOrder, learningContext, nearPoint, LEARNING_NEAR_M} from './learning.js';

const COLLATOR = new Intl.Collator('th');
/** Lists: most students first (unknown students last), then name — the recorded size is the order users scan by. */
export const listOrder = (a, b) => (b.students || 0) - (a.students || 0) || COLLATOR.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function distanceM(lat1, lon1, lat2, lon2) {
  const R = 6371008.8, rad = Math.PI / 180;
  const p1 = lat1 * rad, p2 = lat2 * rad, dp = (lat2 - lat1) * rad, dl = (lon2 - lon1) * rad;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Affiliations present in rows, most of the measure first (then the other measure, then name). */
export function affsIn(rows, limit = 12, metric = 'students') {
  const m = new Map();
  for (const r of rows) if (r.aff) { const e = m.get(r.aff.id) || {aff: r.aff, count: 0, students: 0}; e.count++; e.students += r.students || 0; m.set(r.aff.id, e); }
  const key = metric === 'count' ? ['count', 'students'] : ['students', 'count'];
  return [...m.values()].map(e => ({...e, value: e[key[0]]}))
    .sort((a, b) => b[key[0]] - a[key[0]] || b[key[1]] - a[key[1]] || COLLATOR.compare(a.aff.th, b.aff.th)).slice(0, limit);
}

/** Schools of the selection with published annual tuition, and with other fee evidence. */
export function feesOf(rows) {
  let tuition = 0, evidence = 0;
  for (const r of rows) { if (r.fee) tuition++; else if (r.feeEvidence) evidence++; }
  return {tuition, evidence};
}

/** Districts of a selection ranked by the measure (ties: the other measure, then name). */
export function rankAreas(rows, index, {province = '', metric = 'students'} = {}) {
  return summarizeAreas(rows, index, {province}).map(a => ({...a, value: valueOf(a, metric)})).sort(byMetric(metric));
}

/** Rows of the selection that no district holds, by reason (rows are never placed by name at run time). */
export function unplacedOf(rows) {
  let noArea = 0, noProvince = 0, students = 0;
  for (const r of rows) {
    if (r.area) continue;
    students += r.students || 0;
    if (r.province) noArea++;
    else noProvince++;
  }
  return {noArea, noProvince, students, total: noArea + noProvince};
}

const sum = (rows, metric) => rows.reduce((s, r) => s + rowValue(r, metric), 0);

export function buildOverview(scopeRows, index, {province = '', groups = [], metric = 'students'} = {}) {
  return {ranking: rankAreas(scopeRows, index, {province, metric}), affs: affsIn(scopeRows, 12, metric), fees: feesOf(scopeRows), unplaced: unplacedOf(scopeRows),
    mix: mixOf(scopeRows, groups), sizes: sizeMixOf(scopeRows), levels: levelMixOf(scopeRows), count: scopeRows.length, students: sum(scopeRows, 'students'),
    studentsUnknown: scopeRows.filter(r => !r.students).length, rail: railShare(scopeRows, metric)};
}

/**
 * EVID-05 state of a selection: every district is in the national scope of the roster, so a district with no record is
 * a measured zero of this dataset (“0 ที่พบ”), never no_data.
 */
const selectionState = count => (count ? 'measured' : 'measured_zero');

/**
 * Stations whose 500 m straight-line radius holds the most of the measure among `rows` (each row counted at its
 * nearest operating station only, so the list never adds a row twice).
 */
export function stationsOf(rows, metric = 'students', m = 500, limit = 6) {
  const by = new Map();
  for (const r of rows) {
    if (!r.rail || r.rail.m > m) continue;
    const s = r.rail.station, e = by.get(s.id) || {station: s, count: 0, students: 0, value: 0};
    e.count++; e.students += r.students || 0; e.value += rowValue(r, metric); by.set(s.id, e);
  }
  return [...by.values()].sort((a, b) => b.value - a.value || COLLATOR.compare(a.station.name, b.station.name)).slice(0, limit);
}

export function buildAreaProfile(scopeRows, areaId, index, groups, {metric = 'students', learning = null} = {}) {
  const area = index.byId.get(areaId);
  if (!area) return null;
  const ranking = rankAreas(scopeRows, index, {metric});
  const inProvince = ranking.filter(a => a.province === area.province);
  const mine = scopeRows.filter(r => r.area === areaId);
  // Share of the province's whole total in the scope (placed rows and rows placed only at province level).
  const provinceRows = scopeRows.filter(r => r.province === area.province);
  const pos = ranking.findIndex(a => a.id === areaId);
  const posProvince = inProvince.findIndex(a => a.id === areaId);
  const value = sum(mine, metric), provinceValue = sum(provinceRows, metric);
  return {
    area, words: levelWords(area.province), metric, value, count: mine.length, students: sum(mine, 'students'), studentsUnknown: mine.filter(r => !r.students).length,
    km2: area.km2, coverageState: selectionState(mine.length), scopeCount: scopeRows.length,
    rank: pos >= 0 && value > 0 ? pos + 1 : null, rankOf: ranking.filter(a => a.value > 0).length,
    rankProvince: posProvince >= 0 && value > 0 ? posProvince + 1 : null, rankProvinceOf: inProvince.filter(a => a.value > 0).length,
    provinceValue, share: provinceValue ? (value / provinceValue) * 100 : null,
    points: mine.filter(hasPoint).length, ...mixOf(mine, groups), sizes: sizeMixOf(mine), levels: levelMixOf(mine), affs: affsIn(mine, 12, metric),
    fees: feesOf(mine), rail: railShare(mine, metric), stations: stationsOf(mine, metric),
    rows: [...mine].sort(listOrder),
    learning: learning ? learningContext(learning.rows, {area: areaId, services: learning.services}) : null,
  };
}

/** Affiliation card: its schools and students in the scope, the school groups it covers and where they are. */
export function buildAffProfile(affId, {allRows, scopeRows, index, data, groups = [], metric = 'students'}) {
  const aff = data.affs.find(c => c.id === affId);
  if (!aff) return null;
  const all = allRows.filter(r => r.aff?.id === affId);
  const inScope = scopeRows.filter(r => r.aff?.id === affId);
  return {aff, all: all.length, allStudents: sum(all, 'students'), scopeCount: inScope.length, scopeStudents: sum(inScope, 'students'),
    ...mixOf(inScope, groups), areas: rankAreas(inScope, index, {metric}), provinces: new Set(inScope.map(r => r.province).filter(Boolean)).size,
    points: inScope.filter(hasPoint).length, placed: inScope.filter(r => r.area).length, rail: railShare(inScope, metric),
    rows: [...inScope].sort(listOrder)};
}

/**
 * A building the map draws, with the rows whose points fall inside it (building-join.js):
 * sel = {key, kind: 'osm', rows, height}. Not a school campus: no name.
 */
export function buildBuildingProfile(sel, index, groups) {
  if (!sel?.rows?.length) return null;
  const rows = [...sel.rows].sort(listOrder);
  const area = index.byId.get(rows[0].area) || null;
  const areaIds = [...new Set(rows.map(r => r.area))];
  return {key: sel.key, kind: sel.kind || 'osm', rows, count: rows.length, students: sum(rows, 'students'), studentsUnknown: rows.filter(r => !r.students).length,
    area, areaCount: areaIds.length, words: levelWords(rows[0].province), height: Number.isFinite(sel.height) ? sel.height : null,
    affs: affsIn(rows, 6), ...mixOf(rows, groups)};
}

export const COMPSET_RADIUS_M = 2000;
export const COMPSET_LIMIT = 10;

/**
 * Nearby comparison set of a school (a screening aid for a family or an operator, not a school zone or a ranking):
 * records with a point within COMPSET_RADIUS_M in a straight line, of the same school group, that teach at least one
 * level the school teaches (when the school's grades are known; otherwise the group alone), nearest first. Everything round the school (every record within the radius,
 * any group) is stated beside it. Reads every row of the dataset (`allRows`), so the set does not move with the filters.
 */
export function compsetOf(row, allRows, {radius = COMPSET_RADIUS_M, limit = COMPSET_LIMIT} = {}) {
  if (!hasPoint(row)) return null;
  const dLat = radius / 110574, dLon = radius / (111320 * Math.cos((row.latitude * Math.PI) / 180));
  const near = [];
  let count = 0, students = 0, unknown = 0;
  const mine = new Set(row.levels);
  for (const r of allRows) {
    if (r === row || !hasPoint(r)) continue;
    if (Math.abs(r.latitude - row.latitude) > dLat || Math.abs(r.longitude - row.longitude) > dLon) continue;
    const m = distanceM(row.latitude, row.longitude, r.latitude, r.longitude);
    if (m > radius) continue;
    count++; if (r.students) students += r.students; else unknown++;
    // Levels known: share at least one; unknown (no grade codes): the group alone decides.
    const levelOK = mine.size ? r.levels.some(l => mine.has(l)) : true;
    if (r.group === row.group && levelOK) near.push({row: r, m});
  }
  near.sort((a, b) => a.m - b.m || listOrder(a.row, b.row));
  return {radius, around: {count, students, unknown}, matches: near.length, rows: near.slice(0, limit), rule: {group: row.group, levels: [...mine]}};
}

/**
 * Enrolment history of a private school (16_ENROLMENT, OPEC snapshots B.E. 2565–2567, semesters 1–2): the periods
 * with a value, in order; null when none.
 */
export function historyOf(row, periods = []) {
  if (!row?.history) return null;
  const list = row.history.map((v, i) => ({period: periods[i] || '', value: Number.isFinite(v) && v > 0 ? v : null})).filter(p => p.period);
  return list.some(p => p.value) ? list : null;
}

/** School detail: the comparison set, the other schools of its affiliation in its district, and its rail context. */
export function buildSchoolDetail(row, {scopeRows, allRows, index, groups, periods = [], building = null, learning = null}) {
  if (!row) return null;
  const area = row.area ? index.byId.get(row.area) || null : null;
  const sameArea = row.area ? scopeRows.filter(r => r.area === row.area && r.id !== row.id) : [];
  return {row, area, words: levelWords(row.province), group: groups[row.group], building,
    compset: compsetOf(row, allRows), history: historyOf(row, periods),
    sameArea: {count: sameArea.length, students: sum(sameArea, 'students')},
    learning: learning ? learningContext(learning.rows, {area: row.area, lat: row.latitude, lon: row.longitude, services: learning.services}) : null};
}

export const STATION_RADIUS_M = 500;

/**
 * A rail station of CityMETER · Transit and the records whose points lie within STATION_RADIUS_M of its reference
 * point (straight line; a record near two stations is listed at both — this view never adds stations together).
 */
export function buildStationProfile(station, {scopeRows, groups, radius = STATION_RADIUS_M, metric = 'students', learning = null}) {
  if (!station) return null;
  const rows = [];
  const dLat = radius / 110574, dLon = radius / (111320 * Math.cos((station.lat * Math.PI) / 180));
  for (const r of scopeRows) {
    if (!hasPoint(r) || Math.abs(r.latitude - station.lat) > dLat || Math.abs(r.longitude - station.lon) > dLon) continue;
    const m = distanceM(station.lat, station.lon, r.latitude, r.longitude);
    if (m <= radius) rows.push({row: r, m});
  }
  rows.sort((a, b) => listOrder(a.row, b.row));
  const list = rows.map(x => x.row);
  return {station, radius, metric, count: list.length, students: sum(list, 'students'), studentsUnknown: list.filter(r => !r.students).length,
    value: sum(list, metric), ...mixOf(list, groups), sizes: sizeMixOf(list), levels: levelMixOf(list), affs: affsIn(list, 8, metric), rows: list,
    distance: new Map(rows.map(x => [x.row.id, x.m])),
    learning: learning ? (() => { const near = nearPoint(learning.rows, station.lat, station.lon, radius); return {radius, count: near.length, services: serviceMixOf(near.map(x => x.row), learning.services)}; })() : null};
}

/* ---------- learning-service records (measure `learning`, data/learning.json) ---------- */

/** Overview under the learning measure: districts ranked by records, records per service, points and rail. */
export function buildLearningOverview(scopeRows, index, {province = '', services = []} = {}) {
  return {ranking: rankAreas(scopeRows, index, {province, metric: 'learning'}), services: serviceMixOf(scopeRows, services), count: scopeRows.length,
    points: scopeRows.filter(hasPoint).length, unplaced: unplacedOf(scopeRows), rail: railShare(scopeRows, 'learning'),
    providers: scopeRows.filter(r => r.source === 'provider').length};
}

/** A district under the learning measure: its records by service, its rank and share of the province, nearest stations. */
export function buildLearningArea(scopeRows, areaId, index, services = []) {
  const area = index.byId.get(areaId);
  if (!area) return null;
  const ranking = rankAreas(scopeRows, index, {metric: 'learning'});
  const inProvince = ranking.filter(a => a.province === area.province);
  const mine = scopeRows.filter(r => r.area === areaId);
  const provinceCount = scopeRows.filter(r => r.province === area.province).length;
  const pos = ranking.findIndex(a => a.id === areaId), posProvince = inProvince.findIndex(a => a.id === areaId);
  return {area, words: levelWords(area.province), metric: 'learning', value: mine.length, count: mine.length, coverageState: selectionState(mine.length),
    scopeCount: scopeRows.length, km2: area.km2,
    rank: pos >= 0 && mine.length ? pos + 1 : null, rankOf: ranking.filter(a => a.value > 0).length,
    rankProvince: posProvince >= 0 && mine.length ? posProvince + 1 : null, rankProvinceOf: inProvince.filter(a => a.value > 0).length,
    provinceValue: provinceCount, share: provinceCount ? (mine.length / provinceCount) * 100 : null,
    points: mine.filter(hasPoint).length, services: serviceMixOf(mine, services), rail: railShare(mine, 'learning'), stations: stationsOf(mine, 'learning'),
    rows: [...mine].sort(learningOrder)};
}

/** A station under the learning measure: records with a published point within the radius (straight line). */
export function buildLearningStation(station, {scopeRows, services = [], radius = STATION_RADIUS_M}) {
  if (!station) return null;
  const near = nearPoint(scopeRows, station.lat, station.lon, radius);
  const rows = near.map(x => x.row);
  return {station, radius, metric: 'learning', count: rows.length, value: rows.length, services: serviceMixOf(rows, services), rows,
    distance: new Map(near.map(x => [x.row.id, x.m]))};
}

/** A drawn building with the learning records whose points fall inside it (display only). */
export function buildLearningBuilding(sel, index, services = []) {
  if (!sel?.rows?.length) return null;
  const rows = [...sel.rows].sort(learningOrder);
  const area = index.byId.get(rows[0].area) || null;
  return {key: sel.key, kind: sel.kind || 'osm', rows, count: rows.length, area, areaCount: new Set(rows.map(r => r.area)).size,
    words: levelWords(rows[0].province), height: Number.isFinite(sel.height) ? sel.height : null, services: serviceMixOf(rows, services)};
}

/**
 * One learning record: the other records of its district (by service) and the schools round its published point
 * (straight line, LEARNING_NEAR_M, nearest first) with the students they record — the reason a reader opens it.
 */
export function buildLearningDetail(row, {learningRows = [], schoolRows = [], index, services = [], building = null}) {
  if (!row) return null;
  const area = row.area ? index.byId.get(row.area) || null : null;
  const sameArea = row.area ? learningRows.filter(r => r.area === row.area && r !== row) : [];
  const near = hasPoint(row) ? nearPoint(schoolRows, row.latitude, row.longitude, LEARNING_NEAR_M) : [];
  const schoolsInArea = row.area ? schoolRows.filter(r => r.area === row.area) : [];
  return {row, area, words: levelWords(row.province), building,
    sameArea: {count: sameArea.length, services: serviceMixOf(sameArea, services)},
    schools: {radius: LEARNING_NEAR_M, rows: near.slice(0, 8), count: near.length, students: sum(near.map(x => x.row), 'students')},
    schoolsInArea: {count: schoolsInArea.length, students: sum(schoolsInArea, 'students')}};
}
