/**
 * What the search box of CityMETER · School knows by name: the entries js/shell/fuzzy.js matches and js/shell/search.js
 * lists (release 0.7.0; owner 2026-11-12 12:05, VERBATIM: “ศึกษาแนวคิดเรื่อง Fuzzy search แล้ว implement กับ demo web
 * ให้ได้ user benefit สูงสุดตาม user intent ในขณะนั้น และตาม product statement”).
 *
 * The product statement reads where students and schools are, by area and by affiliation, with the learning services
 * beside them. So a name typed here opens the level that answers it: a province or a เขต/อำเภอ (its students and
 * schools), an affiliation or a school type (where it is), a learning service (the places that offer it), one school
 * or one learning record (its profile), or a rail station (the schools round it). The order below is the order among
 * equal matches: places first, and a school before a station of the same name.
 *
 * Pure: entries from the decoded dataset; no DOM, no numbers shown (a row names what it is and where).
 */
import {areaWord} from './areas.js';
import {provinces} from './model.js';
import {PROVINCE_AKA, withoutMueang} from './shell/fuzzy.js';

export const SEARCH_KINDS = Object.freeze([
  {id: 'province', level: 'province', auto: true}, {id: 'area', level: 'district', auto: true},
  // A school comes before a station of the same name, and the station is not chosen ahead: the page is about schools.
  {id: 'aff', auto: true}, {id: 'group', auto: true}, {id: 'service', auto: true}, {id: 'school'}, {id: 'learn'}, {id: 'station', level: 'station'},
]);
/** Words a name may begin with, or carry, that people add or leave out; an array is one word and its abbreviations. */
export const SEARCH_HEADS = Object.freeze([['โรงเรียน', 'รร.', 'ร.ร.'], 'วิทยาลัย', ['ศูนย์พัฒนาเด็กเล็ก', 'ศพด.'], 'school', 'college']);
/** What to try when nothing is found: the kinds of name this demo knows. */
export const SEARCH_HINT = 'ลองชื่อโรงเรียน สังกัด สถานี เขต/อำเภอ หรือจังหวัด';

/** Every entry, the few places and filters first, then the schools and the learning records. */
/**
 * The English an English page shows for a word of the page's own vocabulary (js/lang-en.js through `en`, which is
 * js/shell/i18n.js#translate there and nothing on a Thai page): the list finds the entry by it and heads its row with
 * it. The data keeps these words in Thai only.
 */
const englishOf = (en, th) => { const x = en ? en(th) : null; return typeof x === 'string' && x && x !== th && !/\p{Script=Thai}/u.test(x) ? x : undefined; };

export function* searchEntries({data, index, learning, en = null}) {
  const byCode = new Map(provinces().map(p => [p.code, p]));
  for (const p of provinces()) yield {id: p.code, kind: 'province', name: p.th, nameEn: p.en, aka: PROVINCE_AKA[p.th], codes: [p.code, p.dopa], province: p.code};
  const places = new Map();
  for (const a of index.byId.values()) {
    const p = byCode.get(a.province);
    places.set(a.id, [a.name, a.nameEn, p?.th, p?.en]);
    yield {id: a.id, kind: 'area', name: a.name, nameEn: a.nameEn, also: withoutMueang(a.name), codes: [a.id], within: [p?.th, p?.en], province: a.province, area: a.id};
  }
  for (const s of data.stations) yield {id: s.id, kind: 'station', name: s.name, nameEn: s.nameEn, station: s};
  for (const a of data.affs) yield {id: a.id, kind: 'aff', name: a.th, nameEn: englishOf(en, a.th), aka: [a.short]};
  for (const g of data.groups) yield {id: g.id, kind: 'group', name: g.th, nameEn: g.en, aka: [g.short]};
  for (const s of learning?.services || []) yield {id: s.id, kind: 'service', name: s.th, nameEn: englishOf(en, s.th)};
  const provinceOnly = new Map();
  for (const r of data.rows) {
    let within = r.area ? places.get(r.area) : provinceOnly.get(r.province);
    if (!within) { const p = byCode.get(r.province); within = [p?.th, p?.en]; provinceOnly.set(r.province, within); }
    yield {id: r.id, kind: 'school', name: r.name, nameEn: r.nameEn, within, province: r.province, area: r.area, weight: r.importance || 0, row: r};
  }
  // Learning-service records (the learning measure's rows): a kind of their own, opened on their own measure.
  for (const r of learning?.rows || []) {
    let within = r.area ? places.get(r.area) : provinceOnly.get(r.province);
    if (!within) { const p = byCode.get(r.province); within = [p?.th, p?.en]; provinceOnly.set(r.province, within); }
    yield {id: r.id, kind: 'learn', name: r.name, nameEn: r.nameEn, within, province: r.province, area: r.area, weight: r.importance || 0, row: r};
  }
}

/** The line under a name in the list: what it is and where. Thai; an English page translates it part by part. */
export function searchNote(entry, {data, index, learning}) {
  const province = code => provinces().find(p => p.code === code)?.th || '';
  if (entry.kind === 'province') return 'จังหวัด';
  if (entry.kind === 'area') return [areaWord(entry.province), province(entry.province)].filter(Boolean).join(' · ');
  // A station reads as the head of its own panel does: the word, its lines, “กำลังสร้าง” while it is being built.
  if (entry.kind === 'station') return ['สถานีรถไฟฟ้า', ...(entry.station.lines || []), entry.station.status === 'construction' ? 'กำลังสร้าง' : ''].filter(Boolean).join(' · ');
  if (entry.kind === 'aff') return 'สังกัด';
  if (entry.kind === 'group') return 'ประเภทสถานศึกษา';
  if (entry.kind === 'service') return 'บริการเรียนเสริม';
  const r = entry.row, a = r.area ? index.byId.get(r.area) : null;
  return [entry.kind === 'learn' ? 'เรียนเสริม' : data.groups[r.group]?.th, a?.name, province(r.province)].filter(Boolean).join(' · ');
}
