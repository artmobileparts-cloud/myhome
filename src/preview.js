/* =========================================================================
   ПРЕДПРОСМОТР — ВХОД БЕЗ СЕРВЕРА.

   Зачем он есть. Боевое приложение ходит за людьми и домами на сервер, а
   сервера пока нет: мир пустой, войти буквально не за кого — экран входа
   честно отвечает «номер не зарегистрирован». Посмотреть приложение изнутри
   без этой двери нельзя.

   Что делает. Спрашивает мастер-код, собирает демо-мир на два дома и сажает
   человека внутрь за выбранную роль. SMS при этом не спрашивается: телефон
   помечается доверенным до входа — тот же путь, что у loginAs в прототипе.

   ═══ ЭТО НЕ ЗАЩИТА ═══
   Мастер-код лежит внутри APK, и любой, кто разберёт файл, его увидит. Это
   вежливая дверь, а не замок: она держит случайного человека, а не того, кто
   захочет войти. Настоящая проверка личности — вход по SMS через сервер, и
   она появится вместе с сервером.

   ЭТОТ ФАЙЛ НИКОГДА НЕ ПОПАДАЕТ В РЕЛИЗНУЮ СБОРКУ: выемка подключает его
   только по ключу --preview и отказывается это делать для релиза.

   Весь предпросмотр живёт в одном файле — вместе со своими стилями. Так его
   видно целиком и так его нечем случайно оставить в боевой сборке по частям.
   ========================================================================= */
