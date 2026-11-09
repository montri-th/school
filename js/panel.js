/**
 * Reading panel views as HTML strings. Pure: no DOM access, no map.
 *
 * Every actionable element carries data-action (+ data-id / data-value); the app binds one delegated handler.
 * Actions: select-area · select-school · select-building · select-station · select-province · filter-aff ·
 * filter-group · filter-level · set-metric · back · explore-top · clear-focus · open-charts · open-table · clear-filter ·
 * leave-area · filter-service.
 *
 * Copy (the Hotel rule of 2026-11-01, “เรื่องภาษา ขอที่ กระชับอ่านเข้าใจง่าย ใช้ symbol, logo, icon, charts มาช่วยทำให้
 * text กระชับ … ตรงกับ context ของ ICP ตาม product statement ไม่มี caveats เลย และเป็นธรรมชาติ”): short Thai in the words
 * of families choosing where to live and of the people planning housing and schools; pictograms and small bar charts
 * carry what a sentence used to; no caveat on screen. Exactness comes from the names themselves — “ค่าเรียน … ปีการศึกษา”,
 * “ผลประเมิน สมศ. ปี …”, a rank “จาก N”, the numerator and denominator of every share (visible, or in the tile's title
 * and accessible name) — and from one provenance line per view: dataset · source · date · boundary, then “วิธีนับ”
 * (DATA_METHOD.md, where the method and its limits live). Three measures (js/model.js#METRICS): นักเรียน (default) ·
 * สถานศึกษา · เรียนเสริม (0.2.0: its own rows and views — renderLearning*; the school views list the district's
 * learning records by service and the pinned ones near the school or station; services overlap, so a service bar
 * counts a record in each of its services while a total counts it once). Unknown students are never 0 (“ไม่ทราบจำนวนนักเรียน”, a hatched “ไม่ทราบ” bar). Tuition per school only,
 * never summed or averaged across schools. Distances are straight lines (the distance pictogram; “ระยะตรง” in titles).
 * A school's pin inside a drawn building is “สถานศึกษาในอาคารนี้” / “อีก N แห่งในอาคารนี้”, never “ตั้งอยู่ใน”. Sources,
 * methods and ids sit in one closed <details>.
 */
import {LANG} from './shell/i18n.js';
import {thaiSubName} from './lang.js';
import {productionLink, provinceByCode, hasPoint, stationLink, SIZE_BANDS, LEVELS, gradeRange} from './model.js';
import {areaWord} from './areas.js';
import {cueMarkup} from './cues.js';
import {actionBar} from './ask.js';
import {LEARNING_SERIES, SERVICE_PICTOGRAM, POINT_TH} from './learning.js';

const NUMBER = new Intl.NumberFormat('th-TH', {maximumFractionDigits: 0});
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export const num = n => NUMBER.format(n);
/** Whole-number share; a non-zero part never prints as 0% ("<1%"). */
export const pct = (part, whole) => (!whole ? '—' : part && Math.round((part / whole) * 100) === 0 ? '<1%' : `${NUMBER.format(Math.round((part / whole) * 100))}%`);
/** A number and its unit never split across lines in running text. */
const nw = html => `<span class="nowrap">${html}</span>`;
const safeURL = value => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
/** Straight-line distance for display: "320 ม." / "1.4 กม.". */
export const meters = m => (!Number.isFinite(m) ? '' : m < 1000 ? `${num(Math.round(m / 10) * 10)} ม.` : `${(m / 1000).toLocaleString('th-TH', {maximumFractionDigits: 1})} กม.`);
const baht = v => `฿${num(v)}`;
/** A decorative pictogram of the approved subset (js/navigation.js PICTOGRAM_CONTRACT); the text carries the meaning. */
const pic = (kind, cls = '') => `<i class="${cls ? `${cls} ` : ''}pictogram pic-${esc(kind)}" aria-hidden="true"></i>`;
/** The method and its limits (one link at the end of every provenance line). */
export const METHOD_URL = 'DATA_METHOD.md';

export function link(url, label, cls = 'source-link') {
  const u = safeURL(url);
  return u ? `<a class="${cls}" href="${esc(u)}" target="_blank" rel="noopener">${esc(label)}</a>` : '';
}

/** The line under a school's name: its English name when it has one; on an English page, its Thai name (js/lang.js). */
export function subLine(r, cls, tag = 'p') {
  if (LANG === 'en') {
    const thai = thaiSubName(r);
    return thai ? `<${tag} class="${cls}" lang="th" translate="no">${esc(thai)}</${tag}>` : '';
  }
  return r?.nameEn ? `<${tag} class="${cls}">${esc(r.nameEn)}</${tag}>` : '';
}

export function thaiDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso || '')) return iso || '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${d} ${months[m - 1]} ${y + 543}`;
}

/** Metric tile with a decorative pictogram; value may be a preformatted string. `detail` (numerator and denominator)
 *  is the tile's title and part of its accessible text. */
export function metricTile(value, label, kind = '', detail = '') {
  const shown = typeof value === 'string' ? value : num(value);
  return `<div class="metric${kind ? ` metric-${kind}` : ''}"${detail ? ` title="${esc(detail)}"` : ''}>${pic(kind || 'plain', 'metric-symbol')}<strong class="data-number">${esc(shown)}</strong><span>${esc(label)}</span>${detail ? `<span class="sr-only">${esc(detail)}</span>` : ''}</div>`;
}
/** The students tile: the recorded total, or “—” (its title says why) when the records have no known count. */
const studentsTile = (students, count, label = 'นักเรียน') => (students || !count
  ? metricTile(students || 0, label, 'students')
  : metricTile('—', label, 'students', 'ไม่ทราบจำนวนนักเรียน'));
/** "1,200 คน", or “ไม่ทราบจำนวนนักเรียน” for records whose students are all unknown (never “0 คน”). */
const studentsOf = (students, count = 1) => (students ? `${num(students)} คน` : count ? 'ไม่ทราบจำนวนนักเรียน' : '0 คน');
export const heading = (kind, text, id = '') => `<h3${id ? ` id="${esc(id)}"` : ''}>${pic(kind)}${esc(text)}</h3>`;

const provinceName = code => provinceByCode(code)?.th || code || '';
/** "เขตวัฒนา" / "อำเภอเมืองภูเก็ต". */
const placeName = a => (a ? `${areaWord(a.province)}${a.name}` : '');
/** One word for a list of districts: เขต (all Bangkok), อำเภอ (none), else เขต/อำเภอ. */
export const words = areas => {
  const p = new Set(areas.map(a => a.province));
  return p.size === 1 ? areaWord([...p][0]) : 'เขต/อำเภอ';
};
const valueText = (v, unit) => nw(`<strong class="data-number">${num(v)}</strong> ${esc(unit.one)}`);
export const studentsText = r => (r?.students ? `${num(r.students)} คน` : 'ไม่ทราบจำนวนนักเรียน');
/** "อโศก (สุขุมวิท)" — next to the rail pictogram; "สถานีอโศก (สุขุมวิท)" in running text. */
const stationShort = s => (s ? `${s.name}${s.lines?.length ? ` (${s.lines.join(' · ')})` : ''}` : '');
const stationName = s => (s ? `สถานี${stationShort(s)}` : '');
/** Annual tuition range: "฿279,500–384,400". */
export const feeText = fee => (!fee ? '' : fee.min !== fee.max ? `${baht(fee.min)}–${num(fee.max)}` : baht(fee.min));
/** "2565/1" → "2565 ภาค 1". */
const periodText = p => String(p || '').replace(/^(\d{4})\/(\d)$/, '$1 ภาค $2');

/* ---------- vocabularies (source details only) ---------- */

/** How the row's district was matched at build time (row.admin). */
export const ADMIN_TH = Object.freeze({
  source: 'ตาม CityMETER School',
  name: 'จากชื่อเขต/อำเภอในข้อมูลของโรงเรียน',
  province: 'ระบุได้แค่จังหวัด',
  none: 'ไม่ระบุจังหวัด',
});

/**
 * The provenance line every view that shows numbers ends with: dataset · source · date · boundary (each part in
 * `data-prov`, its word for screen readers), then the method link. Rail, OPEC, ONESQA, fee and terrain sources join
 * the source part when the view shows them.
 */
export function provenance(ctx = {}, boundary = '', {rail = false, terrain = false, opec = false, onesqa = false, fees = false, learn = false, learnOnly = false, provider = false} = {}) {
  const meta = ctx.meta || {};
  // Learning views (0.2.0) read the OPEC nonformal-school register of the same research master (tabs 27–29).
  const sources = [learnOnly ? '' : 'CityMETER School 2569', learn || learnOnly ? 'ทะเบียนโรงเรียนนอกระบบ สช. (เรียนเสริม)' : '', provider ? 'ผู้ให้บริการ' : '',
    opec ? 'สช. (OPEC)' : '', onesqa ? 'สมศ. (ONESQA)' : '', fees ? 'ประกาศค่าเรียนของโรงเรียน' : '',
    rail ? `CityMETER Transit ${thaiDate(meta.context?.rail?.asOf || '')}`.trim() : '',
    terrain ? `SRTM 30 ม. (2543)${ctx.osmDate ? ` · OSM ${thaiDate(ctx.osmDate)}` : ''}` : ''].filter(Boolean);
  return `<p class="hint panel-foot provenance"><span class="prov-part" data-prov="dataset">${pic('dataset')}<span class="sr-only">ชุดข้อมูล </span>CityMETER School</span> <span class="prov-part" data-prov="source"><span class="sr-only">แหล่ง</span>จาก ${esc(sources.join(' · '))}</span><span class="prov-part" data-prov="date">${pic('date')}<span class="sr-only">ตรวจ </span>${esc(thaiDate(meta.checkedOn || ''))}</span><span class="prov-part" data-prov="boundary">${pic('area')}<span class="sr-only">ขอบเขต </span>${esc(boundary)}</span><span class="prov-part prov-method"><a href="${METHOD_URL}" target="_blank" rel="noopener">วิธีนับ</a></span></p>`;
}

