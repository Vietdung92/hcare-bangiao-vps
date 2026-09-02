// Service Worker for HCARE Bàn Giao Push Notifications
const CACHE_NAME = 'hcare-bangiao-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

self.addEventListener('push', e => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch(err) { data = { title: 'HCARE', body: e.data.text() }; }
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    data: { url: data.url || '/bangiao/' },
    actions: [
      { action: 'view', title: '👁 Xem ngay' },
      { action: 'close', title: 'Đóng' }
    ]
  };
  e.waitUntil(self.registration.showNotification(data.title || 'HCARE Bàn Giao', options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'close') return;
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    const url = e.notification.data?.url || '/bangiao/';
    for (const c of list) {
      if (c.url.includes('bangiao') && 'focus' in c) return c.focus();
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
