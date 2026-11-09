/**
 * Contextual outbound actions: the next question a reader has at each view, answered outside the demo.
 *
 *  - ถาม Google AI — Google Search with a question written for the view: a school (grades it takes, fees now, recent
 *    results and reviews, getting there), a district or a station (which schools, public, private or international,
 *    fees, rail), an affiliation (its schools and recent news), a building, or the country/province overview (student
 *    numbers, openings and closures). Google answers at the
 *    top of the results (AI Overview) and its AI Mode tab carries the question on. Never a link straight into AI Mode
 *    (`udm=50`): Google stops one that comes from another site at “Continue with this search?” (Hotel 0.3.3, measured
 *    2026-11-02 for long and short questions, with or without a referrer; a typed address or Google's own AI Mode tab
 *    opens without it). Owner 2026-11-02: “ทำให้มันตอบทันเลยได้มั้ย”;
 *  - Street View — only where the view has a point (a school's registry point, or a station's reference point, which
 *    is not an entrance: the label says "ใกล้");
 *  - Google Maps — a search by school name + district + province (or "โรงเรียน" + place).
 *
 * Pure: builds labels and https URLs from public names only (no user data, no internal ids). The Google names on the
 * buttons say where the answers come from (owner 2026-11-01: no caveat lines).
 * An English page (citymeter-shell 0.5.x) asks in English, with the English names the data gives (js/lang.js); the
 * button labels are translated by js/shell/i18n.js like the rest of the page.
 */
import {LANG, englishName, translate} from './shell/i18n.js';

