/* Santo Pecado 17-29 — Dashboard sales sync only */
(function(){
  const URL='https://ghucwrrvqivmbogtcgcr.supabase.co';
  const KEY='sb_publishable_chFTmgoaIVvJSdpgTTuUSQ_fBNEq4WJ';
  let db=null, running=false;

  function money2(n){return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(n||0))}
  function dayBounds(){
    const f=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const m={}; f.forEach(x=>{if(x.type!=='literal')m[x.type]=x.value});
    const d=m.year+'-'+m.month+'-'+m.day;
    return {start:d+'T00:00:00-05:00',end:new Date(Date.parse(d+'T00:00:00-05:00')+86400000).toISOString()};
  }
  async function getSales(){
    if(!db){
      if(window.SP_DB&&typeof window.SP_DB.from==='function') db=window.SP_DB;
      else{
        if(!window.supabase) await new Promise((resolve,reject)=>{
          const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'; s.onload=resolve; s.onerror=reject; document.head.appendChild(s);
        });
        db=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      }
    }
    const {start,end}=dayBounds();
    const r=await db.from('sales').select('total,payment_method,sold_at').gte('sold_at',start).lt('sold_at',end);
    if(r.error) throw r.error;
    return Array.isArray(r.data)?r.data:[];
  }
  async function refresh(){
    if(running)return; running=true;
    try{
      const sales=await getSales();
      const total=sales.reduce((a,x)=>a+Number(x.total||0),0);
      const pay={}; sales.forEach(x=>{const k=String(x.payment_method||'Sin especificar'); pay[k]=(pay[k]||0)+Number(x.total||0)});
      const panel=document.getElementById('panel');
      if(!panel)return;
      const hero=panel.querySelector('.dashboardHero');
      if(hero){
        const strong=hero.querySelector('strong'), small=hero.querySelector('small');
        if(strong)strong.textContent=money2(total);
        if(small)small.textContent=sales.length+' venta(s) registrada(s)';
      }
      const sections=panel.querySelectorAll('.dashSection');
      const paymentSection=[...sections].find(x=>(x.textContent||'').includes('Ventas por medio de pago'));
      if(paymentSection){
        const head=paymentSection.querySelector('.dashSectionHead');
        [...paymentSection.children].slice(1).forEach(x=>x.remove());
        const entries=Object.entries(pay);
        const html=entries.length?entries.map(([k,v])=>'<div class="barRow"><span>'+String(k).replace(/[&<>]/g,'')+'</span><b>'+money2(v)+'</b><i><em style="width:'+Math.max(4,total?(v/total)*100:0)+'%"></em></i></div>').join(''):'<div class="empty">Todavía no hay ventas hoy.</div>';
        head.insertAdjacentHTML('afterend',html);
      }
    }catch(e){console.warn('Dashboard ventas central:',e)}
    finally{running=false}
  }
  function hook(){
    if(typeof window.adminDashboard!=='function')return setTimeout(hook,500);
    if(window.__spDashboardSalesHook)return;
    const original=window.adminDashboard;
    window.adminDashboard=async function(){
      original();
      await refresh();
    };
    window.__spDashboardSalesHook=true;
  }
  hook();
})();