/* ---------- shared fragments ---------- */

/** Bars per school group in the group's series colour + shape cue; value = the measure. */
function groupBars(byGroup, unit) {
  const val = g => (unit.id === 'count' ? g.count : g.students);
  const list = byGroup.filter(g => val(g) > 0).sort((a, b) => val(b) - val(a) || a.index - b.index);
  if (!list.length) return `<p class="hint">ไม่มี${esc(unit.subject)}</p>`;
  const max = Math.max(1, ...list.map(val));
  return `<ul class="mix-list" aria-label="ประเภทสถานศึกษา (${esc(unit.one)})">${list.map(g => `
    <li><button type="button" class="mix-row" data-action="filter-group" data-value="${esc(g.id)}" title="ดูเฉพาะ${esc(g.th)}"><span class="mix-label">${cueMarkup(g.series)}${esc(g.th)}</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill category-${g.series}" style="width:${Math.max(3, Math.round((val(g) / max) * 100))}%"></span></span>
      <span class="mix-value data-number">${num(val(g))}</span></button></li>`).join('')}</ul>`;
}

/** Records per student-size band; unknown students are their own hatched bar (never a 0-student band). */
function sizeBars(sizes) {
  if (!sizes.bands.some(b => b.count) && !sizes.unknown) return '';
  const max = Math.max(1, sizes.unknown || 0, ...sizes.bands.map(b => b.count));
  const width = n => (n ? Math.max(3, Math.round((n / max) * 100)) : 0);
  return `<ul class="mix-list size-list" aria-label="ขนาดสถานศึกษา (แห่ง)">${sizes.bands.map(b => `
    <li><span class="mix-label">${esc(b.th)}</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill size-fill" style="width:${width(b.count)}%"></span></span>
      <span class="mix-value data-number" title="${num(b.students)} คน">${num(b.count)}</span></li>`).join('')}${sizes.unknown ? `
    <li title="ไม่ทราบจำนวนนักเรียน"><span class="mix-label">ไม่ทราบ</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill legend-nodata" style="width:${width(sizes.unknown)}%"></span></span>
      <span class="mix-value data-number">${num(sizes.unknown)}</span></li>` : ''}</ul>`;
}

/** Records per level taught (a school in two levels counts in both); each bar filters the map to that level. */
function levelBars(levels) {
  if (!levels.levels.some(l => l.count) && !levels.unknown) return '';
  const max = Math.max(1, levels.unknown || 0, ...levels.levels.map(l => l.count));
  const width = n => (n ? Math.max(3, Math.round((n / max) * 100)) : 0);
  return `<ul class="mix-list level-list" aria-label="ระดับชั้นที่เปิดสอน (แห่ง)">${levels.levels.map(l => `
    <li><button type="button" class="mix-row" data-action="filter-level" data-value="${esc(l.id)}" title="ดูเฉพาะที่เปิดสอน${esc(l.th)}"><span class="mix-label">${esc(l.th)}</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill size-fill" style="width:${width(l.count)}%"></span></span>
      <span class="mix-value data-number">${num(l.count)}</span></button></li>`).join('')}${levels.unknown ? `
    <li><button type="button" class="mix-row" data-action="filter-level" data-value="unknown" title="ไม่ทราบระดับชั้นที่เปิดสอน (ดูเฉพาะกลุ่มนี้)"><span class="mix-label">ไม่ทราบ</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill legend-nodata" style="width:${width(levels.unknown)}%"></span></span>
      <span class="mix-value data-number">${num(levels.unknown)}</span></button></li>` : ''}</ul>`;
}

function rowMeta(r, {showArea = false, index = null, distance = null} = {}) {
  const area = showArea && index && r.area ? index.byId.get(r.area) : null;
  const d = distance?.get?.(r.id);
  return [studentsText(r), gradeRange(r), r.aff?.short || '', area ? placeName(area) : showArea && !r.area ? (r.province ? provinceName(r.province) : 'ไม่ระบุจังหวัด') : '',
    Number.isFinite(d) ? meters(d) : ''].filter(Boolean).join(' · ');
}

/** Schools: cue (school group) + name, then students · grades · affiliation · where · distance. */
export function schoolList(rows, opts = {}) {
  return `<ul class="outlet-list">${rows.map(r => `<li><button type="button" class="brand-row" data-action="select-school" data-id="${esc(r.id)}">${cueMarkup(r.series, {className: 'row-cue'})}<span class="row-text"><strong>${esc(r.name || r.nameEn || 'ไม่มีชื่อ')}</strong><span class="row-meta">${esc(rowMeta(r, opts))}</span></span></button></li>`).join('')}</ul>`;
}

/** "ดูทั้งหมด 193 แห่ง" under a shortened list. */
const moreButton = count => `<p class="list-more"><button type="button" class="link-button" data-action="open-table">ดูทั้งหมด ${num(count)} แห่ง</button></p>`;

/** The chip figure of an affiliation: the measure; students unknown → its records (“2 แห่ง”), never “0”. */
const chipFigure = (x, unit) => (unit.id === 'count' ? num(x.count) : x.students ? num(x.students) : `${num(x.count)} แห่ง`);
const chipTitle = x => `${num(x.count)} แห่ง · ${x.students ? `${num(x.students)} คน` : 'ไม่ทราบจำนวนนักเรียน'}`;

/** Affiliations (สังกัด) as chips; each filters the map to that affiliation. */
function affChips(list, unit) {
  if (!list.length) return '<p class="hint">ไม่มีสังกัดในตัวกรองนี้</p>';
  return `<ul class="chip-list">${list.map(c => `<li><button type="button" class="brand-chip" data-action="filter-aff" data-value="${esc(c.aff.id)}" title="${esc(c.aff.th)} — ${chipTitle(c)} (ดูเฉพาะสังกัดนี้)">${pic('aff', 'chip-pic')}<span>${esc(c.aff.short)}</span><small class="data-number">${chipFigure(c, unit)}</small></button></li>`).join('')}</ul>`;
}

/** Districts ranked by the measure, bars in the map's 41-sample ramp colour (classOf). */
function areaRanking(list, classOf, unit, {title, note = '', limit = 10, showProvince = false, id = 'rank-title'} = {}) {
  const top = list.filter(a => a.value > 0).slice(0, limit);
  if (!top.length) return '';
  const max = Math.max(1, ...top.map(a => a.value));
  return `<section class="panel-section" aria-labelledby="${esc(id)}">
    <div class="section-heading">${heading('area', title, id)}<span class="hint">${esc(note)}</span></div>
    <ol class="rank-list">${top.map((a, i) => {
      const other = unit.id === 'learning' ? '' : unit.id === 'count' ? studentsOf(a.students, a.count) : `${num(a.count)} แห่ง`;
      const where = [`${showProvince ? `${provinceName(a.province)} · ` : ''}${num(a.value)} ${unit.one}`, other].filter(Boolean).join(' · ');
      return `<li><button type="button" class="rank-row" data-action="select-area" data-id="${esc(a.id)}" aria-label="อันดับ ${i + 1} ${esc(placeName(a))} ${showProvince ? esc(provinceName(a.province)) : ''} ${num(a.value)} ${esc(unit.one)} ${esc(other)}">
        <span class="rank-index data-number" aria-hidden="true">${i + 1}</span>
        <span class="rank-name">${esc(placeName(a))}<small>${esc(where)}</small></span>
        <span class="rank-track" aria-hidden="true"><span class="rank-fill" style="width:${Math.max(3, Math.round((a.value / max) * 100))}%;background:${esc(classOf(a))}"></span></span>
        <span class="rank-value data-number" aria-hidden="true">${num(a.value)}</span></button></li>`;
    }).join('')}</ol>
  </section>`;
}

/** Stations of CityMETER · Transit whose 500 m holds the most of the measure (each row at its nearest station). */
function stationRanking(list, unit, {title = 'สถานีที่มีนักเรียนรอบ ๆ มากที่สุด', limit = 6} = {}) {
  const top = list.filter(s => s.value > 0).slice(0, limit);
  if (!top.length) return '';
  const max = Math.max(1, ...top.map(s => s.value));
  return `<section class="panel-section"><div class="section-heading">${heading('rail', title)}<span class="hint" title="ระยะตรงจากสถานีที่เปิดแล้ว">${pic('distance', 'hint-pic')}≤ 500 ม.</span></div>
    <ol class="rank-list">${top.map((s, i) => `<li><button type="button" class="rank-row" data-action="select-station" data-id="${esc(s.station.id)}" aria-label="${esc(stationName(s.station))} ${num(s.value)} ${esc(unit.one)}">
      <span class="rank-index data-number" aria-hidden="true">${i + 1}</span>
      <span class="rank-name">${esc(stationShort(s.station))}<small>${esc(unit.id === 'learning' ? `${num(s.count)} แห่ง` : `${num(s.count)} แห่ง · ${studentsOf(s.students, s.count)}`)}</small></span>
      <span class="rank-track" aria-hidden="true"><span class="rank-fill rail-fill" style="width:${Math.max(3, Math.round((s.value / max) * 100))}%"></span></span>
      <span class="rank-value data-number" aria-hidden="true">${num(s.value)}</span></button></li>`).join('')}</ol></section>`;
}

/** "x จาก y คน ห่างสถานีที่เปิดแล้วไม่เกิน 500 ม." — the title and accessible text of a rail share. */
const railDetail = (s, unit) => `${num(s.within)} จาก ${num(s.base)} ${unit.one} ห่างสถานีรถไฟฟ้าที่เปิดแล้วไม่เกิน 500 ม. (ระยะตรง)`;

