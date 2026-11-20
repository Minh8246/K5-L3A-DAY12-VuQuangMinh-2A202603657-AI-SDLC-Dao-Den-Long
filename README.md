# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Phase 4 — Release `v1.0.0`)_
> Day 12 AI SDLC lab · Vũ Quang Minh · 2A202603657 · Test Contract **v1.0**

Game 3D góc nhìn thứ ba. Bạn là **Mây**, người giữ đèn nhỏ tuổi đội nón lá. Hãy gom **đom đóm** trên Đảo Bến, mang về thắp lại **5 Đèn Lồng Lớn** trước bình minh, và né **Bóng Mực** trong sương tím.

## Cài đặt và chạy (macOS / Linux / Windows, cần Node ≥ 18)

```bash
npm ci
npm run dev        # mở game trong trình duyệt (http://localhost:5173)
```

Bản web tĩnh để phát hành: `npm run build` → thư mục `dist/` (mở bằng `npx vite preview`).

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D | Đi (theo hướng camera) |
| Kéo chuột trái / ← → | Xoay camera |
| Space | Nhảy |
| E | Nạp đom đóm vào Đèn Lồng Lớn gần nhất (trong 2.5 m) |
| F | Tỏa sáng: tốn 1 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 6 m (hồi chiêu 2 s) |
| R | Chơi lại (cả khi đang chơi, thắng hay thua) |

## Luật chơi và cách tính điểm

- Đi qua đom đóm để nhặt (bán kính 1.2 m), mang tối đa **5** con.
- Mỗi đèn cần **5** đom đóm. Đèn đã thắp tạo vùng an toàn bán kính **5 m** mà Bóng Mực không vào được.
- Bóng Mực chạm vào: mất **1 ngọn lửa** (có 3), rơi **một nửa** số đom đóm đang mang (làm tròn xuống), được bất tử **1.5 s**.
- **Thắng:** thắp đủ 5 đèn. **Thua:** hết lửa, hoặc hết **5 phút** (bình minh tới khi đảo vẫn tối).

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực bị choáng bởi một lần tỏa sáng | +25 |
| Khi **thắng**: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi **thắng**: mỗi ngọn lửa còn lại | +50 |

## Chế độ headless (Test Contract v1.0)

Khai báo: [`game.contract.json`](game.contract.json). Sau `npm ci`:

```bash
node src/headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl \
  [--scenario scenario.json] [--inputs inputs.json] [--snapshot-every 10]
```

- 60 tick/giây, không cần cửa sổ hay GPU. Mã thoát: `0` ok · `1` sai tham số · `2` file inputs/scenario sai định dạng.
- Tất định: cùng seed, scenario và inputs cho output giống hệt từng byte.
- Mọi khóa `tuning` đều có giá trị thật, không có `null`. `fall_enabled: false` vì Mây bị chặn ở mép đảo (không rơi được), nên game không bao giờ phát `player_hit` với `by: "fall"`.
- Giả định cho các chỗ contract còn mơ hồ (tỏa sáng tốn gì, chỉ đèn đã thắp mới có vùng an toàn, thứ tự xử lý trong một tick…): [docs/notes/phase-1.md](docs/notes/phase-1.md).

## Kiểm thử và bằng chứng

```bash
npm test           # 32 unit + CLI test (node:test)
npm run verify     # scenario headless qua CLI thật + kiểm tra tất định → docs/proof/phase-1/
```

- Báo cáo: [docs/proof/phase-1/verify-report.md](docs/proof/phase-1/verify-report.md). CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) chạy test + verify trên Ubuntu và macOS mỗi lần push, và kiểm tra output scenario khớp đúng file đã commit.
- Truy vết yêu cầu → bằng chứng: [docs/notes/phase-1.md](docs/notes/phase-1.md) (mục 4 và 5).

## Sáng tạo của tôi

Chỉ nằm ở lớp hiển thị `src/render/`, nên **không đổi output headless**.

- **Đom đóm bay quanh nón lá:** số đom đóm đang mang bay vòng quanh Mây, nhìn là biết đang mang bao nhiêu.
- **Vòng sáng an toàn:** đèn đã thắp có vòng sáng cam trên mặt đất, đúng bằng `safe_radius`, cho người chơi biết chỗ trú.
- **Đảo ấm dần:** mỗi đèn thắp lên làm trời sáng hơn và sương chuyển dần từ tím đen sang ấm.
- **Cột tiến độ ở chân đèn:** cột vàng mọc dần theo số đom đóm đã nạp.

Bằng chứng phần lõi không bị ảnh hưởng: `src/core/` không import gì từ `src/render/` (quy tắc trong [CLAUDE.md](CLAUDE.md)). Toàn bộ scenario trong `verify-report.md` vẫn PASS và output trùng khớp từng byte giữa các lần chạy.

## Cấu trúc

```text
src/core/        logic thuần, tất định (sim, tuning, rng, kiểm tra định dạng)
src/headless.js  CLI theo Test Contract
src/render/      Three.js + HUD
tests/           unit + CLI test
scenarios/       scenario headless của từng phase
scripts/         verify.js, hooks/stop-gate.js
docs/lab/        đề bài (PRD-0, hướng dẫn lab)
docs/notes/      spec + giả định từng phase, nhật ký dùng AI
docs/proof/      bằng chứng từng phase
CLAUDE.md, .claude/   harness AI (hướng dẫn agent, skill verify, Stop hook)
```
