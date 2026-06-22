/* Show Up — service worker
 * Goal: the app shell must keep opening even after iOS clears caches.
 * Strategy: cache the shell on install, re-cache on every launch (page sends
 * a "recache" message), serve cache-first with background refresh, and fall
 * back to cached index.html for navigations when offline.
 */
var CACHE = 'showup-shell-v1';
var CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // addAll is atomic; if one fails nothing caches, so add individually.
      return Promise.all(CORE.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Page asks us to re-cache the shell on every launch.
self.addEventListener('message', function (e) {
  if (e.data === 'recache') {
    e.waitUntil(
      caches.open(CACHE).then(function (c) {
        return Promise.all(CORE.map(function (u) {
          return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
        }));
      })
    );
  }
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let video/CDN pass through

  // Navigations: network first, fall back to cached shell (offline launch).
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (resp) {
        caches.open(CACHE).then(function (c) { c.put('./index.html', resp.clone()); });
        return resp;
      }).catch(function () {
        return caches.match('./index.html').then(function (m) {
          return m || caches.match('./');
        });
      })
    );
    return;
  }

  // Other same-origin GETs: stale-while-revalidate.
  e.respondWith(
    caches.match(req).then(function (cached) {
      var net = fetch(req).then(function (resp) {
        if (resp && resp.status === 200) {
          caches.open(CACHE).then(function (c) { c.put(req, resp.clone()); });
        }
        return resp;
      }).catch(function () { return cached; });
      return cached || net;
    })
  );
});
