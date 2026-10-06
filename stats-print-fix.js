/* Santo Pecado 17-29 — Impresión de estadísticas
   Solo corrige la salida de impresión del módulo Estadísticas. */
(function(){
  function esc(s){
    return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }
  function findStatsPanel(btn){
    let el=btn;
    for(let i=0;i<12&&el;i++,el=el.parentElement){
      const t=(el.textContent||'').trim();
      if(t.includes('Ventas de los últimos 7 días')&&t.includes('Productos más vendidos')&&t.includes('Ventas por medio de pago')) return el;
    }
    return document.querySelector('#spStatsPanel,[data-sp-stats-panel]')||null;
  }
  function printStats(btn){
    const panel=findStatsPanel(btn);
    if(!panel){
      alert('No se encontró el contenido de Estadísticas para imprimir. Cierra y vuelve a abrir Estadísticas.');
      return;
    }
    const clone=panel.cloneNode(true);
    clone.querySelectorAll('button').forEach(b=>b.remove());
    clone.querySelectorAll('input,select,textarea').forEach(x=>x.remove());
    const html='<!doctype html><html><head><meta charset="utf-8"><title>Estadísticas — Santo Pecado 17-29</title><style>'+
      '@page{size:A4;margin:12mm}'+
      '*{box-sizing:border-box}'+
      'html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}'+
      'body{font-size:12px}'+
      'h1,h2,h3,h4{color:#111}'+
      'button{display:none!important}'+
      '[style*="background:#101010"],[style*="background: #101010"],[style*="background:#111"],[style*="background: #111"]{background:#fff!important;color:#111!important}'+
      'div{color:#111}'+
      'hr{border:0;border-top:1px solid #bbb}'+
      'table{width:100%;border-collapse:collapse}'+
      'th,td{border-bottom:1px solid #ddd;padding:6px;text-align:left}'+
      ' .printHeader{display:block!important;text-align:center;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:12px}'+
      '.printHeader h1{margin:0 0 4px;font-size:22px}.printHeader p{margin:0;font-size:11px;color:#555}'+
      '.printBox{border:1px solid #ccc;border-radius:8px;padding:10px;margin:10px 0}'+
      '</style></head><body>'+
      '<div class="printHeader"><h1>SANTO PECADO 17-29</h1><p>REPORTE DE ESTADÍSTICAS</p><p>'+esc(new Date().toLocaleString('es-CO'))+'</p></div>'+
      '<div class="printBox">'+clone.innerHTML+'</div>'+
      '</body></html>';
    const w=window.open('','_blank','width=900,height=1000');
    if(!w){
      alert('Chrome bloqueó la ventana de impresión. Permite ventanas emergentes para santopecado17-29.com y vuelve a pulsar Imprimir estadísticas.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(()=>{
      try{w.focus();w.print();}catch(e){console.warn('Impresión de estadísticas:',e)}
    },600);
  }
  function bind(){
    document.querySelectorAll('button').forEach(btn=>{
      if(btn.dataset.spStatsPrintBound==='1')return;
      if(!/imprimir\s+estad[ií]sticas/i.test((btn.textContent||'').trim()))return;
      btn.dataset.spStatsPrintBound='1';
      btn.addEventListener('click',function(e){
        e.preventDefault();
        e.stopImmediatePropagation();
        printStats(btn);
      },true);
    });
  }
  bind();
  new MutationObserver(bind).observe(document.documentElement,{childList:true,subtree:true});
})();
