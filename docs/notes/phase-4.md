# Phase 4 — Spec, giả định, đánh giá (Ticket-04 "Bình minh: phát hành v1.0.0", Contract v1.3)

Nguồn: [docs/lab/TICKET-04.md](../lab/TICKET-04.md).

## 1. Quyết định kỹ thuật

| Quyết định | Lý do |
|---|---|
| Thêm bản desktop **Electron 33** (`electron/main.cjs`) dùng chính bản build web | Cần cửa sổ 1280×720 thật, tắt được vsync, đo RSS tiến trình, lưu bảng xếp hạng trên đĩa và chạy `--export-leaderboard` từ dòng lệnh. Bản web thuần không làm được những việc này |
| Electron phục vụ `dist/` qua server HTTP cục bộ 127.0.0.1 | Module script không chạy được từ `file://` |
| Vẽ Bóng Mực và đom đóm bằng **InstancedMesh** | Lần bench đầu: avg 70.9 / p1 23.5 fps vì có khoảng 1000 lệnh vẽ. Sau instancing: avg 328 / p1 38.6, hình ảnh giữ nguyên |
| Logic bảng xếp hạng ở `src/leaderboard.js`, dùng chung cho Electron, web và test | Một nguồn sự thật cho luật sắp xếp và tên. Không đặt trong `src/core/` vì cần `Date` (core cấm dùng) |

## 2. Giả định

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| D1 | "Đêm thứ i dùng seed 7 + i" | i = 1…10 → seed 8…17. Đêm thứ i là Đêm ((i − 1) mod 3) + 1 |
| D2 | Input soak "ngẫu nhiên theo seed" | Luồng ngẫu nhiên riêng `createRng((seed + i) ^ 0x5eed)`, để không làm đổi chuỗi ngẫu nhiên của thế giới |
| D3 | Pixel ratio trong bench | Render đúng 1280×720 pixel (pixel ratio 1). Khi chơi thường dùng min(DPR, 1.5) |
| D4 | `peak_mem_mb` với Electron (nhiều tiến trình) | Tổng working set (RSS) của mọi tiến trình Electron, lấy mẫu mỗi 250 ms |
| D5 | "Phần sáng tạo phải tắt trong bench" | Tắt vòng sáng vùng an toàn. Thanh dầu là yêu cầu của Ticket-03 nên vẫn giữ |
| D6 | Tên tiếng Việt | Chấp nhận `[\p{L}\p{N}_]{3,12}` (bao gồm `[A-Za-z0-9_]`), chuẩn hóa NFC |
| D7 | `seed` của mục bảng xếp hạng | Seed của lượt chơi; Đêm n dùng seed + n |
| D8 | Phím tạm dừng | Mặc định Esc và đổi được. P luôn tạm dừng thêm nếu P chưa gán cho hành động khác (giữ yêu cầu Esc/P của Ticket-02) |

## 3. Soak: chẩn đoán bộ nhớ (trung thực)

Lần chạy đầu với cờ mặc định của Node: RSS 47.7 → 57.8 MB (×1.21), **không đạt** ngưỡng ×1.2. Mình không ép số mà đo heap JS sau gc qua 60 Đêm:

| Đêm | heapUsed sau gc | heapTotal | RSS |
|---|---|---|---|
| 1 | 4.2 MB | 7.4 | 48.9 |
| 10 | 4.4 | 9.4 | 53.9 |
| 60 | 4.5 | 13.4 | 56.8 |

Heap thực dùng gần như đứng yên, nên **không có rò rỉ**. RSS tăng vì V8 nở thêm dung lượng dự trữ của heap và bộ nhớ mã JIT. Lệnh soak trong contract vì vậy chạy Node với `--max-semi-space-size=1`. Kết quả 10 Đêm: 47.7 → 55.7 MB (×1.168), 0 crash.

