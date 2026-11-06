# CityMETER School — Implementation Plan (0.2.0)

คู่กับ `implementation-plan.json`

## สถาปัตยกรรม

Static site บน GitHub Pages · ES modules ผ่าน import map (ทุกโมดูลมี `?v=` เดียวกัน) · ไม่มี build step · Node ≥ 20 สำหรับ tests · Python 3 สำหรับสร้างข้อมูล · MapLibre GL JS 5.6.2 จาก unpkg (ล็อกรุ่น) · tiles/glyphs จาก OpenFreeMap · โค้ดฐาน CityMETER · Hotel 0.3.6 (montri-th/hotel @177e592)

| โมดูล | หน้าที่ |
|---|---|
| `js/app.js` | ประสาน state, row scopes, โหมดแผง, URL, กล้อง, คลิกบนแผนที่ |
| `js/model.js` | decode `data/schools.json`, มาตรวัด (นักเรียน · แห่ง · เรียนเสริม), ประเภท ระดับชั้น ขนาด, ตัวกรอง, สรุป, ลิงก์ production/Transit |
| `js/area-insight.js` | ข้อค้นพบแรก (กฎ tie และ N − 1, บรรทัดรถไฟฟ้า) |
| `js/profile-model.js` | โมเดลแผง: overview, area, station, building, school, affiliation, compset, history + โมเดลเรียนเสริม |
| `js/learning.js` | decode `data/learning.json` (0.2.0): แถวเรียนเสริม บริการ สถานะจุด ตัวกรอง (ค้นหา · จังหวัด · บริการ) `nearPoint` `learningContext` |
| `js/panel.js` | HTML ของแผงทุกโหมด + provenance |
| `js/charts.js` · `js/chart-model.js` | กราฟ areas / mix / affs (เรียนเสริม: เขต × บริการ · บริการ) |
| `js/scales.js` · `js/cues.js` | สเกล `li.supply` + `count` 41 ระดับ, series + shape cue ของ 8 ประเภท |
| `js/map-layers.js` · `js/provinces.js` · `js/frames.js` · `js/areas.js` | choropleth เขต/อำเภอ, กรอบจังหวัด, ขอบเขตรายจังหวัด, ดัชนีพื้นที่ |
| `js/pins.js` · `js/stations.js` · `js/labels.js` | หมุดสถานศึกษา (ขนาดตามนักเรียน), สถานีรถไฟฟ้าและวงรัศมี, ชื่อกลางจอ |
| `js/ask.js` · `js/breadcrumb.js` · `js/navigation.js` | ปุ่ม Google, เส้นทาง, ไอคอนและวิธีใช้ |
| `js/massing.js` · `js/camera.js` · `js/venue-xray.js` · `js/building-join.js` · `js/building-units.js` · `js/terrain.js` · `js/maplibre-guard.js` · `js/map-style.js` · `js/mvt.js` · `js/geometry.js` | มวลอาคาร กล้อง มุมมองอาคาร ภูมิประเทศ (สืบทอดจาก Hotel ไม่เปลี่ยนสัญญา) |

สคริปต์: `scripts/export-sheet-tabs.js` + `scripts/decode-sheet-payload.py` (อ่านชีต 35 MB ทีละเซลล์) · `scripts/build-data.py` (ข้อมูล + การกระทบยอด) · `scripts/build-learning.py` (เรียนเสริมจากแท็บ 27–29 + การกระทบยอด) · `scripts/fetch-base.py` + `scripts/build-receipts.py` (ใบรับ production) · `scripts/adapt-building-units.py` (หน่วยอาคารจาก Hotel) · `scripts/build-pictogram-font.py` (ไอคอนของโรงเรียน) · `scripts/check-lds-parity.mjs` · `scripts/build-handoff.mjs` · `scripts/verify-live.mjs`

## งาน (ทั้งหมดเสร็จแล้ว)

T1 อ่านชีตวิจัยทีละเซลล์พร้อม hash รายแท็บ · T2 สร้างข้อมูลและกระทบยอด (ทะเบียน 2569, สังกัด, ระดับชั้น, จุด, ค่าเรียน, สมศ., สช., สถานี) · T3 ใบรับ production และหน่วยอาคารจาก Hotel · T4 โมเดล มาตรวัด กราฟ · T5 แผง ป้าย หมุด คำอธิบาย ตัวกรอง ตาราง เป็นคำของโรงเรียน · T6 ไอคอน · T7 เอกสาร handoff tests · T8 เผยแพร่ ตรวจ live และอัปเดตทะเบียน · T9 (0.2.0) เรียนเสริม: แท็บ 27–29 มาตรวัดที่สาม หมุดที่ตรวจแล้ว และเรียนเสริมในแผงโรงเรียน

## Acceptance criteria

A1 decode ครบ ไม่หลุด · A2 มาตรวัดนักเรียน ไม่ทราบ ≠ 0 · A3 ประเภทและสังกัด · A4 ระดับชั้น · A5 ค่าเรียน ผลประเมิน ประวัติ ประกาศปิด · A6 ขอบเขตและใบรับ · A7 ข้อค้นพบแรก · A8 แบบจำลองเขต · A9 กราฟ · A10 แผง · A11 คู่เทียบ · A12 ป้ายและหมุด · A13 ฟอนต์ไอคอน · A14 release และ live · A15 เรียนเสริม — รายละเอียดและวิธีตรวจใน JSON

## Backlog

B1 รหัสชั้นของโรงเรียนนอก สพฐ. · B2 ค่าเรียนของโรงเรียนเอกชนที่ยังไม่ได้สำรวจ และแหล่งสาธารณะของ 6 ประกาศ · B3 ประเมิน CityMETER Building V4 ให้ทุก อปท. ที่มีโรงเรียน · B4 จุดของ 7,750 แถวที่ยังไม่มีจุด · B5 ประชากรวัยเรียนจากทะเบียนเป็นบริบท · B6 เรียนเสริม: จุดของ 2,588 แห่งที่ไม่มีจุด และจุดที่ตรวจแล้วของ 227 แห่งที่จุดอยู่นอกเขตที่ระบุหรือใช้ไม่ได้ · 277 รหัสที่รอตรวจ · แห่งไหนยังเปิดสอน (ผู้ให้บริการหรือลงพื้นที่)
