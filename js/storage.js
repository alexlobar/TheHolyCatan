// Capa de persistencia: todo pasa por aquí para poder cambiar a otro backend en el futuro.
const Storage = (() => {
  const KEY = 'catan-app-v1';

  const PLAYERS = ['Kristy', 'Emi', 'Serbest', 'Bylexx'];

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // Definición de las tablas de cartas de la casa. `extended` añade los campos coste/beneficio.
  // En los textos, *así* se muestra en cursiva.
  const TABLES = [
    {
      id: 'holy',
      icon: '😇',
      short: 'Holy',
      name: 'The Holy Table',
      subtitle: 'Codex Catanensis · Regulæ Speciales',
      cards: [
        ['Robin Hood', 'Coge todas las cartas de un jugador, o elige 2 materiales a modo de monopolio.'],
        ['El Adosado', 'Permite romper un hexágono para colocar una casa. *(Los caminos no afectan.)*'],
        ['Abastecimiento', 'Elige libremente 4 materiales del banco.'],
        ['Desahucio', 'Elimina una casa simple o un camino de cualquier jugador.'],
        ['El Destierro', 'No juegas 2 rondas: sin cobrar, te afectan los 7, no puedes cambiar. *Líbrate tirando doble 1 o doble 6.*'],
      ],
    },
    {
      id: 'martyr',
      icon: '🕯️',
      short: 'Martyr',
      name: 'The Martyr Table',
      subtitle: 'Codex Immolationis · Dona Ceteris',
      extended: true,
      cards: [
        ['El Mártir', 'Cada jugador (excepto tú) elige 2 materiales del banco. Tú no recibes nada.', 'Nada', '+2 mat. cada uno'],
        ['La Ofrenda', 'Reparte todas tus cartas entre los demás. Ellos eligen cuáles toman.', 'Pierdes todo', 'Roban'],
        ['El Salvador', 'Un jugador (tú decides quién) construye cualquier cosa gratis ahora mismo.', 'Nada', '1 elegido: gratis'],
        ['La Absolución', 'Todos (excepto tú) quedan libres de penalizaciones activas. Tú recibes al ladrón.', 'Penalizado', 'Todos libres'],
        ['El Cordero', 'En las próximas 2 rondas, todos los demás cobran doble; tú solo cobras la mitad. *El sacrificio voluntario no da puntos, pero sí honor.*', 'Cobras la mitad', 'Todos cobran doble'],
      ],
    },
    {
      id: 'shit',
      icon: '💩',
      short: 'Shit',
      name: 'The Shit Table',
      subtitle: 'Codex Maledicentis · Pœnæ Speciales',
      cards: [
        ['La Plaga', 'Pierdes la mitad de tus cartas de recurso (el jugador a tu derecha elige cuáles).'],
        ['El Bloqueo', 'No puedes comerciar ni usar puertos durante 2 rondas completas.'],
        ['El Saqueo', 'Cada uno de los demás jugadores te roba 1 carta de recurso a su elección.'],
        ['La Maldición', 'El ladrón se queda fijo en tu territorio durante 2 rondas — no puede moverse aunque salga 7.'],
        ['La Ruina', 'No puedes construir nada durante 3 rondas. *Sí cobras y cambias, pero tus manos están encadenadas.*'],
      ],
    },
  ];

  // Duración en rondas de las cartas con efecto prolongado (para el contador de penalizaciones).
  const DEFAULT_ROUNDS = { 'El Destierro': 2, 'El Cordero': 2, 'El Bloqueo': 2, 'La Maldición': 2, 'La Ruina': 3 };

  const newCard = (def, name = '', desc = '', cost = '', benefit = '') => ({
    id: uid(), name, desc, enabled: true, rounds: DEFAULT_ROUNDS[name] || 0,
    ...(def.extended ? { cost, benefit } : {}),
  });

  // Las 5 cartas físicas de colores: en cada partida cada color recibe una habilidad al azar.
  // El color en pantalla sale de las variables CSS --c-<id> (cambian con el modo oscuro).
  const COLORS = [
    { id: 'black', name: 'Negra', emoji: '⬛' },
    { id: 'green', name: 'Verde', emoji: '🟩' },
    { id: 'orange', name: 'Naranja', emoji: '🟧' },
    { id: 'purple', name: 'Morada', emoji: '🟪' },
    { id: 'blue', name: 'Azul', emoji: '🟦' },
  ];

  const defaultDeck = def => ({ cards: def.cards.map(c => newCard(def, ...c)) });
  const defaultDecks = () => Object.fromEntries(TABLES.map(t => [t.id, defaultDeck(t)]));
  const defaultDraw = () => ({ tables: TABLES.map(t => t.id), slots: [] });
  const defaultSettings = () => ({ seasonMode: 'quarter' }); // quarter | year | none

  // Reglas de la casa de ejemplo (editables en 📜 Reglas). En los textos: *cursiva* y **negrita**.
  const defaultRules = () => [
    ['Las 5 cartas de colores', 'En cada partida, la app sortea una habilidad para cada carta: **negra, verde, naranja, morada y azul** (🎴 Holy Table). Quien juega una carta de color aplica la habilidad que le ha tocado en esa partida.'],
    ['¿Qué es una ronda?', 'Una ronda termina cuando el turno vuelve a quien empezó la partida. Las penalizaciones con duración se descuentan con **⏭ Siguiente ronda** en 🎲 Partida.'],
    ['El Destierro', 'No juegas 2 rondas: sin cobrar, te afectan los 7 y no puedes cambiar. *Te libras antes si sacas doble 1 o doble 6.*'],
    ['La Absolución', 'Todos (excepto quien la juega) quedan libres de las penalizaciones activas; quien la juega recibe al ladrón.'],
    ['Discusiones', 'Si no hay acuerdo, decide el dado: **par** gana quien reclama, **impar** el otro. Sin recurso.'],
    ['Turnos eternos', 'Si alguien tarda demasiado, cualquiera puede pulsar **🗯️ Meter prisa** en 🎮 Mientras esperas.'],
  ].map(([title, text]) => ({ id: uid(), title, text }));

  const defaults = () => ({
    version: 6,
    players: [...PLAYERS],
    // { id, date, players, winner, note, abilities?: [{ color, deck, name }], duration?: segundos,
    //   rounds?, rolls?: [sumas de dados], photo?: true (la foto vive en IndexedDB, ver photos.js) }
    games: [],
    rules: defaultRules(), // [{ id, title, text }]
    decks: {},   // { [tablaId]: { cards: [{ id, name, desc, enabled, rounds, cost?, benefit? }] } }
    draw: defaultDraw(), // mesa de la partida: tablas que entran + slots[i] = { deck, card } para COLORS[i] (o null)
    settings: defaultSettings(),
    current: null, // partida en curso (ver game.js) o null
  });

  // Cartas de relleno de versiones anteriores: si solo hay estas, se sustituyen por las reales.
  const isPlaceholder = c => /^(Carta|Uso) de desarrollo \d$/.test(c.name);

  // Rellena lo que falte y migra datos antiguos:
  //  v1: `holy` = 5 usos fijos · v2: `cards` + `table` = un único mazo
  //  v3: `decks` por tabla, cada uno con su mesa · v4: una sola mesa de 5 colores (`draw`)
  //  v5: `rounds` en las cartas, `settings` (temporadas) y `current` (partida en curso).
  function normalize(data) {
    const s = { ...defaults(), ...data };
    if (!Array.isArray(s.games)) s.games = [];
    s.settings = { ...defaultSettings(), ...(data.settings || {}) };
    if (s.current && (!Array.isArray(s.current.players) || !s.current.timer)) s.current = null;
    if (s.current && !Array.isArray(s.current.rolls)) s.current.rolls = [];
    if (!Array.isArray(s.rules)) s.rules = defaultRules();
    const decks = data.decks && typeof data.decks === 'object' ? { ...data.decks } : {};

    const old = Array.isArray(data.cards) ? data.cards : Array.isArray(data.holy) ? data.holy : null;
    if (!decks.holy && old && old.some(c => !isPlaceholder(c))) {
      decks.holy = { cards: old.map(c => ({ id: c.id || uid(), name: c.name, desc: c.desc, enabled: c.enabled !== false })) };
    }

    for (const t of TABLES) {
      const d = decks[t.id];
      if (!d || !Array.isArray(d.cards)) decks[t.id] = defaultDeck(t);
      else delete d.table;
      for (const c of decks[t.id].cards) {
        if (typeof c.rounds !== 'number') c.rounds = DEFAULT_ROUNDS[c.name] || 0;
      }
    }

    const draw = data.draw && typeof data.draw === 'object' ? data.draw : defaultDraw();
    const tables = (Array.isArray(draw.tables) ? draw.tables : []).filter(id => decks[id]);
    const exists = slot => slot && decks[slot.deck]?.cards.some(c => c.id === slot.card);
    s.draw = {
      tables: tables.length ? tables : defaultDraw().tables,
      slots: Array.isArray(draw.slots) && draw.slots.length
        ? COLORS.map((_, i) => exists(draw.slots[i]) ? draw.slots[i] : null)
        : [],
    };

    s.decks = decks;
    delete s.holy; delete s.cards; delete s.table;
    s.version = 6;
    return s;
  }

  let state;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      state = normalize(raw ? JSON.parse(raw) : {});
    } catch {
      state = normalize({});
    }
    return state;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('No se pudo guardar en localStorage', e);
    }
  }

  function replace(newState) {
    const hasCards = newState && (typeof newState.decks === 'object' || Array.isArray(newState.cards) || Array.isArray(newState.holy));
    if (!newState || !Array.isArray(newState.games) || !hasCards) throw new Error('Archivo no válido');
    state = normalize(newState);
    save();
  }

  return {
    TABLES,
    COLORS,
    defaultDraw,
    defaultRules,
    uid,
    load,
    save,
    replace,
    newCard,
    defaultDecks,
    get: () => state,
  };
})();
