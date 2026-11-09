/**
 * School · page language (citymeter-shell, js/shell/i18n.js). js/app.js imports this module first, so an English page
 * is translated before anything renders. The words are in js/lang-en.js. Names come from the data's own English and
 * are never translated here (demo-platform-review §5.8): provinces and districts from the area index
 * (OpenGISData-Thailand names, DOPA-credited, data/area-index.json metadata.englishNames), stations from their nameEn,
 * school groups from groups[].en, a school from its English name (data/schools.json cols.nameEn), a learning centre
 * from its English name (data/learning.json cols.nameEn). A name without English stays Thai (keepThai), and so do the
 * fee lines, curricula and quality texts the registers publish.
 */
import {LANG, registerDictionary, registerNames, keepThai, startTranslation} from './shell/i18n.js';
import SCHOOL_EN from './lang-en.js';

const THAI = /[ก-ฺเ-๎]/;

if (LANG === 'en') {
  registerDictionary(SCHOOL_EN);
  startTranslation();
  // The English is a draft until reviewed (demo-platform-review §5.8): the help dialog says so.
  const note = () => {
    const intro = document.querySelector('.usage-dialog .help-intro');
    if (!intro || document.getElementById('draft-english-note')) return;
    const p = document.createElement('p');
    p.id = 'draft-english-note';
    p.className = 'help-intro';
    p.textContent = 'English is a draft translation from the Thai. Names with no English in the data stay in Thai, and so do the fee lines, curricula and quality texts the registers publish. The product statement is in Thai.';
    intro.after(p);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', note, {once: true}); else note();
}

/** Register the English the data carries. index = js/areas.js buildAreaIndex, data = js/model.js decodeDataset, learning = js/learning.js decodeLearning. */
export function registerDataNames({index, data, learning}) {
  if (LANG !== 'en') return;
  const labels = {};
  for (const g of data?.groups || []) if (g.th && g.en) labels[g.th] = g.en;
  registerDictionary({exact: labels});
  const pairs = [];
  for (const p of index?.provinces || []) if (p.nameEn) pairs.push([p.name, p.nameEn], [`จังหวัด${p.name}`, p.nameEn]);
  const bangkok = (index?.provinces || []).find(p => p.id === 'BKK')?.nameEn;
  if (bangkok) pairs.push(['กรุงเทพฯ', bangkok], ['กรุงเทพ', bangkok]);
  for (const a of index?.areas || []) {
    if (!a.nameEn) continue;
    pairs.push([a.name, a.nameEn], [`${a.province === 'BKK' ? 'เขต' : 'อำเภอ'}${a.name}`, a.nameEn]);
  }
  // Stations: the name alone, with “สถานี”, and with their lines as js/panel.js writes them (“อโศก (สุขุมวิท)”).
  const lineEn = l => (THAI.test(l) ? SCHOOL_EN.exact[l] || null : l);
  const thaiStations = [];
  for (const s of data?.stations || []) {
    if (!s.nameEn) {
      // A station without English stays Thai, with its lines as js/panel.js writes them.
      const th = s.lines?.length ? `${s.name} (${s.lines.join(' · ')})` : '';
      thaiStations.push(s.name, `สถานี${s.name}`, ...(th ? [th, `สถานี${th}`] : []));
      continue;
    }
    pairs.push([s.name, s.nameEn], [`สถานี${s.name}`, `${s.nameEn} station`]);
    const lines = (s.lines || []).map(lineEn);
    if (s.lines?.length && lines.every(Boolean)) {
      const th = `${s.name} (${s.lines.join(' · ')})`, en = `(${lines.join(' · ')})`;
      pairs.push([th, `${s.nameEn} ${en}`], [`สถานี${th}`, `${s.nameEn} station ${en}`]);
    }
  }
  // A school or a learning centre reads its English name; a Thai name without one stays Thai.
  const thaiNames = [];
  for (const r of [...(data?.rows || []), ...(learning?.rows || [])]) {
    if (!r.name || !THAI.test(r.name)) continue;
    if (r.nameEn && !THAI.test(r.nameEn)) pairs.push([r.name, r.nameEn]); else thaiNames.push(r.name);
  }
  // What the registers and the schools publish is shown as written (AGENTS.md: verbatim): the ONESQA result lines, the
  // curriculum and accreditation lines, the fee lines and their grade lists stay Thai.
  const published = [];
  for (const r of data?.rows || []) {
    for (const line of r.quality?.lines || []) published.push(line);
    published.push(r.curriculum, r.accreditation, r.fee?.grades);
    for (const [scope, , programme, campus] of r.fee?.items || []) published.push(scope, programme, campus);
  }
  registerNames(pairs);
  keepThai([...thaiNames, ...thaiStations, ...published.filter(v => v && THAI.test(v))]);
}

/** On an English page the line under a school's English heading is its Thai name, marked as Thai and left alone. */
export const thaiSubName = r => (LANG === 'en' && r?.name && THAI.test(r.name) && r.nameEn && !THAI.test(r.nameEn) ? r.name : '');
