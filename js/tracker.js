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
    const stats = Object.fromEntries(players.map(p => [p, { played: 0, wins: 0, losses: 0 }]));
    for (const g of games) {
      for (const p of g.players) {
        if (!stats[p]) continue;
        stats[p].played++;
        g.winner === p ? stats[p].wins++ : stats[p].losses++;
      }
    }
    return players
      .map(p => ({ name: p, ...stats[p], pct: stats[p].played ? stats[p].wins / stats[p].played : 0 }))
      .sort((a, b) => b.wins - a.wins || b.pct - a.pct);
  }

  function render() {
    const rows = computeStats();
    const topWins = rows[0]?.wins || 0;
    $('#stats-body').innerHTML = rows.map(r => `
      <tr class="${topWins && r.wins === topWins ? 'leader' : ''}">
        <td>${esc(r.name)}</td>
        <td>${r.played}</td>
        <td>${r.wins}</td>
        <td>${r.losses}</td>
        <td>${Math.round(r.pct * 100)}%</td>
      </tr>`).join('');

    const games = Storage.get().games;
    const list = $('#history');
    if (!games.length) {
      list.innerHTML = '<li class="empty">Aún no hay partidas. ¡A colonizar!</li>';
      return;
    }
    list.innerHTML = games.map(g => `
      <li>
        <div class="info">
          <div class="win">🏆 ${esc(g.winner)}</div>
          <div class="meta">${formatDate(g.date)} · ${g.players.map(esc).join(', ')}${g.note ? ' · ' + esc(g.note) : ''}</div>
        </div>
        <button class="del" data-id="${g.id}" aria-label="Borrar partida">🗑️</button>
      </li>`).join('');
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
  const formatDate = d => d ? new Date(d + 'T00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  return { init, render, resetForm, clearAll, esc };
})();
