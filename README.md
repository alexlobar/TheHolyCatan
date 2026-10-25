# Catán Tracker

App web estática (HTML + CSS + JS, sin dependencias) para nuestras partidas de Catán.
Adaptada a móvil y tablet. Los datos se guardan en el `localStorage` del navegador.

## Funciones
- **🎲 Partida**: modo partida en curso. Eliges jugadores, se sortean las habilidades y empieza el cronómetro (con pausa). Contador de rondas y **penalizaciones activas** (La Ruina, El Destierro…) que bajan una ronda con «Siguiente ronda» y avisan al terminar. Al acabar eliges ganador y la partida se guarda con habilidades, duración y rondas; resumen con logros nuevos y botón para compartir. Sobrevive a cerrar la app y mantiene la pantalla encendida.
- **🏆 Tracker**: clasificación por **temporada** (trimestral, anual o sin temporadas) con PJ, victorias en romanos, % y medallas 🥇🥈🥉🪵; **campeones** de cada temporada terminada; registro rápido (opcionalmente con las habilidades de la mesa); historial en fichas con duración, habilidades y botón **📤 compartir** (WhatsApp).
- **📊 Stats**: ficha de cada jugador (racha actual y mejor racha, mejor y peor mes, títulos, duración media de sus victorias), **cara a cara** con cada rival, habilidades de la suerte, **14 logros** y tabla de **habilidades ganadoras**.
- **🎴 Holy Table**: en cada partida, las 5 cartas de colores (negra, verde, naranja, morada, azul) reciben una habilidad al azar, sin repetir, sacada de las tablas elegidas: *The Holy Table*, *The Martyr Table* (con coste/beneficio) y *The Shit Table*. ↻ cambia la habilidad de un solo color. Cada tabla tiene un mazo ilimitado editable (añadir, editar, activar/desactivar, borrar, duración en rondas). En los textos, `*así*` se ve en cursiva.
- **⚙️ Ajustes**: instalar, tema (auto / claro / oscuro), temporadas, exportar/importar copia de seguridad en JSON y reinicios.
- **📊 Evolución**: gráfico de victorias acumuladas por jugador (por temporada o histórico), con tooltip al tocar y vista de tabla. Colores fijos por jugador, validados con el script de la guía de visualización (claro y oscuro).
- **📷 Fotos**: foto del tablero en cada partida (desde el resumen o el historial), visor a pantalla completa y se comparte junto al resumen. Se guardan comprimidas en IndexedDB **solo en ese dispositivo** (no van en la copia JSON).
- **📜 Reglas de la casa** (botón de arriba): lista editable con buscador (sin tildes), reordenable, con **negrita** y *cursiva*.
- **🎮 Mientras esperas** (botón de arriba o desde la partida): 🔮 Oráculo del dado (apuesta la próxima suma; apunta las tiradas e histograma frente a lo esperado, se guardan con la partida), 🗯️ Meter prisa (pulla a pantalla completa + cuenta atrás; cuenta quién es el más lento), 🧠 Trivial de Catán (reglas base + preguntas generadas con vuestras cartas) y 🎯 Ruleta de la mesa.

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

**Versión**: al publicar cambios, sube la versión en los tres sitios (deben coincidir): `VERSION` en `js/app.js`, `CACHE` en `sw.js` y `data-build` en `index.html`. La versión cargada se ve al final de *Ajustes*.

> En iPhone, la app instalada y Safari guardan datos por separado: usad siempre la app instalada (o exportad/importad).

## Estructura
```
index.html        vistas y navegación
css/styles.css    estilos (mobile-first)
js/storage.js     persistencia en localStorage (y migración de versiones antiguas)
js/stats.js       cálculos: temporadas, clasificación, fichas, logros, dados, texto para compartir
js/charts.js      gráficos SVG (evolución y dados)
js/photos.js      fotos de partidas (IndexedDB) y visor
js/rules.js       reglas de la casa
js/fun.js         Mientras esperas (oráculo, prisa, trivial, ruleta)
js/tracker.js     clasificación, campeones, registro rápido e historial
js/tables.js      Holy Table (mazos + mesa de 5 colores)
js/game.js        modo partida: cronómetro, rondas, penalizaciones
js/profile.js     pestaña Stats
js/app.js         arranque, pestañas, tema, ajustes, instalar y compartir
icons/            iconos PNG (iPhone 180, Android 192/512 maskable, favicon)
sw.js             service worker (offline + instalable)
```
