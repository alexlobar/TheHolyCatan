// 🎮 Mientras esperas: cosas que hacer en el turno de los demás.
//  · Atrapa la oveja: reflejos, 30 s.
//  · Parejas de recursos: memory de 12 cartas.
//  · Generador de tableros: tablero aleatorio (6 y 8 nunca juntos) para la próxima partida.
//  · Ruleta de la mesa: elige a alguien al azar.
const Fun = (() => {
  const $ = sel => document.querySelector(sel);
  const { esc } = Stats;
  const KEY = 'catan-app-fun'; // récords de este dispositivo

  const state = () => Storage.get();
  const players = () => state().current?.players || state().players;
  const randomItem = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  let best = { sheep: 0, memory: 0 }; // memory: menos movimientos = mejor (0 = sin récord)
  function loadBest() { try { best = { ...best, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {} }
  function saveBest() { try { localStorage.setItem(KEY, JSON.stringify(best)); } catch {} }

  function init() {
    loadBest();
    initSheep();
    initMemory();
    initBoard();
    initWheel();
    render();
  }

  function render() {
    renderWheelPlayers();
    $('#fun-context').textContent = state().current
      ? `Partida en curso · ${state().current.players.join(', ')}`
      : 'Para matar el rato mientras juegan los demás.';
  }

  // Si se sale de la vista en mitad del juego de las ovejas, se para.
  function leave() { if (sheep.running) endSheep(true); }

  // ---------- 🐑 Atrapa la oveja ----------

  const SHEEP_SECS = 30;
  const sheep = { running: false, score: 0, end: 0, timers: [], cells: [] };

  function initSheep() {
    $('#sheep-field').innerHTML = Array.from({ length: 9 }, (_, k) =>
      `<button type="button" class="hole" data-k="${k}" aria-label="Casilla ${k + 1}"></button>`).join('');
    sheep.cells = [...document.querySelectorAll('#sheep-field .hole')];
    $('#sheep-field').addEventListener('pointerdown', e => {
      const b = e.target.closest('.hole');
      if (b && sheep.running) hit(b);
    });
    $('#sheep-start').addEventListener('click', startSheep);
    renderSheepScore();
  }

  function startSheep() {
    sheep.running = true;
    sheep.score = 0;
    sheep.end = Date.now() + SHEEP_SECS * 1000;
    sheep.cells.forEach(c => { c.className = 'hole'; c.textContent = ''; });
    $('#sheep-start').hidden = true;
    $('#sheep-result').textContent = '';
    renderSheepScore();
    spawn();
    sheep.timers.push(setInterval(() => {
      const left = Math.max(0, sheep.end - Date.now());
      $('#sheep-bar').style.width = `${(left / (SHEEP_SECS * 1000)) * 100}%`;
      $('#sheep-time').textContent = `${Math.ceil(left / 1000)} s`;
      if (!left) endSheep();
    }, 100));
  }

  function spawn() {
    if (!sheep.running) return;
    const progress = 1 - (sheep.end - Date.now()) / (SHEEP_SECS * 1000); // 0 → 1
    const free = sheep.cells.filter(c => !c.dataset.item);
    if (free.length) {
      const cell = randomItem(free);
      const roll = Math.random();
      const item = roll < 0.12 ? 'gold' : roll < 0.37 ? 'robber' : 'sheep';
      cell.dataset.item = item;
      cell.className = `hole up ${item}`;
      cell.textContent = item === 'robber' ? '🏴‍☠️' : '🐑';
      const life = 1150 - progress * 500;
      setTimeout(() => { if (cell.dataset.item === item) clear(cell); }, life);
    }
    sheep.timers.push(setTimeout(spawn, 750 - progress * 330));
  }

  function clear(cell) {
    delete cell.dataset.item;
    cell.className = 'hole';
    cell.textContent = '';
  }

  function hit(cell) {
    const item = cell.dataset.item;
    if (!item) return;
    const pts = item === 'gold' ? 3 : item === 'robber' ? -2 : 1;
    sheep.score = Math.max(0, sheep.score + pts);
    cell.className = `hole hit ${pts > 0 ? 'good' : 'bad'}`;
    cell.textContent = pts > 0 ? `+${pts}` : `${pts}`;
    delete cell.dataset.item;
    if (pts < 0) navigator.vibrate?.(120);
    setTimeout(() => { if (!cell.dataset.item) clear(cell); }, 300);
    renderSheepScore();
  }

  function endSheep(silent = false) {
    sheep.running = false;
    sheep.timers.forEach(t => { clearInterval(t); clearTimeout(t); });
    sheep.timers = [];
    sheep.cells.forEach(clear);
    $('#sheep-start').hidden = false;
    $('#sheep-start').textContent = '↺ Otra vez';
    $('#sheep-bar').style.width = '0%';
    $('#sheep-time').textContent = '';
    if (silent) return;
    const record = sheep.score > best.sheep;
    if (record) { best.sheep = sheep.score; saveBest(); }
    $('#sheep-result').textContent = record
      ? `🏆 ¡Nuevo récord: ${sheep.score} ovejas!`
      : `${sheep.score} ${sheep.score === 1 ? 'oveja' : 'ovejas'}. ${randomItem(['El ladrón se ríe de ti.', 'Las ovejas siguen sueltas.', 'Pastor en prácticas.', 'Algo es algo.'])}`;
    renderSheepScore();
  }

  function renderSheepScore() {
    $('#sheep-score').innerHTML = `Ovejas <b>${sheep.score}</b> · Récord <b>${best.sheep}</b>`;
  }

  // ---------- 🃏 Parejas de recursos ----------

  const RESOURCES = [['🌲', 'Madera'], ['🧱', 'Ladrillo'], ['🐑', 'Lana'], ['🌾', 'Trigo'], ['⛰️', 'Mineral'], ['🏴‍☠️', 'Ladrón']];
  const mem = { deck: [], open: [], done: new Set(), moves: 0, start: 0, lock: false };

  function initMemory() {
    $('#memory-grid').addEventListener('click', e => {
      const b = e.target.closest('.mcard');
      if (b) flip(+b.dataset.k);
    });
    $('#memory-new').addEventListener('click', newMemory);
    newMemory();
  }

  function newMemory() {
    mem.deck = shuffle([...RESOURCES, ...RESOURCES]);
    mem.open = [];
    mem.done = new Set();
    mem.moves = 0;
    mem.start = 0;
    mem.lock = false;
    $('#memory-grid').innerHTML = mem.deck.map(([icon, name], k) => `
      <button type="button" class="mcard" data-k="${k}" aria-label="Carta ${k + 1}">
        <span class="back">⬡</span><span class="front">${icon}<small>${name}</small></span>
      </button>`).join('');
    $('#memory-result').textContent = '';
    renderMemoryScore();
  }

  function flip(k) {
    if (mem.lock || mem.done.has(k) || mem.open.includes(k)) return;
    if (!mem.start) mem.start = Date.now();
    const cards = document.querySelectorAll('#memory-grid .mcard');
    cards[k].classList.add('open');
    mem.open.push(k);
    if (mem.open.length < 2) return;

    mem.moves++;
    const [a, b] = mem.open;
    if (mem.deck[a][0] === mem.deck[b][0]) {
      mem.done.add(a); mem.done.add(b);
      cards[a].classList.add('matched'); cards[b].classList.add('matched');
      mem.open = [];
      if (mem.done.size === mem.deck.length) finishMemory();
    } else {
      mem.lock = true;
      setTimeout(() => {
        cards[a].classList.remove('open'); cards[b].classList.remove('open');
        mem.open = [];
        mem.lock = false;
      }, 750);
    }
    renderMemoryScore();
  }

  function finishMemory() {
    const secs = Math.round((Date.now() - mem.start) / 1000);
    const record = !best.memory || mem.moves < best.memory;
    if (record) { best.memory = mem.moves; saveBest(); }
    $('#memory-result').textContent = `${record ? '🏆 ¡Récord! ' : '✔ '}${mem.moves} movimientos en ${secs} s`;
    renderMemoryScore();
  }

  function renderMemoryScore() {
    $('#memory-score').innerHTML = `Movimientos <b>${mem.moves}</b> · Récord <b>${best.memory || '—'}</b>`;
  }

  // ---------- 🗺️ Generador de tableros ----------

  // Tablero base: 19 hexágonos (radio 2 en coordenadas axiales).
  const TERRAINS = [
    ...Array(4).fill('forest'), ...Array(4).fill('pasture'), ...Array(4).fill('field'),
    ...Array(3).fill('hill'), ...Array(3).fill('mountain'), 'desert',
  ];
  const T = {
    forest: { icon: '🌲', name: 'Madera', fill: '#2f6b3a' },
    pasture: { icon: '🐑', name: 'Lana', fill: '#8cc56b' },
    field: { icon: '🌾', name: 'Trigo', fill: '#e3c04a' },
    hill: { icon: '🧱', name: 'Ladrillo', fill: '#c0643a' },
    mountain: { icon: '⛰️', name: 'Mineral', fill: '#8a8f99' },
    desert: { icon: '🏜️', name: 'Desierto', fill: '#e6d3a3' },
  };
  const NUMBERS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];
  const PIPS = n => 6 - Math.abs(7 - n);
  const CELLS = [];
  for (let q = -2; q <= 2; q++) {
    for (let r = Math.max(-2, -q - 2); r <= Math.min(2, -q + 2); r++) CELLS.push({ q, r });
  }
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  const adjacent = (a, b) => DIRS.some(([dq, dr]) => a.q + dq === b.q && a.r + dr === b.r);

  function generateBoard() {
    for (let attempt = 0; attempt < 2000; attempt++) {
      const terr = shuffle(TERRAINS);
      const nums = shuffle(NUMBERS);
      let k = 0;
      const tiles = CELLS.map((c, i) => ({ ...c, terrain: terr[i], number: terr[i] === 'desert' ? null : nums[k++] }));
      const hot = tiles.filter(t => t.number === 6 || t.number === 8);
      // Regla clásica: 6 y 8 nunca juntos (ni dos números iguales pegados).
      const bad = hot.some((a, i) => hot.slice(i + 1).some(b => adjacent(a, b)))
        || tiles.some((a, i) => a.number && tiles.slice(i + 1).some(b => b.number === a.number && adjacent(a, b)));
      if (!bad) return tiles;
    }
    return null;
  }

  function initBoard() {
    $('#board-new').addEventListener('click', drawBoard);
    drawBoard();
  }

  function drawBoard() {
    const tiles = generateBoard();
    if (!tiles) return;
    const size = 40;
    const hx = (q, r) => size * Math.sqrt(3) * (q + r / 2);
    const hy = r => size * 1.5 * r;
    const corners = (cx, cy) => Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 180) * (60 * k - 30);
      return `${(cx + (size - 1.5) * Math.cos(a)).toFixed(1)},${(cy + (size - 1.5) * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
    const w = size * Math.sqrt(3) * 5 + 8;
    const h = size * 8 + 8;

    const hexes = tiles.map(t => {
      const cx = hx(t.q, t.r), cy = hy(t.r);
      const info = T[t.terrain];
      const hot = t.number === 6 || t.number === 8;
      const pips = t.number ? Array.from({ length: PIPS(t.number) }, (_, k) =>
        `<circle cx="${cx + (k - (PIPS(t.number) - 1) / 2) * 4.5}" cy="${cy + 21}" r="1.6" class="pip ${hot ? 'hot' : ''}"/>`).join('') : '';
      return `
        <g>
          <polygon points="${corners(cx, cy)}" fill="${info.fill}" class="tile"/>
          <text x="${cx}" y="${cy - 17}" text-anchor="middle" class="tile-icon">${info.icon}</text>
          ${t.number ? `
            <circle cx="${cx}" cy="${cy + 6}" r="14" class="token"/>
            <text x="${cx}" y="${cy + 11}" text-anchor="middle" class="token-n ${hot ? 'hot' : ''}">${t.number}</text>
            ${pips}` : `<text x="${cx}" y="${cy + 12}" text-anchor="middle" class="robber">🏴‍☠️</text>`}
        </g>`;
    }).join('');
    $('#board').innerHTML = `
      <svg viewBox="${-w / 2} ${-h / 2} ${w} ${h}" role="img" aria-label="Tablero de Catán generado al azar" class="board-svg">
        ${hexes}
      </svg>`;

    // Producción esperada por recurso (suma de puntitos de probabilidad).
    const prod = {};
    for (const t of tiles) if (t.number) prod[t.terrain] = (prod[t.terrain] || 0) + PIPS(t.number);
    const list = Object.entries(prod).sort((a, b) => b[1] - a[1]);
    $('#board-stats').innerHTML = `Producción: ${list.map(([k, v]) => `${T[k].icon} <b>${v}</b>`).join(' · ')}
      <br><span class="muted">El más abundante: ${T[list[0][0]].name} · el más escaso: ${T[list[list.length - 1][0]].name}</span>`;
  }

  // ---------- 🎯 Ruleta de la mesa ----------

  const QUESTIONS = ['¿Quién empieza?', '¿Quién baraja y reparte?', '¿Quién paga las pizzas?', '¿Quién recoge el tablero?', '¿Quién elige la música?'];
  let spinning = false;

  function initWheel() {
    $('#wheel-questions').innerHTML = QUESTIONS.map(q => `<option>${esc(q)}</option>`).join('');
    $('#wheel-spin').addEventListener('click', spin);
  }

  function renderWheelPlayers() {
    if (spinning) return;
    $('#wheel-players').innerHTML = players().map(p => `<span class="wheel-name" data-p="${esc(p)}">${esc(p)}</span>`).join('');
  }

  function spin() {
    if (spinning) return;
    const names = [...document.querySelectorAll('#wheel-players .wheel-name')];
    if (names.length < 2) return App.toast('Hacen falta al menos 2 jugadores');
    spinning = true;
    $('#wheel-result').textContent = '';
    const winner = Math.floor(Math.random() * names.length);
    const steps = names.length * 3 + winner; // 3 vueltas y cae en el elegido
    let i = 0;
    const tickFn = () => {
      names.forEach((n, k) => n.classList.toggle('on', k === i % names.length));
      if (i >= steps) {
        spinning = false;
        names[winner].classList.add('chosen');
        $('#wheel-result').innerHTML = `${esc($('#wheel-questions').value)} → <b>${esc(names[winner].dataset.p)}</b>`;
        navigator.vibrate?.(80);
        setTimeout(() => names[winner].classList.remove('chosen'), 2500);
        return;
      }
      i++;
      setTimeout(tickFn, 60 + (i / steps) ** 3 * 380); // cada vez más lento
    };
    tickFn();
  }

  return { init, render, leave };
})();
