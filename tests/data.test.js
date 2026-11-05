import test from 'node:test';
import assert from 'node:assert/strict';
import {load, readJSON, frameFiles, sha256} from './helpers.js';
import {hasPoint, filterRows, summarize, rowValue, unitWords, sizeOf, pinSizeOf, SIZE_BANDS, LEVELS, levelsOf, gradeRange} from '../js/model.js';
import {distanceM} from '../js/profile-model.js';

test('schools.json decodes to every CityMETER school UUID of 02_SCHOOLS and 03_CHILD_CENTERS, nothing dropped, ids unique', () => {
  const {raw, data} = load();
  assert.equal(data.dropped, 0);
  assert.equal(data.rows.length, raw.meta.rows);
  assert.equal(data.rows.length, raw.meta.counts.rows);
  assert.equal(data.rows.length, raw.meta.tabs['02_SCHOOLS'].rows + raw.meta.tabs['03_CHILD_CENTERS'].rows, 'one row per UUID of the two roster tabs');
  assert.equal(data.rows.length, raw.meta.tabs['99_SOURCE_2026'].rows, 'and per record of the 2026 source');
  assert.equal(new Set(data.rows.map(r => r.id)).size, data.rows.length);
  assert.ok(data.rows.every(r => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r.id)), 'the CityMETER school UUID is the key');
  for (const [tab, t] of Object.entries(raw.meta.tabs)) assert.match(t.sha256, /^[a-f0-9]{64}$/, `${tab}: its rows are bound by a hash`);
  assert.equal(raw.meta.registryId, 'research.TH.school');
  assert.equal(raw.meta.productDataset, 'school');
  assert.match(raw.meta.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
});

test('measure contract: students are the recorded student_count, unknown stays unknown (never 0); records count once', () => {
  const {raw, data} = load();
  const known = data.rows.filter(r => r.students);
  assert.equal(known.length, raw.meta.counts['students.known']);
  assert.equal(known.reduce((s, r) => s + r.students, 0), raw.meta.counts['students.sum']);
  assert.ok(data.rows.every(r => r.students === null || (Number.isInteger(r.students) && r.students > 0)), 'no 0-student row: unknown is null');
  const s = summarize(data.rows);
  assert.equal(s.students, raw.meta.counts['students.sum']);
  assert.equal(s.studentsUnknown, data.rows.length - known.length);
  assert.equal(rowValue({students: null}, 'students'), 0, 'an unknown adds nothing to a student total');
  assert.equal(rowValue({students: null}, 'count'), 1);
  assert.deepEqual([unitWords('students').one, unitWords('count').one, unitWords('').one], ['คน', 'แห่ง', 'คน']);
  assert.equal(sizeOf(null), '');
  assert.deepEqual([19, 20, 119, 120, 719, 720, 1679, 1680, 3499, 3500].map(sizeOf), ['z1', 'z2', 'z2', 'z3', 'z3', 'z4', 'z4', 'z5', 'z5', 'z6'], 'the production SchoolSize bands');
  assert.deepEqual([null, 199, 200, 999, 1000].map(pinSizeOf), [0, 0, 1, 1, 2]);
  assert.equal(SIZE_BANDS.length, 6);
  assert.deepEqual(raw.sizes.map(b => b.id), SIZE_BANDS.map(b => b.id), 'the dataset and the page use the same bands');
  for (const k of ['teachers', 'classrooms']) assert.equal(data.rows.filter(r => r[k]).length, raw.meta.counts[`${k}.known`], k);
});

test('groups and affiliations: the source’s own codes, every row in one of each; the filters partition the rows', () => {
  const {raw, data} = load();
  for (const g of data.groups) assert.equal(data.rows.filter(r => r.groupId === g.id).length, raw.meta.counts[`group.${g.id}`] || 0, g.id);
  assert.equal(data.groups.reduce((s, g) => s + filterRows(data.rows, {group: g.id}).length, 0), data.rows.length);
  assert.ok(data.rows.every(r => r.aff), 'every record has its affiliation (99_SOURCE_2026.affiliation_type_id)');
  assert.equal(new Set(data.affs.map(a => a.id)).size, data.affs.length);
  assert.ok(data.affs.every(a => /^1\d\d$/.test(a.id) && a.th && a.short), 'affiliation code, name and short name');
  assert.equal(data.affs.reduce((s, a) => s + filterRows(data.rows, {aff: a.id}).length, 0), data.rows.length);
  // The group follows the affiliation (DATA_METHOD §1): public = สพฐ., private and international = สช. (or an OPEC
  // international link), vocational = สอศ., child centres from 03_CHILD_CENTERS.
  const aff = id => data.rows.filter(r => r.groupId === id).map(r => r.aff.id);
  assert.ok(aff('public').every(a => a === '111'));
  assert.ok(aff('private').every(a => a === '113'));
  assert.ok(aff('vocational').every(a => a === '112'));
  assert.ok(aff('local').every(a => ['102', '109', '110'].includes(a)));
});

