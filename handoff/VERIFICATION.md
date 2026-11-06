# CityMETER School — verification

## Release 0.2.0 — learning services

Release 0.2.0 (cache tag `20261106-r2`; `-r1` was the first deploy of the day, see §5), built 2026-11-06 on the owner's request of the same day (“เพิ่ม … 27_LEARNING_SERVICES
และข้อมูลที่อัพเดทเพิ่มมาในชีทด้วย”; the district level, the third measure and checked pins chosen by the owner). Tabs
27–29 of the research master were read cell by cell on 2026-11-06; the school tabs read again the same day differ from the
5 Nov read only in how 97 multi-link cells render their line breaks and in one no-break space (DATA_METHOD.md §12), so
`data/schools.json` is byte-identical to 0.1.0. Everything 0.1.0 verified below stands; this part covers what 0.2.0 adds.

### 0.2.0 · 1. Data build — every reconciliation passes

`python3 -I scripts/build-learning.py …` (DATA_METHOD.md §13 step 5, §14) stops on any failure; this build passed all of them:

- 3,495 rows = `27_LEARNING_SERVICES` = `28_OPEC_NONFORMAL` in scope (3,494 of 8,227 codes; 277 held for review and 4,456
  outside the learning categories are not published) + `29_LEARNING_LINKS` provider-confirmed (1); every field of an OPEC
  row equals its row in 28; the list's own summary equals the counts computed from its rows.
- Every district code is in `data/area-index.json`, inside its province, under the name the register gives; no OPEC code is
  shared with `02_SCHOOLS` (0); the same CityMETER · Transit commit as the schools (`5f5232d0`).
- Services: กวดวิชา 1,880 · ภาษา 1,287 · ศิลปะ 553 · พัฒนาการเด็ก 8 (overlapping); 76 provinces, 350 districts.
- Pins: 680 records whose registry point lies inside the district outline the register lists. Reported, not patched:
  2,588 without a point, 158 in another district, 64 in another province, 5 unusable values — all counted in their
  district (`meta.checks`). No address, no OPEC code as a field, no review field (`tests/learning.test.js`).

### 0.2.0 · 2. Unit tests on the real data — 134 pass, 0 fail

`npm test` (Node 22): the 0.1.0 suite (labels now carry the services) and `tests/learning.test.js` (9): data contract,
points inside the district outlines and rail ≤ 2 km, the measure and its filters, the learning Aha fixture (ปทุมวัน 94 ·
คลองเตย 57 · ประเวศ 56 = 207 of Bangkok's 960 = 22%; rail 39/57 against 88/262, records with a pin only; outside
เมืองเชียงใหม่ 95; the 41-sample `count` scale, every district fill one of its samples), the learning views (one provenance
line, no caveat), the learning context of the school views, pins, charts and Google actions.

### 0.2.0 · 3. LDS

No analytical value changed: the learning measure reads the LDS `count` family (all 41 samples) and series 8 of
`landometer-series-10-v8`; `assets/theme.css`, the LUTs of `js/scales.js` and `js/cues.js` are those of 0.1.0, so its
parity record (§3 below) applies. The pictogram subset grew to 34 glyphs (learning, tutor, language, arts, child from the
same source font; 4,892 B, SHA-256 `0c18b9ac…`, URL `?v=0c18b9ac`, `tests/icons.test.js`).

### 0.2.0 · 4. Rendered QA (build container)

The 0.1.0 harness (no basemap in the container, data layers real), desktop 1440 × 900 and phone 390 × 844, light and dark;
no console error:

- `?metric=learning`: “22% ของสถานที่เรียนเสริมกรุงเทพมหานคร อยู่ใน 3 เขตนี้” ปทุมวัน · คลองเตย · ประเวศ, 207 จาก 960 แห่ง,
  the rail bars 68% (39 จาก 57 แห่ง) · 34% (88 จาก 262 แห่ง), the outside finding เมืองเชียงใหม่ 95 แห่ง, the legend 1–95
  with the zero swatch, the three districts filled; the phone dock in dark and light.
- `?metric=learning&area=1007` (phone light): เขตปทุมวัน 94 แห่ง · 29 มีหมุด · 10% ของกรุงเทพมหานคร · 93% ใกล้รถไฟฟ้า
  (27 จาก 29), อันดับ 2 จาก 350; the service bars filter the map; the table (5 columns, 94 rows).
