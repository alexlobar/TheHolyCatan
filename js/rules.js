// 📜 Reglas de la casa: lista editable con buscador, para cortar discusiones en la mesa.
const Rules = (() => {
  const $ = sel => document.querySelector(sel);
  const { esc, rich } = Stats;
  let editing = false;
  let query = '';
  let saveTimer;

  const rules = () => Storage.get().rules;
  // Búsqueda sin tildes ni mayúsculas.
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function init() {
    $('#rules-search').addEventListener('input', e => { query = e.target.value; renderList(); });
    $('#rules-edit').addEventListener('click', () => { editing = !editing; render(); });
    $('#rule-add').addEventListener('click', addRule);
    $('#rules-reset').addEventListener('click', () => {
      if (!confirm('¿Volver a las reglas de ejemplo? Se perderán las vuestras.')) return;
      Storage.get().rules = Storage.defaultRules();
      Storage.save();
      render();
    });
    render();
  }

  function render() {
    $('#rules-edit').textContent = editing ? '✔ Listo' : '✏️ Editar';
    $('#rules-edit').setAttribute('aria-pressed', editing);
    $('#rules-edit-tools').hidden = !editing;
    $('#rules-search-row').hidden = editing;
    renderList();
  }

  function renderList() {
    const list = $('#rules-list');
    if (editing) {
      list.innerHTML = rules().map((r, i) => `
        <li class="rule editing" data-id="${r.id}">
          <div class="rule-edit-head">
            <span class="rule-num">${i + 1}</span>
            <input type="text" data-field="title" value="${esc(r.title)}" maxlength="60" placeholder="Título" aria-label="Título de la regla">
            <button class="icon-btn" data-move="-1" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="icon-btn" data-move="1" aria-label="Bajar" ${i === rules().length - 1 ? 'disabled' : ''}>↓</button>
            <button class="icon-btn" data-del aria-label="Borrar regla">🗑️</button>
          </div>
          <textarea data-field="text" maxlength="600" placeholder="La regla (**negrita**, *cursiva*)" aria-label="Texto de la regla">${esc(r.text)}</textarea>
        </li>`).join('') || '<li class="empty">Sin reglas. Añade la primera.</li>';
      list.querySelectorAll('[data-field]').forEach(el => el.addEventListener('input', onEdit));
      list.querySelectorAll('[data-move]').forEach(b => b.addEventListener('click', () => move(b.closest('li').dataset.id, +b.dataset.move)));
      list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => remove(b.closest('li').dataset.id)));
      return;
    }

    const q = norm(query.trim());
    const shown = rules()
      .map((r, i) => ({ ...r, n: i + 1 }))
      .filter(r => !q || norm(r.title).includes(q) || norm(r.text).includes(q));
    list.innerHTML = shown.length
      ? shown.map(r => `
        <li class="rule">
          <div class="rule-title"><span class="rule-num">${r.n}</span>${esc(r.title)}</div>
          <div class="rule-text">${rich(r.text)}</div>
        </li>`).join('')
      : `<li class="empty">${q ? 'Ninguna regla habla de eso. Toca ✏️ Editar para añadirla.' : 'Sin reglas todavía.'}</li>`;
  }

  function onEdit(e) {
    const r = rules().find(x => x.id === e.target.closest('li').dataset.id);
    r[e.target.dataset.field] = e.target.value;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(Storage.save, 300);
  }

  function addRule() {
    rules().push({ id: Storage.uid(), title: '', text: '' });
    Storage.save();
    renderList();
    const inputs = document.querySelectorAll('#rules-list [data-field="title"]');
    inputs[inputs.length - 1]?.focus();
  }

  function move(id, delta) {
    const list = rules();
    const i = list.findIndex(r => r.id === id);
    const j = i + delta;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    Storage.save();
    renderList();
  }

  function remove(id) {
    const r = rules().find(x => x.id === id);
    if (!confirm(`¿Borrar la regla «${r.title || 'sin título'}»?`)) return;
    Storage.get().rules = rules().filter(x => x.id !== id);
    Storage.save();
    renderList();
  }

  return { init, render };
})();
