# Phase 1 — Spec, giả định, kế hoạch kiểm chứng

Nguồn yêu cầu: [docs/lab/PRD-0.md](../lab/PRD-0.md) (Test Contract v1.0).
Viết **trước khi code**. Mọi con số dưới đây phải khớp `game.contract.json` (test `tests/contract.test.js` kiểm tra điều này).

## 1. Quyết định công nghệ

| Quyết định | Lý do (1 dòng) |
|---|---|
| JavaScript ESM thuần + Node ≥ 18 cho logic và headless | Không cần bước biên dịch: `node src/headless.js` chạy ngay trên macOS/Linux/Windows |
| Three.js + Vite cho bản có giao diện (web) | PRD cho phép bản web; người chấm chỉ cần `npm ci` và `npm run dev` |
| Logic thuần ở `src/core/` (không import three, không dùng `Math.random`, không đọc đồng hồ) | Cùng một mã cho headless và GUI, tất định theo seed |
| Test bằng `node:test` có sẵn | Không thêm phụ thuộc, chạy bằng một lệnh `npm test` |

## 2. Giả định cho chỗ mơ hồ

| # | Chỗ mơ hồ | Giả định của tôi |
|---|---|---|
| A1 | "Máu" là gì | Máu = `flames` (ngọn lửa), mặc định 3. Mất 1 mỗi lần bị chạm |
| A2 | "Tỏa sáng tốn ánh sáng" | Tốn `pulse_cost` = 1 đom đóm đang mang. Không đủ đom đóm hoặc đang hồi chiêu → không tỏa sáng, không có sự kiện |
| A3 | Tỏa sáng làm gì | Mọi Bóng Mực trong `pulse_radius` (kể cả đang choáng) bị choáng `pulse_stun_s` và bị đẩy ra xa Mây `pulse_push_m` theo mặt phẳng XZ ngay trong tick đó. Sự kiện `pulse` vẫn ghi khi không trúng con nào (`stunned_ids: []`). `stunned_ids` sắp xếp theo id |
| A4 | Thắp đèn | Nhấn `interact` khi trong `interact_radius` của đèn **chưa thắp** gần nhất (hòa thì id nhỏ hơn). Nạp `min(carried, lantern_cost − deposited)`. Đủ `lantern_cost` thì đèn sáng |
| A5 | Nhặt đom đóm | Tự động khi trong `pickup_radius` và `carried < carry_capacity`. Nhiều con cùng tick thì nhặt theo id tăng dần |
| A6 | Đom đóm rơi khi bị chạm | `dropped = floor(carried × hit_drop_ratio)`. Đom đóm rơi **tan vào sương** (mất, không nằm lại trên đất) |
| A7 | Bất tử sau khi bị chạm | `invuln_s` giây không bị chạm thêm. Bóng Mực đang choáng không gây sát thương |
| A8 | "Bóng Mực sợ đèn" | Chỉ **đèn đã thắp** tạo vùng an toàn `safe_radius`. Bóng Mực bị đẩy ra ngoài, tới khoảng cách `safe_radius + 0.01` |
| A9 | Hết thời gian Đêm | `time_left_s` về 0 → thua, lý do `dawn` (bình minh, Bóng Mực đã nuốt đảo) |
| A10 | Rơi khỏi đảo | Không có: `fall_enabled = false`. Mây bị chặn ở mép đảo (bán kính 29 m). Không bao giờ có `player_hit` với `by: "fall"` |
| A11 | Điểm | +`per_mote` mỗi đom đóm nhặt; +`per_lantern` mỗi đèn thắp; +`per_stun` mỗi Bóng Mực bị choáng bởi một lần tỏa sáng. **Chỉ khi thắng**: +`per_second_left × floor(time_left_s)` và +`per_flame_left × flames` |
| A12 | Đom đóm ngẫu nhiên | Mặc định có 20 con rải trong đĩa bán kính 26 m. Khi `random_motes` bật, mỗi con bị nhặt sẽ sinh lại một con mới ở vị trí ngẫu nhiên (theo seed), cách Mây ≥ 3 m |
| A13 | Bóng Mực ngẫu nhiên | Mặc định có 2 con ở mép đảo (bán kính 26 m, độ cao tâm Y = 1). Khi `random_shades` bật, cứ 25 s sinh thêm 1 con (sự kiện `shade_spawned`), tối đa 5 con, cách Mây ≥ 10 m |
| A14 | Trạng thái Bóng Mực | `chase` (đuổi thẳng tới Mây với `shade_speed`) và `stunned` |
| A15 | Nhảy | Vận tốc ban đầu 7 m/s, trọng lực 20 m/s². Nhảy không né được Bóng Mực, vì khoảng cách đo theo XZ |
| A16 | Vị trí đèn mặc định | 5 đèn L1…L5 trên vòng tròn bán kính 18 m, L1 ở (0, 0, 18), các đèn tiếp theo cách nhau 72° |
| A17 | Thứ tự xử lý trong một bước | input → bộ đếm thời gian → di chuyển/nhảy → nhặt đom đóm → interact (nạp, thắp, thắng) → tỏa sáng → Bóng Mực di chuyển + vùng an toàn → va chạm (thua) → sinh Bóng Mực → trừ thời gian (dawn). Game kết thúc thì dừng xử lý ngay |
| A18 | Snapshot | Chỉ ghi ở tick chia hết cho `--snapshot-every` (gồm tick 0). Dòng `end` luôn là dòng cuối |
| A19 | Lỗi CLI | Thiếu hoặc sai tham số → mã 1. File inputs/scenario không đọc được hoặc sai định dạng (JSON hỏng, sai kiểu, tick không tăng nghiêm ngặt, `move` ngoài [−1, 1], id đèn lạ) → mã 2 |

