import test from 'node:test';
import assert from 'node:assert/strict';
import {rankLabelCandidates, shortName, labelParts, centreCandidates, placeLabels, LABEL_MIN_ZOOM, LABEL_MAX} from '../js/labels.js';

// The Hotel rule of 2026-11-01 (point 5): names near the middle of the view, most important first (students +
// published tuition), short (icons before words), never covering the chrome or each other.
test('labels: importance first, then nearness to the centre; stable', () => {
  const c = [{row: {id: 'b', importance: 0.5}, d: 0.1}, {row: {id: 'a', importance: 0.9}, d: 0.9}, {row: {id: 'c', importance: 0.5}, d: 0.05}];
  assert.deepEqual(rankLabelCandidates(c).map(x => x.row.id), ['a', 'c', 'b']);
  assert.ok(LABEL_MIN_ZOOM >= 12 && LABEL_MAX.phone < LABEL_MAX.desktop);
});

test('short names drop the type word the cue already says; a place inside a school’s name stays', () => {
  assert.equal(shortName({name: 'ศพด.วัดธรรมาวุธาราม'}), 'วัดธรรมาวุธาราม');
  assert.equal(shortName({name: 'รร.เทศบาลพิรามอุทิศ'}), 'เทศบาลพิรามอุทิศ');
  assert.equal(shortName({name: 'โรงเรียนสาธิตจุฬาลงกรณ์มหาวิทยาลัย (ฝ่ายมัธยม)'}), 'สาธิตจุฬาลงกรณ์มหาวิทยาลัย (ฝ่ายมัธยม)', 'brackets inside the name stay balanced');
  assert.equal(shortName({name: 'นานาชาติขอนแก่น'}), 'นานาชาติขอนแก่น', 'the place is part of the name');
  assert.equal(shortName({name: 'โรงเรียน'}), 'โรงเรียน', 'never shorter than 3 characters: the full name stays');
  assert.equal(shortName({name: '', nameEn: 'Bangkok Patana School'}), 'Bangkok Patana School');
});

test('candidates come from the central ellipse only; placement avoids blockers and other labels and respects the cap', () => {
  const rows = Array.from({length: 30}, (_, i) => ({id: `h${i}`, longitude: i, latitude: 0, importance: 1 - i / 30}));
  const box = {left: 0, right: 1000, top: 0, bottom: 600};
  const project = ([x]) => ({x: 100 + x * 30, y: 300});
  const cands = centreCandidates(rows, project, box, {skip: 'h3'});
  assert.ok(cands.every(c => Math.abs(c.x - 500) <= 360) && !cands.some(c => c.row.id === 'h3'));
  const blockers = [{left: 380, right: 520, top: 0, bottom: 600}];
  const placed = placeLabels(rankLabelCandidates(cands), () => ({w: 80, h: 20}), () => 5, box, {max: 4, blockers});
  assert.ok(placed.length <= 4);
  const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  for (const p of placed) assert.ok(!blockers.some(b => overlaps(p.box, b)), 'never on the chrome');
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) assert.ok(!overlaps(placed[i].box, placed[j].box), 'never on another label');
});

test('label text: one short name and the recorded students (no number when unknown)', () => {
  assert.deepEqual(labelParts({name: 'บ้านชี', students: 120}), {site: 'บ้านชี', students: 120});
  assert.deepEqual(labelParts({name: 'ศพด.บ้านคลองใหญ่', students: null}), {site: 'บ้านคลองใหญ่', students: null}, 'unknown students → no number, never 0');
});
