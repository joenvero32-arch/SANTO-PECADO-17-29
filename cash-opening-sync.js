/* Caja: sincronización verificable de aperturas reales con Supabase. */
(function(){
 let credentials=null, inFlight=false, lastConfirmedId='';
 const KEY='sp_premium_cash_closures_v1';
 function localDay(){
  try{if(typeof dayKey==='function')return dayKey(new Date())}catch(e){}
  const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 }
 function readClosures(){
  try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a:[]}catch(e){return []}
 }
 function latestOpen(){
  const list=readClosures(),day=localDay();
  const closes=list.filter(x=>x&&x.day===day&&x.type!=='apertura').sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  const closeAt=closes.length?new Date(closes[0].date||0).getTime():0;
  return list.filter(x=>x&&x.type==='apertura'&&x.day===day&&new Date(x.date||0).getTime()>closeAt)
   .sort((a,b)=>new Date(b.date||0)-new Date(a.date||0))[0]||null;
 }
 async function syncCurrent(){
  const rec=latestOpen();
  if(!rec||inFlight||lastConfirmedId===String(rec.id))return;
  if(typeof SP_DB==='undefined'||!SP_DB||typeof SP_DB.rpc!=='function'){console.warn('Caja: Supabase no conectado; apertura local conservada');return;}
  inFlight=true;
  try{
   const user=(typeof currentUser!=='undefined'&&currentUser)||{};
   if(!credentials){
    const username=String(user.user||user.username||prompt('Usuario autorizado para sincronizar la apertura real de Caja:')||'').trim();
    if(!username)throw Error('No se ingresó el usuario autorizado');
    const pin=prompt('Ingrese el PIN autorizado para sincronizar Caja. No se guardará.');
    if(pin===null||!pin.trim())throw Error('No se ingresó PIN');
    credentials={username,pin:pin.trim()};
   }
   const amount=Number(rec.opening);
   if(!String(rec.id||'').trim()||!Number.isFinite(amount)||amount<0||!rec.date)throw Error('La apertura local no tiene identificador, base inicial o fecha válidos');
   const result=await SP_DB.rpc('sp_open_cash_session_by_pin',{
    p_username:credentials.username,p_pin:credentials.pin,p_local_session_id:String(rec.id),
    p_opening_amount:amount,p_opened_at:rec.date
   });
   if(result.error)throw result.error;
   const rows=Array.isArray(result.data)?result.data:(result.data?[result.data]:[]);
   const row=rows[0];
   if(!row||!row.id||!row.opened_at||Number(row.opening_amount)!==amount||String(row.status||'').toLowerCase()!=='open')
    throw Error('Supabase no confirmó una sesión abierta que coincida con la base inicial local');
   lastConfirmedId=String(rec.id);
   console.info('Caja: apertura confirmada por Supabase', {local_id:String(rec.id),central_id:row.id,status:row.status,opening_amount:row.opening_amount});
   alert('Apertura de Caja confirmada en Supabase. Base inicial: '+amount.toLocaleString('es-CO')+'.');
  }catch(e){
   credentials=null;
   console.error('Caja: sincronización no confirmada; se conserva el registro local',e);
   alert('No se pudo confirmar la apertura en Supabase. La apertura local se conserva. Detalle: '+String(e.message||e));
  }finally{inFlight=false;}
 }

 async function syncLatestClose(){
  const list=readClosures(),day=localDay();
  const closes=list.filter(x=>x&&x.type!=='apertura'&&x.day===day&&x.date)
   .sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  const rec=closes[0]||null;
  if(!rec||!rec.id||!Number.isFinite(Number(rec.expected))||!Number.isFinite(Number(rec.counted)))return;
  if(typeof SP_DB==='undefined'||!SP_DB||typeof SP_DB.rpc!=='function'){console.warn('Caja: Supabase no conectado; cierre local conservado');return;}
  try{
   const user=(typeof currentUser!=='undefined'&&currentUser)||{};
   const username=String(user.user||user.username||prompt('Usuario autorizado para sincronizar el cierre real de Caja:')||'').trim();
   if(!username)return;
   const pin=prompt('Ingrese el PIN autorizado para sincronizar el cierre de Caja. No se guardará.');
   if(pin===null||!pin.trim())return;
   const result=await SP_DB.rpc('sp_close_cash_session_by_pin',{
    p_username:username,p_pin:pin.trim(),p_local_close_id:String(rec.id),
    p_expected_amount:Number(rec.expected),p_physical_amount:Number(rec.counted),
    p_closed_at:rec.date,p_observations:String(rec.reason||'')
   });
   if(result.error)throw result.error;
   const rows=Array.isArray(result.data)?result.data:(result.data?[result.data]:[]);
   const row=rows[0];
   if(!row||!row.id||String(row.status||'').toLowerCase()!=='closed'||
      Number(row.expected_amount)!==Number(rec.expected)||Number(row.physical_amount)!==Number(rec.counted))
    throw Error('Supabase no confirmó un cierre coincidente con el registro local');
   console.info('Caja: cierre confirmado por Supabase',{local_close_id:String(rec.id),central_id:row.id,status:row.status});
   alert('Cierre de Caja sincronizado con Supabase. Diferencia: '+Number(row.difference||0).toLocaleString('es-CO')+'.');
  }catch(e){
   console.error('Caja: cierre no sincronizado; se conserva el registro local',e);
   alert('El cierre local se conserva, pero no se pudo sincronizar con Supabase. Detalle: '+String(e.message||e));
  }
 }
 function install(){
  // Capturar la acción que realmente crea y guarda la apertura, no depender solo de la pantalla que se dibuja después.
  if(typeof window.closeCash==='function'&&!window.closeCash.__spCashCloseWrapped){
   const originalClose=window.closeCash;
   const wrappedClose=function(){const before=readClosures().length;const result=originalClose.apply(this,arguments);const after=readClosures();if(after.length>before)setTimeout(syncLatestClose,0);return result;};
   wrappedClose.__spCashCloseWrapped=true;window.closeCash=wrappedClose;
  }
  if(typeof window.openCash==='function'&&!window.openCash.__spCashWrapped){
   const original=window.openCash;
   const wrapped=function(){const result=original.apply(this,arguments);setTimeout(syncCurrent,0);return result;};
   wrapped.__spCashWrapped=true;window.openCash=wrapped;
  }
  // No sincronizar al entrar o cambiar de pantalla: puede ocurrir durante el inicio de sesión de otro empleado.
  // La sincronización automática solo se ejecuta después de una apertura real mediante openCash.
  if(typeof window.openCash!=='function'||!window.openCash.__spCashWrapped)setTimeout(install,500);
 }
 install();
})();