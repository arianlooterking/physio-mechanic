// Runs after every site build (`npm run build`): the files for the Android and iOS apps, and the live update the
// installed apps download.
//
// dist-app/                             the site (dist/client) without what only the website needs (service worker,
//                                       web manifest, the /app download page); Capacitor copies it into the apps
// dist/client/app-update/<hash>.zip     the same files zipped, served by the website
// dist/client/app-update/latest.json    what the apps check on start: the newest bundle, and the newest Android APK
//
// The apps load their files from the phone, so they work offline; on start they compare their own `app-build.json`
// with latest.json and, when the website has changed, download the zip and switch to it (src/native/index.ts).
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { zipSync } from 'fflate';

// APP_UPDATE_BASE: only for the emulator test, which serves the update from the test machine
const SITE = process.env.APP_UPDATE_BASE || 'https://biomana.don-aasd.workers.dev';
// The oldest installed app (its versionName) that can run today's web code. Raise it to the new versionName whenever
// the web code starts using a native plugin or setting the older apps don't have; those apps then keep their own
// files and are offered the new APK instead.
const MIN_NATIVE = '1.1.0';
const SKIP = new Set(['sw.js', 'manifest.webmanifest', 'app-update', 'app', '_headers', '_redirects']);

const files = (dir) =>
  readdirSync(dir)
    .sort()
    .flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? files(p) : [p];
    });

/** versionName and versionCode of the Android app, from its Gradle file */
function androidVersion() {
  try {
    const g = readFileSync('android/app/build.gradle', 'utf8');
    return { versionName: /versionName\s+"([^"]+)"/.exec(g)?.[1] ?? '', versionCode: Number(/versionCode\s+(\d+)/.exec(g)?.[1] ?? 0) };
  } catch {
    return { versionName: '', versionCode: 0 };
  }
}

const dist = 'dist/client';
const app = 'dist-app';
rmSync(app, { recursive: true, force: true });
cpSync(dist, app, { recursive: true, filter: (src) => !SKIP.has(relative(dist, src).split(/[\\/]/)[0] ?? '') });

// the emulator test builds a second, slightly different bundle to update to
if (process.env.APP_BUNDLE_MARK) writeFileSync(join(app, 'qa-mark.txt'), process.env.APP_BUNDLE_MARK + '\n');

// the bundle's name is the hash of its files: the same site build gives the same name, so nothing re-downloads
const list = files(app);
const h = createHash('sha256');
for (const f of list) h.update(relative(app, f).replace(/\\/g, '/')).update('\0').update(readFileSync(f));
const version = h.digest('hex').slice(0, 16);
const builtAt = new Date().toISOString();
writeFileSync(join(app, 'app-build.json'), JSON.stringify({ version, builtAt }) + '\n');

const entries = {};
const mtime = new Date('2026-01-01T00:00:00Z');
for (const f of files(app)) entries[relative(app, f).replace(/\\/g, '/')] = [readFileSync(f), { mtime }];
const zip = zipSync(entries, { level: 9 });

const out = join(dist, 'app-update');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
writeFileSync(join(out, `${version}.zip`), zip);
const apk = existsSync('public/app/biomana.apk');
const latest = {
  version,
  builtAt,
  url: `${SITE}/app-update/${version}.zip`,
  checksum: createHash('sha256').update(zip).digest('hex'),
  size: zip.length,
  minNative: MIN_NATIVE,
  android: apk ? { ...androidVersion(), url: `${SITE}/app/biomana.apk` } : null,
};
writeFileSync(join(out, 'latest.json'), JSON.stringify(latest, null, 2) + '\n');
console.log(`app bundle ${version}: ${list.length} files, ${(zip.length / 1e6).toFixed(1)} MB zipped`);
