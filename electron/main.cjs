// Bản desktop (Electron) — Ticket-04: cửa sổ 1280×720, bench (tắt vsync, đo RSS), bảng xếp hạng lưu trên đĩa,
// xuất bảng xếp hạng bằng dòng lệnh. Giao diện là bản build web trong dist/ (npm run build).
const { app, BrowserWindow, ipcMain } = require('electron');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const argv = process.argv;
function getArg(name, def) {
  const i = argv.indexOf(`--${name}`);
  if (i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : def;
}
const BENCH = argv.includes('--bench');
const EXPORT = getArg('export-leaderboard', null);

if (BENCH) {
  // Tắt vsync và giới hạn khung hình của Chromium để đo đúng khả năng render
  app.commandLine.appendSwitch('disable-frame-rate-limit');
  app.commandLine.appendSwitch('disable-gpu-vsync');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
}
if (process.platform === 'linux') app.commandLine.appendSwitch('no-sandbox'); // tránh lỗi SUID sandbox khi cài qua npm
// DDL_USER_DATA: đổi thư mục dữ liệu (dùng để kiểm thử bảng xếp hạng mà không đụng dữ liệu thật)
if (process.env.DDL_USER_DATA) app.setPath('userData', path.resolve(process.env.DDL_USER_DATA));
let LB = null; // src/leaderboard.js (ESM) — nạp trong whenReady

// ---------- Bảng xếp hạng (file JSON trong thư mục dữ liệu người dùng) ----------
const lbFile = () => path.join(app.getPath('userData'), 'leaderboard.json');
const readLb = () => {
  try {
    return JSON.parse(fs.readFileSync(lbFile(), 'utf8')).entries || [];
  } catch {
    return [];
  }
};
const sortLb = (e) => LB.sortLeaderboard(e); // score giảm dần; bằng điểm thì ai đạt trước đứng trên; top 10
const writeLb = (entries) => {
  fs.mkdirSync(path.dirname(lbFile()), { recursive: true });
  fs.writeFileSync(lbFile(), JSON.stringify({ entries }, null, 2) + '\n');
};
ipcMain.handle('lb:get', () => sortLb(readLb()));
ipcMain.handle('lb:add', (_e, entry) => {
  const all = LB.addEntry(readLb(), entry);
  writeLb(all);
  return all;
});

// ---------- Server tĩnh cục bộ cho dist/ (module script không chạy từ file://) ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
function serveDist() {
  const root = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(path.join(root, 'index.html'))) {
    console.error('Chưa có dist/. Hãy chạy: npm run build');
    app.exit(1);
  }
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
      const file = path.join(root, rel);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv.address().port));
  });
}

app.whenReady().then(async () => {
  LB = await import(require('node:url').pathToFileURL(path.join(__dirname, '..', 'src', 'leaderboard.js')).href);
  if (EXPORT) {
    const out = path.resolve(process.cwd(), EXPORT);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify({ entries: sortLb(readLb()) }, null, 2) + '\n');
    console.log(`Đã xuất ${sortLb(readLb()).length} mục → ${out}`);
    app.exit(0);
    return;
  }
  const port = await serveDist();
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    useContentSize: true,
    resizable: !BENCH,
    fullscreen: false,
    backgroundColor: '#0e1430',
    title: 'Đảo Đèn Lồng',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), backgroundThrottling: false },
  });
  win.setMenuBarVisibility(false);
  const q = BENCH ? `?bench=1&seed=${Number(getArg('seed', '42'))}&duration=${Number(getArg('duration', '30'))}` : '';
  win.loadURL(`http://127.0.0.1:${port}/index.html${q}`);

  if (BENCH) {
    const out = path.resolve(process.cwd(), getArg('out', 'bench.json'));
    let peak = 0;
    let loadMs = null;
    let timer = null;
    // RSS: tổng working set của mọi tiến trình Electron (main + GPU + renderer + utility)
    const sample = () => {
      const kb = app.getAppMetrics().reduce((s, m) => s + ((m.memory && m.memory.workingSetSize) || 0), 0);
      peak = Math.max(peak, kb / 1024);
    };
    ipcMain.on('bench:first-frame', () => {
      loadMs = Math.round(process.uptime() * 1000); // từ lúc tiến trình bắt đầu tới khung hình đầu tiên của cảnh bench
    });
    ipcMain.on('bench:measure-start', () => {
      sample();
      timer = setInterval(sample, 250);
    });
    ipcMain.on('bench:done', (_e, r) => {
      clearInterval(timer);
      sample();
      const res = {
        contract_version: '1.3',
        avg_fps: r.avg_fps,
        p1_low_fps: r.p1_low_fps,
        frame_ms_p95: r.frame_ms_p95,
        frames: r.frames,
        load_ms: loadMs,
        peak_mem_mb: Math.round(peak),
        vsync_off: true,
        renderer: `three.js r${r.three} (WebGL2) · Electron ${process.versions.electron} / Chromium ${process.versions.chrome} · GPU: ${r.gpu}`,
        os: `${os.type()} ${os.release()} ${os.arch()} · ${(os.cpus()[0] || {}).model} · ${Math.round(os.totalmem() / 1073741824)} GB RAM`,
        seed: Number(getArg('seed', '42')),
        duration_s: Number(getArg('duration', '30')),
        mem_note: 'peak_mem_mb = tổng working set (RSS) của mọi tiến trình Electron, lấy mẫu mỗi 250 ms',
      };
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, JSON.stringify(res, null, 2) + '\n');
      console.log(JSON.stringify(res));
      app.exit(0);
    });
  }
});
app.on('window-all-closed', () => app.quit());