/* Ventana elegante para solicitar PIN financiero sin usar el aviso nativo del navegador. */
function spAskFinancePin(){
  return new Promise(resolve=>{
    const old=document.getElementById('spFinancePinOverlay'); if(old)old.remove();
    const overlay=document.createElement('div');
    overlay.id='spFinancePinOverlay';
    overlay.innerHTML=`<style>
      #spFinancePinOverlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.78);backdrop-filter:blur(9px);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
      #spFinancePinCard{width:min(440px,100%);border:1px solid rgba(247,185,40,.45);border-radius:24px;padding:25px;background:linear-gradient(145deg,#191713,#090909 72%);color:#fff;box-shadow:0 24px 80px #000b}
      #spFinancePinCard .spPinIcon{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;background:rgba(247,185,40,.13);border:1px solid rgba(247,185,40,.3);font-size:24px;margin-bottom:17px}
      #spFinancePinCard h2{margin:0 0 9px;font-size:22px;letter-spacing:.2px}
      #spFinancePinCard p{margin:0 0 20px;color:#b9b4a8;font-size:14px;line-height:1.55}
      #spFinancePinCard label{display:block;color:#f7c94f;font-size:11px;font-weight:900;letter-spacing:1.5px;margin-bottom:8px}
      #spFinancePinInput{display:block;width:100%;box-sizing:border-box;border:1px solid #51452b;border-radius:13px;background:#080808;color:#fff;padding:15px;font-size:20px;letter-spacing:5px;outline:none}
      #spFinancePinInput:focus{border-color:#f7b928;box-shadow:0 0 0 3px #f7b92820}
      #spFinancePinCard .spPinActions{display:flex;gap:10px;margin-top:21px}
      #spFinancePinCard button{flex:1;border-radius:12px;padding:13px 10px;font-weight:850;font-size:14px;cursor:pointer}
      #spFinancePinCancel{background:#1c1c1c;color:#ddd;border:1px solid #393939}
      #spFinancePinAccept{background:linear-gradient(135deg,#ffe18a,#f7b928);color:#17120a;border:0}
    </style><section id="spFinancePinCard" role="dialog" aria-modal="true" aria-labelledby="spFinancePinTitle">
      <div class="spPinIcon">🔐</div><h2 id="spFinancePinTitle">Verificación del administrador</h2>
      <p>Ingresa tu PIN para consultar Caja y Ventas centrales. Tu PIN no se guardará.</p>
      <form id="spFinancePinForm"><label for="spFinancePinInput">PIN DE ADMINISTRADOR</label><input id="spFinancePinInput" type="password" inputmode="numeric" autocomplete="current-password" placeholder="••••••" required>
      <div class="spPinActions"><button type="button" id="spFinancePinCancel">Cancelar</button><button type="submit" id="spFinancePinAccept">Verificar PIN</button></div></form>
    </section>`;
    document.body.appendChild(overlay);
    const input=overlay.querySelector('#spFinancePinInput'),form=overlay.querySelector('#spFinancePinForm');
    let done=false;
    const finish=value=>{if(done)return;done=true;overlay.remove();document.removeEventListener('keydown',onKey);resolve(value)};
    const onKey=e=>{if(e.key==='Escape')finish(null)};
    overlay.querySelector('#spFinancePinCancel').onclick=()=>finish(null);
    overlay.addEventListener('click',e=>{if(e.target===overlay)finish(null)});
    form.onsubmit=e=>{e.preventDefault();const value=input.value.trim();if(value)finish(value);else input.focus()};
    document.addEventListener('keydown',onKey);
    setTimeout(()=>input.focus(),60);
  });
}

/* Recuperación de credenciales locales para consultas financieras; no confirma pagos ni modifica datos. */
(function(){
  if(window.__spFinanceCredentialRecovery) return;
  window.__spFinanceCredentialRecovery=true;
  const original=window.spGetFinanceOrders;
  if(typeof original!=='function') {
    console.warn('Recuperación financiera: la función original no está disponible.');
    return;
  }
  window.spGetFinanceOrders=async function(){
    try { return await original(); }
    catch(firstError) {
      const msg=String(firstError?.message||firstError||'');
      if(!/no se encontraron las credenciales del administrador/i.test(msg)) throw firstError;
      const active=(typeof currentUser!=='undefined'&&currentUser)?currentUser:null;
      const localUsers=(typeof users!=='undefined'&&Array.isArray(users))?users:[];
      const activeName=String(active?.user||active?.username||'').trim().toLowerCase();
      const storedAdmin=localUsers.find(u=>String(u?.user||u?.username||'').trim().toLowerCase()===activeName&&String(u?.role||'').toLowerCase()==='admin')
        ||localUsers.find(u=>String(u?.role||'').toLowerCase()==='admin');
      const username=String(active?.user||active?.username||storedAdmin?.user||storedAdmin?.username||'').trim();
      if(!username) throw new Error('No se encontró el usuario administrador de la sesión.');
      // Reutiliza el PIN de la sesión administrativa; solo lo solicita si la sesión no conserva el PIN.
      let pin=active?.pin||storedAdmin?.pin||'';
      if(!pin){
        pin=await spAskFinancePin();
        if(pin===null||!String(pin).trim()) throw new Error('Consulta cancelada: no se ingresó el PIN.');
      }
      if(typeof SP_DB==='undefined'||!SP_DB||typeof SP_DB.rpc!=='function') throw new Error('La conexión central de Supabase no está disponible.');
      const result=await SP_DB.rpc('sp_get_admin_orders_pin',{p_username:username,p_pin:String(pin).trim()});
      if(result.error) throw result.error;
      let data=result.data;
      if(typeof data==='string'){try{data=JSON.parse(data)}catch(_){throw new Error('La respuesta de Supabase no tiene un formato válido.');}}
      if(!Array.isArray(data)) throw new Error('Supabase no devolvió una lista válida de pedidos.');
      return data;
    }
  };
})();
