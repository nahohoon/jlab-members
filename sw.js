/**
 * J_LAB 회원관리 v2.0 — sw.js (Service Worker)
 * 모바일 홈화면 설치 + 정적 자원 오프라인 캐시
 */
var CACHE = 'jlab-v2-1';
var ASSETS = ['./', './index.html', './style.css', './script.js', './config.js', './manifest.json'];

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS).catch(function(){}); }));
});

self.addEventListener('activate', function(e) {
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  if (url.hostname.indexOf('script.google.com') !== -1 || url.hostname.indexOf('googleapis.com') !== -1) return;
  e.respondWith(
    fetch(e.request).then(function(res) {
      if (res && res.status === 200 && e.request.method === 'GET') {
        var clone = res.clone();
        caches.open(CACHE).then(function(c){ c.put(e.request, clone); });
      }
      return res;
    }).catch(function() {
      return caches.match(e.request).then(function(cached){
        return cached || new Response('<h2 style="font-family:sans-serif;padding:40px">오프라인 상태입니다. 네트워크 연결 후 다시 시도해 주세요.</h2>',
          { headers:{'Content-Type':'text/html;charset=utf-8'} });
      });
    })
  );
});
