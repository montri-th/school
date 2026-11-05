# CityMETER · School — data and method

How `data/schools.json` is built, what one row and one figure mean, and what the demo never claims. Every number below is
a snapshot of release 0.1.0 (data built 2026-11-05 from the research master as it stood on 2026-11-01, read cell by cell
on 2026-11-05); the page computes everything from the data at run time, so these are fixtures, not constants.

## วิธีนับ — อ่านตัวเลขในหน้าอย่างไร

หน้าจอไม่มีคำเตือน (กติกาเดียวกับ CityMETER · Hotel ที่เจ้าของตั้งไว้ 1 พ.ย. 2569: “ไม่มี caveats เลย”) ทุกบรรทัดที่มาท้ายหน้ามีลิงก์ “วิธีนับ” มาที่นี่ ขอบเขตของตัวเลขอยู่ตรงนี้ที่เดียว

- **นักเรียน** = จำนวนนักเรียนที่ CityMETER School บันทึกในปี 2569 (`student_count`) รวมต่อพื้นที่ ศูนย์พัฒนาเด็กเล็กนับเด็กที่ลงทะเบียน ไม่ใช่จำนวนที่นั่งที่รับได้ อัตราการเข้าเรียน หรือจำนวนเด็กในวัยเรียนของพื้นที่ สถานศึกษาที่ไม่ทราบจำนวนนักเรียนไม่นับเป็น 0 คน (แท่ง “ไม่ทราบ” ลายทแยง และ “—” ในช่องตัวเลข)
- **แห่ง** = สถานศึกษาหนึ่งรายการตามทะเบียน (หนึ่ง UUID ของ CityMETER School 2569) ยังไม่ได้ตรวจภาคสนามว่ายังเปิดสอนอยู่ ชุดข้อมูลเป็น research master ไม่ใช่สำมะโนโรงเรียน
- **ประเภท** = จัดกลุ่มเพื่ออ่านแผนที่ จากสังกัดตามทะเบียนและประเภทสถานศึกษาของชีต (โรงเรียนรัฐ สพฐ. · ท้องถิ่นและกรุงเทพฯ · เอกชน · นานาชาติ · อาชีวศึกษา · สกร. · ศูนย์พัฒนาเด็กเล็ก · รัฐอื่น) โรงเรียนนานาชาติ = โรงเรียนเอกชนที่มีระเบียน สช. ประเภทนานาชาติเชื่อมกับ UUID ไม่ใช่ชื่อที่มีคำว่า “นานาชาติ”
- **สังกัด** = หน่วยงานต้นสังกัดตามทะเบียน 2569 (`affiliation_type_id`) ไม่ได้บอกผู้รับใบอนุญาต ผู้บริหาร หรือคุณภาพ
- **ระดับชั้น** = ช่วงชั้นต่ำสุด–สูงสุดตามรหัสชั้นของทะเบียน ทะเบียน 2569 มีรหัสชั้นเฉพาะโรงเรียน สพฐ. สถานศึกษาอื่นอยู่ในกลุ่ม “ไม่ทราบระดับชั้น” (ตัวกรองมีตัวเลือกนี้ แท่งระดับชั้นมีแท่ง “ไม่ทราบ”) ตัวกรองระดับชั้นจึงแสดงเฉพาะที่ทราบว่าเปิดสอนระดับนั้น
- **ขนาด** = ช่วงจำนวนนักเรียนตาม SchoolSize ของ CityMETER production (ไม่ถึง 20 · 20–119 · 120–719 · 720–1,679 · 1,680–3,499 · 3,500 ขึ้นไป)
- **สัดส่วนของจังหวัด** = นักเรียน (หรือแห่ง) ในพื้นที่ ÷ ทั้งจังหวัดในตัวกรอง
- **ใกล้รถไฟฟ้า** = ห่างจุดอ้างอิงของสถานีที่เปิดแล้วไม่เกิน 500 ม. เป็นระยะตรง ไม่ใช่ระยะเดิน เวลาเดินทาง หรือเขตพื้นที่บริการ นับเฉพาะสถานศึกษาที่มีพิกัด (ตัวตั้งและตัวหารอยู่ในคำอธิบายของแต่ละแท่ง)
- **ค่าเรียนต่อปี** = ค่าเรียน (tuition) บาท/คน/ปี ตามประกาศของโรงเรียน สำหรับชั้นและปีการศึกษาที่ประกาศ ไม่รวมค่าธรรมเนียมอื่น ไม่ใช่ค่าใช้จ่ายทั้งปี ระดับราคา หรือระดับคุณภาพ แสดงรายโรงเรียนเท่านั้น ไม่รวมหรือเฉลี่ยข้ามโรงเรียน ประกาศที่ทีมวิจัยเก็บสำเนาไว้ในพื้นที่ส่วนตัวไม่มีลิงก์ (6 แห่ง) โรงเรียนที่ไม่มีค่าเรียนในชุดข้อมูลไม่ได้แปลว่าเรียนฟรี — ส่วนใหญ่ยังไม่ได้สำรวจ
- **ผลประเมินภายนอก** = ผลประเมินของ สมศ. (ONESQA) ที่ชีตเลือก ปีงบ 2564–2567 ข้อความตามต้นทาง พร้อมปี ไม่ใช่ระดับคุณภาพวันนี้หรืออันดับโรงเรียน
- **นักเรียนย้อนหลัง** = ผลรวมนักเรียนรายชั้นในข้อมูลโรงเรียนเอกชนของ สช. ภาคเรียน 1–2 ปีการศึกษา 2565–2567 ไม่ใช่ตัวเลขปี 2569 ภาคเรียนที่ไม่มีค่าแสดง “—”
- **หลักสูตรและการรับรอง** = ตามที่ชีตสรุปจากหน้าโรงเรียน (โรงเรียนนานาชาติ)
- **ประกาศปิด** = โรงเรียนประกาศปิดเอง มีวันที่และลิงก์ประกาศ ยังอยู่ในชุดข้อมูลเหมือนทะเบียน
- **คู่เทียบ** = สถานศึกษาประเภทเดียวกัน ที่เปิดสอนระดับชั้นเดียวกันอย่างน้อยหนึ่งระดับ (เมื่อทราบระดับชั้นของโรงเรียน ไม่เช่นนั้นใช้ประเภทอย่างเดียว) ในระยะตรง 2 กม. เรียงใกล้ก่อน เป็นรายชื่อเริ่มต้นสำหรับเทียบ ไม่ใช่โรงเรียนแข่งขันที่ยืนยันแล้ว หรือเขตพื้นที่บริการ
- **อาคาร** = อาคารบนแผนที่ (CityMETER Building V4 หรือ OpenStreetMap ตามพื้นที่) ความสูง “สูงราว” เป็นค่าประมาณของชุดข้อมูล “สถานศึกษาในอาคารนี้” = หมุดของสถานศึกษาอยู่ในขอบอาคาร หมุดคือจุดในทะเบียน สมศ. หรือ สช. ไม่ใช่ทางเข้าหรือขอบเขตโรงเรียน
- **อาคารใกล้หมุด** = เมื่อหมุดไม่อยู่ในขอบอาคารใด มุมมองอาคาร 3 มิติเปิดที่อาคารบนแผนที่ที่ใกล้หมุดที่สุดภายใน 300 ม. (ไม่มีก็ขยายเป็น 800 ม.) โดยมีหมุดในภาพ เป็นการเลือกมุมกล้องเท่านั้น ไม่ได้ยืนยันว่าโรงเรียนอยู่ในอาคารนั้น
- **ภูมิประเทศ** = พื้นดินรอบหมุด (รัศมี 500 ม. ต้นไม้ 300 ม.) จาก SRTM 30 ม. (สำรวจปี 2543) และแผนที่ OSM ไม่ใช่การประเมินความเสี่ยง
- **สถานีที่กำลังสร้าง** = โครงการ ยังไม่ใช่บริการ

