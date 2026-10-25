// Modo partida: preparar (jugadores + habilidades), jugar (cronómetro, rondas, penalizaciones
// activas) y terminar (ganador → se guarda con habilidades, duración y rondas).
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
    $('#round-next').addEventListener('click', nextRound);
    $('#round-prev').addEventListener('click', () => changeRound(-1));
    $('#effect-card').addEventListener('change', onEffectCard);
    $('#effect-add').addEventListener('click', addEffect);
    $('#game-finish').addEventListener('click', finish);
    $('#game-cancel').addEventListener('click', cancel);
    $('#summary-share').addEventListener('click', () => summary && Tracker.shareGame(summary.gameId));
    $('#summary-photo').addEventListener('click', () => summary && Photos.pick(summary.gameId));
    $('#summary-thumb').addEventListener('click', () => summary && Photos.view(summary.gameId));
    $('#live-bored').addEventListener('click', () => App.show('fun'));
    $('#summary-new').addEventListener('click', () => { summary = null; render(); });
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
    const players = state().players;
    if (!setupPlayers) setupPlayers = new Set(players);
    $('#setup-players').innerHTML = players.map(p =>
      `<button type="button" class="chip ${setupPlayers.has(p) ? 'on' : ''}" data-p="${esc(p)}">${esc(Stats.who(p))}</button>`).join('');
    const founders = [...setupPlayers].filter(p => Storage.FOUNDERS.includes(p)).length;
    $('#setup-warning').hidden = founders >= Storage.MIN_FOUNDERS;
    $('#setup-players').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
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
    if (redraw || !Tables.snapshot().length) Tables.newGame();

    state().current = {
      date: Stats.today(),
      players: state().players.filter(p => setupPlayers.has(p)),
      abilities: Tables.snapshot(),
      round: 1,
      timer: { acc: 0, since: Date.now() },
      effects: [],
    };
    finishWinner = null;
    Storage.save();
    App.toast('▶ ¡Que empiece la partida!');
    render();
    window.scrollTo(0, 0);
  }

  // ---------- En juego ----------

  function changeRound(delta) {
    const c = cur();
    c.round = Math.max(1, c.round + delta);
    Storage.save();
    renderLive();
  }

  function nextRound() {
    const c = cur();
    c.round++;
    const ended = [];
    for (const e of c.effects) {
      e.left--;
      if (e.left <= 0) ended.push(e);
    }
    c.effects = c.effects.filter(e => e.left > 0);
    Storage.save();
    renderLive();
    App.toast(ended.length
      ? `✔ Termina: ${ended.map(e => `${e.name} (${e.player})`).join(', ')}`
      : `Ronda ${c.round}`);
  }

  // Opciones de carta para una penalización: las que están en juego y las demás con duración.
  function effectOptions() {
    const c = cur();
    const inGame = c.abilities.map((a, i) => ({ value: `a:${i}`, label: a.name, rounds: a.rounds || 1, deck: a.deck, name: a.name }));
    const names = new Set(c.abilities.map(a => a.deck + '|' + a.name));
    const others = Tables.timedCards()
      .filter(t => !names.has(t.deck + '|' + t.name))
      .map(t => ({ value: `t:${t.deck}:${t.card}`, label: `${defOf(t.deck).icon} ${t.name}`, rounds: t.rounds, deck: t.deck, name: t.name }));
    return { inGame, others };
  }

  function renderEffectForm() {
    const c = cur();
    const { inGame, others } = effectOptions();
    const opt = o => `<option value="${o.value}">${esc(o.label)}</option>`;
    $('#effect-card').innerHTML =
      (inGame.length ? `<optgroup label="En juego">${inGame.map(opt).join('')}</optgroup>` : '') +
      (others.length ? `<optgroup label="Otras con duración">${others.map(opt).join('')}</optgroup>` : '') +
      '<option value="__custom">✏️ Otra (escribir)…</option>';
    $('#effect-player').innerHTML = [...c.players, 'Todos'].map(p => `<option>${esc(p)}</option>`).join('');
    onEffectCard();
  }

  function onEffectCard() {
    const v = $('#effect-card').value;
    const { inGame, others } = effectOptions();
    const o = [...inGame, ...others].find(x => x.value === v);
    $('#effect-custom').hidden = v !== '__custom';
    $('#effect-rounds').value = o ? o.rounds : 1;
  }

  function addEffect() {
    const c = cur();
    const v = $('#effect-card').value;
    const { inGame, others } = effectOptions();
    const o = [...inGame, ...others].find(x => x.value === v);
    const name = o ? o.name : $('#effect-custom').value.trim();
    if (!name) return App.toast('Escribe el nombre de la penalización');
    const rounds = Math.max(1, Math.min(20, parseInt($('#effect-rounds').value, 10) || 1));
    c.effects.push({ id: Storage.uid(), name, deck: o?.deck || null, player: $('#effect-player').value, left: rounds, total: rounds });
    $('#effect-custom').value = '';
    Storage.save();
    renderLive();
    App.toast(`⏳ ${name} → ${$('#effect-player').value} (${rounds} ${rounds === 1 ? 'ronda' : 'rondas'})`);
  }

  function removeEffect(id) {
    const c = cur();
    const e = c.effects.find(x => x.id === id);
    c.effects = c.effects.filter(x => x.id !== id);
    Storage.save();
    renderLive();
    if (e) App.toast(`🕊️ ${e.player} se libra de ${e.name}`);
  }

  function renderLive() {
    const c = cur();
    const running = !!c.timer.since;
    $('#game-timer').textContent = clock(elapsed(c));
    $('#game-timer').classList.toggle('paused', !running);
    $('#game-pause').textContent = running ? '⏸ Pausar' : '▶ Seguir';
    $('#game-round').textContent = c.round;
    $('#live-players').textContent = c.players.map(Stats.who).join(' · ');

    $('#live-abilities').innerHTML = c.abilities.length ? c.abilities.map(a => {
      const def = defOf(a.deck);
      const color = COLORS.find(x => x.id === a.color);
      return `
        <details class="live-ability" style="--slot:var(--c-${a.color})">
          <summary>
            <span class="dot" aria-hidden="true"></span>
            <span class="name">${esc(a.name)}</span>
            <span class="origin origin-${a.deck}">${def ? def.icon : ''}</span>
            <span class="sr-only">carta ${color?.name.toLowerCase()}</span>
          </summary>
          ${a.cost || a.benefit ? `<div class="pills">${a.cost ? `<span class="pill cost">Tú: ${esc(a.cost)}</span>` : ''}${a.benefit ? `<span class="pill benefit">Resto: ${esc(a.benefit)}</span>` : ''}</div>` : ''}
          <div class="desc">${rich(a.desc)}</div>
        </details>`;
    }).join('') : '<p class="muted">Partida sin habilidades.</p>';

    $('#effects-list').innerHTML = c.effects.length ? c.effects.map(e => `
      <li class="effect" style="--accent:var(--deck-${e.deck || 'none'})">
        <div class="info">
          <div><b>${esc(e.name)}</b> → ${esc(e.player)}</div>
          <div class="effect-left">
            <span class="pips" aria-hidden="true">${'●'.repeat(e.left)}${'○'.repeat(Math.max(0, e.total - e.left))}</span>
            ${e.left === 1 ? 'última ronda' : `quedan ${e.left} rondas`}
          </div>
        </div>
        <button class="icon-btn" data-id="${e.id}" aria-label="Quitar ${esc(e.name)} de ${esc(e.player)}">✕</button>
      </li>`).join('') : '<li class="empty">Sin penalizaciones activas.</li>';
    $('#effects-list').querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => removeEffect(b.dataset.id)));

    // Ganador: solo entre los que juegan.
    if (!c.players.includes(finishWinner)) finishWinner = null;
    $('#finish-winner').innerHTML = c.players.map(p =>
      `<button type="button" class="chip winner ${finishWinner === p ? 'on' : ''}" data-p="${esc(p)}">${esc(Stats.who(p))}</button>`).join('');
    $('#finish-winner').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { finishWinner = b.dataset.p; renderLive(); }));
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
      rounds: c.round,
    };
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
    $('#summary-meta').textContent = [Stats.fmtDuration(g.duration), g.rounds && `${g.rounds} rondas`, g.players.join(', ')].filter(Boolean).join(' · ');
    $('#summary-achievements').innerHTML = summary.unlocked.map(a =>
      `<li><span class="ach-icon">${a.icon}</span> <b>${esc(a.player)}</b> desbloquea «${esc(a.name)}»</li>`).join('');
    $('#summary-achievements').hidden = !summary.unlocked.length;
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
      renderEffectForm();
      startTicking();
      keepAwake();
    } else if (summary) {
      renderSummary();
    } else {
      renderSetup();
    }
  }

  return { init, render };
})();
