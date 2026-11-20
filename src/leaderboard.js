// Bảng xếp hạng cục bộ (Ticket-04 §3) — logic thuần (không thuộc sim nên được dùng Date), dùng chung cho Electron, web và test.

// Tên 3–12 ký tự: [A-Za-z0-9_] theo yêu cầu, mở rộng cho chữ tiếng Việt có dấu (\p{L}) — điểm cộng.
export const NAME_RE = /^[\p{L}\p{N}_]{3,12}$/u;
export const isValidName = (name) => typeof name === 'string' && NAME_RE.test(name.normalize('NFC'));

// score giảm dần; bằng điểm thì ai đạt trước (achieved_at sớm hơn) đứng trên; giữ top 10.
export function sortLeaderboard(entries) {
  return [...entries]
    .sort((a, b) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at))
    .slice(0, 10);
}

export function addEntry(entries, entry) {
  if (!isValidName(entry.name)) throw new Error('tên không hợp lệ');
  return sortLeaderboard([...entries, { ...entry, name: entry.name.normalize('NFC') }]);
}

// ISO 8601 có múi giờ, ví dụ 2026-11-20T16:40:05+07:00
export function isoWithOffset(d) {
  const off = -d.getTimezoneOffset();
  const p2 = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}${off >= 0 ? '+' : '-'}${p2(off / 60)}:${p2(off % 60)}`;
}
