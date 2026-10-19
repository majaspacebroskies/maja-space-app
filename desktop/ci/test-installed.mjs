// On GitHub's Windows / Mac computers, after electron-builder: install the app the way a student would
// (Windows: the installer, silently; Mac: copy it out of the .dmg), check it, and run its self-test
// (main.js --self-test). Results and screenshots go to desktop/results/<win|mac-arm64|mac-x64>/.
//   node desktop/ci/test-installed.mjs win|mac
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desk = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(desk, 'dist'), results = path.join(desk, 'results');
const target = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(path.join(desk, 'package.json'), 'utf8'));
let failed = false;

function find(dir, name, depth) {
  if (depth < 0) return null;
  let list = [];
  try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return null; }
  for (const d of list) { if (d.name === name) return path.join(dir, d.name); }
  for (const d of list) { if (d.isDirectory()) { const f = find(path.join(dir, d.name), name, depth - 1); if (f) return f; } }
  return null;
}

function selfTest(label, exe, steps, extraArgs) {
  const out = path.join(results, label); fs.mkdirSync(out, { recursive: true });
  const t0 = Date.now();
  const r = spawnSync(exe, (extraArgs || []).concat(['--self-test=' + out]), { timeout: 6 * 60 * 1000, encoding: 'utf8' });
  let res = null;
  try { res = JSON.parse(fs.readFileSync(path.join(out, 'result.json'), 'utf8')); } catch (e) { res = null; }
  steps.push({ step: 'self-test', pass: r.status === 0 && !!res && res.ok, exit: r.status, signal: r.signal, seconds: Math.round((Date.now() - t0) / 1000),
    passed: res ? res.passed + '/' + res.total : 'no result.json', error: r.error ? String(r.error) : '', stderr: String(r.stderr || '').slice(-1500) });
  if (res) for (const x of res.results) if (!x.pass) console.log('FAIL ' + label + ': ' + x.name + ' -> ' + x.info);
  return out;
}

function finish(label, steps) {
  const out = path.join(results, label); fs.mkdirSync(out, { recursive: true });
  const pass = steps.every(function (s) { return s.pass; });
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ target: label, version: pkg.version, pass, steps, runner: { os: os.release(), arch: os.arch(), platform: process.platform } }, null, 1));
  console.log((pass ? 'PASS ' : 'FAIL ') + label + ': ' + steps.map(function (s) { return s.step + (s.pass ? ' ok' : ' FAILED'); }).join(', '));
  if (!pass) failed = true;
}

if (target === 'win') {
  const steps = [];
  const setup = path.join(dist, 'MajaSpace-Setup.exe');
  steps.push({ step: 'installer built', pass: fs.existsSync(setup), size: fs.existsSync(setup) ? fs.statSync(setup).size : 0 });
  const r = spawnSync(setup, ['/S'], { timeout: 4 * 60 * 1000 });
  steps.push({ step: 'silent install', pass: r.status === 0, exit: r.status });
  const programs = path.join(process.env.LOCALAPPDATA || '', 'Programs');
  const exe = find(programs, 'Maja Space.exe', 2);
  steps.push({ step: 'installed for this user (no admin)', pass: !!exe, path: exe || '' });
  const lnk = find(path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'), 'Maja Space.lnk', 2);
  steps.push({ step: 'Start menu shortcut', pass: !!lnk, path: lnk || '' });
  if (exe) selfTest('win', exe, steps);
  const un = exe ? find(path.dirname(exe), 'Uninstall Maja Space.exe', 0) : null;
  steps.push({ step: 'uninstaller present', pass: !!un });
  finish('win', steps);
} else if (target === 'mac') {
  try { execFileSync('/usr/sbin/softwareupdate', ['--install-rosetta', '--agree-to-license'], { stdio: 'ignore', timeout: 5 * 60 * 1000 }); } catch (e) { /* already there, or not needed */ }
  for (const arch of ['arm64', 'x64']) {
    const steps = [], label = 'mac-' + arch;
    const dmg = path.join(dist, 'MajaSpace-mac-' + arch + '.dmg');
    steps.push({ step: 'disk image built', pass: fs.existsSync(dmg), size: fs.existsSync(dmg) ? fs.statSync(dmg).size : 0 });
    const mnt = '/tmp/maja-' + arch, apps = fs.mkdtempSync('/tmp/maja-apps-');
    let app = '';
    try {
      execFileSync('hdiutil', ['attach', '-nobrowse', '-readonly', '-mountpoint', mnt, dmg], { stdio: 'inherit' });
      const src = find(mnt, 'Maja Space.app', 0);
      if (src) { execFileSync('ditto', [src, path.join(apps, 'Maja Space.app')]); app = path.join(apps, 'Maja Space.app'); }
      const link = fs.existsSync(path.join(mnt, 'Applications'));
      steps.push({ step: 'image has the app and the Applications shortcut', pass: !!src && link });
    } catch (e) { steps.push({ step: 'open the disk image', pass: false, error: String(e.message || e) }); }
    try { execFileSync('hdiutil', ['detach', mnt, '-force'], { stdio: 'ignore' }); } catch (e) { /* ignore */ }
    if (app) {
      let sig = '';
      try { execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'pipe' }); sig = 'valid'; } catch (e) { sig = String(e.stderr || e.message).slice(0, 400); }
      steps.push({ step: 'signature (ad hoc) is valid', pass: sig === 'valid', info: sig });
      const exe = path.join(app, 'Contents', 'MacOS', 'Maja Space');
      const kind = spawnSync('file', [exe], { encoding: 'utf8' }).stdout || '';
      steps.push({ step: 'the program is for ' + arch, pass: arch === 'arm64' ? /arm64/.test(kind) : /x86_64/.test(kind), info: kind.trim() });
      selfTest(label, exe, steps);
    }
    finish(label, steps);
  }
} else {
  console.error('usage: node desktop/ci/test-installed.mjs win|mac'); process.exit(2);
}
process.exit(failed ? 1 : 0);
