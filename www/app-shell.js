/* =========================================================================
   ОБОЛОЧКА ANDROID-ПРИЛОЖЕНИЯ — надстройка над прототипом, сам прототип не трогаем.
   Файл подключается последним и работает ТОЛЬКО внутри приложения (Capacitor).
   В браузере он молча ничего не делает — прототип остаётся прежним.

   Зачем нужен: в прототипе нет истории браузера (ни pushState, ни hash), а у
   Android есть железная кнопка «Назад». Без перехвата первое же её нажатие
   закрывало бы приложение с любого экрана — человек теряет место, где был.
   ========================================================================= */
(function () {
  'use strict';

  var Cap = window.Capacitor;
  if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;
  var App = Cap.Plugins && Cap.Plugins.App;
  if (!App) return;

  /* --- какой телефон на сцене трогали последним -------------------------
     Прототип — это сцена с несколькими устройствами (vaad, res, admin, mas),
     у каждого свой экран и своя стопка переходов. «Назад» обязан вернуться
     в том устройстве, где человек только что работал, а не в первом попавшемся. */
  var lastDev = null;

  /* Прототип объявляет свою сцену как `const D = {...}` в обычном <script>.
     const на верхнем уровне НЕ кладётся в window — но лексическая область у
     обычных скриптов общая, поэтому берём голым именем через try. */
  function scene() { try { return D; } catch (e) { return null; } }
  function navBackFn() { try { return navBack; } catch (e) { return null; } }

  document.addEventListener('pointerdown', function (e) {
    var host = e.target && e.target.closest ? e.target.closest('[id^="app-"]') : null;
    if (host) lastDev = host.id.slice(4);
  }, true);

  function activeDev() {
    var d = scene();
    if (!d) return null;
    if (lastDev && d[lastDev]) return lastDev;
    /* иначе — первое устройство, где приложение вообще открыто */
    for (var k in d) if (d[k] && d[k].open) return k;
    for (var k2 in d) if (d[k2] && d[k2].screen) return k2;
    return null;
  }

  /* --- двойное нажатие для выхода ---------------------------------------
     Уйти из приложения можно, но не случайно: первое нажатие на корневом
     экране показывает подсказку, второе в течение 2 секунд закрывает. */
  var armed = 0;

  function hint() {
    var el = document.getElementById('shell-exit-hint');
    if (!el) {
      el = document.createElement('div');
      el.id = 'shell-exit-hint';
      el.setAttribute('dir', 'auto');
      el.style.cssText =
        'position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));' +
        'transform:translateX(-50%);z-index:2147483647;pointer-events:none;' +
        'background:rgba(12,12,14,.92);color:#fff;padding:10px 16px;border-radius:14px;' +
        'font:500 14px/1.3 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;' +
        'box-shadow:0 6px 24px rgba(12,12,14,.35);opacity:0;transition:opacity .18s';
      el.textContent = 'Нажмите «Назад» ещё раз, чтобы выйти';
      document.body.appendChild(el);
    }
    el.style.opacity = '1';
    clearTimeout(hint.t);
    hint.t = setTimeout(function () { el.style.opacity = '0'; }, 1800);
  }

  App.addListener('backButton', function () {
    /* 1. Окно поверх экрана закрывается первым — тот же закон, что и у
          экранной стрелки прототипа (см. navBack в прототипе). */
    var dev = activeDev();
    var d = scene();
    var st = dev && d ? d[dev] : null;
    var back = navBackFn();

    if (st && typeof back === 'function') {
      var stack = st.nav || [];
      var overlay = st.shot || st.waShow || st.sheet;
      var atRoot = !overlay && stack.length === 0 &&
                   (!st.open || st.screen === 'home' || st.screen === 'fork');

      if (!atRoot) {
        armed = 0;
        try { back(dev, 'home'); return; } catch (e) { /* падать в выход нельзя */ }
      }
    }

    /* 2. Корень — двойное нажатие. */
    var now = Date.now();
    if (now - armed < 2000) { App.exitApp(); return; }
    armed = now;
    hint();
  });

  /* --- внешние ссылки открываем в браузере телефона ----------------------
     Внутри приложения живёт только прототип; сайт мэрии или переход в WhatsApp
     должен уходить наружу, а не подменять собой приложение без пути назад. */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) return;               /* tel:, mailto:, # — не наше дело */
    if (a.target === '_blank') return;                     /* Capacitor уже уводит такие наружу */
    e.preventDefault();
    window.open(href, '_blank');
  }, true);
})();
