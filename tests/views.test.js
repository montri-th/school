import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers.js';
import {buildOverview, buildAreaProfile, buildSchoolDetail, buildBuildingProfile, buildAffProfile, buildStationProfile, stationsOf, compsetOf, listOrder, unplacedOf, COMPSET_RADIUS_M} from '../js/profile-model.js';
import {renderOverview, renderArea, renderBuilding, renderSchool, renderStation, renderAffCard, renderFilterChips, provenance, pct, meters} from '../js/panel.js';
import {summarizeAreaInsight, filterAreaRows} from '../js/area-insight.js';
import {summarize, productionLink, filterRows, unitWords, hasPoint, stationLink} from '../js/model.js';
import {buildChartModel, areaMatrix, affRanking} from '../js/chart-model.js';
import {buildBreadcrumb, renderBreadcrumb, breadcrumbText, productionHref} from '../js/breadcrumb.js';
import {CUES, CUE_PATHS, GROUP_SERIES, cueMarkup, seriesOf} from '../js/cues.js';
import {contextActions} from '../js/ask.js';

const text = html => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');
const ctxFor = (data, index, metric = 'students', filtered = false) => ({meta: data.meta, unit: unitWords(metric), index, filtered});
/** Harrow International School Bangkok: tuition, history, an ONESQA result, curricula (an international school). */
const HARROW = '764487df-7024-4778-8ce9-d726ba3eab5e';
/** มัธยมวัดธาตุทอง: a public secondary school with grades, teachers, classrooms and an operating station 120 m away. */
const WAT = '714599d9-572c-4686-b7cd-feb03d08e5e5';
const detail = (data, index, r) => buildSchoolDetail(r, {scopeRows: data.rows, allRows: data.rows, index, groups: data.groups, periods: data.history});

function views(metric = 'students') {
  const {data, index} = load();
  const rows = data.rows, ctx = ctxFor(data, index, metric);
  const insight = summarizeAreaInsight(rows, index, {metric});
  const station = data.stations.find(s => s.name === 'สนามไชย');
  const opec = filterRows(rows, {aff: '113'});
  return {
    overview: renderOverview({insight, summary: summarize(filterAreaRows(rows, new Set(insight.areaIds))), overview: buildOverview(rows, index, {groups: data.groups, metric}),
      focusMode: 'auto', provinces: [], unknownProvince: 0, province: '', stations: stationsOf(rows, metric), ctx}),
    area: renderArea(buildAreaProfile(rows, '1039', index, data.groups, {metric}), () => '#000', ctx),
    school: renderSchool(detail(data, index, rows.find(r => r.id === HARROW)), ctx),
    public: renderSchool(detail(data, index, rows.find(r => r.id === WAT)), ctx),
    station: renderStation(buildStationProfile(station, {scopeRows: rows, groups: data.groups, metric}), ctx),
    building: renderBuilding(buildBuildingProfile({key: 'osm:1', kind: 'osm', rows: rows.filter(hasPoint).slice(0, 3), height: 24}, index, data.groups), ctx),
    aff: renderOverview({insight: summarizeAreaInsight(opec, index, {metric}), summary: summarize(opec), overview: buildOverview(opec, index, {groups: data.groups, metric}),
      focusMode: 'auto', province: '', affCard: renderAffCard(buildAffProfile('113', {allRows: rows, scopeRows: opec, index, data, groups: data.groups, metric}), ctx), ctx}),
  };
}