test('levels: grades are a range of the published grade codes; the level filter keeps every school that teaches the level', () => {
  const {raw, data} = load();
  const graded = data.rows.filter(r => r.lo > 0);
  assert.equal(graded.length, raw.meta.counts['grades.known']);
  assert.ok(graded.every(r => r.hi >= r.lo && r.hi <= 18 && r.levels.length > 0));
  assert.ok(data.rows.filter(r => !(r.lo > 0)).every(r => r.levels.length === 0 && gradeRange(r) === ''), 'unknown grades: no level, no range');
  assert.deepEqual(levelsOf(1, 9), ['kinder', 'primary']);
  assert.deepEqual(levelsOf(10, 15), ['lower', 'upper']);
  assert.deepEqual(levelsOf(0, 0), []);
  assert.equal(gradeRange({lo: 1, hi: 9}), 'อ.1–ป.6');
  assert.equal(gradeRange({lo: 13, hi: 13}), 'ม.4');
  for (const l of LEVELS) {
    const rows = filterRows(data.rows, {level: l.id});
    assert.ok(rows.every(r => r.lo <= l.hi && r.hi >= l.lo), l.id);
  }
});

test('membership: every row sits in an existing production district of its own province, as the source lists it', () => {
  const {raw, data, index} = load();
  const by = {};
  for (const r of data.rows) {
    by[r.admin] = (by[r.admin] || 0) + 1;
    if (r.area) {
      const a = index.byId.get(r.area);
      assert.ok(a, r.id);
      assert.equal(a.province, r.province, `${r.id} district in its own province`);
      assert.ok(['source', 'name'].includes(r.admin));
    } else assert.ok(['province', 'none'].includes(r.admin), r.id);
  }
  for (const k of ['source', 'name', 'province']) assert.equal(by[k] || 0, raw.meta.counts[`admin.${k}`] || 0, k);
});

test('points are the sheet’s checked registry points, inside Thailand, with their role; never invented', () => {
  const {raw, data} = load();
  const pts = data.rows.filter(hasPoint);
  assert.equal(pts.length, raw.meta.counts.points);
  assert.ok(pts.every(r => raw.coordRoles.includes(r.coordRole)), 'every drawn point says whose registry it is');
  assert.ok(data.rows.filter(r => !hasPoint(r)).every(r => r.latitude === null && r.longitude === null));
  assert.ok(pts.every(r => Math.round(r.latitude * 1e6) / 1e6 === r.latitude), 'six decimals, as the sheet');
});

test('context from CityMETER Transit: straight-line distances agree with the published points', () => {
  const {raw, data} = load();
  assert.match(raw.meta.context.rail.commit, /^[0-9a-f]{40}$/);
  assert.match(raw.meta.context.rail.sha256, /^[0-9a-f]{64}$/);
  assert.equal(data.stations.filter(s => s.status === 'operating').length, raw.meta.counts['stations.operating']);
  let checked = 0;
  for (const r of data.rows) {
    if (r.rail) {
      assert.ok(hasPoint(r) && r.rail.station.status === 'operating' && r.rail.m <= 2000, r.id);
      if (checked++ < 400) assert.ok(Math.abs(distanceM(r.latitude, r.longitude, r.rail.station.lat, r.rail.station.lon) - r.rail.m) <= 1.5, r.id);
    }
    if (r.railNext) assert.equal(r.railNext.station.status, 'construction');
  }
  assert.ok(checked > 100);
});

