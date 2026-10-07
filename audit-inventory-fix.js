(function(){
  const AUDIT='sp_premium_audit_v1';
  const INV='sp_premium_inventory_v1';

  function read(key,fallback){
    try{ const v=JSON.parse(localStorage.getItem(key)||'null'); return v==null?fallback:v; }
    catch(e){ return fallback; }
  }

  function writeAuditFromMovements(){
    try{
      const audit=read(AUDIT,[]);
      const movements=read(INV,[]);
      if(!Array.isArray(audit)||!Array.isArray(movements)) return;
      const seen=new Set(audit.map(x=>[x.date,x.action,x.details].join('|')));
      let added=0;
      movements.forEach(m=>{
        const action=String(m.type||'Movimiento de inventario');
        const details=String(m.product||'Producto')+' · '+(Number(m.qty)>0?'+':'')+Number(m.qty||0)+' '+String(m.unit||'und.')+' · Quedan: '+Number(m.stock||0);
        const key=[m.date,action,details].join('|');
        if(!seen.has(key)){
          audit.push({date:m.date||new Date().toISOString(),action,details,orderNo:'',user:'sistema',name:'Sistema',role:'system'});
          seen.add(key); added++;
        }
      });
      if(added){
        audit.sort((a,b)=>new Date(b.date)-new Date(a.date));
        localStorage.setItem(AUDIT,JSON.stringify(audit.slice(0,1000)));
      }
    }catch(e){ console.warn('Auditoría de inventario:',e); }
  }

  function watchSave(){
    if(typeof window.save!=='function' || window.__spAuditInventoryPatched) return;
    const original=window.save;
    window.save=function(){
      const result=original.apply(this,arguments);
      writeAuditFromMovements();
      return result;
    };
    window.__spAuditInventoryPatched=true;
  }

  function patchAudit(){
    if(typeof window.adminAudit!=='function' || window.__spAuditRenderPatched) return;
    const original=window.adminAudit;
    window.adminAudit=function(){
      writeAuditFromMovements();
      return original.apply(this,arguments);
    };
    window.__spAuditRenderPatched=true;
  }

  writeAuditFromMovements();
  watchSave();
  patchAudit();
  setTimeout(function(){ writeAuditFromMovements(); watchSave(); patchAudit(); },1000);
  setInterval(function(){ watchSave(); patchAudit(); },3000);
})();