test('every panel view ends with one provenance line — dataset · source · date · boundary, then the method — and carries no caveat on screen', () => {
  for (const metric of ['students', 'count']) {
    for (const [name, html] of Object.entries(views(metric))) {
      const t = text(html);
      for (const k of ['dataset', 'source', 'date', 'boundary']) assert.equal((html.match(new RegExp(`data-prov="${k}"`, 'g')) || []).length, 1, `${name}: ${k}`);
      assert.ok(t.includes('ชุดข้อมูล CityMETER School'), `${name}: dataset`);
      assert.ok(/แหล่ง\s*จาก CityMETER School 2569/.test(t), `${name}: source`);
      assert.ok(t.includes('ตรวจ 31 ต.ค. 2569'), `${name}: date`);
      assert.ok(/ขอบเขต \S/.test(t), `${name}: boundary`);
      assert.ok(html.includes('<span class="prov-part prov-method"><a href="DATA_METHOD.md"'), `${name}: the method link`);
      assert.equal((html.match(/class="hint panel-foot provenance"/g) || []).length, 1, `${name}: exactly one provenance line`);
      // The Hotel rule of 2026-11-01: “ไม่มี caveats เลย” — exactness comes from names, numerators and denominators, and
      // the provenance line.
      const caveat = /ไม่ใช่|ยังไม่ได้ตรวจ|อาจเป็น|ไม่ได้แปลว่า|ยืนยันแล้ว|ค่าประมาณ|นับในยอดรวม|โปรดตรวจสอบ/;
      assert.ok(!caveat.test(t), `${name}: no caveat on screen — ${(t.match(new RegExp(`.{0,40}(${caveat.source}).{0,40}`)) || [''])[0]}`);
      assert.ok(!/ตั้งอยู่ใน|ส่วนแบ่งตลาด|รายได้|ความหนาแน่น|อัตราการเข้าเรียน|เขตพื้นที่บริการ|โรงเรียนดีที่สุด|อันดับโรงเรียน/.test(t), `${name}: no located-inside, share, revenue, density, enrolment-rate, catchment or school-ranking claim`);
      assert.ok(!/ 0 คน/.test(t), `${name}: unknown students never read 0 คน`);
    }
  }
});

test('first screen (students): the Aha with numerator and denominator, the rail comparison as two bars with both bases, the outside finding', () => {
  const o = text(views().overview);
  assert.ok(o.includes('12% ของนักเรียนกรุงเทพมหานคร อยู่ใน 3 เขตนี้'), o.slice(0, 300));
  assert.ok(o.includes('ลาดกระบัง · สายไหม · บางกะปิ') && o.includes('106,163 จาก 916,683 คน'), 'the share of the province\'s whole total');
  assert.ok(o.includes('ใกล้รถไฟฟ้า ≤ 500 ม. 3 เขตนี้ 1% 620 จาก 79,083 คน') && o.includes('เขตอื่น 17% 112,216 จาก 648,859 คน'), 'both bases in the accessible text');
  assert.ok(o.includes('อันดับ 1 นอกกรุงเทพมหานคร: อำเภอเมืองนครราชสีมา นครราชสีมา 93,597 คน · มากกว่าทุกเขตของกรุงเทพมหานคร'));
  assert.ok(o.includes('สถานีที่มีนักเรียนรอบ ๆ มากที่สุด') && o.includes('สนามไชย (น้ำเงิน) 6 แห่ง · 8,768 คน'));
  assert.ok(o.includes('ประกาศค่าเรียนรายปี 86 แห่ง'));
  assert.ok(o.includes('ไม่ทราบ 490'), 'unknown students are their own (hatched) size bar, never a 0-student band');
  assert.ok(o.includes('ไม่ทราบ 12,419'), 'records without grade codes are their own level bar');
  assert.ok(o.includes('สังกัดที่มีนักเรียนมากที่สุด') && o.includes('สพฐ. 6,165,852'));
  const c = text(views('count').overview);
  assert.ok(c.includes('21% ของสถานศึกษานครราชสีมา อยู่ใน 3 อำเภอนี้') && c.includes('382 จาก 1,786 แห่ง'));
  assert.ok(c.includes('อันดับ 1 นอกนครราชสีมา: อำเภอเมืองขอนแก่น ขอนแก่น 212 แห่ง · มากกว่าทุกอำเภอของนครราชสีมา'));
  assert.ok(!c.includes('ใกล้รถไฟฟ้า ≤ 500 ม.'), 'no rail comparison where nothing is near an operating station');
});

