/* Santo Pecado 17-29 — Formato de impresión de estadísticas (solo Estadísticas) */
(function(){
  function esc(s){
    return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }
  function findStatsPanel(btn){
    const explicit=document.querySelector('#spStatsPanel,[data-sp-stats-panel]');
    if(explicit) return explicit;
    let el=btn;
    for(let i=0;i<12&&el;i++,el=el.parentElement){
      const t=(el.textContent||'').trim();
      if(t.includes('Ventas de los últimos 7 días')&&t.includes('Productos más vendidos')&&t.includes('Ventas por medio de pago')) return el;
    }
    return null;
  }
  function printStats(btn){
    const panel=findStatsPanel(btn);
    if(!panel){alert('No se encontró el contenido de Estadísticas para imprimir. Cierra y vuelve a abrir Estadísticas.');return;}
    const clone=panel.cloneNode(true);
    clone.querySelectorAll('button,input,select,textarea,nav,[role="navigation"],[role="tablist"]').forEach(x=>x.remove());
    const logo=document.querySelector('.brandLogo');
    const logoSrc=logo?.src||'';
    const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Estadísticas — Santo Pecado 17-29</title><style>'+
      '@page{size:A4;margin:9mm}'+
      '*{box-sizing:border-box}'+
      'html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}'+
      'body{font-size:9.5px;line-height:1.25}'+
      'h1,h2,h3,h4{color:#111}'+
      'h1{font-size:19px!important}h2{font-size:14px!important}h3,h4{font-size:12px!important}'+
      'button,input,select,textarea,nav,[role="navigation"],[role="tablist"]{display:none!important}'+
      'div{color:#111}hr{border:0;border-top:1px solid #bbb}'+
      'table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:3px 5px;text-align:left}'+
      '.printHeader{display:block!important;text-align:center;border-bottom:2px solid #111;padding-bottom:5px;margin:0 0 7px}'+
      '.printLogo{display:block;width:30mm;height:16mm;object-fit:contain;margin:0 auto 2px}'+
      '.printHeader h1{margin:0 0 2px}.printHeader p{margin:1px 0;font-size:9px;color:#555}'+
      '.printBox{border:0!important;border-radius:0!important;padding:0!important;margin:0!important}'+
      '.printBox>*{margin-top:0!important;margin-bottom:5px!important}'+
      '.printBox h2,.printBox h3,.printBox h4{margin:5px 0 3px!important}'+
      '.printBox p{margin:2px 0!important}'+
      '.printBox li{margin:1px 0}'+
      '.printBox [style*="display:grid"],.printBox [style*="display: grid"]{display:block!important}'+
      '.printBox [style*="padding"]{padding:5px!important}'+
      '.printBox [style*="margin"]{margin:3px 0!important}'+
      '.printBox [style*="border-radius"]{border-radius:5px!important}'+
      '.printBox section,.printBox article,.printBox table,.printBox .card,.printBox [class*="card"]{break-inside:avoid;page-break-inside:avoid}'+
      '@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}'+
      '</style></head><body>'+
      '<div class="printHeader">'+(logoSrc?'<img class="printLogo" src="'+esc(logoSrc)+'">':'')+
      '<h1>SANTO PECADO 17-29</h1><p>REPORTE DE ESTADÍSTICAS</p><p>'+esc(new Date().toLocaleString('es-CO'))+'</p></div>'+
      '<div class="printBox">'+clone.innerHTML+'</div></body></html>';
    const w=window.open('','_blank','width=900,height=1000');
    if(!w){alert('Chrome bloqueó la ventana de impresión. Permite ventanas emergentes para santopecado17-29.com y vuelve a pulsar Imprimir estadísticas.');return;}
    w.document.open();w.document.write(html);w.document.close();
    setTimeout(()=>{try{w.focus();w.print();}catch(e){console.warn('Impresión de estadísticas:',e)}},500);
  }
  function bind(){
    document.querySelectorAll('button').forEach(btn=>{
      if(btn.dataset.spStatsPrintBound==='1')return;
      if(!/imprimir\s+estad[ií]sticas/i.test((btn.textContent||'').trim()))return;
      btn.dataset.spStatsPrintBound='1';
      btn.addEventListener('click',function(e){e.preventDefault();e.stopImmediatePropagation();printStats(btn);},true);
    });
  }
  bind();
  new MutationObserver(bind).observe(document.documentElement,{childList:true,subtree:true});
})();