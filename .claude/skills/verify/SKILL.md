---
name: verify
description: Chạy kiểm chứng đầy đủ cho Đảo Đèn Lồng (unit test + scenario headless qua CLI thật + kiểm tra tất định) và lưu bằng chứng vào docs/proof/phase-N/. Dùng sau khi sửa logic trong src/core, trước khi commit một tính năng, và trước khi gắn tag phase.
---

# Kiểm chứng và lưu bằng chứng

1. `npm test` — phải xanh. Nếu đỏ: sửa code, KHÔNG sửa test cho qua (trừ khi ticket mới đổi luật — khi đó ghi lý do vào `docs/notes/phase-N.md`).
2. `npm run verify` (mặc định phase hiện tại; hoặc `node scripts/verify.js --phase N`) — chạy mọi case trong `scenarios/phase1..N.cases.json` (hồi quy các phase trước) qua `headless_cmd` của `game.contract.json`, mỗi case 2 lần để so sánh tất định, ghi:
   - `docs/proof/phase-N/runs/<case>.jsonl` (output thật, không sửa tay)
   - `docs/proof/phase-N/verify-report.md` (bảng yêu cầu → bằng chứng → PASS/FAIL)
   - `docs/proof/phase-N/test-report.txt`
3. Case có thể đặt `night`, `every` (snapshot-every) và kiểm tra `expect.at` / `expect.near` trên snapshot. Mỗi tính năng mới phải có ≥ 1 case. Yêu cầu mới → thêm case vào `scenarios/phaseN.cases.json` với `req` trỏ về ID tiêu chí trong notes. Tính giá trị mong đợi **bằng tay từ tuning trước khi chạy**, không chép từ output.
4. Có FAIL → báo trung thực, không đánh dấu "đạt".
5. GUI: `npm run build && npx vite preview --port 4173`, rồi chụp từng Đêm bằng Chrome headless (`?night=N&autostart`):
   `chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,720 --virtual-time-budget=4000 --screenshot=docs/proof/phase-N/gui.png "http://localhost:4173/?night=N&autostart"`. FPS headless (render phần mềm) KHÔNG dùng làm bằng chứng hiệu năng; đo trên máy thật bằng bộ đếm FPS góc dưới trái.
