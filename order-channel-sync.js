/* Origen central de pedidos: celular y punto físico, sin duplicar pedidos. */
(function(){
  const CHANNELS={celular:'📱 Pedido por celular',punto_fisico:'🖥️ Pedido en punto físico',desconocido:'Origen por configurar'};
  function install(){
    const db=window.SP_DB;
    if(!db||typeof db.rpc!=='function'){setTimeout(install,400);return}
    if(db.rpc.__spOrderChannelWrapped)return;
    const original=db.rpc.bind(db);
    const wrapped=function(name,args,options){
      if(String(name)==='sp_create_public_order'&&args&&args.p_order){
        const order={...args.p_order};
        let physical=false;
        try{physical=typeof window.isEmployeeOrderMode==='function'&&window.isEmployeeOrderMode()}catch(_){}
        order.order_channel=physical?'desconocido':'celular';
        args={...args,p_order:order};
      }
      return original(name,args,options);
    };
    wrapped.__spOrderChannelWrapped=true;
    db.rpc=wrapped;
    window.__spOrderChannelInstalled=true;
  }
  function decorate(){
    const panel=document.getElementById('modal');
    if(!panel||!panel.classList.contains('open'))return;
    panel.querySelectorAll('.order').forEach(card=>{
      if(card.querySelector('.spOrderChannel'))return;
      const orderNo=card.querySelector('b')?.textContent?.trim();
      if(!orderNo)return;
      let order=null;
      try{order=(JSON.parse(localStorage.getItem('sp_premium_orders_v2')||'[]')).find(x=>String(x.no)===orderNo)}catch(_){}
      if(!order)return;
      const channel=order.orderChannel||'desconocido';
      const line=document.createElement('div');line.className='spOrderChannel';
      line.textContent=CHANNELS[channel]||CHANNELS.desconocido;
      line.style.cssText='display:inline-block;margin:5px 0 7px;padding:5px 9px;border:1px solid #80661f;border-radius:9px;color:#f3cf67;background:#f3cf6712;font-size:12px;font-weight:800';
      const nameLine=card.querySelector('br');
      if(nameLine&&nameLine.parentNode)nameLine.parentNode.insertBefore(line,nameLine.nextSibling);
      else card.prepend(line);
    });
  }
  install();
  const observer=new MutationObserver(decorate);
  function observe(){if(document.body)observer.observe(document.body,{childList:true,subtree:true});decorate()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
  setInterval(()=>{if(!window.__spOrderChannelInstalled)install();decorate()},1500);
})();