test('tuition, assessment, history and closure are published per school only, with their year and a public https source', () => {
  const {raw, data} = load();
  const fees = data.rows.filter(r => r.fee);
  assert.equal(fees.length, raw.meta.counts.tuition);
  assert.equal(fees.reduce((s, r) => s + r.fee.items.length + r.fee.more, 0), raw.meta.counts['tuition.items']);
  for (const r of fees) {
    assert.ok(r.fee.min > 0 && r.fee.max >= r.fee.min, r.id);
    assert.ok(r.fee.year && /\d{4}/.test(r.fee.year), `${r.id}: the academic year the school published`);
    assert.ok(r.fee.url === '' || /^https:\/\//.test(r.fee.url), `${r.id}: a public https announcement, or no link (a private copy is never linked)`);
    assert.ok(r.fee.items.every(([scope, v]) => scope && v >= r.fee.min && v <= r.fee.max), `${r.id}: every item inside the range`);
  }
  assert.ok(fees.filter(r => r.fee.url).length >= fees.length * 0.9, 'nearly every tuition links the school’s own announcement');
  assert.equal(data.rows.filter(r => r.feeEvidence).length, raw.meta.counts.feeEvidence);
  const q = data.rows.filter(r => r.quality);
  assert.equal(q.length, raw.meta.counts.quality);
  assert.ok(q.every(r => r.quality.lines.length && r.quality.year >= 2564 && r.quality.year <= 2567), 'the ONESQA result with its B.E. year');
  assert.ok(q.filter(r => r.quality.url).every(r => /^https:\/\/catalog\.onesqa\.or\.th\//.test(r.quality.url)), 'the ONESQA open-data page');
  const h = data.rows.filter(r => r.history);
  assert.equal(h.length, raw.meta.counts.history);
  assert.deepEqual(data.history, ['2565/1', '2565/2', '2566/1', '2566/2', '2567/1', '2567/2']);
  assert.ok(h.every(r => r.history.length === 6 && r.history.every(v => v === null || v === -1 || (Number.isInteger(v) && v > 0))));
  assert.equal(data.rows.filter(r => r.closed).length, raw.meta.counts.closed);
  assert.ok(data.rows.filter(r => r.closed).every(r => /^\d{4}-\d{2}-\d{2}$/.test(r.closed.on) && /^https:\/\//.test(r.closed.url)));
  assert.equal(data.rows.filter(r => r.curriculum || r.accreditation).length, raw.meta.counts.programmes);
});

test('publication hygiene: no official code column, researcher note or private link; links are https', () => {
  const {raw} = load();
  for (const f of ['official_school_code', 'school_record_id', 'review_note', 'coordinate_source_url']) assert.ok(raw.meta.excludedFields.includes(f), f);
  const text = JSON.stringify(raw);
  for (const k of ['official_school_code', 'phone', 'address', 'notes', 'latitude', 'longitude', 'email']) assert.ok(!Object.keys(raw.cols).includes(k), k);
  assert.ok(!/(docs|drive)\.google\.com/.test(text), 'no Google document link');
  assert.ok(!/google\.[a-z.]+\/maps|maps\.app\.goo\.gl/.test(text), 'no map links');
  assert.ok(!/landometer\.com\/api\//.test(raw.urls.join(' ')), 'no internal API link as a source link');
  assert.ok(raw.urls.every(u => /^https:\/\//.test(u)), 'source links are https');
  assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(text.replace(/https:\/\/[^"\s]+/g, '')), 'no e-mail address');
});

test('boundaries: 928 districts and 77 provinces from production; per-province frames match the index; receipts bound by hash', () => {
  const {raw, index, indexJSON, provincesGeo} = load();
  assert.equal(index.areas.length, 928);
  assert.equal(index.provinces.length, 77);
  assert.equal(provincesGeo.features.length, 77);
  assert.ok(index.areas.every(a => a.km2 > 0 && Array.isArray(a.label) && Array.isArray(a.bbox)), 'production area, label and bbox for every district');
  const files = frameFiles();
  assert.equal(files.length, 77);
  let areas = 0;
  for (const f of files) {
    const code = f.replace('.json', ''), frame = readJSON(`data/frames/${f}`), p = index.provinceById.get(code);
    assert.ok(p, code);
    assert.equal(frame.areas.features.length, p.areaTotal, `${code} districts`);
    for (const ft of frame.areas.features) assert.equal(index.byId.get(String(ft.id ?? ft.properties.id))?.province, code);
    areas += frame.areas.features.length;
  }
  assert.equal(areas, 928);
  const receipts = readJSON('data/boundary-receipts.json');
  assert.equal(Object.keys(receipts.base).length, 78, 'the country list + 77 province base-info responses');
  assert.equal(indexJSON.metadata.receipts, 78);
  for (const r of Object.values(receipts.base)) {
    assert.match(r.sha256, /^[a-f0-9]{64}$/);
    assert.match(r.url, /^https:\/\/landometer\.com\/api\/v2\/citymeter-v3\/base\/info\//);
    assert.equal(r.status, 200);
  }
  const py = v => (Array.isArray(v) ? `[${v.map(py).join(', ')}]` : v && typeof v === 'object'
    ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}: ${py(v[k])}`).join(', ')}}` : JSON.stringify(v));
  assert.equal(sha256(Buffer.from(py(receipts.base))), receipts.baseSha256);
  assert.equal(indexJSON.metadata.receiptsSha256, receipts.baseSha256);
  assert.equal(raw.meta.gazetteer.receiptsSha256, receipts.baseSha256, 'the dataset was built on the same gazetteer');
});
