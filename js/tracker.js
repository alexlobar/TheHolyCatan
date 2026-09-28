// Tracker de victorias/derrotas: una partida = participantes + ganador.
// El ganador suma una victoria; el resto de participantes, una derrota.
const Tracker = (() => {
  const $ = sel => document.querySelector(sel);
  let selected = new Set();
  let winner = null;

  function init() {
    $('#game-date').value = today();
    $('#game-form').addEventListener('submit', onSubmit);
    resetForm();
    render();
  }

  function resetForm() {
    selected = new Set(Storage.get().players);
    winner = null;
    $('#game-note').value = '';
    renderChips();
  }

  function renderChips() {
    const players = Storage.get().players;

    $('#participants').replaceChildren(...players.map(p => chip(p, selected.has(p), '', () => {
      selected.has(p) ? selected.delete(p) : selected.add(p);
      if (!selected.has(winner)) winner = null;
      renderChips();
    })));

    $('#winner').replaceChildren(...players.map(p => {
      const c = chip(p, winner === p, 'winner', () => { winner = p; renderChips(); });
      c.disabled = !selected.has(p);
      return c;
    }));
  }

  function chip(label, on, extra, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `chip ${extra} ${on ? 'on' : ''}`;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function onSubmit(e) {
    e.preventDefault();
    if (selected.size < 2) return App.toast('Selecciona al menos 2 jugadores');
    if (!winner) return App.toast('Elige quién ha ganado');

    const state = Storage.get();
    state.games.unshift({
      id: Date.now().toString(36),
      date: $('#game-date').value,
      players: [...selected],
      winner,
      note: $('#game-note').value.trim(),
    });
    Storage.save();
    App.toast(`🏆 Victoria para ${winner}`);
    resetForm();
    render();
  }

  function computeStats() {
    const { players, games } = Storage.get();
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

  // 🥇🥈🥉 y la cuchara de madera 🪵 para el último puesto.
  const MEDALS = ['🥇', '🥈', '🥉', '🪵'];

  function render() {
    const rows = computeStats();
    const games = Storage.get().games;
    $('#stats-body').innerHTML = rows.map(r => `
      <tr class="rank-${r.rank}">
        <td><span class="medal">${games.length ? MEDALS[Math.min(r.rank, MEDALS.length) - 1] : ''}</span>${esc(r.name)}</td>
        <td>${r.played}</td>
        <td class="roman">${toRoman(r.wins)}</td>
        <td>${Math.round(r.pct * 100)}%</td>
      </tr>`).join('');

    const list = $('#history');
    if (!games.length) {
      list.innerHTML = '<li class="empty">Aún no hay partidas. ¡A colonizar!</li>';
      return;
    }
    // Las partidas se guardan de la más nueva a la más antigua; el número es el orden de registro.
    list.innerHTML = games.map((g, i) => {
      const d = g.date ? new Date(g.date + 'T00:00') : null;
      const others = g.players.filter(p => p !== g.winner);
      return `
      <li class="game">
        <div class="date-badge">
          <span class="day">${d ? d.getDate() : '?'}</span>
          <span class="month">${d ? d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '') : ''}</span>
          <span class="year">${d ? d.getFullYear() : ''}</span>
        </div>
        <div class="info">
          <div class="game-num">Partida ${toRoman(games.length - i)}</div>
          <div class="win">🏆 ${esc(g.winner)}</div>
          <div class="players">
            ${others.map(p => `<span class="tag">${esc(p)}</span>`).join('')}
          </div>
          ${g.note ? `<blockquote class="note">${esc(g.note)}</blockquote>` : ''}
        </div>
        <button class="del" data-id="${g.id}" aria-label="Borrar partida">🗑️</button>
      </li>`;
    }).join('');
    list.querySelectorAll('.del').forEach(b => b.addEventListener('click', () => removeGame(b.dataset.id)));
  }

  function removeGame(id) {
    if (!confirm('¿Borrar esta partida?')) return;
    const state = Storage.get();
    state.games = state.games.filter(g => g.id !== id);
    Storage.save();
    render();
  }

  function clearAll() {
    Storage.get().games = [];
    Storage.save();
    render();
  }

  // Fecha local en formato YYYY-MM-DD (valueAsDate usaría UTC y podría dar el día anterior).
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  // 0 no existe en romanos: se muestra un guion.
  function toRoman(n) {
    if (!n) return '—';
    const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
    return out;
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  return { init, render, resetForm, clearAll, esc };
})();
