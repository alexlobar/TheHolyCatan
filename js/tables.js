// Tablas de cartas (Holy, Martyr, Shit): cada una con su mazo ilimitado y, por partida,
// una "mesa" de 5 cartas distintas sorteadas entre las activas.
const Tables = (() => {
  const $ = sel => document.querySelector(sel);
  const SIZE = 5;
  const CURRENT_KEY = 'catan-app-deck';
  let current = Storage.TABLES[0].id;
  let saveTimer;

  const def = () => Storage.TABLES.find(t => t.id === current);
  const deck = () => Storage.get().decks[current];
  const byId = id => deck().cards.find(c => c.id === id);
  // Cartas que pueden entrar en el sorteo: activas y con nombre.
  const pool = () => deck().cards.filter(c => c.enabled && c.name.trim());
  const randomItem = arr => arr[Math.floor(Math.random() * arr.length)];
  // Texto escapado con *cursivas* estilo Markdown.
  const rich = s => Tracker.esc(s || '').replace(/\*(.+?)\*/g, '<em>$1</em>');

  function init() {
    try {
      const saved = localStorage.getItem(CURRENT_KEY);
      if (Storage.TABLES.some(t => t.id === saved)) current = saved;
    } catch {}

    $('#deck-switch').innerHTML = Storage.TABLES.map(t =>
      `<button type="button" role="tab" data-deck="${t.id}">${t.icon} ${t.short}</button>`).join('');
    $('#deck-switch').addEventListener('click', e => {
      const b = e.target.closest('[data-deck]');
      if (b) select(b.dataset.deck);
    });
    $('#table-shuffle').addEventListener('click', shuffleTable);
    $('#table-pick').addEventListener('click', pickOne);
    $('#card-add').addEventListener('click', addCard);
    render();
  }

  function select(id) {
    current = id;
    try { localStorage.setItem(CURRENT_KEY, id); } catch {}
    render();
  }

  function render() {
    const d = def();
    $('#view-tables').dataset.deck = d.id;
    document.querySelectorAll('#deck-switch button').forEach(b => {
      const on = b.dataset.deck === d.id;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on);
    });
    $('#mesa-title').textContent = d.name;
    $('#mesa-subtitle').textContent = d.subtitle;
    renderTable();
    renderDeck();
  }

  // ---------- Mesa de la partida ----------

  function shuffleTable() {
    const cards = [...pool()];
    if (!cards.length) return App.toast('No hay cartas activas en este mazo');
    // Fisher–Yates
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    deck().table = cards.slice(0, SIZE).map(c => c.id);
    Storage.save();
    renderTable(true);
    if (cards.length < SIZE) App.toast(`Solo hay ${cards.length} cartas activas; añade más al mazo`);
  }

  function rerollSlot(i) {
    const table = deck().table;
    const candidates = pool().filter(c => !table.includes(c.id));
    if (!candidates.length) return App.toast('No quedan cartas fuera de la mesa; añade más al mazo');
    table[i] = randomItem(candidates).id;
    Storage.save();
    renderTable();
    $(`#table-list li[data-i="${i}"]`)?.classList.add('flip');
  }

  function pickOne() {
    const table = deck().table;
    if (!table.length) return App.toast('Primero sortea la mesa');
    const i = Math.floor(Math.random() * table.length);
    const card = byId(table[i]);
    document.querySelectorAll('#table-list li').forEach(li => li.classList.toggle('picked', +li.dataset.i === i));

    const out = $('#holy-result');
    out.classList.remove('spin');
    void out.offsetWidth; // reinicia la animación
    out.classList.add('spin');
    out.innerHTML = `<div class="name">${Tracker.esc(card.name)}</div>${extras(card)}<div class="desc">${rich(card.desc)}</div>`;
    navigator.vibrate?.(40);
  }

  // Pastillas de coste/beneficio (solo tablas `extended`).
  function extras(card) {
    if (!def().extended || !(card.cost || card.benefit)) return '';
    return `<div class="pills">
      ${card.cost ? `<span class="pill cost">Tú: ${Tracker.esc(card.cost)}</span>` : ''}
      ${card.benefit ? `<span class="pill benefit">Resto: ${Tracker.esc(card.benefit)}</span>` : ''}
    </div>`;
  }

  function renderTable(animate = false) {
    const list = $('#table-list');
    const table = deck().table;
    $('#holy-result').innerHTML = '';

    if (!table.length) {
      list.innerHTML = '<li class="empty">Pulsa «Nueva mesa» para sortear las cartas de esta partida.</li>';
      return;
    }
    list.innerHTML = table.map((id, i) => {
      const c = byId(id);
      return `
        <li data-i="${i}" class="${animate ? 'flip' : ''}" style="animation-delay:${animate ? i * 80 : 0}ms">
          <div class="info">
            <div class="name">${Tracker.esc(c.name)}</div>
            ${extras(c)}
            <div class="desc">${rich(c.desc)}</div>
          </div>
          <button class="reroll" data-i="${i}" aria-label="Cambiar esta carta">↻</button>
        </li>`;
    }).join('');
    list.querySelectorAll('.reroll').forEach(b => b.addEventListener('click', () => rerollSlot(+b.dataset.i)));
  }

  // ---------- Mazo ----------

  const countText = () => `${deck().cards.length} cartas · ${pool().length} activas`;

  function renderDeck() {
    const cards = deck().cards;
    const extended = def().extended;
    $('#deck-count').textContent = countText();
    const list = $('#deck-list');

    if (!cards.length) {
      list.innerHTML = '<li class="empty">El mazo está vacío. Añade vuestra primera carta.</li>';
      return;
    }
    list.innerHTML = cards.map(c => `
      <li class="${c.enabled ? '' : 'off'}" data-id="${c.id}">
        <div class="holy-head">
          <input type="text" data-field="name" value="${Tracker.esc(c.name)}" maxlength="40" placeholder="Nombre de la carta" aria-label="Nombre de la carta">
          <label class="toggle"><input type="checkbox" data-field="enabled" ${c.enabled ? 'checked' : ''}> Activa</label>
          <button class="del" aria-label="Borrar carta">🗑️</button>
        </div>
        ${extended ? `
        <div class="extra-fields">
          <input type="text" data-field="cost" value="${Tracker.esc(c.cost || '')}" maxlength="40" placeholder="Coste para ti" aria-label="Coste para ti">
          <input type="text" data-field="benefit" value="${Tracker.esc(c.benefit || '')}" maxlength="40" placeholder="Beneficio para el resto" aria-label="Beneficio para el resto">
        </div>` : ''}
        <textarea data-field="desc" maxlength="300" placeholder="¿Qué hace esta carta? (*texto* = cursiva)" aria-label="Efecto de la carta">${Tracker.esc(c.desc)}</textarea>
      </li>`).join('');

    list.querySelectorAll('[data-field]').forEach(el => {
      el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', onEdit);
    });
    list.querySelectorAll('.del').forEach(b => b.addEventListener('click', () => deleteCard(b.closest('li').dataset.id)));
  }

  function onEdit(e) {
    const li = e.target.closest('li');
    const card = byId(li.dataset.id);
    const field = e.target.dataset.field;
    card[field] = field === 'enabled' ? e.target.checked : e.target.value;
    if (field === 'enabled') li.classList.toggle('off', !card.enabled);
    $('#deck-count').textContent = countText();
    if (deck().table.includes(card.id)) renderTable();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(Storage.save, 300);
  }

  function addCard() {
    deck().cards.unshift(Storage.newCard(def()));
    Storage.save();
    renderDeck();
    $('#deck-list [data-field="name"]').focus();
  }

  function deleteCard(id) {
    const card = byId(id);
    if (!confirm(`¿Borrar la carta «${card.name || 'sin nombre'}»?`)) return;
    const d = deck();
    d.cards = d.cards.filter(c => c.id !== id);
    // Si estaba en la mesa, se sustituye por otra carta del mazo para seguir teniendo 5.
    const slot = d.table.indexOf(id);
    if (slot !== -1) {
      const candidates = pool().filter(c => !d.table.includes(c.id));
      if (candidates.length) d.table[slot] = randomItem(candidates).id;
      else d.table.splice(slot, 1);
    }
    Storage.save();
    render();
  }

  function reset() {
    Storage.get().decks = Storage.defaultDecks();
    Storage.save();
    render();
  }

  return { init, render, reset };
})();
