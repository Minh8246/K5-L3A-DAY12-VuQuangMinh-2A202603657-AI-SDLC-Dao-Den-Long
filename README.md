# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Phase 4 — Release `v1.0.0`)_
> Day 12 AI SDLC lab · Vũ Quang Minh · 2A202603657 · Test Contract **v1.1** (Phase 2)

Game 3D góc nhìn thứ ba. Bạn là **Mây**, người giữ đèn nhỏ tuổi đội nón lá. Bạn gom **đom đóm** để thắp lại các **Đèn Lồng Lớn** trên ba hòn đảo trước bình minh, đồng thời né **Bóng Mực** và **Gió Lạc** trong sương.

## Cài đặt và chạy (macOS / Linux / Windows, cần Node ≥ 18)

```bash
npm ci
npm run dev        # mở game trong trình duyệt (http://localhost:5173)
```

- Vào thẳng một Đêm: `http://localhost:5173/?night=2&autostart`
- Bản web tĩnh: `npm run build` sinh ra thư mục `dist/`, mở bằng `npx vite preview`.

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D | Đi (theo hướng camera) |
| Kéo chuột trái / ← → | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| Space | Nhảy |
| Shift | Lướt (14 m/s trong 0.2 s, hồi chiêu 1.5 s) |
| E | Nạp đom đóm vào Đèn Lồng Lớn gần nhất (trong 2 m) |
| F | Tỏa sáng: tốn 3 đom đóm, làm choáng Bóng Mực trong 5 m (hồi chiêu 3 s) |
| Esc / P | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |

## Ba Đêm

| Đêm | Đảo | Đèn | Thời gian | Điểm đặc biệt |
|---|---|---|---|---|
| 1 | Đảo Bến | 5 | 300 s | Đảo tròn 40 m |
| 2 | Đảo Cau | 6 | 330 s | Hai đảo nối bằng cầu tre, bục nhảy bắn qua biển mây, Gió Lạc, Bùa Gió |
| 3 | Đảo Chuông | 7 | 360 s | Ba tầng có dốc và vách, tháp chuông, bục lên đỉnh, gió mạnh mỗi 30 s, Bóng Mực nhanh hơn |

Chuỗi màn hình: Menu → giới thiệu Đêm (lời Ông Đăng) → chơi → kết quả → Đêm kế tiếp. Thắng Đêm 3 thì tới màn Bình Minh với tổng điểm. Thua thì được chơi lại Đêm đó. Cài đặt (âm lượng, độ nhạy chuột) được lưu trong trình duyệt.

## Luật chơi và cách tính điểm (số chuẩn Ticket-02)

- Nhặt đom đóm tự động (≤ 1 m), mang tối đa **10** con. Mỗi đèn cần **10** con, nạp được nhiều lần và đèn nhớ tiến độ. Đèn đã sáng tạo vùng an toàn **6 m**.
- Bị Bóng Mực chạm: −1 Ngọn Lửa (có 3), **rơi một nửa** số đom đóm đang mang ra xung quanh (nhặt lại được trong 8 s), được bất tử 1.5 s.
- Rơi khỏi đảo: −1 Ngọn Lửa, mất hết đom đóm, hồi sinh ở điểm xuất phát.
- **Gió Lạc** cướp tối đa 3 đom đóm khi bạn mang từ 5 con trở lên. Tỏa sáng trúng nó thì nó bỏ chạy, hoặc thả lại số đom đóm đã cướp.
- **Bùa Gió**: trong 10 s chạy nhanh hơn (7.2 m/s) và lướt không cần hồi chiêu.
- **Thắng:** thắp hết đèn. **Thua:** hết Ngọn Lửa, hoặc hết giờ (bình minh).

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm **nạp** vào đèn | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng | +5 |
| Khi **thắng**: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi **thắng**: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm của cả game là tổng điểm các Đêm đã thắng.

## Chế độ headless (Test Contract v1.1)

Khai báo trong [`game.contract.json`](game.contract.json). Sau khi chạy `npm ci`:

```bash
node src/headless.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl \
  [--scenario scenario.json] [--inputs inputs.json] [--snapshot-every 10]
```

- `--night` nhận 1, 2 hoặc 3. Logic chạy 60 tick/giây, không cần cửa sổ hay GPU. Một Đêm đầy đủ (21.600 tick) chạy dưới 1 giây.
- Mã thoát: `0` thành công · `1` sai tham số · `2` file inputs/scenario sai định dạng.
- Tất định: cùng seed, scenario và inputs thì output giống hệt từng byte.
- Mọi khóa `tuning` đều có giá trị thật theo số chuẩn. Giả định cho các chỗ còn mơ hồ nằm ở [docs/notes/phase-2.md](docs/notes/phase-2.md) (B1–B21).

## Kiểm thử và bằng chứng

```bash
npm test           # 50 unit + CLI test (node:test)
npm run verify     # 20 scenario headless (hồi quy Phase 1 + Phase 2) + kiểm tra tất định
```

| Phase | Spec và đánh giá | Bằng chứng |
|---|---|---|
| 1 | [phase-1.md](docs/notes/phase-1.md) | [docs/proof/phase-1/](docs/proof/phase-1/verify-report.md) (khớp tag `phase-1`) |
| 2 | [phase-2.md](docs/notes/phase-2.md) | [docs/proof/phase-2/](docs/proof/phase-2/verify-report.md) |

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) chạy test và verify trên Ubuntu và macOS mỗi lần push, rồi kiểm tra output scenario khớp đúng file đã commit.

## Sáng tạo của tôi

Toàn bộ nằm ở lớp hiển thị `src/render/`, nên **không đổi output headless**:

- **Đom đóm bay quanh nón lá:** số đom đóm đang mang bay vòng quanh Mây.
- **Vòng sáng an toàn:** đèn đã sáng có vòng sáng trên mặt đất, đúng bằng bán kính vùng an toàn 6 m.
- **Cột tiến độ ở chân đèn:** cột sáng mọc dần theo số đom đóm đã nạp.
- **Lời Ông Đăng:** mỗi Đêm mở đầu bằng một câu dặn dò riêng.
- **Âm thanh tự tổng hợp bằng WebAudio:** không cần file âm thanh ngoài.

Bằng chứng phần lõi không bị ảnh hưởng: `src/core/` không import gì từ `src/render/`, và mọi scenario trong verify-report vẫn PASS, output trùng khớp từng byte giữa các lần chạy.

## Cấu trúc

```text
src/core/        logic thuần, tất định (sim, maps, tuning, rng, kiểm tra định dạng)
src/headless.js  CLI theo Test Contract
src/render/      Three.js, HUD, menu, âm thanh
tests/           unit + CLI test · scenarios/  scenario headless từng phase
scripts/         verify.js, hooks/stop-gate.js
docs/lab/        đề bài (PRD-0, TICKET-02, hướng dẫn lab)
docs/notes/      spec, giả định, đánh giá từng phase, nhật ký AI
docs/proof/      bằng chứng từng phase
CLAUDE.md, .claude/   harness AI (hướng dẫn agent, skill verify, Stop hook)
```
