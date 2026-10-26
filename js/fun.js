// 🎮 Mientras esperas: cosas que hacer en el turno de los demás.
//  · Atrapa a Loly: reflejos, 30 s.
//  · Parejas de recursos: memory de 12 cartas.
//  · Generador de tableros: tablero aleatorio (6 y 8 nunca juntos) para la próxima partida.
//  · Ruleta de la mesa: elige a alguien al azar.
//  · Mayor o menor: con 2 dados, ¿la próxima tirada será mayor o menor?
//  · Simón de recursos: repite la secuencia, cada vez más larga.
//  · ¿Te llega?: ¿con esa mano puedes construir eso? Sí/No contra el reloj.
//  · Tragaperras del puerto: 3 rodillos de recursos con premios.
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

  // memory: menos movimientos = mejor (0 = sin récord) · coins: récord de monedas en la tragaperras
  let best = { sheep: 0, memory: 0, hilo: 0, simon: 0, build: 0, coins: 0 };
  function loadBest() { try { best = { ...best, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {} }
  function saveBest() { try { localStorage.setItem(KEY, JSON.stringify(best)); } catch {} }

  // Cada juego arranca por separado: si uno falla, los demás siguen.
  function init() {
    loadBest();
    for (const [name, fn] of [['Loly', initSheep], ['parejas', initMemory], ['tableros', initBoard], ['ruleta', initWheel],
      ['mayor o menor', initHilo], ['simón', initSimon], ['¿te llega?', initBuild], ['tragaperras', initSlots]]) {
      try { fn(); } catch (e) { console.error(`Juego ${name}`, e); }
    }
    // Atajos arriba para saltar a cada juego.
    $('#fun-nav').addEventListener('click', e => {
      const b = e.target.closest('[data-go]');
      if (!b) return;
      const card = document.getElementById(b.dataset.go);
      if (card) window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
    });
    render();
  }

  function render() {
    renderWheelPlayers();
    $('#fun-context').textContent = state().current
      ? `Partida en curso · ${state().current.players.join(', ')}`
      : 'Para matar el rato mientras juegan los demás.';
  }

  // Si se sale de la vista a mitad de un juego con reloj, se para.
  function leave() {
    if (sheep.running) endSheep(true);
    if (build.running) endBuild(true);
    if (simon.playing) {
      simon.busy = false;
      simon.playing = false;
      renderSimon('Partida interrumpida. Pulsa empezar para otra.');
    }
  }

  // ---------- Atrapa a Loly ----------

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
      cell.innerHTML = item === 'robber' ? '🏴‍☠️' : Res.icon('loly');
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
      ? `🏆 ¡Nuevo récord: ${sheep.score} Lolys!`
      : `${sheep.score} ${sheep.score === 1 ? 'Loly' : 'Lolys'}. ${randomItem(['El ladrón se ríe de ti.', 'Las Lolys siguen sueltas.', 'Pastor en prácticas.', 'Algo es algo.'])}`;
    renderSheepScore();
  }

  function renderSheepScore() {
    $('#sheep-score').innerHTML = `Lolys <b>${sheep.score}</b> · Récord <b>${best.sheep}</b>`;
  }

  // ---------- 🃏 Parejas de recursos ----------

  // [id, nombre] de los 5 recursos (js/recursos.js) + el ladrón.
  const RESOURCES = [...Res.LIST.map(r => [r.id, r.name]), ['ladron', 'Ladrón']];
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
    $('#memory-grid').innerHTML = mem.deck.map(([id, name], k) => `
      <button type="button" class="mcard" data-k="${k}" aria-label="Carta ${k + 1}">
        <span class="back">⬡</span><span class="front">${id === 'ladron' ? '<span class="emo">🏴‍☠️</span>' : Res.icon(id)}<small>${name}</small></span>
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
    forest: { res: 'madera', name: 'Madera', fill: '#2f6b3a' },
    pasture: { res: 'loly', name: 'Loly', fill: '#8cc56b' },
    field: { res: 'paja', name: 'Paja', fill: '#e3c04a' },
    hill: { res: 'barro', name: 'Barro', fill: '#c0643a' },
    mountain: { res: 'piedra', name: 'Piedra', fill: '#8a8f99' },
    desert: { res: null, name: 'Desierto', fill: '#e6d3a3' },
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
          ${info.res ? Res.use(info.res, cx - 7, cy - 38, 14) : `<text x="${cx}" y="${cy - 17}" text-anchor="middle" class="tile-icon">🏜️</text>`}
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
    $('#board-stats').innerHTML = `Producción: ${list.map(([k, v]) => `${Res.icon(T[k].res)} <b>${v}</b>`).join(' · ')}
      <br><span class="muted">El más abundante: ${T[list[0][0]].name} · el más escaso: ${T[list[list.length - 1][0]].name}</span>`;
  }

  // ---------- 🎲 Mayor o menor ----------

  const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const roll2 = () => [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
  const hilo = { dice: roll2(), streak: 0 };

  function initHilo() {
    $('#hilo-up').addEventListener('click', () => guessHilo(1));
    $('#hilo-down').addEventListener('click', () => guessHilo(-1));
    renderHilo('Adivina: ¿la próxima tirada será mayor o menor?');
  }

  function renderHilo(msg, cls = '') {
    const [a, b] = hilo.dice;
    const sum = a + b;
    $('#hilo-dice').innerHTML = `<span>${FACES[a - 1]}</span><span>${FACES[b - 1]}</span><b>${sum}</b>`;
    // Probabilidad de acertar cada opción (lo que pagaría una apuesta justa).
    let up = 0, down = 0;
    for (let x = 1; x <= 6; x++) for (let y = 1; y <= 6; y++) { if (x + y > sum) up++; if (x + y < sum) down++; }
    $('#hilo-up').querySelector('small').textContent = `${Math.round((up / 36) * 100)}%`;
    $('#hilo-down').querySelector('small').textContent = `${Math.round((down / 36) * 100)}%`;
    $('#hilo-msg').textContent = msg;
    $('#hilo-msg').className = `game-result ${cls}`;
    $('#hilo-score').innerHTML = `Racha <b>${hilo.streak}</b> · Récord <b>${best.hilo}</b>`;
  }

  function guessHilo(dir) {
    const before = hilo.dice[0] + hilo.dice[1];
    hilo.dice = roll2();
    const now = hilo.dice[0] + hilo.dice[1];
    const box = $('#hilo-dice');
    box.classList.remove('rolling'); void box.offsetWidth; box.classList.add('rolling');
    if (now === before) return renderHilo(`Igual (${now}): ni ganas ni pierdes.`);
    if (Math.sign(now - before) === dir) {
      hilo.streak++;
      if (hilo.streak > best.hilo) { best.hilo = hilo.streak; saveBest(); }
      renderHilo(`✔ ${now}. ¡Racha de ${hilo.streak}!`, 'ok');
    } else {
      const lost = hilo.streak;
      hilo.streak = 0;
      renderHilo(`✘ Salió ${now}. ${lost >= 3 ? `Se acabó una racha de ${lost}.` : 'Otra vez.'}`, 'bad');
      navigator.vibrate?.(120);
    }
  }

  // ---------- 🎵 Simón de recursos ----------

  const SIMON = Res.LIST.map(r => [r.id, r.name, r.color]);
  const simon = { seq: [], pos: 0, busy: false, playing: false };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function initSimon() {
    $('#simon-pad').innerHTML = SIMON.map(([id, name, color], i) =>
      `<button type="button" class="simon-btn" data-i="${i}" style="--sc:${color}" aria-label="${name}">${Res.icon(id)}</button>`).join('');
    $('#simon-pad').addEventListener('pointerdown', e => {
      const b = e.target.closest('.simon-btn');
      if (b) pressSimon(+b.dataset.i);
    });
    $('#simon-start').addEventListener('click', () => { simon.seq = []; simon.playing = true; nextSimon(); });
    renderSimon('Pulsa empezar y repite la secuencia.');
  }

  function renderSimon(msg) {
    $('#simon-msg').textContent = msg;
    $('#simon-score').innerHTML = `Nivel <b>${simon.playing ? simon.seq.length : 0}</b> · Récord <b>${best.simon}</b>`;
    $('#simon-start').hidden = simon.playing;
  }

  async function flash(i, ms = 380) {
    const b = $(`#simon-pad [data-i="${i}"]`);
    b.classList.add('lit');
    await sleep(ms);
    b.classList.remove('lit');
  }

  async function nextSimon() {
    simon.seq.push(Math.floor(Math.random() * SIMON.length));
    simon.pos = 0;
    simon.busy = true;
    renderSimon('Mira bien…');
    await sleep(500);
    const speed = Math.max(220, 420 - simon.seq.length * 12);
    for (const i of simon.seq) {
      if (!simon.busy) return; // se salió de la vista
      await flash(i, speed);
      await sleep(140);
    }
    simon.busy = false;
    renderSimon('Tu turno: repítela.');
  }

  function pressSimon(i) {
    if (!simon.playing || simon.busy) return;
    flash(i, 160);
    if (simon.seq[simon.pos] !== i) {
      const level = simon.seq.length - 1;
      simon.playing = false;
      navigator.vibrate?.(150);
      if (level > best.simon) { best.simon = level; saveBest(); }
      return renderSimon(`✘ Era ${SIMON[simon.seq[simon.pos]][1]}. Llegaste al nivel ${level}.${level === best.simon && level ? ' 🏆 ¡Récord!' : ''}`);
    }
    simon.pos++;
    if (simon.pos === simon.seq.length) {
      if (simon.seq.length > best.simon) { best.simon = simon.seq.length; saveBest(); }
      renderSimon('✔ ¡Bien! Siguiente…');
      setTimeout(nextSimon, 600);
    }
  }

  // ---------- ⚡ ¿Te llega? ----------

  // Costes del juego base.
  // Costes del juego base con vuestros nombres: madera, barro (ladrillo), loly (lana),
  // paja (trigo) y piedra (mineral).
  const RES = Res.LIST.map(r => r.id);
  const BUILDS = [
    { name: 'Carretera', icon: '🛣️', cost: { madera: 1, barro: 1 } },
    { name: 'Poblado', icon: '🏠', cost: { madera: 1, barro: 1, loly: 1, paja: 1 } },
    { name: 'Ciudad', icon: '🏰', cost: { paja: 2, piedra: 3 } },
    { name: 'Carta de desarrollo', icon: '🃏', cost: { loly: 1, paja: 1, piedra: 1 } },
  ];
  const BUILD_SECS = 30;
  const build = { running: false, score: 0, end: 0, timer: null, hand: null, target: null };

  function initBuild() {
    $('#build-start').addEventListener('click', startBuild);
    $('#build-yes').addEventListener('click', () => answerBuild(true));
    $('#build-no').addEventListener('click', () => answerBuild(false));
    $('#build-costs').innerHTML = BUILDS.map(b =>
      `<li>${b.icon} ${b.name}: ${Object.entries(b.cost).map(([r, n]) =>
        `<span class="cost">${Res.icon(r)}${n > 1 ? `×${n}` : ''} ${Res.name(r)}</span>`).join(' ')}</li>`).join('');
    renderBuild();
  }

  function newHand() {
    // Mano cerca del coste (para que haya duda): a veces llega justo, a veces falta uno.
    build.target = randomItem(BUILDS);
    const hand = Object.fromEntries(RES.map(r => [r, Math.floor(Math.random() * 2)]));
    for (const [r, n] of Object.entries(build.target.cost)) hand[r] = Math.max(0, n + randomItem([-1, 0, 0, 1]));
    build.hand = hand;
  }

  const fits = () => Object.entries(build.target.cost).every(([r, n]) => build.hand[r] >= n);

  function renderBuild(msg = '') {
    $('#build-play').hidden = !build.running;
    $('#build-start').hidden = build.running;
    $('#build-score').innerHTML = `Aciertos <b>${build.score}</b> · Récord <b>${best.build}</b>`;
    $('#build-msg').textContent = msg;
    if (!build.running || !build.hand) return;
    $('#build-hand').innerHTML = RES.map(r =>
      `<span class="res ${build.hand[r] ? '' : 'zero'}" title="${Res.name(r)}">${Res.icon(r)}<b>${build.hand[r]}</b></span>`).join('');
    $('#build-target').textContent = `¿Te llega para ${build.target.icon} ${build.target.name}?`;
  }

  function startBuild() {
    build.running = true;
    build.score = 0;
    build.end = Date.now() + BUILD_SECS * 1000;
    newHand();
    renderBuild();
    clearInterval(build.timer);
    build.timer = setInterval(() => {
      const left = Math.max(0, build.end - Date.now());
      $('#build-bar').style.width = `${(left / (BUILD_SECS * 1000)) * 100}%`;
      if (!left) endBuild();
    }, 100);
  }

  function answerBuild(yes) {
    if (!build.running) return;
    const ok = yes === fits();
    if (ok) build.score++;
    else { build.end -= 3000; navigator.vibrate?.(100); } // fallar quita 3 segundos
    newHand();
    renderBuild(ok ? '✔' : `✘ (−3 s)`);
  }

  function endBuild(silent = false) {
    build.running = false;
    clearInterval(build.timer);
    $('#build-bar').style.width = '0%';
    const record = !silent && build.score > best.build;
    if (record) { best.build = build.score; saveBest(); }
    $('#build-start').textContent = '↺ Otra vez';
    renderBuild(silent ? '' : record ? `🏆 ¡Récord: ${build.score} aciertos!` : `${build.score} aciertos.`);
  }

  // ---------- 🎰 Tragaperras del puerto ----------

  // 🏴‍☠️ es poco frecuente pero sale; ⭐ es el comodín raro.
  const REEL = ['madera', 'madera', 'barro', 'barro', 'loly', 'loly', 'paja', 'paja', 'piedra', 'piedra', '🏴‍☠️', '⭐'];
  const slots = { coins: 20, spinning: false };
  const reelHtml = x => (Res.byId[x] ? Res.icon(x) : `<span class="emo">${x}</span>`);

  function initSlots() {
    document.querySelectorAll('#slots .reel').forEach((el, i) => { el.innerHTML = reelHtml(['loly', 'paja', 'piedra'][i]); });
    $('#slots-spin').addEventListener('click', spinSlots);
    $('#slots-reset').addEventListener('click', () => { slots.coins = 20; renderSlots('Monedas repuestas. ¡Suerte!'); });
    renderSlots('Cada tirada cuesta 1 moneda.');
  }

  function renderSlots(msg, cls = '') {
    $('#slots-coins').innerHTML = `🪙 <b>${slots.coins}</b> · Récord <b>${best.coins}</b>`;
    $('#slots-msg').textContent = msg;
    $('#slots-msg').className = `game-result ${cls}`;
    $('#slots-spin').disabled = slots.spinning || slots.coins <= 0;
    $('#slots-reset').hidden = slots.coins > 0;
  }

  function prize(r) {
    if (r.every(x => x === '🏴‍☠️')) return { n: -10, txt: '🏴‍☠️ ¡El ladrón te ha desplumado! −10' };
    if (r.every(x => x === '⭐')) return { n: 50, txt: '⭐ ¡JACKPOT! +50' };
    const wild = r.filter(x => x === '⭐').length;
    const counts = {};
    r.filter(x => x !== '⭐' && x !== '🏴‍☠️').forEach(x => { counts[x] = (counts[x] || 0) + 1; });
    const top = Math.max(0, ...Object.values(counts)) + wild;
    if (top >= 3) return { n: 12, txt: '¡Tres iguales! +12' };
    if (new Set(r).size === 3 && !r.includes('🏴‍☠️') && !r.includes('⭐')) return { n: 2, txt: 'Tres distintos: mercado variado +2' };
    if (top === 2) return { n: 3, txt: 'Pareja +3' };
    return { n: 0, txt: 'Nada esta vez.' };
  }

  async function spinSlots() {
    if (slots.spinning || slots.coins <= 0) return;
    slots.spinning = true;
    slots.coins--;
    renderSlots('…');
    const reels = [...document.querySelectorAll('#slots .reel')];
    const result = reels.map(() => randomItem(REEL));
    // Cada rodillo gira un poco más que el anterior.
    await Promise.all(reels.map(async (el, i) => {
      const end = Date.now() + 500 + i * 350;
      el.classList.add('spin');
      while (Date.now() < end) { el.innerHTML = reelHtml(randomItem(REEL)); await sleep(70); }
      el.innerHTML = reelHtml(result[i]);
      el.classList.remove('spin');
    }));
    const p = prize(result);
    slots.coins = Math.max(0, slots.coins + p.n);
    if (slots.coins > best.coins) { best.coins = slots.coins; saveBest(); }
    slots.spinning = false;
    if (p.n > 5) navigator.vibrate?.([60, 40, 60]);
    renderSlots(slots.coins <= 0 ? `${p.txt} · Sin monedas: ¡el banco te rescata!` : p.txt, p.n > 0 ? 'ok' : p.n < 0 ? 'bad' : '');
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