- `?learn=L40cbe1edaf23`: the services and the สช. type as chips, the district, หัวลำโพง 840 ม., the schools with a pin
  within 1 km (10 แห่ง · 9,180 คน, nearest first), one provenance line.
- `?school=a3f417ac-…` (เตรียมอุดมศึกษา): the learning records of เขตปทุมวัน by service and the pinned ones within 1 km
  nearest first, “ดูเรียนเสริมบนแผนที่”; the provenance line adds ทะเบียนโรงเรียนนอกระบบ สช. (เรียนเสริม).
- `?metric=learning&service=language`: 26% (106 จาก 406 แห่ง) in ปทุมวัน · คลองเตย · วัฒนา, outside เมืองภูเก็ต 51; the
  charts tray: districts × 4 services with the service pictograms, the service bars.
- The default first screen is unchanged (12% … 106,163 จาก 916,683 คน) with the third radio beside นักเรียน | สถานศึกษา.
- Fixed during QA: the district chips showed the students pictogram under the learning measure; the phone legend title was
  cut by 4 px under the learning measure (dock gaps and the zero swatch tightened).

### 0.2.0 · 5. Live

GitHub Pages (main / root), 2026-11-06:

- `9896285` (cache tag `20261106-r1`): `npm run verify:live` (2026-11-06T05:10:54Z) **246 ok, 0 failed**. The walk of that
  build (desktop dark `?metric=learning`, desktop light `?learn=…`, phone light `?school=…`, phone dark `?metric=learning`)
  found one wording slip: the legend named the building holding a learning record's pin “อาคารของสถานศึกษา”. Fixed in
  `05c4759` (“อาคารของสถานที่เรียนเสริม”, cache tag `20261106-r2`).
- `05c4759`: `npm run verify:live` (2026-11-06T05:16:24Z) **246 ok, 0 failed** — every published file of the manifest
  byte-identical (SHA-256) on https://montri-th.github.io/school/ (`evidence/live-attestation.json`, not committed).
- Walk of `05c4759` in the owner's Chrome with the real basemap, terrain and building tiles, in same-origin frames of the
  live site at 1440 × 900 and 390 × 844 as in 0.1.0 (the window is 1280 × 699): desktop dark — `?learn=L40cbe1edaf23`: the
  map turned 3D and framed the CityMETER Building V4 building holding the pin in two-point perspective (legend
  “อาคารของสถานที่เรียนเสริม”, attribution “อาคาร: CityMETER Building V4”), the record with “อีก 1 แห่งในอาคารนี้” and
  the other records of เขตปทุมวัน (93: กวดวิชา 38 · ภาษา 40 · ศิลปะ 19); desktop light — `?metric=learning` (22%, 68% · 34%);
  phone light — `?metric=learning&area=1007` with the sheet open (94 · 29 มีหมุด · 10% · 93%); phone dark —
  `?school=a3f417ac-…` in 3D with its learning section (94 in the district, 23 pinned within 1 km). Launch state `ready`
  in every view, no map failure, no console error; the viewer's theme setting was put back to “auto”.

## Release 0.1.0

Release 0.1.0 (cache tag `20261105-r1`), built 2026-11-05 from the research master as it stood on 2026-11-01 (read
cell by cell on 2026-11-05). The code base is CityMETER · Hotel 0.3.6 (montri-th/hotel @177e592f); the contracts the two
share were verified there (map engine, building view, terrain, guards) and are carried unchanged — this record covers
what School changes: the data, the measure, the panels, the labels, the legend, the filters and the publication.

### 1. Data build — every reconciliation passes

`python3 -I scripts/build-data.py …` (DATA_METHOD.md §13) stops on any failure; this build passed all of them:

- 40,828 rows = `02_SCHOOLS` 35,252 + `03_CHILD_CENTERS` 5,576 = `99_SOURCE_2026` 40,828; one UUID per row.
- Affiliation counts and child-centre counts of every one of the 16 affiliations equal `01_AFFILIATIONS`.
- Grades of `02_SCHOOLS` equal the source's grade codes for every row; tuition periods are บาท/คน/ปี ค่าเรียนเท่านั้น
  and min ≤ max for all 86 schools; every ONESQA result comes with its year and authority.
- Every district of the area index matches the production gazetteer; the 78 base-info responses of 2026-11-05 are
  byte-identical (SHA-256) to the CityMETER · Hotel read of 2026-11-01.
