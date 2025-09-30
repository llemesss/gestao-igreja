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
  // IMPORTANTE: Só interceptar requisições GET para evitar problemas com POST/PUT/DELETE
  if (event.request.method !== 'GET') {
    // Deixar requisições não-GET passarem normalmente sem interceptação
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

  // Para outras requisições GET (páginas, assets estáticos), usar cache básico
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Retornar do cache se disponível, senão buscar da rede
        return response || fetch(event.request);
      })
      .catch(() => {
        // Em caso de erro, tentar buscar da rede
        return fetch(event.request);
      })
  );
});