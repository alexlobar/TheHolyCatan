// Holy Table: mesa de la partida con las 5 cartas de colores (cada color recibe una habilidad
// al azar sacada de las tablas elegidas) + editor de los mazos y de las tablas propias.
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
  const { esc, rich } = Stats;

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
    $('#table-new').addEventListener('click', () => openEditor(null));
    $('#table-edit').addEventListener('click', () => openEditor(defOf(current)));
    initEditor();
    render();
  }

  // ---------- Tablas propias (crear / editar / borrar) ----------

  let editing = null; // tabla propia que se está editando (null = nueva)

  function initEditor() {
    const dlg = $('#table-editor');
    dlg.querySelector('[data-act="cancel"]').addEventListener('click', () => dlg.close());
    dlg.querySelector('[data-act="delete"]').addEventListener('click', () => { dlg.close(); deleteTable(editing); });
    dlg.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      if (saveTable()) dlg.close();
    });
  }

  function openEditor(def) {
    editing = def && def.custom ? def : null;
    const t = editing || { icon: '🃏', name: '', short: '', subtitle: '', color: '#5b6b7a', extended: false };
    $('#te-title').textContent = editing ? `✏️ Editar ${editing.name}` : '＋ Nueva tabla';
    $('#te-icon').value = t.icon;
    $('#te-name').value = t.name;
    $('#te-short').value = t.short;
    $('#te-subtitle').value = t.subtitle;
    $('#te-color').value = t.color;
    $('#te-extended').checked = !!t.extended;
    $('#table-editor [data-act="delete"]').hidden = !editing;
    $('#table-editor').showModal();
  }

  function saveTable() {
    const name = $('#te-name').value.trim();
    if (!name) { App.toast('Ponle nombre a la tabla'); return false; }
    const data = {
      icon: $('#te-icon').value.trim() || '🃏',
      name,
      short: $('#te-short').value.trim() || name.replace(/^the\s+/i, '').split(/\s+/)[0],
      subtitle: $('#te-subtitle').value.trim(),
      color: $('#te-color').value,
      extended: $('#te-extended').checked,
    };
    const s = state();
    if (editing) {
      Object.assign(s.customTables.find(t => t.id === editing.id), data);
    } else {
      const id = 'c-' + Storage.uid();
      s.customTables.push({ id, ...data });
      s.decks[id] = { cards: [] };
      draw().tables.push(id);
      current = id;
      try { localStorage.setItem(CURRENT_KEY, id); } catch {}
    }
    Storage.syncTables(s.customTables);
    Storage.save();
    App.toast(editing ? '💾 Tabla guardada' : `${data.icon} ${data.name} creada: añade sus cartas`);
    render();
    return true;
  }

  function deleteTable(def) {
    if (!def || !confirm(`¿Borrar la tabla «${def.name}» y sus ${state().decks[def.id]?.cards.length || 0} cartas?`)) return;
    Backup.snapshot('Antes de borrar una tabla');
    const s = state();
    s.customTables = s.customTables.filter(t => t.id !== def.id);
    delete s.decks[def.id];
    s.draw.tables = s.draw.tables.filter(id => id !== def.id);
    if (!s.draw.tables.length) s.draw.tables = Storage.defaultDraw().tables;
    s.draw.slots = s.draw.slots.map(sl => (sl && sl.deck === def.id ? null : sl));
    Storage.syncTables(s.customTables);
    current = TABLES[0].id;
    Storage.save();
    App.toast(`🗑️ Tabla «${def.name}» borrada (hay copia en Ajustes)`);
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

  // Copia de la mesa actual con los datos de cada carta (para el modo partida y el historial).
  function snapshot() {
    return draw().slots.map((slot, i) => {
      const card = cardOf(slot);
      return card && {
        color: COLORS[i].id, deck: slot.deck, card: card.id, name: card.name, desc: card.desc,
        cost: card.cost || '', benefit: card.benefit || '',
      };
    }).filter(Boolean);
  }


  function newGame() {
    const pool = drawPool();
    if (!pool.length) { App.toast('No hay cartas activas en las tablas elegidas'); return false; }
    // Fisher–Yates
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    draw().slots = COLORS.map((_, i) => pool[i] || null);
    Storage.save();
    renderSlots(true);
    if (pool.length < COLORS.length) App.toast(`Solo hay ${pool.length} cartas disponibles; añade más a los mazos`);
    return true;
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
      return `<button type="button" class="chip deck-chip ${on ? 'on' : ''}" style="--accent:${t.color}" data-deck="${t.id}" aria-pressed="${on}">${esc(t.icon)} ${esc(t.short)}</button>`;
    }).join('');
  }

  // Pastillas de coste/beneficio (solo tablas `extended`).
  function extras(def, card) {
    if (!def.extended || !(card.cost || card.benefit)) return '';
    return `<div class="pills">
      ${card.cost ? `<span class="pill cost">Tú: ${esc(card.cost)}</span>` : ''}
      ${card.benefit ? `<span class="pill benefit">Resto: ${esc(card.benefit)}</span>` : ''}
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
        <li data-i="${i}" class="slot ${animate ? 'flip' : ''}" style="--slot:var(--c-${color.id});animation-delay:${animate ? i * 80 : 0}ms">
          <div class="slot-color"><span>${color.name}</span></div>
          <div class="info">
            ${card ? `
              <div class="slot-head">
                <span class="name">${esc(card.name)}</span>
                <span class="origin" style="--accent:${def.color}">${esc(def.icon)} ${esc(def.short)}</span>
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
  const countText = () => {
    const n = deck().cards.length;
    const on = deck().cards.filter(usable).length;
    return `${n} ${n === 1 ? 'carta' : 'cartas'} · ${on} ${on === 1 ? 'activa' : 'activas'}`;
  };

  function selectDeck(id) {
    current = id;
    try { localStorage.setItem(CURRENT_KEY, id); } catch {}
    renderDeck();
  }

  function renderDeck() {
    if (!defOf(current)) current = TABLES[0].id;
    const def = defOf(current);
    $('#deck-card').style.setProperty('--accent', def.color);
    $('#deck-switch').innerHTML = TABLES.map(t =>
      `<button type="button" role="tab" data-deck="${t.id}" style="--accent:${t.color}" class="${t.id === def.id ? 'active' : ''}" aria-selected="${t.id === def.id}">${esc(t.icon)} ${esc(t.short)}</button>`).join('');
    $('#deck-switch .active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    $('#table-edit').hidden = !def.custom;
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
          <input type="text" data-field="name" value="${esc(c.name)}" maxlength="40" placeholder="Nombre de la carta" aria-label="Nombre de la carta">
          <label class="toggle"><input type="checkbox" data-field="enabled" ${c.enabled ? 'checked' : ''}> Activa</label>
          <button class="del" aria-label="Borrar carta">🗑️</button>
        </div>
        ${def.extended ? `
        <div class="extra-fields">
          <input type="text" data-field="cost" value="${esc(c.cost || '')}" maxlength="40" placeholder="Coste para ti" aria-label="Coste para ti">
          <input type="text" data-field="benefit" value="${esc(c.benefit || '')}" maxlength="40" placeholder="Beneficio para el resto" aria-label="Beneficio para el resto">
        </div>` : ''}
        <textarea data-field="desc" maxlength="300" placeholder="¿Qué hace esta carta? (*texto* = cursiva)" aria-label="Efecto de la carta">${esc(c.desc)}</textarea>      </li>`).join('');

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

  // Se borra al momento con «↩ Deshacer» (que también devuelve la mesa como estaba).
  function deleteCard(id) {
    const card = byId(id);
    const deckId = current;
    const index = deck().cards.indexOf(card);
    const slotsBefore = JSON.parse(JSON.stringify(draw().slots));
    App.undo(`🗑️ Carta «${card.name || 'sin nombre'}» borrada`, () => {
      state().decks[deckId].cards.splice(index, 0, card);
      draw().slots = slotsBefore;
      Storage.save();
      render();
    });
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
    // Vuelven las tablas de la casa con sus cartas de ejemplo; las tablas propias se borran.
    state().customTables = [];
    Storage.syncTables([]);
    current = TABLES[0].id;
    state().decks = Storage.defaultDecks();
    state().draw = Storage.defaultDraw();
    Storage.save();
    render();
  }

  return { init, render, reset, newGame, snapshot };
})();
