// Cálculos puros (sin tocar el DOM): utilidades de texto, temporadas, clasificación,
// fichas de jugador, logros, habilidades ganadoras y el resumen para compartir.
const Stats = (() => {
  // ---------- Utilidades ----------

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Texto escapado con **negrita** y *cursivas* estilo Markdown.
  const rich = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<em>$1</em>');

  // 0 no existe en romanos: se muestra un guion.
  function toRoman(n) {
    if (!n) return '—';
    const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
    return out;
  }

  // 🥇🥈🥉 y la cuchara de madera 🪵 para el último puesto.
  const MEDALS = ['🥇', '🥈', '🥉', '🪵'];
  const medal = rank => MEDALS[Math.min(rank, MEDALS.length) - 1];

  // Fecha local en formato YYYY-MM-DD (valueAsDate usaría UTC y podría dar el día anterior).
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const fmtDate = (d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
    d ? new Date(d + 'T00:00').toLocaleDateString('es-ES', opts) : '';
  const fmtMonth = key => {
    const s = new Date(key + '-01T00:00').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  function fmtDuration(sec) {
    if (!sec) return '';
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
  }
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  // «A», «A y B», «A, B y C».
  const joinNames = list => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`);

  // Partidas de la más antigua a la más reciente (por fecha; a igual fecha, por orden de registro).
  // En el estado se guardan de la más nueva a la más antigua.
  const chrono = games => games
    .map((g, i) => ({ g, i }))
    .sort((a, b) => (a.g.date || '').localeCompare(b.g.date || '') || b.i - a.i)
    .map(x => x.g);

  // Número de partida (I, II…) según el orden de registro en el historial completo
  // (aunque se pase una lista filtrada, p. ej. solo las válidas para la liga).
  const gameNumber = (games, game) => {
    const all = Storage.get()?.games.includes(game) ? Storage.get().games : games;
    return all.length - all.indexOf(game);
  };

  // ---------- Temporadas ----------

  const SEASON_MODES = { quarter: 'Trimestrales', year: 'Anuales', none: 'Sin temporadas' };

  function seasonKey(date, mode) {
    if (mode === 'none' || !date) return 'all';
    const [y, m] = date.split('-').map(Number);
    return mode === 'year' ? `${y}` : `${y}-T${Math.ceil(m / 3)}`;
  }
  function seasonLabel(key) {
    if (key === 'all') return 'Histórico';
    const [y, q] = key.split('-T');
    return q ? `T${q} ${y}` : `Año ${y}`;
  }
  const currentSeason = mode => seasonKey(today(), mode);
  const inSeason = (games, key, mode) => (key === 'all' ? games : games.filter(g => seasonKey(g.date, mode) === key));

  // ---------- Liga: partidas válidas, victorias de WhatsApp y emojis ----------

  // ⚠️ Para que la victoria sea válida debe haber un mínimo de 3 fundadores.
  const foundersIn = g => g.players.filter(p => Storage.FOUNDERS.includes(p)).length;
  const isValid = g => foundersIn(g) >= Storage.MIN_FOUNDERS;
  const valid = games => games.filter(isValid);

  // Victorias de la liga de WhatsApp (solo totales por año) para una temporada o el histórico.
  // Solo encajan con temporadas anuales; con trimestres solo cuentan en el Histórico.
  function legacyOf(key, mode) {
    const L = Storage.get()?.legacy || {};
    if (key === 'all') {
      const sum = {};
      for (const year of Object.values(L)) for (const [p, n] of Object.entries(year)) sum[p] = (sum[p] || 0) + n;
      return sum;
    }
    return mode === 'year' ? L[key] || {} : {};
  }
  const legacyTotal = (key, mode) => Object.values(legacyOf(key, mode)).reduce((a, b) => a + b, 0);

  const who = name => {
    const e = Storage.emojiOf(name);
    return e ? `${name} ${e}` : name;
  };
  // Color de cada jugador en marcadores: los de la casa con su color fijo; invitados, otros.
  const GUEST_COLORS = ['#9a6fd0', '#d0507a', '#4f9aa8', '#8a7a3c'];
  function colorOf(name) {
    const s = Storage.get();
    const i = s.players.indexOf(name);
    if (i >= 0) return `var(--p${(i % 4) + 1})`;
    return GUEST_COLORS[Math.max(0, s.guests.findIndex(g => g.name === name)) % GUEST_COLORS.length];
  }
  const pctText = r => (r.pct === null ? '—' : `${Math.round(r.pct * 100)}%`);

  // Medalla de una fila de clasificación: 🥇🥈🥉 al podio y 🪵 solo al último de los de la casa
  // (los invitados como Fuachi no llevan medalla ni cuchara).
  function rowMedal(rows, r) {
    if (r.guest || (!r.wins && rows.every(x => !x.wins))) return '';
    if (r.rank <= 3 && r.wins) return MEDALS[r.rank - 1];
    const last = Math.max(...rows.filter(x => !x.guest).map(x => x.rank));
    return r.rank === last ? '🪵' : '';
  }

  // Temporadas con partidas o con liga de WhatsApp + la actual, de la más reciente a la más antigua.
  function seasons(games, mode) {
    if (mode === 'none') return [];
    const keys = new Set(games.map(g => seasonKey(g.date, mode)));
    if (mode === 'year') Object.keys(Storage.get()?.legacy || {}).forEach(k => keys.add(k));
    keys.add(currentSeason(mode));
    return [...keys].sort().reverse();
  }

  // ---------- Clasificación ----------

  /* extra = victorias de la liga de WhatsApp { jugador: n } para ese periodo. Se suman a las
     de la app; quien solo está ahí (Fuachi) aparece como invitado. PJ y % solo cuentan las
     partidas de la app (de WhatsApp no sabemos cuántas se jugaron): pct = null si no hay. */
  function ranking(games, players, extra = {}) {
    // Invitados: los de WhatsApp con victorias y los que han jugado partidas en la app.
    const others = [...Object.keys(extra).filter(n => extra[n] > 0), ...games.flatMap(g => g.players)];
    const names = [...players, ...new Set(others.filter(n => !players.includes(n)))];
    const stats = Object.fromEntries(names.map(p => [p, { played: 0, wins: 0 }]));
    for (const g of games) {
      for (const p of g.players) {
        if (!stats[p]) continue;
        stats[p].played++;
        if (g.winner === p) stats[p].wins++;
      }
    }
    const rows = names
      .map(p => ({
        name: p,
        played: stats[p].played,
        appWins: stats[p].wins,
        legacy: extra[p] || 0,
        wins: stats[p].wins + (extra[p] || 0),
        pct: stats[p].played ? stats[p].wins / stats[p].played : null,
        guest: !players.includes(p),
      }))
      .sort((a, b) => b.wins - a.wins || (b.pct ?? -1) - (a.pct ?? -1));
    // Posición con empates compartidos (1, 1, 3, 4): mismas victorias y mismo % = mismo puesto.
    rows.forEach((r, i) => {
      const prev = rows[i - 1];
      r.rank = prev && prev.wins === r.wins && prev.pct === r.pct ? prev.rank : i + 1;
    });
    return rows;
  }

  // Clasificación de una temporada (o 'all') con las victorias de WhatsApp incluidas.
  const seasonRanking = (games, players, key, mode) => ranking(inSeason(games, key, mode), players, legacyOf(key, mode));

  // Campeones de las temporadas ya terminadas (no la actual). Empates: varios campeones.
  function champions(games, players, mode) {
    if (mode === 'none') return [];
    const now = currentSeason(mode);
    return seasons(games, mode)
      .filter(k => k !== now)
      .map(key => {
        const rows = seasonRanking(games, players, key, mode);
        const top = rows.filter(r => r.rank === 1 && r.wins > 0);
        return { key, label: seasonLabel(key), winners: top.map(r => r.name), wins: top[0]?.wins || 0 };
      })
      .filter(c => c.winners.length);
  }

  // ---------- Ficha de jugador ----------

  function profile(games, players, p) {
    const mine = chrono(games).filter(g => g.players.includes(p));
    const wins = mine.filter(g => g.winner === p);

    let best = 0, run = 0;
    for (const g of mine) {
      run = g.winner === p ? run + 1 : 0;
      best = Math.max(best, run);
    }
    // Racha actual: resultados iguales seguidos desde la última partida.
    let streak = null;
    for (let i = mine.length - 1; i >= 0; i--) {
      const won = mine[i].winner === p;
      if (!streak) streak = { won, n: 1 };
      else if (streak.won === won) streak.n++;
      else break;
    }

    const months = {};
    for (const g of mine) {
      const k = (g.date || '').slice(0, 7);
      if (!k) continue;
      if (!months[k]) months[k] = { key: k, played: 0, wins: 0 };
      months[k].played++;
      if (g.winner === p) months[k].wins++;
    }
    const ms = Object.values(months);
    const bestMonth = ms.filter(m => m.wins).sort((a, b) => b.wins - a.wins || b.wins / b.played - a.wins / a.played)[0] || null;
    const minPlayed = ms.some(m => m.played >= 2) ? 2 : 1;
    const worstMonth = ms.length > 1
      ? ms.filter(m => m.played >= minPlayed && m !== bestMonth)
          .sort((a, b) => a.wins / a.played - b.wins / b.played || b.played - a.played)[0] || null
      : null;

    const h2h = players.filter(o => o !== p).map(o => {
      const both = games.filter(g => g.players.includes(p) && g.players.includes(o));
      return {
        rival: o,
        together: both.length,
        mine: both.filter(g => g.winner === p).length,
        theirs: both.filter(g => g.winner === o).length,
      };
    });

    // Némesis: el rival que más le ha ganado estando los dos. Víctima: a quien más ha ganado él.
    const pickMax = key => h2h.filter(h => h[key] > 0)
      .sort((a, b) => b[key] - a[key] || b[key] / b.together - a[key] / a.together)[0] || null;
    const nemesis = pickMax('theirs');
    const victim = pickMax('mine');

    const timed = wins.filter(g => g.duration);
    const avgWin = timed.length ? Math.round(timed.reduce((s, g) => s + g.duration, 0) / timed.length) : 0;

    // Puntos de victoria (solo partidas jugadas con el marcador).
    const scored = mine.filter(g => g.points && g.points[p] != null);
    const avgPoints = scored.length ? scored.reduce((s, g) => s + g.points[p], 0) / scored.length : null;
    const oneAway = scored.filter(g => g.winner !== p && g.points[p] === POINTS_GOAL - 1).length;

    // Habilidades que más veces estaban en juego cuando ganó.
    const lucky = {};
    for (const g of wins) {
      for (const a of g.abilities || []) {
        const k = a.deck + '|' + a.name;
        if (!lucky[k]) lucky[k] = { name: a.name, deck: a.deck, n: 0 };
        lucky[k].n++;
      }
    }

    return {
      played: mine.length,
      wins: wins.length,
      pct: pct(wins.length, mine.length),
      streak,
      bestStreak: best,
      bestMonth,
      worstMonth,
      h2h,
      nemesis,
      victim,
      avgWin,
      avgPoints,
      oneAway,
      scored: scored.length,
      lucky: Object.values(lucky).sort((a, b) => b.n - a.n).slice(0, 3),
    };
  }

  // ---------- Evolución (victorias acumuladas) ----------

  // points[i] = victorias acumuladas de cada jugador tras el paso i (points[0] = antes de empezar).
  // baselines = bloques de la liga de WhatsApp [{ label, wins }] que van antes de las partidas
  // de la app (de WhatsApp solo hay el total del año: entra como un único salto).
  function evolution(games, players, baselines = []) {
    const acc = Object.fromEntries(players.map(p => [p, 0]));
    const points = [{ game: null, label: 'Inicio', ...acc }];
    for (const b of baselines) {
      for (const p of players) acc[p] += b.wins[p] || 0;
      points.push({ game: null, label: b.label, short: b.short, legacy: true, ...acc });
    }
    for (const g of chrono(games)) {
      if (acc[g.winner] !== undefined) acc[g.winner]++;
      points.push({ game: g, ...acc });
    }
    return points;
  }

  // ---------- Histórico de la liga (WhatsApp + app), por año natural ----------

  /* Cada partida tiene un único ganador, así que en WhatsApp «victorias = partidas».
     games = partidas válidas de la app. Devuelve años, partidas por año y victorias por
     jugador (incluidos invitados como Fuachi), con la cuota = victorias / partidas. */
  function history(games, players) {
    const L = Storage.get()?.legacy || {};
    const yearOf = g => (g.date || '').slice(0, 4);
    const years = [...new Set([...Object.keys(L), ...games.map(yearOf).filter(Boolean)])].sort();
    const guests = [...new Set([...Object.values(L).flatMap(y => Object.keys(y)), ...games.map(g => g.winner)])].filter(n => !players.includes(n));
    const names = [...players, ...guests];

    const byYear = years.map(year => {
      const legacy = L[year] || {};
      const app = games.filter(g => yearOf(g) === year);
      const wins = Object.fromEntries(names.map(n => [n, (legacy[n] || 0) + app.filter(g => g.winner === n).length]));
      const legacyGames = Object.values(legacy).reduce((a, b) => a + b, 0);
      const top = Math.max(...Object.values(wins));
      return {
        year,
        legacyGames,
        appGames: app.length,
        games: legacyGames + app.length,
        wins,
        champions: top ? names.filter(n => wins[n] === top) : [],
      };
    });

    const totalGames = byYear.reduce((a, y) => a + y.games, 0);
    const totals = names.map(n => {
      const wins = byYear.reduce((a, y) => a + y.wins[n], 0);
      const best = byYear.reduce((b, y) => (y.wins[n] > (b?.wins[n] || 0) ? y : b), null);
      return {
        name: n,
        guest: guests.includes(n),
        wins,
        share: totalGames ? wins / totalGames : 0,
        bestYear: best ? { year: best.year, wins: best.wins[n] } : null,
        titles: byYear.filter(y => y.year !== String(new Date().getFullYear()) && y.champions.includes(n)).map(y => y.year),
      };
    }).sort((a, b) => b.wins - a.wins);

    return { years, byYear, names, totalGames, totals, busiest: byYear.reduce((b, y) => (!b || y.games > b.games ? y : b), null) };
  }

  // ---------- Predicción de campeón ----------

  /* ¿Quién ganará el año? Con el ritmo de partidas del año (partidas / fracción del año
     transcurrida) se estiman las que faltan, y se simulan miles de veces: en cada partida
     simulada gana cada jugador con probabilidad proporcional a sus victorias del año (+1,
     para no dar 0 % a nadie). Devuelve null si el año ya terminó o hay pocas partidas. */
  function predict(games, players, year = String(new Date().getFullYear()), sims = 4000) {
    const h = history(games, players);
    const y = h.byYear.find(x => x.year === year);
    if (!y || y.games < 5) return null;
    const start = new Date(+year, 0, 1), end = new Date(+year + 1, 0, 1), now = new Date();
    const frac = (now - start) / (end - start);
    if (frac <= 0 || frac >= 1) return null;

    const projected = Math.max(y.games, Math.round(y.games / frac));
    const remaining = projected - y.games;
    const names = h.names.filter(n => players.includes(n) || y.wins[n] > 0);
    const weights = names.map(n => y.wins[n] + 1);
    const totalW = weights.reduce((a, b) => a + b, 0);
    const firsts = Object.fromEntries(names.map(n => [n, 0]));

    for (let s = 0; s < sims; s++) {
      const w = names.map(n => y.wins[n]);
      for (let g = 0; g < remaining; g++) {
        let r = Math.random() * totalW, k = 0;
        while (r >= weights[k]) { r -= weights[k]; k++; }
        w[k]++;
      }
      const top = Math.max(...w);
      const leaders = names.filter((n, i) => w[i] === top);
      leaders.forEach(n => { firsts[n] += 1 / leaders.length; }); // empate: se reparte
    }

    const rows = names.map((n, i) => ({
      name: n,
      guest: !players.includes(n),
      wins: y.wins[n],
      expected: Math.round(y.wins[n] + (weights[i] / totalW) * remaining),
      prob: firsts[n] / sims,
    })).sort((a, b) => b.prob - a.prob || b.wins - a.wins);
    return { year, played: y.games, projected, remaining, rows };
  }

  // Bloques de WhatsApp para el gráfico de evolución de un periodo ('all' = todos los años).
  function legacyBaselines(key, mode) {
    const L = Storage.get()?.legacy || {};
    const years = key === 'all' ? Object.keys(L).sort() : mode === 'year' && L[key] ? [key] : [];
    return years.map(y => ({ label: `Liga ${y} (WhatsApp)`, short: y, wins: L[y] }));
  }

  // ---------- Habilidades ganadoras ----------

  function abilityStats(games) {
    const map = {};
    for (const g of games) {
      for (const a of g.abilities || []) {
        const k = a.deck + '|' + a.name;
        if (!map[k]) map[k] = { name: a.name, deck: a.deck, games: 0, wins: {} };
        map[k].games++;
        map[k].wins[g.winner] = (map[k].wins[g.winner] || 0) + 1;
      }
    }
    return Object.values(map)
      .map(a => {
        const [top, n] = Object.entries(a.wins).sort((x, y) => y[1] - x[1])[0] || [null, 0];
        const tied = Object.values(a.wins).filter(v => v === n).length > 1;
        return { ...a, top: tied ? null : top, topWins: n };
      })
      .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));
  }

  // ---------- Rachas (para récords y títulos) ----------

  // Mejor racha de victorias y peor de derrotas de un jugador, con la fecha en que se alcanzó.
  function streaks(games, p) {
    let win = 0, loss = 0;
    const best = { n: 0, date: null }, worst = { n: 0, date: null };
    for (const g of chrono(games).filter(x => x.players.includes(p))) {
      if (g.winner === p) { win++; loss = 0; } else { loss++; win = 0; }
      if (win > best.n) Object.assign(best, { n: win, date: g.date });
      if (loss > worst.n) Object.assign(worst, { n: loss, date: g.date });
    }
    return { best, worst };
  }

  // ---------- Puntos de victoria ----------

  const POINTS_GOAL = 10;

  // Diferencia entre el ganador y el mejor de los demás (null si la partida no tiene puntos).
  function margin(g) {
    if (!g.points || g.points[g.winner] == null) return null;
    const others = g.players.filter(p => p !== g.winner && g.points[p] != null).map(p => g.points[p]);
    return others.length ? g.points[g.winner] - Math.max(...others) : null;
  }

  // «Kristy🏍️ 10 · Emi💃🏼 8 · …», de más a menos puntos.
  function pointsLine(g) {
    if (!g.points) return '';
    return g.players.filter(p => g.points[p] != null)
      .sort((a, b) => g.points[b] - g.points[a])
      .map(p => `${who(p)} ${g.points[p]}`).join(' · ');
  }

  // ---------- Récords del grupo ----------

  function records(games, players, mode) {
    const out = [];
    const num = g => toRoman(gameNumber(games, g));
    const timed = games.filter(g => g.duration);
    if (timed.length) {
      const long = timed.reduce((a, b) => (b.duration > a.duration ? b : a));
      const short = timed.reduce((a, b) => (b.duration < a.duration ? b : a));
      out.push({ icon: '🐢', title: 'Partida más larga', value: fmtDuration(long.duration), detail: `Partida ${num(long)} · ganó ${long.winner}` });
      if (timed.length > 1) out.push({ icon: '⚡', title: 'Partida más corta', value: fmtDuration(short.duration), detail: `Partida ${num(short)} · ganó ${short.winner}` });
    }

    const scored = games.filter(g => margin(g) != null);
    if (scored.length) {
      const tight = scored.reduce((a, b) => (margin(b) < margin(a) ? b : a));
      const crush = scored.reduce((a, b) => (margin(b) > margin(a) ? b : a));
      const by = n => `por ${n} punto${n === 1 ? '' : 's'}`;
      out.push({ icon: '😰', title: 'Partida más ajustada', value: by(margin(tight)), detail: `Partida ${num(tight)} · ${pointsLine(tight)}` });
      if (scored.length > 1 && crush !== tight) out.push({ icon: '💥', title: 'Mayor paliza', value: by(margin(crush)), detail: `Partida ${num(crush)} · ${pointsLine(crush)}` });
    }

    const st = players.map(p => ({ p, ...streaks(games, p) }));
    const bw = st.reduce((a, b) => (b.best.n > a.best.n ? b : a), st[0]);
    if (bw?.best.n >= 2) out.push({ icon: '🔥', title: 'Racha de victorias', value: `${bw.best.n} seguidas`, detail: `${bw.p} · hasta el ${fmtDate(bw.best.date)}` });
    const wl = st.reduce((a, b) => (b.worst.n > a.worst.n ? b : a), st[0]);
    if (wl?.worst.n >= 3) out.push({ icon: '🪵', title: 'Racha de derrotas', value: `${wl.worst.n} seguidas`, detail: `${wl.p} · hasta el ${fmtDate(wl.worst.date)}` });

    if (mode !== 'none') {
      let top = null;
      for (const key of seasons(games, mode)) {
        const r = seasonRanking(games, players, key, mode)[0];
        if (r?.wins && (!top || r.wins > top.wins)) top = { ...r, key };
      }
      if (top) out.push({ icon: '👑', title: 'Más victorias en una temporada', value: toRoman(top.wins), detail: `${top.name} · ${seasonLabel(top.key)}` });
    }

    const h = history(games, players);
    if (h.busiest?.games) out.push({ icon: '📆', title: 'Año con más partidas', value: `${h.busiest.games} partidas`, detail: `${h.busiest.year}${h.busiest.legacyGames ? ' · con la liga de WhatsApp' : ''}` });

    const days = {};
    for (const g of games) if (g.date) days[g.date] = (days[g.date] || 0) + 1;
    const [busy, n] = Object.entries(days).sort((a, b) => b[1] - a[1])[0] || [];
    if (n >= 2) out.push({ icon: '📅', title: 'Día más viciado', value: `${n} partidas`, detail: fmtDate(busy, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) });

    const players4 = games.filter(g => g.players.length === players.length).length;
    if (games.length) out.push({ icon: '👥', title: 'Partidas con todos', value: `${players4} de ${games.length}`, detail: `${pct(players4, games.length)}% con los ${players.length} jugadores` });
    return out;
  }

  // ---------- Títulos automáticos ----------

  // Cada título es para quien lidera ese dato (empates: lo comparten). Se recalculan solos.
  const TITLES = [
    { id: 'emperor', icon: '👑', name: 'El Emperador', desc: 'Más victorias', min: 1 },
    { id: 'sniper', icon: '🎯', name: 'El Francotirador', desc: 'Mejor % de victorias (mín. 5 partidas)', min: 0.01 },
    { id: 'unstoppable', icon: '🔥', name: 'El Imparable', desc: 'Mejor racha de victorias', min: 2 },
    { id: 'second', icon: '🥈', name: 'Eterno segundo', desc: 'Más veces segundo en temporadas terminadas', min: 1 },
    { id: 'martyr', icon: '🕯️', name: 'El Mártir', desc: 'Más victorias con la Martyr Table en juego', min: 1 },
    { id: 'saint', icon: '😇', name: 'El Santo', desc: 'Más victorias con la Holy Table en juego', min: 1 },
    { id: 'shitking', icon: '💩', name: 'Rey de la Shit Table', desc: 'Más victorias con la Shit Table en juego', min: 1 },
    { id: 'lightning', icon: '⚡', name: 'El Rayo', desc: 'La victoria más rápida', min: -Infinity },
    { id: 'loyal', icon: '📅', name: 'El Fiel', desc: 'Más partidas jugadas', min: 1 },
    { id: 'lumberjack', icon: '🪵', name: 'El Leñador', desc: 'Peor racha de derrotas', min: 3 },
  ];

  // scope = periodo de las partidas recibidas ('all' o una temporada): para sumar al
  // Emperador las victorias de la liga de WhatsApp de ese mismo periodo.
  function titles(games, players, mode, scope = 'all') {
    const closed = champions(games, players, mode).map(c => c.key);
    const extra = legacyOf(scope, mode);
    const score = {}; // score[titleId][player] = número (más alto = mejor) o null
    const label = {}; // texto del valor para mostrar
    const set = (id, p, v, txt) => { (score[id] = score[id] || {})[p] = v; (label[id] = label[id] || {})[p] = txt; };

    for (const p of players) {
      const mine = games.filter(g => g.players.includes(p));
      const wins = mine.filter(g => g.winner === p);
      const { best, worst } = streaks(games, p);
      const withDeck = d => wins.filter(g => (g.abilities || []).some(a => a.deck === d)).length;
      const seconds = closed.filter(k => {
        const rows = seasonRanking(games, players, k, mode);
        return rows.some(r => r.name === p && r.rank === 2);
      }).length;
      const fastest = wins.filter(g => g.duration).reduce((m, g) => Math.min(m, g.duration), Infinity);

      const allWins = wins.length + (extra[p] || 0);
      set('emperor', p, allWins, `${toRoman(allWins)} victorias`);
      set('sniper', p, mine.length >= 5 ? wins.length / mine.length : null, `${pct(wins.length, mine.length)}%`);
      set('unstoppable', p, best.n, `${best.n} seguidas`);
      set('second', p, seconds, `${seconds} ${seconds === 1 ? 'vez' : 'veces'}`);
      set('martyr', p, withDeck('martyr'), `${withDeck('martyr')} victorias`);
      set('saint', p, withDeck('holy'), `${withDeck('holy')} victorias`);
      set('shitking', p, withDeck('shit'), `${withDeck('shit')} victorias`);
      set('lightning', p, Number.isFinite(fastest) ? -fastest : null, Number.isFinite(fastest) ? fmtDuration(fastest) : '');
      set('loyal', p, mine.length, `${mine.length} partidas`);
      set('lumberjack', p, worst.n, `${worst.n} derrotas seguidas`);
    }

    const list = TITLES.map(t => {
      const vals = players.map(p => score[t.id][p]).filter(v => v !== null && v >= t.min);
      if (!vals.length) return { ...t, holders: [] };
      const top = Math.max(...vals);
      const holders = players.filter(p => score[t.id][p] === top);
      // Un título que comparte más de la mitad del grupo no distingue a nadie: queda vacante.
      const tooMany = players.length > 1 && holders.length > players.length / 2;
      return { ...t, holders: tooMany ? [] : holders, value: tooMany ? '' : label[t.id][holders[0]] };
    });
    // Para cada jugador, primero sus títulos más exclusivos (menos compartidos).
    const byPlayer = Object.fromEntries(players.map(p => [p,
      list.filter(t => t.holders.includes(p)).sort((a, b) => a.holders.length - b.holders.length)]));
    return { list, byPlayer };
  }

  // ---------- Wrapped de la temporada ----------

  function wrapped(games, players, mode, key) {
    const shown = inSeason(games, key, mode);
    const legacyWins = legacyTotal(key, mode);
    if (!shown.length && !legacyWins) return null;
    const rows = seasonRanking(games, players, key, mode);
    // La cuchara es para los de la casa (no para invitados como Fuachi).
    const regulars = rows.filter(r => !r.guest);
    const lastRank = Math.max(...regulars.map(r => r.rank));
    const hours = shown.reduce((s, g) => s + (g.duration || 0), 0);
    const st = players.map(p => ({ p, ...streaks(shown, p) })).sort((a, b) => b.best.n - a.best.n)[0];
    const abil = abilityStats(shown).filter(a => a.top).sort((a, b) => b.topWins - a.topWins)[0] || null;
    const timed = shown.filter(g => g.duration);
    const longest = timed.length ? timed.reduce((a, b) => (b.duration > a.duration ? b : a)) : null;
    const days = new Set(shown.map(g => g.date)).size;
    const t = titles(shown, players, mode, key);
    // La cuchara solo tiene gracia si es de pocos: si la comparte más de la mitad, no se da.
    const spoon = regulars.filter(r => r.rank === lastRank && lastRank > 3); // nunca a quien está en el podio
    return {
      key,
      label: seasonLabel(key),
      games: shown.length,
      legacyWins,
      days,
      hours,
      champions: rows.filter(r => r.rank === 1 && r.wins > 0),
      podium: rows,
      spoon: spoon.length > players.length / 2 ? [] : spoon,
      streak: st?.best.n >= 2 ? { player: st.p, n: st.best.n } : null,
      ability: abil,
      longest,
      titles: t.list.filter(x => x.holders.length && x.id !== 'second'), // «Eterno segundo» es entre temporadas
      gameNumber: g => toRoman(gameNumber(games, g)),
    };
  }

  function wrappedText(w) {
    const lines = [
      `🎁 *Catán Wrapped · ${w.label}*`,
      w.legacyWins ? `📜 ${w.legacyWins} victorias de la liga de WhatsApp` : null,
      w.games ? `🎲 ${w.games} partidas en la app en ${w.days} ${w.days === 1 ? 'día' : 'días'}${w.hours ? ` · ⏱ ${fmtDuration(w.hours)} jugando` : ''}` : null,
      w.champions.length ? `🏆 Campeón: *${joinNames(w.champions.map(c => who(c.name)))}* (${toRoman(w.champions[0].wins)})` : null,
      w.spoon.length ? `🪵 Cuchara de madera: ${joinNames(w.spoon.map(s => who(s.name)))}` : null,
      w.streak ? `🔥 Mejor racha: ${w.streak.player}, ${w.streak.n} seguidas` : null,
      w.ability ? `🎴 Habilidad talismán: ${w.ability.name} (${w.ability.top} ganó ${w.ability.topWins})` : null,
      w.longest ? `🐢 Partida más larga: ${fmtDuration(w.longest.duration)} (ganó ${w.longest.winner})` : null,
      '',
      '📊 Clasificación:',
      ...w.podium.map(r => `${rowMedal(w.podium, r) || '▫️'} ${who(r.name)} · ${toRoman(r.wins)}`),
    ];
    if (w.titles.length) lines.push('', '🎖️ Títulos:', ...w.titles.map(t => `${t.icon} ${t.name}: ${joinNames(t.holders)}`));
    return lines.filter(l => l !== null).join('\n');
  }

  // ---------- Logros ----------

  const ACHIEVEMENTS = [
    { id: 'first', icon: '🎉', name: 'Primera sangre', desc: 'Gana tu primera partida' },
    { id: 'streak3', icon: '🔥', name: 'En racha', desc: 'Gana 3 partidas seguidas' },
    { id: 'streak5', icon: '💥', name: 'Imparable', desc: 'Gana 5 partidas seguidas' },
    { id: 'ten', icon: '👑', name: 'Decimus', desc: 'Llega a X victorias' },
    { id: 'vet', icon: '🏅', name: 'Veterano', desc: 'Juega 10 partidas' },
    { id: 'legend', icon: '🏛️', name: 'Leyenda', desc: 'Juega L (50) partidas' },
    { id: 'comeback', icon: '🔄', name: 'Remontada', desc: 'Gana justo después de perder 3 seguidas' },
    { id: 'allrivals', icon: '🎯', name: 'Pleno', desc: 'Gana al menos una vez a cada rival' },
    { id: 'martyr', icon: '🕯️', name: 'Mártir de honor', desc: 'Gana con una habilidad de la Martyr Table en juego' },
    { id: 'survivor', icon: '💩', name: 'Superviviente', desc: 'Gana con 2+ habilidades de la Shit Table en juego' },
    { id: 'flash', icon: '⚡', name: 'Relámpago', desc: 'Gana una partida de menos de 45 min' },
    { id: 'marathon', icon: '🐢', name: 'Maratón', desc: 'Gana una partida de más de 2 h' },
    { id: 'champion', icon: '🏆', name: 'Campeón', desc: 'Gana una temporada' },
    { id: 'spoon', icon: '🪵', name: 'Cuchara de madera', desc: 'Pierde 5 partidas seguidas (también cuenta)' },
  ];

  function achievements(games, players, mode, p) {
    const mine = chrono(games).filter(g => g.players.includes(p));
    const wins = mine.filter(g => g.winner === p);
    const got = new Set();

    let run = 0, lossRun = 0;
    for (const g of mine) {
      if (g.winner === p) {
        if (lossRun >= 3) got.add('comeback');
        run++; lossRun = 0;
      } else {
        lossRun++; run = 0;
      }
      if (run >= 3) got.add('streak3');
      if (run >= 5) got.add('streak5');
      if (lossRun >= 5) got.add('spoon');
    }
    if (wins.length) got.add('first');
    if (wins.length >= 10) got.add('ten');
    if (mine.length >= 10) got.add('vet');
    if (mine.length >= 50) got.add('legend');

    const rivals = players.filter(o => o !== p);
    if (rivals.length && rivals.every(o => wins.some(g => g.players.includes(o)))) got.add('allrivals');

    for (const g of wins) {
      const decks = (g.abilities || []).map(a => a.deck);
      if (decks.includes('martyr')) got.add('martyr');
      if (decks.filter(d => d === 'shit').length >= 2) got.add('survivor');
      if (g.duration && g.duration < 45 * 60) got.add('flash');
      if (g.duration && g.duration > 2 * 3600) got.add('marathon');
    }
    if (champions(games, players, mode).some(c => c.winners.includes(p))) got.add('champion');
    return got;
  }

  // Logros que se acaban de desbloquear al pasar de `before` a `after` (lista de partidas).
  function newAchievements(before, after, players, mode) {
    const out = [];
    for (const p of players) {
      const was = achievements(before, players, mode, p);
      for (const id of achievements(after, players, mode, p)) {
        if (!was.has(id)) out.push({ player: p, ...ACHIEVEMENTS.find(a => a.id === id) });
      }
    }
    return out;
  }

  // ---------- Resumen para compartir (WhatsApp, etc.) ----------

  // Clasificación con el mismo formato que el grupo de WhatsApp:
  // ✨ *LIGA DE CATANES* ✨2026✨  /  Serbest👙: XIII🥇
  function leagueText(state, key) {
    const { games, players, settings } = state;
    const mode = settings.seasonMode;
    const rows = seasonRanking(valid(games), players, key, mode);
    const label = key === 'all' ? 'HISTÓRICO' : /^\d+$/.test(key) ? key : seasonLabel(key);
    return [
      `✨ *LIGA DE CATANES* ✨${label}✨`,
      ...rows.map(r => `${r.name}${Storage.EMOJI[r.name] || ''}: ${toRoman(r.wins)}${r.rank <= 3 && r.wins ? MEDALS[r.rank - 1] : ''}`),
    ].join('\n');
  }

  function shareText(state, game) {
    const { games, settings } = state;
    const mode = settings.seasonMode;
    const lines = [
      `🎲 *Catán · Partida ${toRoman(gameNumber(games, game))}* — ${fmtDate(game.date, { weekday: 'long', day: 'numeric', month: 'long' })}`,
      `🏆 Gana *${who(game.winner)}*`,
      `👥 ${game.players.map(who).join(', ')}`,
    ];
    if (!isValid(game)) lines.push(`⚠️ Menos de ${Storage.MIN_FOUNDERS} fundadores: no cuenta para la liga`);
    const extra = [game.duration && `⏱ ${fmtDuration(game.duration)}`, game.rounds && `🔁 ${game.rounds} rondas`].filter(Boolean);
    if (extra.length) lines.push(extra.join(' · '));
    if (game.points) lines.push(`🏅 ${pointsLine(game)}`);
    if (game.abilities?.length) {
      const emoji = Object.fromEntries(Storage.COLORS.map(c => [c.id, c.emoji]));
      lines.push('', '🎴 Habilidades:', ...game.abilities.map(a => `${emoji[a.color] || '▪️'} ${a.name}`));
    }
    if (game.note) lines.push('', `📝 «${game.note}»`);

    const key = mode === 'none' ? 'all' : seasonKey(game.date, mode);
    lines.push('', leagueText(state, key));
    return lines.join('\n');
  }

  return {
    esc, rich, toRoman, MEDALS, medal, rowMedal, today, fmtDate, fmtMonth, fmtDuration, pct, pctText, joinNames, chrono, gameNumber,
    SEASON_MODES, seasonKey, seasonLabel, currentSeason, inSeason, seasons,
    isValid, valid, foundersIn, legacyOf, legacyTotal, who, colorOf,
    POINTS_GOAL, margin, pointsLine,
    ranking, seasonRanking, champions, profile, evolution, history, predict, legacyBaselines, streaks, records, TITLES, titles, wrapped, wrappedText,
    abilityStats, ACHIEVEMENTS, achievements, newAchievements, leagueText, shareText,
  };
})();
