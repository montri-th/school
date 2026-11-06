/**
 * The learning-service layer (0.2.0, data/learning.json): data contract, the learning measure, its Aha, its views and
 * the learning context of the school views.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadLearning, readJSON} from './helpers.js';
import {attachFrames} from '../js/areas.js';
import {filterLearning, serviceMixOf, nearPoint, learningContext, learningOrder, isLearning, LEARNING_SERIES, LEARNING_PIN_SIZE, LEARNING_FIELDS, POINT_TH} from '../js/learning.js';
import {summarizeAreaInsight, filterAreaRows} from '../js/area-insight.js';
import {summarize, rowValue, valueOf, unitWords, hasPoint, countsRecords} from '../js/model.js';
import {buildAreaModel} from '../js/map-layers.js';
import {buildProvinceModel} from '../js/provinces.js';
import {scaleFor, COUNT_SCALE} from '../js/scales.js';
import {buildLearningOverview, buildLearningArea, buildLearningStation, buildLearningBuilding, buildLearningDetail, buildAreaProfile, buildSchoolDetail, buildStationProfile, stationsOf} from '../js/profile-model.js';
import {renderLearningOverview, renderLearningArea, renderLearningStation, renderLearningBuilding, renderLearning, renderArea, renderSchool, renderStation, renderFilterChips} from '../js/panel.js';
import {buildChartModel, areaMatrix} from '../js/chart-model.js';
import {sizeValue, pointCollection} from '../js/pins.js';
import {contextActions} from '../js/ask.js';
import {cueOf} from '../js/cues.js';

const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const CAVEAT = /ไม่ใช่|ยังไม่ได้ตรวจ|อาจเป็น|ไม่ได้แปลว่า|ยืนยันแล้ว|ค่าประมาณ|นับในยอดรวม|โปรดตรวจสอบ/;

test('learning.json: one row per record of 27_LEARNING_SERVICES (28 in scope + 29 provider-confirmed), keys unique and apart from the school UUIDs', () => {
  const {learningRaw: raw, learning, data} = loadLearning();
  assert.equal(learning.dropped, 0);
  assert.equal(learning.rows.length, raw.meta.rows);
  assert.equal(raw.meta.rows, raw.meta.counts.opec + raw.meta.counts.provider);
  assert.equal(raw.meta.counts.opec, raw.meta.counts['register.inScope'], 'every OPEC code the research team classed in scope, and only those');
  assert.equal(raw.meta.counts['register.codes'], raw.meta.counts['register.inScope'] + raw.meta.counts['register.pending'] + raw.meta.counts['register.outOfScope']);
  assert.equal(raw.meta.tabs['27_LEARNING_SERVICES'].gid, 73110627, 'the tab the owner named');
  for (const [tab, t] of Object.entries(raw.meta.tabs)) assert.match(t.sha256, /^[a-f0-9]{64}$/, `${tab}: its rows are bound by a hash`);
  const ids = new Set(learning.rows.map(r => r.id));
  assert.equal(ids.size, learning.rows.length);
  assert.ok(learning.rows.every(r => /^L[0-9a-f]{12}$/.test(r.id)), 'a derived key, never the OPEC code');
  const schools = new Set(data.rows.map(r => r.id));
  assert.ok(learning.rows.every(r => !schools.has(r.id)));
  assert.equal(raw.meta.checks['overlap.schoolCodes'], 0, 'no OPEC code of the layer is a school code of 02_SCHOOLS');
  assert.equal(raw.meta.registryId, 'research.TH.school');
  assert.equal(raw.meta.context.rail.commit, readJSON('data/schools.json').meta.context.rail.commit, 'the same CityMETER · Transit commit as the schools');
});

test('learning records: services from the research team (several allowed, a total counts each record once), district by code, no address or code field', () => {
  const {learningRaw: raw, learning, index} = loadLearning();
  assert.deepEqual(learning.services.map(s => s.id), ['tutor', 'language', 'arts', 'child']);
  for (const s of learning.services) assert.equal(learning.rows.filter(r => r.services.includes(s.id)).length, raw.meta.counts[`service.${s.id}`], s.id);
  assert.ok(learning.rows.every(r => r.services.length >= 1 && r.services.length <= 4));
  const mix = serviceMixOf(learning.rows, learning.services);
  assert.ok(mix.reduce((s, x) => s + x.count, 0) > learning.rows.length, 'service figures overlap');
  assert.ok(learning.rows.every(r => r.area && index.byId.get(r.area)?.province === r.province), 'every record sits in a production district of its province');
  assert.equal(new Set(learning.rows.map(r => r.area)).size, raw.meta.counts.districts);
  assert.equal(new Set(learning.rows.map(r => r.province)).size, raw.meta.counts.provinces);
  assert.deepEqual(Object.keys(raw.cols).sort(), ['district', 'ev', 'key', 'lat', 'lon', 'name', 'nameEn', 'province', 'pt', 'rail', 'railM', 'src', 'svc', 'type', 'url'].sort(), 'no address, code or review field');
  assert.ok(raw.urls.every(u => u.startsWith('https://') && !/docs\.google|drive\.google/.test(u)), 'public https pages only');
  assert.ok(learning.rows.filter(r => r.source === 'opec').every(r => /^https:\/\/school\.opec\.go\.th\/school\/\d+$/.test(r.url)), 'the OPEC profile page of every OPEC record');
  assert.ok(learning.rows.every(r => isLearning(r) && r.series === LEARNING_SERIES && r.students === null));
  assert.equal(cueOf(LEARNING_SERIES), 'ring', 'LDS series 8: the ring — never the star');
});

test('learning points: only the registry points inside the district the register lists are published; every other record counts without a pin', () => {
  const {learningRaw: raw, learning, index} = loadLearning();
  const pins = learning.rows.filter(hasPoint);
  assert.equal(pins.length, raw.meta.counts.points);
  assert.equal(pins.length, raw.meta.checks['point.pin']);
  assert.ok(learning.rows.every(r => (r.pointState === 'pin') === hasPoint(r)), 'a point exactly when the check kept it');
  assert.equal(Object.entries(raw.meta.checks).filter(([k]) => k.startsWith('point.')).reduce((s, [, v]) => s + v, 0), learning.rows.length);
  for (const s of Object.keys(POINT_TH)) assert.ok(raw.pointStates.includes(s), s);
  // Every published point lies in its district's drawn outline (display geometry of data/frames).
  const provinces = [...new Set(pins.map(r => r.province))];
  for (const p of provinces) attachFrames(index, readJSON(`data/frames/${p}.json`));
  const inside = (ring, x, y) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  for (const r of pins) {
    const g = index.byId.get(r.area).feature.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    assert.ok(polys.some(poly => inside(poly[0], r.longitude, r.latitude) && !poly.slice(1).some(h => inside(h, r.longitude, r.latitude))), `${r.id} in ${r.area}`);
  }
  // Rail only from a published point, and only an operating station of CityMETER · Transit.
  assert.ok(learning.rows.every(r => !r.rail || (hasPoint(r) && r.rail.station.status === 'operating' && r.rail.m <= 2000)));
});

test('the learning measure counts records on the LDS count family; school filters do not apply, the service filter does', () => {
  const {learning} = loadLearning();
  assert.ok(countsRecords('learning') && countsRecords('count') && !countsRecords('students'));
  assert.equal(rowValue(learning.rows[0], 'learning'), 1);
  assert.equal(valueOf({count: 7, students: 0}, 'learning'), 7);
  assert.equal(scaleFor('learning'), COUNT_SCALE);
  assert.deepEqual([unitWords('learning').one, unitWords('learning').label], ['แห่ง', 'เรียนเสริม']);
  assert.deepEqual([...LEARNING_FIELDS], ['search', 'province', 'service']);
  const tutor = filterLearning(learning.rows, {service: 'tutor'});
  assert.ok(tutor.length && tutor.every(r => r.services.includes('tutor')));
  const bkk = filterLearning(learning.rows, {province: 'BKK'});
  assert.ok(bkk.length && bkk.every(r => r.province === 'BKK'));
  assert.ok(filterLearning(learning.rows, {search: 'ปทุมวัน กวดวิชา'}).every(r => r.area === '1007' && r.services.includes('tutor')), 'every word of the search');
  assert.deepEqual([...learning.rows].sort(learningOrder).slice(0, 3).map(r => r.services.length >= 2), [true, true, true], 'lists: more services first');
});

test('learning Aha (snapshot fixture): ปทุมวัน · คลองเตย · ประเวศ hold 22% of Bangkok\'s learning records; เมืองเชียงใหม่ outside', () => {
  const {learning, index} = loadLearning();
  const a = summarizeAreaInsight(learning.rows, index, {metric: 'learning'});
  assert.equal(a.home, 'BKK');
  assert.deepEqual(a.areas.map(x => [x.id, x.name, x.value]), [['1007', 'ปทุมวัน', 94], ['1033', 'คลองเตย', 57], ['1032', 'ประเวศ', 56]]);
  assert.deepEqual([a.value, a.homeValue, Math.round(a.share)], [207, 960, 22]);
  assert.deepEqual([a.rail.focus.within, a.rail.focus.base, a.rail.rest.within, a.rail.rest.base], [39, 57, 88, 262], 'rail: records with a published point only, both bases');
  assert.deepEqual([a.outside.id, a.outside.name, a.outside.value], ['5001', 'เมืองเชียงใหม่', 95]);
  assert.equal(filterAreaRows(learning.rows, new Set(a.areaIds)).length, a.count);
  // The map: every district of the country is in scope; a district without a record is a measured 0, never no data.
  const m = buildAreaModel(learning.rows, index, {metric: 'learning'});
  assert.equal(m.areas.filter(x => x.state === 'no_data').length, 0);
  assert.equal(m.ramp.lut.length, 41, 'the 41-sample LDS count scale');
  assert.ok(m.ramp.levels.every(l => m.ramp.lut.includes(l.fill)), 'every district colour is one of its samples');
  const pm = buildProvinceModel(learning.rows, readJSON('data/provinces.geojson'), {metric: 'learning'});
  assert.equal(pm.provinces.reduce((s, p) => s + p.value, 0), learning.rows.length);
});

const ctxFor = (meta, metric = 'learning') => ({meta, unit: unitWords(metric), index: loadLearning().index, filtered: false});

function learningViews() {
  const {learning, data, index} = loadLearning();
  const rows = learning.rows, ctx = ctxFor(learning.meta), services = learning.services;
  const insight = summarizeAreaInsight(rows, index, {metric: 'learning'});
  const station = data.stations.find(s => s.name === 'สยาม');
  const pinned = rows.filter(hasPoint);
  const one = pinned.find(r => r.area === '1007');
  const provider = rows.find(r => r.source === 'provider');
  const has = new Set(rows.map(r => r.area));
  const none = [...index.byId.values()].find(a => !has.has(a.id));
  return {
    overview: renderLearningOverview({insight, summary: summarize(filterAreaRows(rows, new Set(insight.areaIds))), overview: buildLearningOverview(rows, index, {services}),
      focusMode: 'auto', provinces: [], unknownProvince: 0, province: '', stations: stationsOf(rows, 'learning'), ctx}),
    area: renderLearningArea(buildLearningArea(rows, '1007', index, services), () => '#000', ctx),
    empty: renderLearningArea(buildLearningArea(rows, none.id, index, services), () => '#000', ctx),
    station: renderLearningStation(buildLearningStation(station, {scopeRows: rows, services}), ctx),
    building: renderLearningBuilding(buildLearningBuilding({key: 'osm:1', kind: 'osm', rows: pinned.slice(0, 2), height: 30}, index, services), ctx),
    record: renderLearning(buildLearningDetail(one, {learningRows: rows, schoolRows: data.rows, index, services}), ctx),
    provider: renderLearning(buildLearningDetail(provider, {learningRows: rows, schoolRows: data.rows, index, services}), ctx),
  };
}

test('every learning view ends with one provenance line naming the OPEC nonformal register, and carries no caveat on screen', () => {
  for (const [name, html] of Object.entries(learningViews())) {
    const t = text(html);
    for (const k of ['dataset', 'source', 'date', 'boundary']) assert.equal((html.match(new RegExp(`data-prov="${k}"`, 'g')) || []).length, 1, `${name}: ${k}`);
    assert.equal((html.match(/class="hint panel-foot provenance"/g) || []).length, 1, `${name}: exactly one provenance line`);
    assert.ok(t.includes('ทะเบียนโรงเรียนนอกระบบ สช. (เรียนเสริม)'), `${name}: source`);
    assert.ok(t.includes('ตรวจ 31 ต.ค. 2569'), `${name}: date`);
    // The closed “ที่มาและพิกัด” says why a record has no pin; nothing else on screen qualifies a figure.
    const shown = t.replace(/ที่มาและพิกัด.*?รหัส L[0-9a-f]{12}/, '');
    assert.ok(!CAVEAT.test(shown), `${name}: no caveat — ${(shown.match(new RegExp(`.{0,40}(${CAVEAT.source}).{0,40}`)) || [''])[0]}`);
    assert.ok(!/ 0 คน|นักเรียน 0|ส่วนแบ่งตลาด|ความหนาแน่น|ดีที่สุด|อันดับโรงเรียน|ตั้งอยู่ใน/.test(t), `${name}: no student figure, share, density, ranking or located-inside claim`);
    assert.ok(!/school\.opec\.go\.th\/school\/\d+(?!")/.test(t), `${name}: the OPEC code only inside its profile link`);
  }
  const v = learningViews();
  assert.ok(text(v.overview).includes('22% ของสถานที่เรียนเสริมกรุงเทพมหานคร'), 'the learning Aha in natural copy');
  assert.ok(text(v.record).includes('โรงเรียนรอบ ๆ'), 'a record with a pin lists the schools round it');
  assert.ok(text(v.provider).includes('ผู้ให้บริการ') && text(v.provider).includes('ทะเบียนไม่มีพิกัด'), 'the provider record: its source, no pin');
  assert.ok(text(v.empty).includes('ไม่พบสถานที่เรียนเสริมใน'), 'a district without a record is a measured 0 with where the records are');
});

test('school views carry the learning context of their district (by service) and, round a school, the records with a pin within 1 km', () => {
  const {learning, data, index} = loadLearning();
  const ctx = {meta: data.meta, unit: unitWords('students'), index, filtered: false};
  const school = data.rows.find(r => r.name === 'เตรียมอุดมศึกษา');
  const d = buildSchoolDetail(school, {scopeRows: data.rows, allRows: data.rows, index, groups: data.groups, periods: data.history, learning});
  assert.equal(d.learning.count, learning.rows.filter(r => r.area === school.area).length);
  assert.ok(d.learning.near.length && d.learning.near.every((x, i, a) => x.m <= 1000 && (!i || a[i - 1].m <= x.m)), 'nearest first, within 1 km');
  const html = renderSchool(d, ctx), t = text(html);
  assert.ok(t.includes('เรียนเสริม') && t.includes('ดูเรียนเสริมบนแผนที่'));
  assert.ok(t.includes('ทะเบียนโรงเรียนนอกระบบ สช. (เรียนเสริม)'), 'the provenance names the register');
  assert.ok(/data-action="select-school" data-id="L[0-9a-f]{12}"/.test(html), 'a learning record opens from the school');
  assert.ok(/data-action="filter-service"/.test(html), 'a service bar opens the learning measure on that service');
  const area = renderArea(buildAreaProfile(data.rows, '1007', index, data.groups, {learning}), () => '#000', ctx);
  assert.ok(text(area).includes('ในเขตปทุมวัน 94 แห่ง'));
  const station = data.stations.find(s => s.name === 'สยาม');
  const st = renderStation(buildStationProfile(station, {scopeRows: data.rows, groups: data.groups, learning}), ctx);
  assert.ok(/เรียนเสริม/.test(text(st)));
  for (const h of [html, area, st]) assert.equal((h.match(/class="hint panel-foot provenance"/g) || []).length, 1);
  const ctxL = learningContext(learning.rows, {area: '1007', services: learning.services});
  assert.equal(ctxL.services.find(s => s.id === 'tutor').count, learning.rows.filter(r => r.area === '1007' && r.services.includes('tutor')).length);
  assert.deepEqual(nearPoint(learning.rows, null, null), [], 'no point, no neighbours');
  assert.ok(text(renderFilterChips({service: 'tutor'}, {service: {tutor: 'กวดวิชา'}})).includes('เรียนเสริม · กวดวิชา'));
});

test('learning pins are filled rings at the 200-student size; charts count services per district (a record in two services is in both)', () => {
  const {learning, index} = loadLearning();
  const r = learning.rows.find(hasPoint);
  assert.equal(sizeValue(r), LEARNING_PIN_SIZE);
  assert.equal(sizeValue({students: null}), 0, 'a school with unknown students stays hollow');
  const f = pointCollection([r]).features[0];
  assert.deepEqual([f.properties.s, f.properties.r], [LEARNING_SERIES, LEARNING_PIN_SIZE]);
  const columns = learning.services.map((s, i) => ({id: s.id, index: i, th: s.th, series: LEARNING_SERIES}));
  const model = buildChartModel(learning.rows, index, columns, {metric: 'learning'});
  assert.equal(model.areas[0].value, Math.max(...model.values));
  const m = areaMatrix(model, {areaLimit: 3});
  for (const a of m.areas) for (const c of columns) {
    const cell = m.cells.find(x => x.areaId === a.id && x.groupId === c.id);
    assert.equal(cell.value, a.rows.filter(x => x.services.includes(c.id)).length, `${a.name} × ${c.th}`);
    assert.equal(cell.unknown, false);
  }
});

test('Google actions for learning views: public names only, https, the learner\'s question; Street View only with a point', () => {
  const {learning} = loadLearning();
  const r = learning.rows.find(hasPoint);
  const acts = contextActions({kind: 'learning', row: r, area: {place: 'เขตปทุมวัน', province: 'กรุงเทพมหานคร'}, point: {lat: r.latitude, lon: r.longitude}});
  assert.deepEqual(acts.map(a => a.id), ['ai', 'maps', 'streetview']);
  assert.ok(acts.every(a => a.href.startsWith('https://') && !a.href.includes(r.url.split('/').pop())), 'never the OPEC code');
  for (const kind of ['learning-area', 'learning-station', 'learning-overview']) {
    const list = contextActions({kind, area: {place: 'เขตปทุมวัน', province: 'กรุงเทพมหานคร'}, station: {name: 'สยาม', lines: []}});
    assert.ok(list.length && list[0].id === 'ai', kind);
  }
});
