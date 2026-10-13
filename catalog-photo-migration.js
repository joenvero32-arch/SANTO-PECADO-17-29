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
    if (!el) {
      el = document.createElement('div');
      el.id = 'spPhotoMigrationStatus';
      el.style.cssText = 'display:block;box-sizing:border-box;width:100%;margin:10px 0;padding:12px;border:1px solid #555;border-radius:10px;background:#191919;color:#fff;font:13px system-ui;white-space:pre-wrap;overflow-wrap:anywhere;';
      const section = document.getElementById('spPhotoMigrationSection');
      const button = document.getElementById('spPhotoMigrationBtn');
      if (section) section.appendChild(el);
      else if (button && button.parentElement) button.parentElement.appendChild(el);
      else document.body.appendChild(el);
    }
    el.textContent = message;
  }

  async function compressPhoto(sourceBlob) {
    if (!sourceBlob || !sourceBlob.size || sourceBlob.size > 12 * 1024 * 1024) {
      throw new Error('Tamaño de imagen no válido (máximo 12 MB)');
    }
    const bitmap = await createImageBitmap(sourceBlob);
    try {
      const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('No se pudo preparar el compresor de imagen');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      const result = await new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo convertir la fotografía a JPG')), 'image/jpeg', 0.88);
      });
      if (!result.size) throw new Error('La fotografía comprimida está vacía');
      return result;
    } finally {
      bitmap.close();
    }
  }

  async function ensureAdminSession(db) {
    let { data: authData, error: authError } = await db.auth.getUser();
    if (authError || !authData || !authData.user) {
      const prior = document.getElementById('spPhotoAuthDialog');
      if (prior) prior.remove();
      const overlay = document.createElement('div');
      overlay.id = 'spPhotoAuthDialog';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:1000000;background:#000b;display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box;font-family:system-ui,sans-serif;';
      overlay.innerHTML = '<form style="width:min(440px,100%);box-sizing:border-box;background:#171717;color:#fff;border:1px solid #444;border-radius:16px;padding:20px;box-shadow:0 20px 60px #0008"><h3 style="margin:0 0 10px">Autenticación de Supabase</h3><p style="font-size:14px;line-height:1.45;color:#ddd">La sesión actual de la aplicación no autentica esta herramienta. Ingresa la cuenta de Supabase que tenga rol de administrador activo. No se subirá ninguna foto hasta validar la cuenta.</p><label style="display:block;margin:12px 0 5px">Correo de administrador</label><input name="email" type="email" autocomplete="username" required style="width:100%;box-sizing:border-box;padding:12px;border-radius:8px;border:1px solid #555;background:#090909;color:#fff"><label style="display:block;margin:12px 0 5px">Contraseña de Supabase</label><input name="password" type="password" autocomplete="current-password" required style="width:100%;box-sizing:border-box;padding:12px;border-radius:8px;border:1px solid #555;background:#090909;color:#fff"><p data-error style="color:#ffaaaa;font-size:13px;min-height:18px"></p><div style="display:flex;gap:10px;justify-content:flex-end"><button type="button" data-cancel style="padding:10px 14px;border:1px solid #555;border-radius:8px;background:#333;color:#fff">Cancelar</button><button type="submit" style="padding:10px 14px;border:0;border-radius:8px;background:#176b45;color:#fff;font-weight:700">Validar cuenta</button></div></form>';
      document.body.appendChild(overlay);
      const form = overlay.querySelector('form');
      const result = await new Promise(resolve => {
        overlay.querySelector('[data-cancel]').addEventListener('click', () => { overlay.remove(); resolve(false); }, { once: true });
        form.addEventListener('submit', async event => {
          event.preventDefault();
          const submit = form.querySelector('button[type="submit"]');
          const errorEl = form.querySelector('[data-error]');
          submit.disabled = true;
          submit.textContent = 'Validando…';
          errorEl.textContent = '';
          const fd = new FormData(form);
          try {
            const { data, error } = await db.auth.signInWithPassword({
              email: String(fd.get('email') || '').trim(),
              password: String(fd.get('password') || '')
            });
            if (error || !data || !data.user) throw new Error(error && error.message ? error.message : 'No se pudo iniciar sesión.');
            overlay.remove();
            resolve(true);
          } catch (e) {
            errorEl.textContent = e && e.message ? e.message : 'No se pudo validar la cuenta.';
            submit.disabled = false;
            submit.textContent = 'Validar cuenta';
          }
        });
      });
      if (!result) throw new Error('Autenticación cancelada. No se subió ninguna fotografía.');
      ({ data: authData, error: authError } = await db.auth.getUser());
      if (authError || !authData || !authData.user) throw new Error('Supabase no confirmó la sesión iniciada.');
    }
    const { data: appUser, error: roleError } = await db.from('app_users')
      .select('role,active').eq('id', authData.user.id).maybeSingle();
    if (roleError || !appUser || appUser.role !== 'admin' || appUser.active !== true) {
      throw new Error('La cuenta autenticada no tiene rol de administrador activo en app_users. No se subió ninguna fotografía.');
    }
    return authData.user;
  }

  async function migrate(db, button) {
    if (started) return;
    const ok = window.confirm(
      'Se comprobará primero la sesión administrativa. Las fotos se convertirán a JPG, máximo 800 px y calidad 88%. Solo se actualizará image_url. Si no se confirma el permiso, se detendrá sin subir fotos. ¿Continuar?'
    );
    if (!ok) return;
    started = true;
    button.disabled = true;
    button.textContent = '⏳ Verificando permisos…';
    let done = 0, failed = 0;
    try {
      // Si falta sesión, solicitar inicio de sesión Supabase; validar rol activo antes de subir.
      await ensureAdminSession(db);

      const { data: products, error } = await db.from('products')
        .select('id,name,image_url')
        .order('name');
      if (error) throw error;
      const pendingTargets = (products || []).filter(p => typeof p.image_url === 'string' && /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(p.image_url));
      // Después de validar la prueba inicial, avanzar en lotes controlados de máximo 15 fotografías.
      const targets = pendingTargets.slice(0, 15);
      if (!targets.length) {
        report('No hay fotografías Base64 pendientes. No se modificó ningún producto.');
        button.textContent = '✓ Fotos ya optimizadas';
        return;
      }
      report('Permisos confirmados. LOTE CONTROLADO: se procesarán hasta ' + targets.length + ' fotografías de ' + pendingTargets.length + ' pendientes. Productos: ' + targets.map(p => p.name).join(', ') + '. No cierres esta página.');
      button.textContent = '⏳ Optimizando fotografías…';
      for (let i = 0; i < targets.length; i++) {
        const p = targets[i];
        let uploadedPath = null;
        try {
          const response = await fetch(p.image_url);
          if (!response.ok) throw new Error('No se pudo leer la fotografía original');
          const originalBlob = await response.blob();
          const blob = await compressPhoto(originalBlob);
          const path = 'products/optimized-' + p.id + '-' + crypto.randomUUID() + '.jpg';
          const { error: uploadError } = await db.storage.from('product-images').upload(path, blob, {
            upsert: false, contentType: 'image/jpeg'
          });
          if (uploadError) throw uploadError;
          uploadedPath = path;
          const publicUrl = db.storage.from('product-images').getPublicUrl(path).data.publicUrl;
          const verifyResponse = await fetch(publicUrl, { method: 'GET', cache: 'no-store' });
          if (!verifyResponse.ok) throw new Error('La fotografía subida no se puede abrir públicamente');
          const verifiedBlob = await verifyResponse.blob();
          if (!verifiedBlob.size || verifiedBlob.type !== 'image/jpeg') throw new Error('La fotografía subida no se verificó como JPG');

          // Actualizar exclusivamente image_url; no enviar nombre, precio, stock ni categoría.
          const { data: updatedRows, error: updateError } = await db.rpc('admin_update_product_image_url', {
            p_product_id: p.id,
            p_image_url: publicUrl
          });
          if (updateError) throw updateError;
          const updated = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
          if (!updated || updated.id !== p.id || updated.image_url !== publicUrl) {
            throw new Error('Supabase no confirmó la actualización exclusiva de image_url.');
          }
          uploadedPath = null;
          done++;
        } catch (e) {
          failed++;
          const reason = e && e.message ? e.message : String(e);
          if (uploadedPath) {
            const { error: cleanupError } = await db.storage.from('product-images').remove([uploadedPath]);
            if (cleanupError) console.warn('[SP fotos] No se pudo limpiar un archivo de migración fallida:', cleanupError);
          }
          console.error('[SP fotos]', p.name, e);
          report('Prueba de fotografía detenida. Producto: ' + p.name + '\nMotivo: ' + reason + '\nNo vuelvas a ejecutar la prueba hasta revisar este error.');
        }
        if (failed === 0) {
          report('Optimizando fotos: ' + (i + 1) + '/' + targets.length +
            '\nCorrectas: ' + done + ' · Pendientes/error: ' + failed +
            '\nNo cierres esta página hasta terminar.');
        }
      }
      if (failed === 0) {
        report('✓ Prueba controlada lista: ' + done + ' fotografía convertida a JPG y verificada en Supabase Storage. Las demás siguen intactas.');
        button.textContent = '✓ Lote de fotos completado';
      } else {
        const detail = (document.getElementById('spPhotoMigrationStatus') || {}).textContent || 'No se obtuvo detalle del error.';
        report('Proceso detenido con error.\nCorrectas: ' + done + ' · Con error: ' + failed +
          '\nLas direcciones originales de las fotos fallidas se conservan.\n\nDetalle del error:\n' + detail);
        button.textContent = '⚠ Revisión necesaria';
      }
    } catch (e) {
      console.error('[SP migración de fotos]', e);
      const reason = e && e.message ? e.message : String(e);
      report('Proceso detenido antes de migrar: ' + reason +
        '\nNo se subieron fotografías durante la verificación previa.');
      button.textContent = '⚠ Verificación pendiente';
      window.alert('La prueba se detuvo antes de subir fotos.\n\nMotivo: ' + reason + '\n\nNo se migraron fotografías.');
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