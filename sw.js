self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

// Requisito de instalación de Chrome: el service worker controla las solicitudes
// GET del mismo sitio, pero siempre las pasa directamente a la red.
// No guarda en caché páginas, pedidos, ventas, inventario ni respuestas de Supabase.
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(request));
});

self.addEventListener("push", event => {
  let data = { title: "Santo Pecado 17-29", body: "Tienes una nueva notificación." };
  try {
    data = Object.assign(data, event.data ? event.data.json() : {});
  } catch (_) {}

  event.waitUntil(self.registration.showNotification(data.title || "Santo Pecado 17-29", {
    body: data.body || "Nueva actualización",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: data.url || "/"
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
    for (const client of clientList) {
      if ("focus" in client) return client.focus();
    }
    return clients.openWindow(event.notification.data || "/");
  }));
});
