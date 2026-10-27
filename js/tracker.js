// Tracker: registro rápido de partidas, clasificación por temporada, campeones e historial.
const Tracker = (() => {
  const $ = sel => document.querySelector(sel);
  const { esc, toRoman, medal, who } = Stats;
  let selected = new Set();
  let winner = null;
  let season = null; // temporada elegida en el selector (null = la actual)

  const state = () => Storage.get();
  const mode = () => state().settings.seasonMode;

  function init() {
    $('#game-date').value = Stats.today();
    $('#game-form').addEventListener('submit', onSubmit);
    $('#season-select').addEventListener('change', e => { season = e.target.value; renderRanking(); });
    $('#wrapped-open').addEventListener('click', () => Wrapped.open(season));
    $('#league-share').addEventListener('click', () => App.share(Stats.leagueText(state(), season)));
    $('#league-image').addEventListener('click', () => Img.share(season));
    initEdit();
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
    // Los de la casa + invitados (los invitados empiezan sin marcar).
    const players = Storage.roster();
    for (const p of selected) if (!players.includes(p)) selected.delete(p);

    $('#participants').replaceChildren(...players.map(p => chip(who(p), selected.has(p), Storage.isGuest(p) ? 'guest-chip' : '', () => {
      selected.has(p) ? selected.delete(p) : selected.add(p);
      if (!selected.has(winner)) winner = null;
      renderChips();
    })), chip('＋ Invitado', false, 'add-guest', () => App.addGuest(name => { selected.add(name); renderChips(); })));

    $('#winner').replaceChildren(...players.filter(p => selected.has(p) || !Storage.isGuest(p)).map(p => {
      const c = chip(who(p), winner === p, 'winner', () => { winner = p; renderChips(); });
      c.disabled = !selected.has(p);
      return c;
    }));

    // ⚠️ Regla de la liga: con menos de 3 fundadores la victoria no cuenta.
    const founders = [...selected].filter(p => Storage.FOUNDERS.includes(p)).length;
    $('#founders-warning').hidden = founders >= Storage.MIN_FOUNDERS;

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
    App.toast(Stats.isValid(state().games[0])
      ? `🏆 Victoria para ${winner}`
      : `Guardada, pero no cuenta para la liga (menos de ${Storage.MIN_FOUNDERS} fundadores)`);
    resetForm();
  }

  // Guarda una partida (también la usa el modo partida) y avisa de los logros nuevos.
  // Logros, clasificación y estadísticas solo usan partidas válidas (mín. 3 fundadores).
  function addGame(game) {
    const s = state();
    const before = Stats.valid(s.games);
    s.games.unshift(game);
    Storage.save();
    const unlocked = Stats.newAchievements(before, Stats.valid(s.games), s.players, mode());
    unlocked.forEach((a, i) => setTimeout(() => App.toast(`${a.icon} Logro para ${a.player}: ${a.name}`), 2400 * (i + 1)));
    Backup.gameAdded(); // copia automática + aviso cada 10 partidas sin copia fuera del móvil
    App.refresh();
    return unlocked;
  }

  // ---------- Clasificación y campeones ----------

  function renderRanking() {
    const { players } = state();
    const games = Stats.valid(state().games);
    const m = mode();
    const keys = Stats.seasons(games, m);
    const select = $('#season-select');
    select.hidden = m === 'none';
    if (!keys.includes(season) && season !== 'all') season = keys[0] || 'all';
    if (m === 'none') season = 'all';
    select.innerHTML = [...keys, 'all'].map((k, i) =>
      `<option value="${k}" ${k === season ? 'selected' : ''}>${Stats.seasonLabel(k)}${i === 0 && k !== 'all' ? ' (actual)' : ''}</option>`).join('');

    const shown = Stats.inSeason(games, season, m);
    const legacy = Stats.legacyTotal(season, m);
    const rows = Stats.seasonRanking(games, players, season, m);
    const any = shown.length > 0 || legacy > 0;
    // Título principal de cada jugador (calculado con todo el histórico).
    const byPlayer = Stats.titles(games, players, m).byPlayer;
    $('#stats-body').innerHTML = rows.map(r => {
      const t = byPlayer[r.name]?.[0];
      return `
      <tr class="rank-${r.rank} ${r.guest ? 'guest' : ''}">
        <td><span class="medal">${any ? Stats.rowMedal(rows, r) : ''}</span>${esc(who(r.name))}${
          r.guest ? '<small class="title-tag">invitado</small>' : t ? `<small class="title-tag">${t.icon} ${esc(t.name)}</small>` : ''}</td>
        <td>${r.played || (legacy ? '—' : 0)}</td>
        <td class="roman">${toRoman(r.wins)}</td>
        <td>${Stats.pctText(r)}</td>
      </tr>`;
    }).join('');
    $('#ranking-empty').hidden = any;
    $('#legacy-note').hidden = !legacy;
    $('#legacy-note').innerHTML = `📜 <b>${legacy + shown.length}</b> partidas: ${legacy} de la liga de WhatsApp${
      shown.length ? ` + ${shown.length} de la app` : ''}. PJ y % solo cuentan las partidas registradas en la app; el histórico completo está en 📊 Stats.`;
    $('#wrapped-open').hidden = !any;
    $('#wrapped-open').textContent = `🎁 Wrapped · ${Stats.seasonLabel(season)}`;
    $('#league-share').hidden = !any;
    $('#league-image').hidden = !any;
    renderPrediction(games, players);

    const champs = Stats.champions(games, players, m);
    $('#champions-card').hidden = !champs.length;
    $('#champions').innerHTML = champs.map(c => `
      <li><span class="season">${esc(c.label)}</span>
        <span class="champ">🏆 ${c.winners.map(n => esc(who(n))).join(' · ')}</span>
        <span class="roman small">${toRoman(c.wins)}</span></li>`).join('');
  }

  // ---------- 🔮 Predicción de campeón del año en curso ----------

  let lastPrediction = { key: null, data: null };

  function renderPrediction(games, players) {
    const year = String(new Date().getFullYear());
    // Solo se recalcula si cambian los datos (la simulación tiene algo de azar: así no «baila»).
    const key = JSON.stringify([games.length, games[0]?.id, Storage.get().legacy?.[year]]);
    if (lastPrediction.key !== key) lastPrediction = { key, data: Stats.predict(games, players, year) };
    const p = lastPrediction.data;
    $('#prediction-card').hidden = !p;
    if (!p) return;
    $('#prediction-meta').textContent = p.remaining
      ? `A este ritmo, el ${p.year} acabará con unas ${p.projected} partidas: quedan ~${p.remaining}.`
      : `El ritmo del ${p.year} no deja partidas pendientes: lo que hay ahora es casi definitivo.`;
    const top = Math.max(...p.rows.map(r => r.prob), 0.01);
    $('#prediction').innerHTML = p.rows.map(r => `
      <li class="${r.guest ? 'guest' : ''}">
        <span class="pr-name">${esc(who(r.name))}</span>
        <span class="pr-bar"><i style="width:${(r.prob / top) * 100}%"></i></span>
        <b class="pr-prob">${r.prob >= 0.995 ? '>99' : r.prob > 0 && r.prob < 0.005 ? '<1' : Math.round(r.prob * 100)}%</b>
        <span class="pr-detail">ahora ${toRoman(r.wins)} · acabaría con ~${toRoman(r.expected)}</span>
      </li>`).join('');
  }

  // ---------- ✏️ Editar partida ----------

  let editing = null; // { id, players: Set, winner }

  function initEdit() {
    const dlg = $('#edit-game');
    dlg.querySelector('[data-act="cancel"]').addEventListener('click', () => dlg.close());
    dlg.querySelector('form').addEventListener('submit', e => { e.preventDefault(); saveEdit(); });
    dlg.querySelector('#edit-players').addEventListener('click', e => {
      const b = e.target.closest('[data-p]');
      if (!b) return;
      const p = b.dataset.p;
      editing.players.has(p) ? editing.players.delete(p) : editing.players.add(p);
      if (!editing.players.has(editing.winner)) editing.winner = null;
      renderEditChips();
    });
    dlg.querySelector('#edit-winner').addEventListener('click', e => {
      const b = e.target.closest('[data-p]');
      if (b && !b.disabled) { editing.winner = b.dataset.p; renderEditChips(); }
    });
  }

  function openEdit(id) {
    const g = state().games.find(x => x.id === id);
    if (!g) return;
    editing = { id, players: new Set(g.players), winner: g.winner };
    const dlg = $('#edit-game');
    dlg.querySelector('#edit-title').textContent = `✏️ Partida ${toRoman(Stats.gameNumber(state().games, g))}`;
    dlg.querySelector('#edit-date').value = g.date || '';
    dlg.querySelector('#edit-note').value = g.note || '';
    dlg.querySelector('#edit-duration').value = g.duration ? Math.round(g.duration / 60) : '';
    renderEditChips();
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }

  function renderEditChips() {
    // Jugadores de la app + los que tuviera la partida (por si alguno ya no está en la lista).
    const all = [...new Set([...Storage.roster(), ...editing.players])];
    $('#edit-players').innerHTML = all.map(p =>
      `<button type="button" class="chip small ${editing.players.has(p) ? 'on' : ''}" data-p="${esc(p)}">${esc(who(p))}</button>`).join('');
    $('#edit-winner').innerHTML = all.map(p =>
      `<button type="button" class="chip small winner ${editing.winner === p ? 'on' : ''}" data-p="${esc(p)}" ${editing.players.has(p) ? '' : 'disabled'}>${esc(who(p))}</button>`).join('');
    const founders = [...editing.players].filter(p => Storage.FOUNDERS.includes(p)).length;
    $('#edit-warning').hidden = founders >= Storage.MIN_FOUNDERS;
  }

  function saveEdit() {
    if (editing.players.size < 2) return App.toast('Selecciona al menos 2 jugadores');
    if (!editing.winner) return App.toast('Elige quién ganó');
    const g = state().games.find(x => x.id === editing.id);
    if (!g) return;
    const dlg = $('#edit-game');
    const mins = parseInt(dlg.querySelector('#edit-duration').value, 10);
    g.date = dlg.querySelector('#edit-date').value || g.date;
    g.players = [...editing.players];
    g.winner = editing.winner;
    g.note = dlg.querySelector('#edit-note').value.trim();
    if (mins > 0) g.duration = mins * 60; else delete g.duration;
    Storage.save();
    dlg.close();
    Backup.snapshot('Partida editada');
    App.refresh();
    App.toast('✏️ Partida actualizada');
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
      const meta = [g.duration && `⏱ ${Stats.fmtDuration(g.duration)}`, g.rounds && `🔁 ${g.rounds} rondas`, g.points && `🏅 ${Stats.pointsLine(g)}`].filter(Boolean);
      return `
      <li class="game ${Stats.isValid(g) ? '' : 'invalid'}">
        <div class="date-badge">
          <span class="day">${d ? d.getDate() : '?'}</span>
          <span class="month">${d ? d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '') : ''}</span>
          <span class="year">${d ? d.getFullYear() : ''}</span>
        </div>
        <div class="info">
          <div class="game-num">Partida ${toRoman(games.length - i)}</div>
          <div class="win">🏆 ${esc(who(g.winner))}</div>
          <div class="players">${others.map(p => `<span class="tag">${esc(who(p))}</span>`).join('')}</div>
          ${Stats.isValid(g) ? '' : `<div class="invalid-tag">⚠️ No cuenta para la liga (menos de ${Storage.MIN_FOUNDERS} fundadores)</div>`}
          ${meta.length ? `<div class="game-meta">${meta.join(' · ')}</div>` : ''}
          ${g.abilities?.length ? `<div class="mini-abilities">${g.abilities.map(a =>
            `<span class="mini" style="--slot:var(--c-${a.color})">${esc(a.name)}</span>`).join('')}</div>` : ''}
          ${g.note ? `<blockquote class="note">${esc(g.note)}</blockquote>` : ''}
          ${g.photo ? `<button class="photo-thumb" data-id="${g.id}" aria-label="Ver foto de la partida"><img alt="" data-photo="${g.id}"></button>` : ''}
        </div>
        <div class="game-actions">
          <button class="icon-btn share" data-id="${g.id}" aria-label="Compartir partida">📤</button>
          <button class="icon-btn edit" data-id="${g.id}" aria-label="Editar partida">✏️</button>
          ${g.photo ? '' : `<button class="icon-btn photo" data-id="${g.id}" aria-label="Añadir foto">📷</button>`}
          <button class="icon-btn del" data-id="${g.id}" aria-label="Borrar partida">🗑️</button>
        </div>
      </li>`;
    }).join('');
    list.querySelectorAll('.del').forEach(b => b.addEventListener('click', () => removeGame(b.dataset.id)));
    list.querySelectorAll('.share').forEach(b => b.addEventListener('click', () => shareGame(b.dataset.id)));
    list.querySelectorAll('.edit').forEach(b => b.addEventListener('click', () => openEdit(b.dataset.id)));
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

  // Se borra al momento con «↩ Deshacer»; la foto solo se borra de verdad si no se deshace.
  function removeGame(id) {
    const s = state();
    const index = s.games.findIndex(g => g.id === id);
    if (index === -1) return;
    const [game] = s.games.splice(index, 1);
    Storage.save();
    Backup.snapshot('Partida borrada');
    App.refresh();
    App.undo(`🗑️ Partida ${toRoman(s.games.length - index + 1)} borrada`, () => {
      state().games.splice(index, 0, game);
      Storage.save();
      App.refresh();
    }, () => { if (game.photo) Photos.remove(id).catch(() => {}); });
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
