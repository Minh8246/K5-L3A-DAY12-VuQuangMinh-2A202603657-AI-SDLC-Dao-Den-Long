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

## Phase 2

**Cách làm:** dán Ticket-02. Agent tóm tắt và so sánh với giả định Phase 1, đề xuất ưu tiên P0 → P3 theo điểm (headless trước, GUI sau), tôi chọn. Sau đó: lưu nguyên văn ticket → viết spec (B1–B21, T1–T18, danh sách test cũ phải sửa) → viết lại core theo thứ tự 12 bước → test → scenario → GUI.

**Lời nhắc chính:** "phase sau có gì đây" kèm toàn bộ Ticket-02. Trả lời câu hỏi: push/tag phase-1 ngay, và chọn ưu tiên headless P0 → P3.

**Các lần AI sai và cách phát hiện:**

| # | Lỗi | Phát hiện bằng | Sửa |
|---|---|---|---|
| 5 | Không nhắc tag `phase-1` trước khi Phase 2 mở (người dùng chưa trả lời câu hỏi push) | Agent kiểm `git ls-remote` khi nhận ticket mới | Push và tag ngay khi được đồng ý. Bài học: hỏi push/tag sớm, không đợi |
| 6 | Gió Lạc bị Tỏa Sáng chỉ tồn tại 119 tick thay vì 120 (trừ bộ đếm ngay trong tick chuyển trạng thái) | Unit test T12 đỏ | Cờ `fleeFresh` bỏ qua lần trừ đầu |
| 7 | Test tính sai `dash_cd_s` (1.483 thay vì 1.5) | Test đỏ → đối chiếu với ticket: hồi chiêu tính **từ lúc bắt đầu** | Sửa test, ghi lý do |
| 8 | Scenario Bùa Gió: Mây đứng yên nên nhặt lại bùa ngay khi nó xuất hiện. Unit test T13 cho Mây đi ra khỏi cầu và rơi | verify FAIL → đọc output thật | Sửa kịch bản (đi dọc cầu). Thêm vào CLAUDE.md: "kịch bản test cũng phải được review" |
| 9 | `drifter_drop` phát trước `pulse` trong cùng tick | verify FAIL (thứ tự sự kiện) | Phát `pulse` trước (nguyên nhân trước hệ quả) |

**Harness thay đổi:** CLAUDE.md (số chuẩn chỉ ở `tuning.js`/`maps.js`, thứ tự 12 bước, review kịch bản test); skill `verify` (hồi quy mọi phase, `night`/`at`/`near`, không dùng FPS headless làm bằng chứng); CI kiểm tra `docs/proof/phase-2/runs`.

**Token / chi phí (ước tính):** _điền số thật từ `/cost` khi kết thúc phase._ Cách tiết kiệm: một lần viết lại core thay vì vá dần; giá trị mong đợi tính bằng tay một lần; dùng `npm run verify` thay vì đọc từng output.

## Phase 3

**Cách làm (30 phút):** dán Ticket-03. Agent lưu nguyên văn → thêm tuning v1.2 → vá core bằng một script thay thế có kiểm tra (báo lỗi nếu không tìm thấy chuỗi) → chạy test để thấy đúng 8 test cũ bị luật mới làm sai → sửa hoặc xóa từng test có ghi lý do → thêm 14 test P3 → tính lại scenario → ADR, CHANGELOG → GUI.

**AI sai:** (10) script vá file viết bằng heredoc bị bash hiểu sai dấu nháy → chuyển sang ghi file bằng công cụ; (11) kịch bản test drain cho Bóng đi ngang qua vùng phát hiện của Mây (code đúng, kịch bản sai); (12) một lệnh Edit không áp dụng được vì chuỗi xuất hiện 2 lần (chế độ mù màu không được áp dụng khi mở game) → phát hiện nhờ kết quả công cụ, đã sửa.

**Token / chi phí (ước tính):** _điền từ `/cost`._ Tiết kiệm: chỉ vá những chỗ cần đổi thay vì viết lại core; để test cho biết chính xác những gì luật mới làm hỏng.

## Phase 4

**Cách làm:** lưu nguyên văn Ticket-04 → chọn Electron (một lựa chọn đáp ứng cả bench, RSS, lưu đĩa và lệnh xuất) → cờ bench trong core + `bench.js` → soak → đo thật → tối ưu theo số đo → bảng xếp hạng + tiếp cận → tài liệu, retro, release.

**AI sai:** (13) Electron không giải nén được trên Windows → giải nén thủ công từ cache; (14) `ELECTRON_RUN_AS_NODE=1` trong shell của agent → bỏ biến khi chạy, ghi vào README; (15) màu instance sai do thuộc tính tạo sau khi shader biên dịch → phát hiện khi xem ảnh bench; (16) `Date` trong `src/core` vi phạm CLAUDE.md → chuyển `leaderboard.js` ra `src/`. Soak lần đầu ×1.21 (không đạt) → chẩn đoán heap trước khi đổi cấu hình, ghi trung thực trong phase-4.md.

**Kiểm chứng dựa trên số đo:** bench 70.9/23.5 → (instancing) 299/39.1 → 306.6/31.3 → (bỏ cấp phát mỗi tick trong bench) 328.4/38.6. Mỗi lần đổi code đều đo lại để bench.json khớp code.

(17) Soak đạt trên Windows (×1.17) nhưng **CI Ubuntu đỏ (×1.78)**. Agent đã tạo Release trước khi CI chạy xong → phát hiện bằng `gh run view --log-failed` → thử từng cờ V8 để tách nguyên nhân → `--jitless --single-threaded`. Bài học: chờ CI xanh rồi mới tạo Release.

**Token / chi phí:** _điền từ `/cost`._
