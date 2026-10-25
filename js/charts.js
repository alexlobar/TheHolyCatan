// Gráficos SVG sin dependencias. Los colores salen de variables CSS (--p1…--p4 por jugador,
// --chart-*), así que cambian solos con el modo oscuro.
const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const { esc } = Stats;

  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    parent?.appendChild(n);
    return n;
  }

  // Marcas del eje Y: enteros "redondos" (1, 2, 5, 10…) hasta cubrir el máximo.
  function yTicks(max) {
    const step = [1, 2, 5, 10, 20, 50, 100].find(s => max / s <= 4) || Math.ceil(max / 4);
    const top = Math.max(step, Math.ceil(max / step) * step);
    const out = [];
    for (let v = 0; v <= top; v += step) out.push(v);
    return { ticks: out, top };
  }

  // Tooltip HTML posicionado dentro del contenedor (que debe ser position: relative).
  function tooltip(box) {
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.hidden = true;
    box.appendChild(tip);
    return {
      show(html, x, y) {
        tip.innerHTML = html;
        tip.hidden = false;
        const w = tip.offsetWidth;
        const left = Math.min(Math.max(x - w / 2, 0), box.clientWidth - w);
        tip.style.left = `${left}px`;
        tip.style.top = `${Math.max(0, y - tip.offsetHeight - 10)}px`;
      },
      hide() { tip.hidden = true; },
    };
  }

  /* Líneas: victorias acumuladas.
     series: [{ name, color (CSS), values: [n…] }], label(i) → texto del punto i. */
  function lines(box, { series, label, ariaLabel }) {
    box.innerHTML = '';
    const W = Math.max(280, box.clientWidth);
    const H = 230;
    const m = { top: 12, right: 92, bottom: 26, left: 30 };
    const n = series[0].values.length;
    const max = Math.max(1, ...series.flatMap(s => s.values));
    const { ticks, top } = yTicks(max);
    const x = i => m.left + (n === 1 ? 0 : (i / (n - 1)) * (W - m.left - m.right));
    const y = v => m.top + (1 - v / top) * (H - m.top - m.bottom);

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': ariaLabel, class: 'chart' }, box);

    // Rejilla y eje Y discretos.
    for (const t of ticks) {
      el('line', { x1: m.left, x2: W - m.right, y1: y(t), y2: y(t), class: t ? 'grid' : 'axis' }, svg);
      el('text', { x: m.left - 8, y: y(t) + 4, 'text-anchor': 'end', class: 'tick' }, svg).textContent = t;
    }
    // Eje X: primera y última partida.
    el('text', { x: x(0), y: H - 6, 'text-anchor': 'start', class: 'tick' }, svg).textContent = label(0, true);
    if (n > 1) el('text', { x: x(n - 1), y: H - 6, 'text-anchor': 'end', class: 'tick' }, svg).textContent = label(n - 1, true);

    // Líneas (2px) y marcador final (8px con anillo del color de la tarjeta).
    for (const s of series) {
      el('polyline', {
        points: s.values.map((v, i) => `${x(i)},${y(v)}`).join(' '),
        fill: 'none', style: `stroke:${s.color}`, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
      }, svg);
      el('circle', { cx: x(n - 1), cy: y(s.values[n - 1]), r: 4, style: `fill:${s.color}`, class: 'ring' }, svg);
    }

    // Etiquetas directas al final de cada línea (texto en tinta, no en el color), sin solaparse.
    const ends = series.map(s => ({ s, v: s.values[n - 1], ly: y(s.values[n - 1]) })).sort((a, b) => a.ly - b.ly);
    for (let i = 1; i < ends.length; i++) ends[i].ly = Math.max(ends[i].ly, ends[i - 1].ly + 15);
    const overflow = ends.length ? ends[ends.length - 1].ly - (H - m.bottom) : 0;
    if (overflow > 0) ends.forEach(e => { e.ly -= overflow; });
    for (const e of ends) {
      const t = el('text', { x: x(n - 1) + 10, y: e.ly + 4, class: 'end-label' }, svg);
      t.textContent = `${e.s.name} ${Stats.toRoman(e.v)}`;
    }

    // Capa de interacción: cruz vertical + tooltip con el valor de cada jugador.
    const cross = el('line', { y1: m.top, y2: H - m.bottom, class: 'crosshair', visibility: 'hidden' }, svg);
    const dots = series.map(s => el('circle', { r: 4, style: `fill:${s.color}`, class: 'ring', visibility: 'hidden' }, svg));
    const hit = el('rect', { x: m.left - 10, y: 0, width: W - m.left - m.right + 20, height: H, fill: 'transparent' }, svg);
    const tip = tooltip(box);

    const move = ev => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - m.left) / (W - m.left - m.right)) * (n - 1))));
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
      cross.setAttribute('visibility', 'visible');
      series.forEach((s, k) => {
        dots[k].setAttribute('cx', x(i)); dots[k].setAttribute('cy', y(s.values[i]));
        dots[k].setAttribute('visibility', 'visible');
      });
      const rows = series.map(s => ({ s, v: s.values[i] })).sort((a, b) => b.v - a.v)
        .map(({ s, v }) => `<div class="tip-row"><span class="sw" style="background:${s.color}"></span>${esc(s.name)}<b>${v}</b></div>`).join('');
      tip.show(`<div class="tip-title">${esc(label(i, false))}</div>${rows}`, (x(i) / W) * r.width, (m.top / H) * r.height + 8);
    };
    const leave = () => {
      cross.setAttribute('visibility', 'hidden');
      dots.forEach(d => d.setAttribute('visibility', 'hidden'));
      tip.hide();
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') leave(); });
    svg.addEventListener('click', e => { if (e.target !== hit) leave(); });
  }

  /* Barras: tiradas de 2d6 frente a lo esperado. data: [{ sum, n, expected }]. */
  function dice(box, data, ariaLabel) {
    box.innerHTML = '';
    const W = Math.max(280, box.clientWidth);
    const H = 170;
    const m = { top: 10, right: 6, bottom: 22, left: 26 };
    const max = Math.max(1, ...data.map(d => Math.max(d.n, d.expected)));
    const { ticks, top } = yTicks(max);
    const band = (W - m.left - m.right) / data.length;
    const bw = Math.min(28, band - 2); // 2px de separación como mínimo
    const y = v => m.top + (1 - v / top) * (H - m.top - m.bottom);
    const base = y(0);

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': ariaLabel, class: 'chart' }, box);
    for (const t of ticks) {
      el('line', { x1: m.left, x2: W - m.right, y1: y(t), y2: y(t), class: t ? 'grid' : 'axis' }, svg);
      el('text', { x: m.left - 6, y: y(t) + 4, 'text-anchor': 'end', class: 'tick' }, svg).textContent = t;
    }
    const tip = tooltip(box);
    const maxN = Math.max(...data.map(d => d.n));

    data.forEach((d, i) => {
      const cx = m.left + band * i + band / 2;
      if (d.n > 0) {
        // Barra con extremo superior redondeado (4px) y apoyada en la base.
        const h = base - y(d.n);
        const r = Math.min(4, h, bw / 2);
        const x0 = cx - bw / 2;
        el('path', {
          d: `M${x0},${base} V${base - h + r} Q${x0},${base - h} ${x0 + r},${base - h} H${x0 + bw - r} Q${x0 + bw},${base - h} ${x0 + bw},${base - h + r} V${base} Z`,
          class: d.n === maxN ? 'bar top' : 'bar',
        }, svg);
      }
      // Marca de lo esperado por probabilidad.
      if (d.expected > 0) el('line', { x1: cx - bw / 2 - 2, x2: cx + bw / 2 + 2, y1: y(d.expected), y2: y(d.expected), class: 'expected' }, svg);
      el('text', { x: cx, y: H - 6, 'text-anchor': 'middle', class: d.sum === 7 ? 'tick strong' : 'tick' }, svg).textContent = d.sum;

      const hit = el('rect', { x: cx - band / 2, y: 0, width: band, height: H, fill: 'transparent' }, svg);
      const show = () => {
        const r = svg.getBoundingClientRect();
        tip.show(`<div class="tip-title">Suma ${d.sum}</div>
          <div class="tip-row">Han salido<b>${d.n}</b></div>
          <div class="tip-row">Esperado<b>${d.expected.toFixed(1).replace('.', ',')}</b></div>`,
          (cx / W) * r.width, (y(Math.max(d.n, d.expected)) / H) * r.height);
      };
      hit.addEventListener('pointerenter', show);
      hit.addEventListener('pointerdown', show);
      hit.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') tip.hide(); });
    });
  }

  return { lines, dice };
})();
