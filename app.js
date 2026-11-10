/* Снэпбилд · конструктор иллюстраций
 * Композиция собирается ТОЛЬКО из исходных SVG-объектов библиотеки (library/*.svg).
 * Объекты не меняются: мы лишь ставим их на холст (translate/rotate/scale) и подменяем цвета по ролям палитры.
 */
(() => {
'use strict';

const SVGNS = 'http://www.w3.org/2000/svg';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- Палитры ----------
 * Объекты в Figma нарисованы в схеме «Лаванда». Каждый исходный цвет — это роль:
 * bg1..bg3 — цвета фона (можно и в объектах), obj1..obj3 — цвета объектов (в фонах нельзя), ink, paper.
 */
const ROLES = ['bg1', 'bg2', 'bg3', 'obj1', 'obj2', 'obj3', 'ink', 'paper'];
const BASE = { bg1: '#D7CDF5', bg2: '#AA9BF0', bg3: '#7864D7', obj1: '#F9ECB0', obj2: '#F9A3AA', obj3: '#FFE3E1', ink: '#181817', paper: '#FFFFFF' };
const COLOR_TO_ROLE = Object.fromEntries(Object.entries(BASE).map(([r, c]) => [c, r]));
COLOR_TO_ROLE.WHITE = 'paper'; COLOR_TO_ROLE['#FFF'] = 'paper';
COLOR_TO_ROLE.BLACK = 'ink'; COLOR_TO_ROLE['#000000'] = 'ink';

const PALETTES = [
  { id: 'lavender', name: 'Лаванда', bg: ['#D7CDF5', '#AA9BF0', '#7864D7'], obj: ['#F9ECB0', '#F9A3AA', '#FFE3E1'] },
  { id: 'peach', name: 'Персик', bg: ['#FDD7B9', '#FAC896', '#D27532'], obj: ['#F9ECB0', '#80DADA', '#BEEBEB'] },
  { id: 'mint', name: 'Мята', bg: ['#BEEBEB', '#80DADA', '#5ABEBE'], obj: ['#FFD4F2', '#6D7BFC', '#B6C6FE'] },
];
const paletteMap = p => ({ bg1: p.bg[0], bg2: p.bg[1], bg3: p.bg[2], obj1: p.obj[0], obj2: p.obj[1], obj3: p.obj[2], ink: p.ink || '#181817', paper: p.paper || '#FFFFFF' });

/* ---------- Подбор объектов по смыслу ----------
 * Словарь ассоциаций: основа слова → объекты с весами. Составлен вручную с помощью Claude.
 * Работает без сервера и без ключей API, поэтому сервис можно открыть по ссылке и сразу пользоваться.
 */
const ASSOC = [
  [['деньг', 'финанс', 'зарплат', 'кредит', 'ипотек', 'налог', 'бюджет', 'копи', 'накоп', 'сбереж', 'инвест', 'доход', 'прибыл', 'банк', 'вклад', 'долг', 'экономи', 'рубл', 'капитал', 'пенси'], { coin: 3, wallet: 3, phone: 1, folder: 1 }, 'деньги и финансы'],
  [['покуп', 'шопинг', 'магазин', 'скидк', 'кэшбэк', 'кешбэк', 'бонус', 'оплат', 'плат', 'цен', 'распродаж', 'карт', 'заказ', 'доставк'], { wallet: 3, coin: 2, phone: 2 }, 'покупки и оплата'],
  [['учеб', 'учёб', 'обуч', 'курс', 'школ', 'студен', 'экзамен', 'знани', 'урок', 'универ', 'лекци', 'книг', 'чтени', 'чита', 'библиот', 'образован', 'навык', 'учи'], { book: 3, pen: 2, lamp: 2, headphones: 1 }, 'учёба и знания'],
  [['работ', 'офис', 'проект', 'карьер', 'дедлайн', 'задач', 'бизнес', 'компани', 'менеджм', 'сотрудник', 'рабоч', 'продуктив', 'тайм', 'план'], { folder: 3, pen: 2, lamp: 2, phone: 1 }, 'работа и проекты'],
  [['документ', 'договор', 'отчет', 'отчёт', 'бумаг', 'архив', 'справк', 'заявлени', 'бюрократ', 'юрид', 'подпис', 'контракт', 'файл'], { folder: 3, pen: 3, book: 1 }, 'документы'],
  [['иде', 'креатив', 'вдохнов', 'стартап', 'изобрет', 'придума', 'творч', 'дизайн', 'мысл', 'озарен', 'гипотез'], { lamp: 3, puzzle: 2, pen: 2 }, 'идеи и творчество'],
  [['команд', 'партнер', 'партнёр', 'сотрудн', 'решени', 'интеграц', 'вмест', 'совмест', 'логик', 'стратег', 'головолом', 'задач', 'связк', 'объедин'], { puzzle: 3, phone: 1, book: 1 }, 'решения и командная работа'],
  [['музык', 'подкаст', 'звук', 'аудио', 'слуш', 'песн', 'плейлист', 'вебинар', 'концентрац', 'фокус', 'тишин'], { headphones: 3, phone: 2, lamp: 1 }, 'звук и концентрация'],
  [['поддержк', 'клиент', 'звон', 'связ', 'колл', 'оператор', 'сервис', 'помощ', 'консульт', 'чат', 'вопрос'], { headphones: 3, phone: 3, puzzle: 1 }, 'связь и поддержка'],
  [['онлайн', 'приложен', 'цифров', 'интернет', 'соцсет', 'смартфон', 'телефон', 'мобил', 'уведомлен', 'сообщен', 'нейросет', 'ии ', 'ai', 'технолог', 'гаджет', 'сайт'], { phone: 3, headphones: 1, puzzle: 1 }, 'цифровое и онлайн'],
  [['подар', 'праздн', 'поздрав', 'весн', 'март', 'забот', 'благодар', 'любов', 'отношен', 'семь', 'мам', 'юбиле', 'свадьб', 'день рожд', 'цвет'], { flowers: 3, wallet: 1, pen: 1 }, 'праздник и забота'],
  [['дом', 'уют', 'отдых', 'выходн', 'хобби', 'вечер', 'ноч', 'спокой', 'отпуск', 'путешеств', 'лет', 'релакс'], { flowers: 2, lamp: 2, headphones: 2, book: 1 }, 'отдых и уют'],
  [['безопас', 'защит', 'надежн', 'надёжн', 'хранен', 'конфиден'], { folder: 2, wallet: 2, phone: 1 }, 'надёжность и хранение'],
];
// Названия объектов для сценария «по списку»: основы слов.
const NAMES = {
  book: ['книг', 'книж', 'блокнот', 'тетрад'], phone: ['телефон', 'смартфон', 'мобил', 'айфон'], puzzle: ['пазл', 'головолом'],
  coin: ['монет', 'деньг', 'рубл'], headphones: ['наушник'], lamp: ['ламп', 'светильник'], flowers: ['цвет', 'ваз', 'букет', 'тюльпан'],
  wallet: ['кошел', 'кошёл', 'бумажник'], folder: ['папк', 'документ'], pen: ['ручк', 'карандаш'],
};
const IDEA_EXAMPLES = ['Как накопить на отпуск', 'Онлайн-курс для начинающих', 'Служба поддержки 24/7', 'Подарок к 8 марта', 'Работа с документами без стресса', 'Идея для стартапа'];
const FALLBACK = ['book', 'lamp', 'pen'];

/* ---------- Форматы и шаблоны раскладки ----------
 * Область — доли ширины/высоты холста. Для широких форматов «под заголовок» оставляет левую часть свободной,
 * для квадратных и вертикальных — верхнюю.
 */
function templateArea(tpl, w, h) {
  const wide = w / h > 1.3;
  if (tpl === 'title') return wide ? { area: [0.47, 0.1, 0.96, 0.92], guide: [0.05, 0.3, 0.42, 0.7] } : { area: [0.06, 0.42, 0.94, 0.95], guide: [0.08, 0.07, 0.92, 0.34] };
  if (tpl === 'offset') return { area: wide ? [0.03, 0.08, 0.97, 0.94] : [0.05, 0.08, 0.95, 0.94] };
  return { area: wide ? [0.1, 0.06, 0.9, 0.94] : [0.07, 0.12, 0.93, 0.88] };
}

/* ---------- Состояние ---------- */
const state = {
  lib: null,                     // library.json
  tpl: 'title', size: 'L', fmt: [1200, 630], withBg: true, guide: true,
  palette: PALETTES[0], customPalettes: [],
  items: [],                     // {uid, obj, kind, x, y, rot, s}
  selected: null, seed: 1, last: null, libKind: 'main',
};
let uidCounter = 1;
const cache = new Map();          // file -> {vb:[x,y,w,h], node:SVGGElement}

const els = {
  svg: $('#canvas'), scene: $('#scene'), overlay: $('#overlay'), guides: $('#guides'),
  explain: $('#explain'), layers: $('#layers'), library: $('#library'),
};

/* ---------- Загрузка библиотеки ---------- */
async function loadLibrary() {
  const res = await fetch('library/library.json');
  state.lib = await res.json();
  state.byKey = {};
  for (const it of state.lib.items) state.byKey[`${it.object}|${it.kind}|${it.size}`] = it;
}
function libItem(obj, kind, size = state.size) { return state.byKey[`${obj}|${kind}|${size}`]; }
// «Эталонная» ширина объекта — по размеру L, чтобы L и S занимали на холсте одинаковое место.
function refSize(obj, kind) { const it = libItem(obj, kind, 'L'); return [it.width, it.height]; }

async function loadSvg(file) {
  if (cache.has(file)) return cache.get(file);
  const text = await (await fetch(file)).text();
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const root = doc.documentElement;
  const vb = root.getAttribute('viewBox').split(/\s+/).map(Number);
  const g = document.importNode(root.querySelector('g'), true);
  // Запоминаем роль каждого цвета, чтобы перекрашивать без потерь.
  g.querySelectorAll('*').forEach(n => {
    for (const a of ['fill', 'stroke']) {
      const v = n.getAttribute(a);
      if (!v || v === 'none' || v.startsWith('url')) continue;
      const role = COLOR_TO_ROLE[v.toUpperCase()];
      if (role) n.setAttribute(`data-${a}`, role);
    }
  });
  const entry = { vb, node: g };
  cache.set(file, entry);
  return entry;
}
async function preload(list) { await Promise.all(list.map(({ obj, kind }) => loadSvg(libItem(obj, kind).file))); }

/* ---------- Отрисовка ---------- */
function colorsNow() { return paletteMap(state.palette); }

function renderScene() {
  const [W, H] = state.fmt;
  els.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  fitCanvas();
  const c = colorsNow();
  const frag = document.createDocumentFragment();
  const bg = document.createElementNS(SVGNS, 'rect');
  Object.entries({ id: 'background', x: 0, y: 0, width: W, height: H, fill: c.bg1 }).forEach(([k, v]) => bg.setAttribute(k, v));
  frag.appendChild(bg);
  for (const it of state.items) {
    const entry = cache.get(libItem(it.obj, it.kind).file);
    if (!entry) continue;
    const [vx, vy, vw, vh] = entry.vb;
    const [rw] = refSize(it.obj, it.kind);
    const k = it.s * rw / vw;
    const outer = document.createElementNS(SVGNS, 'g');
    outer.setAttribute('class', 'item');
    outer.setAttribute('data-uid', it.uid);
    outer.setAttribute('id', `${it.obj}-${it.kind}-${it.uid}`);
    outer.setAttribute('transform', `translate(${r2(it.x)} ${r2(it.y)}) rotate(${r2(it.rot)}) scale(${r4(k)})`);
    const inner = entry.node.cloneNode(true);
    inner.setAttribute('transform', `translate(${r2(-vx - vw / 2)} ${r2(-vy - vh / 2)})`);
    inner.querySelectorAll('[data-fill]').forEach(n => n.setAttribute('fill', c[n.getAttribute('data-fill')]));
    inner.querySelectorAll('[data-stroke]').forEach(n => n.setAttribute('stroke', c[n.getAttribute('data-stroke')]));
    outer.appendChild(inner);
    frag.appendChild(outer);
  }
  els.scene.replaceChildren(frag);
  renderGuides(); renderOverlay(); renderLayers();
  $('#format-label').textContent = `${W} × ${H}`;
  $('#count-label').textContent = plural(state.items.length, 'объект', 'объекта', 'объектов');
  $('#undo').disabled = history.past.length === 0;
  $('#redo').disabled = history.future.length === 0;
}

// Холст вписывается в доступное место с сохранением пропорций формата.
function fitCanvas() {
  const [W, H] = state.fmt;
  const wrap = $('#canvas-wrap');
  const cs = getComputedStyle(wrap);
  const availW = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const stacked = window.matchMedia('(max-width:1100px)').matches;
  const availH = stacked ? window.innerHeight * 0.7 : wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const k = Math.max(0.05, Math.min(availW / W, availH / H));
  els.svg.style.width = Math.floor(W * k) + 'px';
  els.svg.style.height = Math.floor(H * k) + 'px';
}

function itemBox(it) {
  const entry = cache.get(libItem(it.obj, it.kind).file);
  const [, , vw, vh] = entry.vb;
  const [rw] = refSize(it.obj, it.kind);
  const k = it.s * rw / vw;
  return { w: vw * k, h: vh * k };
}

function renderGuides() {
  els.guides.replaceChildren();
  if (!state.guide || state.tpl !== 'title') return;
  const [W, H] = state.fmt;
  const g = templateArea('title', W, H).guide;
  const r = document.createElementNS(SVGNS, 'rect');
  const x = g[0] * W, y = g[1] * H, w = (g[2] - g[0]) * W, h = (g[3] - g[1]) * H;
  Object.entries({ x, y, width: w, height: h, rx: 12, class: 'guide-rect' }).forEach(([k, v]) => r.setAttribute(k, v));
  const t = document.createElementNS(SVGNS, 'text');
  Object.entries({ x: x + w / 2, y: y + h / 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'guide-text', 'font-size': Math.round(Math.min(w, h) / 7) }).forEach(([k, v]) => t.setAttribute(k, v));
  t.textContent = 'Место под заголовок';
  els.guides.append(r, t);
}

function renderOverlay() {
  els.overlay.replaceChildren();
  const it = state.items.find(i => i.uid === state.selected);
  $('#toolbar').classList.toggle('invisible', !it);
  if (!it || !cache.has(libItem(it.obj, it.kind).file)) return;
  const { w, h } = itemBox(it);
  const unit = state.fmt[0] / 1200;  // размеры ручек не зависят от формата
  const g = document.createElementNS(SVGNS, 'g');
  g.setAttribute('transform', `translate(${it.x} ${it.y}) rotate(${it.rot})`);
  const box = document.createElementNS(SVGNS, 'rect');
  Object.entries({ x: -w / 2, y: -h / 2, width: w, height: h, class: 'sel-box' }).forEach(([k, v]) => box.setAttribute(k, v));
  const stem = document.createElementNS(SVGNS, 'line');
  Object.entries({ x1: 0, y1: -h / 2, x2: 0, y2: -h / 2 - 28 * unit, class: 'sel-box' }).forEach(([k, v]) => stem.setAttribute(k, v));
  const rot = document.createElementNS(SVGNS, 'circle');
  Object.entries({ cx: 0, cy: -h / 2 - 28 * unit, r: 9 * unit, class: 'handle rot', 'data-handle': 'rot' }).forEach(([k, v]) => rot.setAttribute(k, v));
  const sc = document.createElementNS(SVGNS, 'rect');
  Object.entries({ x: w / 2 - 8 * unit, y: h / 2 - 8 * unit, width: 16 * unit, height: 16 * unit, rx: 3 * unit, class: 'handle scale', 'data-handle': 'scale' }).forEach(([k, v]) => sc.setAttribute(k, v));
  g.append(box, stem, rot, sc);
  els.overlay.appendChild(g);
}

function renderLayers() {
  const names = state.lib.objects;
  els.layers.replaceChildren(...[...state.items].reverse().map(it => {
    const li = document.createElement('li');
    li.className = it.uid === state.selected ? 'active' : '';
    li.innerHTML = `<span class="nm">${names[it.obj].name}</span><span class="kind">${it.kind === 'bg' ? 'фон' : ''}</span>
      <button data-l="up" title="Выше">↑</button><button data-l="down" title="Ниже">↓</button><button data-l="del" title="Удалить">✕</button>`;
    li.addEventListener('click', e => {
      const act = e.target.dataset.l;
      select(it.uid);
      if (act) action(act === 'del' ? 'del' : act);
    });
    return li;
  }));
}

function renderLibrary() {
  $('#lib-size').textContent = state.size;
  const names = state.lib.objects;
  els.library.replaceChildren(...Object.keys(names).map(obj => {
    const it = libItem(obj, state.libKind);
    const b = document.createElement('button');
    b.className = 'lib-item'; b.type = 'button';
    b.innerHTML = `<img src="${it.file}" alt="" loading="lazy"><span>${names[obj].name}</span>`;
    b.addEventListener('click', () => addItem(obj, state.libKind));
    return b;
  }));
}

function renderPalettes() {
  const all = [...PALETTES, ...state.customPalettes];
  $('#palettes').replaceChildren(...all.map(p => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pal' + (p.id === state.palette.id ? ' active' : '');
    b.innerHTML = `<span class="pal-name">${escapeHtml(p.name)}</span><span class="sw">${[...p.bg, ...p.obj].map(c => `<i style="background:${c}"></i>`).join('')}</span>`;
    b.addEventListener('click', () => { state.palette = p; renderPalettes(); renderScene(); });
    return b;
  }));
}

/* ---------- Подбор (сценарии 1 и 2) ---------- */
function norm(s) { return s.toLowerCase().replace(/ё/g, 'е'); }
function words(s) { return norm(s).split(/[^a-zа-я0-9]+/i).filter(Boolean); }

function pickByIdea(text) {
  const t = ' ' + norm(text) + ' ';
  const ws = words(text);
  const score = {}; const reasons = {};
  for (const [stems, objs, label] of ASSOC) {
    const hit = stems.find(st => { const s = norm(st); return s.includes(' ') ? t.includes(s) : ws.some(w => w.startsWith(s) || (w.length >= 4 && s.startsWith(w))); });
    if (!hit) continue;
    for (const [o, wgt] of Object.entries(objs)) { score[o] = (score[o] || 0) + wgt; (reasons[o] ||= new Set()).add(label); }
  }
  // Прямое упоминание объекта в тексте весит больше всего.
  for (const [o, stems] of Object.entries(NAMES)) {
    if (ws.some(w => stems.some(s => w.startsWith(s)))) { score[o] = (score[o] || 0) + 5; (reasons[o] ||= new Set()).add('упомянут в тексте'); }
  }
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]).map(([o]) => o);
  let main = ranked.slice(0, 4);
  // Обрезаем «хвост»: оставляем объекты, которые хотя бы вдвое слабее лидера не стали.
  if (main.length > 2) { const top = score[main[0]]; main = main.filter((o, i) => i < 2 || score[o] * 2 >= top); }
  const fallback = main.length === 0;
  if (fallback) main = [...FALLBACK];
  else if (main.length === 1) main.push(...FALLBACK.filter(o => o !== main[0]).slice(0, 1));
  const bgCandidate = ranked.find(o => !main.includes(o)) || Object.keys(NAMES).find(o => !main.includes(o) && ['headphones', 'lamp', 'book', 'flowers'].includes(o));
  const list = main.map(obj => ({ obj, kind: 'main' }));
  if (state.withBg && bgCandidate) list.push({ obj: bgCandidate, kind: 'bg' });
  return { list, reasons, fallback };
}

