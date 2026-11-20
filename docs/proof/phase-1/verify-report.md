# Báo cáo kiểm chứng Phase 1

Sinh tự động bởi `npm run verify` (scripts/verify.js). Không sửa tay. Chạy lại ở tag tương ứng phải ra cùng file `runs/*.jsonl` (CI kiểm tra bằng `git diff --exit-code`).

| Kiểm tra | Yêu cầu | Mô tả / kết quả | Bằng chứng | KQ |
|---|---|---|---|---|
| unit+cli | R1–R15 | node --test: 32 pass, 0 fail | test-report.txt | PASS |
| walk-collect-light | R3, R4 | Đi thẳng +Z nhặt 5 đom đóm rồi interact cạnh L1 → deposit 5, L1 sáng. end={"ticks":120,"state":"playing","score":150}; 2 lần chạy cùng sha256 9fd0d639dd22 | runs/walk-collect-light.jsonl | PASS |
| win-last-lantern | R5 | 4 đèn sáng sẵn, nạp đèn cuối → thắng all_lit; đèn sáng sẵn không cộng điểm. end={"ticks":1,"state":"won","score":848}; 2 lần chạy cùng sha256 a7bfe30f3442 | runs/win-last-lantern.jsonl | PASS |
| shade-hits-until-lost | R6, R7 | Bóng Mực đuổi tới Mây đứng yên; 3 lần chạm cách nhau invuln 90 tick → thua no_flames. end={"ticks":240,"state":"lost","score":0}; 2 lần chạy cùng sha256 53b66c4091ba | runs/shade-hits-until-lost.jsonl | PASS |
| pulse-stuns-pushes | R8 | Tỏa sáng khi Bóng Mực ở 4 m → choáng + đẩy, không bị chạm trong lúc choáng. end={"ticks":170,"state":"playing","score":25}; 2 lần chạy cùng sha256 34d931667330 | runs/pulse-stuns-pushes.jsonl | PASS |
| safe-zone | R9 | Mây đứng cạnh đèn đã thắp; Bóng Mực không vào được safe_radius nên không chạm được Mây. end={"ticks":1200,"state":"playing","score":0}; 2 lần chạy cùng sha256 e7303626f857 | runs/safe-zone.jsonl | PASS |
| dawn | R10 | Còn 2 s → hết giờ ở tick 120 → thua dawn. end={"ticks":120,"state":"lost","score":0}; 2 lần chạy cùng sha256 7dccbbef872e | runs/dawn.jsonl | PASS |
| default-world-seed7 | R1, R11 | Thế giới mặc định (ngẫu nhiên theo seed 7) với input lộn xộn — dùng để kiểm tra tất định. end={"ticks":1752,"state":"lost","score":80}; 2 lần chạy cùng sha256 58ca22367e2b | runs/default-world-seed7.jsonl | PASS |
| seed-differs | R11 | Seed 7 và seed 8 cho thế giới khác nhau | — | PASS |

Tổng: 9/9 PASS.
