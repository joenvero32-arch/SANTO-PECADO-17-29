/* Migración controlada de fotografías Base64 a Supabase Storage.
   Solo se ofrece dentro de la sesión autenticada del administrador y solo comienza
   tras confirmación explícita. No modifica precios, stock, categorías ni ventas. */
(function () {
  'use strict';
  const URL = 'https://ghucwrrvqivmbogtcgcr.supabase.co';
  const KEY = 'sb_publishable_chFTmgoaIVvJSdpgTTuUSQ_fBNEq4WJ';
  let started = false;

  async function init() {
    if (!window.supabase || !document.getElementById('spAdminBtn')) return;
    const client = window.supabase.createClient(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data: auth } = await client.auth.getUser();
    if (!auth || !auth.user) return;
    const { data: profile } = await client.from('app_users').select('role,active').eq('id', auth.user.id).maybeSingle();
    if (!profile || profile.role !== 'admin' || profile.active !== true) return;
    addButton(client);
  }

  function addButton(db) {
    if (document.getElementById('spPhotoMigrationBtn')) return;
    const admin = document.getElementById('spAdminBtn');
    if (!admin) return;
    const button = document.createElement('button');
    button.id = 'spPhotoMigrationBtn';
    button.type = 'button';
    button.textContent = '⚡ Optimizar fotos del catálogo';
    Object.assign(button.style, {
      position: 'fixed', right: '12px', bottom: '76px', zIndex: '2147483000',
      maxWidth: 'calc(100vw - 24px)', padding: '12px 16px', border: '0',
      borderRadius: '12px', background: '#176b45', color: '#fff',
      font: '600 14px system-ui', boxShadow: '0 3px 14px #0003'
    });
    button.addEventListener('click', () => migrate(db, button));
    document.body.appendChild(button);
  }

  function report(message) {
    let el = document.getElementById('spPhotoMigrationStatus');
    if (!el) {
      el = document.createElement('div');
      el.id = 'spPhotoMigrationStatus';
      Object.assign(el.style, {
        position: 'fixed', left: '12px', right: '12px', bottom: '12px', zIndex: '2147483001',
        padding: '14px', borderRadius: '10px', background: '#111', color: '#fff',
        font: '14px system-ui', whiteSpace: 'pre-wrap', boxShadow: '0 3px 14px #0005'
      });
      document.body.appendChild(el);
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

  const timer = setInterval(() => {
    if (document.getElementById('spAdminBtn')) {
      clearInterval(timer);
      init().catch(e => console.error('[SP fotos] No se pudo habilitar la herramienta', e));
    }
  }, 1000);
  setTimeout(() => clearInterval(timer), 120000);
})();