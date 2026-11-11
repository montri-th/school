#!/usr/bin/env python3
"""Build data/schools.json from the school research master, CityMETER production base info and CityMETER · Transit.

Inputs (internal, never committed):
  --tabs     directory of the research master's tabs as read in the owner's browser (scripts/export-sheet-tabs.js:
             <tab>.json = {name, gid, ncols, rows}, rows[0] = the header row) of “CityMETER School Thailand — Research
             Master 2026-10-31” (Google Sheets, registry id research.TH.school). The workbook is too large for a Drive
             export (35 MB); every tab is read cell by cell from the sheet's own HTML view and the SHA-256 of its rows
             (canonical JSON) is recorded in meta.tabs. Tabs read: 02_SCHOOLS, 03_CHILD_CENTERS, 99_SOURCE_2026,
             01_AFFILIATIONS, 15_RESEARCH_COVERAGE, 16_ENROLMENT, 20_SCHOOL_FEES, 10_SOURCES.
  --api      production base info with receipts (scripts/fetch-base.py: base-lv0.json, base-{uuid}.json)
Public inputs:
  --index    data/area-index.json (district gazetteer), --frames data/frames/ (district outlines, display geometry)
  --transit  a checkout of montri-th/transit (data/transit.json: rail stations of CityMETER · Transit)

Output: data/schools.json — columnar rows + dictionaries + provenance; data/build-report.json — counts and checks.

ONE ROW = one CityMETER school UUID of the 2026 baseline the owner confirmed (source_school_id): a row of 02_SCHOOLS
(35,252 schools and other institutions) or of 03_CHILD_CENTERS (5,576 child development centres, ศพด.). 40,828 rows,
as the sheet keeps them — including the one school with an official closure notice. Nothing is merged, split, moved or
re-labelled. It is a source roster, not a field-verified census of operating schools.

STUDENTS = student_count of the row (CityMETER 2026, positive values only): blank is unknown, never 0 (the source's raw
zeros are unknown, as the sheet says). Teachers and classrooms the same. A child development centre counts its
registered children. Not a capacity, a catchment, a demand or a per-person ratio.

DISTRICT (ADMIN METHODS, the first that applies)
  source    the production DISTRICT the source lists the school under (99_SOURCE_2026.district_id → production code)
  name      the row's district name is a production district of its province
  province  province only
A sheet point that lies in another district or province than the source's is kept (it is the sheet's point) and
counted for the research team (checks.pointDistrictDisagree, pointProvinceDisagree); membership is the source's.

POINTS = latitude/longitude of the row where coordinate_status says the point passed the sheet's extent check (an
ONESQA or OPEC registry point, not an entrance): 6 decimals. A row whose point is held stays without one: it counts in
its district and lists, never as a pin.

GROUPS (presentation; by affiliation type of 99_SOURCE_2026 and the sheet's institution category)
  public (สพฐ., 111) · local (อปท. schools 102, กรุงเทพมหานคร 109, เมืองพัทยา 110) · private (สช., 113) · international
  (สช. with an accepted OPEC record of type นานาชาติ: 15_RESEARCH_COVERAGE.accepted_cm_ids, or a linked 16_ENROLMENT
  snapshot of a โรงเรียนเอกชนนานาชาติ) · vocational (institution category อาชีวศึกษา) · nonformal (ส่งเสริมการเรียนรู้)
  · childcare (03_CHILD_CENTERS) · other (every other public affiliation). A school named “นานาชาติ” without such a
  link stays private: a group is never read from a name.

CONTEXT
  rail      nearest operating rail station of CityMETER · Transit and nearest station under construction, straight
            line from the sheet's point, within RAIL_MAX_M
Never: travel time, catchment, a population ratio or a market share.

FEES, QUALITY, HISTORY (as the sheet records them; a gap is never a low value or a free school)
  fee       02 tuition_annual_min/max (บาท/คน/ปี, tuition only) with grades, academic year and source; the per-grade
            tuition rows of 20_SCHOOL_FEES for the same school and academic year (fee_component tuition, annual amount)
  quality   02 evaluation_result (verbatim lines), evaluation_year_be, evaluation_authority (ONESQA); accreditation
            and curriculum summaries as written
  history   16_ENROLMENT: the reported grade sum of each semester 2565–2567 for schools linked by source_school_id

Not copied (meta.excludedFields): official school codes, record ids, identity statuses, review notes, count notes,
classification notes, coordinate source URLs and statuses beyond the point's role, supplemental statistics, internal
sheet / Drive / API URLs, raw source records. Source links are public https pages (OPEC school profiles, the ONESQA
open-data catalogue, schools' own fee pages); every row links to its district on CityMETER production (?d=school).
"""
import argparse, collections, datetime, glob, hashlib, json, math, os, re, sys, unicodedata

