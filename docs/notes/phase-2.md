# Phase 2 — Spec, giả định, thay đổi thiết kế (Ticket-02, Contract v1.1)

Nguồn: [docs/lab/TICKET-02.md](../lab/TICKET-02.md). Viết trước khi code.

## 1. Đổi hướng so với Phase 1 (và vì sao)

Ticket-02 **thay toàn bộ số tự chọn** bằng số chuẩn, nên `src/core/sim.js` được viết lại theo thứ tự tick bắt buộc (12 bước) và có bản đồ theo từng Đêm (`src/core/maps.js`).

| Giả định Phase 1 | Ticket-02 | Hệ quả |
|---|---|---|
| A2 tỏa sáng tốn đom đóm | Đúng hướng, nhưng tốn 3 con | Giữ cơ chế, đổi số |
| A6 đom đóm rơi thì mất | Rơi ra vành 1.5–2.5 m, TTL 480 tick | Bỏ A6 |
| A8 chỉ đèn đã thắp có vùng an toàn | Đúng | Giữ; bán kính 6, chặn ở đúng mép 6 m |
| A10 không rơi khỏi đảo | Có rơi (Y < −10) | Bỏ A10; `fall_enabled: true` |
| A11 thưởng chỉ khi thắng | Đúng | Giữ |
| A3 / A11 điểm: +10 khi **nhặt**, +25 khi choáng | +10 khi **nạp**, +5 mỗi con trúng | Đổi |
| A13 Bóng Mực ngẫu nhiên trên vòng 26 m, mỗi 25 s | Điểm sinh và lịch chuẩn | Đổi |
| A14 trạng thái chase / stunned | spawning / wander / chase / recoil / stunned | Đổi |
| A17 thắng ngay khi thắp đèn cuối | Xét thắng/thua **cuối tick**, hết lửa luôn ưu tiên thua | Đổi |

**Test Phase 1 bị ảnh hưởng.** Test nào dùng số cố định cũ thì được **sửa theo số chuẩn**, không xóa. Test nào kiểm tra luật đã bị thay (A6 đom đóm biến mất, A10 không rơi) thì **bỏ và ghi lý do** ở mục 5. Scenario Phase 1 (`scenarios/phase1.cases.json`) được tính lại giá trị mong đợi bằng tay theo số chuẩn. Đây là hồi quy theo đúng DoD: "test ẩn Phase 1 vẫn đạt khi chạy với số chuẩn".

## 2. Giả định cho chỗ Ticket-02 còn mơ hồ

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| B1 | Tăng tốc ≤ 0.1 s | Tăng tốc và dừng tức thì (0 s, thỏa ≤ 0.1 s) |
| B2 | Thời gian ở trạng thái `spawning` | 60 tick: không di chuyển, không gây sát thương, rồi chuyển `wander` hoặc `chase` |
| B3 | `wander` di chuyển thế nào | Bay 1.5 m/s tới một điểm sinh đom đóm ngẫu nhiên của Đêm (theo seed), tới nơi (≤ 1 m) thì chọn điểm mới. `wander` → `chase` khi XZ ≤ 12; `chase` → `wander` khi XZ > 18 hoặc Mây đang chờ hồi sinh |
| B4 | Độ cao Bóng Mực / Gió Lạc | Tâm bay ở Y = 1 khi sinh, bay ngang và giữ nguyên Y, không leo tầng. Scenario cho `pos` nào thì giữ đúng Y đó |
| B5 | Điểm sinh Bóng Mực hợp lệ | Cách Mây ≥ 15 m (XZ) và không nằm trong vùng an toàn của đèn đã sáng. Chọn ngẫu nhiên theo seed; lượt sinh 2 con thì không trùng điểm. Áp dụng cho cả 3 Đêm |
| B6 | Lịch sinh Đêm 2 / Đêm 3 | Tick 300 sinh 2 con, rồi tick 300 + 420k (Đêm 2) / 300 + 360k (Đêm 3) |
| B7 | "Điểm trống" và trần 30 | Trần 30 tính trên đom đóm `random`. Điểm trống = điểm sinh không có đom đóm `random` nào đang chiếm |
| B8 | Recoil | Lùi theo hướng từ Mây sang Bóng Mực tại lúc chạm, 2/60 m mỗi tick trong 60 tick. Không gây sát thương khi `recoil` |
| B9 | Bóng Mực trong vùng vừa thắp | Bị đẩy theo bán kính tới mép 6 m, đi hết quãng đều trong 30 tick. Trong lúc đó giữ nguyên tên trạng thái, không di chuyển theo AI, không gây sát thương |
| B10 | Vật cản khi đẩy lùi | Tháp chuông (Đêm 3) và mép vùng an toàn |
| B11 | Điểm xuất phát Đêm 2 / Đêm 3 | Đêm 2: (0,0,0). Đêm 3: (0,0,−20), vì tâm đảo là tháp chuông. Quay mặt về +Z |
| B12 | Bước lên tầng | Bước lên mặt cao hơn ≤ 0.5 m (dốc) thì được; cao hơn thì là vách, bị chặn. Bước ra khỏi tầng trên thì rơi |
| B13 | Gió mạnh Đêm 3 | Cơn gió đầu ở tick 1800, sau đó mỗi 1800 tick, mỗi cơn 300 tick, hướng `dir_deg` ngẫu nhiên theo seed (góc từ +X ngược chiều kim đồng hồ: x = cos, z = sin). Cộng 2 m/s vào vận tốc ngang của Mây. `wind_enabled` mặc định bật ở Đêm 3, tắt ở Đêm 1–2 |
| B14 | Gió Lạc idle / điểm sương / bị loại | Idle bay 2 m/s như `wander`. Sinh trên các điểm sinh Bóng Mực của Đêm (cách Mây ≥ 15 m). Khi bị loại thì vẫn nằm trong mảng với `state: "removed"` và không còn tác dụng. Tối đa 2 con chưa bị loại |
| B15 | Gió Lạc chạm | XZ ≤ 1.2 m, bỏ qua độ cao. Cướp kể cả khi `amount = 0`? **Không**: chỉ cướp khi Mây mang > 0 |
| B16 | Gió Lạc bị Tỏa Sáng | Dùng khoảng cách 3D ≤ 5 như Bóng Mực. Không cộng điểm, không có trong `stunned_ids` |
| B17 | `night_start` | Phát ở tick 0, trước snapshot tick 0 |
| B18 | Điểm trong headless | `score` = điểm của Đêm đang chạy (cộng dồn cả khi thua, để dễ kiểm tra). Tổng điểm game (chỉ cộng các Đêm thắng) chỉ hiển thị ở GUI |
| B19 | `invuln` trong snapshot | boolean; `*_s` là số giây còn lại |
| B20 | Lướt khi đang bay bằng bục nhảy | Lướt 12 tick thay vận tốc ngang, giữ độ cao, rồi tiếp tục quỹ đạo phóng |
| B21 | Chờ hồi sinh sau khi rơi | Mây đứng yên tại chỗ rơi (Y < −10) trong 60 tick, sau đó về điểm xuất phát |

