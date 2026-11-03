// 電波のない所でも開けるように、画面のファイルを端末に残す（サービスワーカー）。
// つながっているときは必ずネットから取り（古い画面が残らない）、取れないときだけ端末に残したものを使う。
// 記録はもともと端末の中（localStorage）なので、電波がなくても残る。Claude への頼み（/api/ai/）は残さない。
const CACHE = 'gibier-tsunagi-v1';

self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/ai/')) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: url.pathname === '/' }).then((hit) => hit || caches.match('/index.html'))),
  );
});
