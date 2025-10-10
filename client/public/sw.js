// Service Worker para Sistema de Gestão de Igreja
// Configurado para não interferir com requisições POST e outras operações críticas

self.addEventListener('install', (event) => {
  console.log('Service Worker instalado');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker ativado');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // GUARDA CRÍTICA: não interceptar nada que não seja GET
  if (!event || !event.request || event.request.method !== 'GET') {
    return;
  }

  // Para requisições GET, também evitar interceptar APIs críticas
  const url = new URL(event.request.url);
  
  // Não interceptar requisições para a API do backend
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Não interceptar requisições para recursos do Next.js
  if (url.pathname.startsWith('/_next/') || 
      url.pathname.startsWith('/@vite/') ||
      url.pathname === '/sw.js') {
    return;
  }

  // Para outras requisições GET (páginas, assets estáticos), usar cache apenas como fallback
  event.respondWith(
    (async () => {
      try {
        const network = await fetch(event.request);
        // Opcional: atualizar cache em background
        const cache = await caches.open('app-cache-v1');
        cache.put(event.request, network.clone());
        return network;
      } catch (_) {
        const cached = await caches.match(event.request);
        return cached || Response.error();
      }
    })()
  );
});