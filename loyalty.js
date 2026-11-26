/* EL PECADO SE PREMIA · módulo independiente para Santo Pecado 17-29 */
(function(){
  'use strict';
  const DB=()=>window.SantoPecadoCentral;
  const SITE='https://santopecado17-29.com';
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(n)||0);
  const cardUrl=token=>SITE+'/fidelizacion.html?token='+encodeURIComponent(token);
  const qrUrl=url=>'https://api.qrserver.com/v1/create-qr-code/?size=190x190&margin=8&data='+encodeURIComponent(url);
  const seen=new Set();
  const preparedCards=new Map();

  function readOrders(){try{const a=JSON.parse(localStorage.getItem('sp_premium_orders_v2')||'[]');return Array.isArray(a)?a:[]}catch(_){return[]}}
  function saveOrders(a){try{localStorage.setItem('sp_premium_orders_v2',JSON.stringify(a))}catch(e){console.warn('Fidelización: no se pudo guardar el enlace local',e)}}

  function cardMarkup(card,orderNo){
    const count=Math.max(0,Math.min(10,Number(card.stamps_count)||0));
    const circles=Array.from({length:10},(_,i)=>'<span class="sp-loyalty-stamp '+(i<count?'filled':'')+'">'+(i<count?'✓':(i+1))+'</span>').join('');
    const url=cardUrl(card.card_token);
    const expires=card.expires_at?new Date(card.expires_at).toLocaleDateString('es-CO'):'Se activa al validar tu primera compra';
    return '<section class="sp-loyalty-ticket" style="margin:16px 0;padding:16px;border:1px solid #8d6b25;border-radius:18px;background:linear-gradient(145deg,#17130b,#101010);color:#fff;text-align:center">'
      +'<div style="font-size:11px;letter-spacing:2px;color:#ffd66d;font-weight:900">EL PECADO SE PREMIA</div>'
      +'<div style="font-size:21px;font-weight:950;margin:7px 0">Tu tarjeta digital</div>'
      +'<div style="font-size:13px;color:#ddd">Pedido '+esc(orderNo)+' · '+count+'/10 sellos</div>'
      +'<div class="sp-loyalty-stamps" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;max-width:310px;margin:14px auto">'+circles+'</div>'
      +'<div style="font-size:11px;color:#c9bd9b;margin:8px 0">Vence: '+esc(expires)+'</div>'
      +'<img alt="Código QR de tu tarjeta" width="132" height="132" style="display:block;margin:12px auto;background:#fff;padding:6px;border-radius:12px" src="'+qrUrl(url)+'">'
      +'<div style="font-size:12px;color:#eee;margin:7px 0">Escanea el QR para consultar tus sellos y premios</div>'
      +'<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px">'
      +'<button type="button" class="primary" data-sp-loyalty-open="'+esc(url)+'">Ver mi tarjeta</button>'
      +'<button type="button" class="secondary" data-sp-loyalty-print="'+esc(url)+'" data-sp-loyalty-count="'+count+'" data-sp-loyalty-exp="'+esc(card.expires_at||'')+'">Imprimir tarjeta</button>'
      +'</div><div style="font-size:10px;color:#a9a9a9;margin-top:10px">El sello se acredita cuando el pedido esté entregado y pagado. Solo aplican pedidos hechos por esta página que incluyan comida.</div>'
      +'</section>';
  }

  async function prepareOrder(orderId,phone,orderNo){
    if(!orderId||!phone||!DB()?.connected)return null;
    const {data,error}=await DB().rpc('sp_loyalty_register_order',{p_order_id:orderId,p_customer_phone:String(phone)});
    if(error)throw error;
    const card=Array.isArray(data)?data[0]:data;
    if(card&&card.card_token)preparedCards.set(String(orderNo),card);
    return card||null;
  }

  async function attachCard(){
    const panel=document.getElementById('panel');
    if(!panel)return;
    const heading=panel.querySelector('.panelHead h2');
    if(!heading||!heading.textContent.includes('Pedido enviado'))return;
    const match=(panel.innerText||'').match(/SP-\d{6}/);
    if(!match)return;
    const orderNo=match[0];
    if(seen.has(orderNo)||panel.querySelector('.sp-loyalty-ticket'))return;
    seen.add(orderNo);
    const order=readOrders().find(x=>String(x.no)===orderNo);
    const orderId=window.__lastCentralOrderId||order?.centralId;
    if(!order||!orderId||!DB()?.connected)return;
    try{
      const card=preparedCards.get(String(orderNo))||await prepareOrder(orderId,String(order.phone||''),orderNo);
      if(!card||!card.card_token)return;
      const orders=readOrders();
      const saved=orders.find(x=>String(x.no)===orderNo);
      if(saved){saved.loyaltyToken=card.card_token;saved.loyaltyUrl=cardUrl(card.card_token);saved.loyaltyCardId=card.card_id;saveOrders(orders)}
      const box=document.createElement('div');
      box.innerHTML=cardMarkup(card,orderNo);
      const ticket=box.firstElementChild;
      const buttons=ticket.querySelectorAll('[data-sp-loyalty-open],[data-sp-loyalty-print]');
      buttons.forEach(button=>button.addEventListener('click',()=>{
        if(button.hasAttribute('data-sp-loyalty-open'))window.open(button.getAttribute('data-sp-loyalty-open'),'_blank','noopener');
        else printCard(button.getAttribute('data-sp-loyalty-print'),Number(button.getAttribute('data-sp-loyalty-count')||0),button.getAttribute('data-sp-loyalty-exp')||'');
      }));
      const actions=panel.querySelector('.modalBtns');
      if(actions)panel.insertBefore(ticket,actions);else panel.appendChild(ticket);
    }catch(e){console.warn('No se pudo preparar la tarjeta de fidelización:',e?.message||e)}
  }

  function printCard(url,count,expires){
    const w=window.open('','_blank','width=420,height=650');
    if(!w){alert('Permite ventanas emergentes para imprimir la tarjeta.');return}
    const qr=qrUrl(url);
    const date=expires?new Date(expires).toLocaleDateString('es-CO'):'Se activa al validar tu primera compra';
    const dots=Array.from({length:10},(_,i)=>'<span style="display:inline-grid;place-items:center;width:11mm;height:11mm;margin:1.2mm;border:1px solid #222;border-radius:50%;font-size:11px;font-weight:bold;background:'+(i<count?'#f5c64b':'#fff')+'">'+(i<count?'✓':i+1)+'</span>').join('');
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>EL PECADO SE PREMIA</title><style>@page{size:80mm auto;margin:0}*{box-sizing:border-box}body{width:80mm;margin:0 auto;padding:5mm;font:12px Arial;color:#111;text-align:center}.brand{font-size:18px;font-weight:900}.gold{color:#8a6415;font-weight:900;letter-spacing:2px}.dots{margin:5mm auto;max-width:70mm}.qr{width:37mm;height:37mm;margin:4mm auto}.muted{font-size:10px;line-height:1.5}</style></head><body><div class="gold">SANTO PECADO 17-29</div><div class="brand">EL PECADO SE PREMIA</div><p>Tu tarjeta digital de fidelización</p><b>'+count+'/10 sellos</b><div class="dots">'+dots+'</div><img class="qr" src="'+qr+'"><div class="muted">Escanea este código para consultar tu tarjeta.<br>Vigencia de la tarjeta: 30 días desde el primer sello.<br>Vencimiento: '+esc(date)+'</div><p class="muted">Solo pedidos realizados por nuestra página web.</p></body></html>');
    w.document.close();setTimeout(()=>{try{w.focus();w.print()}catch(e){}},450);
  }

  async function sha256(value){
    const bytes=new TextEncoder().encode(String(value||''));
    const hash=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function adminCredentials(){
    let s={};try{s=JSON.parse(sessionStorage.getItem('sp_premium_session_v1')||'{}')}catch(_){}
    if(s.role!=='admin')throw new Error('Solo el dueño o administrador puede consultar fidelización.');
    const username=String(s.user||s.username||'').trim();
    let pinHash=String(s.pinHash||'').trim();
    if(!pinHash&&s.pin)pinHash=await sha256(s.pin);
    if(!pinHash){
      const pin=prompt('Confirma el PIN del administrador para consultar fidelización:');
      if(pin===null)throw new Error('Consulta cancelada.');
      pinHash=await sha256(pin);
    }
    if(!username||!pinHash)throw new Error('No se pudieron validar las credenciales.');
    return {p_username:username,p_pin_sha256:pinHash};
  }

  async function adminLoyalty(){
    if(typeof window.isAdmin==='function'&&!window.isAdmin()){alert('Solo el administrador puede consultar fidelización.');return}
    const panel=document.getElementById('panel');
    if(!panel)return;
    panel.innerHTML='<div class="panelHead"><h2>🎟️ EL PECADO SE PREMIA</h2><button class="close" onclick="adminDashboard()">✕</button></div><div class="notice">Cargando tarjetas, clientes y premios...</div>';
    document.getElementById('modal')?.classList.add('open');
    try{
      const creds=await adminCredentials();
      const {data,error}=await DB().rpc('sp_loyalty_admin_summary',creds);
      if(error)throw error;
      const result=Array.isArray(data)?data[0]:data;
      const stats=result?.stats||{},cards=Array.isArray(result?.cards)?result.cards:[];
      panel.innerHTML='<div class="panelHead"><div><div class="dashKicker">FIDELIZACIÓN WEB</div><h2>🎟️ EL PECADO SE PREMIA</h2></div><button class="close" onclick="adminDashboard()">✕</button></div>'
        +(typeof window.navTabs==='function'?window.navTabs('loyalty'):'')
        +'<div class="statgrid dashGrid"><div class="stat"><small>Tarjetas</small><b>'+Number(stats.cards_total||0)+'</b></div><div class="stat"><small>Activas</small><b>'+Number(stats.cards_active||0)+'</b></div><div class="stat"><small>Completadas</small><b>'+Number(stats.cards_completed||0)+'</b></div><div class="stat"><small>Premios pendientes</small><b>'+Number(stats.rewards_pending||0)+'</b></div></div>'
        +'<div class="notice" style="margin:12px 0">Solo se sellan pedidos de la página web que estén entregados y pagados y que contengan comida. Cada pedido genera un sello. Tarjeta: 30 días desde el primer sello. Premio: 30 días para reclamar.</div>'
        +(cards.length?cards.map(c=>'<div class="adminItem"><div class="adminTop"><b>'+esc(c.customer_name||'Cliente')+'</b><b>'+Number(c.stamps_count||0)+'/10 sellos</b></div><div class="muted">'+esc(c.customer_phone||'')+' · '+esc(c.status||'')+'</div><div class="muted">Tarjeta: '+(c.started_at?new Date(c.started_at).toLocaleDateString('es-CO'):'Pendiente de primer sello')+' · Vence: '+(c.expires_at?new Date(c.expires_at).toLocaleDateString('es-CO'):'—')+'</div>'
          +(c.reward_code?'<div style="margin-top:8px;padding:10px;border:1px solid #6b5421;border-radius:10px"><b>Premio: '+esc(c.favorite_product||'Comida favorita')+' + bebida personal</b><div class="muted">Código: '+esc(c.reward_code)+' · Estado: '+esc(c.reward_status||'')+' · Vence: '+(c.reward_expires_at?new Date(c.reward_expires_at).toLocaleDateString('es-CO'):'—')+'</div>'
          +(c.reward_status==='pending'?'<button class="mini" style="margin-top:8px" onclick="spLoyaltyRedeem(\''+esc(c.reward_code)+'\')">Marcar premio como reclamado</button>':'')+'</div>':'')
          +'</div>').join(''):'<div class="empty">Todavía no hay tarjetas de fidelización.</div>')
        +'<div class="modalBtns" style="margin-top:12px"><button class="secondary" onclick="adminLoyalty()">🔄 Actualizar</button><button class="secondary" onclick="adminDashboard()">Volver al panel</button></div>';
    }catch(e){panel.innerHTML='<div class="panelHead"><h2>🎟️ Fidelización</h2><button class="close" onclick="adminDashboard()">✕</button></div><div class="notice" style="background:rgba(255,79,100,.08);border-color:rgba(255,79,100,.3);color:#ffd0d6">'+esc(e.message||e)+'</div><button class="secondary" onclick="adminDashboard()">Volver</button>'}
  }

  async function spLoyaltyRedeem(code){
    try{
      const creds=await adminCredentials();
      const {data,error}=await DB().rpc('sp_loyalty_redeem_reward',{...creds,p_reward_code:code});
      if(error)throw error;
      alert('Premio '+code+' marcado como reclamado correctamente.');
      await adminLoyalty();
    }catch(e){alert(e.message||'No se pudo registrar la reclamación.')}
  }

  function installAdminTab(){
    if(typeof window.navTabs!=='function'||window.navTabs.__spLoyaltyWrapped)return;
    const original=window.navTabs;
    const wrapped=function(active){
      let html=original.apply(this,arguments);
      const marker='onclick="adminAudit()">🛡️ Auditoría</button>';
      if(html.includes(marker))html=html.replace(marker,marker+'<button class="tab '+(active==='loyalty'?'active':'')+'" onclick="adminLoyalty()">🎟️ Fidelización</button>');
      return html;
    };
    wrapped.__spLoyaltyWrapped=true;window.navTabs=wrapped;
  }

  function install(){
    installAdminTab();
    const target=document.getElementById('panel');
    if(target){
      const observer=new MutationObserver(()=>{attachCard()});
      observer.observe(target,{childList:true,subtree:true});
    }
    window.adminLoyalty=adminLoyalty;
    window.spLoyaltyRedeem=spLoyaltyRedeem;
    window.spPrepareLoyaltyOrder=prepareOrder;

  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();