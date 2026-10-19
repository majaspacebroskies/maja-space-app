// electron-builder hook (Mac only): sign the app "ad hoc" (no Apple certificate). Apple Silicon Macs
// refuse to run an app whose signature no longer matches its files, and electron-builder changes the
// files (name, icon, app code) after Electron signed them. Ad-hoc signing makes the app run; Gatekeeper
// still asks people to confirm once (System Settings → Privacy & Security → Open Anyway), because the
// app isn't notarised by Apple (that needs a paid Apple Developer account).
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.app');
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
};