## 3. Tiêu chí nghiệm thu (P = mức ưu tiên; mỗi mục Phần 3 có ít nhất 1 scenario headless)

| ID | Tiêu chí | P |
|---|---|---|
| T1 | Contract 1.1: tuning khớp số chuẩn, có các khóa dash_*, night2/3_duration_s; `--night 1/2/3` | P0 |
| T2 | Snapshot có night, wind, player.vel/grounded/invuln/dash_cd_s/pulse_cd_s/charm_s, motes(kind, ttl_s), drifters, charms | P0 |
| T3 | Thứ tự tick 12 bước; thắng/thua xét cuối tick (hết lửa ưu tiên, thắng kể cả đúng tick hết giờ) | P0 |
| T4 | Đêm 1 chuẩn: 5 đèn đúng tọa độ, 20 đom đóm trên 24 điểm, Bóng Mực sinh tick 300 (2 con) rồi mỗi 480, tối đa 6, cách ≥ 15 m | P0 |
| T5 | Lướt: 14 m/s × 12 tick theo hướng di chuyển/quay mặt, hồi 90 tick từ lúc bắt đầu, trên không giữ độ cao, sự kiện `dash` | P1 |
| T6 | Tạm dừng: `paused`/`resumed`, tick tăng nhưng sim_tick/thời gian/hồi chiêu đứng yên, state `paused` | P1 |
| T7 | Bị đánh: rơi floor(n/2) ra vành 1.5–2.5 m, TTL 480, nhặt lại được; Bóng Mực recoil 2 m / 60 tick | P1 |
| T8 | Rơi khỏi đảo: −1 lửa, mất hết đom đóm (`lost`), chờ 60 tick, hồi sinh ở điểm xuất phát, bất tử 90 | P1 |
| T9 | Bóng Mực: spawning → wander → chase (≤ 12) → wander (> 18); Tỏa Sáng choáng 120 tick + đẩy 4 m/15 tick; vùng an toàn 6 m | P1 |
| T10 | Đêm 2: hai đảo + cầu; bục nhảy bắn sang đảo kia (~1.4 s); 6 đèn | P2 |
| T11 | Đêm 3: tầng, dốc, vách, tháp, bục lên tầng 2; 7 đèn; gió mạnh; Bóng Mực 4.5 m/s | P2 |
| T12 | Gió Lạc: sinh tick 1200, chase khi mang ≥ 5 và ≤ 15 m, cướp min(3, n), flee 240 tick rồi removed; Tỏa Sáng → flee / thả đồ | P2 |
| T13 | Bùa Gió: nhặt → 600 tick tốc độ 7.2 và lướt không hồi chiêu; xuất hiện lại sau 2700 tick | P2 |
| T14 | GUI: chuỗi Menu → giới thiệu Đêm → chơi → kết quả → Đêm kế → Bình Minh; thua thì chơi lại Đêm | P3 |
| T15 | GUI: menu tạm dừng (Esc/P) với 4 lựa chọn; Cài đặt âm lượng và độ nhạy chuột lưu ở localStorage | P3 |
| T16 | GUI: âm thanh (tổng hợp WebAudio) cho 10 sự kiện + nhạc nền | P3 |
| T17 | GUI: HUD đúng bố cục + bảng màu chuẩn + ánh sáng môi trường 0.15 + 0.55 × tiến độ | P3 |
| T18 | Hiệu năng: một Đêm 21.600 tick headless ≤ 30 s; GUI ≥ 30 FPS ở 1280×720 | P1 |