- Reported, not patched: 52 points in another district than the source's, 10 in another province, 1 outside every
  frame (`meta.checks`).

### 2. Unit tests on the real data — 125 pass, 0 fail

`npm test` (Node 22): data contract (rows, measure, groups, affiliations, levels, membership, points, rail, tuition,
assessment, history, closure, hygiene, boundaries and receipts) · first Aha fixtures (students and records) · district
and province models (EVID-05) · every panel view (one provenance line, no caveat, no “0 คน”) · comparison set · charts ·
breadcrumb (`?d=school`) · categorical cues · labels and pins · scales · icon fonts (content-addressed) · camera,
massing, building join and units, x-ray, MapLibre guards (carried from Hotel) · release (one cache tag, one version,
schema-valid handoff JSON, publication hygiene).

### 3. LDS and Location Intelligence parity

`assets/theme.css` is byte-identical to CityMETER · Hotel 0.3.6, and the analytical values of `js/scales.js` and the
series of `js/cues.js` are the same (only labels, defaults and the group → series binding changed), so the Hotel parity
run (124 checks against the LDS base file and the Location Intelligence Profile) applies unchanged. The two source files
are not in this workspace; `npm run check:lds -- --lds <base> --li <profile>` re-runs it where they are.

### 4. Rendered QA (build container)

Playwright with MapLibre 5.6.2 from the npm package; OpenFreeMap, unpkg and the DEM answered empty in the container (no
basemap, no OSM buildings), the data layers real. Desktop 1440 × 900 light and dark, phone 390 × 844 light and dark:

- First screen: “12% ของนักเรียนกรุงเทพมหานคร อยู่ใน 3 เขตนี้” with ลาดกระบัง · สายไหม · บางกะปิ, 106,163 จาก 916,683 คน,
  the two rail bars (1% · 17%), the outside finding, the 41-sample legend 398–93,597, the size key 100 · 500 · 2,000 คน;
  the three districts filled, the rest quiet; no console error.
- District (`?area=1039`), station (`?station=RAILCAT:MRT_BLUE:BL31`, สนามไชย 6 แห่ง · 8,768 คน with the dashed radius),
  school (`?school=764487df-…`, Harrow: tuition per grade, history, ONESQA, programmes), affiliation (`?aff=113`, the
  card and the filtered Aha), the count measure with the charts tray, the affiliation chart, the table, the province
  view of Nakhon Ratchasima in dark.
- Fixed during QA: seven-digit totals were clipped in the bar value column (widened to fit); the students chip no
  longer repeats the size band; the comparison rule drops the level chip when a school's grades are unknown.

### 5. Live

GitHub Pages (main / root), enabled on 2026-11-06 (ICT) for the release commit `fa145a4` (committed 2026-11-06T00:14+07:00):

- `npm run verify:live` (2026-11-05T17:16:42Z): **243 ok, 0 failed** — every published file of the manifest at
  `fa145a4` byte-identical (SHA-256) on https://montri-th.github.io/school/ (`evidence/live-attestation.json`, not
  committed); the root document serves the `index.html` bytes.
- Walk in the owner's Chrome with the real basemap, terrain and building tiles. The window could not be resized
  (606 × 675), so the desktop and phone views were opened in same-origin frames of the live site at 1440 × 900 and
  390 × 844, as in the Hotel walks: desktop dark — the first screen (Aha, rail bars, legend, the three focused districts
  over OpenFreeMap); desktop light — `?school=714599d9-…` (มัธยมวัดธาตุทอง): the map turned 3D and framed the drawn
  CityMETER Building V4 building nearest the pin in two-point perspective (legend “อาคารใกล้หมุด”, attribution
  “อาคาร: CityMETER Building V4”), terrain chips read from the DEM; phone light — `?area=1039` with the sheet open;
  phone dark — the first screen with the dock. Launch state `ready`, map loaded, no map failure, no console error.
- Seen in the walk, by design: where a school's registry point lies outside every drawn outline, the nearest drawn
  building can be a neighbouring tower (มัธยมวัดธาตุทอง); the camera names it “อาคารใกล้หมุด” and never lists the
  school in it (DATA_METHOD §วิธีนับ).

### 6. Not verified

- CVD simulation, native mobile devices, screen readers beyond the accessible names and roles in the markup.
- The research master's field values against the schools' own systems (a research-team task, PRODUCT_STATEMENT §7).
