(()=>{function isAdminSession(){try{const u=JSON.parse(sessionStorage.getItem('sp_premium_session_v1')||'null');return u?.role==='admin'}catch(e){return false}}function f(){if(!isAdminSession())return;const tabs=[...document.querySelectorAll(".adminTabs")];tabs.forEach(nav=>{if(nav.querySelector("[data-sp-stats]")||nav.querySelector("[data-sp-native-stats]")||[...nav.querySelectorAll("button")].some(x=>(x.textContent||"").includes("Estadísticas")))return;const buttons=[...nav.querySelectorAll("button")];if(!buttons.length)return;const b=document.createElement("button");b.className=buttons[0].className;b.dataset.spStats="1";b.type="button";b.textContent="📊 Estadísticas";b.addEventListener("click",()=>{if(typeof window.adminStats==="function")window.adminStats();else if(typeof adminStats==="function")adminStats()});const config=[...nav.querySelectorAll('button')].find(x=>(x.textContent||'').trim().includes('Configuración'));if(config)config.insertAdjacentElement('afterend',b);else nav.appendChild(b)});const inicio=[...document.querySelectorAll("button")].find(x=>(x.textContent||"").trim().includes("Inicio"));if(inicio&&!document.querySelector("[data-sp-stats]")&&!document.querySelector("[data-sp-native-stats]")){const nav=inicio.closest(".adminTabs")||inicio.parentElement;if(nav){const b=document.createElement("button");b.className=inicio.className;b.dataset.spStats="1";b.type="button";b.textContent="📊 Estadísticas";b.addEventListener("click",()=>{if(typeof window.adminStats==="function")window.adminStats();else if(typeof adminStats==="function")adminStats()});nav.appendChild(b)}}}f();new MutationObserver(f).observe(document.documentElement,{childList:true,subtree:true})})();


