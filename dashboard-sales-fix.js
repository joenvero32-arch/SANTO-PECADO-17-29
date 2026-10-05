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
