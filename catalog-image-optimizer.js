/* Optimización segura de imágenes del catálogo.
   Prioriza las imágenes visibles al abrir la aplicación y aplaza las que están
   fuera de pantalla. No modifica productos, precios ni datos de Supabase. */
(function () {
  'use strict';
  if (window.__spImageLoadOptimizer) return;
  window.__spImageLoadOptimizer = true;

  function prepareImage(img) {
    if (!(img instanceof HTMLImageElement) || img.dataset.spLoadOptimized === '1') return;
    img.dataset.spLoadOptimized = '1';
    img.decoding = 'async';

    const rect = img.getBoundingClientRect();
    const visibleSoon = rect.width > 0 && rect.height > 0 &&
      rect.top < window.innerHeight * 1.35 &&
      rect.bottom > -window.innerHeight * 0.2;

    if (visibleSoon) {
      img.loading = 'eager';
      if (!window.__spPriorityImages) window.__spPriorityImages = 0;
      if (window.__spPriorityImages < 4) {
        img.fetchPriority = 'high';
        window.__spPriorityImages += 1;
      }
    } else {
      img.loading = 'lazy';
      img.fetchPriority = 'low';
    }
  }

  function scan(root) {
    if (!root) return;
    if (root instanceof HTMLImageElement) prepareImage(root);
    if (typeof root.querySelectorAll === 'function') {
      root.querySelectorAll('img').forEach(prepareImage);
    }
  }

  function start() {
    scan(document);
    const observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        record.addedNodes.forEach(scan);
        if (record.type === 'attributes' && record.target instanceof HTMLImageElement) {
          record.target.dataset.spLoadOptimized = '';
          prepareImage(record.target);
        }
      });
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();