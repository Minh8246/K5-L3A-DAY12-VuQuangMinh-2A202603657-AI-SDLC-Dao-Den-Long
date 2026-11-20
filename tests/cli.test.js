// Test CLI headless thật (tiến trình con): mã thoát, stderr, file output (R12, R15).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TUNING } from '../src/core/tuning.js';

const dir = mkdtempSync(join(tmpdir(), 'ddl-'));
const contract = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));

function cli(args) {
  const [cmd, ...pre] = contract.headless_cmd.split(' ');
  return spawnSync(cmd, [...pre, ...args], { encoding: 'utf8', cwd: new URL('..', import.meta.url) });
}
function file(name, content) {
  const p = join(dir, name);
  writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content));
  return p;
}
const base = (out) => ['--seed', '1', '--night', '1', '--ticks', '30', '--out', out];

test('R15: game.contract.json khớp tuning thật của code', () => {
  assert.equal(contract.contract_version, '1.0');
  assert.deepEqual(contract.tuning, JSON.parse(JSON.stringify(TUNING)));
});

test('R12: chạy hợp lệ → mã 0, ghi JSONL, dòng cuối end', () => {
  const out = join(dir, 'ok.jsonl');
  const r = cli([...base(out), '--inputs', file('in.json', { frames: [{ tick: 0, move: [0, 1] }] })]);
  assert.equal(r.status, 0, r.stderr);
  const lines = readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines[0].type, 'snapshot');
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 30, state: 'playing', score: lines.at(-1).score });
});

test('R12: --snapshot-every và dạng --key=value', () => {
  const out = join(dir, 'every.jsonl');
  const r = cli(['--seed=3', '--night=1', '--ticks=20', `--out=${out}`, '--snapshot-every', '5']);
  assert.equal(r.status, 0, r.stderr);
  const ticks = readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((l) => l.type === 'snapshot').map((l) => l.tick);
  assert.deepEqual(ticks, [0, 5, 10, 15, 20]);
});

const bad = {
  'JSON hỏng': '{ "frames": [ ',
  'thiếu frames': { foo: 1 },
  'tick không tăng': { frames: [{ tick: 5 }, { tick: 5 }] },
  'move ngoài [-1,1]': { frames: [{ tick: 0, move: [2, 0] }] },
  'nút không phải boolean': { frames: [{ tick: 0, pulse: 1 }] },
};
for (const [name, content] of Object.entries(bad)) {
  test(`R12: inputs sai định dạng (${name}) → mã 2 + stderr`, () => {
    const r = cli([...base(join(dir, 'x.jsonl')), '--inputs', file('bad.json', content)]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /error/);
  });
}

test('R12: scenario sai định dạng → mã 2', () => {
  for (const content of ['nope', { motes: 'x' }, { lanterns: [{ id: 'L9' }] }, { player: { pos: [0, 0] } }]) {
    const r = cli([...base(join(dir, 'x.jsonl')), '--scenario', file('bad-sc.json', content)]);
    assert.equal(r.status, 2, JSON.stringify(content));
  }
});

test('R12: thiếu tham số bắt buộc → mã khác 0 + stderr', () => {
  const r = cli(['--seed', '1', '--night', '1', '--ticks', '10']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /--out/);
});