function pickByList(text) {
  const parts = norm(text).split(/[,;\n]+|\s+и\s+/).map(s => s.trim()).filter(Boolean);
  const list = []; const unknown = [];
  for (const p of parts) {
    const bg = /^(фон|фоновый|фоновая|фоновые)\s*[:\-]?\s*/.test(p) || /\(фон\)/.test(p);
    const clean = p.replace(/^(фон|фоновый|фоновая|фоновые)\s*[:\-]?\s*/, '').replace(/\(фон\)/, '').trim();
    const ws = words(clean);
    const obj = Object.keys(NAMES).find(o => ws.some(w => NAMES[o].some(s => w.startsWith(s))));
    if (obj) list.push({ obj, kind: bg ? 'bg' : 'main' }); else unknown.push(clean);
  }
  return { list, unknown };
}

/* ---------- Раскладка ---------- */
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

function layout(list, seed) {
  const [W, H] = state.fmt;
  const { area } = templateArea(state.tpl, W, H);
  const ax = area[0] * W, ay = area[1] * H, aw = (area[2] - area[0]) * W, ah = (area[3] - area[1]) * H;
  const rand = rng(seed);
  const mains = list.filter(i => i.kind === 'main');
  const bgs = list.filter(i => i.kind === 'bg');
  // Порядок объектов меняется от варианта к варианту.
  const order = [...mains];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  // Пропорции объектов сохраняем, но совсем мелкие (монета) немного увеличиваем, чтобы они читались.
  const raw = order.map(i => refSize(i.obj, i.kind));
  const rawMaxW = Math.max(...raw.map(d => d[0]));
  const boost = raw.map(d => clamp((0.42 * rawMaxW) / d[0], 1, 1.7));
  const dims = raw.map((d, i) => [d[0] * boost[i], d[1] * boost[i]]);
  const n = order.length;
  const placed = [];

  if (state.tpl === 'offset') {
    // В ряд с перекрытием и смещением по высоте, как в примере «Со смещением».
    const overlap = 0.12;
    const sumW = dims.reduce((a, d) => a + d[0], 0) * (1 - overlap);
    const maxH = Math.max(...dims.map(d => d[1]));
    const s = Math.min(aw / sumW, (ah * 0.78) / maxH);
    let x = ax + (aw - sumW * s) / 2;
    order.forEach((it, i) => {
      const [w, h] = dims[i];
      const dy = (i % 2 ? 1 : -1) * ah * (0.06 + rand() * 0.08);
      placed.push({ ...it, x: x + w * s / 2, y: ay + ah / 2 + dy, s: s * boost[i], rot: 0 });
      x += w * s * (1 - overlap);
    });
  } else {
    // Плотная группа: объекты на «ячейках» внутри области, крупные — ближе к центру.
    const slots = {
      1: [[0.5, 0.5]], 2: [[0.33, 0.42], [0.68, 0.6]], 3: [[0.3, 0.38], [0.7, 0.36], [0.5, 0.68]],
      4: [[0.28, 0.35], [0.7, 0.3], [0.32, 0.72], [0.72, 0.68]], 5: [[0.22, 0.36], [0.52, 0.3], [0.82, 0.38], [0.36, 0.72], [0.68, 0.72]],
    }[Math.min(n, 5)] || [[0.5, 0.5]];
    // «Собранно» — крупнее и плотнее, с заходом объектов друг на друга; «под заголовок» — чуть свободнее.
    const tight = state.tpl === 'packed' ? 1.3 : 1.12;
    const spread = state.tpl === 'packed' ? 0.7 : 0.92;
    const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3, rows = n <= 2 ? 1.2 : 2;
    const byArea = order.map((it, i) => ({ it, d: dims[i], b: boost[i] })).sort((a, b) => b.d[0] * b.d[1] - a.d[0] * a.d[1]);
    const maxW = Math.max(...dims.map(d => d[0])), maxH = Math.max(...dims.map(d => d[1]));
    const s = Math.min((aw / cols) * 1.15 / maxW, (ah / rows) * 1.05 / maxH) * tight;
    const slotOrder = slots.map((p, i) => ({ p, i, c: Math.hypot(p[0] - 0.5, p[1] - 0.5) })).sort((a, b) => a.c - b.c);
    byArea.forEach(({ it, b }, i) => {
      const p0 = slotOrder[i % slotOrder.length].p;
      const p = [0.5 + (p0[0] - 0.5) * spread, 0.5 + (p0[1] - 0.5) * spread];
      const jx = (rand() - 0.5) * aw * 0.06, jy = (rand() - 0.5) * ah * 0.06;
      placed.push({ ...it, x: ax + p[0] * aw + jx, y: ay + p[1] * ah + jy, s: s * b, rot: 0 });
    });
  }

  relax(placed, [ax, ay, aw, ah], state.tpl === 'packed' ? 0.38 : 0.22);
  // Изометрия: кто ниже на холсте — тот ближе к зрителю.
  placed.sort((a, b) => (a.y + boxOf(a).h / 2) - (b.y + boxOf(b).h / 2));

  // Фоновые объекты — позади, в свободной части области.
  const s0 = placed[0]?.s || Math.min(aw / 1500, ah / 1100);
  const back = bgs.map((it, i) => {
    const [w, h] = refSize(it.obj, it.kind);
    const s = Math.min(s0 * 1.05, (ah * 0.75) / h, (aw * 0.6) / w);
    const best = freeSpot(placed, [ax, ay, aw, ah], w * s, h * s, rand, i);
    return { ...it, x: best[0], y: best[1], s, rot: 0 };
  });
  return [...back, ...placed];
}

