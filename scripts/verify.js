#!/usr/bin/env node
// Kiểm chứng một lệnh: chạy unit test + mọi scenario qua CLI headless thật, kiểm tra tất định,
// lưu output và báo cáo vào docs/proof/phase-<N>/. Thoát mã 1 nếu có mục FAIL.
// Dùng: npm run verify [-- --phase 1]
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const root = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const phase = (process.argv.join(' ').match(/--phase[ =](\d+)/) ?? [])[1] ?? '1';
const proof = join(root, 'docs', 'proof', `phase-${phase}`);
const runs = join(proof, 'runs');
const tmp = join(root, 'out', 'verify');
rmSync(runs, { recursive: true, force: true });
mkdirSync(runs, { recursive: true });
mkdirSync(tmp, { recursive: true });

const contract = JSON.parse(readFileSync(join(root, 'game.contract.json'), 'utf8'));
const [cmd, ...pre] = contract.headless_cmd.split(' ');
const sha = (s) => createHash('sha256').update(s).digest('hex');

function headless(c, outFile) {
  const args = [...pre, '--seed', String(c.seed), '--night', '1', '--ticks', String(c.ticks), '--out', outFile];
  if (c.scenario) {
    const f = join(tmp, `${c.id}.scenario.json`);
    writeFileSync(f, JSON.stringify(c.scenario));
    args.push('--scenario', f);
  }
  if (c.inputs) {
    const f = join(tmp, `${c.id}.inputs.json`);
    writeFileSync(f, JSON.stringify(c.inputs));
    args.push('--inputs', f);
  }
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`exit ${r.status}: ${r.stderr}`);
  return readFileSync(outFile, 'utf8');
}

function check(c, text) {
  const lines = text.trim().split('\n').map((l) => JSON.parse(l));
  const events = lines.filter((l) => l.type === 'event');
  const end = lines.at(-1);
  const problems = [];
  if (end.type !== 'end') problems.push('dòng cuối không phải end');
  let from = 0;
  for (const [tick, name, data] of c.expect.events ?? []) {
    const i = events.findIndex(
      (e, j) => j >= from && e.name === name && (tick == null || e.tick === tick) && (data == null || isDeepStrictEqual(e.data, data)),
    );
    if (i < 0) problems.push(`thiếu sự kiện ${JSON.stringify([tick, name, data])}`);
    else from = i + 1;
  }
  for (const name of c.expect.absent ?? []) {
    const e = events.find((x) => x.name === name);
    if (e) problems.push(`không được có ${name} (gặp ở tick ${e.tick})`);
  }
  for (const [k, v] of Object.entries(c.expect.end ?? {})) {
    if (!isDeepStrictEqual(end[k], v)) problems.push(`end.${k} = ${JSON.stringify(end[k])}, mong đợi ${JSON.stringify(v)}`);
  }
  return { problems, end, nEvents: events.length };
}

const rows = [];
let failed = 0;

// 1. Unit + CLI test
const t = spawnSync(process.execPath, ['--test'], { cwd: root, encoding: 'utf8' });
const testOut = (t.stdout + t.stderr).replace(/\r/g, '');
writeFileSync(join(proof, 'test-report.txt'), testOut);
const pass = (testOut.match(/ℹ pass (\d+)/) ?? [])[1];
const fail = (testOut.match(/ℹ fail (\d+)/) ?? [])[1];
const testOk = t.status === 0;
if (!testOk) failed++;
rows.push(['unit+cli', 'R1–R15', `node --test: ${pass} pass, ${fail} fail`, 'test-report.txt', testOk]);

// 2. Scenario qua CLI thật, mỗi case chạy 2 lần để kiểm tra tất định
const { cases } = JSON.parse(readFileSync(join(root, 'scenarios', `phase${phase}.cases.json`), 'utf8'));
for (const c of cases) {
  let ok = true;
  let note;
  try {
    const a = headless(c, join(runs, `${c.id}.jsonl`));
    const b = headless(c, join(tmp, `${c.id}.again.jsonl`));
    const { problems, end } = check(c, a);
    if (a !== b) problems.push('KHÔNG tất định: 2 lần chạy khác nhau');
    ok = problems.length === 0;
    note = ok ? `end=${JSON.stringify({ ticks: end.ticks, state: end.state, score: end.score })}; 2 lần chạy cùng sha256 ${sha(a).slice(0, 12)}` : problems.join('; ');
  } catch (e) {
    ok = false;
    note = e.message;
  }
  if (!ok) failed++;
  rows.push([c.id, c.req, `${c.desc}. ${note}`, `runs/${c.id}.jsonl`, ok]);
}

// 3. Khác seed → thế giới khác (id tự sinh vẫn tất định)
const base = cases.find((c) => c.id === 'default-world-seed7');
const s7 = readFileSync(join(runs, 'default-world-seed7.jsonl'), 'utf8');
const s8 = headless({ ...base, id: 'seed8', seed: 8 }, join(tmp, 'seed8.jsonl'));
const diffOk = s7 !== s8;
if (!diffOk) failed++;
rows.push(['seed-differs', 'R11', 'Seed 7 và seed 8 cho thế giới khác nhau', '—', diffOk]);

const md = [
  `# Báo cáo kiểm chứng Phase ${phase}`,
  '',
  'Sinh tự động bởi `npm run verify` (scripts/verify.js). Không sửa tay. Chạy lại ở tag tương ứng phải ra cùng file `runs/*.jsonl` (CI kiểm tra bằng `git diff --exit-code`).',
  '',
  '| Kiểm tra | Yêu cầu | Mô tả / kết quả | Bằng chứng | KQ |',
  '|---|---|---|---|---|',
  ...rows.map(([id, req, desc, ev, ok]) => `| ${id} | ${req} | ${desc.replace(/\|/g, '\\|')} | ${ev} | ${ok ? 'PASS' : '**FAIL**'} |`),
  '',
  `Tổng: ${rows.length - failed}/${rows.length} PASS.`,
  '',
].join('\n');
writeFileSync(join(proof, 'verify-report.md'), md);
console.log(md);
process.exitCode = failed ? 1 : 0;
