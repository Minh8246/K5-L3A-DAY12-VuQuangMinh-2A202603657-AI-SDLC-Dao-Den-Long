# Retro — Đảo Đèn Lồng (Day 12 AI SDLC, 4 phase)

## 1. Tổng hợp đánh giá 4 phase

| Phase | Yêu cầu | Kết quả (lúc gắn tag) | Đổi hướng lớn |
|---|---|---|---|
| 1 · PRD-0, v1.0 | Đêm 1 + headless | 32 test, 9/9 kiểm chứng; GUI mới kiểm màn mở đầu | Tách `src/core` (thuần, tất định) và `src/render` ngay từ đầu |
| 2 · Ticket-02, v1.1 | Số chuẩn, 3 Đêm, 6 tính năng mới | 50 test, 20/20 (gồm hồi quy Phase 1) | Viết lại sim theo thứ tự 12 bước bắt buộc; 4 giả định Phase 1 bị bỏ hoặc sửa |
| 3 · Ticket-03, v1.2 | Đèn cạn dầu, luật thắng mới | 62 test, 26/26; ADR-001 + CHANGELOG | Đèn thành máy trạng thái có dầu; xóa 2 test `all_lit` có ghi lý do |
| 4 · Ticket-04, v1.3 | Bench, soak, bảng xếp hạng, tiếp cận, phát hành | 70 test, 26/26; bench 328/38.6/1.35 s; soak ×1.168 | Thêm Electron; vẽ instanced |

Những gì **chưa** được kiểm chứng đầy đủ suốt dự án: trải nghiệm GUI do người chơi thật kiểm tra (chuỗi màn hình, âm thanh, đổi phím), FPS khi chơi thường trên máy khác, và hình ảnh "giấy rách" của đèn tắt.

## 2. Điều hiệu quả khi làm với AI

- **Spec và giả định trước, code sau.** Mỗi phase có bảng giả định (A1–A19, B1–B21, C1–C6, D1–D8). Khi ticket sau thay luật, chỉ cần dò bảng để biết test và code nào bị ảnh hưởng.
- **Tính kỳ vọng bằng tay trước khi chạy.** Cách này bắt được cả lỗi code (Gió Lạc biến mất sớm 1 tick) lẫn lỗi kịch bản test.
- **Một lệnh kiểm chứng (`npm run verify`)** chạy hồi quy mọi phase, kiểm tra tất định bằng sha256 và lưu bằng chứng. Agent không phải đọc từng output, nên tiết kiệm token.
- **Để test tự chỉ ra những gì luật mới làm hỏng** (Phase 3: đúng 8 test) thay vì đoán, rồi sửa hoặc xóa từng test có lý do.

## 3. Điều không hiệu quả

- **Push/tag trễ ở Phase 1.** Agent hỏi push nhưng không nhắc lại khi chưa có trả lời, nên tag `phase-1` chỉ được gắn khi Phase 2 đã mở.
- **GUI ít được người thật kiểm tra.** Ảnh chụp Chrome headless chứng minh được là màn hình vẽ ra, nhưng không chứng minh được cảm giác chơi.
- **Vá file bằng shell trên Windows** (heredoc, `python`) bị lỗi nhiều lần. Chuyển sang script Node có kiểm tra "không tìm thấy chuỗi thì dừng" thì ổn định hơn hẳn.

## 4. Những lần AI sai và cách phát hiện (tóm tắt 16 lỗi trong [ai-log](ai-log.md))

| Loại | Ví dụ | Phát hiện bằng |
|---|---|---|
| Lỗi logic | Gió Lạc biến mất sau 119 thay vì 120 tick; thứ tự sự kiện pulse/drop | Unit test và scenario đỏ |
| Test hoặc kịch bản sai | `dash_cd_s` 1.483; bùa được nhặt lại; Mây đi ra khỏi cầu; Bóng Mực đi ngang vùng phát hiện | verify FAIL → đọc output thật |
| Môi trường | `node --test tests/` trên Node 24; `ELECTRON_RUN_AS_NODE`; Electron không giải nén | Chạy thật |
| Hiệu năng / hình ảnh | ~1000 lệnh vẽ (p1 23.5); màu instance sai | bench.json; xem ảnh chụp |
| Vi phạm quy tắc harness | `Date` trong `src/core` | Đối chiếu CLAUDE.md |

**Bài học:** kịch bản test cũng là code và cần được review. Quy tắc này đã được thêm vào CLAUDE.md ở Phase 2.

## 5. Harness nào giúp nhiều nhất

1. **Skill `verify` + `scripts/verify.js`:** hồi quy mọi phase và lưu bằng chứng bằng một lệnh. CI chạy lại và kiểm tra output khớp file đã commit.
2. **CLAUDE.md** ngắn, có quy tắc kiến trúc ("core cấm Math.random/Date", "số chuẩn chỉ ở tuning.js", "thứ tự 12 bước"). File được cập nhật mỗi phase, git ghi lại lịch sử.
3. **Stop hook** chặn agent kết thúc khi test đỏ. Đã thử với một test đỏ cố ý.
4. **Spec từng phase** trong `docs/notes/` giúp agent bám yêu cầu và không bịa luật.

## 6. Token và chi phí

- **Công cụ:** Claude Code (Claude Opus 5.5), một phiên dài cho cả 4 phase, không dùng subagent.
- **Số liệu:** _tác giả điền tổng token/chi phí thật từ `/cost` hoặc trang usage_. Mình không tự ước lượng con số vì không có số đo đáng tin.
- **Cách tiết kiệm:**
  - Dùng JS thuần, không cần bước build.
  - Dùng `node:test` sẵn có.
  - Vá có mục tiêu thay vì viết lại (Phase 3).
  - Dùng một lệnh verify thay cho nhiều lần đọc output.
  - Lưu nguyên văn đề vào repo, không phải hỏi lại.
- **Chỗ tốn nhiều nhất:** viết lại core ở Phase 2 và GUI.

## 7. Nếu làm lại

- Gắn tag và push ngay khi kiểm chứng xong, không đợi người dùng nhắc.
- Dùng Electron và vẽ instanced ngay từ Phase 2, để FPS và bảng xếp hạng không phải làm lại.
- Dành 5 phút mỗi phase để chơi thử bằng tay và quay đoạn clip ngắn làm bằng chứng GUI.
- Viết test cho kịch bản: assert điều kiện tiền đề, ví dụ "Mây vẫn trên cầu", trước khi assert kết quả.