const enc = encodeURIComponent;
export const googleAskURL = q => `https://www.google.com/search?q=${enc(q)}`;
export const mapsSearchURL = q => `https://www.google.com/maps/search/?api=1&query=${enc(q)}`;
export const streetViewURL = (lat, lon) => (Number.isFinite(lat) && Number.isFinite(lon)
  ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lon.toFixed(6)}` : '');

const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const join = (...parts) => clean(parts.filter(Boolean).join(' '));
/**
 * ctx: {kind: 'school'|'building'|'area'|'station'|'aff'|'overview'|'learning'|'learning-area'|'learning-station'|
 *       'learning-overview', row?, area?: {place, province}, station?, aff?,
 *       province?, point?: {lat, lon, role}, rows?}
 * → [{id, label, href, note}] in display order (only the actions that apply).
 */
export function contextActions(ctx = {}, lang = LANG) {
  if (lang === 'en') return contextActionsEnglish(ctx);
  const out = [], place = ctx.area ? join(ctx.area.place, ctx.area.province) : '';
  const add = (id, label, href, note = '') => { if (href) out.push({id, label, href, note}); };
  if (ctx.kind === 'school' && ctx.row) {
    const r = ctx.row, name = clean(r.name || r.nameEn);
    add('ai', 'ถาม Google AI', googleAskURL(`โรงเรียน${join(name, place ? `(${place})` : '')} เปิดรับนักเรียนชั้นไหนบ้าง ค่าเทอมปีนี้เท่าไร ผลการเรียนและรีวิวล่าสุดเป็นอย่างไร และเดินทางไปอย่างไร`));
    add('maps', 'Google Maps', mapsSearchURL(join(name, ctx.area?.place, ctx.area?.province)));
  } else if (ctx.kind === 'building') {
    const names = [...new Set((ctx.rows || []).map(r => clean(r.name || r.nameEn)).filter(Boolean))].slice(0, 2);
    add('ai', 'ถาม Google AI', googleAskURL(`${join(names.join(' และ '), place)} อยู่ในบริเวณเดียวกันไหม และรอบ ๆ มีอะไรอีกบ้าง`));
  } else if (ctx.kind === 'area' && ctx.area) {
    add('ai', 'ถาม Google AI', googleAskURL(`โรงเรียนใน${clean(ctx.area.place)} ${clean(ctx.area.province)} มีโรงเรียนรัฐ เอกชน และนานาชาติที่ไหนบ้าง ค่าเทอมประมาณเท่าไร และย่านไหนเดินทางสะดวกหรือใกล้รถไฟฟ้า`));
    add('maps', 'Google Maps', mapsSearchURL(`โรงเรียน ${join(ctx.area.place, ctx.area.province)}`));
  } else if (ctx.kind === 'station' && ctx.station) {
    const s = ctx.station, line = (s.lines || []).join(' ');
    add('ai', 'ถาม Google AI', googleAskURL(`โรงเรียนใกล้สถานี${clean(s.name)}${line ? ` (${clean(line)})` : ''} มีที่ไหนบ้าง เดินไปกี่นาที ค่าเทอมและรีวิวเป็นอย่างไร`));
    add('maps', 'Google Maps', mapsSearchURL(`โรงเรียนใกล้สถานี${clean(s.name)}`));
  } else if (ctx.kind === 'aff' && ctx.aff) {
    add('ai', 'ถาม Google AI', googleAskURL(`${clean(ctx.aff.th)} มีโรงเรียนในสังกัดกี่แห่ง นักเรียนกี่คน และมีนโยบายหรือข่าวล่าสุดอะไรบ้าง`));
  } else if (ctx.kind === 'learning' && ctx.row) {
    const r = ctx.row, name = clean(r.name || r.nameEn);
    add('ai', 'ถาม Google AI', googleAskURL(`${join(name, place ? `(${place})` : '')} สอนอะไรบ้าง เปิดคอร์สอะไร ค่าเรียนเท่าไร รีวิวเป็นอย่างไร และยังเปิดสอนอยู่ไหม`));
    add('maps', 'Google Maps', mapsSearchURL(join(name, ctx.area?.place, ctx.area?.province)));
  } else if (ctx.kind === 'learning-area' && ctx.area) {
    add('ai', 'ถาม Google AI', googleAskURL(`ที่เรียนพิเศษ กวดวิชา สอนภาษา และศิลปะใน${clean(ctx.area.place)} ${clean(ctx.area.province)} มีที่ไหนบ้าง ค่าเรียนประมาณเท่าไร และย่านไหนเดินทางสะดวก`));
    add('maps', 'Google Maps', mapsSearchURL(`กวดวิชา ${join(ctx.area.place, ctx.area.province)}`));
  } else if (ctx.kind === 'learning-station' && ctx.station) {
    const s = ctx.station;
    add('ai', 'ถาม Google AI', googleAskURL(`ที่เรียนพิเศษ กวดวิชา หรือโรงเรียนสอนภาษาใกล้สถานี${clean(s.name)} มีที่ไหนบ้าง เดินไปกี่นาที ค่าเรียนเท่าไร`));
    add('maps', 'Google Maps', mapsSearchURL(`กวดวิชาใกล้สถานี${clean(s.name)}`));
  } else if (ctx.kind === 'learning-overview') {
    const where = clean(ctx.province) || 'ประเทศไทย';
    add('ai', 'ถาม Google AI', googleAskURL(`ภาพรวมโรงเรียนกวดวิชา สอนภาษา และศิลปะใน${where}ล่าสุด กระจุกอยู่ย่านไหน และมีที่เปิดใหม่หรือปิดบ้าง`));
  } else if (ctx.kind === 'overview') {
    const where = clean(ctx.province) || 'ประเทศไทย';
    add('ai', 'ถาม Google AI', googleAskURL(`ภาพรวมจำนวนนักเรียนและโรงเรียนใน${where}ล่าสุด นักเรียนลดลงหรือเพิ่มขึ้น และมีโรงเรียนเปิดใหม่หรือปิดที่ไหนบ้าง`));
  }
  const p = ctx.point;
  if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) {
    add('streetview', p.role === 'station' ? 'Street View ใกล้สถานี' : 'Street View', streetViewURL(p.lat, p.lon));
  }
  return out;
}

/** The same actions for an English page: English questions, English names where the data has them. */
function contextActionsEnglish(ctx = {}) {
  // N: a name (the data's English, else as given); T: a word of the dictionary (an affiliation, a line), else as given.
  const out = [], N = s => englishName(clean(s)), T = s => translate(clean(s)) ?? clean(s);
  const add = (id, label, href) => { if (href) out.push({id, label, href, note: ''}); };
  const where = ctx.area ? [N(ctx.area.place), N(ctx.area.province)].filter(Boolean).join(', ') : '';
  const lines = s => (s.lines || []).map(T).join(', ');
  if (ctx.kind === 'school' && ctx.row) {
    const r = ctx.row, name = N(r.name || r.nameEn);
    add('ai', 'ถาม Google AI', googleAskURL(`${name}${where ? ` (${where})` : ''}: which grades does it take, what are the fees this year, what do recent results and reviews say, and how do I get there?`));
    add('maps', 'Google Maps', mapsSearchURL(join(name, N(ctx.area?.place), N(ctx.area?.province))));
  } else if (ctx.kind === 'building') {
    const names = [...new Set((ctx.rows || []).map(r => N(r.name || r.nameEn)).filter(Boolean))].slice(0, 2);
    add('ai', 'ถาม Google AI', googleAskURL(`Are ${names.join(' and ')}${where ? ` (${where})` : ''} on the same site, and what else is around them?`));
  } else if (ctx.kind === 'area' && ctx.area) {
    add('ai', 'ถาม Google AI', googleAskURL(`Schools in ${where}: which public, private and international schools are there, what are the fees, and which neighbourhoods are easy to reach or near rail?`));
    add('maps', 'Google Maps', mapsSearchURL(`school ${where}`));
  } else if (ctx.kind === 'station' && ctx.station) {
    const s = ctx.station, station = N(s.name), line = lines(s);
    add('ai', 'ถาม Google AI', googleAskURL(`Schools near ${station} station${line ? ` (${line})` : ''}: where are they, how many minutes' walk, and what are the fees and reviews?`));
    add('maps', 'Google Maps', mapsSearchURL(`school near ${station} station`));
  } else if (ctx.kind === 'aff' && ctx.aff) {
    add('ai', 'ถาม Google AI', googleAskURL(`${T(ctx.aff.th)} (Thailand): how many schools and students does it have, and what are its latest policies or news?`));
  } else if (ctx.kind === 'learning' && ctx.row) {
    const r = ctx.row, name = N(r.name || r.nameEn);
    add('ai', 'ถาม Google AI', googleAskURL(`${name}${where ? ` (${where})` : ''}: what does it teach, which courses are open, what are the fees, what do reviews say, and is it still open?`));
    add('maps', 'Google Maps', mapsSearchURL(join(name, N(ctx.area?.place), N(ctx.area?.province))));
  } else if (ctx.kind === 'learning-area' && ctx.area) {
    add('ai', 'ถาม Google AI', googleAskURL(`Tutoring, language and arts schools in ${where}: where are they, what are the fees, and which neighbourhoods are easy to reach?`));
    add('maps', 'Google Maps', mapsSearchURL(`tutoring ${where}`));
  } else if (ctx.kind === 'learning-station' && ctx.station) {
    const station = N(ctx.station.name);
    add('ai', 'ถาม Google AI', googleAskURL(`Tutoring or language schools near ${station} station: where are they, how many minutes' walk, and what are the fees?`));
    add('maps', 'Google Maps', mapsSearchURL(`tutoring near ${station} station`));
  } else if (ctx.kind === 'learning-overview') {
    const place = N(ctx.province) || 'Thailand';
    add('ai', 'ถาม Google AI', googleAskURL(`Latest overview of tutoring, language and arts schools in ${place}: where do they cluster, and which have opened or closed?`));
  } else if (ctx.kind === 'overview') {
    const place = N(ctx.province) || 'Thailand';
    add('ai', 'ถาม Google AI', googleAskURL(`Latest overview of students and schools in ${place}: are student numbers falling or rising, and where have schools opened or closed?`));
  }
  const p = ctx.point;
  if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) add('streetview', p.role === 'station' ? 'Street View ใกล้สถานี' : 'Street View', streetViewURL(p.lat, p.lon));
  return out;
}

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

/** The action bar (icon + short label). '' when nothing applies. */
export function actionBar(ctx) {
  const list = contextActions(ctx);
  if (!list.length) return '';
  return `<div class="ask-bar" role="group" aria-label="ค้นต่อใน Google">${list.map(a => `<a class="ask-link ask-${esc(a.id)}" href="${esc(a.href)}" target="_blank" rel="noopener noreferrer"${a.note ? ` title="${esc(a.note)}"` : ''}><i class="pictogram pic-${a.id === 'ai' ? 'ai' : a.id === 'streetview' ? 'streetview' : 'maps'}" aria-hidden="true"></i><span>${esc(a.label)}</span></a>`).join('')}</div>`;
}