function boxOf(p) { const [w, h] = refSize(p.obj, p.kind); return { w: w * p.s, h: h * p.s }; }

// Раздвигаем объекты, если они перекрываются сильнее, чем на треть, и удерживаем их в области.
function relax(items, [ax, ay, aw, ah], maxOverlap = 0.22) {
  for (let iter = 0; iter < 60; iter++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j], A = boxOf(a), B = boxOf(b);
      const ox = (A.w + B.w) / 2 - Math.abs(a.x - b.x), oy = (A.h + B.h) / 2 - Math.abs(a.y - b.y);
      if (ox <= 0 || oy <= 0) continue;
      const minArea = Math.min(A.w * A.h, B.w * B.h);
      if ((ox * oy) / minArea < maxOverlap) continue;
      const push = 0.15;
      if (ox / (A.w + B.w) < oy / (A.h + B.h)) { const d = (a.x < b.x ? -1 : 1) * ox * push; a.x += d; b.x -= d; }
      else { const d = (a.y < b.y ? -1 : 1) * oy * push; a.y += d; b.y -= d; }
      moved = true;
    }
    for (const p of items) {
      const { w, h } = boxOf(p);
      p.x = clamp(p.x, ax + w / 2, ax + aw - w / 2 > ax + w / 2 ? ax + aw - w / 2 : ax + aw / 2);
      p.y = clamp(p.y, ay + h / 2, ay + ah - h / 2 > ay + h / 2 ? ay + ah - h / 2 : ay + ah / 2);
    }
    if (!moved) break;
  }
}

