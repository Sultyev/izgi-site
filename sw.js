/* ИЗГИ — сервис-воркер: показывает push-уведомления о новых задачах. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'ИЗГИ', {
    body: d.body || '',
    icon: 'assets/icon-192.png',
    badge: 'assets/badge-96.png',
    tag: d.tag || 'izgi',
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [250, 120, 250, 120, 400],
    timestamp: Date.now(),
    actions: [{ action: 'open', title: 'Открыть' }],
    data: { url: d.url || 'tasks.html' }
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || 'tasks.html', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope) && 'focus' in c) { if (c.navigate) c.navigate(url); return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