RAIL_MAX_M = 2000
TABS = ['02_SCHOOLS', '03_CHILD_CENTERS', '99_SOURCE_2026', '01_AFFILIATIONS', '15_RESEARCH_COVERAGE', '16_ENROLMENT',
        '20_SCHOOL_FEES', '10_SOURCES']
SHEET_TITLE = 'CityMETER School Thailand — Research Master 2026-10-31'

GROUPS = [
    ('public', 'โรงเรียนรัฐ สพฐ.', 'Public school (OBEC)'),
    ('local', 'โรงเรียนท้องถิ่นและกรุงเทพฯ', 'Local-government school'),
    ('private', 'โรงเรียนเอกชน', 'Private school'),
    ('international', 'โรงเรียนนานาชาติ', 'International school'),
    ('vocational', 'อาชีวศึกษา', 'Vocational college'),
    ('nonformal', 'ส่งเสริมการเรียนรู้ (สกร.)', 'Learning promotion centre'),
    ('childcare', 'ศูนย์พัฒนาเด็กเล็ก', 'Child development centre'),
    ('other', 'สถานศึกษารัฐอื่น', 'Other public institution'),
]
GROUP_INDEX = {g[0]: i for i, g in enumerate(GROUPS)}
# Affiliation types of CityMETER production (99_SOURCE_2026.affiliation_type_id), with the short name used on screen.
AFF_SHORT = {
    '101': 'ดย.', '102': 'อปท. (สถ.)', '103': 'กองทัพบก', '104': 'ตชด.', '105': 'มกช.', '106': 'มหิดลวิทยานุสรณ์',
    '107': 'บพศ.', '108': 'สปท.', '109': 'กทม.', '110': 'เมืองพัทยา', '111': 'สพฐ.', '112': 'สอศ.', '113': 'สช.',
    '114': 'อว.', '115': 'พศ.', '116': 'สกร.',
}
# Grade codes of the production source (99 raw_lowest/highest_grade_code) and the sheet's names for them.
GRADES = ['', 'อ.1', 'อ.2', 'อ.3', 'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6',
          'ปวช.1', 'ปวช.2', 'ปวช.3']
LEVELS = [('kinder', 'อนุบาล', 1, 3), ('primary', 'ประถม', 4, 9), ('lower', 'ม.ต้น', 10, 12), ('upper', 'ม.ปลาย · ปวช.', 13, 18)]
# Student-size bands of CityMETER production (SchoolSize: XS 1–19, S 20–119, M 120–719, L 720–1,679, XL 1,680–3,499,
# 3,500+). Unknown students stay out of every band.
SIZES = [('z1', 'ไม่ถึง 20 คน', 1, 19), ('z2', '20–119 คน', 20, 119), ('z3', '120–719 คน', 120, 719),
         ('z4', '720–1,679 คน', 720, 1679), ('z5', '1,680–3,499 คน', 1680, 3499), ('z6', '3,500 คนขึ้นไป', 3500, 10 ** 7)]
ADMIN = ['source', 'name', 'province', 'none']
COORD = {  # coordinate_status → what the point is (kept with the row; never upgraded)
    'จุดทะเบียนONESQAผ่านextent ไม่ใช่ทางเข้า': 'จุดทะเบียน สมศ. (ONESQA)',
    'จุดทะเบียนOPECผ่านextent ไม่ใช่ทางเข้า': 'จุดทะเบียน สช. (OPEC)',
}
OPEC_KINDS = ['สามัญศึกษา', 'นานาชาติ', 'อิสลามควบคู่สามัญ', 'การศึกษาสงเคราะห์', 'การกุศลของวัด', 'การศึกษาพิเศษ', 'ในพระราชูปถัมภ์']
HISTORY = [('2565', '1'), ('2565', '2'), ('2566', '1'), ('2566', '2'), ('2567', '1'), ('2567', '2')]
SOURCES = [
    ('production', 'CityMETER School (ชุดข้อมูลโรงเรียนของ CityMETER production ปี 2569)', 'https://landometer.com/v3/citymeter?d=school'),
]
EXCLUDED = ['official_school_code', 'school_record_id', 'identity_status', 'official_code_period', 'source_name_th',
            'review_note', 'count_data_note', 'classification_basis', 'coordinate_source_url', 'coordinate_extent_check',
            'supplemental_enrolment_* (BA:BF)', 'internal sheet / Drive / API URLs', '99_SOURCE_2026 raw records',
            '05_REVIEW_QUEUE', '04_SOURCE_CROSSWALK', '14_EXTERNAL_CANDIDATES', 'logo libraries (24–26)']


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def read_tabs(d):
    out, shas = {}, {}
    for t in TABS:
        tab = json.load(open(os.path.join(d, t + '.json'), encoding='utf-8'))
        rows = tab['rows']
        head = [h.strip() for h in rows[0]]
        if len(set(head)) != len(head):
            sys.exit(f'{t}: duplicate header')
        bad = sum(1 for r in rows if len(r) != len(head))
        if bad:
            sys.exit(f'{t}: {bad} rows with a cell count other than the header')
        out[t] = [dict(zip(head, r)) for r in rows[1:]]
        canon = json.dumps(rows, ensure_ascii=False, separators=(',', ':')).encode()
        shas[t] = {'gid': tab.get('gid'), 'rows': len(rows) - 1, 'columns': len(head), 'sha256': hashlib.sha256(canon).hexdigest()}
    return out, shas


