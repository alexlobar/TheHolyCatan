// 📦 Copias de seguridad.
//  · Automáticas (en el móvil, IndexedDB): al guardar/editar/borrar partidas, antes de importar
//    o restaurar, y una vez al día al abrir la app. Se guardan las 15 últimas y se pueden restaurar.
//  · Fuera del móvil: archivo JSON compartido (Drive, WhatsApp, correo…) o descargado. Cada
//    10 partidas nuevas sin copia, la app lo recuerda (si se borran los datos del navegador,
//    las copias internas también se pierden: la buena es la de fuera).
const Backup = (() => {
  const $ = sel => document.querySelector(sel);
  const DB = 'catan-backups';
  const STORE = 'snaps';
  const MAX = 15;
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
      for (const old of (await list()).slice(MAX)) await run('readwrite', st => st.delete(old.at));
      renderSettings();
    } catch (e) {
      console.warn('Copia automática no guardada', e);
    }
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

  function makeFile() {
    const json = JSON.stringify(Storage.get(), null, 2);
    return new File([json], `catan-copia-${today()}.json`, { type: 'application/json' });
  }

  function download(file) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000); // en Safari/iOS revocarlo al instante cancela la descarga
  }

  // En el móvil abre la hoja de compartir (Drive, WhatsApp, correo…); si no se puede, descarga.
  async function exportFile() {
    const file = makeFile();
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Copia de Catán Tracker' });
        markExported();
        App.toast('📦 Copia guardada');
        return;
      } catch (e) {
        if (e.name === 'AbortError') return; // cancelado: no cuenta como copia
      }
    }
    download(file);
    markExported();
    App.toast('📦 Copia descargada');
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
        <div><b>${fmt(s.at)}</b><small>${Stats.esc(s.reason)} · ${s.games} partidas</small></div>
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
    renderSettings();
    // Una copia al día al abrir la app.
    list().then(all => { if (!all.length || Date.now() - all[0].at > DAY) snapshot('Copia diaria'); }).catch(() => {});
  }

  return { init, snapshot, gameAdded, exportFile, renderSettings, renderReminder };
})();
