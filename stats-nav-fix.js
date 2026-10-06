(function(){
  function addStatsButton(){
    document.querySelectorAll('.adminTabs').forEach(function(nav){
      if(nav.querySelector('[data-sp-stats="1"]')) return;
      var tabs=nav.querySelectorAll('button.tab');
      if(!tabs.length) return;
      var b=document.createElement('button');
      b.className='tab';
      b.setAttribute('data-sp-stats','1');
      b.textContent='📊 Estadísticas';
      b.onclick=function(){ if(typeof window.adminStats==='function') window.adminStats(); };
      nav.insertBefore(b,tabs[1]||null);
    });
  }
  addStatsButton();
  new MutationObserver(addStatsButton).observe(document.documentElement,{childList:true,subtree:true});
})();