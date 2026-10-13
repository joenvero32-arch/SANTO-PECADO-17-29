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
  let adminPanelObserver = null;

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
    // La aplicación valida el PIN y guarda la sesión administrativa en sessionStorage.
    // No exigir otra sesión de Supabase: el login principal de esta aplicación es local/PIN.
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
    const adminPanel = document.getElementById('spAdminPanel');
    const tabs = adminPanel && adminPanel.querySelector('.spTabs');
    if (!adminPanel || !tabs) {
      // El panel solo se crea cuando el administrador abre Administración.
      // Esperar a que exista, sin poner el botón flotante ni ocultarlo.
      if (!adminPanelObserver && document.body) {
        adminPanelObserver = new MutationObserver(() => {
          const panelNow = document.getElementById('spAdminPanel');
          if (panelNow && panelNow.querySelector('.spTabs')) {
            addButton(db);
            if (document.getElementById('spPhotoMigrationBtn')) {
              adminPanelObserver.disconnect();
              adminPanelObserver = null;
            }
          }
        });
        adminPanelObserver.observe(document.body, { childList: true, subtree: true });
      }
      return;
    }
    let wrap = document.getElementById('spPhotoMigrationWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'spPhotoMigrationWrap';
      wrap.style.cssText = 'flex:0 0 auto;padding:10px 14px 0;background:#101010;';
      tabs.insertAdjacentElement('afterend', wrap);
    }
    const existing = document.getElementById('spPhotoMigrationBtn');
    if (existing) {
      if (existing.parentElement !== wrap) wrap.appendChild(existing);
      return;
    }
    const button = document.createElement('button');
    button.id = 'spPhotoMigrationBtn';
    button.type = 'button';
    button.textContent = '⚡ Optimizar fotos del catálogo';
    Object.assign(button.style, {
      display: 'block', position: 'static', boxSizing: 'border-box',
      width: '100%', maxWidth: '100%', margin: '0 0 8px',
      padding: '11px 14px', border: '0', borderRadius: '10px',
      background: '#176b45', color: '#fff', font: '600 14px system-ui',
      boxShadow: '0 3px 14px #0003', whiteSpace: 'normal'
    });
    button.addEventListener('click', () => migrate(db, button));
    wrap.appendChild(button);
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
          const { error: updateError } = await db.rpc('admin_update_product', {
            p_product_id: p.id,
            p_name: p.name,
            p_category_id: p.category_id,
            p_description: p.description || '',
            p_price: Number(p.price || 0),
            p_stock: Number(p.stock || 0),
            p_minimum_stock: Number(p.minimum_stock || 0),
            p_sort_order: Number(p.sort_order || 0),
            p_active: p.active !== false,
            p_image_url: publicUrl
          });
          if (updateError) throw updateError;
          const { data: check, error: checkError } = await db.from('products')
            .select('image_url').eq('id', p.id).maybeSingle();
          if (checkError || !check || check.image_url !== publicUrl) throw new Error('No se confirmó la dirección de la foto');
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