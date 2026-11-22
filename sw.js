// Riceve gli avvisi anche quando l'app è chiusa
importScripts("config.js");

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data.json(); } catch (_) { d = { title: "Medicine", body: "" }; }
  const opts = {
    body: d.body || "",
    tag: d.tag || "mammamed",
    renotify: true,
    requireInteraction: true,
    vibrate: [400, 200, 400, 200, 800],
    icon: "icons/icon-192.png",
    badge: "icons/badge.png",
    lang: "it",
    data: d,
  };
  if (d.doseId) opts.actions = [{ action: "taken", title: "✅ L'HO PRESA" }];
  e.waitUntil(self.registration.showNotification(d.title || "Medicine", opts));
});

self.addEventListener("notificationclick", (e) => {
  const d = e.notification.data || {};
  e.notification.close();
  if (e.action === "taken" && d.doseId && d.k && self.MAMMAMED_API) {
    e.waitUntil(
      fetch(self.MAMMAMED_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", k: d.k, dose_id: d.doseId }),
      }).then((r) => { if (!r.ok) throw new Error("no"); })
        .catch(() => openApp(d)) // se non riesce, apre l'app così può confermare lì
    );
    return;
  }
  e.waitUntil(openApp(d));
});

async function openApp(d) {
  const url = new URL(d.k ? "./?k=" + d.k : "./", self.registration.scope).href;
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const c of all) {
    if (c.url.startsWith(self.registration.scope)) {
      c.postMessage({ type: "refresh" });
      return c.focus();
    }
  }
  return self.clients.openWindow(url);
}