/** "ประกาศค่าเรียนรายปี 12 แห่ง" — when the selection has any. */
const feeLine = fees => (fees?.tuition ? `<p class="fact-line">${pic('fee', 'fact-icon')}ประกาศค่าเรียนรายปี ${nw(`<strong class="data-number">${num(fees.tuition)}</strong> แห่ง`)}</p>` : '');

/* ---------- Affiliation card (สังกัด filter) ---------- */

export function renderAffCard(p, ctx = {}) {
  if (!p) return '';
  const unit = ctx.unit, a = p.aff;
  const rail = p.rail?.base ? metricTile(pct(p.rail.within, p.rail.base), 'ใกล้รถไฟฟ้า', 'rail', railDetail(p.rail, unit)) : '';
  return `<section class="brand-card detail-head" aria-labelledby="aff-title">
      <div class="identity">${pic('aff', 'identity-pic')}<div>
        <p class="eyebrow">สังกัด · ${esc(a.short)}</p>
        <h2 id="aff-title">${esc(a.th)}</h2></div></div>
      ${p.scopeCount ? `<div class="metrics compact">${studentsTile(p.scopeStudents, p.scopeCount)}${metricTile(p.scopeCount, 'แห่ง', 'school')}${metricTile(p.provinces, 'จังหวัด', 'province')}${rail}</div>` : ''}
      ${p.scopeCount ? groupBars(p.byGroup, unit) : ''}
      ${actionBar({kind: 'aff', aff: a})}
      <div class="detail-actions"><button type="button" class="btn quiet" data-action="clear-filter" data-id="aff">ดูทุกสังกัด</button></div>
    </section>`;
}

/* ---------- Overview ---------- */

/** The district(s) with the most of the measure outside the leading province — every district tied at that value. */
function outsideLine(insight, home, unit, province) {
  const o = insight.outside;
  if (!o || province || o.value < 2) return '';
  const linkTo = a => `<button type="button" class="link-button" data-action="select-area" data-id="${esc(a.id)}">${esc(placeName(a))}</button> ${esc(provinceName(a.province))}`;
  const tied = o.tied || [o];
  const top = insight.areas[0];
  const lead = `${pic('rank')}อันดับ 1 นอก${esc(home)}`;
  if (tied.length === 1) {
    const more = top && o.value > top.value ? ` · มากกว่าทุก${esc(areaWord(insight.home))}ของ${esc(home)}` : '';
    return `<p class="aha-secondary">${lead}: ${linkTo(tied[0])} ${valueText(o.value, unit)}${more}</p>`;
  }
  const shown = tied.slice(0, 3), rest = tied.length - shown.length;
  return `<p class="aha-secondary">${lead} (เท่ากัน ${num(tied.length)} พื้นที่): ${shown.map(linkTo).join(' · ')}${rest ? ` +${num(rest)}` : ''} · ${valueText(o.value, unit)}</p>`;
}

/** Rail comparison of the Aha as two bars: the focus vs the rest of the province (bases in the title and for screen
 *  readers); hidden when nothing is near rail. */
function railCompare(insight, unit, count, w) {
  const f = insight.rail?.focus, r = insight.rail?.rest;
  if (!f || !r || !f.base || !r.base || !(f.within + r.within)) return '';
  const here = count === 1 ? placeName(insight.areas[0]) : `${num(count)} ${w}นี้`;
  const bar = (label, s) => `<li title="${esc(railDetail(s, unit))}"><span class="mix-label">${esc(label)}</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill rail-fill" style="width:${Math.max(2, Math.round((s.within / s.base) * 100))}%"></span></span>
      <span class="mix-value data-number">${pct(s.within, s.base)}</span><span class="sr-only">${esc(railDetail(s, unit))}</span></li>`;
  return `<div class="aha-rail"><p class="aha-rail-title">${pic('rail')}ใกล้รถไฟฟ้า ≤ 500 ม.</p>
    <ul class="mix-list rail-compare">${bar(here, f)}${bar(`${w}อื่น`, r)}</ul></div>`;
}

/**
 * focusMode: 'auto' (default top districts) · 'explicit' (user-chosen) · 'none' (every district).
 */
/** The Aha block of the overview (any measure): the finding, its numerator and denominator, rail and the outside line. */
function ahaBlock({insight, summary, overview, focusMode, unit, province}) {
  const count = insight.areas.length;
  const w = words(insight.areas);
  const names = insight.areas.map(a => `<button type="button" class="link-button" data-action="select-area" data-id="${esc(a.id)}">${esc(a.name)}</button>`).join(' · ');
  const home = provinceName(insight.home);
  if (!summary.count && focusMode !== 'explicit') {
    return `<section class="aha" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบ</p><h2>ไม่พบ${esc(unit.id === 'learning' ? unit.subject : 'สถานศึกษา')}ตามตัวกรองนี้</h2>
      <div class="aha-actions"><button type="button" data-action="clear-filter" data-id="all" class="btn">ล้างตัวกรอง</button></div></section>`;
  }
  if (focusMode === 'explicit') {
    return `<section class="aha is-focused" aria-label="ข้อค้นพบ"><p class="eyebrow">โฟกัส ${num(count)} ${esc(w)}</p>
      <h2>${insight.areas.map(a => esc(a.name)).join(' · ')}</h2>
      <p class="aha-copy">${valueText(insight.value, unit)}${unit.id === 'students' ? ` · ${nw(`${num(insight.count)} แห่ง`)}` : ''}</p>
      <div class="aha-actions"><button type="button" data-action="clear-focus" class="btn">ดูทุกพื้นที่</button><button type="button" data-action="open-charts" class="btn quiet">เปรียบเทียบพื้นที่</button></div></section>`;
  }
  if (!count && insight.spread) {
    const sw = areaWord(insight.home), sp = insight.spread;
    return `<section class="aha" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบ</p>
      <h2><span class="aha-number data-number">${num(sp.areas)}</span><span class="aha-headline">${esc(sw)}ใน${esc(home)} มี${esc(unit.subject)}เท่ากัน ${esc(sw)}ละ ${num(sp.value)} ${esc(unit.one)}</span></h2>
      ${outsideLine(insight, home, unit, province)}
      <div class="aha-actions"><button type="button" data-action="open-charts" class="btn quiet">เปรียบเทียบพื้นที่</button></div></section>`;
  }
  if (!count) {
    return `<section class="aha" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบ</p><h2><span class="aha-number data-number">${num(summary.count)}</span><span class="aha-headline">แห่ง · ไม่ระบุเขต/อำเภอ</span></h2>
      <div class="aha-actions"><button type="button" data-action="open-table" class="btn">ดูรายชื่อ</button></div></section>`;
  }
  const toggle = focusMode === 'auto'
    ? '<button type="button" data-action="clear-focus" class="btn">ดูทุกพื้นที่</button>'
    : `<button type="button" data-action="explore-top" class="btn primary">โฟกัส ${num(count)} ${esc(w)}นี้</button>`;
  const where = count === 1 ? esc(placeName(insight.areas[0])) : ` ${nw(`${num(count)} ${esc(w)}นี้`)}`;
  const total = insight.homeValue ?? insight.homePlacedValue;
  return `<section class="aha${focusMode === 'auto' ? ' is-auto' : ''}" aria-label="ข้อค้นพบ"><p class="eyebrow">ข้อค้นพบ</p>
      <h2><span class="aha-number data-number">${pct(insight.value, total)}</span><span class="aha-headline">ของ${esc(unit.subject)}${esc(home)} อยู่ใน${where}</span></h2>
      <p class="aha-copy">${names}<br>${nw(`<strong class="data-number">${num(insight.value)}</strong> จาก ${num(total)} ${esc(unit.one)}`)}</p>
      ${railCompare(insight, unit, count, w)}${outsideLine(insight, home, unit, province)}
      <div class="aha-actions">${toggle}<button type="button" data-action="open-charts" class="btn quiet">เปรียบเทียบพื้นที่</button></div></section>`;
}

/** Provinces with the most of the measure (below the Aha of the national overview). */
function provinceListBlock(provinces, unit, unknownProvince) {
  const provinceRows = p => `<li><button type="button" class="province-row" data-action="select-province" data-id="${esc(p.code)}" aria-label="${esc(p.name)} ${num(p.value)} ${esc(unit.one)} กดเพื่อดูจังหวัด"><i class="province-swatch" style="background:${esc(p.fill)}" aria-hidden="true"></i><span class="province-name">${esc(p.name)}</span><span class="province-count data-number">${num(p.value)}<small>${esc(unit.one)}</small></span></button></li>`;
  const shown = provinces.slice(0, 8), rest = provinces.slice(8);
  const unknown = unknownProvince ? `<p class="hint">ไม่ระบุจังหวัด ${nw(`${num(unknownProvince)} แห่ง`)}</p>` : '';
  return provinces.length > 1 ? `<section class="panel-section" aria-labelledby="province-title">
    <div class="section-heading">${heading('province', `จังหวัดที่มี${unit.subject}มากที่สุด`, 'province-title')}<span class="hint">${num(provinces.length)} จังหวัด</span></div>
    <ul class="province-list">${shown.map(provinceRows).join('')}</ul>
    ${rest.length ? `<details class="more-provinces"><summary>อีก ${num(rest.length)} จังหวัด</summary><ul class="province-list">${rest.map(provinceRows).join('')}</ul></details>` : ''}
    ${unknown}</section>` : '';
}

/**
 * focusMode: 'auto' (default top districts) · 'explicit' (user-chosen) · 'none' (every district).
 */
