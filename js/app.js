// Arranque, navegación por pestañas, ajustes y utilidades comunes.
const App = (() => {
  const $ = sel => document.querySelector(sel);
  let toastTimer;

  function init() {
    Storage.load();
    Tracker.init();
    Tables.init();
    initTabs();
    initSettings();
    initInstall();
  }

  // Instalación como app: service worker (offline) + botón en Android + instrucciones en iOS.
  function initInstall() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('./sw.js').catch(e => console.warn('Service worker no registrado', e));
    }

    const status = $('#install-status');
    const btn = $('#install-btn');
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (standalone) {
      status.textContent = '✔ Ya estás usando la app instalada.';
    } else if (ios) {
      status.innerHTML = 'iPhone / iPad: abre esta página en <b>Safari</b>, pulsa <b>Compartir</b> (el cuadrado con la flecha ↑) y elige <b>Añadir a pantalla de inicio</b>.';
    } else {
      status.innerHTML = 'Android: en Chrome, abre el menú <b>⋮</b> → <b>Instalar aplicación</b> (o <b>Añadir a pantalla de inicio</b>). Si aparece el botón de abajo, también sirve.';
    }

    let deferred = null;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferred = e;
      btn.hidden = false;
    });
    btn.addEventListener('click', async () => {
      if (!deferred) return;
      btn.hidden = true;
      deferred.prompt();
      await deferred.userChoice;
      deferred = null;
    });
    window.addEventListener('appinstalled', () => {
      btn.hidden = true;
      status.textContent = '✔ App instalada. Ábrela desde la pantalla de inicio.';
    });
  }

  function initTabs() {
    const buttons = document.querySelectorAll('.tabbar button');
    const show = view => {
      buttons.forEach(b => b.classList.toggle('active', b.dataset.view === view));
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
      try { localStorage.setItem('catan-app-tab', view); } catch {}
      window.scrollTo(0, 0);
    };
    buttons.forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
    let last = null;
    try { last = localStorage.getItem('catan-app-tab'); } catch {}
    if (last && $(`#view-${last}`)) show(last);
  }

  function initSettings() {
    $('#export-btn').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(Storage.get(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `catan-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000); // en Safari/iOS revocarlo al instante cancela la descarga
    });

    $('#import-file').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        Storage.replace(JSON.parse(await file.text()));
        Tracker.resetForm();
        Tracker.render();
        Tables.render();
        toast('Datos importados ✔');
      } catch {
        toast('Ese archivo no es una copia válida');
      }
      e.target.value = '';
    });

    $('#reset-games').addEventListener('click', () => {
      if (confirm('¿Borrar TODAS las partidas? No se puede deshacer.')) {
        Tracker.clearAll();
        toast('Historial borrado');
      }
    });

    $('#reset-decks').addEventListener('click', () => {
      if (confirm('¿Volver a las cartas originales de las 3 tablas? Se perderán las cartas añadidas o editadas.')) {
        Tables.reset();
        toast('Tablas restauradas');
      }
    });
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  document.addEventListener('DOMContentLoaded', init);
  return { toast };
})();
