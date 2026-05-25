const CACHE_NAME = 'mike-is-dinner-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './src/main.js',
  './src/Player.js',
  './src/Level.js',
  './src/Monster.js',
  './src/AudioSystem.js',
  './src/GameState.js',
  './src/UI.js',
  './game_icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request);
    })
  );
});