test('district, station, affiliation and school panels: ranks, shares, straight-line context and the comparison set', () => {
  const v = views();
  const a = text(v.area);
  assert.ok(a.includes('เขตวัฒนา') && a.includes('อันดับ 66 จาก 928 ทั่วประเทศ · 6 จาก 50 ในกรุงเทพมหานคร'), a.slice(0, 240));
  assert.ok(a.includes('3% ของกรุงเทพมหานคร 28,888 จาก 916,683 คนของกรุงเทพมหานคร'), 'the share tile carries numerator and denominator');
  assert.ok(a.includes('29% ใกล้รถไฟฟ้า 7,046 จาก 24,292 คน'));
  assert.ok(a.includes('ประกาศค่าเรียนรายปี 3 แห่ง') && a.includes('ดูทั้งหมด 41 แห่ง'));
  const s = text(v.station);
  assert.ok(s.includes('สถานีสนามไชย') && s.includes('8,768 นักเรียน') && s.includes('6 แห่ง') && s.includes('500 ม. รอบสถานี'));
  assert.ok(s.includes('สวนกุหลาบวิทยาลัย 3,057 คน · ม.1–ม.6 · สพฐ. · เขตพระนคร · 410 ม.'), 'a list row: students, grades, affiliation, district, straight-line distance');
  assert.ok(v.station.includes('pic-distance'), 'the straight-line radius carries the distance pictogram');
  const h = text(v.school);
  assert.ok(h.includes('นานาชาติฮาร์โรว์ กรุงเทพฯ') && h.includes('HARROW INTERNATIONAL SCHOOL'));
  assert.ok(h.includes('1,840 คน') && h.includes('ครู 158 คน') && h.includes('฿146,300–1,063,000/ปี') && h.includes('การเคหะ (แดงเข้ม) 1 กม.'));
  assert.ok(h.includes('ค่าเรียนต่อปี ปีการศึกษา 2026/2027 ฿146,300–1,063,000 ต่อคนต่อปี · ค่าเรียน') && h.includes('Year 12 - Year 13 ฿1,063,000'), 'tuition as the school announced it, per grade');
  assert.ok(h.includes('นักเรียนย้อนหลัง สช. · ภาคเรียน 2565 ภาค 1 1,608') && h.includes('2567 ภาค 2 1,705'), 'students per semester (OPEC)');
  assert.ok(h.includes('ผลประเมินภายนอก สมศ. · 2566'), 'the ONESQA result with its year');
  assert.ok(h.includes('หลักสูตรแห่งชาติของสหราชอาณาจักรและเวลส์') && h.includes('The Early Years Foundation Stage (EYFS)'), 'each curriculum its own chip');
  assert.match(v.school, /href="https:\/\/catalog\.onesqa\.or\.th\/dataset\/[^"]+"[^>]*>ข้อมูลเปิด สมศ\.</);
  assert.ok(h.includes('คู่เทียบ') && h.includes('สถานศึกษาทุกประเภทรอบ 2 กม. 6 แห่ง · 1,432 คน'));
  const p = text(v.public);
  assert.ok(p.includes('มัธยมวัดธาตุทอง') && p.includes('ม.1–ม.6') && p.includes('ครู 69 คน') && p.includes('54 ห้องเรียน') && p.includes('เอกมัย (สุขุมวิท) 120 ม.'));
  assert.ok(p.includes('คู่เทียบ 0 แห่ง โรงเรียนรัฐ สพฐ. ม.ต้น · ม.ปลาย · ปวช. ≤ 2 กม.'), 'the comparison rule as chips: group · levels · radius');
  assert.ok(p.includes('สถานศึกษาทุกประเภทรอบ 2 กม. 29 แห่ง · 13,319 คน'));
  const c = text(v.aff);
  assert.ok(c.includes('สังกัด · สช.') && c.includes('สำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน') && c.includes('1,891,743 นักเรียน') && c.includes('3,683 แห่ง') && c.includes('77 จังหวัด'));
  assert.ok(c.includes('3% ใกล้รถไฟฟ้า'));
  assert.deepEqual([meters(84), meters(1291), meters(2000)], ['80 ม.', '1.3 กม.', '2 กม.']);
});

test('a closed school says so first, dated, with the announcement in the source details', () => {
  const {data, index} = load();
  const r = data.rows.find(x => x.closed);
  const html = renderSchool(detail(data, index, r), ctxFor(data, index));
  assert.ok(text(html).includes('ประกาศปิด 31 ก.ค. 2569'));
  assert.ok(html.indexOf('is-closed') < html.indexOf('pic-students'), 'the closure chip comes before the figures');
  assert.match(html, /href="https:\/\/[^"]+"[^>]*>ประกาศปิด</);
});

