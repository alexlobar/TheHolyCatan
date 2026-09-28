// Holy Table: mesa de la partida con las 5 cartas de colores (cada color recibe una habilidad
// al azar sacada de las tablas elegidas) + editor de los mazos Holy, Martyr y Shit.
const Tables = (() => {
  const $ = sel => document.querySelector(sel);
  const CURRENT_KEY = 'catan-app-deck';
  const { TABLES, COLORS } = Storage;
  let current = TABLES[0].id; // mazo abierto en el editor
  let saveTimer;

  const state = () => Storage.get();
  const draw = () => state().draw;
  const defOf = id => TABLES.find(t => t.id === id);
  const cardOf = slot => slot && state().decks[slot.deck]?.cards.find(c => c.id === slot.card);
  const usable = c => c.enabled && c.name.trim();
  const randomItem = arr => arr[Math.floor(Math.random() * arr.length)];
  // Texto escapado con *cursivas* estilo Markdown.
  const rich = s => Tracker.esc(s || '').replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Todas las cartas sorteables de las tablas elegidas, como { deck, card }.
  const drawPool = () => draw().tables.flatMap(deck =>
    state().decks[deck].cards.filter(usable).map(c => ({ deck, card: c.id })));
  const onTable = (slot, slots) => slots.some(s => s && s.deck === slot.deck && s.card === slot.card);

  function init() {
    try {
      const saved = localStorage.getItem(CURRENT_KEY);
      if (TABLES.some(t => t.id === saved)) current = saved;
    } catch {}

    $('#draw-tables').addEventListener('click', e => {
      const b = e.target.closest('[data-deck]');
      if (b) toggleDrawTable(b.dataset.deck);
    });
    $('#deck-switch').addEventListener('click', e => {
      const b = e.target.closest('[data-deck]');
      if (b) selectDeck(b.dataset.deck);
    });
    $('#table-shuffle').addEventListener('click', newGame);
    $('#card-add').addEventListener('click', addCard);
    render();
  }

  function render() {
    renderDraw();
    renderDeck();
  }

  // ---------- Mesa de la partida (5 colores) ----------

  function toggleDrawTable(id) {
    const tables = draw().tables;
    if (tables.includes(id)) {
      if (tables.length === 1) return App.toast('Tiene que entrar al menos una tabla');
      draw().tables = tables.filter(t => t !== id);
    } else {
      draw().tables = TABLES.map(t => t.id).filter(t => t === id || tables.includes(t));
    }
    Storage.save();
    renderDrawTables();
  }

  function newGame() {
    const pool = drawPool();
    if (!pool.length) return App.toast('No hay cartas activas en las tablas elegidas');
    // Fisher–Yates
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    draw().slots = COLORS.map((_, i) => pool[i] || null);
    Storage.save();
    renderSlots(true);
    if (pool.length < COLORS.length) App.toast(`Solo hay ${pool.length} cartas disponibles; añade más a los mazos`);
  }

  function rerollSlot(i) {
    const slots = draw().slots;
    const candidates = drawPool().filter(s => !onTable(s, slots));
    if (!candidates.length) return App.toast('No quedan habilidades fuera de la mesa');
    slots[i] = randomItem(candidates);
    Storage.save();
    renderSlots();
    $(`#table-list li[data-i="${i}"]`)?.classList.add('flip');
  }

  function renderDraw() {
    renderDrawTables();
    renderSlots();
  }

  function renderDrawTables() {
    $('#draw-tables').innerHTML = TABLES.map(t => {
      const on = draw().tables.includes(t.id);
      return `<button type="button" class="chip deck-chip ${on ? 'on' : ''}" data-deck="${t.id}" aria-pressed="${on}">${t.icon} ${t.short}</button>`;
    }).join('');
  }

  // Pastillas de coste/beneficio (solo tablas `extended`).
  function extras(def, card) {
    if (!def.extended || !(card.cost || card.benefit)) return '';
    return `<div class="pills">
      ${card.cost ? `<span class="pill cost">Tú: ${Tracker.esc(card.cost)}</span>` : ''}
      ${card.benefit ? `<span class="pill benefit">Resto: ${Tracker.esc(card.benefit)}</span>` : ''}
    </div>`;
  }

  function renderSlots(animate = false) {
    const list = $('#table-list');
    const slots = draw().slots;

    if (!slots.length) {
      list.innerHTML = '<li class="empty">Pulsa «Nueva partida» para repartir habilidades a las 5 cartas de colores.</li>';
      return;
    }
    list.innerHTML = COLORS.map((color, i) => {
      const slot = slots[i];
      const card = cardOf(slot);
      const def = card && defOf(slot.deck);
      return `
        <li data-i="${i}" class="slot ${animate ? 'flip' : ''}" style="--slot:${color.hex};animation-delay:${animate ? i * 80 : 0}ms">
          <div class="slot-color"><span>${color.name}</span></div>
          <div class="info">
            ${card ? `
              <div class="slot-head">
                <span class="name">${Tracker.esc(card.name)}</span>
                <span class="origin origin-${def.id}">${def.icon} ${def.short}</span>
              </div>
              ${extras(def, card)}
              <div class="desc">${rich(card.desc)}</div>`
            : '<div class="desc">Sin habilidad. Pulsa ↻ para asignar una.</div>'}
          </div>
          <button class="reroll" data-i="${i}" aria-label="Cambiar la habilidad de la carta ${color.name.toLowerCase()}">↻</button>
        </li>`;
    }).join('');
    list.querySelectorAll('.reroll').forEach(b => b.addEventListener('click', () => rerollSlot(+b.dataset.i)));
  }

  // ---------- Editor de mazos ----------

  const deck = () => state().decks[current];
  const byId = id => deck().cards.find(c => c.id === id);
  const countText = () => `${deck().cards.length} cartas · ${deck().cards.filter(usable).length} activas`;

  function selectDeck(id) {
    current = id;
    try { localStorage.setItem(CURRENT_KEY, id); } catch {}
    renderDeck();
  }

  function renderDeck() {
    const def = defOf(current);
    $('#deck-card').dataset.deck = def.id;
    $('#deck-switch').innerHTML = TABLES.map(t =>
      `<button type="button" role="tab" data-deck="${t.id}" class="${t.id === def.id ? 'active' : ''}" aria-selected="${t.id === def.id}">${t.icon} ${t.short}</button>`).join('');
    $('#deck-title').textContent = def.name;
    $('#deck-subtitle').textContent = def.subtitle;
    $('#deck-count').textContent = countText();

    const cards = deck().cards;
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
        ${def.extended ? `
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
    if (onTable({ deck: current, card: card.id }, draw().slots)) renderSlots();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(Storage.save, 300);
  }

  function addCard() {
    deck().cards.unshift(Storage.newCard(defOf(current)));
    Storage.save();
    renderDeck();
    $('#deck-list [data-field="name"]').focus();
  }

  function deleteCard(id) {
    const card = byId(id);
    if (!confirm(`¿Borrar la carta «${card.name || 'sin nombre'}»?`)) return;
    deck().cards = deck().cards.filter(c => c.id !== id);
    // Si estaba en la mesa, ese color recibe otra habilidad (o se queda vacío si no quedan).
    const slots = draw().slots;
    const i = slots.findIndex(s => s && s.deck === current && s.card === id);
    if (i !== -1) {
      const candidates = drawPool().filter(s => !onTable(s, slots));
      slots[i] = candidates.length ? randomItem(candidates) : null;
    }
    Storage.save();
    render();
  }

  function reset() {
    state().decks = Storage.defaultDecks();
    state().draw = Storage.defaultDraw();
    Storage.save();
    render();
  }

  return { init, render, reset };
})();