## 4. Trạng thái kiểm chứng

`npm test` 50/50 · `npm run verify` 20/20 PASS ([verify-report](../proof/phase-2/verify-report.md)): gồm 9 kiểm tra hồi quy Phase 1 và 11 scenario Phase 2.

| ID | Kết quả | Bằng chứng |
|---|---|---|
| T1–T13 (headless) | **Đạt** | Unit test `tests/phase2.test.js` + scenario `scenarios/phase2.cases.json` (≥ 1 scenario cho mỗi tính năng mới) |
| T18 hiệu năng headless | **Đạt** | 21.600 tick mỗi Đêm chạy 0.2–0.5 s (test T18) |
| T14–T17 GUI | **Đạt một phần** | Ảnh chụp tự động [menu](../proof/phase-2/gui-menu.png), [Đêm 1](../proof/phase-2/gui-night1.png), [Đêm 2](../proof/phase-2/gui-night2.png), [Đêm 3](../proof/phase-2/gui-night3.png): HUD đúng bố cục, bảng màu chuẩn, địa hình 3 Đêm. Chuỗi menu → giới thiệu → chơi → kết quả → Đêm kế, menu tạm dừng, cài đặt lưu localStorage, âm thanh WebAudio **đã code nhưng chưa có người chơi kiểm tra bằng tay** |
| T18 ≥ 30 FPS | **Chưa đo trên máy thật** | Có bộ đếm FPS ở góc dưới trái. Chrome headless dùng render phần mềm nên không đại diện. Cần chạy `npm run dev` trên máy thật và ghi số |

## 5. Test Phase 1 đã sửa / bỏ và lý do

| Test / scenario Phase 1 | Thay đổi | Lý do |
|---|---|---|
| R3 nhặt (1.2 m, +10 điểm khi nhặt) | Sửa: 1.0 m + chênh cao ≤ 1.5; điểm 0 khi nhặt | Số chuẩn; điểm +10 tính khi **nạp** |
| R4 / R5 / walk-collect-light / win-last-lantern | Sửa: sức chứa 10, chi phí 10, tương tác 2.0, điểm 948 | Số chuẩn |
| R6 đom đóm rơi thì mất (A6) | **Bỏ**, thay bằng T7 (rơi ra vành, TTL 480) | Ticket-02 thay luật |
| R6 Bóng Mực đuổi ở 20 m | Sửa: đặt ở 10 m | Bóng Mực chỉ đuổi khi ≤ 12 m (luật mới) |
| R8 tỏa sáng (1 đom đóm, 6 m, 3 s, +25) | Sửa: 3 đom đóm, 3D ≤ 5 m, 120 tick, đẩy 4 m/15 tick, +5 | Số chuẩn |
| R9 vùng an toàn 5 m (+0.01) | Sửa: 6 m, chặn đúng mép; thêm kiểm tra đẩy ra trong 30 tick | Số chuẩn |
| R11 Bóng Mực sinh tick 1500 | Sửa: lịch 300 / 300 + 480k, tối đa 6 | Lịch chuẩn |
| R1 / R12 dòng đầu là snapshot | Sửa: dòng đầu là `night_start` (tick 0) | Contract v1.1 thêm sự kiện mới |
| R15 contract_version "1.0" | Sửa: "1.1" | Contract v1.1 |
| Phase 1 "không rơi khỏi đảo" (A10) | **Bỏ**, thay bằng T8 | Ticket-02 bật rơi khỏi đảo |

Bằng chứng Phase 1 cũ trong `docs/proof/phase-1/` **giữ nguyên**: nó khớp với mã ở tag `phase-1`.

## 6. Đánh giá Phase 2

- **Đạt:** toàn bộ phần headless (P0–P2) và hồi quy Phase 1 với số chuẩn.
- **Chưa đạt / chưa kiểm:** chưa ai chơi thử GUI bằng tay để xác nhận chuỗi màn hình, âm thanh, cảm giác; FPS chưa đo trên máy thật.
- **AI sai ở Phase 2 (tự phát hiện bằng test/verify):** (1) Gió Lạc bị Tỏa Sáng tồn tại 119 thay vì 120 tick (lỗi thứ tự bước 7/8); (2) kỳ vọng `dash_cd_s` = 1.483 trong test là do agent tính sai (đúng là 1.5); (3) scenario Bùa Gió viết sai kịch bản (Mây đứng yên nên nhặt lại bùa ngay khi nó xuất hiện); (4) unit test T13 cho Mây đi ra khỏi cầu, vẫn qua test nhưng sai ý đồ. Bài học: kịch bản test cũng cần được review như code.
- **Harness:** CLAUDE.md và skill `verify` đã cập nhật cho phạm vi 3 Đêm và Contract v1.1.
