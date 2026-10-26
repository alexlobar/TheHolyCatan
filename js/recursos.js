// Recursos de la casa: nombres e imágenes con forma de carta. Un único sitio: si cambia un
// nombre o una imagen, se cambia aquí y en toda la app.
//   Paja (trigo) · Madera · Loly (oveja) · Piedra (mineral) · Barro (ladrillo)
// Las imágenes (img/recursos/*.jpg) son recortes de las cartas de recurso del juego, para uso
// personal del grupo.
const Res = (() => {
  // Carta de 40 × 52: marco de pergamino + la imagen recortada con esquinas redondeadas.
  const art = id => `
    <rect x="1" y="1" width="38" height="50" rx="5" fill="#ecd9a8" stroke="#b8935a" stroke-width="1.2"/>
    <image href="img/recursos/${id}.jpg" x="4" y="4" width="32" height="44" preserveAspectRatio="xMidYMid slice" clip-path="url(#res-clip)"/>
    <rect x="4" y="4" width="32" height="44" rx="3" fill="none" stroke="#b8935a" stroke-width=".7"/>
    <circle cx="20" cy="2.6" r="1" fill="#b8935a"/><circle cx="20" cy="49.4" r="1" fill="#b8935a"/>`;

  // id: clave interna (y nombre del archivo de imagen) · name: como lo llamáis · color: tono
  // para fondos y bordes (p. ej. los botones de Simón).
  const LIST = [
    { id: 'paja', name: 'Paja', color: '#e2b43c' },
    { id: 'madera', name: 'Madera', color: '#3f6b35' },
    { id: 'loly', name: 'Loly', color: '#7cc04a' },
    { id: 'piedra', name: 'Piedra', color: '#9aa3b2' },
    { id: 'barro', name: 'Barro', color: '#b8683a' },
  ].map(r => ({ ...r, art: art(r.id) }));

  const byId = Object.fromEntries(LIST.map(r => [r.id, r]));

  // Sprite con los 5 símbolos, insertado una vez en la página: los iconos usan <use href="#res-…">.
  (function injectSprite() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
      <defs><clipPath id="res-clip"><rect x="4" y="4" width="32" height="44" rx="3"/></clipPath></defs>
      ${LIST.map(r => `<symbol id="res-${r.id}" viewBox="0 0 40 52">${r.art}</symbol>`).join('')}</svg>`;
    document.body.insertAdjacentHTML('afterbegin', svg);
  })();

  // Icono HTML (carta pequeña).
  const icon = (id, cls = '') =>
    `<svg class="res-ico ${cls}" viewBox="0 0 40 52" role="img" aria-label="${byId[id].name}"><use href="#res-${id}"/></svg>`;

  // Para usar dentro de otro <svg> (p. ej. el generador de tableros).
  const use = (id, x, y, w) => `<use href="#res-${id}" x="${x}" y="${y}" width="${w}" height="${(w * 52) / 40}"/>`;

  /* Logo de la app: bandeja hexagonal de borde negro con un paisaje al atardecer dentro
     (sol grande, campos, camino, cipreses, granja y pueblo en la colina). Dibujo propio.
     Con fondo: icono de la app (todo dentro del 80 % central, zona segura de Android).
     Sin fondo: logo de la cabecera y favicon. */
  function appIcon(size = 512, { background = true } = {}) {
    const R = 196; // radio exterior del hexágono (vértices a izquierda y derecha)
    const hex = r => Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 3) * k;
      return `${(256 + r * Math.cos(a)).toFixed(1)},${(256 + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
    const grommets = Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 3) * k;
      return `<circle cx="${(256 + 184 * Math.cos(a)).toFixed(1)}" cy="${(256 + 184 * Math.sin(a)).toFixed(1)}" r="5.5" fill="#2b2b2b" stroke="#8a8a8a" stroke-width="1.5"/>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
      <defs>
        <clipPath id="tray"><polygon points="${hex(174)}"/></clipPath>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#e2382a"/><stop offset=".45" stop-color="#f26d2c"/><stop offset="1" stop-color="#f9c24c"/>
        </linearGradient>
        <radialGradient id="sun" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#fff3b0"/><stop offset=".75" stop-color="#fbe27a"/><stop offset="1" stop-color="#f7cf55"/>
        </radialGradient>
        <linearGradient id="field" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#9cc24a"/><stop offset="1" stop-color="#4f8f2a"/>
        </linearGradient>
      </defs>
      ${background ? '<rect width="512" height="512" fill="#f3e6cc"/>' : ''}
      <!-- Bandeja: borde negro con remaches -->
      <polygon points="${hex(R)}" fill="#141414" stroke="#0a0a0a" stroke-width="8" stroke-linejoin="round"/>
      <polygon points="${hex(178)}" fill="#2a2a2a"/>
      <g clip-path="url(#tray)">
        <!-- Cielo y sol -->
        <rect x="60" y="90" width="392" height="240" fill="url(#sky)"/>
        <circle cx="256" cy="262" r="112" fill="#fbd35c" opacity=".35"/>
        <circle cx="256" cy="262" r="92" fill="url(#sun)"/>
        <!-- Colinas lejanas -->
        <path d="M60 300 Q140 272 210 290 T360 284 T452 292 L452 330 L60 330 Z" fill="#e3a65a" opacity=".75"/>
        <!-- Pueblo en la colina -->
        <path d="M222 304 Q285 262 362 302 Z" fill="#b7773e"/>
        <g fill="#9c5a30">
          <rect x="262" y="276" width="12" height="16"/><rect x="276" y="270" width="10" height="22"/><rect x="288" y="279" width="14" height="13"/>
          <rect x="304" y="274" width="9" height="18"/><rect x="315" y="282" width="15" height="11"/><rect x="246" y="286" width="13" height="10"/>
        </g>
        <rect x="279" y="252" width="7" height="22" fill="#86492a"/><path d="M278 252 L282.5 243 L287 252 Z" fill="#6e3a20"/>
        <g fill="#7a3d22"><path d="M262 276 L268 270 L274 276 Z"/><path d="M288 279 L295 273 L302 279 Z"/><path d="M315 282 L322.5 276 L330 282 Z"/></g>
        <!-- Campos -->
        <path d="M60 300 Q256 286 452 302 L452 430 L60 430 Z" fill="url(#field)"/>
        <path d="M60 318 Q150 300 230 314 L210 340 Q130 336 60 352 Z" fill="#e2b33c"/>
        <path d="M300 312 Q380 302 452 314 L452 346 Q380 338 318 344 Z" fill="#d79a2c"/>
        <path d="M60 368 Q140 352 200 362 L180 400 L60 410 Z" fill="#d9a536" opacity=".85"/>
        <path d="M330 360 Q400 350 452 360 L452 400 Q390 394 342 398 Z" fill="#5fa03a"/>
        <!-- Camino serpenteante -->
        <path d="M232 430 C230 400 290 386 270 360 C254 340 300 322 296 306 L302 306 C310 324 268 342 284 362 C306 392 252 404 262 430 Z" fill="#f4e7c7"/>
        <!-- Cipreses -->
        <g fill="#2e5a26">
          <ellipse cx="140" cy="262" rx="11" ry="40"/><ellipse cx="160" cy="276" rx="7" ry="24"/>
          <ellipse cx="214" cy="292" rx="4" ry="13"/><ellipse cx="224" cy="294" rx="4" ry="11"/><ellipse cx="234" cy="293" rx="4" ry="12"/>
          <ellipse cx="380" cy="290" rx="5" ry="15"/>
        </g>
        <!-- Granja -->
        <path d="M118 346 L150 330 L190 340 L190 360 L118 362 Z" fill="#b5602f"/>
        <path d="M112 347 L148 326 L196 338 L190 342 L150 334 L118 352 Z" fill="#7c3b20"/>
        <rect x="132" y="348" width="9" height="10" fill="#5a2a16"/><rect x="160" y="344" width="8" height="7" fill="#f6d67a"/>
        <!-- Arbustos -->
        <g fill="#3d7a2c"><circle cx="210" cy="388" r="14"/><circle cx="226" cy="396" r="11"/><circle cx="330" cy="398" r="16"/><circle cx="352" cy="404" r="12"/><circle cx="100" cy="392" r="12"/></g>
      </g>
      <!-- Sombra interior del borde y remaches -->
      <polygon points="${hex(176)}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="6"/>
      ${grommets}
    </svg>`;
  }

  return { LIST, byId, icon, use, appIcon, name: id => byId[id].name };
})();
