const CACHE_NAME = 'drive-assist-public-v2';
const ORT_CDN_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];
// 失敗してもインストールを止めない、ベストエフォートの事前キャッシュ対象
const OPTIONAL_ASSETS = [
  './models/yolov8n.onnx',
  ORT_CDN_BASE + 'ort.min.js',
  ORT_CDN_BASE + 'ort-wasm-simd-threaded.wasm',
  ORT_CDN_BASE + 'ort-wasm-simd-threaded.mjs',
  ORT_CDN_BASE + 'ort-wasm-simd-threaded.jsep.wasm',
  ORT_CDN_BASE + 'ort-wasm-simd-threaded.jsep.mjs'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(CORE_ASSETS);
      await Promise.all(OPTIONAL_ASSETS.map(url => cache.add(url).catch(() => {})));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const isHtml = event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').includes('text/html');

  if (isHtml) {
    // HTMLはネットワーク優先: デプロイした更新がすぐ反映され、オフライン時はキャッシュで動く
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
        return response;
      }).catch(() => caches.match(event.request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // モデル・ライブラリ等の静的アセットはキャッシュ優先
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
      return response;
    }).catch(() => cached))
  );
});