// Место для фонового объекта: точка внутри области, где он меньше всего закрыт главными объектами.
function freeSpot(placed, [ax, ay, aw, ah], w, h, rand, salt) {
  let best = null, bestScore = Infinity;
  for (let t = 0; t < 80; t++) {
    const x = ax + w / 2 + rand() * Math.max(1, aw - w), y = ay + h / 2 + rand() * Math.max(1, ah - h);
    let cover = 0;
    for (const p of placed) {
      const B = boxOf(p);
      const ox = Math.max(0, Math.min(x + w / 2, p.x + B.w / 2) - Math.max(x - w / 2, p.x - B.w / 2));
      const oy = Math.max(0, Math.min(y + h / 2, p.y + B.h / 2) - Math.max(y - h / 2, p.y - B.h / 2));
      cover += ox * oy;
    }
    const sc = cover / (w * h) + (salt ? 0 : 0) + Math.abs(y - (ay + ah * 0.35)) / ah * 0.15;
    if (sc < bestScore) { bestScore = sc; best = [x, y]; }
  }
  return best;
}

/* ---------- Действия ---------- */
async function build(newSeed) {
  const mode = $('.tab.active').dataset.tab;
  let picked;
  if (mode === 'idea') {
    const text = $('#idea').value.trim();
    if (!text) { showExplain('<span class="warn">Введите заголовок или метафору.</span>'); return; }
    const r = pickByIdea(text);
    picked = r.list;
    const names = state.lib.objects;
    const lines = r.list.map(i => `<span class="tag">${names[i.obj].name}${i.kind === 'bg' ? ' · фон' : ''}</span>${i.kind === 'main' && r.reasons[i.obj] ? ' — ' + [...r.reasons[i.obj]].join(', ') : ''}`);
    showExplain((r.fallback ? '<span class="warn">Прямых ассоциаций не нашлось — взял универсальный набор.</span><br>' : '<b>Подобрано по смыслу:</b><br>') + lines.join('<br>'));
  } else {
    const r = pickByList($('#list').value);
    picked = r.list;
    const unk = r.unknown.length ? `<br><span class="warn">Нет в библиотеке: ${r.unknown.map(escapeHtml).join(', ')}</span>` : '';
    if (!picked.length) { showExplain('<span class="warn">Не узнал ни одного объекта.</span>' + unk); return; }
    showExplain(`<b>Объектов:</b> ${picked.length}` + unk);
  }
  if (newSeed) state.seed = Math.floor(Math.random() * 1e9);
  state.last = picked;
  await preload(picked);
  commit(() => {
    state.items = layout(picked, state.seed).map(p => ({ ...p, uid: uidCounter++ }));
    state.selected = null;
  });
}

