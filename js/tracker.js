// Tracker: registro rápido de partidas, clasificación por temporada, campeones e historial.
const Tracker = (() => {
  const $ = sel => document.querySelector(sel);
  const { esc, toRoman, medal } = Stats;
  let selected = new Set();
  let winner = null;
  let season = null; // temporada elegida en el selector (null = la actual)

  const state = () => Storage.get();
  const mode = () => state().settings.seasonMode;

  function init() {
    $('#game-date').value = Stats.today();
    $('#game-form').addEventListener('submit', onSubmit);
    $('#season-select').addEventListener('change', e => { season = e.target.value; renderRanking(); });
    resetForm();
    render();
  }

  // ---------- Registro rápido ----------

  function resetForm() {
    selected = new Set(state().players);
    winner = null;
    $('#game-note').value = '';
    renderChips();
  }

  function renderChips() {
    const players = state().players;

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

    // Solo se ofrece guardar las habilidades si hay mesa sorteada en la Holy Table.
    $('#with-abilities-row').hidden = !Tables.snapshot().length;
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

    const abilities = !$('#with-abilities-row').hidden && $('#with-abilities').checked
      ? Tables.snapshot().map(a => ({ color: a.color, deck: a.deck, name: a.name }))
      : undefined;
    addGame({
      id: Storage.uid(),
      date: $('#game-date').value,
      players: [...selected],
      winner,
      note: $('#game-note').value.trim(),
      ...(abilities ? { abilities } : {}),
    });
    App.toast(`🏆 Victoria para ${winner}`);
    resetForm();
  }

  // Guarda una partida (también la usa el modo partida) y avisa de los logros nuevos.
  function addGame(game) {
    const s = state();
    const before = [...s.games];
    s.games.unshift(game);
    Storage.save();
    const unlocked = Stats.newAchievements(before, s.games, s.players, mode());
    unlocked.forEach((a, i) => setTimeout(() => App.toast(`${a.icon} Logro para ${a.player}: ${a.name}`), 2400 * (i + 1)));
    App.refresh();
    return unlocked;
  }

  // ---------- Clasificación y campeones ----------

  function renderRanking() {
    const { games, players } = state();
    const m = mode();
    const keys = Stats.seasons(games, m);
    const select = $('#season-select');
    select.hidden = m === 'none';
    if (!keys.includes(season) && season !== 'all') season = keys[0] || 'all';
    if (m === 'none') season = 'all';
    select.innerHTML = [...keys, 'all'].map((k, i) =>
      `<option value="${k}" ${k === season ? 'selected' : ''}>${Stats.seasonLabel(k)}${i === 0 && k !== 'all' ? ' (actual)' : ''}</option>`).join('');

    const shown = Stats.inSeason(games, season, m);
    const rows = Stats.ranking(shown, players);
    $('#stats-body').innerHTML = rows.map(r => `
      <tr class="rank-${r.rank}">
        <td><span class="medal">${shown.length ? medal(r.rank) : ''}</span>${esc(r.name)}</td>
        <td>${r.played}</td>
        <td class="roman">${toRoman(r.wins)}</td>
        <td>${Math.round(r.pct * 100)}%</td>
      </tr>`).join('');
    $('#ranking-empty').hidden = shown.length > 0;

    const champs = Stats.champions(games, players, m);
    $('#champions-card').hidden = !champs.length;
    $('#champions').innerHTML = champs.map(c => `
      <li><span class="season">${esc(c.label)}</span>
        <span class="champ">🏆 ${c.winners.map(esc).join(' · ')}</span>
        <span class="roman small">${toRoman(c.wins)}</span></li>`).join('');
  }

  // ---------- Historial ----------

  function renderHistory() {
    const games = state().games;
    const list = $('#history');
    if (!games.length) {
      list.innerHTML = '<li class="empty">Aún no hay partidas. ¡A colonizar!</li>';
      return;
    }
    list.innerHTML = games.map((g, i) => {
      const d = g.date ? new Date(g.date + 'T00:00') : null;
      const others = g.players.filter(p => p !== g.winner);
      const meta = [g.duration && `⏱ ${Stats.fmtDuration(g.duration)}`, g.rounds && `🔁 ${g.rounds} rondas`].filter(Boolean);
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
          <div class="players">${others.map(p => `<span class="tag">${esc(p)}</span>`).join('')}</div>
          ${meta.length ? `<div class="game-meta">${meta.join(' · ')}</div>` : ''}
          ${g.abilities?.length ? `<div class="mini-abilities">${g.abilities.map(a =>
            `<span class="mini" style="--slot:var(--c-${a.color})">${esc(a.name)}</span>`).join('')}</div>` : ''}
          ${g.note ? `<blockquote class="note">${esc(g.note)}</blockquote>` : ''}
          ${g.photo ? `<button class="photo-thumb" data-id="${g.id}" aria-label="Ver foto de la partida"><img alt="" data-photo="${g.id}"></button>` : ''}
        </div>
        <div class="game-actions">
          <button class="icon-btn share" data-id="${g.id}" aria-label="Compartir partida">📤</button>
          ${g.photo ? '' : `<button class="icon-btn photo" data-id="${g.id}" aria-label="Añadir foto">📷</button>`}
          <button class="icon-btn del" data-id="${g.id}" aria-label="Borrar partida">🗑️</button>
        </div>
      </li>`;
    }).join('');
    list.querySelectorAll('.del').forEach(b => b.addEventListener('click', () => removeGame(b.dataset.id)));
    list.querySelectorAll('.share').forEach(b => b.addEventListener('click', () => shareGame(b.dataset.id)));
    list.querySelectorAll('.photo').forEach(b => b.addEventListener('click', () => Photos.pick(b.dataset.id)));
    list.querySelectorAll('.photo-thumb').forEach(b => b.addEventListener('click', () => Photos.view(b.dataset.id)));
    // Las miniaturas se cargan de IndexedDB después de pintar.
    list.querySelectorAll('img[data-photo]').forEach(async img => {
      const u = await Photos.url(img.dataset.photo).catch(() => null);
      if (u) img.src = u;
      else img.closest('.photo-thumb').hidden = true; // foto de otro dispositivo (no viaja en la copia)
    });
  }

  async function shareGame(id) {
    const s = state();
    const g = s.games.find(x => x.id === id);
    if (!g) return;
    const file = g.photo ? (Photos.cachedFile(id) || await Photos.file(id).catch(() => null)) : null;
    App.share(Stats.shareText(s, g), file);
  }

  function removeGame(id) {
    if (!confirm('¿Borrar esta partida?')) return;
    const s = state();
    s.games = s.games.filter(g => g.id !== id);
    Storage.save();
    Photos.remove(id).catch(() => {});
    App.refresh();
  }

  function clearAll() {
    state().games = [];
    Storage.save();
    Photos.clear().catch(() => {});
    App.refresh();
  }

  function render() {
    renderChips();
    renderRanking();
    renderHistory();
  }

  return { init, render, resetForm, clearAll, addGame, shareGame };
})();
