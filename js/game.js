// Modo partida: preparar (jugadores + habilidades), jugar (cronómetro, puntos de victoria y
// habilidades en juego) y terminar (ganador → se guarda con habilidades, puntos y duración).
// La partida en curso vive en Storage.get().current, así que sobrevive a cerrar la app.
const Game = (() => {
  const $ = sel => document.querySelector(sel);
  const { esc, rich, toRoman } = Stats;
  const { COLORS, TABLES } = Storage;

  let setupPlayers = null; // Set con los jugadores elegidos para la próxima partida
  let finishWinner = null;
  let summary = null;      // { gameId, unlocked } tras terminar, hasta pulsar «Nueva partida»
  let tick = null;
  let wakeLock = null;

  const state = () => Storage.get();
  const cur = () => state().current;
  const defOf = id => TABLES.find(t => t.id === id);

  function init() {
    $('#game-start').addEventListener('click', start);
    $('#setup-redraw-now').addEventListener('click', () => { Tables.newGame(); renderSetup(); });
    $('#game-pause').addEventListener('click', togglePause);
    $('#game-finish').addEventListener('click', finish);
    $('#game-cancel').addEventListener('click', cancel);
    $('#summary-share').addEventListener('click', () => summary && Tracker.shareGame(summary.gameId));
    $('#summary-photo').addEventListener('click', () => summary && Photos.pick(summary.gameId));
    $('#summary-thumb').addEventListener('click', () => summary && Photos.view(summary.gameId));
    $('#live-bored').addEventListener('click', () => App.show('fun'));
    $('#live-mesa').addEventListener('click', () => Mesa.open());
    $('#summary-new').addEventListener('click', () => { summary = null; render(); });
    $('#summary-rematch').addEventListener('click', rematch);
    $('#live-points').addEventListener('click', e => {
      const b = e.target.closest('.pb-btn');
      if (b) addPoint(b.dataset.p, +b.dataset.d);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') keepAwake();
    });
    render();
  }

  // ---------- Tiempo ----------

  const elapsed = c => c.timer.acc + (c.timer.since ? Date.now() - c.timer.since : 0);
  function clock(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function startTicking() {
    clearInterval(tick);
    tick = setInterval(() => {
      const c = cur();
      if (!c) return clearInterval(tick);
      $('#game-timer').textContent = clock(elapsed(c));
    }, 1000);
  }

  function togglePause() {
    const c = cur();
    if (c.timer.since) {
      c.timer.acc += Date.now() - c.timer.since;
      c.timer.since = null;
    } else {
      c.timer.since = Date.now();
    }
    Storage.save();
    renderLive();
  }

  // Mantener la pantalla encendida durante la partida (si el navegador lo permite).
  async function keepAwake() {
    if (!cur() || !('wakeLock' in navigator) || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch {}
  }
  function releaseAwake() {
    wakeLock?.release().catch(() => {});
    wakeLock = null;
  }

  // ---------- Preparar ----------

  function renderSetup() {
    // Los de la casa (marcados de inicio) + invitados + botón para añadir uno nuevo.
    const players = Storage.roster();
    if (!setupPlayers) setupPlayers = new Set(state().players);
    for (const p of setupPlayers) if (!players.includes(p)) setupPlayers.delete(p);
    $('#setup-players').innerHTML = players.map(p =>
      `<button type="button" class="chip ${Storage.isGuest(p) ? 'guest-chip' : ''} ${setupPlayers.has(p) ? 'on' : ''}" data-p="${esc(p)}">${esc(Stats.who(p))}</button>`).join('')
      + '<button type="button" class="chip add-guest" data-add>＋ Invitado</button>';
    const founders = [...setupPlayers].filter(p => Storage.FOUNDERS.includes(p)).length;
    $('#setup-warning').hidden = founders >= Storage.MIN_FOUNDERS;
    $('#setup-players').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.add !== undefined) return App.addGuest(name => { setupPlayers.add(name); renderSetup(); });
      const p = b.dataset.p;
      setupPlayers.has(p) ? setupPlayers.delete(p) : setupPlayers.add(p);
      renderSetup();
    }));

    const snap = Tables.snapshot();
    $('#setup-abilities').innerHTML = snap.length
      ? snap.map(a => `<span class="mini" style="--slot:var(--c-${a.color})">${esc(a.name)}</span>`).join('')
      : '<span class="muted">Aún no hay habilidades sorteadas.</span>';
    $('#setup-redraw-row').hidden = !snap.length;
  }

  function start() {
    if (setupPlayers.size < 2) return App.toast('Selecciona al menos 2 jugadores');
    const redraw = !$('#setup-redraw-row').hidden && $('#setup-redraw').checked;
    begin(Storage.roster().filter(p => setupPlayers.has(p)), redraw);
    App.toast('▶ ¡Que empiece la partida!');
    Mesa.open(); // marcador a pantalla completa para dejar el móvil en la mesa
  }

  // Revancha: mismos jugadores que la partida recién terminada y habilidades nuevas.
  function rematch() {
    const g = summary && state().games.find(x => x.id === summary.gameId);
    if (!g) return;
    const players = g.players.filter(p => Storage.roster().includes(p));
    if (players.length < 2) return App.toast('Faltan jugadores para la revancha');
    setupPlayers = new Set(players);
    summary = null;
    begin(players, true);
    App.toast(`🔁 ¡Revancha! ${Stats.who(g.winner)} defiende la corona`);
    Mesa.open();
  }

  function begin(players, redraw) {
    if (redraw || !Tables.snapshot().length) Tables.newGame();
    state().current = {
      date: Stats.today(),
      players,
      abilities: Tables.snapshot(),
      timer: { acc: 0, since: Date.now() },
      points: Object.fromEntries(players.map(p => [p, START_POINTS])),
    };
    finishWinner = null;
    Storage.save();
    render();
    window.scrollTo(0, 0);
  }

  // ---------- Puntos de victoria ----------

  const START_POINTS = 2; // los 2 poblados iniciales
  const GOAL = 10;

  function addPoint(p, delta) {
    const c = cur();
    const before = c.points[p] ?? START_POINTS;
    const now = Math.max(0, Math.min(30, before + delta));
    if (now === before) return;
    c.points[p] = now;
    if (delta > 0 && now >= GOAL && before < GOAL) {
      finishWinner = p;
      if (!Mesa.isOpen()) App.toast(`🏆 ¡${Stats.who(p)} llega a ${now}! Marcado como ganador abajo`);
      navigator.vibrate?.([80, 60, 160]);
      renderWinner();
    }
    Storage.save();
    renderPoints();
  }

  // Desde el modo mesa: cerrar y bajar a «Terminar partida» con el ganador ya marcado.
  function goFinish() {
    App.show('game');
    render();
    $('#game-finish').closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderPoints() {
    const c = cur();
    const max = Math.max(...c.players.map(p => c.points[p] ?? START_POINTS));
    $('#live-points').innerHTML = c.players.map((p, i) => {
      const pts = c.points[p] ?? START_POINTS;
      const cls = pts >= GOAL ? 'goal' : pts === GOAL - 1 ? 'near' : pts === max ? 'lead' : '';
      return `
        <li class="${cls}" style="--pc:${Stats.colorOf(p)}">
          <span class="pb-name">${esc(Stats.who(p))}</span>
          <div class="pb-bar" aria-hidden="true"><span style="width:${Math.min(100, pts / GOAL * 100)}%"></span></div>
          <button type="button" class="pb-btn" data-p="${esc(p)}" data-d="-1" aria-label="Quitar un punto a ${esc(p)}">−</button>
          <span class="pb-pts" aria-live="polite">${pts}</span>
          <button type="button" class="pb-btn plus" data-p="${esc(p)}" data-d="1" aria-label="Sumar un punto a ${esc(p)}">+</button>
        </li>`;
    }).join('');
  }

  // ---------- En juego ----------

  function renderLive() {
    const c = cur();
    const running = !!c.timer.since;
    $('#game-timer').textContent = clock(elapsed(c));
    $('#game-timer').classList.toggle('paused', !running);
    $('#game-pause').textContent = running ? '⏸ Pausar' : '▶ Seguir';
    $('#live-players').textContent = c.players.map(Stats.who).join(' · ');

    $('#live-abilities').innerHTML = c.abilities.length ? c.abilities.map(a => {
      const def = defOf(a.deck);
      const color = COLORS.find(x => x.id === a.color);
      return `
        <details class="live-ability" style="--slot:var(--c-${a.color})">
          <summary>
            <span class="dot" aria-hidden="true"></span>
            <span class="name">${esc(a.name)}</span>
            <span class="origin" style="--accent:${def ? def.color : '#888'}">${def ? def.icon : ''}</span>
            <span class="sr-only">carta ${color?.name.toLowerCase()}</span>
          </summary>
          ${a.cost || a.benefit ? `<div class="pills">${a.cost ? `<span class="pill cost">Tú: ${esc(a.cost)}</span>` : ''}${a.benefit ? `<span class="pill benefit">Resto: ${esc(a.benefit)}</span>` : ''}</div>` : ''}
          <div class="desc">${rich(a.desc)}</div>
        </details>`;
    }).join('') : '<p class="muted">Partida sin habilidades.</p>';

    renderPoints();
    renderWinner();
  }

  function renderWinner() {
    const c = cur();
    // Ganador: solo entre los que juegan.
    if (!c.players.includes(finishWinner)) finishWinner = null;
    $('#finish-winner').innerHTML = c.players.map(p =>
      `<button type="button" class="chip winner ${finishWinner === p ? 'on' : ''}" data-p="${esc(p)}">${esc(Stats.who(p))}</button>`).join('');
    $('#finish-winner').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { finishWinner = b.dataset.p; renderWinner(); }));
  }

  // ---------- Terminar ----------

  function finish() {
    const c = cur();
    if (!finishWinner) return App.toast('Elige quién ha ganado');
    const game = {
      id: Storage.uid(),
      date: c.date,
      players: c.players,
      winner: finishWinner,
      note: $('#finish-note').value.trim(),
      abilities: c.abilities.map(a => ({ color: a.color, deck: a.deck, name: a.name })),
      duration: Math.round(elapsed(c) / 1000),
    };
    // Los puntos solo se guardan si se ha usado el marcador.
    const pts = c.points || {};
    if (c.players.some(p => (pts[p] ?? START_POINTS) !== START_POINTS)) {
      game.points = Object.fromEntries(c.players.map(p => [p, pts[p] ?? START_POINTS]));
    }
    state().current = null;
    $('#finish-note').value = '';
    finishWinner = null;
    clearInterval(tick);
    releaseAwake();
    const unlocked = Tracker.addGame(game); // guarda y refresca toda la app
    summary = { gameId: game.id, unlocked };
    render();
    window.scrollTo(0, 0);
  }

  function cancel() {
    if (!confirm('¿Cancelar la partida en curso? No se guardará.')) return;
    state().current = null;
    finishWinner = null;
    clearInterval(tick);
    releaseAwake();
    Storage.save();
    render();
  }

  function renderSummary() {
    const s = state();
    const g = s.games.find(x => x.id === summary.gameId);
    if (!g) { summary = null; return render(); }
    $('#summary-title').textContent = `🏆 ${Stats.who(g.winner)} gana la Partida ${toRoman(Stats.gameNumber(s.games, g))}`;
    $('#summary-invalid').hidden = Stats.isValid(g);
    $('#summary-meta').textContent = [Stats.fmtDuration(g.duration), g.players.join(', ')].filter(Boolean).join(' · ');
    $('#summary-achievements').innerHTML = summary.unlocked.map(a =>
      `<li><span class="ach-icon">${a.icon}</span> <b>${esc(a.player)}</b> desbloquea «${esc(a.name)}»</li>`).join('');
    $('#summary-achievements').hidden = !summary.unlocked.length;
    const pts = g.points;
    $('#summary-points').hidden = !pts;
    $('#summary-points').innerHTML = pts ? [...g.players].sort((a, b) => (pts[b] ?? 0) - (pts[a] ?? 0)).map(p =>
      `<li class="${p === g.winner ? 'win' : ''}"><span>${esc(Stats.who(p))}</span><b>${pts[p] ?? '–'}</b></li>`).join('') : '';
    $('#summary-rematch').hidden = g.players.filter(p => Storage.roster().includes(p)).length < 2;
    $('#summary-photo').textContent = g.photo ? '📷 Cambiar foto' : '📷 Añadir foto del tablero';
    $('#summary-thumb').hidden = !g.photo;
    if (g.photo) Photos.url(g.id).then(u => { if (u) $('#summary-thumb img').src = u; }).catch(() => {});
  }

  // ---------- Pintar ----------

  function render() {
    const c = cur();
    $('#game-setup').hidden = !!c || !!summary;
    $('#game-live').hidden = !c;
    $('#game-summary').hidden = !summary || !!c;
    document.querySelector('.tabbar [data-view="game"]').classList.toggle('live', !!c);

    if (c) {
      renderLive();
      startTicking();
      keepAwake();
    } else if (summary) {
      renderSummary();
    } else {
      renderSetup();
    }
  }

  return { init, render, addPoint, togglePause, goFinish, clock: () => (cur() ? clock(elapsed(cur())) : ''), winner: () => finishWinner, GOAL, START_POINTS };
})();
