# CityMETER School 0.1.0 — verification

Release 0.1.0 (cache tag `20261105-r1`), built 2026-11-05 from the research master as it stood on 2026-11-01 (read
cell by cell on 2026-11-05). The code base is CityMETER · Hotel 0.3.6 (montri-th/hotel @177e592f); the contracts the two
share were verified there (map engine, building view, terrain, guards) and are carried unchanged — this record covers
what School changes: the data, the measure, the panels, the labels, the legend, the filters and the publication.

## 1. Data build — every reconciliation passes

`python3 -I scripts/build-data.py …` (DATA_METHOD.md §13) stops on any failure; this build passed all of them:

- 40,828 rows = `02_SCHOOLS` 35,252 + `03_CHILD_CENTERS` 5,576 = `99_SOURCE_2026` 40,828; one UUID per row.
- Affiliation counts and child-centre counts of every one of the 16 affiliations equal `01_AFFILIATIONS`.
- Grades of `02_SCHOOLS` equal the source's grade codes for every row; tuition periods are บาท/คน/ปี ค่าเรียนเท่านั้น
  and min ≤ max for all 86 schools; every ONESQA result comes with its year and authority.
- Every district of the area index matches the production gazetteer; the 78 base-info responses of 2026-11-05 are
  byte-identical (SHA-256) to the CityMETER · Hotel read of 2026-11-01.
- Reported, not patched: 52 points in another district than the source's, 10 in another province, 1 outside every
  frame (`meta.checks`).

## 2. Unit tests on the real data — 125 pass, 0 fail

`npm test` (Node 22): data contract (rows, measure, groups, affiliations, levels, membership, points, rail, tuition,
assessment, history, closure, hygiene, boundaries and receipts) · first Aha fixtures (students and records) · district
and province models (EVID-05) · every panel view (one provenance line, no caveat, no “0 คน”) · comparison set · charts ·
breadcrumb (`?d=school`) · categorical cues · labels and pins · scales · icon fonts (content-addressed) · camera,
massing, building join and units, x-ray, MapLibre guards (carried from Hotel) · release (one cache tag, one version,
schema-valid handoff JSON, publication hygiene).

## 3. LDS and Location Intelligence parity

`assets/theme.css` is byte-identical to CityMETER · Hotel 0.3.6, and the analytical values of `js/scales.js` and the
series of `js/cues.js` are the same (only labels, defaults and the group → series binding changed), so the Hotel parity
run (124 checks against the LDS base file and the Location Intelligence Profile) applies unchanged. The two source files
are not in this workspace; `npm run check:lds -- --lds <base> --li <profile>` re-runs it where they are.

## 4. Rendered QA (build container)

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

## 5. Live

Recorded after publishing to GitHub Pages (next commit): `npm run verify:live` byte attestation and a walk of the live
site with the real basemap at desktop and 390 px, light and dark.

## 6. Not verified

- CVD simulation, native mobile devices, screen readers beyond the accessible names and roles in the markup.
- The research master's field values against the schools' own systems (a research-team task, PRODUCT_STATEMENT §7).
