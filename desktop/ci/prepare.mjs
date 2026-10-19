// Before building the Windows / Mac app on GitHub: put the newest content (the minified web app from
// updates/web-<build>.zip, the same file phones and computers download) into desktop/app/www.
// The zip is checked against the SHA-256 in the signed update.json first.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const upd = JSON.parse(fs.readFileSync(path.join(root, 'updates', 'update.json'), 'utf8'));
const m = JSON.parse(Buffer.from(upd.manifest, 'base64').toString('utf8'));
const info = JSON.parse(fs.readFileSync(path.join(root, 'desktop', 'app', 'build-info.json'), 'utf8'));
if (!m.web || !/^web-\d+\.zip$/.test(m.web.file)) throw new Error('no content file in update.json');
if ((+m.web.minDesktop || 0) > info.appCode) throw new Error('the newest content needs a newer desktop app (' + m.web.minDesktop + ')');
const zip = path.join(root, 'updates', m.web.file);
const sha = createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
if (sha !== m.web.sha256) throw new Error('content zip does not match update.json');
const www = path.join(root, 'desktop', 'app', 'www');
fs.rmSync(www, { recursive: true, force: true }); fs.mkdirSync(www, { recursive: true });
// bsdtar reads zip files (Windows' own tar.exe, not Git's GNU tar)
const TAR = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
execFileSync(TAR, ['-xf', zip, '-C', www], { stdio: 'inherit' });
const v = JSON.parse(fs.readFileSync(path.join(www, 'version.json'), 'utf8'));
if (v.build !== m.web.build || !fs.existsSync(path.join(www, 'index.html'))) throw new Error('unpacked content looks wrong');
console.log('content ' + v.version + ' (' + v.build + ') in desktop/app/www');
