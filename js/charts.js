/**
 * Comparison charts rendered as plain HTML — no chart vendor.
 *
 * Three views share the committed selection (scopeRows), the map's membership and the map's measure:
 *  - areas (URL view key `areas`): students recorded (or schools) per เขต/อำเภอ, bars in the map's colour (the same
 *    41-sample rank ramp over the same districts, js/scales.js#buildMetricRamp)
 *  - mix: district × school group, a numeric table with equal cells (its own 41-sample ramp over the cells)
 *  - affs: students (or schools) per affiliation (สังกัด) of the source, one neutral bar colour (an affiliation is not a
 *    category of the map)
 * District marks emit {type:'area', id}; affiliation marks emit {type:'aff', id}.
 */
import {buildChartModel, areaMatrix, affRanking} from './chart-model.js';
import {buildMetricRamp, classify, rampLegendHTML} from './scales.js';
import {cueMarkup} from './cues.js';
import {areaWord} from './areas.js';
import {provinceByCode} from './model.js';

const NUMBER = new Intl.NumberFormat('th-TH', {maximumFractionDigits: 0});
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const num = n => NUMBER.format(n);
const place = a => `${areaWord(a.province)}${a.name}`;
const where = (a, national) => (national ? provinceByCode(a.province)?.th || '' : '');

function empty(element, message) {
  element.innerHTML = `<div class="chart-empty"><p>${esc(message)}</p></div>`;
}

function areas(element, model, select, selectedId, unit, national) {
  // Every district of the reading, not only the 20 drawn: the same ramp as the map's district layer.
  const ramp = buildMetricRamp(model.values, {metric: model.metric, unit: unit.one});
  const max = Math.max(1, ...model.areas.map(a => a.value));
  const other = a => (unit.id === 'count' ? `${num(a.students)} คน` : `${num(a.count)} แห่ง`);
  const rows = model.areas.map((a, i) => {
    const cls = classify(a.value, ramp);
    const pressed = a.id === selectedId;
    return `<li><button type="button" class="bar-row${pressed ? ' is-selected' : ''}" data-area="${esc(a.id)}" aria-pressed="${pressed}"
      aria-label="อันดับ ${i + 1} ${esc(place(a))} ${esc(where(a, national))}: ${num(a.value)} ${esc(unit.one)} ${esc(other(a))} กดเพื่อดูพื้นที่นี้">
      <span class="bar-rank data-number" aria-hidden="true">${i + 1}</span>
      <span class="bar-label">${esc(place(a))}<small>${esc([where(a, national), other(a)].filter(Boolean).join(' · '))}</small></span>
      <span class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:${Math.max(2, Math.round((a.value / max) * 100))}%;background:${cls.fill}"></span></span>
      <span class="bar-value" aria-hidden="true"><b class="data-number">${num(a.value)}</b><small>${esc(unit.one)}</small></span>
    </button></li>`;
  }).join('');
  const w = national ? 'เขต/อำเภอ' : areaWord(model.areas[0]?.province);
  element.innerHTML = `<p class="chart-caption">${esc(unit.subject)}ต่อ${esc(w)} · ${num(model.areas.length)} จาก ${num(model.totalAreas)} ${esc(w)} · สีเดียวกับแผนที่</p><ol class="chart-bars">${rows}</ol>`;
  element.querySelectorAll('[data-area]').forEach(b => b.addEventListener('click', () => select({type: 'area', id: b.dataset.area})));
}

function matrix(element, model, select, selectedId, unit) {
  const m = areaMatrix(model, {areaLimit: 12});
  const ramp = buildMetricRamp(m.cells.map(c => c.value), {metric: model.metric, unit: unit.one});
  const head = m.groups.map(g => `<th scope="col" title="${esc(g.th)}"><span class="matrix-col">${cueMarkup(g.series)}<span>${esc(g.short || g.th)}</span></span></th>`).join('');
  const body = m.areas.map(a => {
    const pressed = a.id === selectedId;
    const cells = m.groups.map(g => {
      const cell = m.cells.find(c => c.areaId === a.id && c.group === g.index);
      const cls = cell.unknown ? classify(null, ramp, 'no_data') : classify(cell.value, ramp);
      // measured_zero: sample 0 + the theme's dataState.zero outline (EVID-05 treatment), never a blank cell;
      // no_data (students unknown for every record of the cell): the no-data ground and a dash, never 0.
      const style = cls.state === 'no_data' ? 'background:var(--data-no-data);color:var(--text-secondary)'
        : cls.state === 'measured_zero' ? `background:${cls.fill};color:${cls.ink};box-shadow:inset 0 0 0 2px var(--data-zero-outline)` : `background:${cls.fill};color:${cls.ink}`;
      const shown = cell.unknown ? '—' : num(cell.value);
      const said = cell.unknown ? `${num(cell.count)} แห่ง ไม่ทราบจำนวนนักเรียน` : `${num(cell.value)} ${unit.one}`;
      return `<td><button type="button" class="matrix-cell is-${cls.state}" data-area="${esc(a.id)}" style="${style}"
        aria-label="${esc(place(a))} × ${esc(g.th)}: ${esc(said)} กดเพื่อดูพื้นที่นี้" title="${esc(place(a))} × ${esc(g.th)} — ${cell.unknown ? esc(said) : `${num(cell.value)} จาก ${num(cell.total)} ${esc(unit.one)}`}"><span class="data-number${cls.plate ? ' on-plate' : ''}">${shown}</span></button></td>`;
    }).join('');
    return `<tr${pressed ? ' class="is-selected"' : ''}><th scope="row"><button type="button" class="matrix-row" data-area="${esc(a.id)}" aria-pressed="${pressed}">${esc(a.name)}<small class="data-number">${num(a.value)}</small></button></th>${cells}</tr>`;
  }).join('');
  const columns = `<colgroup><col class="matrix-head-col">${m.groups.map(() => '<col class="matrix-cell-col">').join('')}</colgroup>`;
  element.innerHTML = `<p class="chart-caption">${num(m.areas.length)} เขต/อำเภอที่มี${esc(unit.subject)}มากที่สุด × ${num(m.groups.length)} ประเภท · ตัวเลข = ${esc(unit.one)}</p>
    <div class="matrix-scroll"><table class="matrix" style="--matrix-columns:${m.groups.length}">${columns}<thead><tr><th scope="col" class="matrix-corner">พื้นที่ · ${esc(unit.one)}</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
    <p class="chart-legend"><span class="legend-title">${esc(unit.one)}ในช่อง · สีเข้ม = มาก</span>${rampLegendHTML(ramp)}<span class="legend-step"><i class="legend-zero" aria-hidden="true"></i>0 = ไม่พบในตัวกรองนี้</span>${m.cells.some(c => c.unknown) ? '<span class="legend-step">— = ไม่ทราบจำนวนนักเรียน</span>' : ''}</p>`;
  element.querySelectorAll('[data-area]').forEach(b => b.addEventListener('click', () => select({type: 'area', id: b.dataset.area})));
}

