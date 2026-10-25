// 🖼️ Imagen de la clasificación para el grupo: se dibuja en un <canvas> (1080 px de ancho,
// formato de historia/foto) y se comparte como PNG o se descarga.
const Img = (() => {
  const W = 1080;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw(state, key) {
    const mode = state.settings.seasonMode;
    const games = Stats.valid(state.games);
    const rows = Stats.seasonRanking(games, state.players, key, mode);
    const total = Stats.legacyTotal(key, mode) + Stats.inSeason(games, key, mode).length;
    const label = key === 'all' ? 'HISTÓRICO' : /^\d+$/.test(key) ? key : Stats.seasonLabel(key).toUpperCase();
    const rowH = 150;
    const H = 520 + rows.length * rowH + 170;

    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const font = (w, s) => `${w} ${s}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    const serif = (w, s) => `${w} ${s}px Georgia, "Times New Roman", serif`;

    // Fondo
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#b5462a');
    bg.addColorStop(1, '#4a1a0e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // Hexágonos decorativos
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#fff';
    for (const [x, y, r] of [[930, 140, 160], [120, H - 160, 200], [980, H - 300, 90]]) {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k - Math.PI / 6;
        ctx[k ? 'lineTo' : 'moveTo'](x + r * Math.cos(a), y + r * Math.sin(a));
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Cabecera
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8b84a';
    ctx.font = font('700', 44);
    ctx.fillText('✨ LIGA DE CATANES ✨', W / 2, 140);
    ctx.fillStyle = '#fff';
    ctx.font = serif('800', 170);
    ctx.fillText(label, W / 2, 310);
    ctx.font = font('500', 40);
    ctx.globalAlpha = 0.85;
    ctx.fillText(`${total} ${total === 1 ? 'partida' : 'partidas'}`, W / 2, 380);
    ctx.globalAlpha = 1;

    // Filas
    rows.forEach((r, i) => {
      const y = 440 + i * rowH;
      const first = r.rank === 1 && r.wins > 0;
      ctx.fillStyle = first ? 'rgba(232, 184, 74, 0.95)' : 'rgba(255, 255, 255, 0.12)';
      roundRect(ctx, 70, y, W - 140, rowH - 24, 28);
      ctx.fill();

      const ink = first ? '#2b2118' : '#fff';
      ctx.textAlign = 'left';
      ctx.font = font('400', 64);
      ctx.fillStyle = ink;
      ctx.fillText(Stats.rowMedal(rows, r) || '·', 110, y + 88);
      ctx.font = font(r.guest ? 'italic 600' : '700', 56);
      ctx.fillText(Stats.who(r.name), 210, y + 84);
      ctx.textAlign = 'right';
      ctx.font = serif('800', 68);
      ctx.fillText(Stats.toRoman(r.wins), W - 110, y + 88);
    });

    // Pie
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.6;
    ctx.font = font('500', 32);
    ctx.fillText(`⬡ Catán Tracker · ${Stats.fmtDate(Stats.today())}`, W / 2, H - 70);
    ctx.globalAlpha = 1;
    return c;
  }

  // Imagen → archivo sin esperas (toDataURL es síncrono): Safari/iOS solo deja compartir si
  // navigator.share se llama justo tras el toque. JPEG: ~5 veces más ligero que PNG.
  function toFile(canvas, name) {
    const data = canvas.toDataURL('image/jpeg', 0.9);
    const bin = atob(data.split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name, { type: 'image/jpeg' });
  }

  async function share(key) {
    const s = Storage.get();
    const file = toFile(draw(s, key), `liga-catanes-${key}.jpg`);
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    App.toast('🖼️ Imagen descargada');
  }

  return { draw, share };
})();
