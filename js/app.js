// Arranque, navegación por pestañas, ajustes y utilidades comunes.
const App = (() => {
  // Debe coincidir con CACHE en sw.js y data-build en index.html.
  const VERSION = '1.12.4';
  const BUILD_DATE = '2026-10-28';
  const CACHE_PREFIX = 'catan-v';        // igual que CACHE en sw.js, sin la versión
  const DATA_PREFIX = 'catan';           // todas las claves de localStorage de esta app empiezan así
  const STORAGE_MAX = 5 * 1024 * 1024;   // tope de localStorage por dominio
  const BANNER_KEY = 'catan-install-banner-closed';
  const $ = sel => document.querySelector(sel);
  let toastTimer;

  /* Chrome Android (≤157) dice «ya está instalada» en el menú ⋮ si hay OTRA app instalada
     en el mismo dominio (TU-USUARIO.github.io). beforeinstallprompt sí mira la carpeta:
     lo capturamos en cuanto carga el script y lo ofrecemos con un botón propio. */
  let installPrompt = null;
  let installed = false;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); // sin mini-barra de Chrome: usamos nuestros botones
    installPrompt = e;
    renderInstall();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    installed = true;
    renderInstall();
    requestPersist(); // al instalarla es cuando Chrome suele conceder la protección
  });

  // ---------- Arranque a prueba de fallos ----------
  // Cada pieza arranca por separado: si una falla (dato raro, navegador antiguo, archivo
  // de otra versión), las demás siguen funcionando y se avisa con el error en pantalla.
  const errors = [];

  function reportError(where, e) {
    const msg = `${where}: ${e && e.message ? e.message : e}`;
    console.error(msg, e);
    if (errors.includes(msg)) return;
    errors.push(msg);
    const box = $('#app-error');
    if (!box) return;
    box.hidden = false;
    box.querySelector('.err-list').textContent = errors.join('\n');
  }

  function safe(where, fn) {
    try { return fn(); } catch (e) { reportError(where, e); }
  }

  window.addEventListener('error', e => reportError('Error', e.error || e.message));
  window.addEventListener('unhandledrejection', e => reportError('Promesa', e.reason));

  function init() {
    safe('Datos', () => Storage.load());
    safe('Pestañas', initTabs); // lo primero: así siempre se puede navegar
    safe('Tema', initTheme);
    safe('Holy Table', () => Tables.init());
    safe('Tracker', () => Tracker.init());
    safe('Partida', () => Game.init());
    safe('Stats', () => Profile.init());
    safe('Reglas', () => Rules.init());
    safe('Mientras esperas', () => Fun.init());
    safe('Wrapped', () => Wrapped.init());
    safe('Modo mesa', () => Mesa.init());
    safe('Fotos', () => Photos.initViewer());
    safe('Copias', () => Backup.init());
    safe('Deshacer', initUndo);
    safe('Ajustes', initSettings);
    safe('Jugadores', initPlayers);
    safe('Jugadores', renderPlayers);
    safe('Instalar', initInstall);
    safe('Protección de datos', requestPersist);
    safe('Pestaña inicial', openLastTab);
    safe('Aviso de error', initErrorBox);
  }

  function initErrorBox() {
    const box = $('#app-error');
    box.querySelector('.err-copy').addEventListener('click', () => {
      const text = `Catán Tracker ${VERSION} · ${navigator.userAgent}\n${errors.join('\n')}`;
      navigator.clipboard?.writeText(text).then(() => toast('📋 Error copiado'), () => prompt('Copia el error:', text));
    });
    box.querySelector('.err-reload').addEventListener('click', () => location.reload());
    box.querySelector('.err-close').addEventListener('click', () => { box.hidden = true; });
  }

  // ---------- Deshacer ----------
  // Al borrar algo se hace al momento y aparece «↩ Deshacer» unos segundos. Si no se pulsa,
  // se ejecuta `onCommit` (p. ej. borrar la foto de verdad). Un borrado nuevo confirma el anterior.
  let undoTimer = null;
  let pendingCommit = null;

  function undo(msg, onUndo, onCommit = null) {
    flushUndo();
    const bar = $('#undo-bar');
    bar.querySelector('.undo-text').textContent = msg;
    bar.hidden = false;
    pendingCommit = onCommit;
    bar.querySelector('.undo-btn').onclick = () => {
      clearTimeout(undoTimer);
      bar.hidden = true;
      pendingCommit = null;
      safe('Deshacer', onUndo);
      toast('↩ Deshecho');
    };
    undoTimer = setTimeout(flushUndo, 7000);
  }

  function flushUndo() {
    clearTimeout(undoTimer);
    const bar = $('#undo-bar');
    if (bar) bar.hidden = true;
    const commit = pendingCommit;
    pendingCommit = null;
    if (commit) safe('Borrar', commit);
  }

  function initUndo() {
    // Si se cierra o se oculta la app con un borrado pendiente, se confirma.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushUndo(); });
  }

  // Vuelve a pintar todas las vistas tras un cambio de datos (cada una por separado).
  function refresh() {
    safe('Tracker', () => Tracker.render());
    safe('Holy Table', () => Tables.render());
    safe('Partida', () => Game.render());
    safe('Stats', () => Profile.render());
    safe('Reglas', () => Rules.render());
    safe('Mientras esperas', () => Fun.render());
    safe('Jugadores', renderPlayers);
  }

  // Compartir texto (+ foto si la hay) con la hoja nativa del móvil (WhatsApp, Telegram…); si no hay, copiar.
  async function share(text, file = null) {
    if (navigator.share) {
      const data = file && navigator.canShare?.({ files: [file] }) ? { text, files: [file] } : { text };
      try { await navigator.share(data); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('📋 Resumen copiado: pégalo en WhatsApp');
    } catch {
      prompt('Copia el resumen:', text);
    }
  }

  // ---------- Tema claro / oscuro ----------
  // Preferencia de este dispositivo (no va en la copia de seguridad).
  const THEME_KEY = 'catan-app-theme';
  const darkQuery = matchMedia('(prefers-color-scheme: dark)');

  function getTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch { return 'auto'; }
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
    else delete root.dataset.theme;
    const dark = theme === 'dark' || (theme === 'auto' && darkQuery.matches);
    document.querySelector('meta[name="theme-color"]').content = dark ? '#7d3420' : '#b5462a';
    document.querySelectorAll('#theme-switch button').forEach(b => {
      const on = b.dataset.theme === theme;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on);
    });
  }

  function initTheme() {
    applyTheme(getTheme());
    // Safari < 14 solo tiene addListener en MediaQueryList.
    const onChange = () => applyTheme(getTheme());
    if (darkQuery.addEventListener) darkQuery.addEventListener('change', onChange);
    else if (darkQuery.addListener) darkQuery.addListener(onChange);
    $('#theme-switch').addEventListener('click', e => {
      const b = e.target.closest('[data-theme]');
      if (!b) return;
      try { localStorage.setItem(THEME_KEY, b.dataset.theme); } catch {}
      applyTheme(b.dataset.theme);
    });
  }

  // Instalación como app: service worker (offline) + botón propio en Android + instrucciones en iOS.
  function initInstall() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('./sw.js').catch(e => console.warn('Service worker no registrado', e));
    }

    document.querySelectorAll('.install-trigger').forEach(b => b.addEventListener('click', install));
    $('#install-banner .banner-close').addEventListener('click', () => {
      try { localStorage.setItem(BANNER_KEY, '1'); } catch {}
      renderInstall();
    });
    renderInstall();
  }

  async function install() {
    if (!installPrompt) return;
    const ev = installPrompt;
    installPrompt = null; // cada aviso solo se puede usar una vez
    renderInstall();
    ev.prompt();
    try { await ev.userChoice; } catch {}
  }

  function renderInstall() {
    const status = $('#install-status');
    if (!status) return; // el aviso puede llegar antes de que exista el DOM; se pinta en initInstall()

    const standalone = installed || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    let closed = false;
    try { closed = localStorage.getItem(BANNER_KEY) === '1'; } catch {}

    $('#install-btn').hidden = !installPrompt;
    $('#install-banner').hidden = !installPrompt || closed;

    if (standalone) {
      status.textContent = installed
        ? '✔ App instalada. Ábrela desde la pantalla de inicio.'
        : '✔ Ya estás usando la app instalada.';
    } else if (ios) {
      status.innerHTML = 'iPhone / iPad: abre esta página en <b>Safari</b>, pulsa <b>Compartir</b> (el cuadrado con la flecha ↑) y elige <b>Añadir a pantalla de inicio</b>.';
    } else if (installPrompt) {
      status.innerHTML = 'Pulsa <b>Instalar app</b> para tenerla en la pantalla de inicio y usarla sin conexión.';
    } else {
      status.innerHTML = 'Android: abre esta dirección <b>en Chrome</b> (no desde otra app instalada) y recarga una o dos veces hasta que aparezca el botón <b>Instalar app</b>. No uses el menú ⋮: si tienes otra app de github.io instalada, Chrome dice por error «ya está instalada».';
    }
  }

  // Cambia de vista. Las de la barra superior (📜 Reglas, 🎮 Mientras esperas) no están en la inferior.
  function show(view) {
    // Primero se cambia de vista (esto nunca debe fallar); luego se repinta.
    document.querySelectorAll('[data-view]').forEach(b => {
      const on = b.dataset.view === view;
      b.classList.toggle('active', on);
      if (b.closest('.topbar')) b.setAttribute('aria-pressed', on);
    });
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
    try { localStorage.setItem('catan-app-tab', view); } catch {}
    window.scrollTo(0, 0);
    if (view !== 'fun') safe('Mientras esperas', () => Fun.leave()); // para los juegos con reloj (Loly, ¿Te llega?, Simón)
    refresh(); // por si otra pestaña cambió datos (p. ej. una mesa nueva en la Holy Table)
    if (view === 'settings') safe('Versión', renderBuildInfo);
  }

  function initTabs() {
    document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
  }

  function openLastTab() {
    let last = null;
    try { last = localStorage.getItem('catan-app-tab'); } catch {}
    // Con una partida en curso se abre directamente en ella.
    if (Storage.get()?.current) last = 'game';
    if (last && $(`#view-${last}`)) show(last);
  }

  function initSettings() {
    const seasonSel = $('#season-mode');
    seasonSel.innerHTML = Object.entries(Stats.SEASON_MODES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    seasonSel.value = Storage.get().settings.seasonMode;
    seasonSel.addEventListener('change', () => {
      Storage.get().settings.seasonMode = seasonSel.value;
      Storage.save();
      refresh();
      toast('Temporadas: ' + Stats.SEASON_MODES[seasonSel.value].toLowerCase());
    });

    // (El botón «Exportar» lo gestiona backup.js: compartir el archivo o descargarlo.)

    $('#import-file').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        await Backup.snapshot('Antes de importar');
        Storage.replace(data);
        Backup.renderSettings();
        Backup.renderReminder();
        $('#season-mode').value = Storage.get().settings.seasonMode;
        Tracker.resetForm();
        refresh();
        toast('Datos importados ✔');
      } catch {
        toast('Ese archivo no es una copia válida');
      }
      e.target.value = '';
    });

    $('#reset-games').addEventListener('click', async () => {
      if (confirm('¿Borrar TODAS las partidas? (Se guarda antes una copia automática, restaurable desde aquí.)')) {
        await Backup.snapshot('Antes de borrar el historial');
        Tracker.clearAll();
        toast('Historial borrado');
      }
    });

    $('#reset-decks').addEventListener('click', async () => {
      if (confirm('¿Volver a las cartas originales de las tablas de la casa? Las tablas propias se borran. (Se guarda antes una copia automática.)')) {
        await Backup.snapshot('Antes de restaurar las tablas');
        Tables.reset();
        toast('Tablas restauradas');
      }
    });
  }

  // ---------- Jugadores e invitados ----------

  let onGuestAdded = null;

  // Abre el diálogo de nuevo invitado; al añadirlo llama a done(nombre) (p. ej. para marcarlo).
  function addGuest(done = null) {
    onGuestAdded = done;
    $('#guest-name').value = '';
    $('#guest-emoji').value = '';
    $('#guest-dialog').showModal();
    $('#guest-name').focus();
  }

  function initPlayers() {
    const dlg = $('#guest-dialog');
    dlg.querySelector('[data-act="cancel"]').addEventListener('click', () => dlg.close());
    dlg.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const name = $('#guest-name').value.trim().replace(/\s+/g, ' ');
      const err = Storage.addGuest(name, $('#guest-emoji').value);
      if (err) return toast(err);
      dlg.close();
      toast(`👋 ${Stats.who(name)} añadido como invitado`);
      const done = onGuestAdded;
      onGuestAdded = null;
      refresh();
      if (done) safe('Invitado', () => done(name));
    });
    $('#guest-add').addEventListener('click', () => addGuest());
    $('#players-list').addEventListener('click', e => {
      const f = e.target.closest('[data-ficha]');
      if (f) {
        Profile.showPlayer(f.dataset.ficha);
        return show('stats');
      }
      const b = e.target.closest('[data-remove]');
      if (!b) return;
      const s = Storage.get();
      const name = b.dataset.remove;
      if (s.current?.players.includes(name)) return toast(`${name} está jugando la partida en curso`);
      const i = s.guests.findIndex(g => g.name === name);
      const guest = s.guests[i];
      s.guests.splice(i, 1);
      Storage.save();
      refresh();
      undo(`👋 ${name} quitado de los invitados`, () => {
        s.guests.splice(i, 0, guest);
        Storage.save();
        refresh();
      });
    });
  }

  // Cada jugador con su título principal; al tocarlo se abre su ficha en 📊 Stats.
  function renderPlayers() {
    const s = Storage.get();
    const { esc } = Stats;
    const played = name => s.games.filter(g => g.players.includes(name)).length;
    const games = n => `${played(n)} ${played(n) === 1 ? 'partida' : 'partidas'}`;
    const titles = Stats.titles(Stats.valid(s.games), s.players, s.settings.seasonMode).byPlayer;
    const open = (name, sub) => `<button type="button" class="pl-open" data-ficha="${esc(name)}"><b>${esc(Stats.who(name))}</b><small>${sub}</small></button>`;
    $('#players-list').innerHTML = [
      ...s.players.map(p => {
        const t = titles[p]?.[0];
        return `<li>${open(p, `fundador · ${games(p)}${t ? ` · ${t.icon} ${esc(t.name)}` : ''}`)}</li>`;
      }),
      ...s.guests.map(g => `<li class="guest">${open(g.name, `invitado · ${games(g.name)}`)}
        <button type="button" class="icon-btn" data-remove="${esc(g.name)}" aria-label="Quitar a ${esc(g.name)} de los invitados">✕</button></li>`),
    ].join('');
  }

  // ---------- Versión, tamaño y espacio (final de Ajustes) ----------
  // Derecha: versión guardada en la caché offline, su fecha y lo que ocupa todo (app + datos).
  // Debajo: los datos frente al tope de localStorage (5 MB por dominio, compartido con las
  // demás apps de usuario.github.io). Las fotos y copias automáticas van en IndexedDB y no cuentan.

  const buildDate = () => BUILD_DATE.split('-').reverse().join('/');
  const formatKB = bytes => {
    const kb = bytes / 1024;
    return `${kb.toLocaleString('es-ES', { maximumFractionDigits: kb < 10 ? 1 : 0 })} KB`;
  };

  // En caracteres (claves incluidas), que es como cuenta el navegador el tope.
  function storageUse() {
    let mine = 0, others = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const size = k.length + (localStorage.getItem(k) || '').length;
        if (k.startsWith(DATA_PREFIX)) mine += size;
        else others += size;
      }
    } catch {}
    return { mine, others, max: STORAGE_MAX };
  }

  const cacheBytes = name => caches.open(name)
    .then(cache => cache.keys().then(reqs => Promise.all(reqs.map(req =>
      cache.match(req).then(res => (res ? res.blob() : null)).then(b => (b ? b.size : 0))))))
    .then(sizes => sizes.reduce((a, b) => a + b, 0));

  function setHint(text) {
    $('#build-hint').textContent = text;
    $('#build-hint').hidden = !text;
  }

  function renderQuota(use) {
    const quota = $('#build-quota');
    const pct = (use.mine + use.others) / use.max * 100;
    let text = `Datos: ${formatKB(use.mine)} de ${formatKB(use.max)} máx.`;
    if (use.others >= 1024) text += ` · otras apps: ${formatKB(use.others)}`;
    if (pct >= 1) text += ` (${Math.round(pct)} %)`;
    quota.textContent = text;
    quota.dataset.state = pct >= 90 ? 'full' : pct >= 70 ? 'high' : 'ok';
    quota.title = 'El navegador guarda hasta 5 MB por sitio (las fotos van aparte).';
  }

  // Datos protegidos: sin esto el navegador puede borrarlos si le falta espacio (Safari, además,
  // tras días sin abrir la web). Protege todo el dominio (también fotos y copias), pero no amplía los 5 MB.
  function renderPersist() {
    const el = $('#build-persist');
    if (!el) return;
    if (!navigator.storage || !navigator.storage.persisted) { el.hidden = true; return; }
    navigator.storage.persisted().then(yes => {
      el.hidden = false;
      el.dataset.state = yes ? 'ok' : 'risk';
      el.textContent = yes ? '🔒 Protegidos: el navegador no los borrará' : '⚠️ Sin proteger: el navegador podría borrarlos';
      el.title = yes
        ? 'El navegador los trata como persistentes: no los borra aunque le falte espacio.'
        : 'Si le falta espacio (o, en Safari, tras días sin abrirla) podría borrarlos. Instalar la app y usarla a menudo suele bastar para que los proteja. Guarda copias fuera del móvil.';
    }).catch(() => { el.hidden = true; });
  }

  // Se pide en cada arranque mientras no esté concedido: Chrome lo decide por uso e instalación,
  // así que un «no» de hoy puede ser un «sí» mañana.
  function requestPersist() {
    if (!navigator.storage || !navigator.storage.persist) return;
    navigator.storage.persisted()
      .then(yes => yes || navigator.storage.persist())
      .catch(() => {})
      .then(renderPersist);
  }

  function renderBuildInfo() {
    const cache = $('#build-cache');
    const use = storageUse();
    const data = use.mine;
    renderQuota(use);
    renderPersist();

    // La fecha solo se pone si la versión guardada es la del código: de una vieja no la sabemos.
    const line = (version, appBytes) =>
      `v${version}${version === VERSION ? ` · ${buildDate()}` : ''} · ${formatKB(appBytes + data)}`;

    setHint('');
    cache.dataset.state = 'plain';
    cache.title = '';

    // Se mira el protocolo y no isSecureContext: file:// cuenta como seguro pero su caché no se puede leer.
    if (location.protocol === 'file:' || !window.caches) {
      cache.textContent = line(VERSION, 0);
      cache.title = 'Sin caché offline: solo cuentan tus datos';
      return;
    }

    const expected = CACHE_PREFIX + VERSION;
    cache.textContent = 'Comprobando…';
    caches.keys().then(keys => {
      const mine = keys.filter(k => k.startsWith(CACHE_PREFIX));
      if (!mine.length) {
        cache.textContent = line(VERSION, 0);
        setHint('Todavía no se ha guardado una copia offline.');
        return null;
      }
      // Justo al actualizar pueden convivir dos: se enseña la nueva y se suman ambas.
      const stale = !mine.includes(expected);
      const name = stale ? mine[mine.length - 1] : expected;
      return Promise.all(mine.map(cacheBytes)).then(sizes => {
        const app = sizes.reduce((a, b) => a + b, 0);
        cache.textContent = line(name.replace(CACHE_PREFIX, ''), app);
        cache.title = `App ${formatKB(app)} + datos ${formatKB(data)}`;
        cache.dataset.state = stale ? 'stale' : 'ok';
        if (stale) setHint(`La copia offline no coincide con la v${VERSION}. Cierra la app del todo y ábrela otra vez para que se actualice.`);
      });
    }).catch(() => {
      cache.textContent = line(VERSION, 0);
      cache.title = 'No se pudo leer la caché: solo cuentan tus datos';
    });
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  document.addEventListener('DOMContentLoaded', init);
  return { toast, refresh, share, show, undo, addGuest };
})();
