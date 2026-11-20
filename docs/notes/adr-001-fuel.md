# ADR-001 — Mô hình trạng thái đèn có nhiên liệu và luật thắng "giữ đảo sáng tới bình minh"

- **Trạng thái:** Đã chấp nhận (Phase 3, Ticket-03, Contract v1.2)
- **Thay thế:** luật "đèn sáng là vĩnh viễn", "Bóng Mực không bao giờ vào vùng an toàn", "thắng ngay khi thắp hết đèn" (Ticket-02 / PRD-0)

## Bối cảnh
Ở Phase 1–2, đèn chỉ có hai trạng thái và chỉ đi một chiều: **tắt → sáng**. Thắp đủ đèn là thắng ngay. Playtest cho thấy người chơi giỏi xong game trong 2 phút. Ticket-03 cho đèn có thể tắt lại và đổi mục tiêu thành "giữ đảo sáng tới bình minh".

## Quyết định

**1. Đèn là một máy trạng thái có nhiên liệu.**

```
          nạp đủ cost (10, hoặc 5 nếu ever_lit)            châm dầu (+10/con, tối đa 100)
 TẮT ──────────────────────────────────────────────▶ SÁNG ◀──────────┐
  ▲      (fuel = 100, ever_lit = true,                   │  fuel ≥ 30: có vùng an toàn 6 m
  │       lần đầu +100, thắp lại +40)                     │  fuel < 30: YẾU, mất vùng an toàn, Bóng có thể drain
  └──────────── fuel ≤ 0 (ngay sau bước 2): lantern_out, deposited = 0 ◀┘
```

- Dầu lưu bằng **số nguyên đơn vị 1/60** (`fuelU`, tối đa 6000). Hao 1 đơn vị mỗi tick, mỗi Bóng Mực đang drain hút thêm 5 đơn vị mỗi tick. Không có sai số số thực; chỉ làm tròn 1 chữ số thập phân khi xuất snapshot.
- `isProtected(L) = lit && fuelU ≥ 30×60` là **nguồn duy nhất** cho vùng an toàn. Nó được dùng cho chặn Bóng Mực, vật cản khi đẩy lùi, và điểm sinh hợp lệ. Nhờ vậy luật cũ "đèn sáng = an toàn" chỉ phải đổi ở một chỗ.
- Khi chọn đèn để tương tác, chỉ xét đèn còn nhận được: chưa sáng, hoặc sáng nhưng chưa đầy dầu.

**2. Bóng Mực thêm trạng thái `drain`.**
- `wander` đi tới đèn yếu gần nhất. Không có đèn yếu thì đi tới đèn tắt gần nhất. Không còn đèn tắt thì lượn ngẫu nhiên như Phase 2.
- `wander` chuyển `drain` khi cách đèn ≤ 2 m. `drain` chuyển `chase` khi Mây vào trong 6 m. `drain` chuyển `wander` khi đèn tắt, khi fuel lên ≥ 30, hoặc khi cách đèn > 2 m.
- Trúng Tỏa Sáng thì chuyển `stunned`; hết choáng thì về `wander`.

**3. Luật thắng chỉ xét ở bước 11, tại bình minh.**
- Thứ tự: hết lửa → `no_flames` (luôn ưu tiên). Còn sống và hết giờ: số đèn sáng ≥ ceil(0.6 × tổng) → `won dawn_survived`, ngược lại `lost dawn`.
- Bỏ hẳn nhánh thắng `all_lit`.

## Hệ quả
- **Tích cực:** luật mới gom ở vài điểm (`isProtected`, bước 2b, bước 5, `wanderShade`, bước 11). Test Phase 2 không bị thay thế vẫn đạt, không phải sửa.
- **Breaking:** xem [CHANGELOG.md](../../CHANGELOG.md). Test và scenario cũ dựa trên `all_lit` hoặc điểm cũ đã được sửa hay xóa có ghi lý do ([phase-3.md](phase-3.md) mục 3).
- **Rủi ro:** các chỗ ticket không nói rõ đã ghi thành giả định C1–C6 trong [phase-3.md](phase-3.md). Nếu test ẩn hiểu khác thì các điểm này có thể lệch.
