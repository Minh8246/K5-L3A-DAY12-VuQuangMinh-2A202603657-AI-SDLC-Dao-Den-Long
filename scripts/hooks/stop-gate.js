#!/usr/bin/env node
// Claude Code Stop hook: chặn agent kết thúc lượt khi test đang đỏ.
// Exit 2 + stderr → Claude Code giữ agent lại và đưa lỗi cho nó sửa.
import { spawnSync } from 'node:child_process';

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let payload = {};
  try {
    payload = JSON.parse(input || '{}');
  } catch {}
  // Tránh vòng lặp vô hạn: nếu đã bị chặn một lần trong lượt này thì cho qua.
  if (payload.stop_hook_active) process.exit(0);
  const r = spawnSync(process.execPath, ['--test'], { encoding: 'utf8', cwd: payload.cwd || process.cwd() });
  if (r.status === 0) process.exit(0);
  const out = (r.stdout + r.stderr).split('\n');
  const failing = out.filter((l) => /^✖|not ok/.test(l.trim())).slice(0, 15).join('\n');
  process.stderr.write(`Test đang ĐỎ — chưa được kết thúc. Sửa lỗi rồi chạy lại \`npm test\`.\n${failing}\n`);
  process.exit(2);
});