## 1. Sources

| Input | What it is | Published here? |
|---|---|---|
| Research master “CityMETER School Thailand — Research Master 2026-10-31” (registry `research.TH.school`, Google Sheets, last modified 2026-11-01T21:09:22Z) | The CityMETER School 2026 baseline curated by the research team from the production school layer (`https://landometer.com/v3/citymeter?d=school`, source code theshifters/landometer) and public sources: OPEC (สช.) school profiles and private-school statistics, the ONESQA open-data catalogue, schools' own fee pages | Only the fields of §2–7 of the rows, each tab bound by a hash (`meta.tabs`); never the sheet, its cells or its address |
| Tabs read | `02_SCHOOLS` (35,252) · `03_CHILD_CENTERS` (5,576) · `99_SOURCE_2026` (40,828 source records) · `01_AFFILIATIONS` (16) · `15_RESEARCH_COVERAGE` (OPEC links) · `16_ENROLMENT` (OPEC semester snapshots) · `20_SCHOOL_FEES` (per-grade tuition) · `10_SOURCES` | — |
| CityMETER production base info (public read-only API, `base/info/lv0` and `lv1/{province}`) | Province and district codes, Thai names, areaSqm | Receipts only (`data/boundary-receipts.json`, 78 responses read 2026-11-05, every body byte-identical to the CityMETER · Hotel read of 2026-11-01) |
| District outlines | `data/frames/{CODE}.json` (production SUBDISTRICT geometry dissolved to districts, from montri-th/pharmacy, as in Hotel) | Yes (display geometry) |
| CityMETER · Transit | Rail stations (montri-th/transit @5f5232d0, `data/transit.json` SHA-256 0916636a…, release `transit-data-2026-10-31-r1`) | The stations the page draws or names (`stations`) |
| Building units | `data/building-units/` copied from CityMETER · Hotel (montri-th/hotel @177e592f) by `scripts/adapt-building-units.py` (§10) | Yes |

