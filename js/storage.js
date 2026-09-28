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

  const newCard = (def, name = '', desc = '', cost = '', benefit = '') => ({
    id: uid(), name, desc, enabled: true, ...(def.extended ? { cost, benefit } : {}),
  });

  // Las 5 cartas físicas de colores: en cada partida cada color recibe una habilidad al azar.
  const COLORS = [
    { id: 'black', name: 'Negra', hex: '#2b2b2b' },
    { id: 'green', name: 'Verde', hex: '#3f8f3a' },
    { id: 'orange', name: 'Naranja', hex: '#e07b1f' },
    { id: 'purple', name: 'Morada', hex: '#7b4ca0' },
    { id: 'blue', name: 'Azul', hex: '#2f6db5' },
  ];

  const defaultDeck = def => ({ cards: def.cards.map(c => newCard(def, ...c)) });
  const defaultDecks = () => Object.fromEntries(TABLES.map(t => [t.id, defaultDeck(t)]));
  const defaultDraw = () => ({ tables: TABLES.map(t => t.id), slots: [] });

  const defaults = () => ({
    version: 4,
    players: [...PLAYERS],
    games: [],   // { id, date, players: [...], winner, note }
    decks: {},   // { [tablaId]: { cards: [{ id, name, desc, enabled, cost?, benefit? }] } }
    draw: defaultDraw(), // mesa de la partida: tablas que entran + slots[i] = { deck, card } para COLORS[i] (o null)
  });

  // Cartas de relleno de versiones anteriores: si solo hay estas, se sustituyen por las reales.
  const isPlaceholder = c => /^(Carta|Uso) de desarrollo \d$/.test(c.name);

  // Rellena lo que falte y migra datos antiguos:
  //  v1: `holy` = 5 usos fijos · v2: `cards` + `table` = un único mazo
  //  v3: `decks` por tabla, cada uno con su mesa · v4: una sola mesa de 5 colores (`draw`).
  function normalize(data) {
    const s = { ...defaults(), ...data };
    const decks = data.decks && typeof data.decks === 'object' ? { ...data.decks } : {};

    const old = Array.isArray(data.cards) ? data.cards : Array.isArray(data.holy) ? data.holy : null;
    if (!decks.holy && old && old.some(c => !isPlaceholder(c))) {
      decks.holy = { cards: old.map(c => ({ id: c.id || uid(), name: c.name, desc: c.desc, enabled: c.enabled !== false })) };
    }

    for (const t of TABLES) {
      const d = decks[t.id];
      if (!d || !Array.isArray(d.cards)) decks[t.id] = defaultDeck(t);
      else delete d.table;
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
    s.version = 4;
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
    load,
    save,
    replace,
    newCard,
    defaultDecks,
    get: () => state,
  };
})();
