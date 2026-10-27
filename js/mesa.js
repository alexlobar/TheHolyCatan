// 📺 Modo mesa: pantalla completa para dejar el móvil o la tablet en la mesa durante la partida
// (se abre solo al empezarla). Cuatro pestañas:
//   🏅 Marcador (jugadores con − / + grandes), 🎴 Holy Table (habilidades de la partida),
//   🎮 Juegos (los de «Mientras esperas» a pantalla completa) y 🏁 Terminar (ganador, nota y guardar).
// Mantiene la pantalla encendida; ✕ vuelve a la app.
const Mesa = (() => {
  const $ = sel => document.querySelector(sel);
  const { esc, rich } = Stats;
  const TABS = {
    points: { icon: '🏅', label: 'Marcador', render: points },
    abilities: { icon: '🎴', label: 'Holy Table', render: abilities },
    fun: { icon: '🎮', label: 'Juegos', render: games },
    finish: { icon: '🏁', label: 'Terminar', render: finish },
  };
  let tab = 'points';
  let playing = null; // id de la tarjeta del juego abierto en la mesa (p. ej. 'g-sheep')
  let home = null;    // marca en «Mientras esperas» para devolver la tarjeta a su sitio
  let note = '';      // nota de «Terminar», se conserva al repintar
  let tickTimer = null;
  let wakeLock = null;

  const state = () => Storage.get();
  const ov = () => $('#mesa');
  const isOpen = () => !ov().hidden;
  const tabsNow = () => Object.keys(TABS);

  function init() {
    ov().querySelector('.mesa-close').addEventListener('click', close);
    ov().querySelector('.mesa-pause').addEventListener('click', () => { Game.togglePause(); renderTop(); });
    ov().querySelector('.mesa-tabs').addEventListener('click', e => {
      const b = e.target.closest('[data-tab]');
      if (b) go(b.dataset.tab);
    });
    // «Otros juegos»: la tarjeta vuelve a su sitio y se ve la lista.
    ov().querySelector('.mg-back').addEventListener('click', () => { returnGame(); render(); });
    const stage = ov().querySelector('.mesa-stage');
    stage.addEventListener('click', e => {
      const b = e.target.closest('[data-p]');
      if (b) {
        Game.addPoint(b.dataset.p, +b.dataset.d);
        return render();
      }
      const w = e.target.closest('[data-winner]');
      if (w) { Game.setWinner(w.dataset.winner); return render(); }
      const g = e.target.closest('[data-game]');
      if (g) return playGame(g.dataset.game);
      if (e.target.closest('[data-finish]')) return go('finish');
      if (e.target.closest('[data-save]')) return save();
      if (e.target.closest('[data-cancel]')) return cancel();
    });
    stage.addEventListener('input', e => { if (e.target.id === 'mesa-note') note = e.target.value; });
    document.addEventListener('keydown', e => {
      if (!isOpen() || e.target.matches('input, textarea')) return;
      if (e.key === 'Escape') close();
      const list = tabsNow();
      const i = list.indexOf(tab);
      if (e.key === 'ArrowRight') go(list[(i + 1) % list.length]);
      if (e.key === 'ArrowLeft') go(list[(i - 1 + list.length) % list.length]);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && isOpen()) { keepAwake(); render(); }
    });
    // Si se sale de pantalla completa con el botón atrás del móvil, se cierra el modo mesa.
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && isOpen() && ov().dataset.fs) close();
    });
  }

  function go(t) {
    tab = t;
    render();
  }

  // ---------- Pestañas ----------

  const pts = p => state().current.points[p] ?? Game.START_POINTS;

  function points() {
    const c = state().current;
    const goal = Game.GOAL;
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

  // Cada habilidad como una carta grande con el color de su carta bien visible.
  function abilities() {
    const c = state().current;
    if (!c.abilities.length) return '<p class="mesa-kicker">Partida sin habilidades.</p>';
    return `
      <ul class="mesa-abilities">${c.abilities.map(a => {
        const def = Storage.TABLES.find(t => t.id === a.deck);
        const color = Storage.COLORS.find(x => x.id === a.color);
        return `
        <li class="ma-card ma-${a.color}" style="--slot:var(--c-${a.color})">
          <div class="ma-band">
            <span class="ma-color">Carta ${color ? color.name.toLowerCase() : ''}</span>
            ${def ? `<span class="ma-origin">${esc(def.icon)} ${esc(def.short)}</span>` : ''}
          </div>
          <div class="ma-body">
            <h3 class="ma-name">${esc(a.name)}</h3>
            ${a.cost || a.benefit ? `<div class="ma-pills">${a.cost ? `<span class="pill cost">Tú: ${esc(a.cost)}</span>` : ''}${a.benefit ? `<span class="pill benefit">Resto: ${esc(a.benefit)}</span>` : ''}</div>` : ''}
            <p class="ma-desc">${rich(a.desc)}</p>
          </div>
        </li>`;
      }).join('')}
      </ul>`;
  }

  // Los juegos de «Mientras esperas»: se elige uno y su tarjeta se trae a la mesa.
  function games() {
    const list = [...document.querySelectorAll('#fun-nav [data-go]')];
    return `
      <p class="mesa-kicker">🥱 ¿Te aburres en el turno de otro?</p>
      <div class="mesa-games">${list.map(b =>
        `<button type="button" data-game="${b.dataset.go}">${b.innerHTML}</button>`).join('')}
      </div>
      <p class="mesa-hint">Puedes ir al marcador y volver: el juego sigue donde lo dejaste</p>`;
  }

  // Terminar: lo mismo que en la pestaña Partida (ganador, nota, guardar o cancelar).
  function finish() {
    const c = state().current;
    const winner = Game.winner();
    const founders = c.players.filter(p => Storage.FOUNDERS.includes(p)).length;
    return `
      <div class="mesa-finish">
        <h3>¿Quién ha ganado?</h3>
        <div class="mf-winners">${c.players.map(p => `
          <button type="button" class="${p === winner ? 'on' : ''}" data-winner="${esc(p)}" style="--pc:${Stats.colorOf(p)}" aria-pressed="${p === winner}">
            <span>${esc(Stats.who(p))}</span><b>${pts(p)}</b>
          </button>`).join('')}
        </div>
        ${founders < Storage.MIN_FOUNDERS ? '<p class="mf-warn">⚠️ Menos de 3 fundadores: la partida no cuenta para la liga.</p>' : ''}
        <label class="mf-note">Nota (opcional)
          <input type="text" id="mesa-note" maxlength="80" placeholder="Ej: remontada épica con el puerto 2:1" value="${esc(note)}">
        </label>
        <button type="button" class="btn primary big" data-save>🏁 Guardar partida</button>
        <button type="button" class="btn danger subtle" data-cancel>Cancelar partida</button>
      </div>`;
  }

  function save() {
    if (!Game.finish(note)) return render();
    note = '';
    close();
    App.show('game'); // resumen con logros, compartir, foto y revancha
  }

  function cancel() {
    if (!Game.cancel()) return;
    note = '';
    close();
    App.show('game');
  }

  // ---------- Juegos ----------

  function playGame(id) {
    returnGame();
    const card = document.getElementById(id);
    if (!card) return;
    home = document.createComment('juego en el modo mesa');
    card.before(home);
    ov().querySelector('.mg-slot').append(card);
    playing = id;
    Fun.render();
    render();
  }

  function returnGame() {
    if (!playing) return;
    const card = document.getElementById(playing);
    if (card && home) home.replaceWith(card);
    home = null;
    playing = null;
    Fun.leave(); // para los juegos con reloj
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
    if (!state().current) return close(); // la partida ha terminado (o se canceló desde otro sitio)
    renderTop();
    const nav = ov().querySelector('.mesa-tabs');
    nav.innerHTML = tabsNow().map(t =>
      `<button type="button" role="tab" data-tab="${t}" class="${t === tab ? 'on' : ''}" aria-selected="${t === tab}"><span class="mt-ico" aria-hidden="true">${TABS[t].icon}</span>${TABS[t].label}</button>`).join('');
    const stage = ov().querySelector('.mesa-stage');
    const inGame = tab === 'fun' && !!playing;
    ov().querySelector('.mesa-game').hidden = !inGame;
    stage.hidden = inGame;
    if (inGame) return;
    const changed = stage.dataset.tab !== tab; // al sumar puntos no se anima, solo al cambiar de pestaña
    stage.dataset.tab = tab;
    stage.innerHTML = `<div class="mesa-slide ${changed ? 'enter' : ''}">${TABS[tab].render()}</div>`;
    if (changed) stage.scrollTop = 0;
  }

  function open() {
    if (!state().current) return;
    tab = 'points';
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
    if (ov().hidden) return;
    returnGame();
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
