# Nhật ký dùng AI

Công cụ: **Claude Code** (model Claude Opus 5.5) trong VS Code. Harness: [CLAUDE.md](../../CLAUDE.md), skill [verify](../../.claude/skills/verify/SKILL.md), Stop hook [stop-gate.js](../../scripts/hooks/stop-gate.js) (cấu hình trong [.claude/settings.json](../../.claude/settings.json)).

## Phase 1

**Cách làm:** dán nguyên văn PRD-0 cho agent → agent viết spec, giả định và tiêu chí nghiệm thu **trước** ([phase-1.md](phase-1.md)) → tôi duyệt → agent code core + headless → test → GUI → harness → verify.

**Lời nhắc chính:**
1. "xem bài này yêu cầu làm gì, hướng dẫn tôi" → agent đọc 6 file đề, tóm tắt, đề xuất kiến trúc tách core/render.
2. Dán toàn bộ PRD-0 + Test Contract → agent lập spec (giả định A1–A19, tuning, R1–R15) rồi mới code.

**Các lần AI sai và cách phát hiện:**

| # | Lỗi | Phát hiện bằng | Sửa / chỉnh harness |
|---|---|---|---|
| 1 | Dùng `node --test tests/`, lệnh này không chạy trên Node 24 (coi thư mục là module) | Chạy `npm test` thấy lỗi `Cannot find module` | Đổi thành `node --test` (tự tìm `*.test.js`, chạy được từ Node 18 trở lên) |
| 2 | Gọi `python -` để sửa file trên Windows, bị treo vì alias Microsoft Store | Lệnh quá thời gian 2 phút | Dừng tác vụ, sửa bằng công cụ ghi file. Ghi chú: máy dev là Windows, không giả định có python |
| 3 | Cách kiểm tra "file đang chạy trực tiếp" (`isMain`) so sánh đường dẫn, dễ sai giữa Windows và POSIX | Agent tự review trước khi chạy | Tách `runHeadless` sang `src/core/run.js`, CLI luôn gọi `main()` |
| 4 | GUI tạo lại geometry của cột tiến độ đèn ở mỗi khung hình (rò bộ nhớ, tốn hiệu năng) | Agent tự review diff | Dùng `scale.y` thay vì tạo geometry mới |

**Kiểm chứng không dựa vào lời agent:** 32 test + 7 scenario chạy qua CLI thật. Giá trị mong đợi (tick nhặt đom đóm 18/28/…, tick bị chạm 60/150/240, điểm 848) được **tính tay từ tuning trước khi chạy**, không chép từ output. Stop hook đã được thử với một test đỏ cố ý và chặn đúng (exit 2, xem `docs/proof/phase-1/hook-blocks-red.txt`).

**Token / chi phí (ước tính):** _điền số thật từ lệnh `/cost` (hoặc trang usage) khi kết thúc phase._

**Cách tiết kiệm token:**
- Đọc đề một lần, rồi viết spec gọn để agent bám theo, tránh hỏi đi hỏi lại.
- JavaScript thuần thay TypeScript, không cần bước build hay sửa lỗi kiểu.
- Test bằng `node:test` có sẵn, không cài thêm thư viện.
- Một lệnh `npm run verify` vừa kiểm chứng vừa lưu bằng chứng, thay vì agent chạy và đọc output từng bước.
- Không dùng subagent.
