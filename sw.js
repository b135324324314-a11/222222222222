// sw.js
const CACHE_NAME = 'loloa-system-cache-v2';

// الملفات الأساسية التي سيتم حفظها لتعمل بدون إنترنت (معدلة لتعمل مع GitHub)
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './icon-left.png',
  './icon-right.png',
  './manifest.json'
];

// 1. حدث التثبيت: حفظ الملفات في الكاش عند أول تشغيل
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('تم حفظ الملفات في الكاش للعمل أوفلاين');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. حدث التفعيل: مسح الكاش القديم إذا قمت بتحديث النظام (تغيير رقم الإصدار)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('تم مسح الكاش القديم');
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 3. حدث جلب البيانات (Fetch): جلب الملفات من الكاش إذا لم يتوفر إنترنت
self.addEventListener('fetch', event => {
  // استثناء طلبات قواعد البيانات (Firebase) والـ APIs من الكاش
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('api.imgbb.com')) {
    return; 
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // إذا وجد الملف في الكاش، يعرضه فوراً (أوفلاين)
        if (response) {
          return response;
        }
        // إذا لم يجده، يجلبه من الإنترنت
        return fetch(event.request).catch(() => {
            console.log('أنت غير متصل بالإنترنت والملف غير متوفر في الكاش');
        });
      })
  );
});
