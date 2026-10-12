/* Caja: sincronización de la apertura local vigente con Supabase. */
(function(){
 let credentials=null, inFlight=false, lastAttemptId='';
 function latestOpen(){
  let list=[];try{list=JSON.parse(localStorage.getItem('sp_premium_cash_closures_v1')||'[]')}catch(e){}
  if(!Array.isArray(list))return null;
  const day=typeof dayKey==='function'?dayKey(new Date()):new Date().toISOString().slice(0,10);
  const closes=list.filter(x=>x&&x.day===day&&x.type!=='apertura').sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  const closeAt=closes.length?new Date(closes[0].date||0).getTime():0;
  return list.filter(x=>x&&x.type==='apertura'&&x.day===day&&new Date(x.date||0).getTime()>closeAt).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0))[0]||null;
 }
 async function syncCurrent(){
  const rec=latestOpen(); if(!rec||inFlight||lastAttemptId===String(rec.id))return;
  if(typeof SP_DB==='undefined'||!SP_DB||typeof SP_DB.rpc!=='function'){console.warn('Caja: Supabase no conectado');return;}
  inFlight=true;lastAttemptId=String(rec.id);
  try{
   const user=(typeof currentUser!=='undefined'&&currentUser)||{};
   if(!credentials){
    const username=String(user.user||user.username||prompt('Usuario autorizado para sincronizar Caja:')||'').trim();
    if(!username)throw Error('No se ingresó el usuario autorizado');
    const pin=prompt('PIN autorizado para sincronizar la apertura de Caja. No se guardará.');
    if(pin===null||!pin.trim())throw Error('No se ingresó PIN');
    credentials={username,pin:pin.trim()};
   }
   const result=await SP_DB.rpc('sp_open_cash_session_by_pin',{p_username:credentials.username,p_pin:credentials.pin,p_local_session_id:String(rec.id),p_opening_amount:Number(rec.opening||0),p_opened_at:rec.date||new Date().toISOString()});
   if(result.error)throw result.error;
   console.info('Caja: sincronización central confirmada',result.data);
   alert('Apertura de Caja sincronizada con Supabase.');
  }catch(e){
   lastAttemptId='';
   credentials=null;
   console.error('Caja: no se pudo sincronizar',e);
   alert('No se pudo confirmar la apertura en Supabase. La apertura local no se ha borrado. Detalle: '+String(e.message||e));
  }finally{inFlight=false;}
 }
 function install(){
  let installed=false;
  ['adminCash','employeeCash'].forEach(function(name){
   if(typeof window[name]==='function'&&!window[name].__spCashWrapped){
    const original=window[name];
    const wrapped=function(){const result=original.apply(this,arguments);setTimeout(syncCurrent,0);return result;};
    wrapped.__spCashWrapped=true;window[name]=wrapped;installed=true;
   }
  });
  if(!installed&&!window.__spCashHookWaiting)setTimeout(install,500);
 }
 install();
})();
