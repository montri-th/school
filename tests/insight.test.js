import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from './helpers.js';
import {summarizeAreaInsight, filterAreaRows, RAIL_M} from '../js/area-insight.js';
import {levelWords, areaLabel} from '../js/areas.js';
import {filterRows} from '../js/model.js';
import {buildAreaModel} from '../js/map-layers.js';
import {buildProvinceModel} from '../js/provinces.js';
import {SUPPLY_SCALE, COUNT_SCALE} from '../js/scales.js';

test('first Aha (snapshot fixture, students): the three เขต with the most recorded students in the province holding the most students placed at district level', () => {
  const {data, index} = load();
  const a = summarizeAreaInsight(data.rows, index);
  assert.equal(a.metric, 'students');
  assert.equal(a.home, 'BKK');
  assert.deepEqual(a.areas.map(x => [x.id, x.name, x.value]), [['1011', 'ลาดกระบัง', 40309], ['1042', 'สายไหม', 33427], ['1006', 'บางกะปิ', 32427]]);
  assert.deepEqual([a.value, a.homePlacedValue, a.homeValue, Math.round(a.share)], [106163, 916683, 916683, 12], 'the share is of the province\'s whole total');
  assert.deepEqual([a.count, a.homePlaced, a.homeUnplacedValue, a.homeStudentsUnknown], [113, 1335, 0, 42]);
  // Rail (CityMETER · Transit): within 500 m of an operating station, rows with a point only; both bases stated.
  assert.equal(RAIL_M, 500);
  assert.deepEqual([a.rail.focus.within, a.rail.focus.base, a.rail.focus.noPoint], [620, 79083, 27080]);
  assert.deepEqual([a.rail.rest.within, a.rail.rest.base, a.rail.rest.noPoint], [112216, 648859, 161661]);
  assert.equal(a.rail.focus.base + a.rail.focus.noPoint, a.value, 'students with and without a point add up to the focus');
  // The district with the most students outside Bangkok holds more than any Bangkok district.
  assert.deepEqual([a.outside.id, a.outside.name, a.outside.province, a.outside.value], ['3001', 'เมืองนครราชสีมา', 'NMA', 93597]);
  assert.ok(a.outside.value > a.areas[0].value);
  assert.deepEqual(filterAreaRows(data.rows, new Set(a.areaIds)).length, a.count);
});

test('records Aha: Nakhon Ratchasima holds the most schools placed at district level; its top three are the focus', () => {
  const {data, index} = load();
  const c = summarizeAreaInsight(data.rows, index, {metric: 'count'});
  assert.equal(c.home, 'NMA');
  assert.deepEqual(c.areas.map(x => [x.name, x.value]), [['เมืองนครราชสีมา', 169], ['ปากช่อง', 110], ['ด่านขุนทด', 103]]);
  assert.deepEqual([c.value, c.homePlacedValue, c.homeValue], [382, 1786, 1786]);
  assert.equal(c.homeAreaIds.length, 32);
  assert.deepEqual([c.outside.name, c.outside.value], ['เมืองขอนแก่น', 212]);
  assert.deepEqual([c.rail.focus.within, c.rail.rest.within], [0, 0], 'no operating station in Nakhon Ratchasima: the panel hides the rail line');
});

test('the focus never cuts through a tie; a province where every district holds the same value is “spread”', () => {
  const {index} = load();
  const row = (area, students, i) => ({id: `t${area}-${i}`, area, province: index.byId.get(area).province, students, latitude: null, longitude: null});
  // Bangkok: 1033 (40), then 1037 and 1039 tied (20) above 1001 (10): only the district above the tie is the focus.
  const tie = [row('1033', 40, 1), row('1037', 20, 1), row('1039', 20, 1), row('1001', 10, 1)];
  assert.deepEqual(summarizeAreaInsight(tie, index).areas.map(a => a.id), ['1033', '1037', '1039'], 'the cut after three is above the tie');
  const tie4 = [...tie, row('1002', 20, 1)];
  assert.deepEqual(summarizeAreaInsight(tie4, index).areas.map(a => a.id), ['1033'], 'three districts tied at 20: only 1033 is above them');
  const spread = [row('1033', 5, 1), row('1037', 5, 1), row('1039', 5, 1), row('1001', 5, 1)];
  const s = summarizeAreaInsight(spread, index);
  assert.deepEqual(s.areas, []);
  assert.deepEqual(s.spread, {areas: 4, value: 5});
});