export function renderOverview({insight, summary, overview, focusMode = 'auto', classOf = () => 'var(--scale-count-3)', provinces = [], unknownProvince = 0,
  province = '', affCard = '', stations = [], learning = null, ctx = {}}) {
  const unit = ctx.unit;
  const count = insight.areas.length;
  const w = words(insight.areas);
  const aha = ahaBlock({insight, summary, overview, focusMode, unit, province});
  const narrowed = focusMode !== 'none' && count > 0 && summary.count !== overview.count;
  const metrics = `<section class="metrics" aria-label="${narrowed ? 'ตัวเลขของพื้นที่ที่โฟกัส' : 'ตัวเลขรวมของข้อมูลที่เลือก'}">
    ${studentsTile(summary.students, summary.count, `นักเรียน${narrowed ? ' ในโฟกัส' : ''}`)}
    ${metricTile(summary.count, `แห่ง${narrowed ? ' ในโฟกัส' : ''}`, 'school')}
    ${metricTile(summary.areas, narrowed ? w : 'เขต/อำเภอ', 'area')}
    ${metricTile(summary.provinces, 'จังหวัด', 'province')}
  </section>`;
  const scopeText = province ? provinceName(province) : 'ประเทศไทย';
  const provinceList = provinceListBlock(provinces, unit, unknownProvince);
  const rw = province ? areaWord(province) : 'เขต/อำเภอ';
  const ranking = areaRanking(overview.ranking, classOf, unit, {title: `${rw}ที่มี${unit.subject}มากที่สุด`, note: `${num(overview.ranking.filter(a => a.value > 0).length)} ${rw}`, showProvince: !province});
  const mix = overview.count ? `<section class="panel-section"><div class="section-heading">${heading('segment', 'ประเภทสถานศึกษา')}<span class="hint">${esc(unit.one)}</span></div>${groupBars(overview.mix.byGroup, unit)}</section>` : '';
  const levels = overview.count ? `<section class="panel-section"><div class="section-heading">${heading('level', 'ระดับชั้นที่เปิดสอน')}<span class="hint">แห่ง</span></div>${levelBars(overview.levels)}</section>` : '';
  const sizes = overview.count ? `<section class="panel-section"><div class="section-heading">${heading('students', 'ขนาด')}<span class="hint">แห่ง</span></div>${sizeBars(overview.sizes)}${feeLine(overview.fees)}</section>` : '';
  const affs = overview.affs.length && !affCard ? `<section class="panel-section"><div class="section-heading">${heading('aff', `สังกัดที่มี${unit.subject}มากที่สุด`)}<span class="hint"><button type="button" class="link-button" data-action="open-charts" data-value="affs">ดูทุกสังกัด</button></span></div>${affChips(overview.affs, unit)}</section>` : '';
  const rail = stationRanking(stations, unit, {title: `สถานีที่มี${unit.subject}รอบ ๆ มากที่สุด`});
  const learn = learning?.count ? learningTeaser(learning, scopeText) : '';
  return `${affCard}${aha}${metrics}${provinceList}${ranking}${rail}${mix}${levels}${sizes}${affs}${learn}${affCard ? '' : actionBar({kind: 'overview', province: province ? provinceName(province) : ''})}${provenance(ctx, scopeText, {rail: Boolean(rail || insight.rail?.focus?.within), learn: Boolean(learn)})}`;
}

/* ---------- Empty selections (EVID-05) ---------- */

/**
 * measured_zero: every district is in the roster's national scope, so a district with no record under the filters is
 * a measured 0 of this dataset — offered with where the same filters match. Never "no data".
 */
function selectionNote(p, place, ctx) {
  if (p.coverageState !== 'measured_zero') return '';
  const elsewhere = p.scopeCount > 0
    ? `<span>พบในพื้นที่อื่น <strong class="data-number">${num(p.scopeCount)}</strong> แห่ง</span><button type="button" class="btn quiet" data-action="leave-area">ดูพื้นที่ที่พบ</button>`
    : '';
  return `<div class="empty-note" role="note"><strong>ไม่พบสถานศึกษาใน${esc(place)}${ctx.filtered ? 'ตามตัวกรองนี้' : ''}</strong>${elsewhere}</div>`;
}

/* ---------- District (เขต/อำเภอ) ---------- */

export function renderArea(p, classOf, ctx = {}) {
  if (!p) return '';
  const unit = ctx.unit, a = p.area, w = p.words;
  const place = `${w.area}${a.name}`, prov = provinceName(a.province);
  const rank = p.rank ? `<p class="rank-line">${pic('rank')}อันดับ ${num(p.rank)} จาก ${num(p.rankOf)} ทั่วประเทศ${p.rankProvince && p.rankProvinceOf > 1 ? ` · ${num(p.rankProvince)} จาก ${num(p.rankProvinceOf)} ใน${esc(prov)}` : ''}</p>` : '';
  const listLimit = 30;
  const share = p.count && p.provinceValue ? pct(p.value, p.provinceValue) : '—';
  const shareDetail = p.count && p.provinceValue ? `${num(p.value)} จาก ${num(p.provinceValue)} ${unit.one}ของ${prov}` : '';
  const railShare = p.rail?.base ? pct(p.rail.within, p.rail.base) : '—';
  const head = `<section class="detail-head">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <p class="eyebrow">${esc(w.area)} · <button type="button" class="link-button" data-action="select-province" data-id="${esc(a.province)}">${esc(prov)}</button></p>
      <h2>${esc(place)}</h2>${a.nameEn ? (LANG === 'en' ? `<p class="subtle" lang="th" translate="no">${esc(place)}</p>` : `<p class="subtle">${esc(a.nameEn)}</p>`) : ''}
      ${rank}
      <div class="metrics compact">${studentsTile(p.students, p.count)}${metricTile(p.count, 'แห่ง', 'school')}${metricTile(share, `ของ${prov}`, 'province', shareDetail)}${metricTile(railShare, 'ใกล้รถไฟฟ้า', 'rail', p.rail?.base ? railDetail(p.rail, unit) : '')}</div>
      ${selectionNote(p, place, ctx)}
      ${actionBar({kind: 'area', area: {place, province: prov}})}
      <div class="detail-actions">${p.count ? '<button type="button" class="btn" data-action="open-table">ดูรายชื่อ</button><button type="button" class="btn quiet" data-action="open-charts">เปรียบเทียบพื้นที่</button>' : ''}${link(productionLink({province: a.province, area: a.id}), 'ดูใน CityMETER', 'btn quiet source-link')}</div>
    </section>
`;
  const boundary = `${place} ${prov}`;
  if (!p.count) return `${head}${provenance(ctx, boundary)}`;
  const affs = p.affs.length ? `<section class="panel-section"><div class="section-heading">${heading('aff', 'สังกัด')}<span class="hint">${esc(unit.one)}</span></div>${affChips(p.affs, unit)}</section>` : '';
  return `${head}    <section class="panel-section"><div class="section-heading">${heading('segment', 'ประเภทสถานศึกษา')}<span class="hint">${esc(unit.one)}</span></div>${groupBars(p.byGroup, unit)}</section>
    <section class="panel-section"><div class="section-heading">${heading('level', 'ระดับชั้นที่เปิดสอน')}<span class="hint">แห่ง</span></div>${levelBars(p.levels)}</section>
    <section class="panel-section"><div class="section-heading">${heading('students', 'ขนาด')}<span class="hint">แห่ง</span></div>${sizeBars(p.sizes)}${feeLine(p.fees)}</section>
    ${stationRanking(p.stations, unit, {title: 'สถานีใกล้สถานศึกษา'})}
    ${affs}
    ${learningSection(p.learning, {place})}
    <section class="panel-section"><div class="section-heading">${heading('school', 'สถานศึกษา')}<span class="hint">เรียงตามนักเรียน</span></div>${schoolList(p.rows.slice(0, listLimit))}
      ${p.count > listLimit ? moreButton(p.count) : ''}</section>
    ${provenance(ctx, boundary, {rail: Boolean(p.rail?.base), learn: Boolean(p.learning?.count)})}`;
}

/* ---------- Station (CityMETER · Transit) ---------- */

export function renderStation(p, ctx = {}) {
  if (!p) return '';
  const unit = ctx.unit, s = p.station;
  const building = s.status !== 'operating';
  const listLimit = 40;
  const head = `<section class="detail-head station">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <div class="identity">${pic('rail', 'identity-pic')}<div>
        <p class="eyebrow">สถานีรถไฟฟ้า${s.lines?.length ? ` · ${esc(s.lines.join(' · '))}` : ''}${building ? ` · ${pic('construction')}กำลังสร้าง` : ''}</p>
        <h2>สถานี${esc(s.name)}</h2>${s.nameEn ? (LANG === 'en' ? `<p class="subtle" lang="th" translate="no">สถานี${esc(s.name)}</p>` : `<p class="subtle">${esc(s.nameEn)}</p>`) : ''}</div></div>
      <div class="metrics compact">${studentsTile(p.students, p.count)}${metricTile(p.count, 'แห่ง', 'school')}${metricTile(p.radius, 'ม. รอบสถานี', 'distance', `ระยะตรงจากจุดอ้างอิงของสถานี ${meters(p.radius)}`)}</div>
      ${actionBar({kind: 'station', station: s, point: {lat: s.lat, lon: s.lon, role: 'station'}})}
      <div class="detail-actions">${link(stationLink(s), 'ดูใน CityMETER Transit', 'btn quiet source-link')}</div>
    </section>
`;
  const boundary = `รัศมี ${meters(p.radius)} จากสถานี${s.name}`;
  if (!p.count) return `${head}<div class="empty-note" role="note"><strong>ไม่พบสถานศึกษารอบสถานีนี้</strong></div>${provenance(ctx, boundary, {rail: true})}`;
  return `${head}    <section class="panel-section"><div class="section-heading">${heading('segment', 'ประเภทสถานศึกษา')}<span class="hint">${esc(unit.one)}</span></div>${groupBars(p.byGroup, unit)}</section>
    <section class="panel-section"><div class="section-heading">${heading('level', 'ระดับชั้นที่เปิดสอน')}<span class="hint">แห่ง</span></div>${levelBars(p.levels)}</section>
    <section class="panel-section"><div class="section-heading">${heading('school', 'สถานศึกษา')}<span class="hint">เรียงตามนักเรียน</span></div>${schoolList(p.rows.slice(0, listLimit), {showArea: true, index: ctx.index, distance: p.distance})}
      ${p.count > listLimit ? moreButton(p.count) : ''}</section>
    ${learningStationLine(p.learning)}
    ${provenance(ctx, boundary, {rail: true, learn: Boolean(p.learning?.count)})}`;
}

