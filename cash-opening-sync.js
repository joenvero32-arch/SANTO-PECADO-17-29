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
 function identityAliases(){const u=(typeof currentUser!=='undefined'&&currentUser)||{};return [...new Set([u.user,u.username,u.name,u.full_name,u.fullName,u.id].map(v=>String(v??'').trim().toLowerCase()).filter(Boolean))]}
 function currentKey(){const u=(typeof currentUser!=='undefined'&&currentUser)||{};return String(u.user||u.username||u.name||u.full_name||'administrador').trim().toLowerCase()}
 function owns(x){if(!x)return false;const aliases=identityAliases();const key=String(x.userKey??'').trim().toLowerCase();const user=String(x.user??'').trim().toLowerCase();return !!((key&&aliases.includes(key))||(user&&aliases.includes(user)))}
 function latestOpen(){
  const list=readClosures(),day=localDay();
  const closes=list.filter(x=>x&&x.day===day&&x.type!=='apertura'&&owns(x)).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  const closeAt=closes.length?new Date(closes[0].date||0).getTime():0;
  return list.filter(x=>x&&x.type==='apertura'&&x.day===day&&owns(x)&&new Date(x.date||0).getTime()>closeAt)
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
  const closes=list.filter(x=>x&&x.type!=='apertura'&&x.day===day&&x.date&&owns(x))
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

/* Corrección segura de atribución de ventas en Caja:
   solo atribuye una venta sin sold_by cuando existe auditoría explícita
   de confirmación de pago para el usuario autenticado. No modifica ventas ni pedidos. */
(function(){
  let installed=false;
  function installSalesAttribution(){
    if(installed)return;
    if(typeof window.spGetCashSales!=='function'||typeof window.SP_DB==='undefined'||!window.SP_DB){setTimeout(installSalesAttribution,500);return;}
    const original=window.spGetCashSales;
    if(original.__spCashAuditAttribution){installed=true;return;}
    const wrapped=async function(day){
      const rows=await original.apply(this,arguments);
      if(!Array.isArray(rows)||!rows.length)return rows;
      const user=(typeof currentUser!=='undefined'&&currentUser)||{};
      const username=String(user.user||user.username||'').trim().toLowerCase();
      if(!username||typeof window.SP_DB.from!=='function')return rows;
      try{
        const numbers=rows.filter(x=>!x.sold_by).map(x=>String(x.no||x.order_number||'').trim()).filter(Boolean);
        if(!numbers.length)return rows;
        const salesResult=await window.SP_DB.from('sales').select('order_id,order_number').in('order_number',numbers);
        if(salesResult.error)throw salesResult.error;
        const ids=[...new Set((salesResult.data||[]).map(x=>x.order_id).filter(Boolean).map(String))];
        if(!ids.length)return rows;
        const auditResult=await window.SP_DB.from('audit_logs').select('entity_id,details,action,entity_type').eq('action','Pago recibido').eq('entity_type','cash_sales').in('entity_id',ids);
        if(auditResult.error)throw auditResult.error;
        const confirmed=new Set();
        for(const entry of auditResult.data||[]){
          const details=entry.details||{};
          if(String(details.app_username||'').trim().toLowerCase()===username&&String(details.source||'')==='payment_confirmation_rpc')confirmed.add(String(entry.entity_id));
        }
        const orderToId=new Map((salesResult.data||[]).map(x=>[String(x.order_number||'').trim(),String(x.order_id||'')]));
        for(const row of rows){
          if(row.sold_by)continue;
          const id=orderToId.get(String(row.no||row.order_number||'').trim());
          if(id&&confirmed.has(id)){
            row.sold_by='audit:'+id;
            row.sold_by_username=username;
            row.sold_by_name=String(user.name||user.full_name||username);
          }
        }
      }catch(error){
        console.warn('Caja: no se pudo verificar la atribución por auditoría; se mantienen las ventas sin asignar.',error);
      }
      return rows;
    };
    wrapped.__spCashAuditAttribution=true;
    window.spGetCashSales=wrapped;
    installed=true;
  }
  installSalesAttribution();
})();


/* Cierre atrasado de jornada: conserva la fecha de operación y registra la hora real del cierre. */
(function(){
  function localDateString(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
  function moneyLate(n){return '$'+Math.round(Number(n)||0).toLocaleString('es-CO')}
  function lateModal({title,body,fields=[],confirmText='Continuar',danger=false}={}){
    return new Promise(resolve=>{
      const shade=document.createElement('div');shade.style.cssText='position:fixed;inset:0;z-index:2147483000;background:rgba(5,7,12,.8);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(5px)';
      const card=document.createElement('div');card.style.cssText='box-sizing:border-box;width:min(100%,440px);max-height:90vh;overflow:auto;background:#17181d;color:#f7f3e9;border:1px solid #8f7131;border-radius:22px;padding:22px;box-shadow:0 24px 70px #0009;font-family:system-ui,sans-serif';
      const top=document.createElement('div');top.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:12px';
      const h=document.createElement('h2');h.textContent=title;h.style.cssText='font-size:21px;margin:0 0 14px;color:#e7c56e';
      const x=document.createElement('button');x.type='button';x.textContent='×';x.style.cssText='background:#292a31;color:#fff;border:0;border-radius:10px;width:36px;height:36px;font-size:24px;margin-bottom:12px';top.append(h,x);
      const p=document.createElement('div');p.innerHTML=body;p.style.cssText='font-size:14px;line-height:1.55;color:#d4d4d8;margin-bottom:18px';
      const form=document.createElement('form');form.append(top,p);const inputs=[];
      fields.forEach(f=>{const label=document.createElement('label');label.textContent=f.label;label.style.cssText='display:block;font-size:13px;color:#ddd;margin:12px 0 6px';const input=document.createElement('input');Object.assign(input,{type:f.type||'text',value:f.value||'',min:f.min||'',step:f.step||'1',required:f.required!==false});input.style.cssText='box-sizing:border-box;width:100%;padding:13px 12px;border:1px solid #565761;border-radius:12px;background:#22232a;color:#fff;font-size:17px';label.append(input);form.append(label);inputs.push(input)});
      const actions=document.createElement('div');actions.style.cssText='display:flex;gap:10px;margin-top:22px';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancelar';cancel.style.cssText='flex:1;padding:13px;border:1px solid #565761;border-radius:12px;background:#292a31;color:#eee;font-weight:600';const ok=document.createElement('button');ok.type='submit';ok.textContent=confirmText;ok.style.cssText='flex:1;padding:13px;border:0;border-radius:12px;background:'+(danger?'#9c3b32':'#d7b455')+';color:#171717;font-weight:800';actions.append(cancel,ok);form.append(actions);card.append(form);shade.append(card);document.body.append(shade);
      const done=v=>{shade.remove();resolve(v)};cancel.onclick=x.onclick=()=>done(null);shade.onclick=e=>{if(e.target===shade)done(null)};form.onsubmit=e=>{e.preventDefault();if(inputs.some(i=>!i.reportValidity()))return;done(inputs.map(i=>i.value))};if(inputs[0])inputs[0].focus();
    });
  }
  async function closePreviousDay(){
    if(typeof isAdmin==='function'&&!isAdmin()){alert('Solo el dueño o administrador puede cerrar una jornada anterior.');return}
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
    const picked=await lateModal({title:'Cerrar jornada anterior',body:'Selecciona la fecha pendiente. El cierre conservará la fecha de la jornada y la hora real en que lo registres.',fields:[{label:'Fecha de la jornada',type:'date',value:localDateString(yesterday),min:'2020-01-01'}],confirmText:'Consultar jornada'});
    if(!picked)return;const day=picked[0];
    if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day)||day>=localDateString(new Date())){alert('Selecciona una fecha anterior a hoy.');return}
    const existing=(Array.isArray(window.cashClosures)?window.cashClosures:[]).filter(x=>x&&x.day===day&&x.type!=='apertura'&&(typeof cashOwns!=='function'||cashOwns(x)));
    if(existing.length){alert('Esta jornada ya tiene un cierre registrado. No se creará otro para evitar duplicados.');return}
    const openings=(Array.isArray(window.cashClosures)?window.cashClosures:[]).filter(x=>x&&x.day===day&&x.type==='apertura'&&(typeof cashOwns!=='function'||cashOwns(x))).sort((a,b)=>new Date(a.date||0)-new Date(b.date||0));
    // Una jornada puede comenzar legítimamente con base $0. Si no existe apertura guardada,
    // se permite el cierre atrasado con base cero y el inicio de la jornada como referencia.
    const openingRecord=openings.length?openings[openings.length-1]:{
      id:'late-zero-'+day,day,opening:0,date:new Date(day+'T00:00:00').toISOString(),
      sessionId:'late-zero-'+day, userKey:typeof cashUserKey==='function'?cashUserKey():''
    };
    let sales=[];
    try{
      if(typeof spGetCashSales==='function')sales=await spGetCashSales(day);
      else if(typeof salesForDay==='function')sales=salesForDay(day);
      if(!Array.isArray(sales))sales=[];
    }catch(e){alert('No se pudieron consultar las ventas de esa jornada. No se registró ningún cierre.');return}
    const closeAt=new Date(openingRecord.date||0).getTime();
    sales=sales.filter(x=>String(x.paymentStatus||x.payment_status||'').toLowerCase()==='pagado'||(!x.paymentStatus&&!x.payment_status))
      .filter(x=>localDateString(new Date(x.date||x.created||x.sold_at||0))===day)
      .filter(x=>new Date(x.date||x.created||x.sold_at||0).getTime()>closeAt);
    const userKey=typeof cashUserKey==='function'?cashUserKey():'';
    const own=sales.filter(x=>x.sold_by&&String(x.sold_by_username||'').trim().toLowerCase()===String(userKey).toLowerCase());
    if(sales.some(x=>!x.sold_by)){alert('Hay ventas sin usuario asignado en esa jornada. Primero verifica la atribución en el historial; no se hará el cierre para evitar un efectivo esperado incorrecto.');return}
    const cashSales=own.filter(x=>String(x.pay||x.payment_method||'').trim().toLowerCase()==='efectivo').reduce((a,x)=>a+Number(x.total||0),0);
    let expenses=[];
    try{if(typeof spGetCashExpenses==='function')expenses=await spGetCashExpenses(day)}catch(e){alert('No se pudieron consultar los gastos de la jornada. No se registró ningún cierre.');return}
    expenses=(Array.isArray(expenses)?expenses:[]).filter(x=>String(x.expense_date||'').slice(0,10)===day||localDateString(new Date(x.created_at||x.createdAt||x.date||0))===day)
      .filter(x=>new Date(x.created_at||x.createdAt||x.date||0).getTime()>closeAt);
    const cashExpenses=expenses.filter(x=>String(x.payment_method||'').trim().toLowerCase()==='efectivo').reduce((a,x)=>a+Number(x.amount||0),0);
    const expected=Number(openingRecord.opening||0)+cashSales-cashExpenses;
    const countedInput=await lateModal({title:'Resumen de jornada · '+day,body:'<div style="display:grid;gap:10px"><div style="display:flex;justify-content:space-between"><span>Base inicial</span><strong>'+moneyLate(openingRecord.opening)+'</strong></div><div style="display:flex;justify-content:space-between"><span>Ventas en efectivo</span><strong>'+moneyLate(cashSales)+'</strong></div><div style="display:flex;justify-content:space-between"><span>Gastos en efectivo</span><strong style="color:#f0a09a">− '+moneyLate(cashExpenses)+'</strong></div><div style="border-top:1px solid #555;padding-top:12px;display:flex;justify-content:space-between;font-size:17px"><strong>Efectivo esperado</strong><strong style="color:#e7c56e">'+moneyLate(expected)+'</strong></div></div><p style="margin-top:14px">Verifica los valores antes de continuar. La caja de hoy no se modificará.</p>',fields:[{label:'Efectivo contado físicamente (COP)',type:'number',min:'0',step:'1',placeholder:'Ej. 500000'}],confirmText:'Revisar cierre'});
    if(!countedInput)return;const answer=countedInput[0];
    if(answer.trim()===''||!Number.isFinite(Number(answer))||Number(answer)<0){alert('El efectivo contado no es válido. No se registró el cierre.');return}
    const diff=Number(answer)-expected;
    const confirmed=await lateModal({title:'Confirmar cierre',body:'<p>Jornada: <strong>'+day+'</strong></p><p>Efectivo esperado: <strong>'+moneyLate(expected)+'</strong><br>Efectivo contado: <strong>'+moneyLate(answer)+'</strong><br>Diferencia: <strong style="color:'+(diff===0?'#8bd5a5':'#f0a09a')+'">'+moneyLate(diff)+'</strong></p><p>Se guardará la hora real de cierre. ¿Confirmas estos datos?</p>',confirmText:'Confirmar cierre',danger:true});
    if(!confirmed)return;
    const now=new Date().toISOString();
    const rec={id:Date.now(),day,date:now,expected,counted:Number(answer),difference:Number(answer)-expected,reason:'Cierre atrasado realizado después de medianoche',user:currentUser?.name||'Administrador',status:'aprobado',approvedBy:currentUser?.name||'Administrador',approvedAt:now,lateClose:true,userKey,sessionId:openingRecord.sessionId||('cash-'+userKey+'-'+openingRecord.id)};
    window.cashClosures.unshift(rec);window.cashClosures=window.cashClosures.slice(0,365);
    if(typeof auditLog==='function')auditLog('Cierre atrasado de caja','Jornada '+day+' · Registrado '+new Date(now).toLocaleString('es-CO')+' · Diferencia '+moneyLate(rec.difference));
    if(typeof save==='function')save();
    alert('Cierre atrasado registrado para '+day+'. La caja de hoy no se modificó.');
    if(typeof adminCash==='function')adminCash();
  }
  function addButton(){
    const panel=document.getElementById('panel');
    if(!panel||!panel.innerHTML.includes('Caja del día')||panel.querySelector('#spLateCloseButton'))return;
    const target=panel.querySelector('.cashHero');
    if(!target)return;
    const b=document.createElement('button');b.id='spLateCloseButton';b.className='mini';b.type='button';b.textContent='🗓️ Cerrar jornada anterior';b.style.marginTop='8px';b.addEventListener('click',closePreviousDay);target.appendChild(b);
  }
  function install(){
    if(typeof window.adminCash==='function'&&!window.adminCash.__spLateCloseWrapped){
      const original=window.adminCash;
      const wrapped=async function(){const result=await original.apply(this,arguments);setTimeout(addButton,0);return result};
      wrapped.__spLateCloseWrapped=true;window.adminCash=wrapped;
    }
    setTimeout(addButton,0);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));else install();
  setTimeout(install,700);
})();
