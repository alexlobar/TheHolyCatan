// Stats: ficha de cada jugador (rachas, meses, cara a cara, habilidades de la suerte, logros)
// y la tabla global de habilidades ganadoras.
const Profile = (() => {
  const $ = sel => document.querySelector(sel);
  const { esc, toRoman, fmtMonth } = Stats;
  const KEY = 'catan-app-profile';
  let player = null;
  let evoSeason = 'all';
  let resizeTimer;

  const state = () => Storage.get();
  const defOf = id => Storage.TABLES.find(t => t.id === id);
  const badge = deck => {
    const d = defOf(deck);
    return d ? `<span class="origin origin-${d.id}">${d.icon} ${d.short}</span>` : '';
  };

  function init() {
    try { player = localStorage.getItem(KEY); } catch {}
    $('#profile-players').addEventListener('click', e => {
      const b = e.target.closest('[data-p]');
      if (!b) return;
      player = b.dataset.p;
      try { localStorage.setItem(KEY, player); } catch {}
      render();
    });
    $('#evo-season').addEventListener('change', e => { evoSeason = e.target.value; renderEvolution(); });
    // El SVG se dibuja al ancho real: repintar al girar el móvil o cambiar el tamaño.
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if ($('#view-stats').classList.contains('active')) renderEvolution(); }, 150);
    });
    render();
  }

  // ---------- Evolución (gráfico de líneas) ----------

  function renderEvolution() {
    const { players, games, settings } = state();
    const mode = settings.seasonMode;
    const keys = Stats.seasons(games, mode);
    if (evoSeason !== 'all' && !keys.includes(evoSeason)) evoSeason = 'all';
    $('#evo-season').innerHTML = ['all', ...keys].map(k =>
      `<option value="${k}" ${k === evoSeason ? 'selected' : ''}>${Stats.seasonLabel(k)}</option>`).join('');
    $('#evo-season').hidden = mode === 'none';

    const shown = Stats.inSeason(games, evoSeason, mode);
    const box = $('#evo-chart');
    $('#evo-empty').hidden = shown.length > 0;
    box.hidden = !shown.length;
    $('#evo-table-wrap').hidden = !shown.length;
    if (!shown.length) return;

    // Color fijo por jugador (orden de la lista de jugadores), nunca por su puesto.
    const color = i => `var(--p${i + 1})`;
    $('#evo-legend').innerHTML = players.map((p, i) =>
      `<span class="legend-item"><span class="sw" style="background:${color(i)}"></span>${esc(p)}</span>`).join('');

    const points = Stats.evolution(shown, players);
    const label = (i, short) => {
      const g = points[i].game;
      if (!g) return 'Inicio';
      return short
        ? Stats.fmtDate(g.date, { day: 'numeric', month: 'short' })
        : `Partida ${toRoman(Stats.gameNumber(games, g))} · ${Stats.fmtDate(g.date, { day: 'numeric', month: 'short' })} · 🏆 ${g.winner}`;
    };
    // Con la vista oculta no hay ancho: se dibuja de nuevo al abrir Stats (App.show → refresh).
    if (!$('#view-stats').classList.contains('active')) return;
    Charts.lines(box, {
      series: players.map((p, i) => ({ name: p, color: color(i), values: points.map(pt => pt[p]) })),
      label,
      ariaLabel: `Victorias acumuladas por jugador en ${Stats.seasonLabel(evoSeason)}`,
    });

    // Vista de tabla (accesible y para quien prefiera números).
    const last = points[points.length - 1];
    $('#evo-table').innerHTML = `
      <thead><tr><th>Jugador</th><th>Victorias</th><th>Partidas</th></tr></thead>
      <tbody>${players.map(p => `<tr><td>${esc(p)}</td><td>${last[p]}</td><td>${shown.filter(g => g.players.includes(p)).length}</td></tr>`).join('')}</tbody>`;
  }

  function render() {
    const { players, games, settings } = state();
    if (!players.includes(player)) player = players[0];
    renderEvolution();

    $('#profile-players').innerHTML = players.map(p =>
      `<button type="button" class="chip ${p === player ? 'on' : ''}" data-p="${esc(p)}">${esc(p)}</button>`).join('');

    const pr = Stats.profile(games, players, player);
    const titles = Stats.champions(games, players, settings.seasonMode).filter(c => c.winners.includes(player));
    const streak = pr.streak
      ? `${pr.streak.n} ${pr.streak.won ? (pr.streak.n === 1 ? 'victoria' : 'victorias') : (pr.streak.n === 1 ? 'derrota' : 'derrotas')}`
      : '—';

    $('#profile-kpis').innerHTML = [
      ['Partidas', pr.played],
      ['Victorias', `<span class="roman">${toRoman(pr.wins)}</span>`],
      ['% victorias', `${pr.pct}%`],
      ['Racha actual', `${pr.streak ? (pr.streak.won ? '🔥 ' : '🧊 ') : ''}${streak}`],
      ['Mejor racha', pr.bestStreak ? `${pr.bestStreak} seguidas` : '—'],
      ['Títulos', titles.length ? `🏆 ${titles.length}` : '—'],
    ].map(([k, v]) => `<div class="kpi"><span class="kpi-label">${k}</span><span class="kpi-value">${v}</span></div>`).join('');

    const month = m => m ? `${fmtMonth(m.key)} · ${m.wins} de ${m.played} (${Stats.pct(m.wins, m.played)}%)` : '—';
    const rushed = games.reduce((n, g) => n + (g.rush?.[player] || 0), 0);
    const rushTop = Math.max(0, ...players.map(p => games.reduce((n, g) => n + (g.rush?.[p] || 0), 0)));
    $('#profile-months').innerHTML = `
      <li><span>📈 Mejor mes</span><b>${month(pr.bestMonth)}</b></li>
      <li><span>📉 Peor mes</span><b>${month(pr.worstMonth)}</b></li>
      ${pr.avgWin ? `<li><span>⏱ Duración media de sus victorias</span><b>${Stats.fmtDuration(pr.avgWin)}</b></li>` : ''}
      ${titles.length ? `<li><span>🏆 Campeón en</span><b>${titles.map(t => esc(t.label)).join(', ')}</b></li>` : ''}
      ${rushed ? `<li><span>🗯️ Le han metido prisa</span><b>${rushed} ${rushed === 1 ? 'vez' : 'veces'}${rushed === rushTop ? ' · 🐌 el más lento' : ''}</b></li>` : ''}`;

    // Cara a cara: victorias de cada uno en las partidas que han jugado juntos.
    $('#profile-h2h').innerHTML = pr.h2h.map(h => {
      const total = h.mine + h.theirs;
      const w = total ? Math.round((h.mine / total) * 100) : 50;
      return `
        <li class="h2h">
          <div class="h2h-names">
            <span class="${h.mine > h.theirs ? 'lead' : ''}">${esc(player)} <b>${h.mine}</b></span>
            <span class="${h.theirs > h.mine ? 'lead' : ''}"><b>${h.theirs}</b> ${esc(h.rival)}</span>
          </div>
          <div class="h2h-bar" role="img" aria-label="${esc(player)} ${h.mine}, ${esc(h.rival)} ${h.theirs}"><span style="width:${w}%"></span></div>
          <div class="h2h-note">${h.together} ${h.together === 1 ? 'partida' : 'partidas'} juntos${h.together - total > 0 ? ` · ${h.together - total} las ganó otro` : ''}</div>
        </li>`;
    }).join('');

    $('#profile-lucky').innerHTML = pr.lucky.length
      ? pr.lucky.map(a => `<li><span>${esc(a.name)} ${badge(a.deck)}</span><b>${a.n} ${a.n === 1 ? 'victoria' : 'victorias'}</b></li>`).join('')
      : '<li class="empty">Aún sin victorias con habilidades registradas.</li>';

    // Logros.
    const got = Stats.achievements(games, players, settings.seasonMode, player);
    $('#achievements-count').textContent = `${got.size} / ${Stats.ACHIEVEMENTS.length}`;
    $('#achievements').innerHTML = Stats.ACHIEVEMENTS.map(a => `
      <li class="ach ${got.has(a.id) ? 'got' : ''}" title="${esc(a.desc)}">
        <span class="ach-icon">${got.has(a.id) ? a.icon : '🔒'}</span>
        <span class="ach-name">${esc(a.name)}</span>
        <span class="ach-desc">${esc(a.desc)}</span>
      </li>`).join('');

    // Habilidades ganadoras (todas las partidas con habilidades guardadas).
    const ab = Stats.abilityStats(games);
    $('#abilities-stats').innerHTML = ab.length ? ab.map(a => `
      <li>
        <div class="ab-head"><span class="name">${esc(a.name)}</span> ${badge(a.deck)}</div>
        <div class="ab-meta">En juego ${a.games} ${a.games === 1 ? 'vez' : 'veces'} ·
          ${a.top ? `más gana <b>${esc(a.top)}</b> (${a.topWins} de ${a.games})` : 'sin dominador'}</div>
      </li>`).join('') : '<li class="empty">Juega partidas con el modo 🎲 Partida (o guarda las habilidades al registrar) para ver qué habilidades dan más victorias.</li>';
  }

  return { init, render };
})();
