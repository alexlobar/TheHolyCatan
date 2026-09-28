# Catán Tracker

App web estática (HTML + CSS + JS, sin dependencias) para nuestras partidas de Catán.
Adaptada a móvil y tablet. Los datos se guardan en el `localStorage` del navegador.

## Funciones
- **Tracker**: registra partidas (participantes + ganador). Clasificación con partidas jugadas, victorias en números romanos, % y medallas 🥇🥈🥉🪵 (empates comparten puesto). Historial en fichas numeradas (Partida I, II…).
- **Holy Table**: en cada partida, las 5 cartas de colores (negra, verde, naranja, morada, azul) reciben una habilidad al azar, sin repetir, sacada de las tablas elegidas: *The Holy Table*, *The Martyr Table* (con coste/beneficio) y *The Shit Table*. ↻ cambia la habilidad de un solo color. Cada tabla tiene un mazo ilimitado editable (añadir, editar, activar/desactivar, borrar). En los textos, `*así*` se ve en cursiva.
- **Ajustes**: exportar/importar copia de seguridad en JSON y reinicios.

## Uso local
Abre `index.html` en el navegador (doble clic).

## Publicar en GitHub Pages
1. Crea un repositorio y sube el contenido de esta carpeta.
2. En *Settings → Pages*, elige la rama `main` y la carpeta `/ (root)`.
3. La app quedará en `https://<usuario>.github.io/<repo>/`.

> Cada dispositivo guarda sus propios datos. Usa Exportar/Importar para pasarlos de uno a otro.

## Instalar como app
- **Android (Chrome)**: menú ⋮ → *Instalar aplicación*, o el botón de *Ajustes → Instalar en el móvil*.
- **iPhone/iPad (Safari)**: Compartir → *Añadir a pantalla de inicio*.

Funciona sin conexión gracias a `sw.js` (estrategia red primero: con internet siempre carga la última versión).
Si añades un archivo nuevo a la app, inclúyelo en la lista `ASSETS` de `sw.js`.

> En iPhone, la app instalada y Safari guardan datos por separado: usad siempre la app instalada (o exportad/importad).

## Estructura
```
index.html        vistas y navegación
css/styles.css    estilos (mobile-first)
js/storage.js     persistencia en localStorage
js/tracker.js     partidas y estadísticas
js/tables.js      tablas de cartas (mazo + mesa)
js/app.js         arranque, pestañas y ajustes
icons/            iconos PNG (iPhone 180, Android 192/512 maskable, favicon)
sw.js             service worker (offline + instalable)
```
