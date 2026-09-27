# Catán Tracker

App web estática (HTML + CSS + JS, sin dependencias) para nuestras partidas de Catán.
Adaptada a móvil y tablet. Los datos se guardan en el `localStorage` del navegador.

## Funciones
- **Tracker**: registra partidas (participantes + ganador) y calcula victorias, derrotas y % de Kristy, Emi, Serbest y Bylexx.
- **Tablas de cartas**: *The Holy Table*, *The Martyr Table* (con coste/beneficio) y *The Shit Table*, precargadas con nuestras house rules. Cada tabla tiene un mazo ilimitado (añadir, editar, activar/desactivar, borrar) y su propia mesa de 5 cartas distintas sorteadas por partida; ↻ cambia una sola carta y «Robar 1» saca una al azar de la mesa. En los textos, `*así*` se ve en cursiva.
- **Ajustes**: exportar/importar copia de seguridad en JSON y reinicios.

## Uso local
Abre `index.html` en el navegador (doble clic).

## Publicar en GitHub Pages
1. Crea un repositorio y sube el contenido de esta carpeta.
2. En *Settings → Pages*, elige la rama `main` y la carpeta `/ (root)`.
3. La app quedará en `https://<usuario>.github.io/<repo>/`.

> Cada dispositivo guarda sus propios datos. Usa Exportar/Importar para pasarlos de uno a otro.

## Estructura
```
index.html        vistas y navegación
css/styles.css    estilos (mobile-first)
js/storage.js     persistencia en localStorage
js/tracker.js     partidas y estadísticas
js/tables.js      tablas de cartas (mazo + mesa)
js/app.js         arranque, pestañas y ajustes
icons/            iconos PNG (iPhone 180, Android 192/512 maskable, favicon)
```
