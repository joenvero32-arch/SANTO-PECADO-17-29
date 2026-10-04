/* Santo Pecado 17-29 — Comanda cocina
   Habilita el botón existente y recupera el detalle real desde Supabase
   cuando el pedido central no trae el texto de detalle en localStorage.
   No modifica la interfaz ni los demás botones.
*/
(function(){
  const URL='https://ghucwrrvqivmbogtcgcr.supabase.co';
  const KEY='sb_publishable_chFTmgoaIVvJSdpgTTuUSQ_fBNEq4WJ';
  const CDN='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

  function esc(s){
    return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  async function getDetail(o){
    if(String(o.detail||'').trim()) return String(o.detail);

    try{
      // Usamos la misma función segura que ya alimenta la pantalla Pedidos.
      // Así Comanda cocina recibe exactamente el mismo pedido central.
      let centralId=o.centralId||'';

      // Primero intentamos obtener el pedido central por su número.
      // No dependemos de que localStorage haya guardado centralId.
      if(typeof SP_DB!=='undefined' && SP_DB && typeof SP_DB.rpc==='function'){
        const {data,error}=await SP_DB.rpc('sp_get_admin_orders');
        if(!error){
          const row=(Array.isArray(data)?data:[]).find(x=>String(x.order_number)===String(o.no));
          if(row){
            if(String(row.detail||'').trim()) return String(row.detail);
            centralId=row.id||centralId;
          }
        }else{
          console.warn('sp_get_admin_orders para comanda:',error);
        }
      }

      // Si el RPC no encontró el pedido, lo buscamos directamente por número.
      // Esta consulta respeta la sesión administrativa de Supabase.
      if(!centralId && typeof SP_DB!=='undefined' && SP_DB && typeof SP_DB.from==='function'){
        const {data:order,error:orderError}=await SP_DB
          .from('orders')
          .select('id')
          .eq('order_number',String(o.no))
          .maybeSingle();
        if(!orderError && order?.id) centralId=order.id;
        else if(orderError) console.warn('Búsqueda de pedido central:',orderError);
      }

      if(!centralId) return '';

      if(!window.supabase){
        await new Promise((resolve,reject)=>{
          const sc=document.createElement('script');
          sc.src=CDN;
          sc.onload=resolve;
          sc.onerror=reject;
          document.head.appendChild(sc);
        });
      }

      const db=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      const {data:items,error}=await db
        .from('order_items')
        .select('id,product_name,quantity,notes,unit_price')
        .eq('order_id',centralId)
        .order('created_at');

      if(error) throw error;

      const rows=Array.isArray(items)?items:[];
      const result=[];
      for(const item of rows){
        const qty=Number(item.quantity||1);
        let line=String(item.product_name||'Producto')+(qty>1?' x'+qty:'');
        if(item.notes) line+='\n  Nota: '+item.notes;
        const {data:tops}=await db
          .from('order_item_toppings')
          .select('topping_name,quantity,unit_price')
          .eq('order_item_id',item.id)
          .order('created_at');
        for(const t of (tops||[])){
          const tq=Number(t.quantity||1);
          line+='\n  '+String(t.topping_name||'Adicional')+(tq>1?' x'+tq:'');
        }
        result.push(line);
      }
      return result.join('\n');
    }catch(e){
      console.warn('No se pudo recuperar el detalle de la comanda:',e);
      return '';
    }
  }

  async function getCentralOrder(no){
    try{
      if(typeof SP_DB!=='undefined' && SP_DB && typeof SP_DB.rpc==='function'){
        const {data,error}=await SP_DB.rpc('sp_get_admin_orders');
        if(!error){
          const row=(Array.isArray(data)?data:[]).find(x=>String(x.order_number)===String(no));
          if(row) return row;
        }
      }
      return null;
    }catch(e){
      console.warn('No se pudo recuperar encabezado central:',e);
      return null;
    }
  }

  async function printComanda(no){
    try{
      const orders=JSON.parse(localStorage.getItem('ORDERS')||'[]');
      const queue=JSON.parse(localStorage.getItem('KITCHEN_QUEUE')||'[]');
      const o=orders.find(x=>String(x.no)===String(no)) || queue.find(x=>String(x.no)===String(no));
      if(!o){alert('No encontramos el pedido en este dispositivo.');return;}

      const central=await getCentralOrder(o.no);
      if(central){
        o.name=central.customer_name||o.name||'No registrado';
        o.type=central.order_type==='delivery'?'Domicilio':central.order_type==='pickup'?'Recoger':'Local';
        o.addr=central.address||o.addr||'';
        o.obs=central.observations||o.obs||'';
        o.driverName=central.driver_name||o.driverName||'';
        o.created=central.created_at||o.created;
      }

      const detail=await getDetail(o);
      const logo=document.querySelector('.brandLogo')?.src||'';
      const cleanLine=x=>String(x||'').replace(/\s+—\s+\$[\d.,]+/g,'').replace(/\s+\+\$[\d.,]+/g,'');
      const lines=String(detail||'').split('\n').map(x=>x.trim()).filter(Boolean)
        .map(x=>'<div class="line">'+esc(cleanLine(x))+'</div>').join('');
      const date=o.created?new Date(o.created).toLocaleString('es-CO',{dateStyle:'short',timeStyle:'short'}):'';
      const driver=o.type==='Domicilio'&&o.driverName?'<div><b>Domiciliario:</b> '+esc(o.driverName)+'</div>':'';

      const html='<!doctype html><html><head><meta charset="utf-8"><title>Comanda '+esc(o.no)+'</title><style>@page{size:80mm auto;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}body{width:80mm}.ticket{width:80mm;padding:4mm 4mm 5mm}.head{text-align:center;border-bottom:1px dashed #111;padding-bottom:3mm}.logo{display:block;width:30mm;height:auto;max-height:24mm;object-fit:contain;margin:0 auto 2mm}.brand{font-size:16px;font-weight:900}.title{text-align:center;font-size:14px;font-weight:900;margin:3mm 0}.info{font-size:10px;line-height:1.45;border-bottom:1px dashed #111;padding-bottom:3mm}.info div{margin-bottom:1mm;overflow-wrap:anywhere}.items{padding:3mm 0;border-bottom:1px dashed #111}.itemsTitle{font-size:12px;font-weight:900;margin-bottom:2mm}.line{font-size:11px;line-height:1.45;margin:1.5mm 0;white-space:pre-wrap;overflow-wrap:anywhere}.obs{font-size:10px;line-height:1.45;margin-top:3mm}.foot{text-align:center;font-size:9px;font-weight:900;margin-top:4mm}</style></head><body><div class="ticket"><div class="head">'+(logo?'<img class="logo" src="'+esc(logo)+'" alt="Santo Pecado">':'')+'<div class="brand">SANTO PECADO 17-29</div></div><div class="title">🍳 COMANDA DE COCINA<br>'+esc(o.no)+'</div><div class="info"><div><b>Hora:</b> '+esc(date)+'</div><div><b>Cliente:</b> '+esc(o.name||'No registrado')+'</div><div><b>Tipo:</b> '+esc(o.type||'')+'</div>'+(o.type==='Domicilio'&&o.addr?'<div><b>Dirección:</b> '+esc(o.addr)+'</div>':'')+driver+'</div><div class="items"><div class="itemsTitle">PREPARAR</div>'+(lines||'<div class="line">Sin productos</div>')+'</div>'+(o.obs?'<div class="obs"><b>OBSERVACIONES:</b><br>'+esc(o.obs)+'</div>':'')+'<div class="foot">PEDIDO RECIBIDO · PREPARAR</div></div></body></html>';

      const w=window.open('','_blank','width=420,height=800');
      if(!w){
        alert('Chrome bloqueó la ventana de la comanda. Permite ventanas emergentes para santopecado17-29.com y vuelve a pulsar.');
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
      setTimeout(()=>{try{w.focus();w.print();}catch(e){console.warn('Impresión no disponible:',e)}},400);

      const item=queue.find(x=>String(x.no)===String(no));
      if(item){
        item.printed=true;
        item.printedAt=new Date().toISOString();
        item.printedBy='administrador';
        localStorage.setItem('KITCHEN_QUEUE',JSON.stringify(queue));
      }
    }catch(e){
      console.error('Comanda cocina:',e);
      alert('No se pudo abrir la comanda. Recarga la página y vuelve a intentarlo.');
    }
  }

  window.printComanda=printComanda;

  function run(e){
    const el=e.target?.closest?.('button[onclick*="printComanda"]');
    if(!el)return;
    const code=el.getAttribute('onclick')||'';
    const m=code.match(/printComanda\(\s*['"]([^'"]+)['"]\s*\)/i);
    if(!m)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    printComanda(m[1]);
  }

  document.addEventListener('click',run,true);
  document.addEventListener('touchend',run,{capture:true,passive:false});
})();
