// Capa de persistencia: todo pasa por aquí para poder cambiar a otro backend en el futuro.
const Storage = (() => {
  const KEY = 'catan-app-v1';

  const PLAYERS = ['Kristy', 'Emi', 'Serbest', 'Bylexx'];
  // Los fundadores de la liga: una victoria solo vale si juegan al menos 3 (regla de WhatsApp).
  const FOUNDERS = ['Kristy', 'Emi', 'Serbest', 'Bylexx'];
  const MIN_FOUNDERS = 3;
  const EMOJI = { Serbest: '👙', Kristy: '🏍️', Bylexx: '🐈', Emi: '💃🏼' };

  // ✨ LIGA DE CATANES ✨ — victorias por año copiadas del grupo de WhatsApp (no hay partidas
  // detalladas: solo el total). Fuachi solo aparece aquí, en el palmarés de cada año.
  const LEGACY = {
    2024: { Serbest: 9, Kristy: 7, Bylexx: 6, Fuachi: 4, Emi: 6 },
    2025: { Serbest: 12, Kristy: 13, Bylexx: 11, Fuachi: 2, Emi: 10 },
    2026: { Serbest: 13, Kristy: 7, Bylexx: 18, Fuachi: 1, Emi: 10 },
  };

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  // Copia profunda de datos simples (structuredClone no existe en navegadores algo antiguos).
  const clone = v => JSON.parse(JSON.stringify(v));
  const str = v => (typeof v === 'string' ? v : v == null ? '' : String(v));

  // Definición de las tablas de cartas de la casa. `extended` añade los campos coste/beneficio.
  // `off`: no entra en el sorteo hasta que se active en «Tablas en juego». En los textos, *así*
  // se muestra en cursiva. Las tablas creadas desde la app van en state.customTables.
  const BUILTIN = [
    {
      id: 'holy',
      color: '#c9971c',
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
      color: '#6b4c9a',
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
      color: '#7a5230',
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
    {
      id: 'war',
      color: '#9b2c2c',
      icon: '⚔️',
      short: 'War',
      name: 'The War Table',
      subtitle: 'Codex Belli · Ars Conflictus',
      off: true,
      cards: [
        ['El Asedio', 'Elige un jugador: no puede construir junto a tus poblados durante 2 rondas.'],
        ['La Emboscada', 'Mueve el ladrón a cualquier hexágono y roba 2 cartas en vez de 1.'],
        ['El Duelo', 'Tú y un rival tiráis un dado; el mayor roba 2 cartas al otro. *Empate: ambos pierden 1.*'],
        ['La Traición', 'Rompe un acuerdo comercial ya hecho este turno: devolvéis las cartas.'],
        ['El Mercenario', 'Paga 2 materiales a otro jugador para que mueva el ladrón donde tú digas.'],
      ],
    },
    {
      id: 'fortune',
      color: '#2e8b57',
      icon: '🍀',
      short: 'Fortune',
      name: 'The Fortune Table',
      subtitle: 'Codex Fortunæ · Alea Iacta Est',
      off: true,
      cards: [
        ['La Rueda', 'Todos pasan su mano entera al jugador de la izquierda.'],
        ['El Doble o Nada', 'Tira un dado: con par, duplica tus cartas de recurso; con impar, pierdes la mitad.'],
        ['El Trébol', 'La próxima tirada de 7 te la puedes saltar: no descartas ni te roban.'],
        ['La Profecía', 'Elige un número: si sale en las próximas 2 tiradas, cobras triple.'],
        ['El Comodín', 'Cambia el número de una ficha por otro durante 1 ronda.'],
      ],
    },
    {
      id: 'crown',
      color: '#1f6fb2',
      icon: '👑',
      short: 'Crown',
      name: 'The Crown Table',
      subtitle: 'Codex Regalis · Privilegia Coronæ',
      off: true,
      cards: [
        ['El Decreto', 'Prohíbe un material a todos durante 1 ronda: nadie puede comerciarlo.'],
        ['El Tributo', 'Cada jugador te da 1 material a su elección.'],
        ['La Corte', 'Tus puertos funcionan 2:1 con cualquier material durante 2 rondas.'],
        ['El Heredero', 'Tu próxima ciudad cuesta 1 de paja menos.'],
        ['La Abdicación', 'Pierdes 1 punto de victoria, pero robas 2 cartas de desarrollo gratis.'],
      ],
    },
    {
      id: 'chaos',
      color: '#d2551e',
      icon: '🌋',
      short: 'Chaos',
      name: 'The Chaos Table',
      subtitle: 'Codex Chaos · Mundus Inversus',
      off: true,
      cards: [
        ['El Terremoto', 'Intercambia dos fichas de número del tablero para el resto de la partida.'],
        ['La Sequía', 'Durante 1 ronda nadie cobra un material a elegir por quien robó la carta.'],
        ['La Marea', 'Los puertos quedan cerrados durante 2 rondas.'],
        ['El Éxodo', 'Todos mueven una carretera propia a otro sitio legal.'],
        ['El Eclipse', 'La próxima ronda se juega en sentido contrario.'],
      ],
    },
  ];

  // Lista viva de tablas (las de serie + las creadas en la app). Se modifica en el sitio para
  // que los módulos que la guardaron (const { TABLES } = Storage) vean siempre la actual.
  const TABLES = [...BUILTIN];

  // Saneado de las tablas propias: { id, icon, short, name, subtitle, color, extended }.
  function cleanCustom(list) {
    return (Array.isArray(list) ? list : [])
      .filter(t => t && typeof t === 'object' && t.id && !BUILTIN.some(b => b.id === t.id))
      .map(t => ({
        id: str(t.id),
        icon: str(t.icon).slice(0, 4) || '🎴',
        name: str(t.name).slice(0, 40) || 'Tabla sin nombre',
        short: str(t.short || t.name).slice(0, 12) || 'Tabla',
        subtitle: str(t.subtitle).slice(0, 60),
        color: /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : '#5b6b7a',
        extended: !!t.extended,
        custom: true,
        cards: [],
      }));
  }

  function syncTables(custom) {
    TABLES.length = 0;
    TABLES.push(...BUILTIN, ...cleanCustom(custom));
  }

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
  const defaultDraw = () => ({ tables: BUILTIN.filter(t => !t.off).map(t => t.id), slots: [] });
  const defaultSettings = () => ({ seasonMode: 'year' }); // year | quarter | none (la liga es anual)

  const FOUNDERS_RULE = ['⚠️ Victorias válidas', `Para que la victoria sea válida debe haber un **mínimo de ${MIN_FOUNDERS} fundadores** (${FOUNDERS.join(', ')}). Si no, la partida queda en el historial pero **no cuenta para la liga**.`];

  // Reglas de la casa de ejemplo (editables en 📜 Reglas). En los textos: *cursiva* y **negrita**.
  const defaultRules = () => [
    ['Las 5 cartas de colores', 'En cada partida, la app sortea una habilidad para cada carta: **negra, verde, naranja, morada y azul** (🎴 Holy Table). Quien juega una carta de color aplica la habilidad que le ha tocado en esa partida.'],
    ['¿Qué es una ronda?', 'Una ronda termina cuando el turno vuelve a quien empezó la partida. Las cartas que duran «X rondas» se cuentan así.'],
    ['El Destierro', 'No juegas 2 rondas: sin cobrar, te afectan los 7 y no puedes cambiar. *Te libras antes si sacas doble 1 o doble 6.*'],
    ['La Absolución', 'Todos (excepto quien la juega) quedan libres de las penalizaciones activas; quien la juega recibe al ladrón.'],
    ['Discusiones', 'Si no hay acuerdo, decide el dado: **par** gana quien reclama, **impar** el otro. Sin recurso.'],
    ['Turnos eternos', 'Si alguien tarda demasiado, el resto puede empezar a contar **en voz alta hasta 30**. Al llegar, se pasa el turno.'],
    FOUNDERS_RULE,
  ].map(([title, text]) => ({ id: uid(), title, text }));

  // Invitados: juegan y quedan en el historial, pero no son fundadores (sin medalla ni títulos).
  const defaultGuests = () => [{ name: 'Fuachi', emoji: '' }];
  function cleanGuests(list, players) {
    const seen = new Set(players.map(p => p.toLowerCase()));
    return (Array.isArray(list) ? list : [])
      .map(g => (typeof g === 'string' ? { name: g } : g))
      .filter(g => g && typeof g === 'object')
      .map(g => ({ name: str(g.name).trim().slice(0, 20), emoji: str(g.emoji).trim().slice(0, 4) }))
      .filter(g => g.name && !seen.has(g.name.toLowerCase()) && seen.add(g.name.toLowerCase()));
  }

  const defaults = () => ({
    version: 9,
    players: [...PLAYERS],
    guests: defaultGuests(), // [{ name, emoji }]
    legacy: clone(LEGACY), // { [año]: { jugador: victorias } } de la liga de WhatsApp
    // { id, date, players, winner, note, abilities?: [{ color, deck, name }], duration?: segundos,
    //   points?: { jugador: puntos de victoria }, photo?: true (la foto vive en IndexedDB) }
    games: [],
    customTables: [], // tablas de cartas creadas desde la app
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
  //  v5: `rounds` en las cartas, `settings` (temporadas) y `current` (partida en curso)
  //  v6: `rules` · v7: `legacy` (liga de WhatsApp), temporadas anuales y regla de fundadores
  //  v8: tablas nuevas (War, Fortune, Crown, Chaos), tablas propias y puntos de victoria.
  //  v9: invitados (`guests`).
  const cleanPoints = p => {
    if (!p || typeof p !== 'object') return undefined;
    const out = {};
    for (const [k, v] of Object.entries(p)) { const n = parseInt(v, 10); if (k && Number.isFinite(n)) out[k] = Math.max(0, Math.min(30, n)); }
    return Object.keys(out).length ? out : undefined;
  };

  function normalize(data) {
    const s = { ...defaults(), ...data };
    const prev = data.version || 0;
    if (!Array.isArray(s.games)) s.games = [];
    s.settings = { ...defaultSettings(), ...(data.settings || {}) };
    if (s.current && (!Array.isArray(s.current.players) || !s.current.timer)) s.current = null;
    if (!Array.isArray(s.rules)) s.rules = defaultRules();
    if (!s.legacy || typeof s.legacy !== 'object') s.legacy = clone(LEGACY);
    // Saneado: datos rotos o de versiones viejas no deben romper la app al arrancar.
    for (const [y, row] of Object.entries(s.legacy)) {
      if (!row || typeof row !== 'object') { delete s.legacy[y]; continue; }
      for (const [p, n] of Object.entries(row)) row[p] = Math.max(0, parseInt(n, 10) || 0);
    }
    s.games = s.games
      .filter(g => g && typeof g === 'object' && Array.isArray(g.players) && g.winner)
      .map(g => ({
        ...g,
        id: str(g.id) || uid(),
        date: /^\d{4}-\d{2}-\d{2}$/.test(g.date) ? g.date : '',
        players: g.players.map(str).filter(Boolean),
        winner: str(g.winner),
        note: str(g.note),
        abilities: Array.isArray(g.abilities) ? g.abilities.filter(a => a && a.name) : undefined,
        points: cleanPoints(g.points),
      }));
    if (!Array.isArray(s.players) || !s.players.length) s.players = [...PLAYERS];
    s.guests = cleanGuests(Array.isArray(data.guests) ? data.guests : defaultGuests(), s.players);
    s.rules = s.rules.filter(r => r && typeof r === 'object').map(r => ({ id: str(r.id) || uid(), title: str(r.title), text: str(r.text) }));
    if (s.current) {
      s.current.abilities = Array.isArray(s.current.abilities) ? s.current.abilities : [];
      s.current.effects = Array.isArray(s.current.effects) ? s.current.effects : [];
      s.current.points = cleanPoints(s.current.points) || Object.fromEntries(s.current.players.map(p => [p, 2]));
    }
    if (!s.draw || typeof s.draw !== 'object') s.draw = defaultDraw();
    // Una sola vez al pasar a v7: la liga es anual y entra la regla de los fundadores.
    if (prev && prev < 7) {
      s.settings.seasonMode = 'year';
      if (!s.rules.some(r => r.title === FOUNDERS_RULE[0])) s.rules.unshift({ id: uid(), title: FOUNDERS_RULE[0], text: FOUNDERS_RULE[1] });
    }
    const decks = data.decks && typeof data.decks === 'object' ? { ...data.decks } : {};
    // Tablas propias: se sanean y se añaden a la lista viva antes de crear sus mazos.
    syncTables(data.customTables);
    s.customTables = TABLES.filter(t => t.custom).map(({ cards, custom, ...t }) => t);

    const old = Array.isArray(data.cards) ? data.cards : Array.isArray(data.holy) ? data.holy : null;
    if (!decks.holy && old && old.some(c => !isPlaceholder(c))) {
      decks.holy = { cards: old.map(c => ({ id: c.id || uid(), name: c.name, desc: c.desc, enabled: c.enabled !== false })) };
    }

    for (const t of TABLES) {
      const d = decks[t.id];
      if (!d || !Array.isArray(d.cards)) decks[t.id] = defaultDeck(t);
      else delete d.table;
      decks[t.id].cards = decks[t.id].cards.filter(c => c && typeof c === 'object');
      for (const c of decks[t.id].cards) {
        c.id = str(c.id) || uid();
        c.name = str(c.name);
        c.desc = str(c.desc);
        c.enabled = c.enabled !== false;
        if (typeof c.rounds !== 'number') c.rounds = DEFAULT_ROUNDS[c.name] || 0;
      }
    }

    const draw = data.draw && typeof data.draw === 'object' ? data.draw : defaultDraw();
    const tables = (Array.isArray(draw.tables) ? draw.tables : []).filter(id => decks[id] && TABLES.some(t => t.id === id));
    const exists = slot => slot && decks[slot.deck]?.cards.some(c => c.id === slot.card);
    s.draw = {
      tables: tables.length ? tables : defaultDraw().tables,
      slots: Array.isArray(draw.slots) && draw.slots.length
        ? COLORS.map((_, i) => exists(draw.slots[i]) ? draw.slots[i] : null)
        : [],
    };

    // Mazos de tablas que ya no existen (p. ej. una tabla propia borrada): fuera.
    for (const id of Object.keys(decks)) if (!TABLES.some(t => t.id === id)) delete decks[id];
    s.decks = decks;
    delete s.holy; delete s.cards; delete s.table;
    s.version = 9;
    return s;
  }

  let state;

  // Todos los que pueden jugar: los de la casa y después los invitados.
  const roster = () => [...state.players, ...state.guests.map(g => g.name)];
  const isGuest = name => !!state && !state.players.includes(name);
  const emojiOf = name => EMOJI[name] || state?.guests.find(g => g.name === name)?.emoji || '';

  // Añade un invitado. Devuelve un mensaje de error o null si ha ido bien.
  function addGuest(name, emoji = '') {
    const n = str(name).trim().replace(/\s+/g, ' ').slice(0, 20);
    if (!n) return 'Escribe un nombre';
    if (roster().some(p => p.toLowerCase() === n.toLowerCase())) return `${n} ya está en la lista`;
    state.guests.push({ name: n, emoji: str(emoji).trim().slice(0, 4) });
    save();
    return null;
  }

  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(KEY);
      state = normalize(raw ? JSON.parse(raw) : {});
    } catch (e) {
      // No se pudieron leer los datos: se guarda una copia intacta antes de seguir, para que
      // nada los sobrescriba (se puede recuperar exportándola desde la consola o con ayuda).
      try { if (raw) localStorage.setItem(`${KEY}-rescate-${Date.now()}`, raw); } catch {}
      state = normalize({});
      throw new Error(`No se pudieron leer los datos guardados (copia de rescate hecha): ${e.message}`);
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
    syncTables,
    COLORS,
    defaultDraw,
    defaultRules,
    FOUNDERS,
    MIN_FOUNDERS,
    EMOJI,
    roster,
    isGuest,
    emojiOf,
    addGuest,
    uid,
    load,
    save,
    replace,
    newCard,
    defaultDecks,
    get: () => state,
  };
})();
