const CACHE="oto-yikama-pro-v22-customer-followup";
const ASSETS=["./","./index.html","./randevu.html","./manifest.json","./icon-192.png","./icon-512.png","./detail-intake.js","./customer-followup.js"];

function isMainAppNavigation(url){
  return url.pathname.endsWith("/index.html") || url.pathname.endsWith("/");
}

async function injectAppScripts(response){
  if(!response || !response.ok) return response;
  const type=response.headers.get("content-type")||"";
  if(!type.includes("text/html")) return response;

  let text=await response.text();
  const scripts=[];
  if(!text.includes("detail-intake.js")) scripts.push('<script src="./detail-intake.js?v=21"></script>');
  if(!text.includes("customer-followup.js")) scripts.push('<script src="./customer-followup.js?v=22"></script>');

  if(scripts.length){
    const block=scripts.join("\n");
    text=text.includes("</body>") ? text.replace("</body>",block+"\n</body>") : text+"\n"+block;
  }

  const headers=new Headers(response.headers);
  headers.delete("content-length");
  return new Response(text,{status:response.status,statusText:response.statusText,headers});
}

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
    event.respondWith((async()=>{
      try{
        const network=await fetch(request,{cache:"no-store"});
        let response=network;
        if(isMainAppNavigation(url)) response=await injectAppScripts(network);
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(request,copy));
        return response;
      }catch{
        let cached=await caches.match(request);
        if(!cached) cached=await caches.match("./index.html");
        if(cached && isMainAppNavigation(url)) return injectAppScripts(cached);
        return cached;
      }
    })());
    return;
  }

  event.respondWith(
    caches.match(request).then(cached=>cached||fetch(request).then(response=>{
      if(response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(request,copy));
      }
      return response;
    }))
  );
});

self.addEventListener("push",event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch{data={body:event.data?.text?.()||"Yeni randevu talebi var."}}
  const title=data.title||"RUVA Detailing";
  const options={
    body:data.body||"Yeni randevu talebi geldi.",
    icon:"./icon-192.png",
    badge:"./icon-192.png",
    tag:data.tag||"ruva-new-appointment",
    renotify:true,
    data:{url:data.url||"./index.html?open=appointments"}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||"./index.html?open=appointments",self.location.href).href;
  event.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(async list=>{
    for(const client of list){
      if("navigate" in client)await client.navigate(target).catch(()=>{});
      if("focus" in client)return client.focus();
    }
    if(clients.openWindow)return clients.openWindow(target);
  }));
});