test('comparison set: same group, a shared level when the grades are known, straight line ≤ 2 km, nearest first; never itself; no point → none', () => {
  const {data} = load();
  for (const id of [WAT, HARROW]) {
    const h = data.rows.find(r => r.id === id);
    const c = compsetOf(h, data.rows);
    assert.equal(c.radius, COMPSET_RADIUS_M);
    assert.deepEqual(c.rule, {group: h.group, levels: h.levels});
    assert.ok(c.rows.every(x => x.row !== h && x.row.group === h.group && x.m <= 2000 && (!h.levels.length || x.row.levels.some(l => h.levels.includes(l)))));
    for (let i = 1; i < c.rows.length; i++) assert.ok(c.rows[i - 1].m <= c.rows[i].m);
    assert.equal(compsetOf({...h, latitude: null, longitude: null}, data.rows), null);
  }
  // A public primary school in a dense district finds peers that teach its levels.
  const p = data.rows.find(r => r.groupId === 'public' && r.area === '3001' && r.levels.includes('primary') && hasPoint(r));
  const c = compsetOf(p, data.rows);
  assert.ok(c.matches > 0 && c.rows.every(x => x.row.groupId === 'public'));
});

test('missing stays missing: no point, unknown students, an empty district — each says so, never 0 or a guessed place', () => {
  const {data, index} = load();
  const ctx = ctxFor(data, index);
  const noPoint = data.rows.find(r => !hasPoint(r) && r.area);
  const t = text(renderSchool(detail(data, index, noPoint), ctx));
  assert.ok(t.includes('ไม่มีพิกัด') && !t.includes('คู่เทียบ'), 'no point: no comparison set (the chip says why)');
  const unknown = data.rows.find(r => !r.students);
  assert.ok(text(renderSchool(detail(data, index, unknown), ctx)).includes('ไม่ทราบจำนวนนักเรียน'));
  const u = unplacedOf(data.rows);
  assert.deepEqual([u.noArea, u.noProvince], [0, 0], 'every record sits in the district the source lists it under');
  const empty = buildAreaProfile([], '1039', index, data.groups);
  assert.equal(empty.coverageState, 'measured_zero');
  assert.ok(text(renderArea(empty, () => '#000', ctx)).includes('ไม่พบสถานศึกษาในเขตวัฒนา'));
  // A district whose records all have unknown students reads “—” with its reason in the title, never 0 students.
  const html = renderArea(buildAreaProfile([{...unknown, area: '1039', province: 'BKK', students: null}], '1039', index, data.groups), () => '#000', ctx);
  assert.match(html, /title="ไม่ทราบจำนวนนักเรียน"/);
});

test('charts: districts by the measure, district × group matrix with equal cells, affiliations by the measure', () => {
  const {data, index} = load();
  const m = buildChartModel(data.rows, index, data.groups);
  assert.equal(m.areas.length, 20);
  assert.equal(m.totalAreas, 928);
  assert.equal(m.unplacedValue, 0);
  assert.deepEqual(m.areas.slice(0, 3).map(a => [a.name, a.value]), [['เมืองนครราชสีมา', 93597], ['เมืองขอนแก่น', 85272], ['หาดใหญ่', 82093]]);
  for (let i = 1; i < m.areas.length; i++) assert.ok(m.areas[i - 1].value >= m.areas[i].value);
  const mx = areaMatrix(m);
  assert.equal(mx.cells.length, 12 * data.groups.length);
  for (const a of mx.areas) assert.equal(mx.cells.filter(c => c.areaId === a.id).reduce((s, c) => s + c.value, 0), a.value, 'cells add up to the district');
  const counts = buildChartModel(data.rows, index, data.groups, {metric: 'count'});
  assert.deepEqual([counts.areas[0].name, counts.areas[0].value], ['เมืองขอนแก่น', 212]);
  // A cell whose records all have unknown students is unknown (no data, a dash), never a measured 0.
  const one = {id: 'u', area: '1001', province: 'BKK', students: null, group: 6, groupId: 'childcare'};
  const um = areaMatrix({areas: [{id: '1001', name: 'พระนคร', province: 'BKK', value: 0, rows: [one]}], groups: data.groups, metric: 'students'});
  assert.deepEqual(um.cells.filter(c => c.unknown).map(c => [c.groupId, c.count, c.value]), [['childcare', 1, 0]]);
  assert.equal(areaMatrix({areas: [{id: '1001', name: 'พระนคร', province: 'BKK', value: 1, rows: [one]}], groups: data.groups, metric: 'count'}).cells.filter(c => c.unknown).length, 0);
  const ar = affRanking(data.rows);
  assert.equal(ar.total, 16);
  assert.deepEqual(ar.affs.slice(0, 3).map(x => [x.aff.short, x.students]), [['สพฐ.', 6165852], ['สช.', 1891743], ['สอศ.', 760615]]);
});