/* ---------- Building (display-time spatial join) ---------- */

/** Where a drawn building's outline and height come from (the Hotel rule of 2026-11-01, point 3: per อปท./เขต). */
export const BUILDING_SOURCE_TH = Object.freeze({osm: 'OpenStreetMap', cm: 'CityMETER Building V4'});

export function renderBuilding(b, ctx = {}) {
  if (!b) return '';
  const w = b.words;
  const area = b.area ? `${w.area}${b.area.name}` : '';
  const source = BUILDING_SOURCE_TH[b.kind] || BUILDING_SOURCE_TH.osm;
  // “สูงราว”: a CityMETER height is the dataset's model estimate, an OSM height a tag or the schema's default; the
  // source is named in the title and in the provenance line.
  const height = b.height != null ? `<span title="ความสูงจาก ${esc(source)}">สูงราว ${num(Math.round(b.height))} ม.</span>` : '';
  const withPoint = b.rows.find(hasPoint);
  return `<section class="detail-head building">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <p class="eyebrow">${pic('building')} ${b.area ? `<button type="button" class="link-button" data-action="select-area" data-id="${esc(b.area.id)}">${esc(area)}</button>` : 'อาคาร'}${height ? ` · ${height}` : ''}</p>
      <h2>สถานศึกษาในอาคารนี้</h2>
      <div class="metrics compact">${studentsTile(b.students, b.count)}${metricTile(b.count, 'แห่ง', 'school')}</div>
      ${actionBar({kind: 'building', rows: b.rows, area: b.area ? {place: area, province: provinceName(b.area.province)} : null,
        point: withPoint ? {lat: withPoint.latitude, lon: withPoint.longitude, role: 'point'} : null})}
    </section>
    <section class="panel-section"><div class="section-heading">${heading('school', 'สถานศึกษา')}<span class="hint">${num(b.count)}</span></div>${schoolList(b.rows.slice(0, 40), {showArea: b.areaCount > 1, index: ctx.index})}
      ${b.count > 40 ? moreButton(b.count) : ''}</section>
    ${provenance(ctx, `หมุดในขอบอาคาร ${source}${area ? ` · ${area}` : ''}`)}`;
}

/* ---------- School ---------- */

/** Comparison set: the rule as chips (group · levels · radius), nearest first, and everything round the school. */
function compsetSection(c, group) {
  if (!c) return '';
  const levelNames = c.rule.levels.map(id => LEVELS.find(l => l.id === id)?.th).filter(Boolean);
  const rule = [`${pic('segment')}${esc(group || 'ประเภทเดียวกัน')}`, levelNames.length ? `${pic('level')}${esc(levelNames.join(' · '))}` : '',
    `${pic('distance')}≤ ${esc(meters(c.radius))}`].filter(Boolean).map(t => `<span class="rule-chip">${t}</span>`).join('');
  const ruleTitle = levelNames.length ? `ประเภทเดียวกัน เปิดสอนระดับชั้นเดียวกันอย่างน้อยหนึ่งระดับ ในระยะตรง ${meters(c.radius)} เรียงใกล้ก่อน` : `ประเภทเดียวกัน ในระยะตรง ${meters(c.radius)} เรียงใกล้ก่อน`;
  const list = c.rows.length
    ? `<ul class="outlet-list compset">${c.rows.map(({row: r, m}) => `<li><button type="button" class="brand-row" data-action="select-school" data-id="${esc(r.id)}">${cueMarkup(r.series, {className: 'row-cue'})}<span class="row-text"><strong>${esc(r.name || r.nameEn)}</strong><span class="row-meta">${esc([meters(m), studentsText(r), gradeRange(r), r.fee ? `${feeText(r.fee)}/ปี` : ''].filter(Boolean).join(' · '))}</span></span></button></li>`).join('')}</ul>`
    : '<p class="hint">ไม่พบสถานศึกษาตามเกณฑ์นี้</p>';
  return `<section class="panel-section"><div class="section-heading">${heading('compare', 'คู่เทียบ')}<span class="hint">${num(c.matches)} แห่ง</span></div>
    <p class="rule-chips" title="${esc(ruleTitle)}">${rule}</p>${list}
    <p class="fact-line">${pic('school', 'fact-icon')}สถานศึกษาทุกประเภทรอบ ${esc(meters(c.radius))} ${nw(`<strong class="data-number">${num(c.around.count)}</strong> แห่ง`)} · ${nw(`${num(c.around.students)} คน`)}</p></section>`;
}

/** Tuition per grade as the school announced it (20_SCHOOL_FEES, tuition only, the summary's academic year). */
function feeSection(r) {
  const f = r.fee;
  if (!f) return '';
  const items = f.items.length ? `<ul class="fee-list">${f.items.map(([scope, v, programme, campus]) => `<li><span class="fee-scope">${esc(scope)}${programme || campus ? `<small>${esc([programme, campus].filter(Boolean).join(' · '))}</small>` : ''}</span><span class="fee-value data-number">${esc(baht(v))}</span></li>`).join('')}</ul>${f.more ? `<p class="hint">อีก ${num(f.more)} รายการในประกาศ</p>` : ''}` : '';
  return `<section class="panel-section"><div class="section-heading">${heading('fee', 'ค่าเรียนต่อปี')}<span class="hint">ปีการศึกษา ${esc(f.year)}</span></div>
    <p class="fee-range"><strong class="data-number">${esc(feeText(f))}</strong> <span>ต่อคนต่อปี · ค่าเรียน</span></p>
    ${items}
    <p class="links">${link(f.url, 'ประกาศของโรงเรียน')}</p></section>`;
}

/** The ONESQA result the sheet selected, verbatim, with its year. */
function qualitySection(r) {
  const q = r.quality;
  if (!q) return '';
  return `<section class="panel-section"><div class="section-heading">${heading('quality', 'ผลประเมินภายนอก')}<span class="hint">สมศ. · ${esc(q.year)}</span></div>
    <ul class="quality-list">${q.lines.map(line => `<li>${esc(line)}</li>`).join('')}</ul>
    <p class="links">${link(q.url, 'ข้อมูลเปิด สมศ.')}</p></section>`;
}

/** Curriculum and accreditation as the sheet summarises them (international schools). */
function programmeSection(r) {
  if (!r.curriculum && !r.accreditation) return '';
  const parts = v => v.split(';').map(x => x.trim()).filter(Boolean);
  const chips = [...parts(r.curriculum).map(x => `<span class="fact-chip" title="หลักสูตร">${pic('programme')}${esc(x)}</span>`),
    ...parts(r.accreditation).map(x => `<span class="fact-chip" title="การรับรองสถาบัน">${pic('quality')}${esc(x)}</span>`)].join('');
  return `<section class="panel-section"><div class="section-heading">${heading('programme', 'หลักสูตรและการรับรอง')}</div><div class="fact-chips">${chips}</div></section>`;
}

/** Students per semester (OPEC snapshots B.E. 2565–2567) as bars; a period without a value is a dash, never 0. */
function historySection(h) {
  if (!h) return '';
  const max = Math.max(1, ...h.map(p => p.value || 0));
  return `<section class="panel-section"><div class="section-heading">${heading('history', 'นักเรียนย้อนหลัง')}<span class="hint">สช. · ภาคเรียน</span></div>
    <ul class="mix-list history-list" aria-label="นักเรียนรายภาคเรียน">${h.map(p => `<li><span class="mix-label">${esc(periodText(p.period))}</span>
      <span class="mix-track" aria-hidden="true">${p.value ? `<span class="mix-fill size-fill" style="width:${Math.max(3, Math.round((p.value / max) * 100))}%"></span>` : ''}</span>
      <span class="mix-value data-number">${p.value ? num(p.value) : '—'}</span></li>`).join('')}</ul></section>`;
}