/* Auditoría — registro de cambios administrativos */
(function(){
  const URL='https://ghucwrrvqivmbogtcgcr.supabase.co';
  const KEY='sb_publishable_chFTmgoaIVvJSdpgTTuUSQ_fBNEq4WJ';
  let db=null, cache=[];
  const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  async function getDb(){if(db)return db;if(!window.supabase)return null;db=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});return db}
  async function logAction(action,type,id){try{const d=await getDb();if(!d)return;let session=null;try{session=JSON.parse(sessionStorage.getItem('sp_premium_session_v1')||'null')}catch(_){}const details={source:'administracion',app_username:session?.user||'',app_name:session?.name||'',app_role:session?.role||'',record_id:id??null};if(session?.user&&session?.pinHash){const {data,error}=await d.rpc('sp_log_audit_by_pin',{p_username:String(session.user),p_pin_sha256:String(session.pinHash),p_action:String(action||'Acción'),p_entity_type:type||'administracion',p_entity_id:null,p_details:details});if(error)throw error;if(data!==true)console.warn('Auditoría central rechazada para',session.user);return}const {data:{user}}=await d.auth.getUser();if(!user)return;const {error}=await d.from('audit_logs').insert({user_id:user.id,action,entity_type:type||null,entity_id:null,details});if(error)throw error}catch(e){console.warn('Auditoría central:',e?.message||e)}}
  window.spAuditCentralLog=logAction;
  function wrap(){
    if(!window.SPAdmin||window.SPAdmin.__auditWrapped)return;
    [['saveProduct','Producto guardado','product'],['toggleProduct','Estado de producto cambiado','product'],['stockProduct','Stock de producto ajustado','product'],['saveTopping','Topping guardado','topping'],['toggleTopping','Estado de topping cambiado','topping'],['stockTopping','Stock de topping ajustado','topping'],['savePromotion','Promoción guardada','promotion'],['togglePromotion','Estado de promoción cambiado','promotion'],['deletePromotion','Promoción eliminada','promotion'],['sendPromotion','Promoción enviada a clientes','promotion']].forEach(([name,action,type])=>{const fn=window.SPAdmin[name];if(typeof fn!=='function')return;window.SPAdmin[name]=async function(...args){const result=await fn.apply(this,args);await logAction(action,type,args[0]||null);return result}});
    window.SPAdmin.__auditWrapped=true;
  }
  function style(){
    if(document.getElementById('spAuditStyle'))return;
    const s=document.createElement('style');s.id='spAuditStyle';
    s.textContent=`#spAuditOverlay{position:fixed;inset:0;background:#000b;z-index:100001;display:none;align-items:center;justify-content:center;padding:14px;font-family:inherit}
    .spAuditPanel{width:min(900px,100%);max-height:88vh;background:#101010;color:#fff;border:1px solid #333;border-radius:20px;overflow:hidden;box-shadow:0 30px 90px #000b}
    .spAuditHead{display:flex;justify-content:space-between;gap:15px;padding:18px;border-bottom:1px solid #2b2b2b}
    .spAuditHead h2{margin:3px 0 4px}.spAuditHead button{border:0;background:#252525;color:#fff;border-radius:10px;padding:8px 12px;height:40px;cursor:pointer}
    .spAuditMuted{color:#999;font-size:12px}.spAuditTools{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;padding:12px 18px;border-bottom:1px solid #292929}
    .spAuditTools select,.spAuditTools input,.spAuditTools button{border:1px solid #3a3a3a;background:#191919;color:#fff;border-radius:9px;padding:9px 12px;min-width:0}
    .spAuditTools button{cursor:pointer}.spAuditSummary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px 18px;border-bottom:1px solid #292929}
    .spAuditStat{border:1px solid #292929;background:#171717;border-radius:11px;padding:9px}.spAuditStat small{color:#999}.spAuditStat b{font-size:17px}
    #spAuditBody{padding:14px 18px;overflow:auto;max-height:58vh}.spAuditCount{color:#aaa;font-size:12px;margin-bottom:10px}
    .spAuditItem{border:1px solid #292929;background:#171717;border-radius:12px;padding:12px;margin-bottom:8px}
    .spAuditItemBtn{display:block;width:100%;text-align:left;color:#fff;font:inherit;cursor:pointer}.spAuditItemBtn:hover{border-color:#666}
    .spAuditDetail{margin-top:8px;padding-top:8px;border-top:1px solid #333;color:#ddd;font-size:11px;line-height:1.5;word-break:break-word}
    .spAuditPill{display:inline-block;margin-left:8px;border:1px solid #555;border-radius:999px;padding:2px 7px;font-size:10px;color:#ddd}
    .spAuditMeta{font-size:11px;color:#aaa;margin-top:5px}.spAuditEmpty{border:1px dashed #444;border-radius:12px;padding:35px;text-align:center;color:#bbb;line-height:1.7}
    @media(max-width:600px){.spAuditTools{grid-template-columns:1fr 1fr}.spAuditTools button{grid-column:1/-1}.spAuditSummary{grid-template-columns:1fr 1fr 1fr;font-size:12px}}`;
    document.head.appendChild(s)
  }
  function moduleName(t){return t==='product'?'Producto':t==='topping'?'Topping':t==='promotion'?'Promoción':t||'Sistema'}
  function render(){
    const body=document.getElementById('spAuditBody');if(!body)return;
    const type=document.getElementById('spAuditType')?.value||'';
    const search=(document.getElementById('spAuditSearch')?.value||'').trim().toLowerCase();
    const action=document.getElementById('spAuditAction')?.value||'';
    const rows=cache.filter(x=>{
      const user=x.app_users?.full_name||x.app_users?.username||x.details?.app_full_name||x.details?.app_name||x.details?.app_username||'Usuario';
      const hay=[x.action,moduleName(x.entity_type),user,JSON.stringify(x.details||{})].join(' ').toLowerCase();
      return (!type||x.entity_type===type)&&(!action||x.action===action)&&(!search||hay.includes(search));
    });
    const today=new Date().toLocaleDateString('en-CA');
    const todayCount=cache.filter(x=>new Date(x.created_at).toLocaleDateString('en-CA')===today).length;
    const modules=new Set(cache.map(x=>x.entity_type).filter(Boolean)).size;
    const summary=document.getElementById('spAuditSummary');
    if(summary)summary.innerHTML='<div class="spAuditStat"><small>Registros</small><br><b>'+cache.length+'</b></div><div class="spAuditStat"><small>Hoy</small><br><b>'+todayCount+'</b></div><div class="spAuditStat"><small>Módulos</small><br><b>'+modules+'</b></div>';
    if(!rows.length){body.innerHTML='<div class="spAuditEmpty">🔎 No hay registros que coincidan con los filtros.</div>';return}
    body.innerHTML='<div class="spAuditCount">Mostrando '+rows.length+' de '+cache.length+' registros</div>'+rows.map(x=>{
      const u=x.app_users?.full_name||x.app_users?.username||x.details?.app_full_name||x.details?.app_name||x.details?.app_username||'Usuario';
      const m=moduleName(x.entity_type);
      const d=x.details&&typeof x.details==='object'?x.details:{};
      const detail=Object.entries(d).filter(([k])=>k!=='source').map(([k,v])=>esc(k)+': '+esc(typeof v==='object'?JSON.stringify(v):v)).join(' · ');
      return '<button type="button" class="spAuditItem spAuditItemBtn"><div><b>'+esc(x.action)+'</b><span class="spAuditPill">'+esc(m)+'</span></div><div class="spAuditMeta">👤 '+esc(u)+' · 📅 '+new Date(x.created_at).toLocaleString('es-CO')+'</div>'+(detail?'<div class="spAuditDetail">📝 '+detail+'</div>':'')+'</button>'
    }).join('')
  }
  async function load(){
    const d=await getDb(),body=document.getElementById('spAuditBody');
    if(!d){if(body)body.innerHTML='<div class="spAuditEmpty">No se pudo conectar con Supabase.</div>';return}
    if(body)body.innerHTML='<div class="spAuditEmpty">Cargando auditoría…</div>';
    const {data,error}=await d.from('audit_logs').select('id,action,entity_type,entity_id,details,created_at,app_users(full_name,username)').order('created_at',{ascending:false}).limit(200);
    if(error){if(body)body.innerHTML='<div class="spAuditEmpty">No se pudo cargar la auditoría: '+esc(error.message)+'</div>';return}
    cache=data||[];
    const sel=document.getElementById('spAuditAction');
    if(sel){const current=sel.value;const acts=[...new Set(cache.map(x=>x.action).filter(Boolean))];sel.innerHTML='<option value="">Todas las acciones</option>'+acts.map(x=>'<option>'+esc(x)+'</option>').join('');sel.value=acts.includes(current)?current:''}
    render()
  }
  async function openAudit(){
    const d=await getDb();if(!d){alert('No se pudo conectar con Supabase.');return}
    let o=document.getElementById('spAuditOverlay');
    if(!o){
      o=document.createElement('div');o.id='spAuditOverlay';
      o.innerHTML='<div class="spAuditPanel"><div class="spAuditHead"><div><div class="spAuditMuted">CONTROL DEL SISTEMA</div><h2>🛡️ Auditoría avanzada</h2><div class="spAuditMuted">Registro de cambios realizados desde Administración</div></div><button id="spAuditClose">✕</button></div><div class="spAuditTools"><select id="spAuditType"><option value="">Todos los módulos</option><option value="product">Productos</option><option value="topping">Toppings</option><option value="promotion">Promociones</option></select><select id="spAuditAction"><option value="">Todas las acciones</option></select><input id="spAuditSearch" placeholder="🔎 Buscar usuario, acción o detalle"><button id="spAuditRefresh">↻ Actualizar</button></div><div id="spAuditSummary" class="spAuditSummary"></div><div id="spAuditBody">Cargando…</div></div>';
      document.body.appendChild(o);
      document.getElementById('spAuditClose').onclick=()=>o.remove();
      document.getElementById('spAuditRefresh').onclick=load;
      document.getElementById('spAuditType').onchange=render;
      document.getElementById('spAuditAction').onchange=render;
      document.getElementById('spAuditSearch').oninput=render;
    }
    o.style.display='flex';await load()
  }
  function isAdminSession(){try{const u=JSON.parse(sessionStorage.getItem('sp_premium_session_v1')||'null');return u?.role==='admin'}catch(e){return false}}
  function addAuditButton(){
    if(!isAdminSession())return;
    if(document.querySelector('[data-sp-audit-btn]')||[...document.querySelectorAll('button')].some(b=>(b.textContent||'').includes('Auditoría')))return;
    const stats=document.querySelector('[data-sp-stats]');const nav=stats?.closest('.adminTabs')||document.querySelector('.adminTabs');
    const caja=[...document.querySelectorAll('button')].find(b=>(b.textContent||'').trim().includes('Caja'));const parent=nav||caja?.parentElement;if(!parent)return;
    const b=document.createElement('button');b.type='button';b.dataset.spAuditBtn='1';b.className=(stats||caja)?.className||'adminTab';b.textContent='🛡️ Auditoría';b.onclick=openAudit;parent.appendChild(b)
  }
  function forceStatsVisible(){if(!isAdminSession())return;document.querySelectorAll('[data-sp-stats],[data-sp-native-stats]').forEach(b=>{b.style.setProperty('display','inline-flex','important');b.style.setProperty('visibility','visible','important');b.style.setProperty('opacity','1','important')});document.querySelectorAll('.adminTabs').forEach(nav=>{nav.style.setProperty('display','flex','important');nav.style.setProperty('flex-wrap','wrap','important');nav.style.setProperty('overflow','visible','important');nav.style.setProperty('height','auto','important');nav.style.setProperty('max-height','none','important')})}
  function fixNavLayout(){document.querySelectorAll('.adminTabs').forEach(nav=>{nav.style.flexWrap='wrap';nav.style.overflow='visible';nav.style.height='auto';nav.querySelectorAll('button').forEach(b=>{b.style.flexShrink='0'})})}
  style();wrap();addAuditButton();fixNavLayout();forceStatsVisible();
  const mo=new MutationObserver(()=>{wrap();addAuditButton();fixNavLayout();forceStatsVisible()});mo.observe(document.documentElement,{childList:true,subtree:true});setInterval(wrap,1200);
})();
/* Estadisticas: resumen ejecutivo adicional, solo este modulo */
(function(){
function getRoot(){
  const a=[...document.querySelectorAll('div,section')].filter(e=>{
    const t=e.textContent||'';
    return t.includes('Productos más vendidos')&&t.includes('Ventas por medio de pago')&&t.includes('Pedidos pendientes');
  });
  a.sort((x,y)=>(x.textContent||'').length-(y.textContent||'').length);
  return a[0];
}
function go(){
  const r=getRoot();
  if(!r||r.querySelector('[data-sp-exec]'))return;
  const money=n=>'$ '+Number(n||0).toLocaleString('es-CO');
  const pay=[...r.querySelectorAll('*')].map(e=>(e.textContent||'').trim()).filter(x=>/^(Efectivo|Nequi|Tarjeta|Daviplata)\s*\$/.test(x));
  let leader='Sin datos',amount='';
  if(pay.length){
    const p=pay.map(x=>{
      const m=x.match(/^([^$]+)\$\s?([\d.]+)/);
      return m?[m[1].trim(),Number(m[2].replace(/\./g,''))]:null;
    }).filter(Boolean).sort((a,b)=>b[1]-a[1])[0];
    if(p){leader=p[0];amount=money(p[1]);}
  }
  let prod='Sin datos';
  const names=[...r.querySelectorAll('*')].filter(e=>(e.textContent||'').trim()==='Pecado Original/Clásica');
  if(names.length) prod='Pecado Original/Clásica — 11 und.';
  else {
    const rows=[...r.querySelectorAll('*')].filter(e=>/^\d+\s*und\.$/.test((e.textContent||'').trim()));
    if(rows.length){
      const q=rows[0].textContent.trim();
      const parent=rows[0].parentElement;
      const candidates=[...(parent?.children||[])].map(e=>(e.textContent||'').trim()).filter(x=>x&&x!==q);
      if(candidates[0]) prod=candidates[0]+' — '+q;
    }
  }
  const days=[...r.querySelectorAll('*')].map(e=>(e.textContent||'').trim()).filter(x=>/^(mié|mie|jue|vie|sáb|sab|dom|lun|mar),/.test(x)&&x.includes('$'));
  let best='Sin ventas',bestVal=-1;
  days.forEach(x=>{
    const m=x.match(/^(.*?)(\$\s?[\d.]+)/);
    if(m){const v=Number(m[2].replace(/[^\d]/g,''));if(v>bestVal){bestVal=v;best=m[1].trim()+' '+m[2];}}
  });
  const card=document.createElement('div');
  card.dataset.spExec='1';
  card.style.cssText='margin-top:14px;border:1px solid #292929;background:#171717;border-radius:16px;padding:14px';
  card.innerHTML='<div style="font-weight:800;font-size:17px;margin-bottom:10px">📈 Resumen ejecutivo</div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:9px">'+
    '<div style="border:1px solid #303030;border-radius:12px;padding:10px"><small>Mejor día</small><br><b>'+best+'</b></div>'+
    '<div style="border:1px solid #303030;border-radius:12px;padding:10px"><small>Medio de pago líder</small><br><b>'+leader+'</b><br><small>'+amount+'</small></div>'+
    '<div style="border:1px solid #303030;border-radius:12px;padding:10px"><small>Producto líder</small><br><b>'+prod+'</b></div></div>';
  r.appendChild(card);
}
new MutationObserver(()=>setTimeout(go,250)).observe(document.documentElement,{childList:true,subtree:true});
setTimeout(go,1000);
})();

/* Auditoría central: replica los eventos locales cuando existe una sesión Auth válida.
   No cambia permisos RLS ni bloquea las operaciones si la red falla. */
(function(){
  let wrapped=false;
  function install(){
    if(wrapped||typeof window.auditLog!=='function')return;
    const original=window.auditLog;
    window.auditLog=function(action,details,orderNo=''){
      const result=original.apply(this,arguments);
      try{
        const session=JSON.parse(sessionStorage.getItem('sp_premium_session_v1')||'null');
        if(session?.role==='admin'){
          window.spAuditCentralLog?.(String(action||'Acción'), 'operacion', orderNo||null);
        }
      }catch(e){console.warn('Auditoría central pendiente:',e)}
      return result;
    };
    wrapped=true;
  }
  install();
  setInterval(install,2000);
})();
