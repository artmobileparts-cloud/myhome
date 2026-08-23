/* =========================================================================
   ВШИВАНИЕ ШРИФТОВ В ПРИЛОЖЕНИЕ.

   Прототип тянет шрифты с серверов Google. В браузере это терпимо, в
   приложении — нет: его открывают с телефона в подъезде, где связи почти нет.
   Шрифт не пришёл — браузер подставил свой, другой ширины, и поехали переносы,
   высота карточек и вся раскладка. Это записано правилом в самом прототипе
   («⚠ ДЛЯ БОЯ: шрифты должны лежать ВНУТРИ приложения»).

   Скрипт скачивает шрифты, кладёт их в www/fonts и заменяет ссылку на сеть
   местным файлом. Запускается перед сборкой APK.

   Сеть — не повод ронять сборку: если Google недоступен, скрипт честно
   предупреждает и оставляет ссылку как была. Приложение тогда соберётся с
   сетевыми шрифтами (в прототипе прописаны явные запасные), но офлайн-раскладка
   уже не гарантирована.
   ========================================================================= */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const HTML = path.join(ROOT, 'www', 'index.html');
const FONT_DIR = path.join(ROOT, 'www', 'fonts');
const LOCAL_CSS = 'fonts/fonts.css';

/* woff2 отдают только современным браузерам — представляемся Chrome,
   иначе Google пришлёт ttf и приложение потяжелеет в разы. */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function warn(msg) {
  console.warn(`::warning::${msg}`);
}

async function get(url, asText) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return asText ? res.text() : Buffer.from(await res.arrayBuffer());
}

const html = await readFile(HTML, 'utf8');

if (html.includes(LOCAL_CSS)) {
  console.log('Шрифты уже вшиты — пропускаю.');
  process.exit(0);
}

/* Ссылка на набор шрифтов в прототипе одна; ищем её как есть, а не по имени
   семейства — так скрипт переживёт правку списка шрифтов в прототипе. */
const link = html.match(/<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"[^>]*>/);
if (!link) {
  warn('Ссылка на fonts.googleapis.com в www/index.html не найдена — вшивать нечего.');
  process.exit(0);
}

const cssUrl = link[1].replace(/&amp;/g, '&');

let css;
try {
  css = await get(cssUrl, true);
} catch (e) {
  warn(`Шрифты не скачались (${e.message}). Оставляю ссылку на сеть.`);
  process.exit(0);
}

await mkdir(FONT_DIR, { recursive: true });

const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) || [])];
if (!urls.length) {
  warn('В ответе Google нет ссылок на файлы шрифтов — оставляю ссылку на сеть.');
  process.exit(0);
}

let bytes = 0;
const named = new Map();

/* Качаем пачками: последовательно это сотни запросов и минуты ожидания,
   а без предела — отказ на той стороне. */
const QUEUE = [...urls];
const workers = Array.from({ length: 8 }, async () => {
  for (let url = QUEUE.pop(); url; url = QUEUE.pop()) {
    const name = path.basename(new URL(url).pathname);
    const data = await get(url, false);
    await writeFile(path.join(FONT_DIR, name), data);
    named.set(url, name);
    bytes += data.length;
  }
});

try {
  await Promise.all(workers);
} catch (e) {
  warn(`Часть шрифтов не скачалась (${e.message}). Оставляю ссылку на сеть.`);
  process.exit(0);
}

for (const [url, name] of named) css = css.split(url).join(name);
await writeFile(path.join(FONT_DIR, 'fonts.css'), css);

const local = `<link href="${LOCAL_CSS}" rel="stylesheet">`;
await writeFile(HTML, html.replace(link[0], local));

console.log(`Вшито ${named.size} файлов шрифтов, ${(bytes / 1048576).toFixed(1)} МБ.`);
