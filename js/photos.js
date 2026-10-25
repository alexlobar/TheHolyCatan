// Fotos de las partidas. Van en IndexedDB (no en localStorage, que solo admite ~5 MB),
// comprimidas a JPEG de 1280 px como máximo (~100–200 KB). La partida guarda `photo: true`.
const Photos = (() => {
  const DB = 'catan-photos';
  const STORE = 'photos';
  const urls = new Map();  // id → objectURL ya creado
  const blobs = new Map(); // id → Blob ya leído (para compartir sin esperar a IndexedDB:
                           // Safari exige llamar a navigator.share justo tras el toque)
  let dbp = null;

  function db() {
    dbp ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
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
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  const get = id => run('readonly', s => s.get(id));

  function forget(id) {
    if (urls.has(id)) URL.revokeObjectURL(urls.get(id));
    urls.delete(id);
    blobs.delete(id);
  }

  async function put(id, blob) {
    forget(id);
    await run('readwrite', s => s.put(blob, id));
  }

  async function remove(id) {
    forget(id);
    await run('readwrite', s => s.delete(id));
  }

  async function clear() {
    [...urls.keys()].forEach(forget);
    await run('readwrite', s => s.clear());
  }

  async function url(id) {
    if (urls.has(id)) return urls.get(id);
    const blob = await get(id);
    if (!blob) return null;
    const u = URL.createObjectURL(blob);
    urls.set(id, u);
    blobs.set(id, blob);
    return u;
  }

  // Redimensiona y comprime. <img> respeta la orientación EXIF de la cámara.
  async function compress(file, max = 1280, quality = 0.72) {
    const src = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = src;
      await img.decode();
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * k);
      canvas.height = Math.round(img.naturalHeight * k);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      return await new Promise((resolve, reject) =>
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo comprimir'))), 'image/jpeg', quality));
    } finally {
      URL.revokeObjectURL(src);
    }
  }

  // Abre la cámara o la galería y guarda la foto de la partida `gameId`.
  function pick(gameId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        await put(gameId, await compress(file));
        const g = Storage.get().games.find(x => x.id === gameId);
        if (g) { g.photo = true; Storage.save(); }
        App.toast('📷 Foto guardada');
        App.refresh();
      } catch (e) {
        console.warn(e);
        App.toast('No se pudo guardar la foto');
      }
    });
    input.click();
  }

  // ---------- Visor a pantalla completa ----------

  let viewing = null;

  async function view(gameId) {
    const u = await url(gameId);
    if (!u) return App.toast('No se encuentra la foto en este dispositivo');
    viewing = gameId;
    const s = Storage.get();
    const g = s.games.find(x => x.id === gameId);
    const dlg = document.getElementById('photo-viewer');
    dlg.querySelector('img').src = u;
    dlg.querySelector('.viewer-caption').textContent = g
      ? `Partida ${Stats.toRoman(Stats.gameNumber(s.games, g))} · 🏆 ${g.winner} · ${Stats.fmtDate(g.date)}`
      : '';
    dlg.showModal();
  }

  function initViewer() {
    const dlg = document.getElementById('photo-viewer');
    dlg.querySelector('[data-act="close"]').addEventListener('click', () => dlg.close());
    dlg.querySelector('[data-act="share"]').addEventListener('click', () => Tracker.shareGame(viewing));
    dlg.querySelector('[data-act="change"]').addEventListener('click', () => { dlg.close(); pick(viewing); });
    dlg.querySelector('[data-act="delete"]').addEventListener('click', async () => {
      if (!confirm('¿Borrar la foto de esta partida?')) return;
      await remove(viewing);
      const g = Storage.get().games.find(x => x.id === viewing);
      if (g) { delete g.photo; Storage.save(); }
      dlg.close();
      App.refresh();
    });
    // Tocar fuera de la foto cierra.
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  }

  // Archivo para compartir (WhatsApp acepta texto + imagen). Síncrono si la foto ya se ha mostrado.
  const asFile = (id, blob) => new File([blob], `catan-partida-${id}.jpg`, { type: 'image/jpeg' });
  const cachedFile = id => (blobs.has(id) ? asFile(id, blobs.get(id)) : null);
  async function file(id) {
    const blob = blobs.get(id) || await get(id);
    return blob ? asFile(id, blob) : null;
  }

  return { pick, view, url, remove, clear, file, cachedFile, initViewer };
})();
