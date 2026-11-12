// 📦 Copias de seguridad.
//  · Automáticas (en el móvil, IndexedDB): al guardar/editar/borrar partidas, antes de importar
//    o restaurar, y una vez al día al abrir la app. Solo se guardan las 2 últimas y se pueden restaurar.
//  · Fuera del móvil: archivo compartido desde el móvil (.txt con el JSON dentro: Drive,
//    WhatsApp, correo…) o descargado en el ordenador (.json). Cada
//    10 partidas nuevas sin copia, la app lo recuerda (si se borran los datos del navegador,
//    las copias internas también se pierden: la buena es la de fuera).
const Backup = (() => {
  const $ = sel => document.querySelector(sel);
  const DB = 'catan-backups';
  const STORE = 'snaps';
  const MAX = 2; // solo las 2 últimas: para deshacer un error reciente (la copia buena es la de fuera)
  const REMIND_EVERY = 10;
  const DAY = 24 * 3600 * 1000;
  let dbp = null;

  function db() {
    if (!dbp) dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'at' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  async function run(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  const list = async () => ((await run('readonly', s => s.getAll())) || []).sort((a, b) => b.at - a.at);

  // Copia interna. No repite si los datos no han cambiado desde la última.
  async function snapshot(reason) {
    try {
      const s = Storage.get();
      if (!s) return;
      const data = JSON.stringify(s);
      const all = await list();
      if (all[0] && all[0].data === data) return;
      await run('readwrite', st => st.put({ at: Date.now(), reason, games: s.games.length, data }));
      await prune();
      renderSettings();
    } catch (e) {
      console.warn('Copia automática no guardada', e);
    }
  }

  // Borra las que sobran (también las que quedaron de cuando se guardaban 15).
  async function prune() {
    for (const old of (await list()).slice(MAX)) await run('readwrite', st => st.delete(old.at));
  }

  async function restore(at) {
    const snap = (await list()).find(x => x.at === at);
    if (!snap) return;
    if (!confirm(`¿Volver a la copia del ${fmt(snap.at)} (${snap.games} partidas)? Lo actual se guarda antes como otra copia.`)) return;
    await snapshot('Antes de restaurar');
    Storage.replace(JSON.parse(snap.data));
    App.refresh();
    renderSettings();
    App.toast('↺ Copia restaurada');
  }

  // ---------- Copia fuera del móvil ----------

  const today = () => Stats.today();

  function download(name, content) {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); // en Safari/iOS revocarlo al instante cancela la descarga
    markExported();
    App.toast('📦 Copia descargada');
  }

  // En el móvil abre la hoja de compartir (Drive, WhatsApp, correo…); en el ordenador, descarga.
  // Se llama DIRECTAMENTE desde el toque del botón: con una espera antes, el navegador lo
  // bloquea (NotAllowedError). Reglas que han hecho falta para que llegue a Drive:
  //  · Siempre .txt: Chrome Android no deja compartir .json (canShare dice que sí y luego falla).
  //    Es el mismo JSON por dentro; Importar acepta .txt y .json.
  //  · Solo el archivo, sin title ni text: con texto, Drive se queda con el texto y tira el archivo.
  //  · Solo en pantallas táctiles: en Windows el menú de compartir no ofrece Drive.
  function exportFile() {
    const base = `catan-copia-${today()}`;
    const content = JSON.stringify(Storage.get(), null, 2);
    const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;

    if (touch && navigator.share && navigator.canShare && typeof File === 'function') {
      const file = new File([content], `${base}.txt`, { type: 'text/plain' });
      let ok = false;
      try { ok = navigator.canShare({ files: [file] }); } catch {}
      if (ok) {
        navigator.share({ files: [file] })
          .then(() => {
            markExported();
            App.toast('📦 Copia guardada');
          })
          .catch(e => {
            if (e && e.name === 'AbortError') return; // cerró el menú: no es un fallo ni cuenta como copia
            download(`${base}.json`, content);
          });
        return;
      }
    }
    download(`${base}.json`, content);
  }

  function markExported() {
    const st = Storage.get().settings;
    st.lastExport = Date.now();
    st.unsaved = 0;
    Storage.save();
    renderReminder();
    renderSettings();
  }

  // Llamar al guardar una partida nueva.
  function gameAdded() {
    const st = Storage.get().settings;
    st.unsaved = (st.unsaved || 0) + 1;
    Storage.save();
    snapshot('Partida guardada');
    renderReminder();
  }

  // ---------- Pantalla ----------

  const fmt = t => new Date(t).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  function renderReminder() {
    const n = Storage.get()?.settings.unsaved || 0;
    const box = $('#backup-reminder');
    if (!box) return;
    box.hidden = n < REMIND_EVERY;
    box.querySelector('.br-text').textContent = `📦 Llevas ${n} partidas sin copia fuera del móvil.`;
  }

  async function renderSettings() {
    const st = Storage.get()?.settings || {};
    $('#backup-last').textContent = st.lastExport
      ? `Última copia fuera del móvil: ${fmt(st.lastExport)}${st.unsaved ? ` · ${st.unsaved} partidas nuevas desde entonces` : ''}`
      : 'Aún no has guardado ninguna copia fuera del móvil.';
    let snaps = [];
    try { snaps = await list(); } catch {}
    $('#snapshots').innerHTML = snaps.length ? snaps.map(s => `
      <li>
        <div><b>${fmt(s.at)}</b><small>${Stats.esc(s.reason)} · ${s.games} ${s.games === 1 ? 'partida' : 'partidas'}</small></div>
        <button type="button" class="btn small-btn" data-at="${s.at}">↺ Restaurar</button>
      </li>`).join('') : '<li class="empty">Todavía no hay copias automáticas.</li>';
  }

  function init() {
    $('#export-btn').addEventListener('click', exportFile);
    $('#backup-reminder .br-save').addEventListener('click', exportFile);
    $('#backup-reminder .br-later').addEventListener('click', () => { $('#backup-reminder').hidden = true; });
    $('#snapshots').addEventListener('click', e => {
      const b = e.target.closest('[data-at]');
      if (b) restore(+b.dataset.at);
    });
    renderReminder();
    // Una copia al día al abrir la app (si los datos han cambiado).
    prune().then(list).then(all => {
      renderSettings();
      if (!all.length || Date.now() - all[0].at > DAY) snapshot('Copia diaria');
    }).catch(() => renderSettings());
  }

  return { init, snapshot, gameAdded, exportFile, renderSettings, renderReminder };
})();
