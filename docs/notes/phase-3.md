# Phase 3 — Spec, giả định, đánh giá (Ticket-03 "Đèn cạn dầu", Contract v1.2)

Nguồn: [docs/lab/TICKET-03.md](../lab/TICKET-03.md). Quyết định thiết kế: [ADR-001](adr-001-fuel.md). Breaking changes: [CHANGELOG.md](../../CHANGELOG.md).

## 1. Giả định cho chỗ còn mơ hồ

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| C1 | "Đèn đầy dầu không được chọn" trong khi bước 2 luôn trừ dầu trước bước 5 | Đèn chỉ "đầy" khi fuel = 100 sau bước 2. Vì vậy đèn đặt sẵn fuel 100 vẫn nhận 1 con ở tick đầu (fuel 99.983) |
| C2 | "Đi về đèn tắt gần nhất như trước" (Phase 2 không quy định điều này) | `wander` không có đèn yếu thì đi tới đèn tắt gần nhất và dừng cách nó ≤ 1 m. Không còn đèn tắt thì lượn ngẫu nhiên như B3 |
| C3 | Tốc độ khi `wander` đi tới đèn | 1.5 m/s (như B3) |
| C4 | `fuel_drain` "mỗi 60 tick" | Đếm riêng cho từng Bóng, tính từ lúc nó bắt đầu drain. Phát ở tick drain thứ 60, 120, … với fuel sau khi trừ |
| C5 | Đèn đặt `lit: true` bằng scenario | `ever_lit` mặc định true, `relit_count` 0, không tính vào `successful_lights` |
| C6 | Khoá điểm trong contract | Giữ các khoá cũ và đổi giá trị (`per_mote` 5, `per_stun` 5, `per_second_left` 0). Thêm `per_relight` 40, `per_stun_draining` 15, `per_lit_lantern_at_dawn` 50 |

## 2. Tiêu chí nghiệm thu → bằng chứng

| ID | Tiêu chí | Test | Scenario |
|---|---|---|---|
| P3-FUEL | Đèn sáng hao 1/s; fuel trong snapshot làm tròn 1 chữ số thập phân | `tests/phase3.test.js` | p3-fuel-out |
| P3-OUT | fuel ≤ 0 → `lantern_out`, tắt, deposited 0, ever_lit | ✓ | p3-fuel-out |
| P3-REFUEL | used = min(mang, ceil((100 − fuel)/10)), +5 điểm/con | ✓ | p3-refuel |
| P3-RELIGHT | Thắp lại cần 5, +40, relit_count, `relight: true` | ✓ | p3-relight |
| P3-CAP | capacity = 10 + 2 × lần thắp, tối đa 20 | ✓ | p3-relight |
| P3-DRAIN | wander → đèn yếu → drain ≤ 2 m, hút 5/s, `fuel_drain` mỗi 60 tick; mất vùng an toàn khi < 30; drain → chase (≤ 6 m); Tỏa Sáng +15; châm lên ≥ 30 thì đẩy Bóng ra | ✓ | p3-drain |
| P3-WIN | Thắng chỉ ở bình minh với ≥ ceil(0.6 × N) đèn; không thắng sớm; hết lửa ưu tiên thua | ✓ | dawn-win-3-of-5, p3-dawn-lost, p3-no-early-win |

Kết quả: `npm test` **62/62**, `npm run verify` **26/26 PASS** (hồi quy Phase 1 + 2 + 6 scenario Phase 3), xem [verify-report](../proof/phase-3/verify-report.md).

## 3. Test cũ đã sửa hoặc xóa (không skip)

| Test | Hành động | Lý do (Ticket-03) |
|---|---|---|
| R5 "thắng all_lit" và R5/T3 "thắng đúng tick hết giờ" | **Xóa**, thay bằng P3-WIN-* | §3 [THAY THẾ]: không còn thắng sớm, `all_lit` bị bỏ |
| scenario win-last-lantern | **Đổi** thành dawn-win-3-of-5 | Như trên |
| R4 điểm nạp (+10/con) | Sửa thành +5/con; `lantern_lit` có thêm `relight` | §5 [THAY THẾ] điểm; §7 sự kiện |
| walk-collect-light (điểm 200) | Sửa thành 150 | §5 |
| R1 / T10 time_left 300 / 330 | Sửa thành 240 / 270 | §3 thời lượng mới |
| T2 khoá player | Thêm `capacity` | §7 snapshot |
| R15 contract_version | Sửa thành "1.2" | §7 |

## 4. Đánh giá Phase 3
- **Đạt:** toàn bộ luật headless của Ticket-03. Test Phase 1–2 không bị thay thế vẫn đạt.
- **GUI:** có thanh dầu, đèn và thanh nhấp nháy 1 Hz khi fuel < 30, HUD hiện mang/sức chứa, cài đặt "Bảng màu dễ phân biệt" (viền/mắt Bóng #00B3FF, cảnh báo trắng kèm ⚠, đèn tắt bị xẹp 20%). **Chưa có người chơi thử bằng tay.** Vết rách trên giấy đèn chỉ được thể hiện đơn giản bằng việc xẹp và nghiêng, chưa có hoạ tiết rách thật.
- **AI sai ở Phase 3:** (10) script vá file lần đầu lỗi vì heredoc chứa ký tự đặc biệt → chuyển sang viết script bằng công cụ ghi file; (11) kịch bản test P3-DRAIN cho Bóng đi ngang qua vùng phát hiện 12 m của Mây nên nó chuyển `chase`. Code đúng, kịch bản sai → đặt Mây ra xa.
