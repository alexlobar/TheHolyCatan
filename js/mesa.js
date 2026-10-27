// 📺 Modo mesa: pantalla completa para dejar el móvil o la tablet en la mesa.
// Con partida en curso (se abre solo al empezarla) tiene tres pestañas:
//   🏅 Marcador (jugadores con − / + grandes), 🎴 Holy Table (habilidades de la partida) y 🏆 Liga.
// Sin partida, solo la clasificación. Mantiene la pantalla encendida; ✕ vuelve a la app.
const Mesa = (() => {
  const $ = sel => document.querySelector(sel);
  const { esc, toRoman, rich } = Stats;
  const TABS = {
    points: { label: '🏅 Marcador', render: points },
    abilities: { label: '🎴 Holy Table', render: abilities },
    league: { label: '🏆 Liga', render: ranking },
  };
  let tab = 'points';
  let tickTimer = null;
  let wakeLock = null;

  const state = () => Storage.get();
  const ov = () => $('#mesa');
  const isOpen = () => !ov().hidden;
  const tabsNow = () => (state().current ? ['points', 'abilities', 'league'] : ['league']);

  function init() {
    $('#mesa-open').addEventListener('click', open);
    ov().querySelector('.mesa-close').addEventListener('click', close);
    ov().querySelector('.mesa-pause').addEventListener('click', () => { Game.togglePause(); renderTop(); });
    ov().querySelector('.mesa-tabs').addEventListener('click', e => {
      const b = e.target.closest('[data-tab]');
      if (b) { tab = b.dataset.tab; render(); }
    });
    // Marcador: − / + y «Terminar partida».
    ov().querySelector('.mesa-stage').addEventListener('click', e => {
      const b = e.target.closest('[data-p]');
      if (b) {
        Game.addPoint(b.dataset.p, +b.dataset.d);
        return render();
      }
      if (e.target.closest('[data-finish]')) { close(); Game.goFinish(); }
    });
    document.addEventListener('keydown', e => {
      if (!isOpen()) return;
      if (e.key === 'Escape') close();
      const list = tabsNow();
      const i = list.indexOf(tab);
      if (e.key === 'ArrowRight') { tab = list[(i + 1) % list.length]; render(); }
      if (e.key === 'ArrowLeft') { tab = list[(i - 1 + list.length) % list.length]; render(); }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isOpen()) { keepAwake(); render(); }
    });
    // Si se sale de pantalla completa con el botón atrás del móvil, se cierra el modo mesa.
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && isOpen() && ov().dataset.fs) close();
    });
  }

  // ---------- Pestañas ----------

  function points() {
    const c = state().current;
    const goal = Game.GOAL;
    const pts = p => c.points[p] ?? Game.START_POINTS;
    const winner = c.players.find(p => pts(p) >= goal);
    return `
      ${winner ? `
        <div class="mesa-win">
          <span>🏆 <b>${esc(Stats.who(winner))}</b> llega a ${pts(winner)}</span>
          <button type="button" class="btn primary" data-finish>🏁 Terminar partida</button>
        </div>` : ''}
      <ul class="mesa-points">${c.players.map(p => {
        const n = pts(p);
        return `
        <li class="${n >= goal ? 'goal' : n === goal - 1 ? 'near' : ''}" style="--pc:${Stats.colorOf(p)}">
          <span class="mp-name">${esc(Stats.who(p))}</span>
          <button type="button" class="mp-btn" data-p="${esc(p)}" data-d="-1" aria-label="Quitar un punto a ${esc(p)}">−</button>
          <b class="mp-n" aria-live="polite">${n}</b>
          <button type="button" class="mp-btn plus" data-p="${esc(p)}" data-d="1" aria-label="Sumar un punto a ${esc(p)}">+</button>
          <span class="mp-bar" aria-hidden="true"><i style="width:${Math.min(100, n / goal * 100)}%"></i></span>
        </li>`;
      }).join('')}
      </ul>
      <p class="mesa-hint">Se gana a ${goal} · los puntos se guardan con la partida</p>`;
  }

  function abilities() {
    const c = state().current;
    if (!c.abilities.length) return '<p class="mesa-kicker">Partida sin habilidades.</p>';
    return `
      <ul class="mesa-abilities">${c.abilities.map(a => {
        const def = Storage.TABLES.find(t => t.id === a.deck);
        const color = Storage.COLORS.find(x => x.id === a.color);
        return `
        <li style="--slot:var(--c-${a.color})">
          <div class="ma-head">
            <span class="ma-color">${color ? color.name : ''}</span>
            <b>${esc(a.name)}</b>
            ${def ? `<span class="origin" style="--accent:${def.color}">${esc(def.icon)} ${esc(def.short)}</span>` : ''}
          </div>
          ${a.cost || a.benefit ? `<div class="pills">${a.cost ? `<span class="pill cost">Tú: ${esc(a.cost)}</span>` : ''}${a.benefit ? `<span class="pill benefit">Resto: ${esc(a.benefit)}</span>` : ''}</div>` : ''}
          <p>${rich(a.desc)}</p>
        </li>`;
      }).join('')}
      </ul>`;
  }

  function ranking() {
    const { players, settings } = state();
    const mode = settings.seasonMode;
    const key = mode === 'none' ? 'all' : Stats.currentSeason(mode);
    const rows = Stats.seasonRanking(Stats.valid(state().games), players, key, mode);
    const any = rows.some(r => r.wins);
    return `
      <p class="mesa-kicker">✨ Liga de Catanes · ${esc(Stats.seasonLabel(key))}</p>
      <ol class="mesa-rank">${rows.map(r => `
        <li class="${r.guest ? 'guest' : ''} ${r.rank === 1 && r.wins ? 'first' : ''}">
          <span class="mr-medal">${any ? Stats.rowMedal(rows, r) : ''}</span>
          <span class="mr-name">${esc(Stats.who(r.name))}</span>
          <span class="mr-wins roman">${toRoman(r.wins) || '–'}</span>
        </li>`).join('')}
      </ol>`;
  }

  // ---------- Pintar ----------

  function renderTop() {
    const c = state().current;
    const pause = ov().querySelector('.mesa-pause');
    ov().querySelector('.mesa-clock').textContent = c ? `⏱ ${Game.clock()}` : '';
    pause.hidden = !c;
    if (c) pause.textContent = c.timer.since ? '⏸' : '▶';
    if (c) pause.setAttribute('aria-label', c.timer.since ? 'Pausar el cronómetro' : 'Seguir con el cronómetro');
  }

  function render() {
    const list = tabsNow();
    if (!list.includes(tab)) tab = list[0];
    renderTop();
    const nav = ov().querySelector('.mesa-tabs');
    nav.hidden = list.length < 2;
    nav.innerHTML = list.map(t =>
      `<button type="button" role="tab" data-tab="${t}" class="${t === tab ? 'on' : ''}" aria-selected="${t === tab}">${TABS[t].label}</button>`).join('');
    const stage = ov().querySelector('.mesa-stage');
    const changed = stage.dataset.tab !== tab; // al sumar puntos no se anima, solo al cambiar de pestaña
    stage.dataset.tab = tab;
    stage.innerHTML = `<div class="mesa-slide ${changed ? 'enter' : ''}">${TABS[tab].render()}</div>`;
  }

  function open() {
    tab = state().current ? 'points' : 'league';
    ov().hidden = false;
    document.body.classList.add('mesa-on');
    render();
    clearInterval(tickTimer);
    tickTimer = setInterval(renderTop, 1000);
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().then(() => { ov().dataset.fs = '1'; }).catch(() => {});
    }
    keepAwake();
  }

  function close() {
    ov().hidden = true;
    delete ov().dataset.fs;
    delete ov().querySelector('.mesa-stage').dataset.tab;
    document.body.classList.remove('mesa-on');
    clearInterval(tickTimer);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    wakeLock?.release().catch(() => {});
    wakeLock = null;
    App.refresh(); // los puntos marcados en la mesa se ven también en la pestaña Partida
  }

  async function keepAwake() {
    if (!('wakeLock' in navigator) || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch {}
  }

  return { init, open, isOpen };
})();
