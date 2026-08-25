const CACHE="oto-yikama-pro-v19-4-4";
const ASSETS=["./","./index.html","./randevu.html","./manifest.json","./icon-192.png","./icon-512.png"];

self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=="GET" || url.origin!==self.location.origin) return;
  if(request.mode==="navigate"){
    event.respondWith(
      fetch(request,{cache:"no-store"})
        .then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));return response})
        .catch(()=>caches.match(request).then(r=>r||caches.match("./index.html")))
    );
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}return response})));
});
