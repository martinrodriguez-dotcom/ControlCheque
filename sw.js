// Service Worker Básico para permitir instalación PWA
self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
});

self.addEventListener('fetch', (e) => {
  // Solo necesitamos esto para cumplir el requisito de PWA
  // No cacheamos nada complejo para asegurar que siempre veas los datos en vivo de Firebase
});