export function renderSchool(d, ctx = {}) {
  if (!d) return '';
  const r = d.row, w = d.words;
  const prov = provinceName(r.province);
  const coords = hasPoint(r) ? `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}` : '';
  const areaChip = d.area
    ? `<button type="button" class="fact-chip" data-action="select-area" data-id="${esc(d.area.id)}">${pic('area')}${esc(w.area)}${esc(d.area.name)} · ${esc(prov)}</button>`
    : r.province ? `<button type="button" class="fact-chip" data-action="select-province" data-id="${esc(r.province)}">${pic('province')}${esc(prov)}</button>` : '<span class="fact-chip is-quiet">ไม่ระบุจังหวัด</span>';
  const size = SIZE_BANDS.find(b => b.id === r.size);
  const studentsChip = `<span class="fact-chip"${size ? ` title="นักเรียน · ขนาด ${esc(size.th)}"` : ''}>${pic('students')}${esc(studentsText(r))}</span>`;
  const grades = gradeRange(r);
  const gradeChip = grades ? `<span class="fact-chip" title="ระดับชั้นที่เปิดสอน">${pic('level')}${esc(grades)}</span>` : '';
  const teacherChip = r.teachers ? `<span class="fact-chip" title="ครู">${pic('teacher')}${nw(`ครู ${num(r.teachers)} คน`)}</span>` : '';
  const roomChip = r.classrooms ? `<span class="fact-chip" title="ห้องเรียน">${pic('classroom')}${nw(`${num(r.classrooms)} ห้องเรียน`)}</span>` : '';
  const feeChip = r.fee ? `<span class="fact-chip" title="ค่าเรียนต่อคนต่อปี ปีการศึกษา ${esc(r.fee.year)}">${pic('fee')}${esc(feeText(r.fee))}/ปี</span>` : '';
  const affChip = r.aff ? `<button type="button" class="fact-chip" data-action="filter-aff" data-value="${esc(r.aff.id)}" title="${esc(r.aff.th)} (ดูทุกสถานศึกษาของสังกัดนี้)">${pic('aff')}${esc(r.aff.short)}</button>` : '';
  const railChip = r.rail ? `<button type="button" class="fact-chip" data-action="select-station" data-id="${esc(r.rail.station.id)}" title="สถานีที่เปิดแล้วที่ใกล้ที่สุด · ระยะตรง">${pic('rail')}${esc(stationShort(r.rail.station))} ${nw(esc(meters(r.rail.m)))}</button>` : '';
  const nextChip = r.railNext && (!r.rail || r.railNext.m < r.rail.m)
    ? `<span class="fact-chip" title="สถานีที่กำลังสร้างที่ใกล้ที่สุด · ระยะตรง">${pic('construction')}${esc(stationShort(r.railNext.station))} ${nw(esc(meters(r.railNext.m)))} · กำลังสร้าง</span>` : '';
  const closedChip = r.closed ? `<span class="fact-chip is-closed" title="ประกาศปิดของโรงเรียน">${pic('closed')}ประกาศปิด${r.closed.on ? ` ${esc(thaiDate(r.closed.on))}` : ''}</span>` : '';
  const bd = d.building;
  const buildingChip = bd?.others ? `<button type="button" class="fact-chip" data-action="select-building" data-id="${esc(bd.key)}" title="หมุดของสถานศึกษาอีก ${num(bd.others)} แห่งอยู่ในอาคารนี้บนแผนที่">${pic('building')}อีก ${num(bd.others)} แห่งในอาคารนี้</button>` : '';
  const point = coords
    ? `<span class="data-number">${esc(coords)}</span>${r.coordRole ? `<br><span class="hint">${esc(r.coordRole)}</span>` : ''}`
    : '<span>ไม่มีพิกัด</span>';
  const kindText = r.kind && !r.kind.startsWith('โรงเรียน/') ? r.kind.replace(/^สช\. · /, '') : '';
  const kind = kindText && !(d.group?.th || '').includes(kindText) ? kindText : '';
  return `<section class="detail-head store">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <div class="identity"><span class="identity-cue">${cueMarkup(r.series)}</span><div>
        <p class="eyebrow eyebrow-cue">${esc(d.group?.th || '')}${kind ? ` · ${esc(kind)}` : ''}</p>
        <h2>${esc(r.name || r.nameEn || 'ไม่มีชื่อ')}</h2>
        ${subLine(r, 'branch-name', 'p')}</div></div>
      <div class="fact-chips">${closedChip}${studentsChip}${gradeChip}${teacherChip}${roomChip}${feeChip}${affChip}${areaChip}${railChip}${nextChip}${buildingChip}${coords ? '' : '<span class="fact-chip is-quiet">ไม่มีพิกัด</span>'}</div>
      ${actionBar({kind: 'school', row: r, area: d.area ? {place: `${w.area}${d.area.name}`, province: prov} : r.province ? {place: '', province: prov} : null,
        point: hasPoint(r) ? {lat: r.latitude, lon: r.longitude, role: 'point'} : null})}
      <details class="source-details"><summary>ที่มาและพิกัด</summary>
        <dl class="facts">
          <dt>แหล่ง</dt><dd>${esc(r.source?.th || 'CityMETER School')}${r.url ? ` · ${link(r.url, 'หน้าทะเบียน สช.')}` : ''}</dd>
          <dt>สังกัด</dt><dd>${esc(r.aff?.th || '')}</dd>
          <dt>พื้นที่</dt><dd>${esc(ADMIN_TH[r.admin] || '')}</dd>
          <dt>พิกัด</dt><dd>${point}</dd>
          ${r.feeEvidence ? `<dt>ค่าธรรมเนียม</dt><dd>${link(r.feeEvidence, 'หลักฐานค่าธรรมเนียมบางรายการ')}</dd>` : ''}
          ${r.closed?.url ? `<dt>สถานะ</dt><dd>${link(r.closed.url, 'ประกาศปิด')}</dd>` : ''}
          <dt>รหัส</dt><dd><span class="hint data-number">${esc(r.id)}</span></dd>
        </dl>
        <p class="links">${d.area ? link(productionLink({province: r.province, area: r.area}), 'ดูพื้นที่นี้ใน CityMETER') : ''}</p>
      </details>
    </section>
    ${feeSection(r)}
    ${historySection(d.history)}
    ${qualitySection(r)}
    ${programmeSection(r)}
    ${hasPoint(r) ? `<section class="panel-section terrain-section"><div class="section-heading">${heading('elevation', 'ภูมิประเทศ')}</div>
      <div class="fact-chips terrain-chips" data-terrain-for="${esc(r.id)}"><span class="hint">กำลังอ่านภูมิประเทศ</span></div></section>` : ''}
    ${compsetSection(d.compset, d.group?.th)}
    ${learningSection(d.learning, {place: d.area ? `${w.area}${d.area.name}` : '', near: hasPoint(r)})}
    ${provenance(ctx, d.area ? `${w.area}${d.area.name} ${prov}` : prov || 'ไม่ระบุจังหวัด', {rail: Boolean(r.rail || r.railNext), terrain: hasPoint(r),
      opec: Boolean(r.url || d.history), onesqa: Boolean(r.quality), fees: Boolean(r.fee), learn: Boolean(d.learning?.count || d.learning?.nearCount)})}`;
}

/** Terrain chips (js/shell/terrain.js#terrainChips) as fact chips; '' when nothing is known. */
export function terrainChipsHTML(chips) {
  return chips.map(c => `<span class="fact-chip" title="${esc(c.title)}">${pic(c.kind)}${esc(c.text)}</span>`).join('');
}

/* ---------- Active filter chips ---------- */

export function renderFilterChips(values, labels) {
  const chips = [];
  const push = (key, text) => chips.push(`<li><button type="button" class="filter-chip" data-action="clear-filter" data-id="${esc(key)}" aria-label="ล้างตัวกรอง ${esc(text)}"><span>${esc(text)}</span><i aria-hidden="true">×</i></button></li>`);
  if (values.search) push('search', `ค้นหา “${values.search}”`);
  if (values.group) push('group', labels.group[values.group] || values.group);
  if (values.level) push('level', values.level === 'unknown' ? 'ไม่ทราบระดับชั้น' : `เปิดสอน${labels.level[values.level] || values.level}`);
  if (values.size) push('size', labels.size[values.size] || values.size);
  if (values.province) push('province', labels.province[values.province] || values.province);
  if (values.aff) push('aff', labels.aff[values.aff] || values.aff);
  if (values.service) push('service', `เรียนเสริม · ${labels.service?.[values.service] || values.service}`);
  return chips.length ? `<ul class="filter-chips" aria-label="ตัวกรองที่ใช้อยู่">${chips.join('')}<li><button type="button" class="filter-chip clear-all" data-action="clear-filter" data-id="all">ล้างทั้งหมด</button></li></ul>` : '';
}

/* ---------- Learning services (เรียนเสริม, 0.2.0; js/learning.js) ---------- */

/** "กวดวิชา · ภาษา" for a record. */
export const servicesText = r => (r?.serviceNames || []).join(' · ');

/**
 * Records per service as bars with the service pictogram (services overlap: a record with two services is in both,
 * the heading's total counts it once). Each bar opens the learning measure filtered to that service.
 */
function serviceBars(services, {label = 'บริการเรียนเสริม (แห่ง)'} = {}) {
  const list = services.filter(s => s.count > 0);
  if (!list.length) return '';
  const max = Math.max(1, ...list.map(s => s.count));
  return `<ul class="mix-list service-list" aria-label="${esc(label)}">${list.map(s => `
    <li><button type="button" class="mix-row" data-action="filter-service" data-value="${esc(s.id)}" title="ดูเฉพาะ${esc(s.th)}บนแผนที่"><span class="mix-label">${pic(SERVICE_PICTOGRAM[s.id] || 'learning', 'mix-pic')}${esc(s.th)}</span>
      <span class="mix-track" aria-hidden="true"><span class="mix-fill category-${LEARNING_SERIES}" style="width:${Math.max(3, Math.round((s.count / max) * 100))}%"></span></span>
      <span class="mix-value data-number">${num(s.count)}</span></button></li>`).join('')}</ul>`;
}

/** Learning records: ring cue + name, then services · where · distance. */
export function learningList(rows, {distance = null, showArea = false, index = null} = {}) {
  return `<ul class="outlet-list learning-list">${rows.map(r => {
    const area = showArea && index && r.area ? index.byId.get(r.area) : null;
    const d = distance?.get?.(r.id);
    const meta = [servicesText(r), area ? placeName(area) : '', Number.isFinite(d) ? meters(d) : ''].filter(Boolean).join(' · ');
    return `<li><button type="button" class="brand-row" data-action="select-school" data-id="${esc(r.id)}">${cueMarkup(r.series, {className: 'row-cue'})}<span class="row-text"><strong>${esc(r.name || r.nameEn || 'ไม่มีชื่อ')}</strong><span class="row-meta">${esc(meta)}</span></span></button></li>`;
  }).join('')}</ul>`;
}