test('breadcrumb follows production: ประเทศไทย › จังหวัด › เขต/อำเภอ with /D/ deep links and the school dataset', () => {
  const {index} = load();
  const area = index.byId.get('1039');
  const crumbs = buildBreadcrumb({province: 'BKK', area});
  assert.equal(breadcrumbText(crumbs), 'ประเทศไทย › กรุงเทพมหานคร › เขตวัฒนา');
  assert.equal(crumbs.at(-1).current, true);
  assert.equal(crumbs[2].href, 'https://landometer.com/v3/citymeter/BKK/D/1039?d=school');
  assert.equal(productionHref(crumbs), 'https://landometer.com/v3/citymeter/BKK/D/1039?d=school');
  assert.ok(renderBreadcrumb(crumbs).includes('aria-current="location"'));
  assert.equal(breadcrumbText(buildBreadcrumb({area: index.byId.get('3001')})), 'ประเทศไทย › นครราชสีมา › อำเภอเมืองนครราชสีมา');
  assert.equal(productionLink(), 'https://landometer.com/v3/citymeter?d=school');
  assert.equal(productionLink({province: 'NMA'}), 'https://landometer.com/v3/citymeter/NMA?d=school');
  assert.equal(stationLink({id: 'RAILCAT:BTS_SUKHUMVIT:E4'}), 'https://montri-th.github.io/transit/?station=RAILCAT%3ABTS_SUKHUMVIT%3AE4');
});

test('school groups bind to LDS series by stable id with the series shape cue; no star (it would read as a rating)', () => {
  const {data} = load();
  assert.deepEqual(CUES, ['circle', 'square', 'triangle', 'diamond', 'cross', 'star', 'hexagon', 'ring', 'dash', 'plus']);
  assert.deepEqual(GROUP_SERIES, {public: 1, private: 2, international: 3, local: 4, vocational: 5, nonformal: 7, childcare: 10, other: 9});
  assert.ok(!Object.values(GROUP_SERIES).includes(6));
  assert.equal(new Set(Object.values(GROUP_SERIES)).size, 8, 'one series per group');
  for (const g of data.groups) assert.equal(g.series, seriesOf(g.id));
  for (const name of CUES) assert.ok(CUE_PATHS[name].startsWith('M'));
  assert.match(cueMarkup(2), /class="cue-shape category-2".*data-cue="square".*aria-hidden="true"/);
});

test('lists put the most recorded students first (unknown last), then name — deterministic', () => {
  const {data} = load();
  const rows = data.rows.filter(r => r.area === '1039').sort(listOrder);
  assert.deepEqual([...rows].reverse().sort(listOrder).map(r => r.id), rows.map(r => r.id), 'deterministic');
  for (let i = 1; i < rows.length; i++) assert.ok((rows[i - 1].students || 0) >= (rows[i].students || 0));
});

