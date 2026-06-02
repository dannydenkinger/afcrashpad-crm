/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// Firebase config is injected at build time via /api/firebase-config
// or read from environment. Fetch it dynamically.
self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch('/api/firebase-config')
      .then((res) => res.json())
      .then((config) => {
        firebase.initializeApp(config);
        self.firebaseConfig = config;
      })
      .catch(() => {
        // Firebase push notifications will not work without config
        console.warn('Firebase config not available — push notifications disabled');
      })
  );
});

// Only set up messaging if Firebase was initialized
if (firebase.apps.length > 0) {
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const { title, body, url } = payload.data || {};
    if (!title) return;

    self.registration.showNotification(title, {
      body: body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: url || '/pipeline' },
    });
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/pipeline';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
