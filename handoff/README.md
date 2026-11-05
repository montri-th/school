# CityMETER School — handoff

สำหรับนักพัฒนาที่รับงานต่อ เอกสารในโฟลเดอร์นี้มีสองรูปแบบที่ต้องตรงกัน: Markdown สำหรับคนอ่าน และ JSON (schema `handoff.schema.json` 1.5.0) สำหรับเครื่องตรวจ (`tests/release.test.js` ตรวจ schema และเลขรุ่น)

| ไฟล์ | อ่านเพื่อ |
|---|---|
| `../PRODUCT_STATEMENT.md` · `product-statement.json` | ผู้ใช้ ปัญหา คู่เทียบ กลยุทธ์ claim boundary และสมมติฐานที่ต้องทดสอบ |
| `PRODUCT_BRIEF.md` · `product-brief.json` | สัญญาของหน้าจอ: ข้อค้นพบแรก มาตรวัด สี บริบท คู่เทียบ ค่าเรียน แผง กราฟ กล้อง |
| `IMPLEMENTATION_PLAN.md` · `implementation-plan.json` | สถาปัตยกรรม โมดูล งาน acceptance criteria และ backlog |
| `VERIFICATION.md` | ผลตรวจของรุ่นนี้: tests, render, live attestation, live walk |
| `../DATA_METHOD.md` | ที่มาของทุกตัวเลข วิธีจับคู่เขต/อำเภอ บริบท และสิ่งที่ไม่เผยแพร่ |
| `../AGENTS.md` | ความต้องการของเจ้าของที่เป็นสัญญา — อ่านก่อนแก้ |

## ลำดับการทำงาน

1. แก้ข้อมูลในชีตวิจัยเท่านั้น (ไม่ commit ชีตหรือเซลล์ของชีต)
2. อ่านแท็บด้วย `scripts/export-sheet-tabs.js` ในเบราว์เซอร์ที่เปิดชีตได้ แล้ว `scripts/decode-sheet-payload.py`
3. `python3 -I scripts/build-data.py …` ตาม `DATA_METHOD.md` §13
4. `npm test` และ `npm run check:lds -- --lds <base> --li <profile>`
5. ขยับ `?v=YYYYMMDD-rN` ใน `index.html` + `package.json` + `design-intent.json` + handoff JSON
6. push `main` → GitHub Pages → `npm run handoff:manifest` → `npm run verify:live`
7. เดินเว็บจริงที่ 1440 และ 390 px ทั้ง light และ dark ก่อนบอกว่าเสร็จ
8. อัปเดตแถว `research.TH.school` ใน CityMETER Dataset Registry (คอลัมน์ demo และ Changes) ในชีตเดิม

## จุดที่ต้องระวัง

- นักเรียนที่ไม่ทราบ ≠ 0 คน · ค่าเรียน = ตามประกาศ รายโรงเรียน พร้อมปีการศึกษา · ระยะ = ระยะตรง · ไม่มีคำเตือนบนหน้าจอ ข้อจำกัดอยู่หลังลิงก์ “วิธีนับ” (DATA_METHOD.md)
- เขต/อำเภอของแถวมาจาก build (`row.admin`) ห้ามจับคู่ใหม่บนหน้าจอ · ประเภทนานาชาติมาจากระเบียน สช. ที่เชื่อมด้วย id ไม่ใช่ชื่อ
- ระดับชั้นมีเฉพาะโรงเรียน สพฐ. ในทะเบียน 2569 อย่าเดาจากชื่อ
- MapLibre ล็อกที่ 5.6.2 พร้อม `js/maplibre-guard.js` อย่าอัปเกรดโดยไม่ตรวจบั๊ก tile cover ซ้ำ
- ลำดับ layer มวลอาคาร x-ray สถานี และหมุด มีผลต่อมุมมองอาคาร อย่าสลับโดยไม่ทดสอบ