(function () {
  'use strict';

  var КОД = '__КОД__';                        /* подставляется выемкой при сборке */
  var ПАМЯТЬ = 'myhome.preview.unlocked';

  /* Прототип объявляет D и S как const в обычном <script>: в window они не
     попадают, но лексическая область у обычных скриптов общая. Берём голым
     именем через try — тем же приёмом, что и оболочка приложения. */
  function сцена() { try { return D; } catch (e) { return null; } }
  function мир() { try { return S; } catch (e) { return null; } }
  function функция(имя) {
    try { var f = eval(имя); return typeof f === 'function' ? f : null; } catch (e) { return null; }
  }

  if (!сцена()) return;
  var ДЕВ = сцена().res ? 'res' : Object.keys(сцена())[0];

  /* ------------------------------------------------------------------ стили */
  var стили = document.createElement('style');
  стили.textContent = [
    '#preview-gate{position:fixed;inset:0;z-index:2147483000;display:flex;',
    '  align-items:center;justify-content:center;padding:24px;',
    '  background:rgba(12,12,14,.72);backdrop-filter:blur(6px);',
    '  font:400 15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;}',
    '.pg-box{width:100%;max-width:380px;background:var(--surface,#fff);color:var(--ink,#0C0C0E);',
    '  border-radius:var(--r-l,24px);padding:22px;box-shadow:0 18px 50px rgba(12,12,14,.35);',
    '  max-height:100%;overflow-y:auto;}',
    '.pg-mark{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.08em;',
    '  text-transform:uppercase;color:var(--accent,#FF6A4D);margin-bottom:10px;}',
    '.pg-h{font-size:24px;font-weight:800;margin:0 0 6px;}',
    '.pg-s{font-size:14px;color:var(--ink-2,#4A4A52);margin:0 0 16px;}',
    '.pg-in{width:100%;box-sizing:border-box;font:600 20px/1 inherit;letter-spacing:.25em;',
    '  text-align:center;padding:14px;border:1px solid var(--line,#E4E4E8);',
    '  border-radius:var(--r-m,14px);background:var(--bg,#ECECED);color:inherit;}',
    '.pg-err{color:var(--danger,#E04B2F);font-size:13px;margin-top:8px;}',
    '.pg-btn{width:100%;margin-top:12px;padding:14px;border:0;border-radius:var(--r-m,14px);',
    '  background:var(--accent,#FF6A4D);color:#fff;font:700 16px/1 inherit;cursor:pointer;}',
    '.pg-role{width:100%;margin-top:8px;padding:14px 16px;text-align:start;cursor:pointer;',
    '  border:1px solid var(--line,#E4E4E8);border-radius:var(--r-m,14px);',
    '  background:var(--bg,#ECECED);color:inherit;font:inherit;display:block;}',
    '.pg-role b{display:block;font-size:16px;font-weight:700;}',
    '.pg-role span{display:block;font-size:13px;color:var(--ink-2,#4A4A52);margin-top:2px;}',
    '.pg-lnk{display:block;width:100%;margin-top:14px;padding:8px;border:0;background:none;',
    '  color:var(--ink-2,#4A4A52);font:500 14px/1.3 inherit;text-decoration:underline;cursor:pointer;}',
    '.pg-note{font-size:12px;line-height:1.4;color:var(--muted,#8B8B93);margin-top:14px;}',
    '#preview-badge{position:fixed;top:0;left:0;right:0;z-index:2147482000;pointer-events:none;',
    '  height:18px;box-sizing:content-box;',
    '  padding:calc(2px + env(safe-area-inset-top,0px)) 8px 0;text-align:center;',
    '  background:var(--accent,#FF6A4D);color:#fff;font:700 10px/18px system-ui,sans-serif;',
    '  letter-spacing:.06em;}',
    /* Полоска не должна накрывать шапку приложения: сначала она села поверх
       имени и адреса дома, и первая строка экрана читалась наполовину.
       Отодвигаем экран ровно на её высоту — правило идёт после prod.css,
       поэтому перебивает тамошний отступ безопасной зоны. */
    '.screen{padding-top:calc(env(safe-area-inset-top,0px) + 20px);}'
  ].join('');
  document.head.appendChild(стили);

  /* ------------------------------------------------------------------ люди */

  /* Ищем в собранном мире по признакам, а не по записанным заранее номерам:
     мир пересобирается при каждом запуске, и записанный номер устарел бы. */
  function люди() {
    var S0 = мир();
    if (!S0 || !S0.users) return [];
    var все = Object.keys(S0.users).map(function (k) { return S0.users[k]; });
    var спецы = (S0.spec && S0.spec.masters)
      ? Object.keys(S0.spec.masters).map(function (k) { return S0.spec.masters[k]; }) : [];

    var предс = все.filter(function (u) { return u.hatVaad && u.status === 'active' && u.phone; })[0];
    var жилец = все.filter(function (u) {
      return !u.hatVaad && u.status === 'active' && u.buildingId && u.phone;
    })[0];
    var мастер = спецы.filter(function (m) { return m.phone; })[0];

    var из = [];
    if (предс) из.push({ роль: 'Председатель ваада', под: 'Деньги дома, заявки, голосования', тел: предс.phone });
    if (жилец) из.push({ роль: 'Жилец', под: 'Взносы, доска соседей, заявки', тел: жилец.phone });
    if (мастер) из.push({ роль: 'Специалист', под: 'Кабинет мастера, отклики, подписка', тел: мастер.phone });
    return из;
  }

  function мирПуст() {
    var S0 = мир();
    return !S0 || !S0.buildings || Object.keys(S0.buildings).length === 0;
  }

  function собратьМир() {
    var f = функция('makeEnv');
    if (!f) return false;
    try { f(2, 10, 5); return true; } catch (e) { return false; }
  }

  /* --------------------------------------------------------------- разметка */
  var корень = null;

  function закрыть() { if (корень) { корень.remove(); корень = null; } }

  function холст(нутро) {
    закрыть();
    корень = document.createElement('div');
    корень.id = 'preview-gate';
    корень.innerHTML = '<div class="pg-box">' + нутро + '</div>';
    document.body.appendChild(корень);
  }

  function обычныйВход(id) {
    var b = document.getElementById(id);
    if (b) b.onclick = закрыть;
  }

  function экранКода(ошибка) {
    холст(
      '<div class="pg-mark">предпросмотр</div>' +
      '<div class="pg-h">Мой Дом</div>' +
      '<div class="pg-s">Сервера пока нет. Введите мастер-код, чтобы посмотреть ' +
        'приложение на собранном демо-мире.</div>' +
      '<input class="pg-in" id="pg-code" inputmode="numeric" autocomplete="off" placeholder="код">' +
      (ошибка ? '<div class="pg-err">Код не подошёл</div>' : '') +
      '<button class="pg-btn" id="pg-go">Войти</button>' +
      '<button class="pg-lnk" id="pg-real">Обычный вход по номеру телефона</button>' +
      '<div class="pg-note">Мастер-код лежит внутри приложения и защитой не является. ' +
        'Настоящая проверка личности — вход по SMS через сервер.</div>');

    var поле = document.getElementById('pg-code');
    поле.focus();
    поле.addEventListener('keydown', function (e) { if (e.key === 'Enter') проверить(); });
    document.getElementById('pg-go').onclick = проверить;
    обычныйВход('pg-real');

    function проверить() {
      if (String(поле.value).trim() !== КОД) { экранКода(true); return; }
      try { localStorage.setItem(ПАМЯТЬ, '1'); } catch (e) {}
      экранРолей();
    }
  }

  function экранРолей() {
    if (мирПуст() && !собратьМир()) {
      холст('<div class="pg-h">Мир не собрался</div>' +
            '<div class="pg-s">Сборщик демо-мира не подключён к этой сборке.</div>' +
            '<button class="pg-btn" id="pg-real2">Обычный вход по номеру</button>');
      обычныйВход('pg-real2');
      return;
    }

    var список = люди();
    if (!список.length) {
      холст('<div class="pg-h">Некого посадить</div>' +
            '<div class="pg-s">Мир собрался, но людей с телефонами в нём не нашлось.</div>' +
            '<button class="pg-btn" id="pg-real4">Обычный вход по номеру</button>');
      обычныйВход('pg-real4');
      return;
    }

    холст(
      '<div class="pg-mark">предпросмотр</div>' +
      '<div class="pg-h">За кого войти</div>' +
      '<div class="pg-s">Собран демо-мир на два дома. Роль меняется выходом из аккаунта.</div>' +
      список.map(function (ч, i) {
        return '<button class="pg-role" data-i="' + i + '"><b>' + ч.роль + '</b>' +
               '<span>' + ч.под + '</span></button>';
      }).join('') +
      '<button class="pg-lnk" id="pg-real3">Обычный вход по номеру телефона</button>');

    обычныйВход('pg-real3');
    Array.prototype.forEach.call(корень.querySelectorAll('.pg-role'), function (b) {
      b.onclick = function () {
        var ч = список[+b.getAttribute('data-i')];
        закрыть();
        var f = функция('loginAs');
        if (f) f(ДЕВ, ч.тел);
      };
    });
  }

  /* Метка сборки: чтобы предпросмотр никогда не спутали с боевым приложением.
     Висит поверх всего и уходит только вместе со сборкой. */
  var метка = document.createElement('div');
  метка.id = 'preview-badge';
  метка.textContent = 'ПРЕДПРОСМОТР · без сервера';
  document.body.appendChild(метка);

  var открыт = false;
  try { открыт = localStorage.getItem(ПАМЯТЬ) === '1'; } catch (e) {}
  if (открыт) экранРолей(); else экранКода(false);
})();
