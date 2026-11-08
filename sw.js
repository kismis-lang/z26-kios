// service worker minimal: syarat pemasangan; selalu ambil versi terbaru dari jaringan (cek ulang ke server), cadangan cache bila offline
const C='z26-v3';
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET'||new URL(r.url).origin!==location.origin) return;
  const q=r.mode==='navigate'?r:new Request(r,{cache:'no-cache'});
  e.respondWith(fetch(q).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put(r,cp));return res;}).catch(()=>caches.match(r)));
});
