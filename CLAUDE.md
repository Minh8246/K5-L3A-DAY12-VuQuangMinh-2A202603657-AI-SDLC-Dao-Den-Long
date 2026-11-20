# Đảo Đèn Lồng — hướng dẫn cho agent

Game 3D (Three.js), 3 Đêm + chế độ headless theo **Test Contract v1.1**. Yêu cầu: `docs/lab/PRD-0.md`, `docs/lab/TICKET-02.md` (ticket mới ghi đè ticket cũ). Spec + giả định: `docs/notes/phase-N.md`.

## Lệnh
- Cài: `npm ci` · Chơi: `npm run dev` · Build web: `npm run build`
- Headless: `node src/headless.js --seed 1 --night 1|2|3 --ticks 600 --out out/run.jsonl [--scenario f.json] [--inputs f.json]`
- Chơi thẳng một Đêm: `http://localhost:5173/?night=2&autostart`
- Test: `npm test` (phải xanh trước khi kết thúc) · Kiểm chứng + lưu bằng chứng: `npm run verify`

## Kiến trúc
- `src/core/` = logic thuần, tất định. CẤM import three/DOM, CẤM `Math.random`, `Date`, `performance`. Ngẫu nhiên chỉ qua `rng.js` (seed).
- `src/headless.js` = CLI theo contract. `src/render/` = Three.js + HUD, chỉ đọc state từ core và gửi input cùng định dạng contract.
- Số chuẩn (Ticket-02) chỉ nằm ở `src/core/tuning.js` (TUNING + WORLD); bản đồ chuẩn ở `src/core/maps.js`. `game.contract.json` phải khớp (có test). KHÔNG tự đổi số chuẩn.
- Thứ tự 12 bước trong một tick là bắt buộc (`runStep` trong sim.js đánh số theo ticket). Thắng/thua chỉ xét ở bước 11.
- Phần sáng tạo thêm chỉ nằm ở `src/render/` hoặc tắt khi headless — không được đổi output headless.

## Quy tắc
- Không bịa yêu cầu: mọi luật phải truy về PRD/ticket hoặc giả định đã ghi trong `docs/notes/`. Giả định mới → ghi vào notes trước.
- Không sửa tay output trong `docs/proof/`, không viết test luôn đạt. Test bị yêu cầu mới làm sai → sửa/bỏ kèm lý do trong notes.
- Commit nhỏ, mỗi commit một việc. Không commit `.env`, key.
- Máy dev là Windows (Git Bash/PowerShell): không dùng `python`, hạn chế `sed -i`; sửa file bằng công cụ Edit/Write. Lệnh trong contract phải chạy được trên macOS/Linux.
- Kịch bản test cũng phải được review: tính kỳ vọng bằng tay TRƯỚC khi chạy, kiểm tra kịch bản không vô tình làm việc khác (ví dụ đi ra khỏi cầu, đứng yên nhặt lại bùa).