## 3. Tuning (khai trong `game.contract.json`)

| Khóa | Giá trị | Khóa | Giá trị |
|---|---|---|---|
| player_speed | 6 | pulse_stun_s | 3 |
| carry_capacity | 5 | pulse_push_m | 4 |
| lantern_cost | 5 | pulse_cooldown_s | 2 |
| lantern_count_night1 | 5 | safe_radius | 5 |
| pickup_radius | 1.2 | shade_speed | 4 |
| interact_radius | 2.5 | shade_hit_radius | 1 |
| pulse_cost | 1 | fall_enabled | false |
| pulse_radius | 6 | score.per_mote | 10 |
| night1_duration_s | 300 | score.per_lantern | 100 |
| flames | 3 | score.per_stun | 25 |
| invuln_s | 1.5 | score.per_second_left | 2 |
| hit_drop_ratio | 0.5 | score.per_flame_left | 50 |

## 4. Tiêu chí nghiệm thu và cách kiểm chứng

| ID | Tiêu chí ("làm A thì thấy B") | Cách kiểm chứng |
|---|---|---|
| R1 | Đứng yên, không input: snapshot tick 0 có Mây ở (0,0,0), 5 đèn, `state: playing`, `time_left_s: 300` | Test headless |
| R2 | `move [0,1]`, yaw 0, trong 60 tick → Mây đi được đúng `player_speed` m theo +Z. Yaw 90° → đi theo +X. `move [1,1]` được chuẩn hóa | Unit test |
| R3 | Đi qua đom đóm trong `pickup_radius` → `mote_picked`, `carried` +1, điểm +`per_mote`. Đầy `carry_capacity` thì không nhặt | Unit + scenario |
| R4 | Mang đủ đom đóm, interact cạnh đèn → `deposit` rồi `lantern_lit`, điểm +`per_lantern` | Unit + scenario |
| R5 | Thắp 5/5 đèn → `game_over won all_lit`, dòng `end` có `state: won` | Scenario |
| R6 | Bóng Mực đuổi Mây; chạm → `player_hit` (`flames` −1, rơi đom đóm theo tỉ lệ); trong `invuln_s` không bị chạm lại | Unit + scenario |
| R7 | Hết `flames` → `game_over lost no_flames` | Scenario |
| R8 | Tỏa sáng → Bóng Mực trong bán kính bị `stunned`, bị đẩy `pulse_push_m`, tốn `pulse_cost`, có cooldown | Unit + scenario |
| R9 | Bóng Mực không vào được `safe_radius` của đèn đã thắp | Unit |
| R10 | Hết giờ → `game_over lost dawn` | Scenario |
| R11 | Cùng seed, scenario, inputs → output giống hệt từng byte; khác seed → vị trí ngẫu nhiên khác | Chạy 2 lần, so SHA-256 |
| R12 | Sai định dạng inputs/scenario → mã thoát 2, lỗi ra stderr | Test CLI |
| R13 | Tọa độ làm tròn 3 chữ số; dòng cuối là `end` | Test headless |
| R14 | GUI: chơi được từ đầu tới thắng/thua, có HUD, chơi lại được | Chơi thử thủ công + ảnh chụp |
| R15 | `game.contract.json` khớp tuning thật của code | Unit test so sánh |

Lệnh kiểm chứng: `npm test` (unit + CLI) và `npm run verify` (chạy scenario, kiểm tra kỳ vọng, kiểm tra tất định, lưu output vào `docs/proof/phase-1/`).