The workbook is 35 MB, too large for a Drive export: every tab was read from the sheet's own HTML view in the owner's
browser (`scripts/export-sheet-tabs.js`, decoded by `scripts/decode-sheet-payload.py`), and the SHA-256 of each tab's
rows as canonical JSON is recorded in `meta.tabs` so a later read can be compared tab by tab. The tab files stay
outside the repository.

## 2. One row, two measures

One row = one CityMETER school UUID of the 2026 baseline (`source_school_id`): a row of `02_SCHOOLS` or of
`03_CHILD_CENTERS`. 40,828 rows, one per record of `99_SOURCE_2026`; nothing is merged, split, moved or re-labelled; the
one school with an official closure notice stays in (§6). A row is a roster record, not a field-verified campus.

| Measure | Definition | Unit | Scale |
|---|---|---|---|
| `students` (default) | Σ `student_count` (CityMETER 2026, positive values only; the source's raw zeros and blanks are unknown) | คน | LI `li.supply` |
| `count` | records | แห่ง | LDS `count` |

10,134,747 students are recorded for 40,338 rows; 490 rows have no known count. A record with unknown students adds
nothing to a student total and is counted apart (`studentsUnknown`): a bar “ไม่ทราบ”, a hollow map symbol, “—” in a
tile, and a district whose records all have unknown students is `no_data` (hatch) under the student measure.
Teachers (33,601 rows) and classrooms (28,435) follow the same rule and are shown per school only.

Students are a recorded total, never a capacity, a demand, an enrolment rate, a per-child ratio or a density: no figure
is divided by the district's area or population.

## 3. District membership (build time, never re-assigned on screen)

`row.admin` says how a row's district was matched, the first that applies:

| Method | Rule | Rows |
|---|---|---|
| `source` | the production district the source lists the school under (`99_SOURCE_2026.district_id` → production code) | 40,828 |
| `name` | the row's district name is a production district of its province | 0 |
| `province` | province only | 0 |

Every row sits in its own province's district as the source lists it. The sheet's point is never used to re-assign a row;
where the point lies in another district (52 rows) or another province (10) it is kept as the sheet's point and counted
for the research team (`meta.checks`, `meta.pointProvinceDisagreeSample`), and one point lies outside every frame.

## 4. Points

A row carries the sheet's point where `coordinate_status` says it passed the sheet's extent check: the ONESQA (สมศ.)
registry point (29,880 rows) or the OPEC (สช.) registry point (3,198) — `row.coordRole` names which, in the source
details. 33,078 rows (81%) have a point, 6 decimals. A point is a registry point, not an entrance, a gate or the school's
site; a row without one counts in its district, lists, ranks and charts, never as a pin. Rows without a point are
mostly child development centres (3,934 of 5,576).

## 5. Groups, affiliations, levels, sizes

Groups (`groups`, presentation only; DATAVIZ-05 series by stable id, `js/cues.js#GROUP_SERIES`):

| Group | Rule | Rows | Students |
|---|---|---|---|
| public · โรงเรียนรัฐ สพฐ. | affiliation 111 | 28,767 | 6,165,852 |
| local · ท้องถิ่นและกรุงเทพฯ | affiliations 102 (อปท.), 109 (กรุงเทพมหานคร), 110 (เมืองพัทยา), schools | 1,360 | 650,449 |
| private · เอกชน | affiliation 113 | 3,526 | 1,829,798 |
| international · นานาชาติ | affiliation 113 with an accepted OPEC record of type นานาชาติ (`15_RESEARCH_COVERAGE.accepted_cm_ids`) or a linked `16_ENROLMENT` snapshot of a โรงเรียนเอกชนนานาชาติ (4 rows by the second rule only) | 157 | 61,945 |
| vocational · อาชีวศึกษา | institution category อาชีวศึกษา | 717 | 760,615 |
| nonformal · สกร. | institution category ส่งเสริมการเรียนรู้ | 406 | 385,075 |
| childcare · ศพด. | `03_CHILD_CENTERS` | 5,576 | 183,790 |
| other · รัฐอื่น | every other public affiliation | 319 | 97,223 |

A school named “นานาชาติ” without an OPEC link stays private: a group is never read from a name. Affiliations
(`affiliations`, 16) are the source's own codes and names with a short form; their counts reconcile with
`01_AFFILIATIONS` at build time (the build stops otherwise).

Levels come from the source's grade codes (1–3 อ.1–อ.3 · 4–9 ป.1–ป.6 · 10–15 ม.1–ม.6 · 16–18 ปวช.1–3): a school teaches a
level when its lowest–highest range meets the level's range (`js/model.js#levelsOf`). The 2026 source carries grade
codes for สพฐ. schools only (28,409 rows); every other row has none (code 0, “ยังไม่ทราบ”) and sits in “ไม่ทราบระดับชั้น”.
The grades of `02_SCHOOLS` and the codes of `99_SOURCE_2026` agree for every row (the build stops otherwise).

Sizes are CityMETER production's SchoolSize bands of the recorded students (§วิธีนับ); unknown students are in no band.

## 6. Tuition, assessment, history, closure (per school only)

- **Tuition** (86 schools; 74 international, 11 private, 1 university demonstration school): `02_SCHOOLS`
  `tuition_annual_min`–`tuition_annual_max` with `tuition_period` = บาท/คน/ปี ค่าเรียนเท่านั้น, the grades and the academic
  year the school published, and the source page; the per-grade tuition rows of `20_SCHOOL_FEES` for the same school and
  academic year (fee component tuition, annual amount; 700 items, at most 24 shown). The academic year is shown as the
  school wrote it. A source the research team holds as a private copy (5 Drive files, 1 http page) is not linked. 48 more
  schools have fee evidence the sheet has not resolved to an annual tuition: a link in the source details only.
  Never summed or averaged across schools, never a price level.
- **External assessment** (33,067 schools): `evaluation_result` verbatim (lines split at “ | ”), `evaluation_year_be`
  (2564–2567), authority ONESQA, and the ONESQA open-data catalogue page of the resource (never the CSV download).
- **History** (3,248 private and international schools): `16_ENROLMENT`, the reported grade sum of the OPEC private-school
  snapshots of semesters 1–2 of B.E. 2565–2567 for the school's source id; a semester without a value is “—”.
- **Programmes** (149 schools): `curriculum_summary` and `accreditation_summary` as written, one chip per item.
- **Closure** (1 school): `operating_status` with the school's own announcement (date and link); the row stays.

## 7. Context from the same registry (straight lines, build time)

Rail: for every row with a point, the nearest operating station of CityMETER · Transit and the nearest station under
construction, straight line from the sheet's point to the station's reference point, within 2,000 m (`rail`, `railM`,
`rail2`, `rail2M`). The page draws every operating station (195) as a quiet clickable ring and names the stations under
construction a school is nearest to (98) in words only (“กำลังสร้าง”). A station's panel lists the records whose points
lie within 500 m of its reference point, computed on the page.

Never: walking time, travel time, a school zone (เขตพื้นที่บริการ), a catchment or a population ratio.

## 8. What the page computes

- **First Aha** (`js/area-insight.js`, unchanged from Hotel): the province holding the most of the measure placed at
  district level, its top districts (≤ 3, never through a tie, never every district that holds the measure), the share
  of the province's whole total in the selection, the rail comparison as two bars (focus vs the rest of the province,
  rows with a point, both bases stated; hidden when nothing is within 500 m) and the district(s) with the most outside
  that province. Snapshot (students, no filter): **12% of Bangkok's recorded students (106,163 of 916,683) are in
  Lat Krabang, Sai Mai and Bang Kapi**; within 500 m of an operating station: 1% of theirs (620 of 79,083 with a point)
  against 17% in the rest of Bangkok (112,216 of 648,859); the district with the most students in the country is
  Mueang Nakhon Ratchasima (93,597), more than any Bangkok district. Records: Nakhon Ratchasima holds the most schools
  (1,786); its top three districts hold 21% (382).
