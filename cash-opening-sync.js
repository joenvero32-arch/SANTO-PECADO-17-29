/* Caja: puente de sincronización central */
(function(){
 function install(){
  if(typeof window.openCash!=='function') return setTimeout(install,500);
  if(window.__spCashOpeningSync)return;
  const original=window.openCash;
  window.openCash=function(day){
   let old=[];try{old=JSON.parse(localStorage.getItem('sp_premium_cash_closures_v1')||'[]')}catch(e){}
   original.apply(this,arguments);
   let now=[];try{now=JSON.parse(localStorage.getItem('sp_premium_cash_closures_v1')||'[]')}catch(e){}
   const ids=new Set((Array.isArray(old)?old:[]).map(x=>String(x.id)));
   const rec=(Array.isArray(now)?now:[]).find(x=>x&&x.type==='apertura'&&x.day===day&&!ids.has(String(x.id)));
   if(!rec)return;
   Promise.resolve().then(async function(){
    try{
     if(!window.SP_DB||typeof window.SP_DB.rpc!=='function')throw Error('Supabase no conectado');
     const user=(typeof currentUser!=='undefined'&&currentUser)||{};
     const pin=prompt('PIN autorizado para sincronizar la apertura de Caja. No se guardará.');
     if(pin===null||!pin.trim())throw Error('No se ingresó PIN');
     const result=await window.SP_DB.rpc('sp_open_cash_session_by_pin',{p_username:String(user.user||user.username||'admin'),p_pin:pin.trim(),p_local_session_id:String(rec.id),p_opening_amount:Number(rec.opening||0),p_opened_at:rec.date||new Date().toISOString()});
     if(result.error)throw result.error;
     alert('Apertura de Caja sincronizada con Supabase.');
    }catch(e){console.error(e);alert('Apertura local, sincronización central no confirmada: '+String(e.message||e));}
   });
  };
  window.__spCashOpeningSync=true;
 }
 install();
})();