async function addItem(obj, kind) {
  await loadSvg(libItem(obj, kind).file);
  const [W, H] = state.fmt;
  const [w, h] = refSize(obj, kind);
  const s = Math.min(W * 0.3 / w, H * 0.45 / h);
  const it = { uid: uidCounter++, obj, kind, x: W / 2 + (Math.random() - 0.5) * W * 0.1, y: H / 2 + (Math.random() - 0.5) * H * 0.1, rot: 0, s };
  commit(() => { state.items.push(it); state.selected = it.uid; });
}

async function action(act) {
  const idx = state.items.findIndex(i => i.uid === state.selected);
  if (idx < 0) return;
  const it = state.items[idx];
  if (act === 'kind') await loadSvg(libItem(it.obj, it.kind === 'main' ? 'bg' : 'main').file);
  commit(() => {
    if (act === 'del') { state.items.splice(idx, 1); state.selected = null; }
    if (act === 'dup') { const c = { ...it, uid: uidCounter++, x: it.x + 30, y: it.y + 20 }; state.items.splice(idx + 1, 0, c); state.selected = c.uid; }
    if (act === 'up' && idx < state.items.length - 1) [state.items[idx], state.items[idx + 1]] = [state.items[idx + 1], state.items[idx]];
    if (act === 'down' && idx > 0) [state.items[idx], state.items[idx - 1]] = [state.items[idx - 1], state.items[idx]];
    if (act === 'rotL') it.rot -= 15;
    if (act === 'rotR') it.rot += 15;
    if (act === 'kind') it.kind = it.kind === 'main' ? 'bg' : 'main';
  });
}

