/**
 * Read tabs of a large Google Sheet cell by cell from the sheet's own HTML view, in the browser of someone who can
 * open the sheet (the research master of CityMETER School is 35 MB: too large for a Drive export).
 *
 * How it was used for School 0.1.0 (2026-11-05): the owner's Chrome, signed in, on the sheet's page; this script
 * pasted into the console (or run through Claude in Chrome), then the payload decoded with
 * scripts/decode-sheet-payload.py into one <tab>.json per tab = {name, gid, ncols, rows} (rows[0] = the header row).
 * scripts/build-data.py records the SHA-256 of each tab's rows as canonical JSON (meta.tabs), the same digest this
 * script prints, so a later read can be compared tab by tab.
 *
 * The sheet's address is never written here: the script reads the page it runs on (`location`). Nothing leaves the
 * browser; the output is a file the reader saves (download) or a payload block in the page (`into: 'page'`).
 *
 *   await exportSheetTabs([{name: '02_SCHOOLS', gid: 103}, {name: '01_AFFILIATIONS', gid: 102}], {batch: 2000});
 *
 * Long runs: a console call may outlive a tool's time limit; run it in the background
 * (`window.__cms = exportSheetTabs(...)`) and read `window.__cmsProgress` until it settles.
 */
(function () {
  'use strict';
  const base = () => location.href.replace(/[?#].*$/, '').replace(/\/(edit|htmlview|view|preview)(\/.*)?$/, '');
  // The sheet's page enforces Trusted Types: parse through a named policy of our own.
  const policy = (() => { try { return window.trustedTypes?.createPolicy?.('cms-sheet-export', {createHTML: s => s}) || null; } catch { return null; } })();
  const parse = html => new DOMParser().parseFromString(policy ? policy.createHTML(html) : html, 'text/html');

  /** Rows [r0, r1] (1-based) of one tab as arrays of cell text; [] past the end. */
  async function readRange(gid, r0, r1) {
    const url = `${base()}/htmlview/sheet?headers=false&gid=${encodeURIComponent(gid)}&range=A${r0}:ZZZ${r1}`;
    const res = await fetch(url, {credentials: 'include', cache: 'no-store'});
    if (!res.ok) throw new Error(`gid ${gid} rows ${r0}–${r1}: HTTP ${res.status}`);
    const doc = parse(await res.text());
    const table = doc.querySelector('table.waffle') || doc.querySelector('table');
    if (!table) return [];
    const rows = [];
    for (const tr of table.querySelectorAll('tbody > tr')) {
      const cells = [];
      for (const td of tr.querySelectorAll(':scope > td')) {
        // A cell's text as the sheet shows it; line breaks inside a cell stay line breaks.
        const text = (td.innerText ?? td.textContent ?? '').replace(/ /g, ' ');
        const span = Number(td.getAttribute('colspan') || 1);
        cells.push(text);
        for (let i = 1; i < span; i++) cells.push('');
      }
      rows.push(cells);
    }
    return rows;
  }

  async function sha256Hex(text) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function gzipBase64(text) {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return {bytes, b64: btoa(s)};
  }

  /**
   * tabs: [{name, gid}] · batch: rows per request · into: 'download' (a .json.gz file) | 'page' (a CMSBEGIN…CMSEND
   * block replacing the page body, for a reader tool) · pad: minimum payload length (characters) of the page block.
   * Returns [{name, gid, rows, columns, sha256}].
   */
  async function exportSheetTabs(tabs, {batch = 2000, into = 'download', pad = 0} = {}) {
    const out = [], receipts = [];
    window.__cmsProgress = {state: 'running', tabs: tabs.length, done: 0};
    for (const {name, gid} of tabs) {
      const rows = [];
      for (let r0 = 1; ; r0 += batch) {
        const part = await readRange(gid, r0, r0 + batch - 1);
        rows.push(...part);
        window.__cmsProgress = {...window.__cmsProgress, tab: name, rows: rows.length};
        if (part.length < batch) break;
      }
      // Trailing empty rows are dropped; every row is padded to the header's width.
      while (rows.length && rows.at(-1).every(c => c === '')) rows.pop();
      const ncols = rows[0]?.length || 0;
      const fixed = rows.map(r => (r.length >= ncols ? r.slice(0, ncols) : [...r, ...Array(ncols - r.length).fill('')]));
      // Canonical JSON = Python's json.dumps(rows, ensure_ascii=False, separators=(',', ':')) — the build's digest.
      const sha256 = await sha256Hex(JSON.stringify(fixed));
      out.push({name, gid, ncols, rows: fixed});
      receipts.push({name, gid, rows: fixed.length - 1, columns: ncols, sha256});
      window.__cmsProgress = {...window.__cmsProgress, done: out.length};
    }
    const payload = JSON.stringify({readOn: new Date().toISOString(), tabs: out});
    const {bytes, b64} = await gzipBase64(payload);
    if (into === 'page') {
      const pre = document.createElement('pre');
      pre.id = 'cms-payload';
      pre.textContent = `CMSBEGIN${b64}CMSEND${'.'.repeat(Math.max(0, pad - b64.length))}`;
      document.body.replaceChildren(pre);
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bytes], {type: 'application/gzip'}));
      a.download = `sheet-tabs-${new Date().toISOString().slice(0, 10)}.json.gz`;
      document.body.append(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }
    window.__cmsProgress = {state: 'done', receipts, payloadSha256: await sha256Hex(payload)};
    console.table(receipts);
    return receipts;
  }

  window.exportSheetTabs = exportSheetTabs;
})();
