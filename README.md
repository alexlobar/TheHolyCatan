# Catán Tracker

App web estática (HTML + CSS + JS, sin dependencias) para nuestras partidas de Catán.
Adaptada a móvil y tablet. Los datos se guardan en el `localStorage` del navegador.

## ✨ Liga de Catanes
- **Palmarés de WhatsApp**: las victorias por año de 2024, 2025 y 2026 (hasta el 25-10-2026) están en `LEGACY` de `js/storage.js`. Se suman a las partidas registradas en la app; PJ y % solo cuentan las de la app. Fuachi aparece solo ahí, como invitado (sin medalla ni títulos).
- **Temporadas anuales**, como la liga. 2024 y 2025 ya tienen campeón (Serbest y Kristy).
- **⚠️ Regla de los fundadores**: una victoria solo cuenta para la liga si juegan al menos 3 de Kristy, Emi, Serbest y Bylexx. Si no, la partida queda en el historial marcada y fuera de clasificación, estadísticas y logros.
- **📜 Histórico de la liga** (arriba en 📊 Stats): partidas totales y por año (cada victoria = una partida; WhatsApp + app), campeón de cada año y tabla de victorias por jugador y año con % sobre el total. A 25-10-2026: 2024 = 32, 2025 = 48, 2026 = 49 → **129 partidas**. La ficha de cada jugador (victorias, %, mejor año) y el gráfico de evolución también usan el histórico; rachas, meses y cara a cara solo salen de partidas registradas en la app.
- **📋 Mandar al grupo**: copia/comparte la clasificación con el mismo formato que el grupo (`✨ *LIGA DE CATANES* ✨2026✨` / `Serbest👙: XIII🥇`).
- Emojis de jugador: Serbest 👙 · Kristy 🏍️ · Bylexx 🐈 · Emi 💃🏼 (`EMOJI` en `js/storage.js`).