function select(uid) { state.selected = uid; renderOverlay(); renderLayers(); }

/* ---------- История (отмена) ---------- */
const history = { past: [], future: [] };
// В снимок входит и формат: координаты объектов имеют смысл только вместе с размером холста.
const snapshot = () => JSON.stringify({ items: state.items, fmt: state.fmt });
function restore(json) {
  const s = JSON.parse(json);
  state.items = s.items; state.fmt = s.fmt; state.selected = null;
  $('#format').value = s.fmt.join('x');
  preload(state.items).then(renderScene);
}
function commit(fn) {
  history.past.push(snapshot()); if (history.past.length > 80) history.past.shift();
  history.future = [];
  fn();
  renderScene();
}
function undo() { if (!history.past.length) return; history.future.push(snapshot()); restore(history.past.pop()); }
function redo() { if (!history.future.length) return; history.past.push(snapshot()); restore(history.future.pop()); }

/* ---------- Мышь и тач ---------- */
function toSvg(e) {
  const pt = els.svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  return pt.matrixTransform(els.svg.getScreenCTM().inverse());
}
let drag = null;
els.svg.addEventListener('pointerdown', e => {
  const handle = e.target.closest('[data-handle]');
  const itemEl = e.target.closest('.item');
  const p = toSvg(e);
  if (handle) {
    const it = state.items.find(i => i.uid === state.selected);
    drag = { type: handle.dataset.handle, it, start: p, before: snapshot(), s0: it.s, d0: Math.hypot(p.x - it.x, p.y - it.y) };
  } else if (itemEl) {
    const uid = +itemEl.dataset.uid; select(uid);
    const it = state.items.find(i => i.uid === uid);
    drag = { type: 'move', it, start: p, x0: it.x, y0: it.y, before: snapshot() };
    itemEl.classList.add('dragging');
  } else { select(null); return; }
  els.svg.setPointerCapture(e.pointerId);
  e.preventDefault();
});
els.svg.addEventListener('pointermove', e => {
  if (!drag) return;
  const p = toSvg(e), it = drag.it;
  if (drag.type === 'move') { it.x = drag.x0 + p.x - drag.start.x; it.y = drag.y0 + p.y - drag.start.y; }
  if (drag.type === 'rot') { let a = Math.atan2(p.y - it.y, p.x - it.x) * 180 / Math.PI + 90; if (e.shiftKey) a = Math.round(a / 15) * 15; it.rot = a; }
  if (drag.type === 'scale') it.s = Math.max(0.03, drag.s0 * Math.hypot(p.x - it.x, p.y - it.y) / drag.d0);
  drag.moved = true;
  updateItemTransform(it);
});
els.svg.addEventListener('pointerup', () => {
  if (drag?.moved) { history.past.push(drag.before); history.future = []; renderScene(); }
  $$('.item.dragging').forEach(n => n.classList.remove('dragging'));
  drag = null;
});
function updateItemTransform(it) {
  const node = els.scene.querySelector(`[data-uid="${it.uid}"]`);
  const entry = cache.get(libItem(it.obj, it.kind).file);
  const [rw] = refSize(it.obj, it.kind);
  node.setAttribute('transform', `translate(${r2(it.x)} ${r2(it.y)}) rotate(${r2(it.rot)}) scale(${r4(it.s * rw / entry.vb[2])})`);
  renderOverlay();
}

