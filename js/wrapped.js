// 🎁 Wrapped de la temporada: resumen tipo «historias» a pantalla completa.
// Tocar a la derecha → siguiente · a la izquierda → anterior · ✕ cierra. La última se comparte.
const Wrapped = (() => {
  const $ = sel => document.querySelector(sel);
  const { esc, toRoman, medal, fmtDuration, fmtDate } = Stats;
  let slides = [];
  let i = 0;
  let data = null;

  function init() {
    const ov = $('#wrapped');
    ov.querySelector('.w-close').addEventListener('click', close);
    ov.querySelector('.w-stage').addEventListener('click', e => {
      if (e.target.closest('button')) return;
      const r = e.currentTarget.getBoundingClientRect();
      go(e.clientX - r.left < r.width * 0.33 ? -1 : 1);
    });
    document.addEventListener('keydown', e => {
      if (ov.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    });
  }

  function build(w) {
    const out = [];
    const s = (bg, html) => out.push({ bg, html });

    s('w-bg-1', `
      <p class="w-kicker">Catán Wrapped</p>
      <h2 class="w-huge">${esc(w.label)}</h2>
      <p class="w-sub">Lo que pasó en la mesa. Toca para seguir →</p>`);

    if (w.legacyWins) s('w-bg-2', `
      <p class="w-kicker">En la liga de WhatsApp</p>
      <p class="w-huge">${w.legacyWins}</p>
      <p class="w-sub">victorias repartidas${w.games ? ` · y ${w.games} ${w.games === 1 ? 'partida' : 'partidas'} más en la app` : ''}</p>`);
    else s('w-bg-2', `
      <p class="w-kicker">Habéis jugado</p>
      <p class="w-huge">${w.games}</p>
      <p class="w-sub">${w.games === 1 ? 'partida' : 'partidas'} en ${w.days} ${w.days === 1 ? 'día' : 'días'}</p>
      ${w.hours ? `<p class="w-sub">⏱ ${fmtDuration(w.hours)} colonizando</p>` : ''}`);

    if (w.champions.length) s('w-bg-3', `
      <p class="w-kicker">${w.champions.length > 1 ? 'Los campeones' : 'El campeón'}</p>
      <p class="w-emoji">🏆</p>
      <h2 class="w-big">${esc(Stats.joinNames(w.champions.map(c => Stats.who(c.name))))}</h2>
      <p class="w-sub">con <span class="w-roman">${toRoman(w.champions[0].wins)}</span> victorias</p>`);

    if (w.streak) s('w-bg-4', `
      <p class="w-kicker">La racha más larga</p>
      <p class="w-emoji">🔥</p>
      <h2 class="w-big">${esc(w.streak.player)}</h2>
      <p class="w-sub">${w.streak.n} victorias seguidas</p>`);

    if (w.ability) s('w-bg-5', `
      <p class="w-kicker">Habilidad talismán</p>
      <p class="w-emoji">🎴</p>
      <h2 class="w-big">${esc(w.ability.name)}</h2>
      <p class="w-sub">${esc(w.ability.top)} ganó ${w.ability.topWins} de ${w.ability.games} veces que estaba en juego</p>`);

    if (w.longest) s('w-bg-6', `
      <p class="w-kicker">La partida eterna</p>
      <p class="w-emoji">🐢</p>
      <h2 class="w-big">${fmtDuration(w.longest.duration)}</h2>
      <p class="w-sub">Partida ${w.gameNumber(w.longest)} · ${fmtDate(w.longest.date)} · ganó ${esc(w.longest.winner)}</p>`);

    if (w.spoon.length) s('w-bg-7', `
      <p class="w-kicker">Cuchara de madera</p>
      <p class="w-emoji">🪵</p>
      <h2 class="w-big">${esc(Stats.joinNames(w.spoon.map(x => Stats.who(x.name))))}</h2>
      <p class="w-sub">La próxima temporada es tuya. Seguro.</p>`);

    if (w.titles.length) s('w-bg-8', `
      <p class="w-kicker">Títulos de la temporada</p>
      <ul class="w-list">${w.titles.slice(0, 6).map(t =>
        `<li><span>${t.icon} ${esc(t.name)}</span><b>${t.holders.map(esc).join(' · ')}</b></li>`).join('')}</ul>`);

    s('w-bg-1', `
      <p class="w-kicker">Clasificación final</p>
      <ul class="w-list podium">${w.podium.map(r =>
        `<li><span>${Stats.rowMedal(w.podium, r) || '·'} ${esc(Stats.who(r.name))}</span><b>${toRoman(r.wins)}</b></li>`).join('')}</ul>
      <div class="w-actions">
        <button type="button" class="btn primary w-share">📤 Compartir el Wrapped</button>
        <button type="button" class="btn w-again">↺ Ver otra vez</button>
      </div>`);
    return out;
  }

  function open(key) {
    const s = Storage.get();
    data = Stats.wrapped(Stats.valid(s.games), s.players, s.settings.seasonMode, key);
    if (!data) return App.toast('No hay partidas en esa temporada');
    slides = build(data);
    i = 0;
    const ov = $('#wrapped');
    ov.querySelector('.w-progress').innerHTML = slides.map(() => '<span><i></i></span>').join('');
    ov.hidden = false;
    document.body.classList.add('no-scroll');
    show();
  }

  function show() {
    const ov = $('#wrapped');
    const slide = slides[i];
    ov.className = `wrapped ${slide.bg}`;
    const stage = ov.querySelector('.w-content');
    stage.innerHTML = slide.html;
    stage.classList.remove('w-in');
    void stage.offsetWidth; // reinicia la animación
    stage.classList.add('w-in');
    ov.querySelectorAll('.w-progress span').forEach((b, k) => b.classList.toggle('done', k <= i));
    stage.querySelector('.w-share')?.addEventListener('click', () => App.share(Stats.wrappedText(data)));
    stage.querySelector('.w-again')?.addEventListener('click', () => { i = 0; show(); });
  }

  function go(d) {
    const n = i + d;
    if (n < 0) return;
    if (n >= slides.length) return; // en la última se queda (compartir / cerrar)
    i = n;
    show();
  }

  function close() {
    $('#wrapped').hidden = true;
    document.body.classList.remove('no-scroll');
  }

  return { init, open };
})();