## Funciones
- **🎲 Partida**: modo partida en curso. Eliges jugadores, se sortean las habilidades y empieza el cronómetro (con pausa), con las habilidades en juego a mano. **🏅 Marcador de puntos de victoria** (+/− por jugador, empieza en 2; al llegar a 10 avisa y deja marcado al ganador). Al acabar eliges ganador y la partida se guarda con habilidades, puntos y duración; resumen con puntos finales, logros nuevos, botón para compartir y **🔁 Revancha** (mismos jugadores, habilidades nuevas). Sobrevive a cerrar la app y mantiene la pantalla encendida.
- **📺 Modo mesa**: pantalla completa para dejar el móvil o la tablet en la mesa. **Se abre solo al empezar la partida** (y con «📺 Modo mesa» en la partida), con cuatro pestañas: **🏅 Marcador** (jugadores con botones − / + grandes; al llegar a 10 sale «🏁 Terminar partida»), **🎴 Holy Table** (las 5 habilidades como cartas grandes con su color), **🎮 Juegos** (los de «Mientras esperas» a pantalla completa; puedes ir al marcador y volver y el juego sigue donde lo dejaste) y **🏁 Terminar** (ganador, nota, guardar o cancelar; al guardar sale el resumen). Arriba, cronómetro con pausa. Mantiene la pantalla encendida; ✕ vuelve a la app.
- **👥 Invitados**: «＋ Invitado» al preparar la partida o en el registro rápido, o en *Ajustes → Jugadores* (nombre y emoji opcional; Fuachi viene ya añadido). En *Ajustes → Jugadores*, al tocar a cualquiera (fundador o invitado) se abre su ficha en 📊 Stats; la lista muestra sus partidas y su título principal. Juegan, suman puntos y quedan en el historial y la clasificación marcados como invitados (sin medalla, cuchara ni títulos). La regla de los 3 fundadores sigue igual. Quitar un invitado de la lista no borra sus partidas.
- **📅 Calendario** (📊 Stats): mes a mes, cada día coloreado según las partidas jugadas; al tocar un día salen sus partidas. Con días jugados y día de la semana favorito.
- **🏅 Estadísticas de puntos** (solo partidas jugadas con el marcador): media de puntos y veces que se quedó a uno en la ficha; récords de partida más ajustada y mayor paliza.
- **🏆 Tracker**: clasificación por **temporada** (trimestral, anual o sin temporadas) con PJ, victorias en romanos, % y medallas 🥇🥈🥉🪵; **campeones** de cada temporada terminada; registro rápido (opcionalmente con las habilidades de la mesa); historial en fichas con duración, habilidades y botón **📤 compartir** (WhatsApp).
- **📊 Stats**: ficha de cada jugador (racha actual y mejor racha, mejor y peor mes, títulos, duración media de sus victorias), **cara a cara** con cada rival, habilidades de la suerte, **14 logros** y tabla de **habilidades ganadoras**.
- **🎴 Holy Table**: en cada partida, las 5 cartas de colores (negra, verde, naranja, morada, azul) reciben una habilidad al azar, sin repetir, sacada de las tablas elegidas: *The Holy Table*, *The Martyr Table* (con coste/beneficio), *The Shit Table* y, apagadas hasta que las actives en «Tablas en juego», *The War Table*, *The Fortune Table*, *The Crown Table* y *The Chaos Table*. ↻ cambia la habilidad de un solo color. Cada tabla tiene un mazo ilimitado editable (añadir, editar, activar/desactivar, borrar). **＋ Nueva tabla** crea tablas propias (icono, nombre, subtítulo, color y si sus cartas llevan coste/beneficio); se editan o borran con **✏️ Editar tabla** (antes de borrar se hace copia automática). En los textos, `*así*` se ve en cursiva.
- **⚙️ Ajustes**: instalar, tema (auto / claro / oscuro), temporadas, exportar/importar copia de seguridad en JSON y reinicios.
- **📊 Evolución**: gráfico de victorias acumuladas por jugador (por temporada o histórico), con tooltip al tocar y vista de tabla. Colores fijos por jugador, validados con el script de la guía de visualización (claro y oscuro).
- **📷 Fotos**: foto del tablero en cada partida (desde el resumen o el historial), visor a pantalla completa y se comparte junto al resumen. Se guardan comprimidas en IndexedDB **solo en ese dispositivo** (no van en la copia JSON).
- **📜 Reglas de la casa** (botón de arriba): lista editable con buscador (sin tildes), reordenable, con **negrita** y *cursiva*.
- **🎮 Mientras esperas** (botón de arriba o desde la partida), con atajos a cada juego: 🐑 Atrapa la oveja, 🎲 Mayor o menor (2 dados, con % de acierto), 🎵 Simón de recursos, ⚡ ¿Te llega? (mano vs. costes de construcción, 30 s), 🎰 Tragaperras del puerto, 🃏 Parejas de recursos, 🗺️ Generador de tableros y 🎯 Ruleta de la mesa. Récords por dispositivo.
- **📦 Copias de seguridad** (`js/backup.js`): automáticas en el móvil (IndexedDB, las 15 últimas: al guardar/editar/borrar partidas, antes de importar o restaurar y una al día), restaurables desde Ajustes; y **fuera del móvil** con «📦 Guardar copia» (hoja de compartir → Drive, WhatsApp… o descarga). Cada 10 partidas sin copia fuera, aviso en el Tracker.
- **↩ Deshacer** al borrar partidas, cartas y reglas (7 s); **✏️ Editar partidas** (fecha, jugadores, ganador, nota, duración).
- **🔮 Predicción de campeón** del año en curso: ritmo de partidas → partidas que quedan → simulación (4000 veces) con la probabilidad de cada uno.
- **🖼️ Imagen de la clasificación** (`js/imagen.js`): tarjeta JPEG 1080 px para compartir en el grupo.
- **📊 Stats** tiene arriba a la derecha el botón **👤 Ficha de jugador** (y «📊 General» para volver).
- **🎖️ Títulos automáticos**: El Emperador, El Francotirador, El Imparable, Eterno segundo, El Mártir, El Santo, Rey de la Shit Table, El Rayo, El Fiel y El Leñador. Van al líder de cada dato (si lo comparte más de la mitad, queda vacante); el más exclusivo sale bajo el nombre en la clasificación.
- **🏅 Récords del grupo** (partida más larga y más corta, más ajustada, mayor paliza, rachas, más victorias en una temporada, día más viciado…) y **némesis / víctima favorita** en la ficha de cada jugador.
- **🎁 Wrapped de la temporada**: historias a pantalla completa (partidas, campeón, racha, habilidad talismán, partida eterna, cuchara de madera, títulos y clasificación) con botón para compartir.