document.addEventListener('keydown', e => {
  if (e.target instanceof Element && e.target.matches('textarea, input, select')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (!state.selected) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); action('del'); }
  else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); action('dup'); }
  else if (e.key === ']') action('up');
  else if (e.key === '[') action('down');
  else if (e.key.startsWith('Arrow')) {
    e.preventDefault();
    const it = state.items.find(i => i.uid === state.selected), step = e.shiftKey ? 20 : 4;
    commit(() => { if (e.key === 'ArrowLeft') it.x -= step; if (e.key === 'ArrowRight') it.x += step; if (e.key === 'ArrowUp') it.y -= step; if (e.key === 'ArrowDown') it.y += step; });
  }
});

/* ---------- Экспорт SVG ---------- */
function exportSvg() {
  const [W, H] = state.fmt;
  const out = document.createElementNS(SVGNS, 'svg');
  out.setAttribute('xmlns', SVGNS);
  out.setAttribute('width', W); out.setAttribute('height', H); out.setAttribute('viewBox', `0 0 ${W} ${H}`); out.setAttribute('fill', 'none');
  const clone = els.scene.cloneNode(true);
  clone.removeAttribute('id');
  clone.querySelectorAll('[data-fill],[data-stroke],[data-uid],[class]').forEach(n => { n.removeAttribute('data-fill'); n.removeAttribute('data-stroke'); n.removeAttribute('data-uid'); n.removeAttribute('class'); });
  out.append(...clone.childNodes);
  const text = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(out);
  return text;
}
function download() {
  const blob = new Blob([exportSvg()], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `snapbuild-${state.tpl}-${state.size}-${state.palette.id}-${state.fmt.join('x')}.svg`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Своя палитра ---------- */
function parsePalette(json, fileName) {
  const hex = v => typeof v === 'string' && /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(v.trim());
  const bg = json.background || json.bg, obj = json.objects || json.obj;
  if (!Array.isArray(bg) || !Array.isArray(obj) || bg.length !== 3 || obj.length !== 3 || ![...bg, ...obj].every(hex)) {
    throw new Error('Нужно 3 цвета в "background" и 3 в "objects" в формате #RRGGBB.');
  }
  return { id: 'custom-' + Date.now(), name: json.name || fileName.replace(/\.json$/i, ''), bg: bg.map(s => s.trim()), obj: obj.map(s => s.trim()), ink: hex(json.ink) ? json.ink : undefined, paper: hex(json.paper) ? json.paper : undefined };
}

/* ---------- Утилиты ---------- */
function r2(v) { return Math.round(v * 100) / 100; }
function r4(v) { return Math.round(v * 10000) / 10000; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function plural(n, one, few, many) { const m = n % 100, l = n % 10; return `${n} ${m > 10 && m < 20 ? many : l === 1 ? one : l > 1 && l < 5 ? few : many}`; }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function showExplain(html) { els.explain.innerHTML = html; }
function segment(id, cb) {
  $(`#${id}`).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$(`#${id} button`).forEach(x => x.classList.toggle('active', x === b));
    cb(b.dataset.v);
  });
}

/* ---------- Запуск ---------- */
async function init() {
  await loadLibrary();
  $('#idea-examples').replaceChildren(...IDEA_EXAMPLES.map(t => {
    const c = document.createElement('button'); c.type = 'button'; c.className = 'chip'; c.textContent = t;
    c.addEventListener('click', () => { $('#idea').value = t; build(true); });
    return c;
  }));
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.toggle('active', x === t));
    $$('.tab-body').forEach(b => b.classList.toggle('hidden', b.dataset.body !== t.dataset.tab));
  }));
  segment('template', v => { state.tpl = v; if (state.last) relayout(); else renderScene(); });
  segment('size', async v => {
    state.size = v; renderLibrary();
    await preload(state.items);
    renderScene();
  });
  segment('lib-kind', v => { state.libKind = v; renderLibrary(); });
  $('#format').addEventListener('change', e => {
    const fmt = e.target.value.split('x').map(Number);
    if (state.last) relayout(fmt); else commit(() => { state.fmt = fmt; });
  });
  $('#with-bg').addEventListener('change', e => { state.withBg = e.target.checked; build(false); });
  $('#guide').addEventListener('change', e => { state.guide = e.target.checked; renderGuides(); });
  $('#build').addEventListener('click', () => build(true));
  $('#variant').addEventListener('click', () => { if (state.last) { state.seed = Math.floor(Math.random() * 1e9); relayout(); } else build(true); });
  $('#export').addEventListener('click', download);
  $('#undo').addEventListener('click', undo);
  $('#redo').addEventListener('click', redo);
  $('#toolbar').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) action(b.dataset.act); });
  $('#idea').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); build(true); } });
  $('#palette-file').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const p = parsePalette(JSON.parse(await f.text()), f.name);
      state.customPalettes.push(p); state.palette = p;
      $('#palette-msg').textContent = `Палитра «${p.name}» загружена и применена.`;
      renderPalettes(); renderScene();
    } catch (err) { $('#palette-msg').textContent = 'Не получилось: ' + err.message; }
    e.target.value = '';
  });
  renderPalettes(); renderLibrary();
  new ResizeObserver(() => fitCanvas()).observe($('#canvas-wrap'));
  await build(false);
}
async function relayout(fmt) {
  await preload(state.last);
  commit(() => {
    if (fmt) state.fmt = fmt;
    state.items = layout(state.last, state.seed).map(p => ({ ...p, uid: uidCounter++ }));
    state.selected = null;
  });
}

// Для отладки и для генерации примеров.
window.snapbuild = { state, exportSvg, build, relayout, pickByIdea, pickByList };
init().catch(err => { showExplain('<span class="warn">Не удалось загрузить библиотеку: ' + escapeHtml(err.message) + '</span>'); console.error(err); });
})();
