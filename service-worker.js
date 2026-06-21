// ── Service Worker — نظام الكشف الراداري التكتيكي ──
// يخزن هيكل التطبيق (HTML/CSS/JS/الأيقونات) للعمل دون اتصال،
// بينما يترك طلبات API (الارتفاعات، خرائط الـ tiles، البحث الجغرافي) تذهب للشبكة دائمًا
// لأنها بيانات حية لازم تكون محدّثة ودقيقة.

const CACHE_NAME = 'radar-coverage-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// مكتبات خارجية (CDN) نحب نخزنها كمان عشان التطبيق يفتح أوفلاين بعد أول زيارة
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).then(() => {
        // الـ CDN قد يفشل بعضها لو حصل تغيير في الإصدار؛ نحاول لكن لا نوقف التثبيت لو فشلت
        return Promise.allSettled(
          CDN_ASSETS.map((url) => cache.add(url).catch(() => {}))
        );
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// نطاقات لازم تفضل تروح للشبكة مباشرة دايمًا (بيانات حية: ارتفاعات، خرائط، بحث)
const NETWORK_ONLY_HOSTS = [
  'api.open-meteo.com',
  'tile.openstreetmap.org',
  'nominatim.openstreetmap.org',
];

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // اطلبات غير GET (زي POST) سيبها تمر عادي بدون تدخل
  if (event.request.method !== 'GET') return;

  // بيانات حية — Network only، بدون أي كاش
  if (NETWORK_ONLY_HOSTS.some((host) => url.hostname.includes(host))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // هيكل التطبيق والـ CDN — Cache first, fallback للشبكة، وتحديث الكاش في الخلفية
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      }).catch(() => cached); // لو الشبكة مقطوعة، استخدم الكاش لو موجود

      return cached || networkFetch;
    })
  );
});