**Cập nhật sau CI (Ubuntu, Node 20):** cùng lệnh đó cho **42.5 → 75.5 MB (×1.78), không đạt**. CI bắt được lỗi này sau khi đã tạo Release. Trên Linux, bộ nhớ biên dịch JIT (TurboFan) và vùng nhớ của các luồng nền bị glibc malloc giữ lại, không trả cho hệ điều hành, trong khi heap JS vẫn đứng yên. Vì vậy `soak_cmd` chạy V8 ở chế độ `--jitless --single-threaded`: chỉ dùng trình thông dịch, không có luồng nền, nên đo đúng bộ nhớ của game. Trên Windows: ×1.175 (chỉ semi-space) → ×1.093 (+ single-threaded) → ×1.040 (+ jitless) → **×1.033 (cả hai)**. Thời gian 10 Đêm tăng từ 0.4 s lên 1.3 s, không đáng kể. Headless (`headless_cmd`) vẫn chạy bình thường có JIT.

## 4. Tiêu chí nghiệm thu → bằng chứng

| Yêu cầu | Kết quả | Bằng chứng |
|---|---|---|
| Bench: cảnh chuẩn (200 Bóng Mực wander, 100 đom đóm, L1–L3 fuel 100, camera vòng 30 m / 15 s, khởi động 3 s, đo 30 s, tự thoát mã 0) | **Đạt** | Test B1–B4; [bench.json](../proof/phase-4/bench.json); [ảnh cảnh bench](../proof/phase-4/bench-scene.png) |
| Bench ≥ 60 avg / ≥ 30 p1 / load ≤ 10 s | **Đạt trên máy tác giả**: 328.4 / 38.6 / 1352 ms. Hai lần đo trước khi tối ưu cấp phát: p1 39.1 và 31.3, tức là có dao động | bench.json. Số chính thức đo trên máy chấm |
| Soak 10 Đêm, 0 crash, RSS ≤ 1.2× | **Đạt** sau khi sửa (×1.03 trên Windows; CI Ubuntu kiểm lại) | [soak.json](../proof/phase-4/soak.json), test S1 |
| Bảng xếp hạng: nhập tên, top 10, sắp xếp, lưu đĩa, màn hình từ menu, lệnh xuất | **Đạt** (lệnh xuất đã kiểm bằng dữ liệu mẫu) | Test L1–L2; [leaderboard-export.log.txt](../proof/phase-4/leaderboard-export.log.txt): bằng điểm 420 thì Cuc (đạt trước) đứng trên Bao |
| Đổi phím (báo trùng, khôi phục mặc định, được lưu), phụ đề, giảm chuyển động, chữ ≥ 18 px và ×1.25 | **Đã code**, chưa có người dùng kiểm bằng tay | `src/render/main.js`, `index.html` |
| Contract v1.3 (bench_cmd, soak_cmd) | **Đạt** | Test C4, R15 |
| Hồi quy Phase 1–3 | **Đạt**: 70/70 test, 26/26 scenario | [verify-report](../proof/phase-4/verify-report.md) |
| Release v1.0.0, video | Xem README và Release | Video do tác giả tự quay |

## 5. Đánh giá Phase 4

- **AI sai:**
  - (13) Electron tải về nhưng không giải nén được trên Windows. Agent phát hiện vì thư mục `dist` chỉ có `locales/`, rồi giải nén thủ công từ cache.
  - (14) Lần chạy Electron đầu lỗi `app` undefined do shell của agent có `ELECTRON_RUN_AS_NODE=1`. Đã ghi vào README phần xử lý sự cố.
  - (15) Instancing làm màu thân Bóng Mực sai vì thuộc tính màu instance tạo sau khi shader đã biên dịch. Phát hiện khi xem ảnh chụp bench.
  - (16) Đặt `leaderboard.js` trong `src/core/` vi phạm quy tắc "core cấm `Date`" của CLAUDE.md. Agent tự phát hiện khi đối chiếu quy tắc và chuyển ra `src/`.
- **Chưa làm / chưa kiểm:**
  - Chưa ai chơi thử bằng tay các tính năng tiếp cận.
  - Đèn tắt mới chỉ được thể hiện bằng cách xẹp và nghiêng, chưa có họa tiết rách thật.
  - Bench chỉ đo trên một máy (laptop GPU tích hợp).