test('Google actions: public names and points only, https, the question of the view; Street View only with a point', () => {
  const {data} = load();
  const h = data.rows.find(r => r.id === WAT);
  const acts = contextActions({kind: 'school', row: h, area: {place: 'เขตวัฒนา', province: 'กรุงเทพมหานคร'}, point: {lat: h.latitude, lon: h.longitude, role: 'point'}});
  assert.deepEqual(acts.map(a => a.id), ['ai', 'maps', 'streetview']);
  assert.ok(acts.every(a => a.href.startsWith('https://www.google.com/')));
  assert.ok(decodeURIComponent(acts[0].href).includes('โรงเรียนมัธยมวัดธาตุทอง (เขตวัฒนา กรุงเทพมหานคร) เปิดรับนักเรียนชั้นไหนบ้าง'));
  // Hotel 0.3.3 (owner 2026-11-02 “ทำให้มันตอบทันเลยได้มั้ย”): a plain Google Search, answered at the top by Google's AI
  // Overview — a link straight into AI Mode (udm=50) stops at Google's “Continue with this search?” from another site.
  const views = [acts, contextActions({kind: 'area', area: {place: 'เขตวัฒนา', province: 'กรุงเทพมหานคร'}}),
    contextActions({kind: 'station', station: {name: 'อโศก', lines: ['สุขุมวิท']}}), contextActions({kind: 'aff', aff: {th: 'สำนักงานคณะกรรมการส่งเสริมการศึกษาเอกชน'}}),
    contextActions({kind: 'overview', province: 'นครราชสีมา'}), contextActions({kind: 'building', rows: [h], area: {place: 'เขตวัฒนา', province: 'กรุงเทพมหานคร'}})];
  for (const list of views) {
    const ai = list.find(a => a.id === 'ai');
    assert.ok(ai, 'every view asks Google AI');
    assert.match(ai.href, /^https:\/\/www\.google\.com\/search\?q=[^&]+$/, 'a plain search, the question only');
    assert.ok(!/udm=/.test(ai.href), 'never straight into AI Mode');
  }
  assert.ok(!acts.some(a => a.href.includes(h.id)), 'no internal id leaves the page');
  assert.deepEqual(contextActions({kind: 'area', area: {place: 'เขตวัฒนา', province: 'กรุงเทพมหานคร'}}).map(a => a.id), ['ai', 'maps']);
  const st = contextActions({kind: 'station', station: {name: 'อโศก', lines: ['สุขุมวิท']}, point: {lat: 13.737, lon: 100.56, role: 'station'}});
  assert.equal(st.at(-1).label, 'Street View ใกล้สถานี');
});

test('filter chips escape user text, name the filters and offer one clear-all', () => {
  const html = renderFilterChips({search: '<b>สาธิต</b>', group: 'private', level: 'kinder', size: 'z3', province: 'BKK', aff: '113'},
    {group: {private: 'โรงเรียนเอกชน'}, level: {kinder: 'อนุบาล'}, size: {z3: '120–719 คน'}, province: {BKK: 'กรุงเทพมหานคร'}, aff: {113: 'สังกัด สช.'}});
  assert.ok(!html.includes('<b>'));
  for (const w of ['โรงเรียนเอกชน', 'เปิดสอนอนุบาล', '120–719 คน', 'กรุงเทพมหานคร', 'สังกัด สช.']) assert.ok(text(html).includes(w), w);
  assert.equal((html.match(/data-id="all"/g) || []).length, 1);
  assert.ok(text(renderFilterChips({level: 'unknown'}, {level: {}})).includes('ไม่ทราบระดับชั้น'));
});

test('the level filter: a level keeps the schools that teach it; “ไม่ทราบระดับชั้น” keeps the records without grade codes', () => {
  const {data} = load();
  const unknown = filterRows(data.rows, {level: 'unknown'});
  assert.ok(unknown.length > 0 && unknown.every(r => !r.levels.length));
  const kinder = filterRows(data.rows, {level: 'kinder'});
  assert.ok(kinder.every(r => r.levels.includes('kinder')));
  assert.equal(unknown.length + data.rows.filter(r => r.levels.length).length, data.rows.length);
});

test('shares print whole percentages; a non-zero part never prints as 0%', () => {
  assert.equal(pct(44897, 130608), '34%');
  assert.equal(pct(1, 352), '<1%');
  assert.equal(pct(0, 10), '0%');
  assert.equal(pct(3, 0), '—');
  assert.ok(text(provenance({meta: {checkedOn: '2026-10-31', context: {rail: {asOf: '2026-10-31'}}}, unit: unitWords('students')}, 'x', {rail: true})).includes('CityMETER Transit 31 ต.ค. 2569'));
});
