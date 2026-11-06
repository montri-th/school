#!/usr/bin/env python3
"""Build data/learning.json — the learning-service layer (เรียนเสริมและพัฒนาทักษะ) of the school research master.

Inputs (internal, never committed):
  --tabs       the research master's tabs read on 2026-11-06 in the owner's browser (scripts/export-sheet-tabs.js;
               <tab>.json = {name, gid, ncols, rows}): 27_LEARNING_SERVICES (the list the research team publishes:
               OPEC codes it classed as tutoring, language, arts or child development + provider-confirmed points),
               28_OPEC_NONFORMAL (the OPEC nonformal-school register as checked at source on 2026-10-31, with the
               classification status of each code) and 29_LEARNING_LINKS (cross-dataset evidence, provider records).
  --base-tabs  the tabs data/schools.json was built from (02_SCHOOLS, for the overlap check of OPEC codes).
Public inputs:
  --index data/area-index.json · --frames data/frames/ · --transit a checkout of montri-th/transit (the commit
  data/schools.json records in meta.context.rail) · --schools data/schools.json.

ONE ROW = one record of 27_LEARNING_SERVICES: an OPEC nonformal-school code the research team classed เข้าเกณฑ์เบื้องต้น
(28 status) or a provider-confirmed service point (29 status ยืนยันจากผู้ให้บริการ). A licence record of the register,
not a field-verified count of places that teach today; one place may hold several codes. Counted apart from the
40,828 school UUIDs of data/schools.json (no code is shared — checked here) and never added to them.

SERVICES = 28 `บริการที่พบ` (กวดวิชา · ภาษา · ศิลปะ · พัฒนาการเด็ก), the research team's preliminary labels from the
OPEC type and the registered name; a record may carry several. A total counts each record once.

DISTRICT = the DOPA district code the register lists (28 `รหัสจังหวัด / อำเภอ / ตำบล`) — a production district of the
area index; the provider record is placed by its district name. Never re-assigned from a point.

POINTS = the OPEC registry point (raw in the source) kept only where it falls inside the district the register lists
(district outlines of data/frames, build time). A point in another district or province, a malformed value or one
outside Thailand is not published: the record counts in its district without a pin (meta.checks).

RAIL = the nearest operating station of CityMETER · Transit within RAIL_MAX_M, straight line from a kept point.

Not copied (meta.excludedFields): OPEC codes as a field (the public OPEC profile page is the link), addresses, raw
points that failed the check, administrative codes (membership only), PDC codes, review groups and reasons, the 277
codes held for review and the 4,456 codes outside the learning categories of this round.
"""
import argparse, collections, datetime, hashlib, importlib.util, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('build_data', os.path.join(HERE, 'build-data.py'))
bd = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bd)

TABS = ['27_LEARNING_SERVICES', '28_OPEC_NONFORMAL', '29_LEARNING_LINKS']
SERVICES = [('tutor', 'กวดวิชา', 1), ('language', 'ภาษา', 2), ('arts', 'ศิลปะ', 4), ('child', 'พัฒนาการเด็ก', 8)]
SERVICE_BY_TH = {s[1]: s for s in SERVICES}
IN_SCOPE = 'เข้าเกณฑ์เบื้องต้น'
PENDING = 'รอตรวจ'
OUT_OF_SCOPE = 'นอกหมวดรอบนี้'
PROVIDER_OK = 'ยืนยันจากผู้ให้บริการ'
POINT_STATES = ['none', 'pin', 'otherDistrict', 'otherProvince', 'unusable']
EVIDENCE_PROVIDER = 'ผู้ให้บริการระบุ'
EXCLUDED = ['รหัส สช. (as a field; the public OPEC profile page is the link)', 'ที่อยู่ตามทะเบียน / ที่อยู่ตามแหล่ง',
            'raw registry points outside the listed district, malformed or outside Thailand', 'รหัสจังหวัด / อำเภอ / ตำบล (membership only)',
            'รหัส PDC', 'กลุ่มรอตรวจซ้ำ', 'ป้ายที่รอตรวจ · เหตุผลรอตรวจ / ขอบเขต', 'รหัส Playground and its links (29)',
            f'28 codes {PENDING} (held for review) and {OUT_OF_SCOPE} (outside the learning categories of this round)']