test('the Aha follows the filters: a province, a group, a level, nothing', () => {
  const {data, index} = load();
  const cmi = summarizeAreaInsight(filterRows(data.rows, {province: 'CMI'}), index);
  assert.equal(cmi.home, 'CMI');
  assert.equal(cmi.areas[0].name, 'เมืองเชียงใหม่');
  assert.equal(cmi.outside, null, 'a one-province selection has no outside finding');
  const intl = summarizeAreaInsight(filterRows(data.rows, {group: 'international'}), index);
  assert.deepEqual([intl.home, intl.areas[0].name], ['BKK', 'วัฒนา'], 'international schools: Watthana first');
  const kinder = summarizeAreaInsight(filterRows(data.rows, {level: 'kinder'}), index);
  assert.ok(kinder.areas.length > 0 && kinder.home !== '');
  const none = summarizeAreaInsight([], index);
  assert.deepEqual([none.areas.length, none.share, none.home], [0, 0, '']);
});

test('district model: EVID-05 — every district holds a record; records with no known students are no data for students, never 0', () => {
  const {data, index} = load();
  const students = buildAreaModel(data.rows, index);
  assert.equal(students.areas.length, 928);
  assert.equal(students.zeroCount, 0, 'all 928 districts hold at least one record');
  assert.equal(students.ramp.scaleId, SUPPLY_SCALE.scaleId);
  assert.deepEqual([students.ramp.min, students.ramp.max, students.ramp.steps], [398, 93597, 41]);
  assert.equal(students.byId.get('3001').fill, SUPPLY_SCALE.lut[40], 'เมืองนครราชสีมา (the national maximum) closes the ramp on sample 40');
  const count = buildAreaModel(data.rows, index, {metric: 'count'});
  assert.equal(count.ramp.scaleId, COUNT_SCALE.scaleId);
  assert.equal(count.zeroCount, 0);
  // A filter that leaves districts empty: measured zero (sample 0 + the zero outline), never no data.
  const intl = buildAreaModel(filterRows(data.rows, {group: 'international'}), index);
  assert.ok(intl.zeroCount > 800 && intl.areas.filter(a => a.state === 'measured_zero').every(a => a.count === 0));
  // A district whose records all have unknown students: no_data under students, a measured value under records.
  const unknown = [{id: 'u1', area: '1001', province: 'BKK', students: null}, {id: 'k1', area: '1033', province: 'BKK', students: 120}];
  assert.equal(buildAreaModel(unknown, index, {province: 'BKK'}).byId.get('1001').state, 'no_data');
  assert.equal(buildAreaModel(unknown, index, {province: 'BKK', metric: 'count'}).byId.get('1001').state, 'measured');
});

test('province frames total the measure per province; rows without a province are on no frame', () => {
  const {data, provincesGeo} = load();
  const m = buildProvinceModel(data.rows, provincesGeo);
  assert.equal(m.provinces.length, 77);
  const by = new Map();
  for (const r of data.rows) if (r.province) by.set(r.province, (by.get(r.province) || 0) + (r.students || 0));
  for (const p of m.provinces) assert.equal(p.value, by.get(p.code) || 0, p.code);
  assert.equal(m.provinces.find(p => p.code === 'BKK').fill, SUPPLY_SCALE.lut[40], 'Bangkok closes the province ramp');
  assert.equal(m.zeroCount, 0, 'every province holds a record');
  const none = buildProvinceModel([], provincesGeo);
  assert.ok(none.provinces.every(p => p.state === 'measured_zero'));
});

test('level words follow the province: เขต in Bangkok, อำเภอ elsewhere', () => {
  const {index} = load();
  assert.deepEqual(levelWords('BKK'), {area: 'เขต'});
  assert.deepEqual(levelWords('PKT'), {area: 'อำเภอ'});
  assert.equal(areaLabel(index.byId.get('1039')), 'เขตวัฒนา');
  assert.equal(areaLabel(index.byId.get('8301')), 'อำเภอเมืองภูเก็ต');
});