- **Ramps** (`js/scales.js#buildRamp`): the 41 LDS samples by rank of the measured nonzero values of the areas being read.
- **Comparison set** (`js/profile-model.js#compsetOf`): same group; a shared level when the school's grades are known
  (otherwise the group alone); straight line ≤ 2 km; nearest first; ten shown; every record round the school (any group)
  stated beside it. Reads every row, so it does not move with the filters.
- **Station radius**: 500 m, straight line; a record near two stations is listed at both (the station ranking counts each
  record at its nearest station only).
- **Importance of a label** (`js/model.js#importanceScores`): the mean of the national percentiles of recorded students and
  published tuition (the middle of min–max); a missing value is never guessed; ranking only, never shown.

## 9. Colour and categorical rules

The district and province fills use LI `li.supply` (students) and LDS `count` (records), all 41 samples, the same HEX on
both themes (owner standing rule “Color scale ขอให้ใช้ 41 scales ตาม LDS เสมอ”). EVID-05: measured (a sample) ·
measured_zero (no record under the filters: sample 0 + the zero outline; every district holds at least one record
without filters) · no_data (students only: records with no known count → hatch). Groups bind to LDS series by stable id
with their shape cue (circle สพฐ. · square เอกชน · triangle นานาชาติ · diamond ท้องถิ่น · cross อาชีวะ · hexagon สกร. ·
plus ศพด. · dash รัฐอื่น); no star (it would read as a rating). Ordinal bars (sizes, levels, stations, affiliations) use
one neutral foundation fill.

