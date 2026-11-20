# Đảo Đèn Lồng — hướng dẫn cho agent

Game 3D (Three.js) + chế độ headless theo Test Contract. Yêu cầu gốc: `docs/lab/PRD-0.md` (và ticket các phase sau trong `docs/lab/`). Spec + giả định: `docs/notes/phase-N.md`.

## Lệnh
- Cài: `npm ci` · Chơi: `npm run dev` · Build web: `npm run build`
- Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl [--scenario f.json] [--inputs f.json]`
- Test: `npm test` (phải xanh trước khi kết thúc) · Kiểm chứng + lưu bằng chứng: `npm run verify`

## Kiến trúc
- `src/core/` = logic thuần, tất định. CẤM import three/DOM, CẤM `Math.random`, `Date`, `performance`. Ngẫu nhiên chỉ qua `rng.js` (seed).
- `src/headless.js` = CLI theo contract. `src/render/` = Three.js + HUD, chỉ đọc state từ core và gửi input cùng định dạng contract.
- Tuning nằm duy nhất ở `src/core/tuning.js`; `game.contract.json` phải khớp (có test kiểm tra).
- Phần sáng tạo thêm chỉ nằm ở `src/render/` hoặc tắt khi headless — không được đổi output headless.

## Quy tắc
- Không bịa yêu cầu: mọi luật phải truy về PRD/ticket hoặc giả định đã ghi trong `docs/notes/`. Giả định mới → ghi vào notes trước.
- Không sửa tay output trong `docs/proof/`, không viết test luôn đạt. Test bị yêu cầu mới làm sai → sửa/bỏ kèm lý do trong notes.
- Commit nhỏ, mỗi commit một việc. Không commit `.env`, key.