def read_tab(d, name):
    t = json.load(open(os.path.join(d, name + '.json'), encoding='utf-8'))
    if t.get('name') != name:
        sys.exit(f'{name}: unexpected tab file')
    return t


def tab_receipt(t):
    rows = t['rows']
    return {'gid': t['gid'], 'rows': len(rows) - 1, 'columns': t['ncols'],
            'sha256': hashlib.sha256(json.dumps(rows, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()}


def text(v):
    return re.sub(r'\s+', ' ', str(v or '').replace(' ', ' ')).strip()


def count_cell(v):
    v = text(v).replace(',', '')
    return int(v) if v.isdigit() else None


def number(v):
    try:
        return float(text(v).replace(',', ''))
    except ValueError:
        return None


def opec_type(v):
    """'15 กวดวิชา / 13 วิชาชีพ / —' → 'กวดวิชา · วิชาชีพ' (the register's main and secondary types, numbers dropped)."""
    parts = [re.sub(r'^\d+\s*', '', text(p)) for p in str(v or '').split('/')]
    return ' · '.join(p for p in parts if p and p != '—')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--tabs', required=True)
    ap.add_argument('--base-tabs', required=True)
    ap.add_argument('--index', required=True)
    ap.add_argument('--frames', required=True)
    ap.add_argument('--transit', required=True)
    ap.add_argument('--schools', required=True)
    ap.add_argument('--read-on', default='2026-11-06', help='date the tabs were read from the sheet')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()

    tabs = {n: read_tab(a.tabs, n) for n in TABS}
    receipts = {n: tab_receipt(t) for n, t in tabs.items()}

    # ---------- 28: the register and its classification ----------
    t28 = tabs['28_OPEC_NONFORMAL']['rows']
    h28 = {name: j for j, name in enumerate(t28[0])}
    need28 = ['รหัส สช.', 'ชื่อโรงเรียนตามทะเบียน', 'จังหวัด', 'เขต/อำเภอ', 'แขวง/ตำบล', 'บริการที่พบ', 'สถานะจัดหมวด', 'แหล่งทะเบียน',
              'วันที่ตรวจแหล่ง', 'ประเภท สช. หลัก / รอง', 'ชื่ออังกฤษตามทะเบียน', 'รหัสจังหวัด / อำเภอ / ตำบล', 'ละติจูดตามแหล่ง (ดิบ)', 'ลองจิจูดตามแหล่ง (ดิบ)']
    for k in need28:
        if k not in h28:
            sys.exit(f'28_OPEC_NONFORMAL: missing column {k}')
    reg = [r for r in t28[1:] if text(r[h28['รหัส สช.']])]
    by_code = {}
    for r in reg:
        c = text(r[h28['รหัส สช.']])
        if c in by_code:
            sys.exit(f'28_OPEC_NONFORMAL: code {c} twice')
        by_code[c] = r
    status = collections.Counter(text(r[h28['สถานะจัดหมวด']]) for r in reg)
    in_scope = {c: r for c, r in by_code.items() if text(r[h28['สถานะจัดหมวด']]) == IN_SCOPE}

    # ---------- 29: provider records ----------
    t29 = tabs['29_LEARNING_LINKS']['rows']
    h29 = {name: j for j, name in enumerate(t29[0])}
    providers = [r for r in t29[1:] if text(r[h29['สถานะ']]) == PROVIDER_OK]

    # ---------- 27: the published list = 28 in scope + 29 provider-confirmed ----------
    t27 = tabs['27_LEARNING_SERVICES']['rows']
    head_at = next((i for i, r in enumerate(t27) if text(r[0]) == 'รหัสรายการ'), None)
    if head_at is None:
        sys.exit('27_LEARNING_SERVICES: no result table')
    h27 = {name: j for j, name in enumerate(t27[head_at])}
    listed = [r for r in t27[head_at + 1:] if text(r[0])]
    summary = {text(r[0]): count_cell(r[1]) for r in t27[:head_at] if text(r[0])}
    summary.update({text(r[2]): count_cell(r[3]) for r in t27[:head_at] if len(r) > 3 and text(r[2])})
    summary.update({text(r[4]): count_cell(r[5]) for r in t27[:head_at] if len(r) > 5 and text(r[4])})
    codes27 = [text(r[0]) for r in listed]
    if len(set(codes27)) != len(codes27):
        sys.exit('27_LEARNING_SERVICES: a record twice')
    provider_ids = {text(r[h29['รหัสรายการ']]) for r in providers}
    if set(codes27) != set(in_scope) | provider_ids:
        sys.exit(f'27 ≠ 28 in scope + 29 providers ({len(set(codes27) ^ (set(in_scope) | provider_ids))} differ)')
    for r in listed:
        c = text(r[0])
        src = in_scope.get(c)
        if src is None:
            continue
        for k27, k28 in [('ชื่อสถานที่เรียนเสริม', 'ชื่อโรงเรียนตามทะเบียน'), ('จังหวัด', 'จังหวัด'), ('เขต/อำเภอ', 'เขต/อำเภอ'), ('แขวง/ตำบล', 'แขวง/ตำบล'), ('บริการที่พบ', 'บริการที่พบ')]:
            if text(r[h27[k27]]) != text(src[h28[k28]]):
                sys.exit(f'27 and 28 differ for {c}: {k27}')

    # ---------- geography ----------
    index = json.load(open(a.index, encoding='utf-8'))
    areas = index['areas']
    area_pos = {aid: i for i, aid in enumerate(areas['id'])}
    dopa_to_prov = {p['code']: p['id'] for p in index['provinces']}
    prov_by_name = {p['name']: p['id'] for p in index['provinces']}
    locator = bd.Locator(a.frames, [p['id'] for p in index['provinces']])

    # ---------- rail (the same CityMETER · Transit commit as data/schools.json) ----------
    schools = json.load(open(a.schools, encoding='utf-8'))
    rail_meta = schools['meta']['context']['rail']
    if bd.repo_commit(a.transit) != rail_meta['commit']:
        sys.exit('montri-th/transit checkout is not the commit data/schools.json was built with')
    transit = json.load(open(os.path.join(a.transit, 'data', 'transit.json'), encoding='utf-8'))
    operating = [{'id': s['id'], 'lat': s['lat'], 'lon': s['lng']} for s in transit['stations']
                 if s.get('status') == 'operating' and isinstance(s.get('lat'), (int, float)) and isinstance(s.get('lng'), (int, float))]
    school_station_ids = {s['id'] for s in schools['stations']}
    if not all(s['id'] in school_station_ids for s in operating):
        sys.exit('an operating station is missing from data/schools.json')
    grid = bd.Grid(operating)

    # ---------- overlap with the school UUIDs ----------
    s02 = read_tab(a.base_tabs, '02_SCHOOLS')['rows']
    oc = s02[0].index('official_school_code')
    base_codes = {text(r[oc]) for r in s02[1:] if text(r[oc])}
    overlap = sorted(set(in_scope) & base_codes)
    if overlap:
        sys.exit(f'{len(overlap)} learning codes are school codes of 02_SCHOOLS')

    # ---------- rows ----------
    cols = {k: [] for k in ('key', 'name', 'nameEn', 'svc', 'type', 'ev', 'district', 'province', 'lat', 'lon', 'rail', 'railM', 'url', 'src', 'pt')}
    types, evidence, districts, provinces, stations, urls = [], [], [], [], [], []

    def intern(lst, v):
        if v in lst:
            return lst.index(v)
        lst.append(v)
        return len(lst) - 1

    checks = collections.Counter()
    by_service = collections.Counter()
    by_province = collections.Counter()
    ev27 = {text(r[0]): text(r[h27['หลักฐานจัดหมวด']]) for r in listed}
    for r in listed:
        code = text(r[0])
        src = in_scope.get(code)
        if src is not None:
            pc, dc, _ = [text(x) for x in src[h28['รหัสจังหวัด / อำเภอ / ตำบล']].split('/')]
            prov = dopa_to_prov.get(pc)
            if not prov or dc not in area_pos or areas['province'][area_pos[dc]] != prov:
                sys.exit(f'{code}: district code {dc} is not a production district of province {pc}')
            if text(areas['name'][area_pos[dc]]).replace(' ', '') != text(src[h28['เขต/อำเภอ']]).replace(' ', ''):
                sys.exit(f'{code}: district name differs from the gazetteer')
            name, name_en = text(src[h28['ชื่อโรงเรียนตามทะเบียน']]), text(src[h28['ชื่ออังกฤษตามทะเบียน']])
            services = [text(s) for s in text(src[h28['บริการที่พบ']]).split('|') if text(s)]
            url = bd.opec_page(text(src[h28['แหล่งทะเบียน']]))
            if not url:
                sys.exit(f'{code}: no public OPEC profile page')
            kind = opec_type(src[h28['ประเภท สช. หลัก / รอง']])
            ev = ev27[code]
            key = 'L' + hashlib.sha256(f'opec:{code}'.encode()).hexdigest()[:12]
            la, lo = number(src[h28['ละติจูดตามแหล่ง (ดิบ)']]), number(src[h28['ลองจิจูดตามแหล่ง (ดิบ)']])
            raw_lat, raw_lon = text(src[h28['ละติจูดตามแหล่ง (ดิบ)']]), text(src[h28['ลองจิจูดตามแหล่ง (ดิบ)']])
            if not raw_lat and not raw_lon:
                pt = 'none'
            elif la is None or lo is None or not (5.5 < la < 20.6 and 97.3 < lo < 105.7):
                pt = 'unusable'
            else:
                p_found, d_found = locator.find(lo, la, [prov])
                if d_found == dc:
                    pt = 'pin'
                else:
                    p2, d2 = locator.find(lo, la, list(dopa_to_prov.values()))
                    pt = 'otherDistrict' if p2 == prov else 'otherProvince'
            source = 0
        else:
            p = next(x for x in providers if text(x[h29['รหัสรายการ']]) == code)
            prov = prov_by_name.get(text(p[h29['จังหวัด']]))
            cand = [aid for aid, ap_, an in zip(areas['id'], areas['province'], areas['name']) if ap_ == prov and text(an) == text(p[h29['เขต/อำเภอ']])]
            if not prov or len(cand) != 1:
                sys.exit(f'{code}: provider district not found')
            dc = cand[0]
            name, name_en = text(p[h29['ชื่อสถานที่เรียนเสริม']]), ''
            services = [text(s) for s in text(p[h29['บริการที่พบ']]).split('|') if text(s)]
            url = bd.public_url(text(p[h29['แหล่งอ้างอิง']]))
            kind, ev = '', EVIDENCE_PROVIDER
            key = 'L' + hashlib.sha256(f'provider:{code}'.encode()).hexdigest()[:12]
            la = lo = None
            pt = 'none'
            source = 1
        mask = 0
        for s in services:
            if s not in SERVICE_BY_TH:
                sys.exit(f'{code}: unknown service {s}')
            mask |= SERVICE_BY_TH[s][2]
            by_service[SERVICE_BY_TH[s][0]] += 1
        if not mask:
            sys.exit(f'{code}: no service')
        checks['point.' + pt] += 1
        by_province[prov] += 1
        keep = pt == 'pin'
        cols['key'].append(key)
        cols['name'].append(name)
        cols['nameEn'].append(name_en)
        cols['svc'].append(mask)
        cols['type'].append(intern(types, kind) if kind else -1)
        cols['ev'].append(intern(evidence, ev))
        cols['district'].append(intern(districts, dc))
        cols['province'].append(intern(provinces, prov))
        cols['lat'].append(round(la, 6) if keep else None)
        cols['lon'].append(round(lo, 6) if keep else None)
        st, m = grid.nearest(la, lo, bd.RAIL_MAX_M) if keep else (None, None)
        cols['rail'].append(intern(stations, st['id']) if st else -1)
        cols['railM'].append(round(m) if st else None)
        cols['url'].append(intern(urls, url) if url else -1)
        cols['src'].append(source)
        cols['pt'].append(POINT_STATES.index(pt))

    if len(set(cols['key'])) != len(cols['key']):
        sys.exit('key collision')
    n = len(cols['key'])
    counts = {'rows': n, 'opec': cols['src'].count(0), 'provider': cols['src'].count(1), 'points': checks['point.pin'],
              **{f'service.{k}': v for k, v in sorted(by_service.items())}, 'provinces': len(by_province), 'districts': len(set(cols['district'])),
              'register.codes': len(reg), 'register.inScope': len(in_scope), 'register.pending': status[PENDING], 'register.outOfScope': status[OUT_OF_SCOPE]}
    # The list's own summary (27, rows above the table) must equal what the rows say.
    expected = {'รหัส สช. เข้าเกณฑ์': counts['opec'], 'กวดวิชา': by_service['tutor'], 'ภาษา': by_service['language'], 'ศิลปะ': by_service['arts'],
                'พัฒนาการเด็ก': by_service['child'], 'รหัส สช. รอตรวจ': counts['register.pending'], 'นอกหมวดรอบนี้': counts['register.outOfScope'],
                'ข้อมูล สช. ทั้งหมด': counts['register.codes'], 'จากผู้ให้บริการ': counts['provider'], 'รายการเรียนเสริมทั้งหมด': n}
    for k, v in expected.items():
        if summary.get(k) != v:
            sys.exit(f'27 summary {k}: {summary.get(k)} ≠ {v}')
    checks['overlap.schoolCodes'] = len(overlap)

    meta = {
        'dataset': 'CityMETER School · เรียนเสริม', 'datasetTh': 'สถานที่เรียนเสริมและพัฒนาทักษะ', 'registryId': 'research.TH.school',
        'sheetTitle': bd.SHEET_TITLE, 'sheetStatus': 'research_master', 'readOn': a.read_on,
        'readMethod': schools['meta']['readMethod'], 'tabs': receipts,
        'checkedOn': max(bd.iso(text(r[h28['วันที่ตรวจแหล่ง']])) for r in in_scope.values()),
        'providerCheckedOn': max((bd.iso(text(r[h29['วันที่ตรวจแหล่ง']])) for r in providers), default=''),
        'builtOn': datetime.date.today().isoformat(), 'rows': n, 'counts': counts, 'checks': dict(sorted(checks.items())),
        'byProvince': dict(by_province.most_common()),
        'unit': {
            'row': 'one record of 27_LEARNING_SERVICES: an OPEC nonformal-school code classed เข้าเกณฑ์เบื้องต้น, or a provider-confirmed service point — a licence record of the register, not a field-verified count of places that teach today; one place may hold several codes',
            'services': 'the research team\'s preliminary labels from the OPEC type and the registered name (กวดวิชา · ภาษา · ศิลปะ · พัฒนาการเด็ก); a record may carry several; a total counts each record once',
            'separate': 'counted apart from the 40,828 school UUIDs of data/schools.json; no OPEC code is shared with 02_SCHOOLS (checked at build time)',
        },
        'districts': 'the DOPA district code of the register (28 รหัสจังหวัด / อำเภอ / ตำบล); the provider record by its district name',
        'points': {'rule': 'the OPEC registry point (raw in the source) kept only where it falls inside the district the register lists (data/frames, build time); otherwise not published', 'decimals': 6},
        'context': {'rail': {**rail_meta, 'rule': f"operating = on the operator roster of CityMETER · Transit; straight-line distance from the record's published point to the station reference point, up to {bd.RAIL_MAX_M} m"}},
        'excludedFields': EXCLUDED,
    }
    out = {'meta': meta, 'services': [{'id': s[0], 'th': s[1], 'bit': s[2]} for s in SERVICES], 'types': types, 'evidence': evidence,
           'pointStates': POINT_STATES, 'provinces': provinces, 'districts': districts, 'stations': stations, 'urls': urls, 'cols': cols}
    with open(os.path.join(a.out, 'data', 'learning.json'), 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    report = {'builtOn': meta['builtOn'], 'rows': n, 'counts': counts, 'checks': meta['checks'], 'tabs': {k: v['rows'] for k, v in receipts.items()}}
    with open(os.path.join(a.out, 'data', 'learning-report.json'), 'w', encoding='utf-8') as fh:
        json.dump(report, fh, ensure_ascii=False, indent=1, sort_keys=True)
        fh.write('\n')
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