## Uso local
Abre `index.html` en el navegador (doble clic).

## Publicar en GitHub Pages
1. Crea un repositorio y sube el contenido de esta carpeta.
2. En *Settings → Pages*, elige la rama `main` y la carpeta `/ (root)`.
3. La app quedará en `https://<usuario>.github.io/<repo>/`.

> Cada dispositivo guarda sus propios datos. Usa Exportar/Importar para pasarlos de uno a otro.

## Instalar como app
- **Android (Chrome)**: botón **Instalar** del aviso en el Tracker o de *Ajustes → Instalar en el móvil*. Solo aparece cuando Chrome permite instalar.
- **iPhone/iPad (Safari)**: Compartir → *Añadir a pantalla de inicio*.

> **No uséis el menú ⋮ → Instalar app en Android.** Chrome (≤157) comprueba el dominio, no la carpeta: si ya hay otra app de `TU-USUARIO.github.io` instalada (p. ej. Hábitos), dice por error «Esta aplicación ya está instalada». El botón propio usa `beforeinstallprompt`, que sí mira la carpeta. Ver `Plantillas/PWA-Android-ya-instalada.md`.

Funciona sin conexión gracias a `sw.js` (estrategia red primero: con internet siempre carga la última versión).
Si añades un archivo nuevo a la app, inclúyelo en la lista `ASSETS` de `sw.js`.

**Versión**: al publicar cambios, sube la versión en los cuatro sitios (deben coincidir): `VERSION` en `js/app.js`, `CACHE` en `sw.js`, `data-build` en `index.html` y el `?v=` de cada `<script>`/`<link>` de `index.html`. El `?v=` evita que el móvil mezcle archivos nuevos y viejos (GitHub Pages deja cachearlos 10 min). La versión cargada se ve al final de *Ajustes*, con lo que ocupa la app (archivos de `ASSETS` en `sw.js`) y los datos guardados, en KB.

**Si algo falla**: la app no se bloquea. Cada parte arranca por separado y, si una falla, sale arriba un aviso rojo con el error y el botón **📋 Copiar error** para pasarlo. Si los datos guardados no se pueden leer, se hace antes una copia de rescate en `localStorage` (`catan-app-v1-rescate-…`).

> En iPhone, la app instalada y Safari guardan datos por separado: usad siempre la app instalada (o exportad/importad).

## Estructura
```
index.html        vistas y navegación
css/styles.css    estilos (mobile-first)
js/storage.js     persistencia en localStorage (y migración de versiones antiguas)
js/stats.js       cálculos: temporadas, clasificación, fichas, logros, títulos, récords, Wrapped, texto para compartir
js/charts.js      gráfico SVG de evolución
js/photos.js      fotos de partidas (IndexedDB) y visor
js/rules.js       reglas de la casa
js/recursos.js    los 5 recursos de la casa (Paja, Madera, Loly, Piedra, Barro): nombres, cartas y logo de la app
img/recursos/     imágenes de las cartas (recortes de las cartas del juego, uso personal del grupo)
icons/logo.svg    logo sin fondo (barra superior); icon.svg e icons/*.png = icono de la app
js/fun.js         Mientras esperas (8 juegos)
js/backup.js      copias automáticas y copia fuera del móvil
js/imagen.js      imagen de la clasificación
js/wrapped.js     Wrapped de la temporada
js/mesa.js        modo mesa (marcador táctil, Holy Table de la partida, juegos y terminar partida)
js/tracker.js     clasificación, campeones, registro rápido e historial
js/tables.js      Holy Table (mazos, tablas propias y mesa de 5 colores)
js/game.js        modo partida: cronómetro, puntos de victoria y revancha
js/profile.js     pestaña Stats (histórico, evolución, calendario, ficha)
js/app.js         arranque, pestañas, tema, ajustes, instalar y compartir
icons/            iconos PNG (iPhone 180, Android 192/512 maskable, favicon)
sw.js             service worker (offline + instalable)
```
