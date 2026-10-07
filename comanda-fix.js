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
    try{
      // Fuente de verdad para la comanda: RPC seguro que devuelve productos
      // y cantidades reales de toppings, sin depender de RLS del navegador.
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
      const {data,error}=await db.rpc('sp_get_kitchen_detail',{p_order_number:String(o.no)});
      if(!error && Array.isArray(data) && data.length){
        const grouped=new Map();
        for(const row of data){
          const id=String(row.order_item_id);
          if(!grouped.has(id)){
            const qty=Number(row.product_quantity||1);
            let line=String(row.product_name||'Producto')+(qty>1?' x'+qty:'');
            if(row.notes) line+='\n  Nota: '+String(row.notes);
            grouped.set(id,{line,toppings:[]});
          }
          if(row.topping_name){
            const tq=Number(row.topping_quantity||1);
            grouped.get(id).toppings.push('  '+String(row.topping_name)+' x'+tq);
          }
        }
        return Array.from(grouped.values()).map(x=>[x.line,...x.toppings].join('\n')).join('\n');
      }
      if(error) console.warn('sp_get_kitchen_detail:',error);
      return '';
    }catch(e){
      console.warn('No se pudo recuperar el detalle de la comanda:',e);
      return '';
    }
  }

  async function getCentralOrder(no){
    try{
      if(typeof SP_DB!=='undefined' && SP_DB && typeof SP_DB.rpc==='function'){
        const {data,error}=await SP_DB.rpc('sp_get_kitchen_order',{p_order_number:String(no)});
        if(!error && Array.isArray(data) && data[0]) return data[0];
        if(error) console.warn('sp_get_kitchen_order:',error);
      }

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
      const {data,error}=await db.rpc('sp_get_kitchen_order',{p_order_number:String(no)});
      if(!error && Array.isArray(data) && data[0]) return data[0];

      if(error) console.warn('RPC encabezado comanda:',error);
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
      // La comanda no debe depender de que el pedido exista en localStorage.
      // El pedido central de Supabase es la fuente de verdad.
      const o=orders.find(x=>String(x.no)===String(no)) || queue.find(x=>String(x.no)===String(no)) || {no:String(no)};
      
      const central=await getCentralOrder(o.no);
      if(central){
        o.centralId=central.order_id||o.centralId||'';
        o.name=central.customer_name||o.name||'No registrado';
        o.type=central.order_type==='delivery'?'Domicilio':central.order_type==='pickup'?'Recoger':'Local';
        o.addr=central.address||o.addr||'';
        o.obs=central.observations||o.obs||'';
        o.tableNumber=central.table_number||o.tableNumber||'';
        o.driverName=central.driver_name||o.driverName||'';
        o.created=central.created_at||o.created;
      }

      const detail=await getDetail(o);
      const logo=document.querySelector('.brandLogo')?.src||'';
      const cleanLine=x=>String(x||'').replace(/\s+—\s+\$[\d.,]+/g,'').replace(/\s+\+\$[\d.,]+/g,'');
      const lines=String(detail||'').replace(/\\n/g,'\n').split('\n').map(x=>x.trim()).filter(Boolean)
        .map(x=>'<div class="line">'+esc(cleanLine(x))+'</div>').join('');
      const date=o.created?new Date(o.created).toLocaleString('es-CO',{dateStyle:'short',timeStyle:'short'}):'';
      const driver=o.type==='Domicilio'&&o.driverName?'<div><b>Domiciliario:</b> '+esc(o.driverName)+'</div>':'';

      const html='<!doctype html><html><head><meta charset="utf-8"><title>Comanda '+esc(o.no)+'</title><style>@page{size:80mm auto;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}body{width:80mm}.ticket{width:80mm;padding:4mm 4mm 5mm}.head{text-align:center;border-bottom:1px dashed #111;padding-bottom:3mm}.logo{display:block;width:30mm;height:auto;max-height:24mm;object-fit:contain;margin:0 auto 2mm}.brand{font-size:16px;font-weight:900}.title{text-align:center;font-size:14px;font-weight:900;margin:3mm 0}.info{font-size:10px;line-height:1.45;border-bottom:1px dashed #111;padding-bottom:3mm}.info div{margin-bottom:1mm;overflow-wrap:anywhere}.items{padding:3mm 0;border-bottom:1px dashed #111}.itemsTitle{font-size:12px;font-weight:900;margin-bottom:2mm}.line{font-size:11px;line-height:1.45;margin:1.5mm 0;white-space:pre-wrap;overflow-wrap:anywhere}.obs{font-size:10px;line-height:1.45;margin-top:3mm}.foot{text-align:center;font-size:9px;font-weight:900;margin-top:4mm}</style></head><body><div class="ticket"><div class="head">'+(logo?'<img class="logo" src="'+esc(logo)+'" alt="Santo Pecado">':'')+'<div class="brand">SANTO PECADO 17-29</div></div><div class="title">🍳 COMANDA DE COCINA<br>'+esc(o.no)+'</div><div class="info"><div><b>Hora:</b> '+esc(date)+'</div><div><b>Cliente:</b> '+esc(o.name||'No registrado')+'</div><div><b>Tipo:</b> '+esc(o.type||'')+'</div>'+(o.tableNumber?'<div><b>Mesa:</b> '+esc(o.tableNumber)+'</div>':'')+(o.type==='Domicilio'&&o.addr?'<div><b>Dirección:</b> '+esc(o.addr)+'</div>':'')+driver+'</div><div class="items"><div class="itemsTitle">PREPARAR</div>'+(lines||'<div class="line">Sin productos</div>')+'</div>'+(o.obs?'<div class="obs"><b>OBSERVACIONES:</b><br>'+esc(o.obs)+'</div>':'')+'<div class="foot">PEDIDO RECIBIDO · PREPARAR</div></div></body></html>';

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
