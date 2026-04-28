const CACHE = 'par-v1';
const ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

// Alarmes em background
const alarmesFoiDisparado = {};

self.addEventListener('message', e => {
  if (e.data && e.data.tipo === 'CONFIGURAR_ALARMES') {
    self.alarmes = e.data.alarmes;
    self.extras  = e.data.extras;
  }
});

// Verifica alarmes a cada minuto via sync periódico
self.addEventListener('periodicsync', e => {
  if (e.tag === 'verificar-alarmes') {
    e.waitUntil(verificarEDisparar());
  }
});

// Fallback: mensagem do cliente a cada minuto
self.addEventListener('message', e => {
  if (e.data && e.data.tipo === 'TICK') {
    verificarEDisparar(e.data.horaAtual, e.data.alarmes, e.data.extras);
  }
});

async function verificarEDisparar(horaAtual, alarmes, extras) {
  if (!horaAtual || !alarmes) return;

  const periodos = [
    { id: 'manha', nome: 'Manhã', icone: '🌅' },
    { id: 'tarde', nome: 'Tarde', icone: '☀️' },
    { id: 'noite', nome: 'Noite', icone: '🌙' }
  ];

  for (const p of periodos) {
    const cfg = alarmes[p.id];
    if (!cfg || !cfg.ativo) continue;
    const chave = p.id + cfg.hora + horaAtual;
    if (cfg.hora === horaAtual && !alarmesFoiDisparado[chave]) {
      alarmesFoiDisparado[chave] = true;
      await self.registration.showNotification(`PAR — ${p.icone} ${p.nome}`, {
        body: `Hora de tomar os remédios da ${p.nome}!`,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-96.png',
        tag: 'alarme-' + p.id,
        requireInteraction: true,
        vibrate: [300, 100, 300, 100, 300],
        actions: [
          { action: 'confirmar', title: '✓ Tomei' },
          { action: 'adiar',    title: '⏱ Lembrar em 10min' }
        ],
        data: { periodo: p.id, hora: horaAtual }
      });
    }
  }

  if (extras) {
    for (let i = 0; i < extras.length; i++) {
      const ex = extras[i];
      if (!ex.ativo) continue;
      const chave = 'extra' + i + horaAtual;
      if (ex.hora === horaAtual && !alarmesFoiDisparado[chave]) {
        alarmesFoiDisparado[chave] = true;
        await self.registration.showNotification(`PAR — ⏰ Lembrete`, {
          body: ex.desc || 'Hora do remédio!',
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-96.png',
          tag: 'alarme-extra-' + i,
          requireInteraction: true,
          vibrate: [300, 100, 300],
          data: { extra: i }
        });
      }
    }
  }
}

// Ação ao clicar na notificação
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'adiar') {
    const data = e.notification.data;
    setTimeout(async () => {
      await self.registration.showNotification('PAR — ⏰ Lembrete', {
        body: 'Não esqueça dos seus remédios!',
        icon: '/icons/icon-192.png',
        requireInteraction: true,
        vibrate: [300, 100, 300]
      });
    }, 10 * 60 * 1000);
    return;
  }
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      if (cs.length > 0) { cs[0].focus(); return; }
      return clients.openWindow('/');
    })
  );
});
