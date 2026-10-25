// 🎮 Mientras esperas: cosas que hacer en el turno de los demás.
//  · Oráculo del dado: apuesta la próxima suma y apunta las tiradas (histograma de la partida).
//  · Meter prisa: pulla a pantalla completa con cuenta atrás (se cuenta quién la recibe).
//  · Trivial de Catán: preguntas del juego base + generadas con vuestras cartas.
//  · Ruleta de la mesa: elige a alguien al azar.
const Fun = (() => {
  const $ = sel => document.querySelector(sel);
  const { esc, DICE_WAYS } = Stats;
  const KEY = 'catan-app-fun'; // récords de este dispositivo
  const SUMS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const state = () => Storage.get();
  const cur = () => state().current;
  const players = () => cur()?.players || state().players;
  const randomItem = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  let best = { oracle: 0, trivia: 0 };
  function loadBest() { try { best = { ...best, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {} }
  function saveBest() { try { localStorage.setItem(KEY, JSON.stringify(best)); } catch {} }

  function init() {
    loadBest();
    initOracle();
    initRush();
    initTrivia();
    initWheel();
    render();
  }

  function render() {
    renderOracle();
    renderRushTargets();
    renderWheelPlayers();
    $('#fun-context').textContent = cur()
      ? `Partida en curso · ${cur().players.join(', ')}`
      : 'Sin partida en curso: las tiradas del Oráculo solo se guardan mientras tengas la app abierta.';
  }

  // ---------- 🔮 Oráculo del dado ----------

  const points = s => Math.round(36 / DICE_WAYS(s)); // 7 → 6 pts · 2/12 → 36 pts
  let pick = null;
  let score = 0;
  let streak = 0;
  let sessionRolls = []; // tiradas sin partida en curso

  const rolls = () => cur()?.rolls || sessionRolls;

  function initOracle() {
    $('#oracle-pick').innerHTML = SUMS.map(s =>
      `<button type="button" class="num" data-s="${s}"><b>${s}</b><small>${points(s)} pts</small></button>`).join('');
    $('#oracle-roll').innerHTML = SUMS.map(s => `<button type="button" class="num" data-s="${s}"><b>${s}</b></button>`).join('');
    $('#oracle-pick').addEventListener('click', e => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      pick = pick === +b.dataset.s ? null : +b.dataset.s;
      renderOracle();
    });
    $('#oracle-roll').addEventListener('click', e => {
      const b = e.target.closest('[data-s]');
      if (b) roll(+b.dataset.s);
    });
    $('#oracle-undo').addEventListener('click', () => {
      if (!rolls().length) return;
      rolls().pop();
      Storage.save();
      renderOracle();
      App.toast('↩ Última tirada borrada');
    });
  }

  function roll(sum) {
    if (!Game.addRoll(sum)) sessionRolls.push(sum);
    let msg;
    if (pick !== null) {
      if (pick === sum) {
        const p = points(sum);
        score += p;
        streak++;
        if (score > best.oracle) { best.oracle = score; saveBest(); }
        msg = `🔮 ¡Acertaste el ${sum}! +${p} pts${streak > 1 ? ` · racha ${streak}` : ''}`;
        navigator.vibrate?.([40, 60, 40]);
      } else {
        streak = 0;
        msg = `Salió ${sum}, no ${pick}. ${randomItem(['El oráculo necesita gafas.', 'Las ovejas lo sabían.', 'Otra vez será, vidente.', 'Ni el desierto falla tanto.'])}`;
      }
      pick = null;
    } else {
      msg = `🎲 Apuntado: ${sum}`;
    }
    if (sum === 7) msg += ' · 🏴‍☠️ ¡Ladrón! Más de 7 cartas: a descartar la mitad';
    App.toast(msg);
    renderOracle();
    Game.render();
  }

  function renderOracle() {
    document.querySelectorAll('#oracle-pick .num').forEach(b => b.classList.toggle('on', +b.dataset.s === pick));
    $('#oracle-status').innerHTML = pick === null
      ? '1️⃣ Apuesta qué suma saldrá en la próxima tirada <span class="muted">(opcional)</span>'
      : `Apuesta: <b>${pick}</b> · vale ${points(pick)} pts. 2️⃣ Ahora toca lo que salga:`;
    $('#oracle-score').innerHTML = `Puntos <b>${score}</b> · Racha <b>${streak}</b> · Récord <b>${best.oracle}</b>`;

    const r = rolls();
    $('#oracle-undo').hidden = !r.length;
    $('#dice-empty').hidden = r.length > 0;
    $('#dice-chart').hidden = !r.length;
    $('#dice-caption').hidden = !r.length;
    $('#dice-key').hidden = !r.length;
    if (!r.length) return;
    const data = Stats.diceStats(r);
    const top = [...data].sort((a, b) => b.n - a.n)[0];
    const sevens = data.find(d => d.sum === 7);
    $('#dice-caption').innerHTML = `${r.length} tiradas · la que más sale: <b>${top.sum}</b> (${top.n}) · sietes: <b>${sevens.n}</b> de ${sevens.expected.toFixed(1).replace('.', ',')} esperados`;
    if ($('#view-fun').classList.contains('active')) Charts.dice($('#dice-chart'), data, `Histograma de ${r.length} tiradas de dos dados`);
  }

  // ---------- 🗯️ Meter prisa ----------

  const RUSH = [
    '{n}, ese ladrillo no se va a colocar solo.',
    '{n}, ¿estás construyendo una ciudad o una catedral?',
    'Las ovejas de {n} se están haciendo viejas.',
    'Tic, tac… a {n} se le pudre el trigo.',
    'Hasta el ladrón se ha dormido esperando a {n}.',
    'El desierto tiene más movimiento que el turno de {n}.',
    '{n}, el banco cierra a las ocho.',
    '{n}, ¿vas a usar esa carretera o solo la contemplas?',
    'Ese 7 no va a salir por mirarlo, {n}.',
    'Los caballeros de {n} se han jubilado esperando.',
    'Más lento que una partida con La Ruina: {n}.',
    'Hasta El Destierro dura menos que el turno de {n}.',
    '{n}, elige: madera, ladrillo o la jubilación.',
    'El puerto 3:1 ha cambiado de dueño mientras {n} pensaba.',
    'Las ovejas están votando un nuevo jugador. {n}, vas perdiendo.',
    '{n}, Klaus Teuber diseñó el juego entero en menos tiempo.',
    'Robin Hood le ha robado el turno a {n} de puro aburrimiento.',
    '{n}, la Holy Table está rezando por que acabes.',
  ];
  let rushTarget = null;
  let rushTimer = null;

  function initRush() {
    $('#rush-btn').addEventListener('click', rush);
    $('#rush-targets').addEventListener('click', e => {
      const b = e.target.closest('[data-p]');
      if (!b) return;
      rushTarget = rushTarget === b.dataset.p ? null : b.dataset.p;
      renderRushTargets();
    });
    $('#rush-overlay').addEventListener('click', closeRush);
  }

  function renderRushTargets() {
    if (rushTarget && !players().includes(rushTarget)) rushTarget = null;
    $('#rush-targets').innerHTML = players().map(p =>
      `<button type="button" class="chip small ${rushTarget === p ? 'on' : ''}" data-p="${esc(p)}">${esc(p)}</button>`).join('');
  }

  function rush() {
    const name = rushTarget || randomItem(players());
    const c = cur();
    if (c) {
      c.rush ??= {};
      c.rush[name] = (c.rush[name] || 0) + 1;
      Storage.save();
    }
    const ov = $('#rush-overlay');
    ov.querySelector('.rush-text').textContent = randomItem(RUSH).replaceAll('{n}', name);
    ov.hidden = false;
    navigator.vibrate?.(200);
    let left = 30;
    const count = ov.querySelector('.rush-count');
    count.textContent = left;
    count.classList.remove('done');
    clearInterval(rushTimer);
    rushTimer = setInterval(() => {
      left--;
      if (left > 0) { count.textContent = left; return; }
      clearInterval(rushTimer);
      count.textContent = '⏰ ¡Tiempo!';
      count.classList.add('done');
      navigator.vibrate?.([300, 100, 300]);
    }, 1000);
  }

  function closeRush() {
    clearInterval(rushTimer);
    $('#rush-overlay').hidden = true;
  }

  // ---------- 🧠 Trivial de Catán ----------

  // [pregunta, respuesta correcta, ...incorrectas] — reglas del juego base.
  const TRIVIA = [
    ['¿Cuántos puntos de victoria hacen falta para ganar?', '10', '8', '12', '15'],
    ['¿Cuánto cuesta una ciudad?', '2 trigo + 3 mineral', '3 trigo + 2 mineral', '2 ladrillo + 3 mineral', '1 de cada recurso'],
    ['¿Cuánto cuesta un poblado?', 'Ladrillo, madera, lana y trigo', 'Ladrillo, madera y mineral', '2 madera y 2 ladrillo', 'Lana, trigo y mineral'],
    ['¿Cuánto cuesta una carta de desarrollo?', 'Lana, trigo y mineral', 'Madera, ladrillo y lana', '2 trigo y 1 mineral', 'Mineral, madera y lana'],
    ['¿Cuánto cuesta una carretera?', 'Madera y ladrillo', 'Madera y lana', '2 ladrillos', 'Ladrillo y mineral'],
    ['¿Cuántos puntos da la Gran Ruta Comercial (carretera más larga)?', '2', '1', '3', '4'],
    ['¿Cuántos tramos seguidos hacen falta, como mínimo, para la carretera más larga?', '5', '4', '6', '7'],
    ['¿Cuántos caballeros jugados hacen falta, como mínimo, para el Gran Ejército?', '3', '2', '4', '5'],
    ['Cuando sale un 7, ¿quién descarta la mitad de sus cartas?', 'Quien tenga más de 7', 'Quien tenga 7 o más', 'Quien tenga más de 5', 'Todos'],
    ['¿Cuántas cartas de desarrollo hay en el juego base?', '25', '20', '30', '24'],
    ['¿Cuántas cartas de caballero hay en el juego base?', '14', '10', '12', '16'],
    ['¿Cuántas cartas de punto de victoria hay?', '5', '3', '4', '6'],
    ['Sin puerto, ¿a cuánto cambias con la banca?', '4:1', '3:1', '5:1', '2:1'],
    ['¿A cuánto cambia un puerto genérico?', '3:1', '2:1', '4:1', '5:2'],
    ['¿Cuál es la suma más probable con dos dados?', '7', '6', '8', '12'],
    ['¿Qué número no tiene ficha en el tablero?', '7', '2', '12', '6'],
    ['¿Cuántas fichas numéricas hay en el tablero base?', '18', '19', '16', '20'],
    ['¿Cuántos hexágonos de terreno tiene el tablero base?', '19', '18', '20', '24'],
    ['¿Cuántos poblados tiene cada jugador?', '5', '4', '6', '3'],
    ['¿Cuántas ciudades tiene cada jugador?', '4', '3', '5', '6'],
    ['¿Cuántas carreteras tiene cada jugador?', '15', '12', '14', '20'],
    ['¿Qué recurso dan las colinas?', 'Ladrillo', 'Mineral', 'Lana', 'Madera'],
    ['¿Qué recurso dan las montañas?', 'Mineral', 'Ladrillo', 'Trigo', 'Lana'],
    ['¿Qué recurso dan los pastos?', 'Lana', 'Trigo', 'Madera', 'Mineral'],
    ['¿Quién creó Catán?', 'Klaus Teuber', 'Reiner Knizia', 'Uwe Rosenberg', 'Alan R. Moon'],
    ['¿En qué año se publicó Catán?', '1995', '1989', '2001', '1998'],
    ['¿Cuántos puntos da una ciudad?', '2', '1', '3', '4'],
    ['¿Cuántas cartas de cada recurso hay en el juego base?', '19', '20', '18', '15'],
    ['¿Qué hace la carta de Monopolio?', 'Todos te dan todas sus cartas de un recurso', 'Robas 2 cartas a un jugador', 'Coges 2 recursos del banco', 'Construyes 2 carreteras gratis'],
  ];

  // Preguntas generadas con vuestras cartas: «¿Qué carta dice…?»
  function houseQuestions() {
    const cards = Storage.TABLES.flatMap(t => state().decks[t.id].cards
      .filter(c => c.name.trim() && c.desc.trim())
      .map(c => ({ ...c, table: t })));
    if (cards.length < 4) return [];
    return cards.map(c => {
      const wrong = shuffle(cards.filter(x => x.name !== c.name)).slice(0, 3).map(x => x.name);
      const desc = c.desc.replace(/\*+/g, '');
      return [`${c.table.icon} ¿Qué carta de la casa dice: «${desc.length > 110 ? desc.slice(0, 110) + '…' : desc}»?`, c.name, ...wrong];
    });
  }

  let tScore = 0;
  let tQuestion = null;
  let tAnswered = false;

  function initTrivia() {
    $('#trivia-next').addEventListener('click', nextQuestion);
    $('#trivia-options').addEventListener('click', e => {
      const b = e.target.closest('[data-a]');
      if (b) answer(b.dataset.a);
    });
    nextQuestion();
  }

  function nextQuestion() {
    const bank = [...TRIVIA, ...houseQuestions()];
    let q;
    do { q = randomItem(bank); } while (bank.length > 1 && q === tQuestion);
    tQuestion = q;
    tAnswered = false;
    const [text, right, ...wrong] = q;
    $('#trivia-q').textContent = text;
    $('#trivia-options').innerHTML = shuffle([right, ...wrong]).map(a =>
      `<button type="button" class="btn option" data-a="${esc(a)}">${esc(a)}</button>`).join('');
    $('#trivia-feedback').textContent = '';
    $('#trivia-next').hidden = true;
    renderTriviaScore();
  }

  function answer(a) {
    if (tAnswered) return;
    tAnswered = true;
    const right = tQuestion[1];
    document.querySelectorAll('#trivia-options .option').forEach(b => {
      b.disabled = true;
      if (b.dataset.a === right) b.classList.add('right');
      else if (b.dataset.a === a) b.classList.add('wrong');
    });
    if (a === right) {
      tScore++;
      if (tScore > best.trivia) { best.trivia = tScore; saveBest(); }
      $('#trivia-feedback').textContent = randomItem(['✔ ¡Correcto!', '✔ Sabio de Catán.', '✔ Klaus estaría orgulloso.']);
    } else {
      $('#trivia-feedback').textContent = `✘ Era «${right}». La racha vuelve a 0.`;
      tScore = 0;
    }
    $('#trivia-next').hidden = false;
    renderTriviaScore();
  }

  function renderTriviaScore() {
    $('#trivia-score').innerHTML = `Racha <b>${tScore}</b> · Récord <b>${best.trivia}</b>`;
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

  return { init, render };
})();