## 10. Map: symbols, names, terrain, buildings

- Symbols: one per row with a point, never clustered; the symbol's area grows with the recorded students (k(zoom) ·
  √(students / 400), capped at 4,000; unknown = a hollow shape at the 200-student size); the legend key shows
  100 · 500 · 2,000 คน and the hollow mark.
- Names near the middle of the view (`js/labels.js`): from zoom 12.5, ranked by importance (§8), at most 9 (phone 5); the
  label drops the leading type word the cue already says (โรงเรียน · รร. · ศพด.); a place inside a school's name stays.
- Terrain (`js/terrain.js`): as in Hotel — at hilly sites only, ground facts, never a risk.
- Buildings per area: the units of the CityMETER · Hotel build (the owner's rule of 2026-11-01, point 3: per อปท., เขต in
  Bangkok; CityMETER Building V4 where its building count is ≥ 1.15 × the OpenStreetMap count of the unit, else OSM),
  copied unchanged by `scripts/adapt-building-units.py` without the per-unit hotel counts. The Hotel build evaluated
  every อปท. holding a hotel with a point (3,947 units, every Bangkok เขต); a school in any other อปท. stands among
  OpenStreetMap buildings. The building panel says “สูงราว” and heads its list “สถานศึกษาในอาคารนี้”.

## 11. Not published

Official school codes and record ids of the source (`official_school_code`, `school_record_id`), identity statuses,
official code periods, source names, review notes, count notes, classification notes, coordinate source URLs and
extent checks, the supplemental enrolment columns, `05_REVIEW_QUEUE`, `04_SOURCE_CROSSWALK`, `14_EXTERNAL_CANDIDATES`,
the 99_SOURCE_2026 raw records, internal sheet, Drive and API URLs (`meta.excludedFields`). Source links are public
https pages only: OPEC school profiles (their address carries the school's public OPEC code), the ONESQA open-data
catalogue and schools' own fee pages. No logos: the roster carries none.

## 12. Research follow-ups (reported, not patched in `data/`)

- Grade codes exist for สพฐ. schools only: the level filter and the comparison rule cannot read the levels of private,
  international, local, vocational and other schools until the sheet records them.
- 52 sheet points lie in another district and 10 in another province than the source's district; one lies outside every
  frame (`meta.checks`, sample ids in `meta.pointProvinceDisagreeSample`).
- 6 tuition sources are private copies (Drive) or http pages: a public https announcement would let the page link them.
- 7,750 rows have no accepted point (child development centres above all).
- Building units were evaluated for hotel-holding อปท. only; evaluating the others would extend CityMETER Building V4 to
  every school.

## 13. Rebuild

```sh
# 1. Read the tabs (owner's browser, signed in, on the sheet's page): scripts/export-sheet-tabs.js, then
python3 -I scripts/decode-sheet-payload.py <payload> <tabs dir>          # one <tab>.json per tab, internal
# 2. Production base info with receipts
python3 -I scripts/fetch-base.py --out <api dir>
# 3. The dataset (stops on any reconciliation failure)
python3 -I scripts/build-data.py --tabs <tabs dir> --api <api dir> --index data/area-index.json --frames data/frames \
  --transit <montri-th/transit checkout> --out .
python3 -I scripts/build-receipts.py --api <api dir> --out .
# 4. Building units from a montri-th/hotel checkout
python3 -I scripts/adapt-building-units.py --hotel <montri-th/hotel checkout> --commit <hotel commit> --out data/building-units
npm test
```
