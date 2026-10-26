// 📺 Modo mesa: pantalla completa para dejar el móvil o la tablet en la mesa.
// Muestra la clasificación en grande y, si hay partida en curso, va rotando con el marcador de
// puntos y las habilidades en juego. Mantiene la pantalla encendida. Tocar → siguiente · ✕ sale.
const Mesa = (() => {
  const $ = sel => document.querySelector(sel);
  const { esc, toRoman } = Stats;
  const ROTATE = 12000;
  let slides = [];
  let i = 0;
  let rotateTimer = null;
  let tickTimer = null;
  let wakeLock = null;

  const state = () => Storage.get();

  function init() {
    const ov = $('#mesa');
    $('#mesa-open').addEventListener('click', open);
    ov.querySelector('.mesa-close').addEventListener('click', close);
    ov.querySelector('.mesa-stage').addEventListener('click', () => go(1));
    document.addEventListener('keydown', e => {
      if (ov.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight' || e.key === ' ') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !ov.hidden) keepAwake();
    });
    // Si se sale de pantalla completa con el botón atrás del móvil, se cierra el modo mesa.
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && !ov.hidden && ov.dataset.fs) close();
    });
  }

  // ---------- Diapositivas ----------

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

  function points() {
    const c = state().current;
    const pts = c.points || {};
    const sorted = [...c.players].sort((a, b) => (pts[b] ?? 0) - (pts[a] ?? 0));
    return `
      <p class="mesa-kicker">🏅 Puntos de victoria · <span class="mesa-timer">${clock(c)}</span></p>
      <ol class="mesa-points">${sorted.map(p => {
        const n = pts[p] ?? 2;
        return `
        <li class="${n >= Stats.POINTS_GOAL ? 'goal' : n === Stats.POINTS_GOAL - 1 ? 'near' : ''}" style="--pc:var(--p${(state().players.indexOf(p) % 4) + 1})">
          <span class="mp-name">${esc(Stats.who(p))}</span>
          <span class="mp-bar"><i style="width:${Math.min(100, n / Stats.POINTS_GOAL * 100)}%"></i></span>
          <b class="mp-n">${n}</b>
        </li>`;
      }).join('')}
      </ol>`;
  }

  function abilities() {
    const c = state().current;
    return `
      <p class="mesa-kicker">🎴 Habilidades en juego</p>
      <ul class="mesa-abilities">${c.abilities.map(a => `
        <li style="--slot:var(--c-${a.color})">
          <b>${esc(a.name)}</b>
          <span>${Stats.rich(a.desc)}</span>
        </li>`).join('')}
      </ul>`;
  }

  function clock(c) {
    const ms = c.timer.acc + (c.timer.since ? Date.now() - c.timer.since : 0);
    const m = Math.floor(ms / 60000);
    return `⏱ ${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  }

  function build() {
    const c = state().current;
    slides = [ranking];
    if (c) {
      slides.unshift(points);
      if (c.abilities.length) slides.push(abilities);
    }
  }

  // ---------- Mostrar ----------

  function show() {
    const ov = $('#mesa');
    build(); // se rehace cada vez: la partida puede haber empezado o terminado
    i = (i + slides.length) % slides.length;
    const stage = ov.querySelector('.mesa-stage');
    stage.innerHTML = `<div class="mesa-slide">${slides[i]()}</div>`;
    ov.querySelector('.mesa-dots').innerHTML = slides.length > 1
      ? slides.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('') : '';
    clearTimeout(rotateTimer);
    if (slides.length > 1) rotateTimer = setTimeout(() => go(1), ROTATE);
  }

  function go(d) {
    i += d;
    show();
  }

  function open() {
    const ov = $('#mesa');
    i = 0;
    ov.hidden = false;
    document.body.classList.add('mesa-on');
    show();
    // El cronómetro se actualiza mientras se ve (cada diapositiva se repinta al rotar).
    clearInterval(tickTimer);
    tickTimer = setInterval(() => {
      const c = state().current;
      const t = ov.querySelector('.mesa-timer');
      if (c && t) t.textContent = clock(c);
    }, 15000);
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().then(() => { ov.dataset.fs = '1'; }).catch(() => {});
    }
    keepAwake();
  }

  function close() {
    const ov = $('#mesa');
    ov.hidden = true;
    delete ov.dataset.fs;
    document.body.classList.remove('mesa-on');
    clearTimeout(rotateTimer);
    clearInterval(tickTimer);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    wakeLock?.release().catch(() => {});
    wakeLock = null;
  }

  async function keepAwake() {
    if (!('wakeLock' in navigator) || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch {}
  }

  return { init };
})();
