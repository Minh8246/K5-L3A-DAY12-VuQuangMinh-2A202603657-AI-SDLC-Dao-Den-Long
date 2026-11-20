# Báo cáo kiểm chứng Phase 4

Sinh tự động bởi `npm run verify` (scripts/verify.js). Không sửa tay. Chạy lại ở tag tương ứng phải ra cùng file `runs/*.jsonl` (CI kiểm tra bằng `git diff --exit-code`).

| Kiểm tra | Yêu cầu | Mô tả / kết quả | Bằng chứng | KQ |
|---|---|---|---|---|
| unit+cli | R*, T* | node --test: 70 pass, 0 fail | test-report.txt | PASS |
| walk-collect-light | R3, R4 | Đi +Z nhặt 10 đom đóm (z=3..12) rồi interact cạnh L1 (z=15) → nạp 10, L1 sáng (P3: 10×5 + 100 = 150). end={"ticks":200,"state":"playing","score":150}; 2 lần chạy cùng sha256 8a4caacb3c50 | runs/walk-collect-light.jsonl | PASS |
| dawn-win-3-of-5 | R5 (thay bằng luật P3) | P3 thay luật thắng: 3 đèn sáng (fuel 100) và còn 1 s → bình minh tick 60, won dawn_survived; điểm 3×(50+99) + 3×50 = 597. end={"ticks":60,"state":"won","score":597}; 2 lần chạy cùng sha256 b65145eb310f | runs/dawn-win-3-of-5.jsonl | PASS |
| shade-hits-until-lost | R6, R7 | Bóng Mực đuổi Mây đứng yên: chạm tick 60, lùi 2 m/60 tick, quay lại chạm tick 150, 240 → no_flames. end={"ticks":240,"state":"lost","score":0}; 2 lần chạy cùng sha256 82a81ba4f55d | runs/shade-hits-until-lost.jsonl | PASS |
| pulse-stuns-pushes | R8 | Tỏa Sáng khi Bóng Mực cách 4 m (3D 4.005 ≤ 5) → choáng 120 tick, bị đẩy tới 8 m, không chạm được Mây. end={"ticks":170,"state":"playing","score":5}; 2 lần chạy cùng sha256 eb81f30d913f | runs/pulse-stuns-pushes.jsonl | PASS |
| safe-zone | R9 | Mây đứng cạnh đèn đã sáng; 2 Bóng Mực đuổi nhưng bị chặn ở mép 6 m. end={"ticks":1200,"state":"playing","score":0}; 2 lần chạy cùng sha256 b80486667f8b | runs/safe-zone.jsonl | PASS |
| dawn | R10 | Còn 2 s → hết giờ ở tick 120 → thua dawn. end={"ticks":120,"state":"lost","score":0}; 2 lần chạy cùng sha256 3a9162badcd4 | runs/dawn.jsonl | PASS |
| default-world-seed7 | R1, R11 | Thế giới mặc định Đêm 1 (seed 7) với input lộn xộn — kiểm tra tất định. end={"ticks":2232,"state":"lost","score":0}; 2 lần chạy cùng sha256 08fd1e7e35b9 | runs/default-world-seed7.jsonl | PASS |
| p2-dash | T5 | Lướt 14 m/s × 12 tick = 2.8 m rồi chạy 6 m/s; nhấn lại khi còn hồi chiêu bị bỏ qua. end={"ticks":60,"state":"playing","score":0}; 2 lần chạy cùng sha256 1c3eb1e3410e | runs/p2-dash.jsonl | PASS |
| p2-pause | T6 | Tạm dừng tick 10–20: tick tăng, sim_tick/vị trí/thời gian đứng yên; tiếp tục chạy. end={"ticks":30,"state":"playing","score":0}; 2 lần chạy cùng sha256 e070ce6ac446 | runs/p2-pause.jsonl | PASS |
| p2-hit-drop | T7 | Bị chạm khi mang 4: rơi 2 đom đóm (kind dropped, TTL 8 s) ra vành quanh Mây; Bóng Mực recoil 2 m trong 60 tick. end={"ticks":61,"state":"playing","score":0}; 2 lần chạy cùng sha256 a9a0cc1faf26 | runs/p2-hit-drop.jsonl | PASS |
| p2-fall | T8 | Chạy ra khỏi mép đảo 40 m → rơi Y < −10: −1 lửa, mất 5 đom đóm; hồi sinh ở (0,0,0). end={"ticks":200,"state":"playing","score":0}; 2 lần chạy cùng sha256 5465924a8027 | runs/p2-fall.jsonl | PASS |
| p2-shade-schedule | T4, T9 | Đêm 1: 2 Bóng Mực sinh tick 300 ở trạng thái spawning, con thứ 3 ở tick 780. end={"ticks":800,"state":"playing","score":0}; 2 lần chạy cùng sha256 51c5538b0d80 | runs/p2-shade-schedule.jsonl | PASS |
| p2-night2-pad | T10 | Đêm 2: đứng trên bục (20,0,18) → bắn 14 m/s lên + 24 m/s về đảo B, đáp ở tick 84 tại ≈ (51.238, 0, 6.755). end={"ticks":100,"state":"playing","score":0}; 2 lần chạy cùng sha256 642650577d92 | runs/p2-night2-pad.jsonl | PASS |
| p2-night3-ramp | T11 | Đêm 3: đi lên dốc 30° từ bán kính 30 (Y=0) tới tầng 1 (Y=3). end={"ticks":70,"state":"playing","score":0}; 2 lần chạy cùng sha256 fd5e894ef162 | runs/p2-night3-ramp.jsonl | PASS |
| p2-night3-wind | T11 | Đêm 3: cơn gió từ sim_tick 1800 kéo dài 300 tick. end={"ticks":2100,"state":"playing","score":0}; 2 lần chạy cùng sha256 2eeafbcf4eaa | runs/p2-night3-wind.jsonl | PASS |
| p2-drifter | T12 | Gió Lạc cách 10 m, Mây mang 6 → đuổi 7 m/s, chạm tick 76 cướp 3, flee 240 tick rồi removed (tick 316). end={"ticks":320,"state":"playing","score":0}; 2 lần chạy cùng sha256 b8d681c88144 | runs/p2-drifter.jsonl | PASS |
| p2-drifter-pulse | T12 | Tỏa Sáng trúng Gió Lạc đang flee mang 3 → thả 3 đom đóm rơi, biến mất sau 120 tick. end={"ticks":130,"state":"playing","score":0}; 2 lần chạy cùng sha256 56e638228dfa | runs/p2-drifter-pulse.jsonl | PASS |
| p2-charm | T13 | Đứng cạnh Bùa Gió C1 (35,0,0) → nhặt tick 1, rồi đi dọc cầu về −X (7.2 m/s); bùa xuất hiện lại sau 2700 tick (tick 2701). end={"ticks":2710,"state":"playing","score":0}; 2 lần chạy cùng sha256 31ae269b0cbb | runs/p2-charm.jsonl | PASS |
| p3-fuel-out | P3-FUEL, P3-OUT | Đèn sáng fuel 1 → hao 1/s → tắt ở tick 60 (lantern_out), deposited 0, ever_lit. end={"ticks":70,"state":"playing","score":0}; 2 lần chạy cùng sha256 d06fcd4246dc | runs/p3-fuel-out.jsonl | PASS |
| p3-refuel | P3-REFUEL | Châm dầu đèn fuel 55 khi mang 10 → dùng 5 con, fuel 100, +25 điểm. end={"ticks":10,"state":"playing","score":25}; 2 lần chạy cùng sha256 8c279c7772fc | runs/p3-refuel.jsonl | PASS |
| p3-relight | P3-RELIGHT, P3-CAP | Đèn từng sáng thắp lại bằng 5 con: relight true, +40, capacity 12. end={"ticks":5,"state":"playing","score":65}; 2 lần chạy cùng sha256 b7f0f939b7f1 | runs/p3-relight.jsonl | PASS |
| p3-drain | P3-DRAIN | Bóng wander tới đèn fuel 20, drain từ tick 120, fuel_drain tick 180 (fuel 12), đèn tắt tick 300. end={"ticks":320,"state":"playing","score":0}; 2 lần chạy cùng sha256 9ccbd37773cb | runs/p3-drain.jsonl | PASS |
| p3-dawn-lost | P3-WIN | 2/5 đèn sáng lúc bình minh → lost dawn. end={"ticks":60,"state":"lost","score":0}; 2 lần chạy cùng sha256 df25c5421d2d | runs/p3-dawn-lost.jsonl | PASS |
| p3-no-early-win | P3-WIN | Thắp đèn cuối khi 4 đèn đã sáng → Đêm không kết thúc. end={"ticks":120,"state":"playing","score":150}; 2 lần chạy cùng sha256 ab2711c0ec7a | runs/p3-no-early-win.jsonl | PASS |
| seed-differs | R11 | Seed 7 và seed 8 cho thế giới khác nhau | — | PASS |

Tổng: 26/26 PASS.
