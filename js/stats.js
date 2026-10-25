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

  // Partidas de la más antigua a la más reciente (por fecha; a igual fecha, por orden de registro).
  // En el estado se guardan de la más nueva a la más antigua.
  const chrono = games => games
    .map((g, i) => ({ g, i }))
    .sort((a, b) => (a.g.date || '').localeCompare(b.g.date || '') || b.i - a.i)
    .map(x => x.g);

  // Número de partida (I, II…) según el orden de registro.
  const gameNumber = (games, game) => games.length - games.indexOf(game);

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

  // Temporadas con partidas + la actual, de la más reciente a la más antigua.
  function seasons(games, mode) {
    if (mode === 'none') return [];
    const keys = new Set(games.map(g => seasonKey(g.date, mode)));
    keys.add(currentSeason(mode));
    return [...keys].sort().reverse();
  }

  // ---------- Clasificación ----------

  function ranking(games, players) {
    const stats = Object.fromEntries(players.map(p => [p, { played: 0, wins: 0 }]));
    for (const g of games) {
      for (const p of g.players) {
        if (!stats[p]) continue;
        stats[p].played++;
        if (g.winner === p) stats[p].wins++;
      }
    }
    const rows = players
      .map(p => ({ name: p, ...stats[p], pct: stats[p].played ? stats[p].wins / stats[p].played : 0 }))
      .sort((a, b) => b.wins - a.wins || b.pct - a.pct);
    // Posición con empates compartidos (1, 1, 3, 4): mismas victorias y mismo % = mismo puesto.
    rows.forEach((r, i) => {
      const prev = rows[i - 1];
      r.rank = prev && prev.wins === r.wins && prev.pct === r.pct ? prev.rank : i + 1;
    });
    return rows;
  }

  // Campeones de las temporadas ya terminadas (no la actual). Empates: varios campeones.
  function champions(games, players, mode) {
    if (mode === 'none') return [];
    const now = currentSeason(mode);
    return seasons(games, mode)
      .filter(k => k !== now)
      .map(key => {
        const rows = ranking(inSeason(games, key, mode), players);
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
      months[k] ??= { key: k, played: 0, wins: 0 };
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

    const timed = wins.filter(g => g.duration);
    const avgWin = timed.length ? Math.round(timed.reduce((s, g) => s + g.duration, 0) / timed.length) : 0;

    // Habilidades que más veces estaban en juego cuando ganó.
    const lucky = {};
    for (const g of wins) {
      for (const a of g.abilities || []) {
        const k = a.deck + '|' + a.name;
        lucky[k] ??= { name: a.name, deck: a.deck, n: 0 };
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
      avgWin,
      lucky: Object.values(lucky).sort((a, b) => b.n - a.n).slice(0, 3),
    };
  }

  // ---------- Evolución (victorias acumuladas) ----------

  // points[i] = victorias acumuladas de cada jugador tras la partida i (points[0] = antes de empezar).
  function evolution(games, players) {
    const list = chrono(games);
    const acc = Object.fromEntries(players.map(p => [p, 0]));
    const points = [{ game: null, ...acc }];
    for (const g of list) {
      if (acc[g.winner] !== undefined) acc[g.winner]++;
      points.push({ game: g, ...acc });
    }
    return points;
  }

  // ---------- Dados ----------

  const DICE_WAYS = s => 6 - Math.abs(7 - s); // combinaciones de 2d6 que suman s
  function diceStats(rolls) {
    const counts = Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(s => [s, 0]));
    for (const r of rolls) if (counts[r] !== undefined) counts[r]++;
    return Object.entries(counts).map(([s, n]) => ({
      sum: +s, n, expected: (rolls.length * DICE_WAYS(+s)) / 36,
    }));
  }

  // ---------- Habilidades ganadoras ----------

  function abilityStats(games) {
    const map = {};
    for (const g of games) {
      for (const a of g.abilities || []) {
        const k = a.deck + '|' + a.name;
        map[k] ??= { name: a.name, deck: a.deck, games: 0, wins: {} };
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

  function shareText(state, game) {
    const { games, players, settings } = state;
    const mode = settings.seasonMode;
    const lines = [
      `🎲 *Catán · Partida ${toRoman(gameNumber(games, game))}* — ${fmtDate(game.date, { weekday: 'long', day: 'numeric', month: 'long' })}`,
      `🏆 Gana *${game.winner}*`,
      `👥 ${game.players.join(', ')}`,
    ];
    const extra = [game.duration && `⏱ ${fmtDuration(game.duration)}`, game.rounds && `🔁 ${game.rounds} rondas`].filter(Boolean);
    if (extra.length) lines.push(extra.join(' · '));
    if (game.abilities?.length) {
      const emoji = Object.fromEntries(Storage.COLORS.map(c => [c.id, c.emoji]));
      lines.push('', '🎴 Habilidades:', ...game.abilities.map(a => `${emoji[a.color] || '▪️'} ${a.name}`));
    }
    if (game.note) lines.push('', `📝 «${game.note}»`);

    const key = mode === 'none' ? 'all' : seasonKey(game.date, mode);
    const rows = ranking(inSeason(games, key, mode), players);
    lines.push('', `📊 Clasificación${key === 'all' ? '' : ` ${seasonLabel(key)}`}:`,
      ...rows.map(r => `${medal(r.rank)} ${r.name} · ${toRoman(r.wins)} (${Math.round(r.pct * 100)}%)`));
    return lines.join('\n');
  }

  return {
    esc, rich, toRoman, MEDALS, medal, today, fmtDate, fmtMonth, fmtDuration, pct, chrono, gameNumber,
    SEASON_MODES, seasonKey, seasonLabel, currentSeason, inSeason, seasons,
    ranking, champions, profile, evolution, DICE_WAYS, diceStats,
    abilityStats, ACHIEVEMENTS, achievements, newAchievements, shareText,
  };
})();
