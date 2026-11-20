# Credits

- Nhân vật, bối cảnh, tên gọi (Mây, Ông Đăng, Bóng Mực, Gió Lạc, Đảo Bến / Đảo Cau / Đảo Chuông): bản gốc của lab Day 12 AI SDLC. Lời thoại của Ông Đăng do tác giả viết cùng AI.
- [three.js](https://threejs.org/) r160 (MIT): thư viện vẽ 3D.
- [Vite](https://vitejs.dev/) 5 (MIT): dev server và đóng gói web.
- [Electron](https://www.electronjs.org/) 33 (MIT, kèm Chromium theo giấy phép BSD và các giấy phép của bên thứ ba trong gói Electron): bản desktop, benchmark, lưu bảng xếp hạng.
- **Không dùng asset ngoài.** Mọi mô hình được dựng bằng hình khối cơ bản của three.js trong mã. Mọi âm thanh và nhạc nền được **tổng hợp bằng WebAudio** trong `src/render/audio.js`, không có file âm thanh.
- **Công cụ AI tạo nội dung:** Claude Code (Claude Opus 5.5, Anthropic) viết mã, test, tài liệu và lời thoại dưới sự điều phối và kiểm chứng của tác giả. Chi tiết trong [docs/notes/ai-log.md](docs/notes/ai-log.md).