/**
 * The learning context of a school, district or station view: the records the register lists in the district (by
 * service) and, round a school's point, those with a published point within the radius (nearest first).
 */
function learningSection(lc, {place = '', near = false} = {}) {
  if (!lc || (!lc.count && !lc.nearCount)) return '';
  const nearList = near && lc.near.length
    ? `<p class="fact-line">${pic('distance', 'fact-icon')}มีหมุดในระยะ ${esc(meters(lc.radius))} ${nw(`<strong class="data-number">${num(lc.nearCount)}</strong> แห่ง`)}</p>${learningList(lc.near.map(x => x.row), {distance: new Map(lc.near.map(x => [x.row.id, x.m]))})}`
    : '';
  const inArea = lc.count ? `<p class="fact-line">${pic('learning', 'fact-icon')}${place ? `ใน${esc(place)} ` : ''}${nw(`<strong class="data-number">${num(lc.count)}</strong> แห่ง`)}</p>${serviceBars(lc.services)}` : '';
  return `<section class="panel-section learning-section"><div class="section-heading">${heading('learning', 'เรียนเสริม')}<span class="hint">ทะเบียน สช.</span></div>
    ${inArea}${nearList}
    <p class="links"><button type="button" class="link-button" data-action="set-metric" data-value="learning">ดูเรียนเสริมบนแผนที่</button></p></section>`;
}

/** Round a station: learning records with a published point within its radius. */
function learningStationLine(l) {
  if (!l?.count) return '';
  return `<section class="panel-section learning-section"><div class="section-heading">${heading('learning', 'เรียนเสริม')}<span class="hint">มีหมุด · ≤ ${esc(meters(l.radius))}</span></div>
    <p class="fact-line">${pic('learning', 'fact-icon')}${nw(`<strong class="data-number">${num(l.count)}</strong> แห่ง`)}</p>${serviceBars(l.services)}
    <p class="links"><button type="button" class="link-button" data-action="set-metric" data-value="learning">ดูเรียนเสริมบนแผนที่</button></p></section>`;
}

/** The overview under a school measure: how many learning records the selection's place has, one tap to the map. */
function learningTeaser(l, scopeText) {
  return `<section class="panel-section learning-section"><div class="section-heading">${heading('learning', 'เรียนเสริม')}<span class="hint">ทะเบียน สช.</span></div>
    <p class="fact-line">${pic('learning', 'fact-icon')}${esc(scopeText)} ${nw(`<strong class="data-number">${num(l.count)}</strong> แห่ง`)}</p>${serviceBars(l.services)}
    <p class="links"><button type="button" class="btn quiet" data-action="set-metric" data-value="learning">ดูเรียนเสริมบนแผนที่</button></p></section>`;
}

/** Overview under the learning measure (same Aha contract as the schools: share of the province, rail, outside). */
export function renderLearningOverview({insight, summary, overview, focusMode = 'auto', classOf = () => 'var(--scale-count-3)', provinces = [], unknownProvince = 0,
  province = '', stations = [], ctx = {}}) {
  const unit = ctx.unit;
  const count = insight.areas.length;
  const w = words(insight.areas);
  const aha = ahaBlock({insight, summary, overview, focusMode, unit, province});
  const narrowed = focusMode !== 'none' && count > 0 && summary.count !== overview.count;
  const metrics = `<section class="metrics" aria-label="${narrowed ? 'ตัวเลขของพื้นที่ที่โฟกัส' : 'ตัวเลขรวมของข้อมูลที่เลือก'}">
    ${metricTile(summary.count, `แห่ง${narrowed ? ' ในโฟกัส' : ''}`, 'learning')}
    ${metricTile(summary.points, 'มีหมุด', 'maps', `${num(summary.points)} จาก ${num(summary.count)} แห่งมีพิกัดในเขต/อำเภอตามทะเบียน`)}
    ${metricTile(summary.areas, narrowed ? w : 'เขต/อำเภอ', 'area')}
    ${metricTile(summary.provinces, 'จังหวัด', 'province')}
  </section>`;
  const scopeText = province ? provinceName(province) : 'ประเทศไทย';
  const rw = province ? areaWord(province) : 'เขต/อำเภอ';
  const ranking = areaRanking(overview.ranking, classOf, unit, {title: `${rw}ที่มี${unit.subject}มากที่สุด`, note: `${num(overview.ranking.filter(a => a.value > 0).length)} ${rw}`, showProvince: !province});
  const services = overview.count ? `<section class="panel-section"><div class="section-heading">${heading('learning', 'บริการ')}<span class="hint">แห่ง</span></div>${serviceBars(overview.services)}</section>` : '';
  const rail = stationRanking(stations, unit, {title: `สถานีที่มี${unit.subject}รอบ ๆ มากที่สุด`});
  return `${aha}${metrics}${provinceListBlock(provinces, unit, unknownProvince)}${ranking}${services}${rail}${actionBar({kind: 'learning-overview', province: province ? provinceName(province) : ''})}${provenance(ctx, scopeText, {learnOnly: true, provider: overview.providers > 0, rail: Boolean(rail || insight.rail?.focus?.within)})}`;
}

/** A district under the learning measure. */
export function renderLearningArea(p, classOf, ctx = {}) {
  if (!p) return '';
  const unit = ctx.unit, a = p.area, w = p.words;
  const place = `${w.area}${a.name}`, prov = provinceName(a.province);
  const rank = p.rank ? `<p class="rank-line">${pic('rank')}อันดับ ${num(p.rank)} จาก ${num(p.rankOf)} ทั่วประเทศ${p.rankProvince && p.rankProvinceOf > 1 ? ` · ${num(p.rankProvince)} จาก ${num(p.rankProvinceOf)} ใน${esc(prov)}` : ''}</p>` : '';
  const share = p.count && p.provinceValue ? pct(p.value, p.provinceValue) : '—';
  const shareDetail = p.count && p.provinceValue ? `${num(p.value)} จาก ${num(p.provinceValue)} แห่งของ${prov}` : '';
  const listLimit = 30;
  const head = `<section class="detail-head">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <p class="eyebrow">${esc(w.area)} · <button type="button" class="link-button" data-action="select-province" data-id="${esc(a.province)}">${esc(prov)}</button></p>
      <h2>${esc(place)}</h2>${a.nameEn ? (LANG === 'en' ? `<p class="subtle" lang="th" translate="no">${esc(place)}</p>` : `<p class="subtle">${esc(a.nameEn)}</p>`) : ''}
      ${rank}
      <div class="metrics compact">${metricTile(p.count, 'แห่ง', 'learning')}${metricTile(p.points, 'มีหมุด', 'maps', `${num(p.points)} จาก ${num(p.count)} แห่งมีพิกัดในเขต/อำเภอนี้ตามทะเบียน`)}${metricTile(share, `ของ${prov}`, 'province', shareDetail)}${metricTile(p.rail?.base ? pct(p.rail.within, p.rail.base) : '—', 'ใกล้รถไฟฟ้า', 'rail', p.rail?.base ? railDetail(p.rail, unit) : '')}</div>
      ${p.coverageState === 'measured_zero' ? `<div class="empty-note" role="note"><strong>ไม่พบสถานที่เรียนเสริมใน${esc(place)}${ctx.filtered ? 'ตามตัวกรองนี้' : ''}</strong>${p.scopeCount ? `<span>พบในพื้นที่อื่น <strong class="data-number">${num(p.scopeCount)}</strong> แห่ง</span><button type="button" class="btn quiet" data-action="leave-area">ดูพื้นที่ที่พบ</button>` : ''}</div>` : ''}
      ${actionBar({kind: 'learning-area', area: {place, province: prov}})}
      <div class="detail-actions">${p.count ? '<button type="button" class="btn" data-action="open-table">ดูรายชื่อ</button><button type="button" class="btn quiet" data-action="open-charts">เปรียบเทียบพื้นที่</button>' : ''}<button type="button" class="btn quiet" data-action="set-metric" data-value="students">ดูนักเรียนในเขตนี้</button></div>
    </section>
`;
  const boundary = `${place} ${prov}`;
  if (!p.count) return `${head}${provenance(ctx, boundary, {learnOnly: true})}`;
  return `${head}    <section class="panel-section"><div class="section-heading">${heading('learning', 'บริการ')}<span class="hint">แห่ง</span></div>${serviceBars(p.services)}</section>
    ${stationRanking(p.stations, unit, {title: 'สถานีใกล้สถานที่เรียนเสริม'})}
    <section class="panel-section"><div class="section-heading">${heading('learning', 'สถานที่เรียนเสริม')}<span class="hint">ทะเบียน สช.</span></div>${learningList(p.rows.slice(0, listLimit))}
      ${p.count > listLimit ? moreButton(p.count) : ''}</section>
    ${provenance(ctx, boundary, {learnOnly: true, provider: p.rows.some(r => r.source === 'provider'), rail: Boolean(p.rail?.base)})}`;
}