def clean(s):
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', str(s or '')).replace('​', '').replace('\xa0', ' ')).strip()


def th_norm(s):
    s = unicodedata.normalize('NFC', str(s or '')).replace('​', '').replace('\xa0', ' ').replace('ํา', 'ำ').strip()
    s = re.sub(r'^(?:กิ่งอำเภอ|อำเภอ|เขต|อ\.)\s*', '', s)
    return re.sub(r'\s+', '', s)


def count(v):
    """A positive whole number as the sheet writes it, else None (blank = unknown, never 0)."""
    v = str(v or '').replace(',', '').strip()
    if not v:
        return None
    if not re.fullmatch(r'\d+(\.0+)?', v):
        sys.exit(f'count {v!r} is not a whole number')
    n = int(float(v))
    return n if n > 0 else None


def amount(v):
    v = str(v or '').replace(',', '').strip()
    return round(float(v), 2) if re.fullmatch(r'\d+(\.\d+)?', v) else None


def iso(d):
    """M/D/YYYY (the sheet's display format) → YYYY-MM-DD; '' when empty or unreadable."""
    m = re.fullmatch(r'\s*(\d{1,2})/(\d{1,2})/(\d{4})\s*', d or '')
    if not m:
        m2 = re.fullmatch(r'\s*(\d{4})-(\d{2})-(\d{2}).*', d or '')
        return f'{m2[1]}-{m2[2]}-{m2[3]}' if m2 else ''
    return f'{int(m[3]):04d}-{int(m[1]):02d}-{int(m[2]):02d}'


def haversine(lat1, lon1, lat2, lon2):
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


