// Service worker: guarda los archivos de la web para que
// "Mi horario" funcione como una app y también sin conexión.

const CACHE = 'mi-horario-v6';
const ARCHIVOS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './sincronizar.js',
  './manifest.webmanifest',
  './icono-192.png',
  './icono-512.png',
  './icono-180.png',
];

// Al instalarse, guarda todo en la caché
self.addEventListener('install', evento => {
  evento.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ARCHIVOS)));
});

// Al activarse, borra las copias antiguas
self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys().then(claves => Promise.all(
      claves.filter(c => c !== CACHE).map(c => caches.delete(c)),
    )),
  );
});

// Pide primero la versión nueva por internet y,
// si no hay conexión, usa la copia guardada
self.addEventListener('fetch', evento => {
  evento.respondWith(
    fetch(evento.request).catch(() => caches.match(evento.request)),
  );
});
