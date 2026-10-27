// Stats: ficha de cada jugador (rachas, meses, cara a cara, habilidades de la suerte, logros)
// y la tabla global de habilidades ganadoras.
const Profile = (() => {
  const $ = sel => document.querySelector(sel);
  const { esc, toRoman, fmtMonth } = Stats;
  const KEY = 'catan-app-profile';
  let player = null;
  let evoSeason = 'all';
  let resizeTimer;
  // Stats tiene dos modos: 'global' (liga, evolución, títulos, récords…) y 'player' (ficha).
  const MODE_KEY = 'catan-app-stats-mode';
  let statsMode = 'global';

  function setMode(m) {
    statsMode = m === 'player' ? 'player' : 'global';
    try { localStorage.setItem(MODE_KEY, statsMode); } catch {}
    const isPlayer = statsMode === 'player';
    document.querySelectorAll('#view-stats .stats-global').forEach(el => { el.hidden = isPlayer; });
    document.querySelectorAll('#view-stats .stats-player').forEach(el => { el.hidden = !isPlayer; });
    $('#stats-title').textContent = isPlayer ? '👤 Ficha de jugador' : '📊 Estadísticas';
    $('#stats-mode-btn').textContent = isPlayer ? '📊 General' : '👤 Ficha de jugador';
    $('#stats-mode-btn').setAttribute('aria-pressed', isPlayer);
    window.scrollTo(0, 0);
    if (!isPlayer) renderEvolution(); // el gráfico necesita estar visible para medir el ancho
  }

  const state = () => Storage.get();
  const defOf = id => Storage.TABLES.find(t => t.id === id);
  const badge = deck => {
    const d = defOf(deck);
    return d ? `<span class="origin" style="--accent:${d.color}">${d.icon} ${Stats.esc(d.short)}</span>` : '';
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
    $('#stats-mode-btn').addEventListener('click', () => setMode(statsMode === 'player' ? 'global' : 'player'));
    $('#cal-prev').addEventListener('click', () => moveMonth(-1));
    $('#cal-next').addEventListener('click', () => moveMonth(1));
    $('#cal-grid').addEventListener('click', e => {
      const b = e.target.closest('[data-day]');
      if (!b) return;
      calDay = calDay === b.dataset.day ? null : b.dataset.day;
      renderCalendar();
    });
    try { statsMode = localStorage.getItem(MODE_KEY) || 'global'; } catch {}
    // El SVG se dibuja al ancho real: repintar al girar el móvil o cambiar el tamaño.
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if ($('#view-stats').classList.contains('active')) renderEvolution(); }, 150);
    });
    render();
    setMode(statsMode);
  }

  // ---------- Histórico de la liga (WhatsApp + app) ----------

  function renderHistory() {
    const { players } = state();
    const h = Stats.history(Stats.valid(state().games), players);
    const avg = h.years.length ? Math.round(h.totalGames / h.years.length) : 0;

    $('#hist-kpis').innerHTML = [
      ['Partidas totales', `<span class="big-num">${h.totalGames}</span>`],
      ['Años de liga', h.years.length],
      ['Media por año', avg],
      ['Año récord', h.busiest ? `${h.busiest.year} · ${h.busiest.games}` : '—'],
    ].map(([k, v]) => `<div class="kpi"><span class="kpi-label">${k}</span><span class="kpi-value">${v}</span></div>`).join('');

    // Partidas por año: barra proporcional + desglose WhatsApp / app.
    const max = Math.max(1, ...h.byYear.map(y => y.games));
    $('#hist-years').innerHTML = [...h.byYear].reverse().map(y => `
      <li>
        <span class="hy-year">${y.year}</span>
        <span class="hy-bar"><i style="width:${(y.games / max) * 100}%"></i></span>
        <b class="hy-n">${y.games}</b>
        <span class="hy-detail">${[y.legacyGames && `${y.legacyGames} WhatsApp`, y.appGames && `${y.appGames} app`].filter(Boolean).join(' + ')}${
          y.champions.length ? ` · 🏆 ${y.champions.map(c => esc(Stats.who(c))).join(', ')}${y.year === String(new Date().getFullYear()) ? ' (en curso)' : ''}` : ''}</span>
      </li>`).join('');

    // Victorias por jugador y año (el campeón de cada año, resaltado).
    $('#hist-table').innerHTML = `
      <thead><tr><th>Jugador</th>${h.years.map(y => `<th>'${y.slice(2)}</th>`).join('')}<th>Total</th><th>%</th></tr></thead>
      <tbody>${h.totals.map(t => `
        <tr class="${t.guest ? 'guest' : ''}">
          <td>${esc(Stats.who(t.name))}</td>
          ${h.byYear.map(y => `<td class="roman small ${y.champions.includes(t.name) ? 'champ-cell' : ''}">${toRoman(y.wins[t.name])}</td>`).join('')}
          <td class="roman">${toRoman(t.wins)}</td>
          <td>${Math.round(t.share * 100)}%</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr><td>Partidas</td>${h.byYear.map(y => `<td>${y.games}</td>`).join('')}<td><b>${h.totalGames}</b></td><td></td></tr></tfoot>`;
  }

  // ---------- Evolución (gráfico de líneas) ----------

  function renderEvolution() {
    const { players, settings } = state();
    const games = Stats.valid(state().games); // solo partidas que cuentan para la liga
    const mode = settings.seasonMode;
    const keys = Stats.seasons(games, mode);
    if (evoSeason !== 'all' && !keys.includes(evoSeason)) evoSeason = 'all';
    $('#evo-season').innerHTML = ['all', ...keys].map(k =>
      `<option value="${k}" ${k === evoSeason ? 'selected' : ''}>${Stats.seasonLabel(k)}</option>`).join('');
    $('#evo-season').hidden = mode === 'none';

    const shown = Stats.inSeason(games, evoSeason, mode);
    const baselines = Stats.legacyBaselines(evoSeason, mode); // años de WhatsApp: un salto por año
    const has = shown.length > 0 || baselines.length > 0;
    const box = $('#evo-chart');
    $('#evo-empty').hidden = has;
    box.hidden = !has;
    $('#evo-table-wrap').hidden = !has;
    $('#evo-note').hidden = !baselines.length;
    if (!has) return;

    // Color fijo por jugador (orden de la lista de jugadores), nunca por su puesto.
    const color = i => `var(--p${i + 1})`;
    $('#evo-legend').innerHTML = players.map((p, i) =>
      `<span class="legend-item"><span class="sw" style="background:${color(i)}"></span>${esc(Stats.who(p))}</span>`).join('');

    const points = Stats.evolution(shown, players, baselines);
    const label = (i, short) => {
      const pt = points[i];
      const g = pt.game;
      if (!g) return short && pt.short ? pt.short : pt.label;
      return short
        ? Stats.fmtDate(g.date, { day: 'numeric', month: 'short' })
        : `Partida ${toRoman(Stats.gameNumber(games, g))} · ${Stats.fmtDate(g.date, { day: 'numeric', month: 'short' })} · 🏆 ${g.winner}`;
    };
    // Con la vista oculta no hay ancho: se dibuja de nuevo al abrir Stats (App.show → refresh)
    // o al volver al modo general.
    if (!$('#view-stats').classList.contains('active') || statsMode === 'player') return;
    Charts.lines(box, {
      series: players.map((p, i) => ({ name: p, color: color(i), values: points.map(pt => pt[p]) })),
      label,
      ariaLabel: `Victorias acumuladas por jugador en ${Stats.seasonLabel(evoSeason)}`,
    });

    // Vista de tabla (accesible y para quien prefiera números).
    const last = points[points.length - 1];
    $('#evo-table').innerHTML = `
      <thead><tr><th>Jugador</th><th>Victorias</th></tr></thead>
      <tbody>${players.map(p => `<tr><td>${esc(Stats.who(p))}</td><td>${last[p]}</td></tr>`).join('')}</tbody>`;
  }

  // ---------- Calendario de partidas (todas las registradas en la app) ----------

  const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const pad = n => String(n).padStart(2, '0');
  let calMonth = null; // 'AAAA-MM' que se está viendo
  let calDay = null;   // 'AAAA-MM-DD' abierto

  function moveMonth(delta) {
    const [y, m] = calMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    calMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    calDay = null;
    renderCalendar();
  }

  function renderCalendar() {
    const games = state().games.filter(g => g.date);
    if (!calMonth) calMonth = (games[0]?.date || Stats.today()).slice(0, 7);
    const byDay = {};
    for (const g of games) (byDay[g.date] = byDay[g.date] || []).push(g);

    // KPIs de siempre: días jugados y día de la semana favorito.
    const weekday = [0, 0, 0, 0, 0, 0, 0];
    for (const day of Object.keys(byDay)) weekday[new Date(day + 'T00:00').getDay()] += byDay[day].length;
    const fav = weekday.indexOf(Math.max(...weekday));
    const inMonth = Object.keys(byDay).filter(d => d.startsWith(calMonth));
    $('#cal-kpis').innerHTML = [
      ['Días jugados', Object.keys(byDay).length],
      ['Día favorito', games.length ? `${WEEKDAYS[fav]} · ${weekday[fav]}` : '—'],
      ['Este mes', inMonth.length ? `${inMonth.reduce((s, d) => s + byDay[d].length, 0)} en ${inMonth.length} ${inMonth.length === 1 ? 'día' : 'días'}` : '—'],
    ].map(([k, v]) => `<div class="kpi"><span class="kpi-label">${k}</span><span class="kpi-value">${v}</span></div>`).join('');

    const [y, m] = calMonth.split('-').map(Number);
    $('#cal-month').textContent = Stats.fmtMonth(calMonth);
    const first = (new Date(y, m - 1, 1).getDay() + 6) % 7; // lunes = 0
    const days = new Date(y, m, 0).getDate();
    const today = Stats.today();
    const cells = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => `<span class="cal-wd">${d}</span>`);
    for (let i = 0; i < first; i++) cells.push('<span></span>');
    for (let d = 1; d <= days; d++) {
      const key = `${calMonth}-${pad(d)}`;
      const n = byDay[key]?.length || 0;
      const lvl = Math.min(n, 3);
      cells.push(`<button type="button" class="cal-cell lvl-${lvl} ${key === today ? 'today' : ''} ${key === calDay ? 'sel' : ''}" data-day="${key}" ${n ? '' : 'disabled'}
        aria-label="${d}: ${n ? `${n} ${n === 1 ? 'partida' : 'partidas'}` : 'sin partidas'}">${d}${n > 1 ? `<small>${n}</small>` : ''}</button>`);
    }
    $('#cal-grid').innerHTML = cells.join('');

    const list = calDay && byDay[calDay];
    $('#cal-day').hidden = !list;
    $('#cal-day').innerHTML = list ? `<li class="cal-day-head">${Stats.fmtDate(calDay, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</li>` + list.map(g => `
      <li>
        <b>Partida ${toRoman(Stats.gameNumber(state().games, g))}</b> · 🏆 ${esc(Stats.who(g.winner))}
        <span class="muted">${[g.players.length + ' jugadores', g.duration && Stats.fmtDuration(g.duration), g.points && Stats.pointsLine(g)].filter(Boolean).map(esc).join(' · ')}</span>
      </li>`).join('') : '';
  }

  function render() {
    const { players, settings } = state();
    const games = Stats.valid(state().games); // solo partidas que cuentan para la liga
    // Fundadores e invitados (los invitados, solo si han jugado alguna partida o se abrió su ficha).
    const roster = Storage.roster().filter(p => players.includes(p) || p === player || state().games.some(g => g.players.includes(p)));
    if (!roster.includes(player)) player = players[0];
    renderHistory();
    renderEvolution();
    renderCalendar();

    $('#profile-players').innerHTML = roster.map(p =>
      `<button type="button" class="chip ${Storage.isGuest(p) ? 'guest-chip' : ''} ${p === player ? 'on' : ''}" data-p="${esc(p)}">${esc(Stats.who(p))}</button>`).join('');

    const pr = Stats.profile(games, players, player);
    const titles = Stats.champions(games, players, settings.seasonMode).filter(c => c.winners.includes(player));
    const streak = pr.streak
      ? `${pr.streak.n} ${pr.streak.won ? (pr.streak.n === 1 ? 'victoria' : 'victorias') : (pr.streak.n === 1 ? 'derrota' : 'derrotas')}`
      : '—';

    // Con el histórico (WhatsApp + app): victorias, cuota sobre todas las partidas y mejor año.
    const hist = Stats.history(games, players);
    const me = hist.totals.find(t => t.name === player);
    $('#profile-kpis').innerHTML = [
      ['Victorias', `<span class="roman">${toRoman(me?.wins || 0)}</span>`],
      ['% de partidas', `${Math.round((me?.share || 0) * 100)}%`],
      ['Mejor año', me?.bestYear ? `${me.bestYear.year} · <span class="roman">${toRoman(me.bestYear.wins)}</span>` : '—'],
      ['Racha actual', `${pr.streak ? (pr.streak.won ? '🔥 ' : '🧊 ') : ''}${streak}`],
      ['Mejor racha', pr.bestStreak > 1 ? `${pr.bestStreak} seguidas` : pr.bestStreak ? '1 victoria' : '—'],
      ['Títulos', titles.length ? `🏆 ${titles.length}` : '—'],
    ].map(([k, v]) => `<div class="kpi"><span class="kpi-label">${k}</span><span class="kpi-value">${v}</span></div>`).join('');

    const tt = Stats.titles(games, players, settings.seasonMode);
    const mine = tt.byPlayer[player] || [];
    $('#profile-titles').innerHTML = mine.length
      ? mine.map(t => `<span class="title-chip" title="${esc(t.desc)}">${t.icon} ${esc(t.name)}</span>`).join('')
      : '<span class="muted">Sin títulos… de momento.</span>';

    const month = m => m ? `${fmtMonth(m.key)} · ${m.wins} de ${m.played} (${Stats.pct(m.wins, m.played)}%)` : '—';
    // Victorias por año (WhatsApp + app) y lo registrado solo en la app.
    const perYear = [...hist.byYear].reverse()
      .filter(y => y.wins[player])
      .map(y => `${y.year}: ${toRoman(y.wins[player])}`);
    $('#profile-months').innerHTML = `
      ${perYear.length ? `<li><span>📜 Victorias por año</span><b>${perYear.join(' · ')}</b></li>` : ''}
      <li><span>🎲 En la app</span><b>${pr.played ? `${pr.played} partidas · ${toRoman(pr.wins)} victorias (${pr.pct}%)` : 'sin partidas aún'}</b></li>`;
    $('#profile-months').innerHTML += `
      <li><span>😈 Su némesis</span><b>${pr.nemesis ? `${esc(pr.nemesis.rival)} · le ha ganado ${pr.nemesis.theirs} ${pr.nemesis.theirs === 1 ? 'vez' : 'veces'}` : '—'}</b></li>
      <li><span>🎯 Su víctima favorita</span><b>${pr.victim ? `${esc(pr.victim.rival)} · le ha ganado ${pr.victim.mine} ${pr.victim.mine === 1 ? 'vez' : 'veces'}` : '—'}</b></li>
      <li><span>📈 Mejor mes</span><b>${month(pr.bestMonth)}</b></li>
      <li><span>📉 Peor mes</span><b>${month(pr.worstMonth)}</b></li>
      ${pr.avgWin ? `<li><span>⏱ Duración media de sus victorias</span><b>${Stats.fmtDuration(pr.avgWin)}</b></li>` : ''}
      ${pr.scored ? `<li><span>🏅 Media de puntos</span><b>${pr.avgPoints.toFixed(1).replace('.', ',')} en ${pr.scored} ${pr.scored === 1 ? 'partida' : 'partidas'}</b></li>
      <li><span>😩 Veces que se quedó a uno</span><b>${pr.oneAway ? `${pr.oneAway} (con ${Stats.POINTS_GOAL - 1} puntos)` : 'ninguna'}</b></li>` : ''}
      ${titles.length ? `<li><span>🏆 Campeón en</span><b>${titles.map(t => esc(t.label)).join(', ')}</b></li>` : ''}`;

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

    // Salón de títulos (todos los títulos y quién los tiene ahora mismo).
    $('#titles-list').innerHTML = tt.list.map(t => `
      <li class="${t.holders.length ? '' : 'vacant'}">
        <span class="t-icon">${t.icon}</span>
        <div class="t-info">
          <div class="t-name">${esc(t.name)}</div>
          <div class="t-desc">${esc(t.desc)}</div>
        </div>
        <div class="t-holder">${t.holders.length ? `<b>${t.holders.map(esc).join(' · ')}</b><small>${esc(t.value)}</small>` : '<small>vacante</small>'}</div>
      </li>`).join('');

    // Récords del grupo.
    const recs = Stats.records(games, players, settings.seasonMode);
    $('#records').innerHTML = recs.length ? recs.map(r => `
      <li>
        <span class="r-icon">${r.icon}</span>
        <div class="r-info"><div class="r-title">${esc(r.title)}</div><div class="r-detail">${esc(r.detail)}</div></div>
        <b class="r-value">${esc(r.value)}</b>
      </li>`).join('') : '<li class="empty">Aún no hay récords. ¡A jugar!</li>';

    // Habilidades ganadoras (todas las partidas con habilidades guardadas).
    const ab = Stats.abilityStats(games);
    $('#abilities-stats').innerHTML = ab.length ? ab.map(a => `
      <li>
        <div class="ab-head"><span class="name">${esc(a.name)}</span> ${badge(a.deck)}</div>
        <div class="ab-meta">En juego ${a.games} ${a.games === 1 ? 'vez' : 'veces'} ·
          ${a.top ? `más gana <b>${esc(a.top)}</b> (${a.topWins} de ${a.games})` : 'sin dominador'}</div>
      </li>`).join('') : '<li class="empty">Juega partidas con el modo 🎲 Partida (o guarda las habilidades al registrar) para ver qué habilidades dan más victorias.</li>';
  }

  // Desde Ajustes → Jugadores: abrir la ficha de alguien.
  function showPlayer(name) {
    player = name;
    try { localStorage.setItem(KEY, player); } catch {}
    setMode('player');
  }

  return { init, render, showPlayer };
})();
