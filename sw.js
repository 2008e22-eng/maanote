const CACHE = 'maanote-PROD-v0.9-stage14.1-20261005';
const APP_SHELL = [
  './',
  './index.html',
  './runtime-config.js',
  './view/',
  './view/index.html',
  './view/manifest.webmanifest',
  './admin/',
  './admin/index.html',
  './styles.css?v=0.9-stage14.1-prod',
  './app.js?v=0.9-stage14.1-prod',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './version.json',
  './admin.html',
  './admin.css?v=0.9-stage14.1-prod',
  './admin.js?v=0.9-stage14.1-prod',
  './common-seed.json',
  './common-data.json',
  './migrate-v96.html',
  './migrate-v96.css?v=0.9-stage14.1-prod',
  './migrate-v96.js?v=0.9-stage14.1-prod'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/runtime-config.js')) {
    event.respondWith((async()=>{
      try{const fresh=await fetch(req,{cache:'no-store'});if(fresh&&fresh.ok){const cache=await caches.open(CACHE);await cache.put('./runtime-config.js',fresh.clone())}return fresh}
      catch(_){return (await caches.match('./runtime-config.js'))||new Response('',{status:504})}
    })());return;
  }

  if (url.pathname.endsWith('/common-data.json') || url.pathname.endsWith('/version.json')) {
    event.respondWith((async () => {
      const key = url.pathname.endsWith('/common-data.json') ? './common-data.json' : './version.json';
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(key, fresh.clone());
        }
        return fresh;
      } catch (_) {
        return (await caches.match(key)) || new Response('', { status: 504, statusText: 'Offline' });
      }
    })());
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const isView=url.pathname.includes('/view/');
      const isAdmin=url.pathname.includes('/admin/') || url.pathname.endsWith('/admin.html');
      const isMigration=url.pathname.endsWith('/migrate-v96.html');
      const page=isView?'./view/index.html':(isAdmin?'./admin/index.html':(isMigration?'./migrate-v96.html':'./index.html'));
      try {
        const fresh=await fetch(req);
        const cache=await caches.open(CACHE);
        cache.put(page,fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match(page)) || (await caches.match('./index.html')) || (await caches.match('./'));
      }
    })());
    return;
  }


  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (_) {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
