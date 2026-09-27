self.addEventListener('push', (event) => {
  const payload = event.data && event.data.json ? event.data.json() : null;
  const title = payload?.headings?.en || payload?.title || 'Kilax Notification';
  const body = payload?.contents?.en || payload?.message || 'You have a new notification.';
  const notificationOptions = {
    body,
    icon: payload?.big_picture || '/favicon.ico',
    badge: '/favicon.ico',
    image: payload?.big_picture || undefined,
    data: payload?.data || {},
  };

  if (payload?.url) {
    notificationOptions['data'] = { ...notificationOptions.data, url: payload.url };
  }

  event.waitUntil(self.registration.showNotification(title, notificationOptions));
});

self.addEventListener('notificationclick', (event) => {
  const url = event.notification.data?.url || '/';
  event.notification.close();
  event.waitUntil(clients.openWindow(url));
});
