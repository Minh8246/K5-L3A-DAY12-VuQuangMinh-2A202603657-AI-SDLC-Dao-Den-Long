#!/usr/bin/env node
// Chế độ headless theo Test Contract v1.1 (v1.0 mục B, E + Ticket-02 Phần 4).
// node src/headless.js --seed <int> --night 1 [--scenario f.json] [--inputs f.json]
//                      --ticks <int> --out <file.jsonl> [--snapshot-every <int>]
// Mã thoát: 0 = ok; 1 = sai tham số / lỗi khác; 2 = file inputs/scenario sai định dạng.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runHeadless } from './core/run.js';
import { FormatError, validateInputs, validateScenario } from './core/formats.js';
import { MAPS } from './core/maps.js';

class UsageError extends Error {}

const USAGE =
  'usage: node src/headless.js --seed <int> --night 1 [--scenario <file.json>] [--inputs <file.json>] ' +
  '--ticks <int> --out <file.jsonl> [--snapshot-every <int>]';

function parseArgs(argv) {
  const known = new Set(['seed', 'night', 'scenario', 'inputs', 'ticks', 'out', 'snapshot-every']);
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) throw new UsageError(`tham số lạ: ${a}`);
    let key = a.slice(2);
    let val;
    const eq = key.indexOf('=');
    if (eq >= 0) {
      val = key.slice(eq + 1);
      key = key.slice(0, eq);
    } else {
      val = argv[++i];
      if (val === undefined) throw new UsageError(`thiếu giá trị cho --${key}`);
    }
    if (!known.has(key)) throw new UsageError(`tham số lạ: --${key}`);
    args[key] = val;
  }
  const int = (k, min) => {
    const s = args[k];
    if (s === undefined) throw new UsageError(`thiếu --${k}`);
    if (!/^-?\d+$/.test(s)) throw new UsageError(`--${k} phải là số nguyên`);
    const n = Number(s);
    if (n < min) throw new UsageError(`--${k} phải ≥ ${min}`);
    return n;
  };
  const seed = int('seed', -Infinity);
  const night = int('night', 1);
  if (![1, 2, 3].includes(night)) throw new UsageError('--night phải là 1, 2 hoặc 3');
  const ticks = int('ticks', 0);
  if (!args.out) throw new UsageError('thiếu --out');
  const every = args['snapshot-every'] === undefined ? 10 : int('snapshot-every', 1);
  return { seed, night, ticks, every, out: args.out, scenario: args.scenario, inputs: args.inputs };
}

function readJson(path, label) {
  let text;
  try {
    text = readFileSync(resolve(path), 'utf8');
  } catch (e) {
    throw new FormatError(`${label}: không đọc được file ${path} (${e.code ?? e.message})`);
  }
  try {
    return JSON.parse(text.replace(/^﻿/, ''));
  } catch (e) {
    throw new FormatError(`${label}: JSON không hợp lệ (${e.message})`);
  }
}

function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const scenario = opts.scenario ? validateScenario(readJson(opts.scenario, 'scenario'), MAPS[opts.night].lanterns.length) : null;
    const frames = opts.inputs ? validateInputs(readJson(opts.inputs, 'inputs')) : [];
    const text = runHeadless({ ...opts, scenario, frames });
    const outPath = resolve(opts.out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, text);
    process.exitCode = 0;
  } catch (e) {
    if (e instanceof FormatError) {
      process.stderr.write(`error: ${e.message}\n`);
      process.exitCode = 2;
    } else if (e instanceof UsageError) {
      process.stderr.write(`error: ${e.message}\n${USAGE}\n`);
      process.exitCode = 1;
    } else {
      process.stderr.write(`error: ${e.stack ?? e}\n`);
      process.exitCode = 1;
    }
  }
}

main();
