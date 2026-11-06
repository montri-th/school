/**
 * School labels near the middle of the view and the hover card (the Hotel rule of 2026-11-01, point 5: “แสดงชื่อหรือ
 * โลโก้ของจุดพวกที่อยู่กลาง ๆ viewport ตามการ pan tilt zoom หรือ mouse hovering”, “เน้นให้แสดง…ที่สำคัญก่อน” and “ใช้
 * symbol, icon แทน text ยาว ๆ โดยเฉพาะป้ายใน map”).
 *
 * From LABEL_MIN_ZOOM, the focus rows whose point lies in the central ellipse of the visible map (CENTRE_SHARE of its
 * half-width and half-height) compete for a short label: the group cue, one short name and the students pictogram
 * with the recorded students (left out when unknown — never 0). Ranking: row.importance (js/model.js#importanceScores
 * — students and published tuition percentiles), then nearness to the centre. At most LABEL_MAX labels (desktop /
 * phone). Each label is measured and placed above its point, else below it; it never covers the map chrome, another
 * label or the open popup. During a camera move the placed labels follow their points every frame (no re-ranking);
 * the set is ranked again when the move ends. Labels are buttons (Tab, Enter opens the school); on a fine pointer,
 * hover or focus opens a card of icon chips — type, students, grades, affiliation, tuition and the terrain facts of
 * js/terrain.js. Full sentences live in the accessible names and chip titles only; the provenance line stays in the
 * panel. No logos: the roster carries none.
 */
import {cueMarkup} from './cues.js';
import {gradeRange} from './model.js';
import {terrainFacts, terrainChips} from './terrain.js';
import {isLearning, SERVICE_PICTOGRAM} from './learning.js';

export const LABEL_MIN_ZOOM = 12.5;
export const LABEL_MAX = Object.freeze({desktop: 9, phone: 5});
export const CENTRE_SHARE = 0.36;
const GAP = 6;

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const known = r => Number.isFinite(r?.students) && r.students > 0;
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** Pure: importance first (students + published tuition), then nearer the centre, then id (stable). */
export function rankLabelCandidates(cands) {
  return cands.sort((a, b) => (b.row.importance || 0) - (a.row.importance || 0) || a.d - b.d || String(a.row.id).localeCompare(String(b.row.id)));
}

/** Leading type words the group cue already says (โรงเรียน · รร. · ศพด. · ศูนย์พัฒนาเด็กเล็ก). */
const TYPE_WORDS = /^(โรงเรียน|ร\.?ร\.|ศพด\.|ศูนย์พัฒนาเด็กเล็ก)\s*/;
/**
 * Pure: the short name of a label (short, icons before words). The cue already says the type, so a leading type word
 * (โรงเรียน, รร., ศพด. …) is dropped; a place inside a school's name is part of its identity (“อนุบาลขอนแก่น”) and
 * stays. The full name stays in the accessible name and the card. Never shorter than 3 characters.
 */
export function shortName(row) {
  let original = String(row.name || row.nameEn || '').trim();
  if (/^[(（[].*[)）\]]$/.test(original)) original = original.slice(1, -1).trim();
  let name = original;
  for (let i = 0; i < 2; i++) name = name.replace(TYPE_WORDS, '');
  name = name.trim();
  return name.length >= 3 ? name : original;
}

/**
 * Pure: what a label says — one short name and the recorded students (null when unknown); a learning record says its
 * services as pictograms instead (0.2.0). Returns {site, students, services}.
 */
export function labelParts(row) {
  return {site: shortName(row), students: known(row) ? row.students : null, services: isLearning(row) ? [...(row.services || [])] : []};
}

/**
 * Pure: candidates inside the central ellipse. project(lngLat) → {x, y}; box = visible box {left, right, top, bottom}.
 * Returns [{row, x, y, d}] with d = normalised ellipse distance (≤ 1).
 */