/** A station under the learning measure: records with a published point within its radius. */
export function renderLearningStation(p, ctx = {}) {
  if (!p) return '';
  const s = p.station;
  const building = s.status !== 'operating';
  const head = `<section class="detail-head station">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <div class="identity">${pic('rail', 'identity-pic')}<div>
        <p class="eyebrow">สถานีรถไฟฟ้า${s.lines?.length ? ` · ${esc(s.lines.join(' · '))}` : ''}${building ? ` · ${pic('construction')}กำลังสร้าง` : ''}</p>
        <h2>สถานี${esc(s.name)}</h2>${s.nameEn ? (LANG === 'en' ? `<p class="subtle" lang="th" translate="no">สถานี${esc(s.name)}</p>` : `<p class="subtle">${esc(s.nameEn)}</p>`) : ''}</div></div>
      <div class="metrics compact">${metricTile(p.count, 'แห่ง', 'learning')}${metricTile(p.radius, 'ม. รอบสถานี', 'distance', `ระยะตรงจากจุดอ้างอิงของสถานี ${meters(p.radius)}`)}</div>
      ${actionBar({kind: 'learning-station', station: s, point: {lat: s.lat, lon: s.lon, role: 'station'}})}
      <div class="detail-actions">${link(stationLink(s), 'ดูใน CityMETER Transit', 'btn quiet source-link')}</div>
    </section>
`;
  const boundary = `รัศมี ${meters(p.radius)} จากสถานี${s.name}`;
  if (!p.count) return `${head}<div class="empty-note" role="note"><strong>ไม่พบสถานที่เรียนเสริมที่มีหมุดรอบสถานีนี้</strong></div>${provenance(ctx, boundary, {learnOnly: true, rail: true})}`;
  return `${head}    <section class="panel-section"><div class="section-heading">${heading('learning', 'บริการ')}<span class="hint">แห่ง</span></div>${serviceBars(p.services)}</section>
    <section class="panel-section"><div class="section-heading">${heading('learning', 'สถานที่เรียนเสริม')}<span class="hint">ใกล้ก่อน</span></div>${learningList(p.rows.slice(0, 40), {showArea: true, index: ctx.index, distance: p.distance})}
      ${p.count > 40 ? moreButton(p.count) : ''}</section>
    ${provenance(ctx, boundary, {learnOnly: true, rail: true})}`;
}

/** A drawn building with the learning records whose pins fall in its outline. */
export function renderLearningBuilding(b, ctx = {}) {
  if (!b) return '';
  const w = b.words;
  const area = b.area ? `${w.area}${b.area.name}` : '';
  const source = BUILDING_SOURCE_TH[b.kind] || BUILDING_SOURCE_TH.osm;
  const height = b.height != null ? `<span title="ความสูงจาก ${esc(source)}">สูงราว ${num(Math.round(b.height))} ม.</span>` : '';
  const withPoint = b.rows.find(hasPoint);
  return `<section class="detail-head building">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <p class="eyebrow">${pic('building')} ${b.area ? `<button type="button" class="link-button" data-action="select-area" data-id="${esc(b.area.id)}">${esc(area)}</button>` : 'อาคาร'}${height ? ` · ${height}` : ''}</p>
      <h2>สถานที่เรียนเสริมในอาคารนี้</h2>
      <div class="metrics compact">${metricTile(b.count, 'แห่ง', 'learning')}</div>
      ${actionBar({kind: 'building', rows: b.rows, area: b.area ? {place: area, province: provinceName(b.area.province)} : null,
        point: withPoint ? {lat: withPoint.latitude, lon: withPoint.longitude, role: 'point'} : null})}
    </section>
    <section class="panel-section"><div class="section-heading">${heading('learning', 'บริการ')}<span class="hint">แห่ง</span></div>${serviceBars(b.services)}</section>
    <section class="panel-section"><div class="section-heading">${heading('learning', 'สถานที่เรียนเสริม')}<span class="hint">${num(b.count)}</span></div>${learningList(b.rows.slice(0, 40), {showArea: b.areaCount > 1, index: ctx.index})}</section>
    ${provenance(ctx, `หมุดในขอบอาคาร ${source}${area ? ` · ${area}` : ''}`, {learnOnly: true})}`;
}

/** One learning record: services, the register's type, its district and rail, the schools round it. */
export function renderLearning(d, ctx = {}) {
  if (!d) return '';
  const r = d.row, w = d.words;
  const prov = provinceName(r.province);
  const coords = hasPoint(r) ? `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}` : '';
  const serviceChips = r.services.map((id, i) => `<button type="button" class="fact-chip" data-action="filter-service" data-value="${esc(id)}" title="ดูเฉพาะ${esc(r.serviceNames[i])}บนแผนที่">${pic(SERVICE_PICTOGRAM[id] || 'learning')}${esc(r.serviceNames[i])}</button>`).join('');
  const typeChip = r.type ? `<span class="fact-chip" title="ประเภทในทะเบียนโรงเรียนนอกระบบ สช.">${pic('segment')}สช. · ${esc(r.type)}</span>` : '';
  const areaChip = d.area
    ? `<button type="button" class="fact-chip" data-action="select-area" data-id="${esc(d.area.id)}">${pic('area')}${esc(w.area)}${esc(d.area.name)} · ${esc(prov)}</button>`
    : r.province ? `<button type="button" class="fact-chip" data-action="select-province" data-id="${esc(r.province)}">${pic('province')}${esc(prov)}</button>` : '';
  const railChip = r.rail ? `<button type="button" class="fact-chip" data-action="select-station" data-id="${esc(r.rail.station.id)}" title="สถานีที่เปิดแล้วที่ใกล้ที่สุด · ระยะตรง">${pic('rail')}${esc(stationShort(r.rail.station))} ${nw(esc(meters(r.rail.m)))}</button>` : '';
  const bd = d.building;
  const buildingChip = bd?.others ? `<button type="button" class="fact-chip" data-action="select-building" data-id="${esc(bd.key)}" title="หมุดของสถานที่เรียนเสริมอีก ${num(bd.others)} แห่งอยู่ในอาคารนี้บนแผนที่">${pic('building')}อีก ${num(bd.others)} แห่งในอาคารนี้</button>` : '';
  const point = coords ? `<span class="data-number">${esc(coords)}</span><br><span class="hint">จุดทะเบียน สช. (OPEC)</span>` : `<span>${esc(POINT_TH[r.pointState] || POINT_TH.none)}</span>`;
  const sameArea = d.sameArea.count ? `<section class="panel-section"><div class="section-heading">${heading('learning', `เรียนเสริมอื่นใน${d.area ? `${w.area}${d.area.name}` : 'พื้นที่นี้'}`)}<span class="hint">${num(d.sameArea.count)} แห่ง</span></div>${serviceBars(d.sameArea.services)}</section>` : '';
  const schools = d.schools.count
    ? `<section class="panel-section"><div class="section-heading">${heading('school', 'โรงเรียนรอบ ๆ')}<span class="hint" title="ระยะตรงจากหมุด">${pic('distance', 'hint-pic')}≤ ${esc(meters(d.schools.radius))}</span></div>
      <p class="fact-line">${pic('students', 'fact-icon')}${nw(`<strong class="data-number">${num(d.schools.count)}</strong> แห่ง`)} · ${nw(`${num(d.schools.students)} คน`)}</p>
      ${schoolList(d.schools.rows.map(x => x.row), {distance: new Map(d.schools.rows.map(x => [x.row.id, x.m]))})}</section>`
    : d.schoolsInArea.count ? `<section class="panel-section"><div class="section-heading">${heading('school', `โรงเรียนใน${d.area ? `${w.area}${d.area.name}` : 'พื้นที่นี้'}`)}</div>
      <p class="fact-line">${pic('students', 'fact-icon')}${nw(`<strong class="data-number">${num(d.schoolsInArea.count)}</strong> แห่ง`)} · ${nw(`${num(d.schoolsInArea.students)} คน`)}</p></section>` : '';
  return `<section class="detail-head store">
      <button type="button" class="btn quiet back" data-action="back">กลับ</button>
      <div class="identity"><span class="identity-cue">${cueMarkup(r.series)}</span><div>
        <p class="eyebrow eyebrow-cue">เรียนเสริม${r.serviceNames.length ? ` · ${esc(servicesText(r))}` : ''}</p>
        <h2>${esc(r.name || r.nameEn || 'ไม่มีชื่อ')}</h2>
        ${subLine(r, 'branch-name', 'p')}</div></div>
      <div class="fact-chips">${serviceChips}${typeChip}${areaChip}${railChip}${buildingChip}${coords ? '' : '<span class="fact-chip is-quiet">ไม่มีหมุด</span>'}</div>
      ${actionBar({kind: 'learning', row: r, area: d.area ? {place: `${w.area}${d.area.name}`, province: prov} : r.province ? {place: '', province: prov} : null,
        point: hasPoint(r) ? {lat: r.latitude, lon: r.longitude, role: 'point'} : null})}
      <details class="source-details"><summary>ที่มาและพิกัด</summary>
        <dl class="facts">
          <dt>แหล่ง</dt><dd>${r.source === 'provider' ? 'ผู้ให้บริการ' : 'ทะเบียนโรงเรียนนอกระบบ สช. (OPEC)'}${r.url ? ` · ${link(r.url, r.source === 'provider' ? 'หน้าของผู้ให้บริการ' : 'หน้าทะเบียน สช.')}` : ''}</dd>
          <dt>จัดหมวด</dt><dd>${esc(r.evidence || '')}</dd>
          <dt>พื้นที่</dt><dd>ตามทะเบียน</dd>
          <dt>พิกัด</dt><dd>${point}</dd>
          <dt>รหัส</dt><dd><span class="hint data-number">${esc(r.id)}</span></dd>
        </dl>
      </details>
    </section>
    ${sameArea}
    ${hasPoint(r) ? `<section class="panel-section terrain-section"><div class="section-heading">${heading('elevation', 'ภูมิประเทศ')}</div>
      <div class="fact-chips terrain-chips" data-terrain-for="${esc(r.id)}"><span class="hint">กำลังอ่านภูมิประเทศ</span></div></section>` : ''}
    ${schools}
    ${provenance(ctx, d.area ? `${w.area}${d.area.name} ${prov}` : prov || 'ไม่ระบุจังหวัด', {learn: true, learnOnly: !(d.schools.count || d.schoolsInArea.count),
      provider: r.source === 'provider', rail: Boolean(r.rail), terrain: hasPoint(r)})}`;
}