class Grid:
    """Points bucketed in ~0.02° cells for nearest-within-radius queries."""
    def __init__(self, items, cell=0.02):
        self.cell, self.cells = cell, collections.defaultdict(list)
        for it in items:
            self.cells[(int(it['lat'] // cell), int(it['lon'] // cell))].append(it)

    def nearest(self, lat, lon, max_m):
        reach = int(math.ceil((max_m / 111320) / self.cell)) + 1
        ci, cj = int(lat // self.cell), int(lon // self.cell)
        best, best_d = None, max_m + 1e-9
        for i in range(ci - reach, ci + reach + 1):
            for j in range(cj - reach, cj + reach + 1):
                for it in self.cells.get((i, j), ()):
                    d = haversine(lat, lon, it['lat'], it['lon'])
                    if d < best_d:
                        best, best_d = it, d
        return (best, best_d) if best else (None, None)


def ring_contains(ring, x, y):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


class Locator:
    """District outlines of data/frames, by province; display geometry (used for checks only)."""
    def __init__(self, frames_dir, provinces):
        self.by_province = collections.defaultdict(list)
        for code in provinces:
            frame = json.load(open(os.path.join(frames_dir, f'{code}.json'), encoding='utf-8'))
            for f in frame['areas']['features']:
                g = f['geometry']
                polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
                polys = [[[tuple(p) for p in ring] for ring in poly] for poly in polys]
                xs = [p[0] for poly in polys for p in poly[0]]
                ys = [p[1] for poly in polys for p in poly[0]]
                self.by_province[code].append((str(f['id']), polys, min(xs), min(ys), max(xs), max(ys)))

    def find(self, lon, lat, provinces):
        for code in provinces:
            for did, polys, w, s, e, n in self.by_province.get(code, ()):
                if lon < w or lon > e or lat < s or lat > n:
                    continue
                for poly in polys:
                    if ring_contains(poly[0], lon, lat) and not any(ring_contains(h, lon, lat) for h in poly[1:]):
                        return code, did
        return None, None


def public_url(u):
    u = (u or '').strip().split('\n')[0].strip()
    if not u.startswith('https://'):
        return ''
    if re.search(r'docs\.google\.com|drive\.google\.com|landometer\.com/api/|/papi/api/|localhost|\.local/|api-gis\.|powerbi\.com', u):
        return ''
    return u


def onesqa_page(u):
    """The ONESQA open-data catalogue's dataset page of a resource download (a public page, not the CSV)."""
    m = re.match(r'(https://catalog\.onesqa\.or\.th/dataset/[0-9a-f-]{36})', (u or '').strip())
    return m[1] if m else ''


def opec_page(*urls):
    for u in urls:
        m = re.match(r'(https://school\.opec\.go\.th/school/\d+)', (u or '').strip())
        if m:
            return m[1]
    return ''


def repo_commit(path):
    head = open(os.path.join(path, '.git', 'HEAD')).read().strip()
    if head.startswith('ref:'):
        ref = head.split(' ', 1)[1]
        p = os.path.join(path, '.git', ref)
        if os.path.exists(p):
            return open(p).read().strip()
        for line in open(os.path.join(path, '.git', 'packed-refs')):
            if line.strip().endswith(ref):
                return line.split()[0]
    return head


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--tabs', required=True)
    ap.add_argument('--api', required=True)
    ap.add_argument('--index', required=True)
    ap.add_argument('--frames', required=True)
    ap.add_argument('--transit', required=True)
    ap.add_argument('--read-on', default='2026-11-05', help='date the tabs were read from the sheet')
    ap.add_argument('--sheet-modified', default='2026-11-01T21:09:22Z', help="the sheet's Drive modifiedTime when read")
    ap.add_argument('--out', required=True)
    a = ap.parse_args()

    tabs, tab_shas = read_tabs(a.tabs)
    src = {r['source_school_id']: r for r in tabs['99_SOURCE_2026']}
    rows_in = [(r, False) for r in tabs['02_SCHOOLS']] + [(r, True) for r in tabs['03_CHILD_CENTERS']]
    if len(src) != len(tabs['99_SOURCE_2026']):
        sys.exit('99_SOURCE_2026: repeated source_school_id')

    # ---------- gazetteer (production base info) ----------
    lv0 = json.load(open(os.path.join(a.api, 'base-lv0.json'), encoding='utf-8'))['value']['provinceInfos']
    prov_by_th = {th_norm(p['nameTh']): p['abbrEn'] for p in lv0}
    prov_by_uuid = {p['id']: p['abbrEn'] for p in lv0}
    district_by_uuid, district_by_name, district_prov = {}, {}, {}
    for p in lv0:
        base = json.load(open(os.path.join(a.api, f"base-{p['id']}.json"), encoding='utf-8'))['value']
        for d in base['districtInfos']:
            district_by_uuid[d['id']] = d['code']
            district_by_name[(p['abbrEn'], th_norm(d['nameTh']))] = d['code']
            district_prov[d['code']] = p['abbrEn']
    receipts = {f: json.load(open(os.path.join(a.api, f), encoding='utf-8')) for f in sorted(os.listdir(a.api)) if f.endswith('.meta.json')}
    receipts_sha = hashlib.sha256(json.dumps(receipts, sort_keys=True).encode()).hexdigest()
    index = json.load(open(a.index, encoding='utf-8'))
    index_ids = set(index['areas']['id'])
    for code, prov in zip(index['areas']['id'], index['areas']['province']):
        if district_prov.get(code) != prov:
            sys.exit(f'area index district {code} does not match the production gazetteer')
    locator = Locator(a.frames, [p['id'] for p in index['provinces']])

    # ---------- transit ----------
    transit_path = os.path.join(a.transit, 'data', 'transit.json')
    transit = json.load(open(transit_path, encoding='utf-8'))
    tlines = {l['id']: l for l in transit['lines']}
    stations = []
    for s in transit['stations']:
        if not (isinstance(s.get('lat'), (int, float)) and isinstance(s.get('lng'), (int, float))):
            continue
        if s.get('status') not in ('operating', 'construction'):
            continue
        stations.append({'id': s['id'], 'name': s['name'], 'nameEn': s.get('nameEn') or '', 'lat': s['lat'], 'lon': s['lng'], 'status': s['status'],
                         'lines': [tlines[l]['short'] or tlines[l]['name'] for l in s.get('lineIds', []) if l in tlines],
                         'lineIds': s.get('lineIds', [])})
    stations.sort(key=lambda s: s['id'])
    for i, s in enumerate(stations):
        s['i'] = i
    grid_op = Grid([s for s in stations if s['status'] == 'operating'])
    grid_cx = Grid([s for s in stations if s['status'] == 'construction'])

    # ---------- affiliations ----------
    aff_rows = {r['affiliation_type_id']: r for r in tabs['01_AFFILIATIONS']}
    aff_ids = sorted(aff_rows)
    if set(aff_ids) != set(AFF_SHORT):
        sys.exit(f'01_AFFILIATIONS: affiliation types {aff_ids} differ from the known set')

    # ---------- OPEC records (15) and enrolment history (16) ----------
    opec_kind, opec_profile = {}, {}
    for r in tabs['15_RESEARCH_COVERAGE']:
        for cid in json.loads(r['accepted_cm_ids'] or '[]'):
            if cid in opec_kind and opec_kind[cid] != r['school_type']:
                sys.exit(f'15_RESEARCH_COVERAGE: {cid} has two school types')
            opec_kind[cid] = clean(r['school_type'])
            opec_profile[cid] = opec_page(r['official_profile_url'])
    unknown_kinds = {k for k in opec_kind.values() if k not in OPEC_KINDS}
    if unknown_kinds:
        sys.exit(f'15_RESEARCH_COVERAGE: school types {unknown_kinds}')
    hist = collections.defaultdict(dict)
    intl16 = set()
    for r in tabs['16_ENROLMENT']:
        cid = r['source_school_id'].strip()
        if not cid:
            continue
        if cid not in src:
            sys.exit(f'16_ENROLMENT: {cid} is not a baseline school')
        k = (r['academic_year_be'], r['semester'])
        if k not in HISTORY:
            sys.exit(f'16_ENROLMENT: period {k}')
        n = count(r['reported_grade_sum'])
        if k in hist[cid] and hist[cid][k] != n:
            sys.exit(f'16_ENROLMENT: {cid} has two values for {k}')
        hist[cid][k] = n
        if r['organization_type_name'] == 'โรงเรียนเอกชนนานาชาติ':
            intl16.add(cid)

    # ---------- fees (02 summary + 20 per grade) ----------
    fee_items = collections.defaultdict(list)
    for r in tabs['20_SCHOOL_FEES']:
        if r['fee_component'] != 'tuition' or r['currency'] != 'THB':
            continue
        if not r['identity_binding_status'].startswith('accepted_'):
            continue
        v = amount(r['annual_amount'])
        if not v:
            continue
        for cid in json.loads(r['accepted_cm_ids'] or '[]'):
            fee_items[cid].append({'year': clean(r['academic_year']), 'scope': clean(r['applied_grade_scope']),
                                   'programme': clean(r['programme']), 'campus': clean(r['campus']), 'v': v,
                                   'url': public_url(r['source_url'])})

    # ---------- rows ----------
    cols = {k: [] for k in ('key', 'name', 'nameEn', 'group', 'aff', 'kind', 'students', 'teachers', 'classrooms', 'lo', 'hi',
                            'province', 'district', 'admin', 'lat', 'lon', 'coord', 'src', 'url', 'rail', 'railM', 'rail2',
                            'rail2M', 'q', 'qy', 'qurl', 'tmin', 'tmax')}
    urls, url_index = [], {}
    provinces_list, prov_i = [], {}
    districts_list, dist_i = [], {}
    quality_texts, quality_i = [], {}
    kinds_list = ['', 'โรงเรียน/สถานศึกษาอื่น', 'อาชีวศึกษา', 'ส่งเสริมการเรียนรู้', 'ศูนย์พัฒนาเด็ก/ศพด.'] + ['สช. · ' + k for k in OPEC_KINDS]
    extra = {'fee': {}, 'feeEvidence': {}, 'prog': {}, 'hist': {}, 'closed': {}}
    counts = collections.Counter()
    checks = collections.Counter()
    disagree_province = []

    def intern(lst, idx, v):
        if v not in idx:
            idx[v] = len(lst)
            lst.append(v)
        return idx[v]

    seen = set()
    for r, is_centre in rows_in:
        cid = r['source_school_id'].strip()
        if not cid or cid in seen:
            sys.exit(f'repeated or empty source_school_id {cid!r}')
        seen.add(cid)
        x = src.get(cid)
        if x is None:
            sys.exit(f'{cid}: not in 99_SOURCE_2026')
        aff = x['affiliation_type_id']
        if aff not in AFF_SHORT:
            sys.exit(f'{cid}: affiliation type {aff!r}')
        cat = clean(r['institution_category'])
        # group
        if is_centre:
            if cat != 'ศูนย์พัฒนาเด็ก/ศพด.':
                sys.exit(f'{cid}: 03_CHILD_CENTERS row of category {cat!r}')
            group = 'childcare'
        elif cat == 'อาชีวศึกษา':
            group = 'vocational'
        elif cat == 'ส่งเสริมการเรียนรู้':
            group = 'nonformal'
        elif cat != 'โรงเรียน/สถานศึกษาอื่น':
            sys.exit(f'{cid}: category {cat!r}')
        elif aff == '111':
            group = 'public'
        elif aff in ('102', '109', '110'):
            group = 'local'
        elif aff == '113':
            group = 'international' if (opec_kind.get(cid) == 'นานาชาติ' or cid in intl16) else 'private'
        else:
            group = 'other'
        if group == 'international' and opec_kind.get(cid) != 'นานาชาติ':
            counts['international.from16only'] += 1
        kind = cat if not opec_kind.get(cid) else 'สช. · ' + opec_kind[cid]
        if kind not in kinds_list:
            sys.exit(f'{cid}: kind {kind!r}')
        # counts (as written; checked against the production snapshot)
        students, teachers, classrooms = count(r['student_count']), count(r['teacher_count']), count(r['classroom_count'])
        for mine, raw in ((students, 'raw_student_count'), (teachers, 'raw_teacher_count'), (classrooms, 'raw_classroom_count')):
            if mine != count(x[raw]):
                sys.exit(f'{cid}: {raw} differs from the sheet')
        # grades
        lo = GRADES.index(r['lowest_grade']) if r['lowest_grade'] in GRADES else (0 if r['lowest_grade'] == 'ยังไม่ทราบ' else -9)
        hi = GRADES.index(r['highest_grade']) if r['highest_grade'] in GRADES else (0 if r['highest_grade'] == 'ยังไม่ทราบ' else -9)
        if lo < 0 or hi < 0 or str(lo) != x['raw_lowest_grade_code'] or str(hi) != x['raw_highest_grade_code']:
            sys.exit(f"{cid}: grades {r['lowest_grade']!r}–{r['highest_grade']!r} vs codes {x['raw_lowest_grade_code']}–{x['raw_highest_grade_code']}")
        if (lo == 0) != (hi == 0) or (lo and hi < lo):
            sys.exit(f'{cid}: grade range {lo}–{hi}')
        # province and district
        prov = prov_by_th.get(th_norm(r['province']))
        if not prov or prov_by_uuid.get(x['province_id']) != prov:
            sys.exit(f"{cid}: province {r['province']!r} / {x['province_id']}")
        admin, dcode = 'none', ''
        sd = district_by_uuid.get(x['district_id'])
        if sd and district_prov[sd] == prov:
            admin, dcode = 'source', sd
        elif district_by_name.get((prov, th_norm(r['district']))):
            admin, dcode = 'name', district_by_name[(prov, th_norm(r['district']))]
        else:
            admin = 'province'
        if dcode and dcode not in index_ids:
            sys.exit(f'{cid}: district {dcode} is not in the area index')
        counts['admin.' + admin] += 1
        # point
        lat = lon = None
        coord = -1
        cs = r['coordinate_status']
        if cs in COORD:
            la, lo_ = amount(r['latitude']), amount(r['longitude'])
            try:
                la, lo_ = float(r['latitude']), float(r['longitude'])
            except ValueError:
                sys.exit(f'{cid}: point {r["latitude"]!r},{r["longitude"]!r}')
            if not (5 <= la <= 21 and 97 <= lo_ <= 106):
                sys.exit(f'{cid}: point outside Thailand')
            lat, lon = round(la, 6), round(lo_, 6)
            coord = list(COORD).index(cs)
            fp, fd = locator.find(lon, lat, [prov])
            if not fp:
                fp, fd = locator.find(lon, lat, [p for p in prov_by_uuid.values() if p != prov])
                if fp:
                    checks['pointProvinceDisagree'] += 1
                    disagree_province.append(cid)
                else:
                    checks['pointOutsideFrames'] += 1
            elif dcode and fd != dcode:
                checks['pointDistrictDisagree'] += 1
            counts['points'] += 1
        elif r['latitude'].strip() or r['longitude'].strip():
            sys.exit(f'{cid}: a point without an accepted coordinate status ({cs!r})')
        # rail
        rail = rail2 = railm = rail2m = -1
        if lat is not None:
            st, d = grid_op.nearest(lat, lon, RAIL_MAX_M)
            if st:
                rail, railm = st['i'], int(round(d))
            st, d = grid_cx.nearest(lat, lon, RAIL_MAX_M)
            if st:
                rail2, rail2m = st['i'], int(round(d))
        # source link: the school's OPEC profile when it has one
        link = opec_profile.get(cid) or opec_page(r['name_source_url'], r['official_code_source_url'], r['coordinate_source_url'])
        ui = intern(urls, url_index, link) if link else -1
        # quality (verbatim; one result per row as the sheet selected it)
        res = clean(r['evaluation_result'])
        q = qy = qurl = -1
        if res:
            if r['evaluation_authority'] != 'ONESQA':
                sys.exit(f'{cid}: evaluation authority {r["evaluation_authority"]!r}')
            q = intern(quality_texts, quality_i, res)
            qy = int(r['evaluation_year_be'])
            page = onesqa_page(r['evaluation_source_url'])
            qurl = intern(urls, url_index, page) if page else -1
            counts['quality'] += 1
        elif r['evaluation_year_be'].strip():
            sys.exit(f'{cid}: evaluation year without a result')
        # tuition (02 summary) and per-grade rows (20)
        tmin, tmax = amount(r['tuition_annual_min']), amount(r['tuition_annual_max'])
        i = len(cols['key'])
        k = str(i)
        if tmin or tmax:
            if not (tmin and tmax and tmin <= tmax) or r['tuition_period'] != 'บาท/คน/ปี ค่าเรียนเท่านั้น':
                sys.exit(f'{cid}: tuition {tmin}–{tmax} {r["tuition_period"]!r}')
            year = clean(r['fee_academic_year'])
            items = [it for it in fee_items.get(cid, []) if it['year'] == year]
            seen_items, keep = set(), []
            for it in sorted(items, key=lambda it: (it['v'], it['scope'])):
                key = (it['scope'], it['programme'], it['campus'], it['v'])
                if key in seen_items:
                    continue
                seen_items.add(key)
                keep.append([it['scope'], it['v'], it['programme'] if it['programme'] not in ('as published', 'ตามประกาศ') else '', it['campus']])
            page = public_url(r['fee_source_url'])
            extra['fee'][k] = {'min': tmin, 'max': tmax, 'year': year, 'grades': clean(r['fee_reference_grades']),
                               'url': intern(urls, url_index, page) if page else -1, 'items': keep[:24], 'more': max(0, len(keep) - 24)}
            counts['tuition'] += 1
            counts['tuition.items'] += len(keep)
        elif r['fee_status'] == 'มีหลักฐานค่าธรรมเนียมบางรายการ/รอตรวจเงื่อนไข':
            page = public_url(r['fee_source_url'])
            if page:
                extra['feeEvidence'][k] = intern(urls, url_index, page)
                counts['feeEvidence'] += 1
        cur, acc = clean(r['curriculum_summary']), clean(r['accreditation_summary'])
        if cur or acc:
            extra['prog'][k] = [cur, acc]
            counts['programmes'] += 1
        if cid in hist:
            extra['hist'][k] = [hist[cid].get(p) for p in HISTORY]
            counts['history'] += 1
        if r['operating_status'] == 'closed_official_announcement':
            page = public_url(r['operation_source_url'])
            extra['closed'][k] = [iso(r['operation_effective_date']), intern(urls, url_index, page) if page else -1]
            counts['closed'] += 1
        elif r['operating_status'] != 'source_listed_current_operation_not_verified':
            sys.exit(f'{cid}: operating status {r["operating_status"]!r}')
        name = clean(r['school_name_th'])
        name_en = clean(r['school_name_en'])
        cols['key'].append(cid)
        cols['name'].append(name)
        cols['nameEn'].append(name_en if name_en and name_en != name else '')
        cols['group'].append(GROUP_INDEX[group])
        cols['aff'].append(aff_ids.index(aff))
        cols['kind'].append(kinds_list.index(kind))
        cols['students'].append(students or -1)
        cols['teachers'].append(teachers or -1)
        cols['classrooms'].append(classrooms or -1)
        cols['lo'].append(lo)
        cols['hi'].append(hi)
        cols['province'].append(intern(provinces_list, prov_i, prov))
        cols['district'].append(intern(districts_list, dist_i, dcode) if dcode else -1)
        cols['admin'].append(ADMIN.index(admin))
        cols['lat'].append(lat)
        cols['lon'].append(lon)
        cols['coord'].append(coord)
        cols['src'].append(0)
        cols['url'].append(ui)
        cols['rail'].append(rail)
        cols['railM'].append(railm)
        cols['rail2'].append(rail2)
        cols['rail2M'].append(rail2m)
        cols['q'].append(q)
        cols['qy'].append(qy)
        cols['qurl'].append(qurl)
        cols['tmin'].append(tmin or -1)
        cols['tmax'].append(tmax or -1)
        counts['rows'] += 1
        counts['group.' + group] += 1
        counts['students.known'] += bool(students)
        counts['students.sum'] += students or 0
        counts['teachers.known'] += bool(teachers)
        counts['classrooms.known'] += bool(classrooms)
        counts['grades.known'] += bool(lo)

    # Reconcile with the sheet's own affiliation counts (01_AFFILIATIONS).
    by_aff = collections.Counter(aff_ids[i] for i in cols['aff'])
    centres = collections.Counter(aff_ids[i] for i, g in zip(cols['aff'], cols['group']) if g == GROUP_INDEX['childcare'])
    for aid, r in aff_rows.items():
        if int(r['approved_source_records'].replace(',', '')) != by_aff[aid] or int(r['child_center_records'].replace(',', '')) != centres[aid]:
            sys.exit(f'01_AFFILIATIONS: counts of {aid} differ from the rows ({by_aff[aid]}, {centres[aid]} centres)')
    if counts['rows'] != len(src):
        sys.exit('rows differ from 99_SOURCE_2026')

    # Every operating station (the map draws them and each opens its 500 m panel) and the stations under construction
    # some school names as its nearest.
    used = sorted({v for v in cols['rail'] + cols['rail2'] if v >= 0} | {s['i'] for s in stations if s['status'] == 'operating'})
    remap = {old: new for new, old in enumerate(used)}
    out_stations = [{k: (round(stations[o][k], 6) if k in ('lat', 'lon') else stations[o][k])
                     for k in ('id', 'name', 'nameEn', 'lat', 'lon', 'status', 'lines', 'lineIds')} for o in used]
    for k in ('rail', 'rail2'):
        cols[k] = [remap[v] if v >= 0 else -1 for v in cols[k]]
    counts['stations.operating'] = sum(1 for s in out_stations if s['status'] == 'operating')
    counts['stations.construction'] = sum(1 for s in out_stations if s['status'] == 'construction')

    checked = sorted({iso(r['checked_on']) for r, _ in rows_in if iso(r['checked_on'])})
    meta = {
        'dataset': 'CityMETER School', 'datasetTh': 'โรงเรียนและสถานศึกษาในประเทศไทย', 'registryId': 'research.TH.school',
        'registryRole': 'Living · TH', 'productDataset': 'school', 'sheetTitle': SHEET_TITLE, 'sheetStatus': 'research_master',
        'sheetModified': a.sheet_modified, 'readOn': a.read_on,
        'readMethod': "the sheet's HTML view read cell by cell in the owner's browser (scripts/export-sheet-tabs.js); SHA-256 of each tab's rows as canonical JSON",
        'tabs': tab_shas, 'checkedOn': checked[-1] if checked else '', 'sourceYear': 2026,
        'builtOn': datetime.date.today().isoformat(), 'rows': counts['rows'], 'counts': dict(sorted(counts.items())),
        'checks': dict(sorted(checks.items())), 'pointProvinceDisagreeSample': disagree_province[:20],
        'unit': {
            'row': 'one CityMETER school UUID of the 2026 baseline (02_SCHOOLS or 03_CHILD_CENTERS) — a source roster record, not a field-verified census of operating schools',
            'students': 'student_count of CityMETER 2026, positive values only; blank is unknown, never 0; a child development centre counts its registered children',
            'fee': 'annual tuition in THB per student per academic year, tuition only, for the grades and year the school published; not the total cost of a year, a price level or a quality level',
            'quality': 'the latest ONESQA external-assessment result the sheet selected (B.E. 2564–2567), verbatim, with its year; not a current quality level or a ranking',
            'history': 'the reported grade sum of OPEC private-school snapshots, semesters 1–2 of B.E. 2565–2567; not 2026 figures',
        },
        'adminMethods': {'source': 'the production district the source lists the school under', 'name': "the row's district name is a production district of its province",
                         'province': 'province only', 'none': 'no province'},
        'districts': 'CityMETER production base info (lv0/lv1, receipts in data/boundary-receipts.json) + district outlines of data/frames/{CODE}.json',
        'points': {'rule': 'the sheet\'s point where coordinate_status passed the extent check (ONESQA or OPEC registry point, not an entrance)', 'decimals': 6},
        'gazetteer': {'receipts': len(receipts), 'receiptsSha256': receipts_sha},
        'context': {
            'rail': {'source': 'CityMETER · Transit (montri-th/transit)', 'commit': repo_commit(a.transit), 'file': 'data/transit.json',
                     'sha256': sha256_file(transit_path), 'release': (transit.get('meta') or {}).get('release', ''), 'asOf': (transit.get('meta') or {}).get('asOf', ''),
                     'rule': 'operating = on the operator roster of CityMETER · Transit; construction = a project station, not a service; straight-line distance from the school point to the station reference point, up to %d m' % RAIL_MAX_M},
        },
        'notes': ['Distances to rail stations are straight-line distances between reference points.',
                  'A gap (no tuition, no assessment result, no history) is not a low value or a free school: most rows have not been researched for it.'],
        'excludedFields': EXCLUDED,
    }
    out = {
        'meta': meta,
        'groups': [{'id': g[0], 'th': g[1], 'en': g[2]} for g in GROUPS],
        'affiliations': [{'id': aid, 'th': clean(aff_rows[aid]['affiliation_name_th']), 'short': AFF_SHORT[aid]} for aid in aff_ids],
        'kinds': kinds_list, 'grades': GRADES,
        'levels': [{'id': l[0], 'th': l[1], 'lo': l[2], 'hi': l[3]} for l in LEVELS],
        'sizes': [{'id': s[0], 'th': s[1], 'min': s[2], 'max': s[3] if s[3] < 10 ** 7 else None} for s in SIZES],
        'coordRoles': list(COORD.values()), 'history': [f'{y}/{s}' for y, s in HISTORY],
        'sources': [{'id': s[0], 'th': s[1], 'url': s[2]} for s in SOURCES],
        'stations': out_stations, 'urls': urls, 'provinces': provinces_list, 'districts': districts_list,
        'qualityTexts': quality_texts, 'vocab': {'admin': ADMIN},
        **extra,
        'cols': cols,
    }
    os.makedirs(os.path.join(a.out, 'data'), exist_ok=True)
    with open(os.path.join(a.out, 'data', 'schools.json'), 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    report = {'builtOn': meta['builtOn'], 'rows': counts['rows'], 'counts': meta['counts'], 'checks': meta['checks'],
              'stations': len(out_stations), 'tabs': {k: v['rows'] for k, v in tab_shas.items()}}
    with open(os.path.join(a.out, 'data', 'build-report.json'), 'w', encoding='utf-8') as fh:
        json.dump(report, fh, ensure_ascii=False, indent=1, sort_keys=True)
        fh.write('\n')
    print(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