export function centreCandidates(rows, project, box, {share = CENTRE_SHARE, skip = ''} = {}) {
  const cx = (box.left + box.right) / 2, cy = (box.top + box.bottom) / 2;
  const rx = Math.max(40, (box.right - box.left) * share), ry = Math.max(40, (box.bottom - box.top) * share);
  const out = [];
  for (const row of rows) {
    if (row.id === skip || !Number.isFinite(row.longitude) || !Number.isFinite(row.latitude)) continue;
    const p = project([row.longitude, row.latitude]);
    const d = ((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2;
    if (d <= 1) out.push({row, x: p.x, y: p.y, d});
  }
  return out;
}

/**
 * Pure: place measured labels. cands ranked; size(row) → {w, h}; radius(row) → symbol radius px; returns
 * [{row, x, y, box, below}] (x, y = the label's top-left).
 */
export function placeLabels(cands, size, radius, box, {max = LABEL_MAX.desktop, blockers = []} = {}) {
  const placed = [];
  for (const c of cands) {
    if (placed.length >= max) break;
    const {w, h} = size(c.row), lift = radius(c.row) + GAP + 4;
    for (const below of [false, true]) {
      const x = Math.round(c.x - w / 2), y = Math.round(below ? c.y + lift - 4 : c.y - lift - h);
      const b = {left: x - 3, right: x + w + 3, top: y - 2, bottom: y + h + 2};
      if (b.left < box.left || b.right > box.right || b.top < box.top || b.bottom > box.bottom) continue;
      if (placed.some(p => overlaps(b, p.box)) || blockers.some(k => overlaps(b, k))) continue;
      placed.push({row: c.row, x, y, box: b, below, ax: c.x, ay: c.y});
      break;
    }
  }
  return placed;
}

/**
 * Mount on a MapLibre map and its container. options:
 *  onSelect(row) · bounds() → {left, right, top, bottom, exclusions} (js/pins.js) · radius(row, zoom) → px ·
 *  isPhone() · finePointer() · num(n) · feeText(fee) · groupName(row).
 * Returns {update(rows, {selectedId}), layout, hover(row|null, anchor?), dispose}.
 */
export function installSchoolLabels(map, container, {onSelect, bounds, avoid = () => [], radius = () => 6, isPhone = () => false, finePointer = () => true, num = n => String(n), feeText = () => '', groupName = () => ''} = {}) {
  const host = document.createElement('div');
  host.className = 'school-labels';
  host.setAttribute('aria-label', 'ชื่อสถานศึกษากลางแผนที่');
  const card = document.createElement('div');
  card.className = 'school-card';
  card.hidden = true;
  card.setAttribute('role', 'status');
  container.append(host, card);
  let rows = [], selectedId = '', placed = [], frame = 0, timer = 0, moving = false, cardRow = null, cardAnchor = null;
  const pool = new Map();  // id → {el, w, h}

  function element(row) {
    let e = pool.get(row.id);
    if (e) return e;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'school-label';
    el.dataset.id = row.id;
    const parts = labelParts(row);
    const said = isLearning(row) ? `เรียนเสริม · ${(row.serviceNames || []).join(' · ')}` : known(row) ? `${num(row.students)} คน` : 'ไม่ทราบจำนวนนักเรียน';
    el.setAttribute('aria-label', [row.name || row.nameEn, said, gradeRange(row)].filter(Boolean).join(' · '));
    const tail = parts.services.length
      ? `<span class="hl-services" aria-hidden="true">${parts.services.map(s => `<i class="pictogram pic-${esc(SERVICE_PICTOGRAM[s] || 'learning')}"></i>`).join('')}</span>`
      : parts.students ? `<span class="hl-students data-number"><i class="pictogram pic-students" aria-hidden="true"></i>${esc(num(parts.students))}</span>` : '';
    el.innerHTML = `<span class="hl-cue" aria-hidden="true">${cueMarkup(row.series)}</span><span class="hl-text"><span class="hl-name">${esc(parts.site)}</span></span>${tail}`;
    el.onclick = () => onSelect?.(row);
    el.onmouseenter = () => { if (finePointer()) showCard(row, el); };
    el.onmouseleave = () => hideCard(row);
    el.onfocus = () => showCard(row, el);
    el.onblur = () => hideCard(row);
    el.hidden = true;
    host.append(el);
    e = {el, w: 0, h: 0};
    pool.set(row.id, e);
    return e;
  }
  const measure = row => { const e = element(row); if (!e.w) { e.el.hidden = false; e.el.style.transform = 'translate(-9999px, -9999px)'; e.w = e.el.offsetWidth; e.h = e.el.offsetHeight; } return {w: e.w, h: e.h}; };

  function layout() {
    frame = 0;
    const zoom = map.getZoom();
    const b = bounds();
    let next = [];
    if (zoom >= LABEL_MIN_ZOOM && rows.length) {
      const cands = rankLabelCandidates(centreCandidates(rows, p => map.project(p), b, {skip: selectedId}));
      const popup = [...container.querySelectorAll('.maplibregl-popup')].map(el => { const r = el.getBoundingClientRect(), c = container.getBoundingClientRect(); return {left: r.left - c.left - 4, right: r.right - c.left + 4, top: r.top - c.top - 4, bottom: r.bottom - c.top + 4}; });
      next = placeLabels(cands.slice(0, 40), measure, row => radius(row, zoom), b, {max: isPhone() ? LABEL_MAX.phone : LABEL_MAX.desktop, blockers: [...(b.exclusions || []), ...popup, ...avoid()]});
    }
    const keep = new Set(next.map(p => p.row.id));
    for (const [id, e] of pool) if (!keep.has(id)) { e.el.hidden = true; e.el.classList.remove('is-on'); }
    for (const p of next) {
      const e = element(p.row);
      e.el.hidden = false;
      e.el.classList.toggle('is-below', p.below);
      e.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      requestAnimationFrame(() => e.el.classList.add('is-on'));
    }
    placed = next.map(p => ({...p, dx: p.x - p.ax, dy: p.y - p.ay}));
    // Bounded pool: drop labels not shown (oldest first) beyond 80.
    if (pool.size > 80) for (const [id, e] of pool) { if (pool.size <= 60) break; if (!keep.has(id)) { e.el.remove(); pool.delete(id); } }
    if (cardRow) placeCard();
  }
  /** Follow the points during a move: same set, same offsets, new anchors. */
  function follow() {
    frame = 0;
    const b = bounds();
    for (const p of placed) {
      const e = pool.get(p.row.id);
      if (!e) continue;
      const a = map.project([p.row.longitude, p.row.latitude]);
      const x = Math.round(a.x + p.dx), y = Math.round(a.y + p.dy);
      const off = x < b.left - 40 || x > b.right + 40 || y < b.top - 30 || y > b.bottom + 30;
      e.el.hidden = off;
      if (!off) e.el.style.transform = `translate(${x}px, ${y}px)`;
    }
    if (cardRow) placeCard();
  }
  const schedule = () => { if (frame) return; frame = requestAnimationFrame(() => (moving ? follow() : layout())); };
  // A full layout waits one frame more than the district chips (js/map-layers.js), which keep priority: their boxes
  // are read as blockers.
  const later = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { frame = requestAnimationFrame(layout); }); };
  const onMove = () => { if (!moving) { moving = true; } schedule(); clearTimeout(timer); timer = setTimeout(() => { moving = false; later(); }, 260); };
  const onMoveEnd = () => { clearTimeout(timer); moving = false; later(); };
  map.on('move', onMove);
  map.on('moveend', onMoveEnd);
  map.on('resize', schedule);
  // Label widths are measured once: measure again when a web font finishes loading.
  const onFonts = () => { for (const e of pool.values()) e.w = 0; schedule(); };
  document.fonts?.addEventListener?.('loadingdone', onFonts);

  /* ---------- hover card ---------- */
  function chip(kind, text, title = '') {
    return `<span class="hc-chip"${title ? ` title="${esc(title)}"` : ''}>${kind ? `<i class="pictogram pic-${esc(kind)}" aria-hidden="true"></i>` : ''}${esc(text)}</span>`;
  }
  /** Beside its label or point (right, else left, else below), inside the usable map, never over the label itself. */
  function placeCard() {
    if (!cardRow) return;
    const c = container.getBoundingClientRect();
    let a;
    if (cardAnchor?.isConnected) { const r = cardAnchor.getBoundingClientRect(); a = {left: r.left - c.left, right: r.right - c.left, top: r.top - c.top, bottom: r.bottom - c.top}; }
    else { const p = map.project([cardRow.longitude, cardRow.latitude]); a = {left: p.x - 8, right: p.x + 8, top: p.y - 8, bottom: p.y + 8}; }
    const w = card.offsetWidth || 280, h = card.offsetHeight || 120, b = bounds();
    let x = a.right + 10, y = a.top - 6;
    if (x + w > b.right) x = a.left - w - 10;
    if (x < b.left) { x = Math.min(Math.max(b.left, a.left), b.right - w); y = a.bottom + 8; }
    if (y + h > b.bottom) y = b.bottom - h;
    card.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.max(b.top, y))}px)`;
  }
  async function showCard(row, anchor = null) {
    if (!row) return;
    cardRow = row; cardAnchor = anchor;
    const grades = gradeRange(row);
    const chips = isLearning(row) ? [
      `<span class="hc-chip">${cueMarkup(row.series)}เรียนเสริม</span>`,
      ...(row.services || []).map((s, i) => chip(SERVICE_PICTOGRAM[s] || 'learning', row.serviceNames[i], 'บริการตามทะเบียน สช.')),
      row.type ? chip('segment', row.type, 'ประเภทในทะเบียนโรงเรียนนอกระบบ สช.') : '',
    ].filter(Boolean).join('') : [
      `<span class="hc-chip">${cueMarkup(row.series)}${esc(groupName(row))}</span>`,
      row.closed ? chip('closed', 'ประกาศปิด') : '',
      known(row) ? chip('students', `${num(row.students)} คน`, 'นักเรียน') : chip('students', 'ไม่ทราบ', 'ไม่ทราบจำนวนนักเรียน'),
      grades ? chip('level', grades, 'ระดับชั้นที่เปิดสอน') : '',
      row.aff ? chip('aff', row.aff.short, row.aff.th) : '',
      row.fee ? chip('fee', `${feeText(row.fee)}/ปี`, `ค่าเรียนต่อคนต่อปี ปีการศึกษา ${row.fee.year}`) : '',
    ].filter(Boolean).join('');
    card.innerHTML = `<div class="hc-head"><div><strong>${esc(row.name || row.nameEn)}</strong>${row.nameEn && row.name ? `<span class="hc-sub">${esc(row.nameEn)}</span>` : ''}</div></div>
      <div class="hc-chips">${chips}</div><div class="hc-chips hc-terrain" aria-live="off"></div>`;
    card.hidden = false;
    placeCard();
    const facts = await terrainFacts(map, row).catch(() => null);
    if (cardRow !== row) return;
    const t = terrainChips(facts, {num}).map(c => chip(c.kind, c.text, c.title)).join('');
    card.querySelector('.hc-terrain').innerHTML = t;
    placeCard();
  }
  function hideCard(row = null) {
    if (row && cardRow && row.id !== cardRow.id) return;
    cardRow = null; cardAnchor = null; card.hidden = true;
  }

  return {
    update(list, {selectedId: sel = ''} = {}) { rows = list || []; selectedId = sel; later(); },
    layout: later,
    /** Hover from a pin or a map symbol (fine pointer only); null hides the card. */
    hover(row, anchor = null) { if (!row) hideCard(); else if (finePointer() && (!cardRow || cardRow.id !== row.id)) showCard(row, anchor); },
    placedIds: () => placed.map(p => p.row.id),
    /** Rebuild every label (after the fonts arrive). */
    refresh() { for (const e of pool.values()) e.el.remove(); pool.clear(); placed = []; later(); },
    dispose() { cancelAnimationFrame(frame); clearTimeout(timer); map.off('move', onMove); map.off('moveend', onMoveEnd); map.off('resize', schedule); document.fonts?.removeEventListener?.('loadingdone', onFonts); host.remove(); card.remove(); pool.clear(); },
  };
}
