/* Migración controlada de fotografías Base64 a Supabase Storage.
   Solo se ofrece dentro de la sesión autenticada del administrador y solo comienza
   tras confirmación explícita. No modifica precios, stock, categorías ni ventas. */
(function () {
  'use strict';
  const URL = 'https://ghucwrrvqivmbogtcgcr.supabase.co';
  const KEY = 'sb_publishable_chFTmgoaIVvJSdpgTTuUSQ_fBNEq4WJ';
  let started = false;

  let client = null;
  let checking = false;
  let adminMenuObserver = null;

  function hasAdminSession() {
    try {
      const raw = sessionStorage.getItem('sp_premium_session_v1');
      if (!raw) return false;
      const session = JSON.parse(raw);
      return !!session && session.role === 'admin';
    } catch (_) {
      return false;
    }
  }

  async function init() {
    if (!hasAdminSession()) {
      const button = document.getElementById('spPhotoMigrationBtn');
      if (button) button.remove();
      return false;
    }
    if (!window.supabase) return false;
    if (!client) {
      client = window.supabase.createClient(URL, KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    }
    if (checking) return false;
    checking = true;
    try {
      addButton(client);
      return true;
    } catch (e) {
      console.warn('[SP fotos] No se pudo preparar el botón:', e);
      return false;
    } finally {
      checking = false;
    }
  }

  function addButton(db) {
    // Solo se inserta dentro del menú principal de administración autenticado.
    // Nunca se añade al formulario de acceso (correo/contraseña o PIN).
    const panel = document.getElementById('panel');
    const menu = panel && panel.querySelector('.sp-admin-groups');
    if (!panel || !menu || !hasAdminSession()) {
      const button = document.getElementById('spPhotoMigrationBtn');
      if (button) button.remove();
      if (!adminMenuObserver && panel && document.body && hasAdminSession()) {
        adminMenuObserver = new MutationObserver(() => {
          const currentPanel = document.getElementById('panel');
          if (currentPanel && currentPanel.querySelector('.sp-admin-groups') && hasAdminSession()) {
            addButton(db);
            if (document.getElementById('spPhotoMigrationBtn')) {
              adminMenuObserver.disconnect();
              adminMenuObserver = null;
            }
          }
        });
        adminMenuObserver.observe(panel, { childList: true, subtree: true });
      }
      return;
    }
    let section = document.getElementById('spPhotoMigrationSection');
    if (!section) {
      section = document.createElement('section');
      section.id = 'spPhotoMigrationSection';
      section.className = 'sp-admin-group';
      const heading = document.createElement('h3');
      heading.textContent = 'HERRAMIENTAS DEL ADMINISTRADOR';
      section.appendChild(heading);
      const grid = document.createElement('div');
      grid.className = 'sp-admin-group-grid';
      section.appendChild(grid);
      menu.appendChild(section);
    }
    const grid = section.querySelector('.sp-admin-group-grid');
    if (!grid) return;
    let button = document.getElementById('spPhotoMigrationBtn');
    if (!button) {
      button = document.createElement('button');
      button.id = 'spPhotoMigrationBtn';
      button.type = 'button';
      button.textContent = '⚡ Optimizar fotos del catálogo';
      button.addEventListener('click', () => migrate(db, button));
    }
    Object.assign(button.style, {
      display: 'block', position: 'static', boxSizing: 'border-box',
      gridColumn: '1 / -1', justifySelf: 'stretch',
      width: '100%', maxWidth: '100%', minWidth: '0', margin: '0',
      padding: '12px 16px', border: '0', borderRadius: '10px',
      background: '#176b45', color: '#fff', font: '600 15px system-ui',
      boxShadow: '0 3px 14px #0003', whiteSpace: 'normal', textAlign: 'center'
    });
    if (button.parentElement !== grid) grid.appendChild(button);
  }

  function report(message) {
    let el = document.getElementById('spPhotoMigrationStatus');
    const wrap = document.getElementById('spPhotoMigrationWrap');
    if (!el) {
      el = document.createElement('div');
      el.id = 'spPhotoMigrationStatus';
      el.style.cssText = 'display:block;margin:0 0 8px;padding:10px 12px;border-radius:10px;background:#191919;color:#fff;font:13px system-ui;white-space:pre-wrap;overflow-wrap:anywhere;';
      if (wrap) wrap.appendChild(el);
    }
    el.textContent = message;
  }

  async function migrate(db, button) {
    if (started) return;
    const ok = window.confirm(
      'Esta tarea guardará las fotos actuales en Supabase Storage y actualizará únicamente la dirección de la fotografía de cada producto. No cambia precios, stock, pedidos, ventas ni inventario. Se procesará una foto a la vez. ¿Continuar?'
    );
    if (!ok) return;
    started = true;
    button.disabled = true;
    button.textContent = '⏳ Optimizando fotografías…';
    let done = 0, failed = 0;
    try {
      const { data: products, error } = await db.from('products')
        .select('id,name,image_url,category_id,description,price,stock,minimum_stock,sort_order,active')
        .order('name');
      if (error) throw error;
      const targets = (products || []).filter(p => typeof p.image_url === 'string' && /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(p.image_url));
      if (!targets.length) {
        report('No hay fotografías Base64 pendientes. No se modificó ningún producto.');
        button.textContent = '✓ Fotos ya optimizadas';
        return;
      }
      report('Preparando ' + targets.length + ' fotografías. No cierres esta página.');
      for (let i = 0; i < targets.length; i++) {
        const p = targets[i];
        try {
          const response = await fetch(p.image_url);
          const blob = await response.blob();
          if (!blob.size || blob.size > 12 * 1024 * 1024) throw new Error('Tamaño de imagen no válido');
          const ext = (blob.type.split('/')[1] || 'jpeg').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '');
          const path = 'products/optimized-' + p.id + '-' + crypto.randomUUID() + '.' + ext;
          const { error: uploadError } = await db.storage.from('product-images').upload(path, blob, {
            upsert: false, contentType: blob.type || 'image/jpeg'
          });
          if (uploadError) throw uploadError;
          const publicUrl = db.storage.from('product-images').getPublicUrl(path).data.publicUrl;
          // Actualizar exclusivamente image_url. No usar admin_update_product:
          // esa RPC recibe y vuelve a escribir campos ajenos a la fotografía.
          const { data: updated, error: updateError } = await db.from('products')
            .update({ image_url: publicUrl })
            .eq('id', p.id)
            .select('id,image_url')
            .maybeSingle();
          if (updateError) throw updateError;
          if (!updated || updated.id !== p.id || updated.image_url !== publicUrl) {
            throw new Error('No se confirmó la actualización exclusiva de image_url; revise sesión y permisos RLS');
          }
          done++;
        } catch (e) {
          failed++;
          console.error('[SP fotos]', p.name, e);
        }
        report('Optimizando fotos: ' + (i + 1) + '/' + targets.length +
          '\nCorrectas: ' + done + ' · Pendientes/error: ' + failed +
          '\nNo cierres esta página hasta terminar.');
      }
      if (failed === 0) {
        report('✓ Listo: ' + done + ' fotografías ahora están en Supabase Storage. Recarga la aplicación para comprobar la velocidad.');
        button.textContent = '✓ Fotos optimizadas';
      } else {
        report('Proceso terminado parcialmente.\nCorrectas: ' + done + ' · Con error: ' + failed +
          '\nLas imágenes que no se actualizaron conservan su dirección original. Revisa la consola antes de volver a intentar.');
        button.textContent = '⚠ Revisión necesaria';
      }
    } catch (e) {
      console.error('[SP migración de fotos]', e);
      report('No se pudo iniciar la optimización: ' + (e && e.message ? e.message : String(e)) +
        '\nNo se ha confirmado ningún cambio global. Revisa permisos de Storage y del administrador.');
      button.textContent = '⚠ No se pudo completar';
    } finally {
      started = false;
      button.disabled = false;
    }
  }

  // Reintenta mientras Supabase restaura la sesión. Solo un admin activo verá el botón.
  async function boot() {
    if (!window.supabase) {
      const existing = document.querySelector('script[src*="supabase-js"]');
      if (!existing) {
        const sc = document.createElement('script');
        sc.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        sc.onload = () => init();
        sc.onerror = () => console.warn('[SP fotos] No se pudo cargar Supabase JS');
        document.head.appendChild(sc);
      }
      return;
    }
    await init();
  }
  boot();
  const timer = setInterval(boot, 2000);
  setTimeout(() => clearInterval(timer), 180000);
})();