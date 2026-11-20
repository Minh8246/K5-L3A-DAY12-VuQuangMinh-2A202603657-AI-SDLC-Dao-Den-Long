# Báo cáo kiểm chứng Phase 2

Sinh tự động bởi `npm run verify` (scripts/verify.js). Không sửa tay. Chạy lại ở tag tương ứng phải ra cùng file `runs/*.jsonl` (CI kiểm tra bằng `git diff --exit-code`).

| Kiểm tra | Yêu cầu | Mô tả / kết quả | Bằng chứng | KQ |
|---|---|---|---|---|
| unit+cli | R*, T* | node --test: 50 pass, 0 fail | test-report.txt | PASS |
| walk-collect-light | R3, R4 | Đi +Z nhặt 10 đom đóm (z=3..12) rồi interact cạnh L1 (z=15) → nạp 10, L1 sáng. end={"ticks":200,"state":"playing","score":200}; 2 lần chạy cùng sha256 dd54ad2563be | runs/walk-collect-light.jsonl | PASS |
| win-last-lantern | R5 | 4 đèn sáng sẵn, nạp 10 vào đèn cuối → thắng all_lit (100 + 100 + 299×2 + 3×50). end={"ticks":1,"state":"won","score":948}; 2 lần chạy cùng sha256 18022ac61aa4 | runs/win-last-lantern.jsonl | PASS |
| shade-hits-until-lost | R6, R7 | Bóng Mực đuổi Mây đứng yên: chạm tick 60, lùi 2 m/60 tick, quay lại chạm tick 150, 240 → no_flames. end={"ticks":240,"state":"lost","score":0}; 2 lần chạy cùng sha256 eeb9e7ca134c | runs/shade-hits-until-lost.jsonl | PASS |
| pulse-stuns-pushes | R8 | Tỏa Sáng khi Bóng Mực cách 4 m (3D 4.005 ≤ 5) → choáng 120 tick, bị đẩy tới 8 m, không chạm được Mây. end={"ticks":170,"state":"playing","score":5}; 2 lần chạy cùng sha256 95af5dcf1c5d | runs/pulse-stuns-pushes.jsonl | PASS |
| safe-zone | R9 | Mây đứng cạnh đèn đã sáng; 2 Bóng Mực đuổi nhưng bị chặn ở mép 6 m. end={"ticks":1200,"state":"playing","score":0}; 2 lần chạy cùng sha256 ae7dedbe0dba | runs/safe-zone.jsonl | PASS |
| dawn | R10 | Còn 2 s → hết giờ ở tick 120 → thua dawn. end={"ticks":120,"state":"lost","score":0}; 2 lần chạy cùng sha256 622b49796190 | runs/dawn.jsonl | PASS |
| default-world-seed7 | R1, R11 | Thế giới mặc định Đêm 1 (seed 7) với input lộn xộn — kiểm tra tất định. end={"ticks":2511,"state":"lost","score":0}; 2 lần chạy cùng sha256 baaa79e7e45b | runs/default-world-seed7.jsonl | PASS |
| p2-dash | T5 | Lướt 14 m/s × 12 tick = 2.8 m rồi chạy 6 m/s; nhấn lại khi còn hồi chiêu bị bỏ qua. end={"ticks":60,"state":"playing","score":0}; 2 lần chạy cùng sha256 01d2d0b0d800 | runs/p2-dash.jsonl | PASS |
| p2-pause | T6 | Tạm dừng tick 10–20: tick tăng, sim_tick/vị trí/thời gian đứng yên; tiếp tục chạy. end={"ticks":30,"state":"playing","score":0}; 2 lần chạy cùng sha256 7e9147212360 | runs/p2-pause.jsonl | PASS |
| p2-hit-drop | T7 | Bị chạm khi mang 4: rơi 2 đom đóm (kind dropped, TTL 8 s) ra vành quanh Mây; Bóng Mực recoil 2 m trong 60 tick. end={"ticks":61,"state":"playing","score":0}; 2 lần chạy cùng sha256 332b695911be | runs/p2-hit-drop.jsonl | PASS |
| p2-fall | T8 | Chạy ra khỏi mép đảo 40 m → rơi Y < −10: −1 lửa, mất 5 đom đóm; hồi sinh ở (0,0,0). end={"ticks":200,"state":"playing","score":0}; 2 lần chạy cùng sha256 c2bf48f13683 | runs/p2-fall.jsonl | PASS |
| p2-shade-schedule | T4, T9 | Đêm 1: 2 Bóng Mực sinh tick 300 ở trạng thái spawning, con thứ 3 ở tick 780. end={"ticks":800,"state":"playing","score":0}; 2 lần chạy cùng sha256 7d7a935aeb56 | runs/p2-shade-schedule.jsonl | PASS |
| p2-night2-pad | T10 | Đêm 2: đứng trên bục (20,0,18) → bắn 14 m/s lên + 24 m/s về đảo B, đáp ở tick 84 tại ≈ (51.238, 0, 6.755). end={"ticks":100,"state":"playing","score":0}; 2 lần chạy cùng sha256 c7ab2d93216f | runs/p2-night2-pad.jsonl | PASS |
| p2-night3-ramp | T11 | Đêm 3: đi lên dốc 30° từ bán kính 30 (Y=0) tới tầng 1 (Y=3). end={"ticks":70,"state":"playing","score":0}; 2 lần chạy cùng sha256 a0baba9ffc52 | runs/p2-night3-ramp.jsonl | PASS |
| p2-night3-wind | T11 | Đêm 3: cơn gió từ sim_tick 1800 kéo dài 300 tick. end={"ticks":2100,"state":"playing","score":0}; 2 lần chạy cùng sha256 376e57a2747d | runs/p2-night3-wind.jsonl | PASS |
| p2-drifter | T12 | Gió Lạc cách 10 m, Mây mang 6 → đuổi 7 m/s, chạm tick 76 cướp 3, flee 240 tick rồi removed (tick 316). end={"ticks":320,"state":"playing","score":0}; 2 lần chạy cùng sha256 6521a0e7fa70 | runs/p2-drifter.jsonl | PASS |
| p2-drifter-pulse | T12 | Tỏa Sáng trúng Gió Lạc đang flee mang 3 → thả 3 đom đóm rơi, biến mất sau 120 tick. end={"ticks":130,"state":"playing","score":0}; 2 lần chạy cùng sha256 ecfcd9b2a3d1 | runs/p2-drifter-pulse.jsonl | PASS |
| p2-charm | T13 | Đứng cạnh Bùa Gió C1 (35,0,0) → nhặt tick 1, rồi đi dọc cầu về −X (7.2 m/s); bùa xuất hiện lại sau 2700 tick (tick 2701). end={"ticks":2710,"state":"playing","score":0}; 2 lần chạy cùng sha256 78ead269cbf6 | runs/p2-charm.jsonl | PASS |
| seed-differs | R11 | Seed 7 và seed 8 cho thế giới khác nhau | — | PASS |

Tổng: 20/20 PASS.
