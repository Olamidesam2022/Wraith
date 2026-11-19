import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import WebSocket from 'ws';

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const profile = `${process.cwd()}/.edge-capture`;
const browser = spawn(edge, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9223', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
const cases = [
  ['landing.png', '/', 1440, 1100, '.landing-hero'],
  ['house-assembled.png', '/house-preview', 1440, 1100, '.house-svg'],
  ['ghost-hover.png', '/house-preview?finding=src%2Fcore%2Findex.ts', 1440, 1100, '.house-selection'],
  ['room-open.png', '/house-preview?room=src%2Fcore', 1440, 1100, '.room-detail'],
  ['exorcism-result.png', '/house-preview?exorcise=src%2Fcore%2Findex.ts', 1440, 1100, '.exorcism-dialog'],
  ['findings-list.png', '/house-preview?view=list', 1440, 1100, '.findings-list table'],
  ['mobile.png', '/', 390, 844, '.landing-hero'],
  ['stress-preview.png', '/house-preview/stress', 1440, 1100, '.house-svg'],
];
let socket;
let seq = 0;
const pending = new Map();
function cdp(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timed out: ${method}`)); }, 15_000);
    pending.set(id, (message) => { clearTimeout(timer); message.error ? reject(new Error(message.error.message)) : resolve(message.result); });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
try {
  let page;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { page = (await (await fetch('http://127.0.0.1:9223/json/list')).json()).find((x) => x.type === 'page'); if (page) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!page) throw new Error('Edge DevTools page did not start');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  socket.on('message', (bytes) => { const message = JSON.parse(bytes); if (message.id) pending.get(message.id)?.(message); });
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  const frames = [];
  for (const [filename, path, width, height, readySelector] of cases) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 });
    await cdp('Page.navigate', { url: `http://127.0.0.1:3000${path}` });
    for (let i = 0; i < 150; i++) {
      const check = await cdp('Runtime.evaluate', { expression: `Boolean(document.querySelector(${JSON.stringify(readySelector)}))`, returnByValue: true });
      if (check.result.value) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await new Promise((resolve) => setTimeout(resolve, filename === 'exorcism-result.png' ? 3_700 : 1_500));
    if (filename === 'room-open.png' || filename === 'ghost-hover.png') {
      const selector = filename === 'room-open.png' ? '.room-detail' : '.house-selection';
      await cdp('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center'})`, returnByValue: true });
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (filename === 'house-assembled.png' || filename === 'stress-preview.png') {
      const perf = await cdp('Runtime.evaluate', { expression: `new Promise(resolve => { const d=[]; let last=0; const start=performance.now(); function tick(t){ if(last) d.push(t-last); last=t; if(t-start<3000) requestAnimationFrame(tick); else {d.sort((a,b)=>a-b);resolve({frames:d.length,p95:d[Math.floor(d.length*.95)]||0})} } requestAnimationFrame(tick) })`, awaitPromise: true, returnByValue: true });
      frames.push({ sample: filename === 'house-assembled.png' ? '40-file fixture preview, 3 seconds' : 'generated 5,000-file stress report, 3 seconds', ...perf.result.value });
    }
    const image = await cdp('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
    await writeFile(`${process.cwd()}/${filename}`, Buffer.from(image.data, 'base64'));
  }
  await mkdir(`${process.cwd()}/artifacts`, { recursive: true });
  await writeFile(`${process.cwd()}/artifacts/frame-metrics.json`, JSON.stringify(frames, null, 2));
  console.log(JSON.stringify(frames));
} finally {
  socket?.close();
  browser.kill();
}