function affs(element, rows, select, selectedAff, unit) {
  const r = affRanking(rows, {limit: 20, metric: unit.id});
  if (!r.affs.length) { empty(element, 'ไม่มีสังกัดในตัวกรองนี้'); return; }
  const max = Math.max(1, ...r.affs.map(c => c.value));
  const other = c => (unit.id === 'count' ? `${num(c.students)} คน` : `${num(c.count)} แห่ง`);
  const list = r.affs.map((c, i) => {
    const pressed = c.aff.id === selectedAff;
    return `<li><button type="button" class="bar-row${pressed ? ' is-selected' : ''}" data-aff="${esc(c.aff.id)}" aria-pressed="${pressed}"
      aria-label="อันดับ ${i + 1} ${esc(c.aff.th)}: ${num(c.value)} ${esc(unit.one)} ${esc(other(c))} กดเพื่อดูเฉพาะสังกัดนี้">
      <span class="bar-rank data-number" aria-hidden="true">${i + 1}</span>
      <span class="bar-label">${esc(c.aff.short)}<small>${esc(`${other(c)} · ${c.aff.th}`)}</small></span>
      <span class="bar-track" aria-hidden="true"><span class="bar-fill aff-fill" style="width:${Math.max(2, Math.round((c.value / max) * 100))}%"></span></span>
      <span class="bar-value" aria-hidden="true"><b class="data-number">${num(c.value)}</b><small>${esc(unit.one)}</small></span>
    </button></li>`;
  }).join('');
  element.innerHTML = `<p class="chart-caption">${esc(unit.subject)}ต่อสังกัด · ${num(r.affs.length)} จาก ${num(r.total)} สังกัด</p><ol class="chart-bars">${list}</ol>`;
  element.querySelectorAll('[data-aff]').forEach(b => b.addEventListener('click', () => select({type: 'aff', id: b.dataset.aff})));
}

/** Render one view into #elementId. Returns an idempotent disposer. */
export function renderInsightChart({elementId, view = 'areas', rows = [], index, groups, theme, selectedAreaId = '', selectedAff = '', unit, national = true} = {}, onSelect = () => {}) {
  const element = document.getElementById(elementId);
  if (!element) return () => {};
  const select = typeof onSelect === 'function' ? onSelect : () => {};
  element.replaceChildren();
  if (theme) element.dataset.chartTheme = theme;
  const labels = {areas: `เขต/อำเภอเรียงตาม${unit.subject}`, mix: 'ประเภทสถานศึกษาในแต่ละเขต/อำเภอ', affs: `สังกัดเรียงตาม${unit.subject}`};
  element.setAttribute('aria-label', labels[view] || labels.areas);
  if (!Array.isArray(rows) || !rows.length) { empty(element, 'ไม่พบสถานศึกษาตามตัวกรอง'); return () => element.replaceChildren(); }
  try {
    if (view === 'affs') affs(element, rows, select, selectedAff, unit);
    else {
      const model = buildChartModel(rows, index, groups, {metric: unit.id});
      if (!model.areas.length) { empty(element, 'ไม่มีเขต/อำเภอในตัวกรองนี้'); return () => element.replaceChildren(); }
      if (view === 'mix') matrix(element, model, select, selectedAreaId, unit);
      else areas(element, model, select, selectedAreaId, unit, national);
    }
  } catch (error) {
    console.error('CityMETER chart could not render:', error);
    empty(element, 'แสดงกราฟไม่ได้ · ดูในตารางแทน');
  }
  return () => element.replaceChildren();
}
