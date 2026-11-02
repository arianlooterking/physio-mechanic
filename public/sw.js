/* بیومانا service worker: the app opens offline, and a visit after a deploy downloads only the files that changed.
 *
 * - Pages: network first; the cached index.html is the offline copy.
 * - /theme.js (blocks the first paint): answered from the cache at once, refreshed in the background.
 * - /assets/* (content-hashed names) and /icons/*: cache first. A file is downloaded once and kept until a
 *   deploy stops using it. A lazily loaded chunk (the admin reports screen) is cached when first opened and,
 *   like every script the page no longer names, dropped at the next deploy.
 * - Whenever a page comes from the network, every script and stylesheet its index.html names is made sure to
 *   be in the cache. Only then does that index.html become the offline copy, so the offline copy never names a
 *   file the cache lacks. When the page changed, scripts and styles it no longer names are deleted, and so are
 *   fonts its stylesheet no longer names. Fonts are cached when a page first uses them (or, for fonts used
 *   before this worker took over, copied from the browser's HTTP cache), never downloaded ahead.
 */
const CACHE = 'biomana-v5';
const SHELL = './index.html';

const isHtml = (res) => (res.headers.get('content-type') || '').includes('text/html');
const abs = (path) => new URL(path, self.location.href).href;
/** The /assets/ files a page or stylesheet names. */
const assetsIn = (text) => [...new Set([...text.matchAll(/\/assets\/[^"'()\s]+/g)].map((m) => abs(m[0])))];
const isCode = (url) => /\.(js|css)$/.test(new URL(url).pathname);

/* One download per file at a time: the page's own requests and the background check share it. */
const pending = new Map();
function download(cache, url) {
  let job = pending.get(url);
  if (!job) {
    job = fetch(url, { credentials: 'same-origin' })
      .then(async (res) => {
        // A missing asset is answered with the app's index.html (single-page fallback); never cache that.
        if (res.ok && !isHtml(res)) await cache.put(url, res.clone());
        return res;
      })
      .finally(() => pending.delete(url));
    pending.set(url, job);
  }
  return job.then((res) => res.clone());
}

/** Cache everything a freshly fetched index.html needs, then make it the offline copy. */
async function refresh(cache, page) {
  const html = await page.clone().text();
  const code = assetsIn(html).filter(isCode);
  if (code.length === 0) return; // not the app's page
  const ready = await Promise.all(
    code.map((url) =>
      cache
        .match(url, { ignoreVary: true })
        .then((hit) => hit || download(cache, url))
        .then((res) => res.ok && !isHtml(res))
        .catch(() => false),
    ),
  );
  if (!ready.every(Boolean)) return; // keep the previous offline copy, whose files are all still cached
  const old = await cache.match(SHELL);
  const changed = !old || (await old.text()) !== html;
  await cache.put(SHELL, page);
  if (changed) await tidy(cache, code);
}

/** After the page changed: take in fonts the browser already holds, then drop what the page no longer uses. */
async function tidy(cache, code) {
  const fonts = [];
  for (const url of code.filter((u) => u.endsWith('.css'))) {
    const css = await cache.match(url, { ignoreVary: true });
    if (!css) return; // cannot tell which fonts are used; delete nothing
    fonts.push(...assetsIn(await css.text()));
  }
  // Fonts the page used before this worker took over sit in the HTTP cache; copying them costs no download.
  await Promise.all(
    fonts.map(async (url) => {
      if (await cache.match(url, { ignoreVary: true })) return;
      const res = await fetch(url, { cache: 'only-if-cached', mode: 'same-origin' }).catch(() => null);
      if (res && res.ok && !isHtml(res)) await cache.put(url, res);
    }),
  );
  const keep = new Set([...code, ...fonts]);
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    if (path.startsWith('/assets/') && /\.(js|css|woff2?|ttf)$/.test(path) && !keep.has(req.url)) await cache.delete(req);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(['./theme.js', './manifest.webmanifest', './favicon.svg'].map((u) => cache.add(u).catch(() => {})));
      // The page that registered this worker has just loaded these files, so this mostly reads the HTTP cache.
      const page = await fetch('./', { cache: 'no-cache' }).catch(() => null);
      if (page && page.ok && isHtml(page)) await refresh(cache, page).catch(() => {});
    })().then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  // the Android app's download page and the apps' update files are their own pages, never the app shell
  if (url.pathname === '/app' || url.pathname.startsWith('/app/') || url.pathname.startsWith('/app-update/')) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && isHtml(res)) {
            const copy = res.clone(); // now, before the browser starts reading res
            event.waitUntil(caches.open(CACHE).then((c) => refresh(c, copy)).catch(() => {}));
          }
          return res;
        })
        .catch(() => caches.match(SHELL).then((hit) => hit || Response.error())),
    );
    return;
  }
  // The theme script blocks the first paint: answer from the cache at once and refresh the copy in the background.
  if (url.pathname === '/theme.js') {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req, { ignoreVary: true });
        const fresh = fetch(req).then(async (res) => {
          if (res.ok && !isHtml(res)) await cache.put(req, res.clone());
          return res;
        });
        if (!hit) return fresh;
        event.waitUntil(fresh.catch(() => undefined));
        return hit;
      }),
    );
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(req, { ignoreVary: true }).then((hit) => hit || download(cache, url.href)),
      ),
    );
    return;
  }
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
