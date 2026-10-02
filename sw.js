self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("push",e=>{
  let data={title:"Santo Pecado 17-29",body:"Tienes una nueva notificación."};
  try{data=Object.assign(data,e.data?e.data.json():{});}catch(_){}
  e.waitUntil(self.registration.showNotification(data.title||"Santo Pecado 17-29",{
    body:data.body||"Nueva actualización",
    icon:"/SANTO-PECADO-17-29/icon-192.png",
    badge:"/SANTO-PECADO-17-29/icon-192.png",
    data:data.url||"/SANTO-PECADO-17-29/"
  }));
});
self.addEventListener("notificationclick",e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{
    if(cs.length)return cs[0].focus();
    return clients.openWindow(e.notification.data||"/SANTO-PECADO-17-29/");
  }));
});