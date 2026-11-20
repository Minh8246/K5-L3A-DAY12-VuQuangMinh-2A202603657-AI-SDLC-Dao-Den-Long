# Changelog

## [phase-4] — v1.0.0, Contract v1.3 "Bình minh: phát hành" (Ticket-04)

### ⚠ Breaking changes
- `contract_version` "1.3"; thêm `bench_cmd`, `soak_cmd`. `build_cmd` thành `npm ci && npm run build`; `run_cmd` thành `npx electron .` (bản desktop). Headless không đổi.
- Phím điều khiển giờ đọc từ cấu hình đổi phím; tạm dừng mặc định là Esc (P vẫn dùng được nếu chưa gán cho việc khác).

### Thêm
- Bản desktop Electron (cửa sổ 1280×720), chế độ benchmark (`--bench`), lệnh `--export-leaderboard`.
- Soak test `src/soak.js` (10 Đêm, đo RSS).
- Bảng xếp hạng cục bộ (top 10, lưu file hoặc localStorage, tên tiếng Việt).
- Tiếp cận: đổi phím có báo trùng và khôi phục mặc định, phụ đề và mũi tên Bóng Mực, giảm chuyển động, chữ ≥ 18 px và tùy chọn ×1.25.
- Vẽ Bóng Mực và đom đóm bằng InstancedMesh (bench avg 70.9 → 328 fps).

## [phase-3] — Contract v1.2 "Đèn cạn dầu" (Ticket-03)

### ⚠ Breaking changes
- **Luật thắng:** không còn thắng sớm khi thắp hết đèn. Chỉ thắng ở bình minh nếu còn sống và số đèn đang sáng ≥ ceil(0.6 × tổng đèn). `game_over.reason` có thêm `dawn_survived`; **`all_lit` bị bỏ**.
- **Đèn có thể tắt:** đèn sáng hao dầu 1/giây và bị Bóng Mực hút. Hết dầu thì phát `lantern_out`, `deposited` về 0. Đèn đã sáng **nhận thêm đom đóm** (châm dầu); trước đây thì không.
- **Vùng an toàn:** chỉ còn khi đèn sáng **và fuel ≥ 30**. Trước đây mọi đèn sáng đều có vùng an toàn.
- **Bóng Mực:** có thêm trạng thái `drain`. Hết choáng thì về `wander` (trước đây giữ trạng thái cũ). `wander` đi tới đèn yếu hoặc đèn tắt thay vì lượn ngẫu nhiên.
- **Điểm:** +5 mỗi đom đóm nạp (trước +10), thắp lại +40, Tỏa Sáng trúng con đang drain +15. Ở bình minh: mỗi đèn sáng +50 + floor(fuel). **Bỏ thưởng thời gian.**
- **Thời lượng Đêm:** 300/330/360 s → **240/270/300 s**.
- **Sức chứa:** 10 + 2 × số lần thắp thành công, tối đa 20 (trước cố định 10).
- **Contract:** `contract_version` "1.2". Tuning thêm `fuel_*`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`. Snapshot đèn thêm `fuel`, `ever_lit`, `relit_count`; player thêm `capacity`. Sự kiện `lantern_lit` thêm `relight`. Sự kiện mới: `refuel`, `lantern_out`, `fuel_drain`. Scenario thêm `lanterns[].fuel/ever_lit`, `player.successful_lights`, `shades[].target_lantern_id`.

### Thêm
- Thanh dầu trên đèn, nhấp nháy 1 Hz khi fuel < 30. Cài đặt "Bảng màu dễ phân biệt" (được lưu). Xem [ADR-001](docs/notes/adr-001-fuel.md).

## [phase-2] — Contract v1.1 "Ba hòn đảo" (Ticket-02)
### ⚠ Breaking changes
- Toàn bộ số tự chọn của Phase 1 thay bằng số chuẩn. Bóng Mực có 5 trạng thái. Có rơi khỏi đảo. Điểm +10 tính khi **nạp**, không còn khi nhặt. Dòng đầu output headless là sự kiện `night_start`.
### Thêm
- Đêm 2, Đêm 3, lướt, tạm dừng, Gió Lạc, Bùa Gió, chuỗi 3 Đêm, cài đặt, âm thanh, HUD chuẩn.

## [phase-1] — Contract v1.0
- Đêm 1, chế độ headless, harness (CLAUDE.md, skill verify, Stop hook, CI).
