/* Форма 0.2: интерфейс и экран тренировки. */
(function () {
  'use strict';
  var F = window.FORMA, E = F.EX, D = F.date, store = F.store;
  var S = store.load();
  var Q = new URLSearchParams(location.search);
  var SPEED = parseFloat(Q.get('speed')) || 1; /* ?speed=20 ускоряет таймеры для проверки */
  var now = function () { return performance.now() * SPEED; };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var V = { tab: 'today', week: null, stab: 'over', lg: 'Все', lq: '' };
  var save = function () { store.save(); };
  var VERSION = '0.4';

  var ico = function (d, sw) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2) + '" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>'; };
  var IC = {
    today: ico('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>'),
    prog: ico('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
    lib: ico('<rect x="2" y="9" width="3" height="6" rx="1"/><rect x="19" y="9" width="3" height="6" rx="1"/><path d="M5 12h14M7.5 7v10M16.5 7v10"/>', 1.8),
    stat: ico('<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>'),
    set: ico('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'),
    close: ico('<path d="M6 6l12 12M18 6L6 18"/>', 2.2),
    back: ico('<path d="M15 5l-7 7 7 7"/>', 2.2),
    info: ico('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
    bell: ico('<rect x="2" y="9" width="3" height="6" rx="1"/><rect x="19" y="9" width="3" height="6" rx="1"/><path d="M5 12h14M7.5 7v10M16.5 7v10"/>', 1.6),
    vol: ico('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/>'),
    mute: ico('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
    up: ico('<path d="M6 15l6-6 6 6"/>', 2.2),
    down: ico('<path d="M6 9l6 6 6-6"/>', 2.2),
    plus: ico('<path d="M12 5v14M5 12h14"/>', 2.2),
    play: ico('<path d="M7 5l12 7-12 7V5z"/>'),
    swap: ico('<path d="M7 7h12l-3-3M17 17H5l3 3"/>', 2)
  };

  /* ---------- Тема ---------- */
  function applyTheme() {
    var r = document.documentElement, t = S.s.theme;
    if (t === 'light' || t === 'dark') r.setAttribute('data-theme', t); else r.removeAttribute('data-theme');
    var dark = t === 'dark' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    var m = $('meta[name=theme-color]'); if (m) m.setAttribute('content', dark ? '#0B1413' : '#F1F6F5');
  }

  /* ---------- Вспомогательное ---------- */
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function longDate(d) { return F.DAYS_FULL[D.dow(d)] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  var doneEntry = F.isDone;
  function dateSet() { var set = {}; S.log.forEach(function (l) { set[l.date] = (set[l.date] || 0) + (l.sec || 0); }); return set; }
  function streak() {
    var set = dateSet(), d = D.today(), n = 0;
    if (!set[D.ymd(d)]) d = D.add(d, -1);
    while (set[D.ymd(d)]) { n++; d = D.add(d, -1); }
    return n;
  }
  function bestStreak() {
    var ds = Object.keys(dateSet()).sort(), best = 0, run = 0, prev = null;
    ds.forEach(function (s) { var d = D.parse(s); if (prev && Math.round((d - prev) / 864e5) === 1) run++; else run = 1; best = Math.max(best, run); prev = d; });
    return best;
  }
  function minutesOn(ymd) { var s = 0; S.log.forEach(function (l) { if (l.date === ymd) s += l.sec || 0; }); return Math.round(s / 60); }
  function fmtTime(sec) { sec = Math.max(0, Math.ceil(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function ytUrl(id) { return 'https://www.youtube.com/results?search_query=' + encodeURIComponent((E[id] ? E[id].q : id) + ' упражнение техника'); }
  function rangeTxt(r, unit) { return r ? (r[0] === r[1] ? r[0] : r[0] + '–' + r[1]) + (unit || '') : ''; }
  var KIND = { strength: 'Силовая', circuit: 'Круговая', intervals: 'Интервалы', light: 'Лёгкий день', long: 'Кардио', test: 'Тест', walk: 'Прогулка', rest: 'Отдых', prep: 'Подготовка', custom: 'Своя', quick: 'Быстрая' };
  function groupIdx(id) { return Math.max(0, F.GROUPS.indexOf(F.group(id))); }

  /* ---------- Диалог ---------- */
  function dialog(o) {
    var el = document.createElement('div'); el.className = 'dlg'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = '<div><h2>' + esc(o.title) + '</h2><div class="stack">' + (o.html || '<p>' + esc(o.text) + '</p>') + '</div><div class="stack">' + o.btns.map(function (b, i) { return '<button class="btn ' + (b.cls || '') + '" data-dlg="' + i + '">' + esc(b.t) + '</button>'; }).join('') + '</div></div>';
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-dlg]'); if (!b) return;
      e.stopPropagation(); el.remove(); var f = o.btns[+b.dataset.dlg].fn; if (f) f();
    });
    document.body.appendChild(el);
    var first = $('button', el); if (first) first.focus();
  }
  function toast(t) {
    var el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2200);
  }

  /* ---------- Оверлеи и кнопка «Назад» ---------- */
  var stack = [], skipPop = 0;
  function pushOv(el, kind) {
    el.className = 'overlay'; el.dataset.kind = kind || ''; document.body.appendChild(el); stack.push(el);
    try { history.pushState({ ov: stack.length }, ''); } catch (e) { /* ignore */ }
  }
  function closeTop(force) {
    var el = stack.pop(); if (!el) return;
    el.remove();
    if (force) { skipPop++; try { history.back(); } catch (e) { skipPop--; } }
    if (!stack.length) render();
  }
  function closeAll() {
    var n = stack.length; if (!n) return;
    while (stack.length) stack.pop().remove();
    skipPop++; try { history.go(-n); } catch (e) { skipPop--; }
  }
  window.addEventListener('popstate', function () {
    if (skipPop > 0) { skipPop--; return; }
    var top = stack[stack.length - 1]; if (!top) return;
    if (top.dataset.kind === 'run') { try { history.pushState({ ov: stack.length }, ''); } catch (e) { /* ignore */ } runExit(); return; }
    stack.pop(); top.remove(); if (!stack.length) render();
  });

  /* ---------- Рисунки ---------- */
  function spark(vals) {
    if (!vals.length) return '';
    var w = 200, h = 56, min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (max === min) { max += 1; min -= 1; }
    var pts = vals.map(function (v, i) { return [vals.length === 1 ? w / 2 : 6 + i * (w - 12) / (vals.length - 1), h - 8 - (v - min) / (max - min) * (h - 16)]; });
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="График"><polyline points="' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"/>' + pts.map(function (p, i) { return i === pts.length - 1 ? '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.5"/>' : ''; }).join('') + '</svg>';
  }
  function thumb(id) {
    var e = E[id];
    if (e && e.media) return '<span class="th"><img alt="" src="media/' + e.media + '/' + (F.MEDIA[e.media].seq[0] + 1) + '.jpg"></span>';
    return '<span class="th ph g' + groupIdx(id) + '">' + IC.bell + '</span>';
  }

  /* ---------- Медиа-плеер кадров ---------- */
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function parseTempo(t) { var p = (t || '').split('-').map(Number); if (p.length < 3 || p.some(isNaN)) return null; return [p[0], p[1], p[2], p[3] || 0]; }
  function mountMedia(el, key, tempo) {
    var M = F.MEDIA[key]; if (!M || !el) return;
    el.style.aspectRatio = M.ar; el.innerHTML = '';
    var imgs = [];
    for (var i = 1; i <= M.n; i++) { var im = document.createElement('img'); im.alt = ''; im.src = 'media/' + key + '/' + i + '.jpg'; im.style.opacity = '0'; el.appendChild(im); imgs.push(im); }
    var d = (key === 'climber') ? M.cycle : (parseTempo(tempo) || M.cycle), seq = M.seq, N = seq.length, t0 = now();
    var cyc = d[0] + d[1] + d[2] + d[3];
    function ease(x) { return 0.5 - 0.5 * Math.cos(Math.PI * x); }
    function paint() {
      var x = ((now() - t0) / 1000) % cyc, s;
      if (x < d[0]) s = ease(x / d[0]); else if (x < d[0] + d[1]) s = 1; else if (x < d[0] + d[1] + d[2]) s = 1 - ease((x - d[0] - d[1]) / d[2]); else s = 0;
      if (reduce) s = 0;
      var pos = s * (N - 1), lo = Math.min(N - 2, Math.floor(pos + 1e-9)), fr = pos - lo;
      imgs.forEach(function (m) { m.style.opacity = '0'; });
      imgs[seq[lo]].style.opacity = '1'; imgs[seq[lo + 1]].style.opacity = String(fr);
    }
    paint();
    if (reduce) return;
    (function loop() { if (!el.isConnected) return; paint(); requestAnimationFrame(loop); })();
  }
  function mediaBox(id, big) {
    var e = E[id];
    if (e && e.media) return '<div class="stage" data-media="' + e.media + '" data-tempo=""></div>';
    return big ? '<div class="stage ph">' + IC.bell + '<span>Картинки пока нет.<br>Техника ниже, видео по кнопке YouTube.</span></div>' : '';
  }
  function mountAll(root, tempo) { root.querySelectorAll('[data-media]').forEach(function (el) { mountMedia(el, el.dataset.media, tempo || el.dataset.tempo); }); }

  /* ---------- Занятие: карточка в списках ---------- */
  function exRows(preview, n, withLink) {
    return '<div class="list">' + preview.slice(0, n).map(function (p) {
      return '<button class="item" data-a="card" data-ex="' + esc(p.ex) + '">' + thumb(p.ex) + '<div class="grow"><div class="t">' + esc(E[p.ex].n) + '</div>' + (p.txt ? '<div class="s">' + esc(p.txt) + '</div>' : '') + '</div><span class="muted">›</span></button>';
    }).join('') + '</div>';
  }
  function sessCard(sess, o) {
    o = o || {};
    var done = doneEntry(sess.id), html = '<section class="card ' + (o.hero ? 'hero' : '') + '"><div class="row between"><span class="chip">' + esc(KIND[sess.kind] || '') + '</span>' + (done ? '<span class="chip ok">Выполнено</span>' : ((sess.opt ? '<span class="chip plain">по желанию</span>' : '') + (sess.min ? '<span class="chip plain">≈ ' + sess.min + ' мин</span>' : ''))) + '</div>' +
      '<div class="stack"><h2>' + esc(sess.title) + '</h2><p class="muted">' + esc(sess.sub) + '</p></div>';
    if (sess.preview.length) {
      html += exRows(sess.preview, o.all ? 99 : 4);
      if (!o.all && sess.preview.length > 4) html += '<button class="link" data-a="openSess" data-id="' + esc(sess.id) + '">Все упражнения (' + sess.preview.length + ')</button>';
    }
    if (sess.kind === 'prep') html += '<button class="btn" data-a="openSess" data-id="' + esc(sess.id) + '">Открыть список</button>';
    else html += '<div class="row"><button class="btn grow" data-a="startSess" data-id="' + esc(sess.id) + '">' + (done ? 'Повторить' : 'Начать') + '</button><button class="btn line" data-a="openSess" data-id="' + esc(sess.id) + '">Подробнее</button></div>';
    return html + '</section>';
  }
  function sessRow(sess, hint) {
    var dn = doneEntry(sess.id);
    return '<div class="srow"><button class="dot' + (dn ? ' done' : '') + '" data-a="openSess" data-id="' + esc(sess.id) + '" aria-label="Открыть">' + (dn ? '✓' : (hint || '·')) + '</button><button class="grow tt" data-a="openSess" data-id="' + esc(sess.id) + '"><div class="t">' + esc(sess.title) + '</div><div class="s">' + (sess.opt ? 'по желанию · ' : '') + (sess.min ? '≈ ' + sess.min + ' мин' : 'без нагрузки') + (dn ? ' · ' + esc(D.fmt(D.parse(dn.date))) : '') + '</div></button>' +
      (sess.kind === 'prep' ? '' : '<button class="btn small ' + (dn ? 'line' : 'ghost') + '" data-a="startSess" data-id="' + esc(sess.id) + '">' + (dn ? 'Ещё раз' : 'Старт') + '</button>') + '</div>';
  }

  /* ---------- Вкладка «Сегодня» ---------- */
  function weekStrip() {
    var mon = D.monday(D.today()), set = dateSet(), t = D.ymd(D.today());
    return '<div class="weekstrip">' + F.DAYS.map(function (n, i) {
      var d = D.add(mon, i), y = D.ymd(d), dn = !!set[y];
      return '<div class="day' + (y === t ? ' today' : '') + (dn ? ' done' : '') + '"><span>' + n + '</span><b>' + d.getDate() + '</b><span class="mark">' + (dn ? '✓' : '') + '</span></div>';
    }).join('') + '</div>';
  }
  function goalBar() {
    var m = minutesOn(D.ymd(D.today())), g = S.s.goalMin || 30, p = Math.min(100, Math.round(m / g * 100));
    return '<div class="goal"><div class="row between"><span class="small muted">Цель на сегодня</span><b>' + m + ' / ' + g + ' мин</b></div><div class="mini"><i style="width:' + p + '%"></i></div></div>';
  }
  function ownNext() {
    if (!S.custom.length) return null;
    var lastId = null;
    for (var i = S.log.length - 1; i >= 0; i--) if (String(S.log[i].id).indexOf('c:') === 0) { lastId = S.log[i].id; break; }
    var idx = 0;
    if (lastId) { var k = S.custom.findIndex(function (c) { return 'c:' + c.id === lastId; }); idx = (k + 1) % S.custom.length; }
    return S.custom[idx];
  }
  function quickChips() {
    return '<div class="chips">' + F.QUICK.map(function (q) { return '<button class="qk" data-a="openSess" data-id="q:' + q.key + '"><b>' + esc(q.title) + '</b><span>' + q.min + ' мин</span></button>'; }).join('') + '</div>';
  }

  function vToday() {
    var t = D.today(), out = '<header class="top"><p class="kicker">' + esc(longDate(t)) + '</p><div class="row between"><h1>Форма</h1><span class="chip plain">серия: ' + streak() + ' дн.</span></div></header>';
    if (!S.mode) {
      return out + '<section class="card"><h2>С чего начнём?</h2><p class="muted">Приложение работает без привязки к дням: пропустили тренировку, сделайте её в любой другой день. Выберите, как заниматься.</p>' +
        '<button class="btn" data-a="startForma">Готовая программа на 12 недель</button><p class="small muted">Составлена для мужчины 50 лет: силовые, кардио, тесты, давление. Подходы и повторы можно менять.</p>' +
        '<button class="btn line" data-a="startOwn">Своя программа</button><p class="small muted">Соберёте тренировки сами из библиотеки упражнений: подходы, повторы, время, отдых.</p></section>' + foodCard() + quickChips() + safety();
    }
    if (S.mode === 'own') {
      var c = ownNext();
      if (!c) out += '<section class="card"><h2>Создайте первую тренировку</h2><p class="muted">Выберите упражнения в библиотеке, задайте подходы, повторы и отдых. Потом запускайте в любой день.</p><button class="btn" data-a="newCustom">Создать тренировку</button></section>';
      else {
        out += '<p class="kicker">Следующая по списку</p>' + sessCard(F.customSession(c), { hero: true });
        if (S.custom.length > 1) out += '<button class="btn line" data-a="tab" data-v="prog">Выбрать другую</button>';
      }
      return out + '<section class="card flat"><h3>Эта неделя</h3>' + weekStrip() + goalBar() + '</section>' + foodCard() + '<h3 class="sec">Быстрые тренировки</h3>' + quickChips() + safety();
    }
    var w = S.pos ? S.pos.week : 0, wi = F.weekInfo(w), p = F.weekProgress(w), nx = F.nextSlot(w);
    out += '<div class="row"><span class="chip">' + (w === 0 ? 'Неделя 0' : 'Неделя ' + w + ' из 12') + '</span><span class="chip plain">' + esc(wi.blockName) + '</span>' + (w > 0 ? '<span class="chip plain">запас ' + wi.rir + '</span>' : '') + (wi.deload ? '<span class="chip warn">разгрузка</span>' : '') + (wi.test ? '<span class="chip warn">тесты</span>' : '') + '</div>';
    if (nx) {
      out += '<p class="kicker">Следующая тренировка</p>' + gateNotice(nx.sess) + sessCard(nx.sess, { hero: true });
      out += '<button class="btn line" data-a="pickOther">Выбрать другую тренировку недели</button>';
    } else {
      out += '<section class="card hero"><h2>' + (w >= 12 ? 'Программа пройдена' : 'Неделя ' + w + ' выполнена') + '</h2><p class="muted">' + (w >= 12 ? 'Проведите итоговые замеры и сравните результаты: талия и силовые показатели важнее одного веса.' : 'Можно перейти к неделе ' + (w + 1) + ' или сначала повторить любую тренировку.') + '</p>' + (w >= 12 ? '<button class="btn" data-a="tab" data-v="stat">Открыть прогресс</button><button class="btn line" data-a="newCycle">Начать цикл заново</button>' : '<button class="btn" data-a="nextWeek">К неделе ' + (w + 1) + '</button>') + '</section>';
    }
    var days = S.pos && S.pos.since ? Math.round((t - D.parse(S.pos.since)) / 864e5) : 0;
    if (nx && days >= 8 && w < 12) out += '<div class="notice">Эта неделя идёт уже ' + days + ' дн. Можно доделать пропущенное или перейти к следующей: невыполненные останутся в разделе «Программа». <button class="link" data-a="nextWeek">К неделе ' + (w + 1) + '</button></div>';
    out += '<section class="card flat"><div class="row between"><h3>Тренировки недели</h3><span class="chip plain">' + p.done + ' из ' + p.total + '</span></div><div class="list">' + p.slots.map(function (x) { return sessRow(x.sess, F.DAYS[x.d]); }).join('') + '</div><p class="small muted">Порядок свободный. Пропущенную тренировку можно сделать в любой день.</p></section>';
    out += '<section class="card flat"><h3>Эта неделя</h3>' + weekStrip() + goalBar() + '</section>';
    out += foodCard() + '<h3 class="sec">Быстрые тренировки</h3>' + quickChips();
    var last = S.meas[S.meas.length - 1];
    if (last) out += '<section class="card flat"><h3>Последние замеры</h3><div class="kv"><span>Дата</span><b>' + esc(D.fmtFull(last.d)) + '</b></div>' + (last.w ? '<div class="kv"><span>Вес</span><b>' + last.w + ' кг</b></div>' : '') + (last.waist ? '<div class="kv"><span>Талия</span><b>' + last.waist + ' см</b></div>' : '') + (last.hr ? '<div class="kv"><span>Пульс покоя</span><b>' + last.hr + '</b></div>' : '') + '</section>';
    return out + safety();
  }
  function safety() { return '<p class="small muted">Приложение не заменяет врача. При боли в груди, перебоях сердца, головокружении, резкой головной боли или необычной одышке прекратите нагрузку и обратитесь за медицинской помощью.</p>'; }
  function gateNotice(sess) {
    if (!F.isIntervals(sess)) return '';
    var g = F.bpGate();
    if (g.state === 'high') return '<div class="notice danger">Среднее давление по вашим записям ' + g.sys + '/' + g.dia + ': это от порога 135/85, принятого для домашних измерений. До интервалов сначала обратитесь к врачу. Сегодня замените занятие быстрой ходьбой в зоне 1–2.</div>';
    if (g.state === 'few') return '<div class="notice">Интервалы начинайте только после недели домашних измерений давления: 14 записей, утро и вечер. Сейчас записано: ' + g.n + '. <button class="link" data-a="goBp">Открыть давление</button></div>';
    return '';
  }

  /* ---------- Вкладка «Программа» ---------- */
  function customRows() {
    if (!S.custom.length) return '<p class="muted small">Своих тренировок пока нет.</p>';
    return '<div class="list">' + S.custom.map(function (c) {
      var s = F.customSession(c), dn = doneEntry(s.id);
      return '<div class="srow"><button class="dot' + (dn ? ' done' : '') + '" data-a="openSess" data-id="' + esc(s.id) + '">' + (dn ? '✓' : '▶') + '</button><button class="grow tt" data-a="openSess" data-id="' + esc(s.id) + '"><div class="t">' + esc(s.title) + '</div><div class="s">' + c.items.length + ' упр. · ≈ ' + s.min + ' мин</div></button><button class="btn small ghost" data-a="startSess" data-id="' + esc(s.id) + '">Старт</button></div>';
    }).join('') + '</div>';
  }
  function vProg() {
    if (V.pmod === 'food') return vFood();
    var out = '<header class="top"><p class="kicker">Программа</p><h1>' + (S.mode === 'own' ? 'Мои тренировки' : 'План и тренировки') + '</h1></header>' + progSeg();
    if (S.mode !== 'own') {
      var cur = S.pos ? S.pos.week : 0;
      if (V.week == null) V.week = S.mode ? cur : 0;
      var w = V.week, wi = F.weekInfo(w), p = F.weekProgress(w), chips = '';
      for (var i = 0; i <= 12; i++) { var pp = F.weekProgress(i); chips += '<button class="wk' + (i === cur && S.mode ? ' now' : '') + (pp.done === pp.total ? ' full' : '') + '" data-a="selWeek" data-v="' + i + '" aria-pressed="' + (i === w) + '">' + i + '</button>'; }
      out += '<div class="chips" role="group" aria-label="Недели">' + chips + '</div>';
      out += '<section class="card flat"><div class="row"><span class="chip">' + esc(wi.blockName) + '</span>' + (w > 0 ? '<span class="chip plain">запас повторений ' + wi.rir + '</span>' : '') + (wi.deload ? '<span class="chip warn">разгрузка: меньше подходов</span>' : '') + (wi.test ? '<span class="chip warn">тесты</span>' : '') + '<span class="chip plain">выполнено ' + p.done + ' из ' + p.total + '</span></div>' +
        '<p class="small muted">' + (w === 0 ? 'Тонометр, резина, стартовые замеры и тесты.' : 'Три недели нагрузки, четвёртая лёгкая. Прогрессия сложностью, темпом и нагрузкой, не числом повторений.') + ' Тренировки можно делать в любом порядке и в любые дни.</p>' +
        (S.mode && w !== cur ? '<button class="btn small line" data-a="setWeek" data-v="' + w + '">Сделать неделю ' + w + ' текущей</button>' : '') + '</section>';
      out += '<section class="card"><div class="list">' + p.slots.map(function (x) { return sessRow(x.sess, F.DAYS[x.d]); }).join('') + '</div></section>';
      if (!S.mode) out += '<div class="notice info">Чтобы начать программу, выберите её на вкладке «Сегодня».</div>';
    }
    out += '<section class="card"><div class="row between"><h2>Мои тренировки</h2><button class="btn small" data-a="newCustom">Создать</button></div>' + customRows() + '</section>';
    out += '<section class="card"><h2>Быстрые тренировки</h2><div class="list">' + F.QUICK.map(function (q) { return '<div class="srow"><button class="grow tt" data-a="openSess" data-id="q:' + q.key + '"><div class="t">' + esc(q.title) + '</div><div class="s">' + esc(q.sub) + '</div></button><button class="btn small ghost" data-a="startSess" data-id="q:' + q.key + '">Старт</button></div>'; }).join('') + '</div></section>';
    return out;
  }

  /* ---------- Вкладка «Упражнения» ---------- */
  function vLib() {
    return '<header class="top"><p class="kicker">Библиотека</p><h1>Упражнения</h1></header>' + libShell('lib');
  }
  function libShell(ns) {
    var chips = ['Все'].concat(F.GROUPS).map(function (g) { return '<button class="wk wide" data-a="lgrp" data-ns="' + ns + '" data-v="' + esc(g) + '" aria-pressed="' + (V.lg === g) + '">' + esc(g) + '</button>'; }).join('');
    return '<input type="search" id="lq_' + ns + '" class="search" placeholder="Поиск упражнения" aria-label="Поиск упражнения" value="' + esc(V.lq) + '"><div class="chips" role="group" aria-label="Группы мышц">' + chips + '</div><div id="llist_' + ns + '"></div>';
  }
  function fillLib(ns, sel, act) {
    var box = $('#llist_' + ns); if (!box) return;
    var q = V.lq.trim().toLowerCase(), ids = F.libIds().filter(function (id) {
      var e = E[id]; if (V.lg !== 'Все' && F.group(id) !== V.lg) return false;
      return !q || (e.n + ' ' + e.m.join(' ') + ' ' + e.s.join(' ')).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return E[a].n.localeCompare(E[b].n, 'ru'); });
    if (!ids.length) { box.innerHTML = '<p class="muted center">Ничего не найдено.</p>'; return; }
    box.innerHTML = '<section class="card"><div class="list">' + ids.map(function (id) {
      var chk = sel ? '<span class="cb' + (sel.indexOf(id) >= 0 ? ' on' : '') + '">' + (sel.indexOf(id) >= 0 ? '✓' : '') + '</span>' : '<span class="muted">›</span>';
      return '<button class="item" data-a="' + act + '" data-ex="' + id + '">' + thumb(id) + '<div class="grow"><div class="t">' + esc(E[id].n) + '</div><div class="s">' + esc(E[id].m.join(', ')) + '</div></div>' + chk + '</button>';
    }).join('') + '</div></section>';
  }

  /* ---------- Вкладка «Прогресс» ---------- */
  function vStat() {
    var out = '<header class="top"><p class="kicker">Прогресс</p><h1>Итоги и замеры</h1></header><div class="seg scroll" role="group" aria-label="Раздел">' +
      [['over', 'Обзор'], ['body', 'Вес и талия'], ['bp', 'Давление'], ['tests', 'Тесты']].map(function (x) { return '<button data-a="stab" data-v="' + x[0] + '" aria-pressed="' + (V.stab === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
    if (V.stab === 'over') {
      var tot = 0; S.log.forEach(function (l) { tot += l.sec || 0; });
      out += '<div class="tiles"><div class="tile"><b>' + S.log.length + '</b><span>тренировок</span></div><div class="tile"><b>' + Math.round(tot / 60) + '</b><span>минут</span></div><div class="tile"><b>' + streak() + '</b><span>серия, дней</span></div><div class="tile"><b>' + bestStreak() + '</b><span>рекорд серии</span></div></div>';
      out += '<section class="card flat"><h3>Эта неделя</h3>' + weekStrip() + goalBar() + '</section>';
      if (S.mode === 'forma') out += '<section class="card flat"><div class="row between"><h3>Программа 12 недель</h3><b>' + F.programPct() + '%</b></div><div class="mini"><i style="width:' + F.programPct() + '%"></i></div><p class="small muted">Неделя ' + (S.pos ? S.pos.week : 0) + '. Процент считается по выполненным тренировкам.</p></section>';
      out += '<section class="card flat"><h3>История</h3>' + (S.log.length ? '<div class="list">' + S.log.slice(-15).reverse().map(function (l) { return '<div class="item"><div class="grow"><div class="t">' + esc(l.title) + '</div><div class="s">' + esc(D.fmtFull(l.date)) + ' · ' + Math.max(1, Math.round((l.sec || 0) / 60)) + ' мин' + (l.rir != null ? ' · запас ' + l.rir : '') + '</div></div></div>'; }).join('') + '</div>' : '<p class="muted">Пока пусто. Первая тренировка появится здесь.</p>') + '</section>';
    }
    if (V.stab === 'body') {
      var today = D.ymd(D.today()), cur = S.meas.filter(function (m) { return m.d === today; })[0] || {};
      out += '<section class="card"><h2>Утро, натощак</h2><div class="grid3"><label class="f">Вес, кг<input type="number" step="0.1" inputmode="decimal" id="m_w" value="' + (cur.w || '') + '"></label><label class="f">Талия, см<input type="number" step="0.5" inputmode="decimal" id="m_waist" value="' + (cur.waist || '') + '"></label><label class="f">Пульс покоя<input type="number" step="1" inputmode="numeric" id="m_hr" value="' + (cur.hr || '') + '"></label></div><p class="small muted">Талия: на уровне пупка, на выдохе. Пульс: утром лёжа.</p><button class="btn" data-a="saveMeas">Сохранить за сегодня</button></section>';
      [['w', 'Вес, кг'], ['waist', 'Талия, см'], ['hr', 'Пульс покоя']].forEach(function (c) {
        var vals = S.meas.filter(function (m) { return m[c[0]]; });
        if (!vals.length) return;
        var first = vals[0][c[0]], lastv = vals[vals.length - 1][c[0]], diff = Math.round((lastv - first) * 10) / 10;
        out += '<section class="card flat"><div class="row between"><h3>' + c[1] + '</h3><b>' + lastv + (vals.length > 1 ? ' <span class="muted small">(' + (diff > 0 ? '+' : '') + diff + ' с начала)</span>' : '') + '</b></div>' + spark(vals.slice(-30).map(function (m) { return m[c[0]]; })) + '</section>';
      });
      if (S.meas.length) out += '<section class="card flat"><h3>Записи</h3><div class="list">' + S.meas.slice(-8).reverse().map(function (m) { return '<div class="item"><div class="grow"><div class="t">' + esc(D.fmtFull(m.d)) + '</div><div class="s">' + [m.w ? m.w + ' кг' : '', m.waist ? 'талия ' + m.waist + ' см' : '', m.hr ? 'пульс ' + m.hr : ''].filter(Boolean).join(' · ') + '</div></div><button class="link" data-a="delMeas" data-d="' + m.d + '">Удалить</button></div>'; }).join('') + '</div></section>';
    }
    if (V.stab === 'bp') {
      var g = F.bpGate(), b14 = S.bp.slice(-14);
      out += '<section class="card"><h2>Домашнее давление</h2><p class="muted small">Плечевой тонометр, сидя после 5 минут покоя, два измерения с интервалом минута. Неделя: утром и вечером, 14 записей. Здесь можно записать среднее из двух.</p><div class="grid3"><label class="f">Верхнее<input type="number" inputmode="numeric" id="b_s"></label><label class="f">Нижнее<input type="number" inputmode="numeric" id="b_d"></label><label class="f">Когда<select id="b_t"><option value="утро">Утро</option><option value="вечер">Вечер</option></select></label></div><button class="btn" data-a="saveBp">Записать</button></section>';
      var msg = '';
      if (b14.length) {
        var sy = 0, di = 0; b14.forEach(function (x) { sy += x.sys; di += x.dia; });
        sy = Math.round(sy / b14.length); di = Math.round(di / b14.length);
        msg = '<div class="kv"><span>Записей в расчёте</span><b>' + b14.length + ' из 14</b></div><div class="kv"><span>Среднее</span><b>' + sy + '/' + di + '</b></div>';
        if (b14.length >= 14) msg += (g.state === 'high' ? '<div class="notice danger">Среднее от порога 135/85 для домашних измерений. До интервалов сначала врач. Приложение диагнозов не ставит.</div>' : '<div class="notice info">Среднее ниже порога 135/85 для домашних измерений (ESC/ESH). Интервалы разрешены, если самочувствие в порядке.</div>');
        else msg += '<p class="small muted">Для вывода нужно 14 записей.</p>';
      } else msg = '<p class="muted">Записей пока нет.</p>';
      out += '<section class="card flat"><h3>Среднее за неделю</h3>' + msg + '</section>';
      if (S.bp.length) out += '<section class="card flat"><h3>Записи</h3><div class="list">' + S.bp.slice(-10).reverse().map(function (m, i) { var idx = S.bp.length - 1 - i; return '<div class="item"><div class="grow"><div class="t">' + m.sys + '/' + m.dia + ' · ' + esc(m.when) + '</div><div class="s">' + esc(D.fmtFull(m.d)) + '</div></div><button class="link" data-a="delBp" data-v="' + idx + '">Удалить</button></div>'; }).join('') + '</div></section>';
    }
    if (V.stab === 'tests') {
      out += '<section class="card"><h2>Тесты</h2><p class="small muted">Недели 0, 4, 8, 12 готовой программы. Порядок в день теста: отжимания, через 5 минут пресс, через 5 минут планка. Подтягивания и ноги в отдельные дни. Планка в секундах. Значения можно вводить и вручную.</p><div class="scroll-x"><table class="tbl"><thead><tr><th>Показатель</th>' + F.TEST_WEEKS.map(function (w) { return '<th>Нед. ' + w + '</th>'; }).join('') + '</tr></thead><tbody>' +
        F.TEST_FIELDS.map(function (f) { return '<tr><td>' + esc(f.n) + '<div class="small muted">' + f.u + '</div></td>' + F.TEST_WEEKS.map(function (w) { var v = (S.tests[w] || {})[f.k]; return '<td><input type="number" inputmode="numeric" data-t="' + f.k + '" data-w="' + w + '" value="' + (v == null ? '' : v) + '" aria-label="' + esc(f.n + ', неделя ' + w) + '"></td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></section>';
    }
    return out;
  }

  /* ---------- Вкладка «Настройки» ---------- */
  function vSet() {
    var sw = function (k, t, sub) { return '<label class="switch"><span><b>' + t + '</b>' + (sub ? '<div class="small muted">' + sub + '</div>' : '') + '</span><input type="checkbox" data-a="tog" data-k="' + k + '"' + (S.s[k] ? ' checked' : '') + '></label>'; };
    var segm = function (a, items, cur) { return '<div class="seg" role="group">' + items.map(function (x) { return '<button data-a="' + a + '" data-v="' + x[0] + '" aria-pressed="' + (cur === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>'; };
    var out = '<header class="top"><p class="kicker">Настройки</p><h1>Приложение</h1></header>';
    out += '<section class="card"><h2>Программа</h2>' + segm('mode', [['forma', 'Готовая 12 недель'], ['own', 'Своя']], S.mode) + (S.mode === 'forma' ? '<label class="f">Текущая неделя<select data-pos>' + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (w) { return '<option value="' + w + '"' + ((S.pos ? S.pos.week : 0) === w ? ' selected' : '') + '>' + (w === 0 ? 'Неделя 0: подготовка' : 'Неделя ' + w) + '</option>'; }).join('') + '</select></label><div class="small muted">Неделя меняется кнопкой на экране «Сегодня» или здесь. Даты не нужны.</div>' + sw('bands', 'Есть резина с дверным креплением', 'Если нет, тяга резиной заменяется на Y-T-W лёжа') + '<button class="btn line" data-a="newCycle">Начать программу заново</button>' : '<p class="small muted">Готовая программа не используется. Тренировки берутся из раздела «Программа → Мои тренировки».</p>') + '</section>';
    out += '<section class="card"><h2>Голосовой тренер</h2>' + sw('voice', 'Голос', 'Нужен русский голос синтеза речи в Android') +
      '<div class="stack"><b>Подсказки по технике</b>' + segm('coach', [['off', 'Выкл'], ['short', 'Кратко'], ['full', 'Подробно']], S.s.coach) + '<div class="small muted">Во время упражнения голос говорит, как делать его правильно, а выделенная строка на экране показывает, что звучит сейчас.</div></div>' +
      '<label class="switch"><span><b>Напоминать про дыхание</b><div class="small muted">Голос подсказывает вдох и выдох: в метрономе по фазам, в планках и растяжках по очереди</div></span><input type="checkbox" data-a="tog" data-k="breath"' + (S.s.breath !== false ? ' checked' : '') + '></label>' +
      '<button class="btn ghost" data-a="testVoice">Проверить голос</button>' + sw('beep', 'Звуковые сигналы', 'Отсчёт трёх последних секунд') + sw('wake', 'Не гасить экран') + '</section>';
    var hr = F.zones();
    out += '<section class="card"><h2>Ваши данные</h2><div class="grid3"><label class="f">Возраст<input type="number" inputmode="numeric" data-set="age" min="14" max="90" value="' + (S.s.age || 50) + '"></label><label class="f">Пульс покоя<input type="number" inputmode="numeric" data-set="hrRest" min="35" max="110" value="' + (S.s.hrRest || 60) + '"></label><label class="f">Цель, мин/день<input type="number" inputmode="numeric" data-set="goalMin" min="5" max="240" value="' + (S.s.goalMin || 30) + '"></label></div><p class="small muted">Максимальный пульс ' + hr.max + ' (формула Танака). Зоны считаются по методу Карвонена и подставляются в тренировки.</p><button class="btn ghost" data-a="zones">Зоны пульса</button></section>';
    out += '<section class="card"><h2>Тема</h2>' + segm('theme', [['auto', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']], S.s.theme) + '</section>';
    out += '<section class="card"><h2>Данные</h2><p class="small muted">Всё хранится на этом устройстве. Скопируйте текст в надёжное место для резервной копии или вставьте сохранённый ранее.</p><textarea id="bk" spellcheck="false" aria-label="Резервная копия"></textarea><div class="row"><button class="btn small ghost" data-a="exp">Показать данные</button><button class="btn small ghost" data-a="copy">Копировать</button><button class="btn small line" data-a="imp">Загрузить из текста</button></div><div id="bkmsg" class="small muted"></div></section>';
    out += '<section class="card flat"><h3>О программе</h3><p class="small muted">Форма, версия ' + VERSION + '. Готовая программа составлена по данным Александра и открытым рекомендациям: ВОЗ 2020, ACSM 2009, ESC/ESH 2018, Tanaka 2001. Расчёты пульсовых зон оценочные. Приложение не ставит диагнозов и не заменяет врача.</p></section>';
    return out;
  }

  function render() {
    applyTheme();
    var f = { today: vToday, prog: vProg, lib: vLib, stat: vStat, set: vSet }[V.tab];
    var app = $('#app'), keep = window.scrollY;
    app.innerHTML = '<main class="page">' + f() + '</main>';
    document.querySelectorAll('.tabbar button').forEach(function (b) { if (b.dataset.v === V.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (V.tab === 'lib') fillLib('lib', null, 'card');
    window.scrollTo(0, keep);
  }

  /* ---------- Карточка упражнения ---------- */
  function cuesList(id, cls) {
    return '<ol class="cues ' + (cls || '') + '">' + F.cues(id).map(function (c, i) { return '<li data-i="' + i + '">' + esc(c) + '</li>'; }).join('') + '</ol>';
  }
  /* Подробное описание: F.DET[id] */
  function detCard(id) {
    var d = (F.DET || {})[id]; if (!d) return '';
    var li = function (a) { return '<ul>' + a.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; };
    var h = '<section class="card det"><h3>Подробно</h3>';
    if (d.aka) h += '<p class="aka">' + esc(d.aka) + '</p>';
    h += '<h4>Исходное положение</h4><p>' + esc(d.start) + '</p>';
    if (d.hold) h += '<h4>Как держать рюкзак или опору</h4><p>' + esc(d.hold) + '</p>';
    h += '<h4>Как выполнять</h4><ol>' + d.steps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>';
    if (d.breath) h += '<h4>Дыхание</h4><p>' + esc(d.breath) + '</p>';
    if (d.mist && d.mist.length) h += '<h4>Частые ошибки</h4>' + li(d.mist);
    if (d.easy && d.easy !== '—') h += '<h4>Легче</h4><p>' + esc(d.easy) + '</p>';
    if (d.hard && d.hard !== '—') h += '<h4>Сложнее</h4><p>' + esc(d.hard) + '</p>';
    if (d.stop) h += '<div class="notice">' + esc(d.stop) + '</div>';
    return h + '</section>';
  }

  function openCard(id, ctx) {
    var e = E[id]; if (!e) return;
    var last = S.last[id], el = document.createElement('div');
    el.innerHTML = '<div class="sheet"><div class="bar"><button class="iconbtn" data-a="back" aria-label="Назад">' + IC.back + '</button><h2 class="grow">' + esc(e.n) + '</h2></div>' +
      mediaBox(id, true) +
      '<section class="card"><div class="row between"><h3>Как делать</h3>' + (F.audio.ok() ? '<button class="btn small ghost" data-a="sayCard" data-ex="' + id + '">' + IC.vol + ' Озвучить</button>' : '') + '</div>' + cuesList(id) + (ctx && ctx.tempo ? '<div class="notice info">Темп ' + esc(ctx.tempo) + ': первая цифра секунды опускания (самая тяжёлая часть), вторая пауза, третья подъём.</div>' : '') + '<p class="small muted">Дышите ровно, выдох на усилии, дыхание не задерживайте. При боли в суставе остановитесь и замените упражнение.</p></section>' + detCard(id) +
      '<section class="card"><h3>Область внимания</h3><div class="row">' + e.m.map(function (m) { return '<span class="chip">' + esc(m) + '</span>'; }).join('') + e.s.map(function (m) { return '<span class="chip plain">' + esc(m) + '</span>'; }).join('') + '</div></section>' +
      (last ? '<section class="card flat"><h3>Прошлый раз</h3><p>' + esc(D.fmtFull(last.date)) + ': ' + last.reps.join(' · ') + ' повторений' + (last.kg ? ', ' + last.kg + ' кг' : '') + '</p></section>' : '') +
      '<a class="btn ghost block ytlink" href="' + ytUrl(id) + '" target="_blank" rel="noopener">Смотреть на YouTube</a></div>';
    pushOv(el, 'card'); mountAll(el, ctx && ctx.tempo);
  }

  /* ---------- Лист занятия ---------- */
  function openSess(id) {
    if (!F.sessById(id)) return;
    var el = document.createElement('div'); fillSess(el, id); pushOv(el, 'sess');
  }
  function fillSess(el, id) {
    var s = F.sessById(id); if (!s) return;
    var body = '', sub = '';
    var isBuilt = /^\d+-\d+$/.test(id), w = 0, d = 0;
    if (isBuilt) { var p = id.split('-'); w = +p[0]; d = +p[1]; sub = 'Неделя ' + w + ' · обычно ' + F.DAYS_FULL[d].toLowerCase(); }
    else if (id.indexOf('c:') === 0) sub = 'Моя тренировка'; else sub = 'Быстрая тренировка';
    if (s.kind === 'prep') {
      var tasks = [['tono', 'Купить плечевой тонометр'], ['bp7', '7 дней измерять давление утром и вечером (раздел «Прогресс → Давление»)'], ['bands', 'Купить набор резин разной жёсткости с дверным креплением'], ['bar', 'Дверной распорный турник, по желанию (проверьте проём и нагрузку)'], ['hrmax', 'Посмотреть максимальный пульс в часах; если отличается от расчётного, использовать своё значение'], ['meas', 'Утром натощак: вес, пульс покоя лёжа, талия (раздел «Прогресс → Вес и талия»)'], ['photo', 'Фото в профиль для сравнения']];
      body = '<section class="card"><h3>Список подготовки</h3>' + tasks.map(function (t) { return '<label class="switch"><span>' + esc(t[1]) + '</span><input type="checkbox" data-a="chk" data-k="' + t[0] + '"' + (S.checks[t[0]] ? ' checked' : '') + '></label>'; }).join('') + '</section><button class="btn" data-a="goMeas">Открыть замеры</button>';
    } else {
      var tools = '';
      if (isBuilt && F.baseItems(w, d)) tools = '<div class="row"><button class="btn small ghost" data-a="cfg" data-id="' + id + '">Настроить подходы</button><button class="btn small line" data-a="saveAsOwn" data-id="' + id + '">Сохранить как свою</button></div>' + (S.over[id] ? '<div class="small muted">Настройки изменены. <button class="link" data-a="cfgReset" data-id="' + id + '">Сбросить</button></div>' : '');
      if (id.indexOf('c:') === 0) tools = '<div class="row"><button class="btn small ghost" data-a="editCustom" data-id="' + id.slice(2) + '">Изменить</button><button class="btn small line" data-a="dupCustom" data-id="' + id.slice(2) + '">Копия</button></div>';
      body = gateNotice(s) + '<section class="card"><p class="muted">' + esc(s.sub) + '</p>' + (s.preview.length ? exRows(s.preview, 99) : '') + tools + '</section>' + (s.kind !== 'rest' ? '<div class="cta"><button class="btn block" data-a="startSess" data-id="' + esc(id) + '">Начать</button></div>' : '');
    }
    el.innerHTML = '<div class="sheet" data-sid="' + esc(id) + '"><div class="bar"><button class="iconbtn" data-a="back" aria-label="Назад">' + IC.back + '</button><div class="grow"><div class="small muted">' + esc(sub) + '</div><h2>' + esc(s.title) + '</h2></div></div>' + body + '</div>';
  }

  /* ---------- Настройка подходов в занятии программы ---------- */
  function openCfg(id) {
    var el = document.createElement('div'); el.dataset.cfg = id; pushOv(el, 'cfg'); renderCfg(el, id);
  }
  function renderCfg(el, id) {
    var p = id.split('-'), base = F.baseItems(+p[0], +p[1]) || [], o = S.over[id] || {}, rm = o._rm || [], eff = F.applyOver(id, base), by = {};
    eff.forEach(function (it) { by[it.ex] = it; });
    var keep = el.scrollTop;
    el.innerHTML = '<div class="sheet"><div class="bar"><button class="iconbtn" data-a="back" aria-label="Назад">' + IC.back + '</button><div class="grow"><div class="small muted">Только для этой тренировки</div><h2>Настроить</h2></div></div>' +
      base.map(function (it) {
        var off = rm.indexOf(it.ex) >= 0, c = by[it.ex] || it, isT = !!it.sec, val = isT ? c.sec[0] : c.reps[0];
        return '<section class="card ' + (off ? 'off' : '') + '"><div class="row between"><div class="row nowrap">' + thumb(it.ex) + '<b>' + esc(E[it.ex].n) + '</b></div><button class="btn small ' + (off ? 'ghost' : 'line') + '" data-a="cfgRm" data-id="' + id + '" data-ex="' + it.ex + '">' + (off ? 'Вернуть' : 'Убрать') + '</button></div>' +
          (off ? '' : '<div class="cfgrow"><span>Подходы</span>' + stepper('cfgSets', id, it.ex, c.sets) + '</div><div class="cfgrow"><span>' + (isT ? 'Секунды' : 'Повторения') + ' <i class="small muted">в программе ' + (isT ? rangeTxt(it.sec) : rangeTxt(it.reps)) + '</i></span>' + stepper('cfgN', id, it.ex, val) + '</div><div class="cfgrow"><span>Отдых, с</span>' + stepper('cfgRest', id, it.ex, c.rest || 0) + '</div>') + '</section>';
      }).join('') + '<p class="small muted">В разгрузочные недели подходов становится меньше автоматически. Повторы фиксируются на выбранном числе.</p><button class="btn line" data-a="cfgReset" data-id="' + id + '">Сбросить все настройки</button></div>';
    el.scrollTop = keep;
  }
  function stepper(a, id, ex, v) {
    return '<div class="stp"><button data-a="' + a + '" data-id="' + id + '" data-ex="' + ex + '" data-d="-1" aria-label="Меньше">−</button><output>' + v + '</output><button data-a="' + a + '" data-id="' + id + '" data-ex="' + ex + '" data-d="1" aria-label="Больше">+</button></div>';
  }
  function cfgChange(id, ex, kind, dir) {
    var base = F.baseItems(+id.split('-')[0], +id.split('-')[1]) || [], it = base.filter(function (x) { return x.ex === ex; })[0]; if (!it) return;
    var o = S.over[id] || (S.over[id] = {}), q = o[ex] || (o[ex] = {}), cur = F.applyOver(id, base).filter(function (x) { return x.ex === ex; })[0] || it;
    if (kind === 'sets') q.sets = Math.max(1, Math.min(10, cur.sets + dir));
    if (kind === 'n') { var isT = !!it.sec, v = isT ? cur.sec[0] : cur.reps[0]; q.n = Math.max(1, Math.min(isT ? 1800 : 200, v + dir * (isT ? 5 : 1))); }
    if (kind === 'rest') q.rest = Math.max(0, Math.min(300, (cur.rest || 0) + dir * 15));
    save();
    var el = document.querySelector('[data-cfg="' + id + '"]'); if (el) renderCfg(el, id);
  }

  /* ---------- Конструктор своей тренировки ---------- */
  var B = null;
  var TIMED = ['hollow', 'sideplank', 'plank', 'wallsit', 'longlever', 'boat', 'climber', 'climberslow', 'march', 'joints', 'child', 'walk', 'highknee', 'shadow', 'stepfast', 'lowjack', 'sidestep', 'hipflexor', 'hamstring', 'shoulderwall', 'quadstretch', 'chest', 'glutestretch', 'tricepstretch', 'birddog'];
  function newItem(ex) {
    var t = TIMED.indexOf(ex) >= 0, it = { ex: ex, sets: 3, rest: 45, side: F.isUni(ex) };
    if (t) it.sec = 30; else it.reps = 10;
    return it;
  }
  function openBuilder(cid, preset) {
    var c = cid ? S.custom.filter(function (x) { return String(x.id) === String(cid); })[0] : null;
    B = c ? JSON.parse(JSON.stringify(c)) : (preset || { id: null, name: '', warm: true, cool: false, items: [] });
    var el = document.createElement('div'); el.id = 'bld'; pushOv(el, 'bld'); renderBuilder();
  }
  function renderBuilder() {
    var el = $('#bld'); if (!el || !B) return;
    var keep = el.scrollTop, mins = B.items.length ? F.customSession(B).min : 0;
    el.innerHTML = '<div class="sheet"><div class="bar"><button class="iconbtn" data-a="bBack" aria-label="Назад">' + IC.back + '</button><h2 class="grow">' + (B.id ? 'Изменить тренировку' : 'Новая тренировка') + '</h2></div>' +
      '<label class="f">Название<input type="text" id="bname" maxlength="60" placeholder="Например, Ноги дома" value="' + esc(B.name) + '"></label>' +
      '<section class="card flat"><label class="switch"><span><b>Разминка 8 минут</b></span><input type="checkbox" data-a="bWarm"' + (B.warm ? ' checked' : '') + '></label><label class="switch"><span><b>Заминка 5 минут</b></span><input type="checkbox" data-a="bCool"' + (B.cool ? ' checked' : '') + '></label></section>' +
      B.items.map(function (it, i) {
        var isT = !!it.sec;
        return '<section class="card"><div class="row between"><div class="row nowrap">' + thumb(it.ex) + '<b>' + esc(E[it.ex].n) + '</b></div><div class="row nowrap"><button class="iconbtn sm" data-a="bUp" data-i="' + i + '" aria-label="Выше"' + (i === 0 ? ' disabled' : '') + '>' + IC.up + '</button><button class="iconbtn sm" data-a="bDown" data-i="' + i + '" aria-label="Ниже"' + (i === B.items.length - 1 ? ' disabled' : '') + '>' + IC.down + '</button><button class="iconbtn sm" data-a="bDel" data-i="' + i + '" aria-label="Убрать">' + IC.close + '</button></div></div>' +
          '<div class="cfgrow"><span>Подходы</span>' + bstep('bSets', i, it.sets) + '</div>' +
          '<div class="cfgrow"><span><div class="seg"><button data-a="bMode" data-i="' + i + '" data-v="reps" aria-pressed="' + !isT + '">Повторы</button><button data-a="bMode" data-i="' + i + '" data-v="sec" aria-pressed="' + isT + '">Секунды</button></div></span>' + bstep('bVal', i, isT ? it.sec : it.reps) + '</div>' +
          '<div class="cfgrow"><span>Отдых, с</span>' + bstep('bRest', i, it.rest) + '</div>' +
          '<label class="switch"><span>На каждую сторону</span><input type="checkbox" data-a="bSide" data-i="' + i + '"' + (it.side ? ' checked' : '') + '></label></section>';
      }).join('') +
      '<button class="btn ghost" data-a="bAdd">' + IC.plus + ' Добавить упражнение</button>' +
      '<div class="cta"><div class="small muted center">' + (B.items.length ? B.items.length + ' упр., около ' + mins + ' мин' : 'Добавьте хотя бы одно упражнение') + '</div><button class="btn block" data-a="bSave"' + (B.items.length ? '' : ' disabled') + '>Сохранить</button>' + (B.id ? '<button class="btn danger block" data-a="bRemove">Удалить тренировку</button>' : '') + '</div></div>';
    el.scrollTop = keep;
    var nm = $('#bname', el); if (nm) nm.addEventListener('input', function () { B.name = nm.value; });
  }
  function bstep(a, i, v) { return '<div class="stp"><button data-a="' + a + '" data-i="' + i + '" data-d="-1" aria-label="Меньше">−</button><output>' + v + '</output><button data-a="' + a + '" data-i="' + i + '" data-d="1" aria-label="Больше">+</button></div>'; }

  /* ---------- Выбор упражнений ---------- */
  var P = null;
  function openPicker() {
    P = { sel: [] }; V.lg = 'Все'; V.lq = '';
    var el = document.createElement('div'); el.id = 'pick'; pushOv(el, 'pick'); renderPicker(true);
  }
  function renderPicker(first) {
    var el = $('#pick'); if (!el) return;
    if (first) {
      el.innerHTML = '<div class="sheet"><div class="bar"><button class="iconbtn" data-a="back" aria-label="Назад">' + IC.back + '</button><h2 class="grow">Выбрать упражнения</h2></div>' + libShell('pick') + '<div class="cta"><button class="btn block" data-a="pickDone" id="pickBtn" disabled>Добавить</button></div></div>';
    } else {
      var chips = $('.chips', el); if (chips) chips.querySelectorAll('.wk').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.v === V.lg); });
    }
    fillLib('pick', P.sel, 'pickTog');
    var b = $('#pickBtn', el); if (b) { b.disabled = !P.sel.length; b.textContent = P.sel.length ? 'Добавить (' + P.sel.length + ')' : 'Добавить'; }
  }

  function openZones() {
    var el = document.createElement('div'), h = F.zones(), names = ['лёгкая ходьба, заминка', 'длинное кардио, можно говорить фразами', 'круговая 40/20', 'интервалы', 'в программе не используется'];
    el.innerHTML = '<div class="sheet"><div class="bar"><button class="iconbtn" data-a="back" aria-label="Назад">' + IC.back + '</button><h2 class="grow">Зоны пульса</h2></div><section class="card"><p class="small muted">Максимальный пульс ' + h.max + ' (формула Танака: 208 − 0,7 × возраст, разброс около 10 уд/мин), пульс покоя ' + h.rest + ', метод Карвонена. Возраст и пульс покоя меняются в настройках. Ориентируйтесь на самочувствие, а не только на цифры.</p><table class="tbl"><thead><tr><th>Зона</th><th>Пульс</th><th>Для чего</th></tr></thead><tbody>' + h.z.map(function (z, i) { return '<tr><td>' + (i + 1) + '</td><td>' + z[0] + '–' + z[1] + '</td><td>' + esc(names[i]) + '</td></tr>'; }).join('') + '</tbody></table></section></div>';
    pushOv(el, 'zones');
  }

  /* ---------- Тренировка ---------- */
  var R = null, timer = 0;

  function startSess(id) {
    var sess = F.sessById(id); if (!sess) return;
    if (F.isIntervals(sess)) {
      var g = F.bpGate();
      if (g.state === 'high') return dialog({ title: 'Сначала врач', text: 'Среднее давление по вашим записям ' + g.sys + '/' + g.dia + ' (порог для домашних измерений 135/85). Интервалы сегодня не рекомендуются: сначала обратитесь к врачу. Можно заменить занятие быстрой ходьбой в зоне 1–2.', btns: [{ t: 'Заменить прогулкой', fn: function () { beginSession(F.quickSession('walk')); } }, { t: 'Закрыть', cls: 'line' }] });
      if (g.state === 'few') return dialog({ title: 'Нужна неделя измерений', text: 'Интервалы начинайте после недели домашних измерений давления: 14 записей, утро и вечер. Сейчас записано ' + g.n + '. Если вы уже измеряли давление и согласовали нагрузку с врачом, можно подтвердить и продолжить.', btns: [{ t: 'Открыть давление', fn: function () { A.goBp(); } }, { t: 'Заменить прогулкой', cls: 'ghost', fn: function () { beginSession(F.quickSession('walk')); } }, { t: 'Подтверждаю, начать', cls: 'line', fn: function () { S.bpAck = true; save(); beginSession(sess); } }] });
    }
    var hard = ['strength', 'circuit', 'intervals', 'custom'].indexOf(sess.kind) >= 0;
    if (hard && S.log.some(function (l) { return l.date === D.ymd(D.today()) && ['strength', 'circuit', 'intervals', 'custom'].indexOf(l.kind) >= 0; })) {
      return dialog({ title: 'Сегодня уже была нагрузка', text: 'Две тяжёлые тренировки в один день снижают восстановление. Лучше сделать лёгкую подвижность или ходьбу, а эту оставить на другой день.', btns: [{ t: 'Подвижность 10 минут', fn: function () { beginSession(F.quickSession('mob')); } }, { t: 'Всё равно начать', cls: 'line', fn: function () { beginSession(sess); } }, { t: 'Отмена', cls: 'ghost' }] });
    }
    beginSession(sess);
  }
  function beginSession(sess) {
    var steps = sess.build();
    if (!steps.length) return;
    F.audio.unlock(); F.wake.on();
    R = { sess: sess, steps: steps, i: -1, res: [], t0: Date.now(), paused: false, extra: 0, tm: null, reps: 0, kg: '', lastBeep: null, seen: {}, cueIx: {} };
    var el = document.createElement('div'); el.id = 'run'; pushOv(el, 'run');
    go(0);
    timer = setInterval(tick, 100);
  }

  function go(i) {
    R.i = i; var st = R.steps[i];
    R.t0step = now(); R.extra = 0; R.paused = false; R.tm = null; R.lastBeep = null; R.said10 = false;
    R.reps = st.target || 0; R.kg = st.load ? (S.loads[st.ex] || '') : '';
    coachStop();
    renderRun();
    announce(st);
  }
  function next() {
    var st = R.steps[R.i];
    if (st.t === 'time' && !st.nolog && R.res.every(function (r) { return !(r.ex === st.ex && r.set === st.set && r.side === st.side && r.sec); })) R.res.push({ ex: st.ex, set: st.set, side: st.side || null, sec: st.sec });
    if (R.i >= R.steps.length - 1) return finish();
    go(R.i + 1);
  }
  function prevStep() {
    var i = R.i - 1; while (i > 0 && (R.steps[i].t === 'rest' || R.steps[i].t === 'prep')) i--;
    if (i >= 0) go(i);
  }

  /* ---------- Голосовой тренер ---------- */
  var CO = { tok: 0, tm: [] };
  function cueRoot() { return stack.length ? stack[stack.length - 1] : document; }
  function setNow(i, root) { (root || cueRoot()).querySelectorAll('.cues li').forEach(function (li) { li.classList.toggle('now', +li.dataset.i === i); }); }
  function coachStop() { CO.tok++; CO.tm.forEach(clearTimeout); CO.tm = []; F.audio.cancel(); setNow(-1); }
  /* lines: [{t: текст, i: номер подсказки на экране, gap: пауза после, silent}] */
  function coachPlay(lines, opt) {
    opt = opt || {};
    var tok = ++CO.tok, root = opt.root || cueRoot();
    (function step(k, delay) {
      CO.tm.push(setTimeout(function () {
        if (tok !== CO.tok) return;
        if (k >= lines.length || (opt.until && !opt.until())) { setNow(-1, root); if (opt.done) opt.done(); return; }
        var L = lines[k], fin = false;
        var adv = function () { if (fin || tok !== CO.tok) return; fin = true; step(k + 1, L.gap != null ? L.gap : (opt.gap || 600)); };
        setNow(L.i == null ? -1 : L.i, root);
        F.audio.say(L.t, { queue: true, onend: adv });
        CO.tm.push(setTimeout(adv, 1800 + L.t.length * 90));
      }, delay));
    })(0, opt.delay || 0);
  }
  function lastWorkEx() {
    for (var i = R.i - 1; i >= 0; i--) { var s = R.steps[i]; if ((s.t === 'time' || s.t === 'reps') && s.ex) return s.ex; }
    return null;
  }
  /* Ведение дыхания в удержаниях: «вдох», «выдох» по очереди; в долгих планках редкое напоминание */
  function paceBreath(st, tok) {
    var inh = true, long = st.sec > 90, gap = long ? 30000 : 3200;
    (function loop(delay) {
      CO.tm.push(setTimeout(function () {
        if (tok !== CO.tok) return;
        var s = R && R.steps[R.i]; if (s !== st) return;
        if (R.paused) { loop(1000); return; }
        var left = st.sec * 1000 + R.extra - (now() - R.t0step);
        if (left < 4000) return;
        F.audio.say(long ? 'Дышите ровно, без задержки' : (inh ? 'Вдох' : 'Выдох'), { queue: true });
        inh = !inh; loop(gap);
      }, delay));
    })(long ? 15000 : 1500);
  }
  function announce(st) {
    if (!F.audio.ok()) return;
    var lvl = S.s.coach || 'full', lines = [], ex = st.ex, cues = ex ? F.cues(ex) : [], prev = R.steps[R.i - 1], opt = {};
    if (st.t === 'prep') lines.push({ t: st.say || st.title });
    else if (st.t === 'info') lines.push({ t: st.title });
    else if (st.t === 'rest') {
      if (st.short && st.title !== 'Смена стороны') return;
      lines.push({ t: st.say || 'Отдых' });
      if (!st.short && st.next && E[st.next] && st.next !== lastWorkEx()) lines.push({ t: 'Дальше: ' + E[st.next].n });
    } else if (st.t === 'time' || st.t === 'reps') {
      var first = !R.seen[ex], afterPrep = prev && prev.t === 'prep';
      if (!afterPrep && (first || st.badge || st.t === 'time') && !(st.t === 'reps' && st.set > 1)) lines.push({ t: st.say || st.title });
      if (st.t === 'reps' && !st.quick && st.set > 1) lines.push({ t: 'Подход ' + st.set });
      if (st.side) lines.push({ t: st.side });
      var brOn = S.s.breath !== false, main = cues.slice(0, -1), bci = cues.length - 1;
      if (lvl !== 'off' && main.length) {
        var n;
        if (first) {
          n = lvl === 'full' ? Math.min(main.length, 4) : Math.min(main.length, 1);
          if (st.t === 'time' && st.sec >= 300) n = Math.min(n, 1);
          for (var k = 0; k < n; k++) lines.push({ t: main[k], i: k });
          R.cueIx[ex] = n;
        } else {
          var ix = (R.cueIx[ex] || 0) % main.length; R.cueIx[ex] = (R.cueIx[ex] || 0) + 1;
          lines.push({ t: main[ix], i: ix });
        }
      }
      /* напоминание про дыхание звучит в каждом подходе, даже при коротких подсказках */
      if ((brOn || lvl !== 'off') && cues.length && !(lvl === 'off' && !brOn)) lines.push({ t: cues[bci], i: bci });
      R.seen[ex] = true;
      if (st.t === 'time') {
        opt.delay = 800; opt.gap = 2200;
        if (st.sec < 300) opt.until = function () { var s = R.steps[R.i]; return s === st && !R.paused && (st.sec * 1000 + R.extra - (now() - R.t0step)) > 6000; };
        if (brOn && F.HOLDS.indexOf(ex) >= 0) { var tk = CO.tok + 1; opt.done = function () { paceBreath(st, tk); }; }
      }
    }
    if (lines.length) coachPlay(lines, opt);
  }
  function sayCard(id, btn) {
    if (btn.dataset.on === '1') { btn.dataset.on = ''; coachStop(); return; }
    var root = cueRoot(), cues = F.cues(id);
    btn.dataset.on = '1';
    coachPlay(cues.map(function (c, i) { return { t: c, i: i }; }), { root: root, gap: 500, done: function () { btn.dataset.on = ''; } });
  }

  /* ---------- Экран выполнения ---------- */
  var CIRC = 2 * Math.PI * 100;
  function ring(big) { return '<div class="ringwrap"><svg viewBox="0 0 220 220" aria-hidden="true"><circle class="ring-bg" cx="110" cy="110" r="100" fill="none" stroke-width="12"/><circle class="ring-fg" id="rg" cx="110" cy="110" r="100" fill="none" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + CIRC.toFixed(1) + '" stroke-dashoffset="0"/></svg><div class="big" id="tm"></div></div>'; }
  function exFor(st) { return st.t === 'rest' ? st.next : st.ex; }
  function runStage(st) {
    var id = exFor(st); if (!id || !E[id] || st.t === 'input' || st.t === 'stopwatch') return '';
    var e = E[id];
    if (e.media) return '<div class="run-top"><div class="stage" data-media="' + e.media + '" data-tempo="' + esc(st.t === 'rest' ? '' : st.tempo || '') + '"></div></div>';
    return '<div class="run-top"><div class="stage ph sm">' + IC.bell + '<div class="row center">' + e.m.map(function (m) { return '<span class="chip">' + esc(m) + '</span>'; }).join('') + '</div></div></div>';
  }
  function runCues(st) {
    var id = exFor(st); if (!id || !E[id] || ['info', 'input', 'stopwatch'].indexOf(st.t) >= 0) return '';
    return '<div class="cuebox"><div class="row between"><span class="small muted">' + (st.t === 'rest' ? 'Дальше: ' + esc(E[id].n) : 'Как делать') + '</span><a class="yt" href="' + ytUrl(id) + '" target="_blank" rel="noopener">YouTube</a></div>' + cuesList(id) + '</div>';
  }

  function renderRun() {
    var el = $('#run'); if (!el) return;
    var st = R.steps[R.i], n = R.steps.length, pct = Math.round(R.i / n * 100), body = '', ctl = '';
    var badge = st.badge ? '<span class="chip badge">' + esc(st.badge) + '</span>' : '';
    var dir = '<button class="btn line" data-a="rPrev">Назад</button>';
    var setLine = st.side ? '<div class="rsub">' + esc(st.side) + (st.sets > 1 ? ' · подход ' + st.set + ' из ' + st.sets : '') + '</div>' : (st.sets > 1 ? '<div class="rsub">Подход ' + st.set + ' из ' + st.sets + '</div>' : '');
    if (st.t === 'prep') {
      body = '<div class="kick">Приготовьтесь</div><div class="rtitle">' + esc(st.title) + '</div><div class="rsub">' + esc(st.sub) + '</div>' + ring();
      ctl = '<div class="runctl">' + dir + '<button class="btn ghost" data-a="rPause">Пауза</button><button class="btn" data-a="rSkip">Начать сейчас</button></div>';
    } else if (st.t === 'rest') {
      body = '<div class="rtitle">' + esc(st.title) + '</div>' + ring() + '<div class="rsub">' + esc(st.sub) + '</div>';
      ctl = '<div class="runctl rest"><button class="btn line" data-a="rPlus">+15 с</button><button class="btn ghost" data-a="rPause">Пауза</button><button class="btn" data-a="rSkip">Пропустить</button></div>';
    } else if (st.t === 'time') {
      body = badge + '<div class="rtitle">' + esc(st.title) + '</div>' + setLine + ring() + (st.sub ? '<div class="rsub">' + esc(st.sub) + '</div>' : '') + (st.range && st.range[0] !== st.range[1] ? '<div class="rsub small">Диапазон ' + rangeTxt(st.range, ' с') + '</div>' : '');
      ctl = '<div class="runctl">' + dir + '<button class="btn ghost" data-a="rPause">Пауза</button><button class="btn" data-a="rSkip">' + (st.skippable ? 'Дальше' : 'Пропустить') + '</button></div>';
    } else if (st.t === 'reps') {
      var e = E[st.ex];
      body = badge + '<div class="rtitle">' + esc(st.title) + '</div>' + (st.quick ? '<div class="rsub">' + (st.side ? esc(st.side) + ' · ' : '') + 'Выполните ' + st.target + ' повторений</div>' : setLine);
      if (!st.quick) {
        body += '<div class="repsrow"><div class="tgt"><div class="small muted">Цель</div><b>' + st.target + '</b><div class="small muted">' + (st.range && st.range[0] !== st.range[1] ? 'диапазон ' + rangeTxt(st.range) : 'не до отказа') + '</div></div><div class="stepper"><button data-a="rMinus" aria-label="Меньше">−</button><output id="rp">' + R.reps + '</output><button data-a="rPlus1" aria-label="Больше">+</button></div></div>';
        if (st.tempo) body += '<div class="phasebox"><div class="small muted">Темп ' + esc(st.tempo) + ' (опускание, пауза, подъём, секунды)</div><div id="tph"><button class="btn small ghost" data-a="tmOn">Включить метроном</button></div><div class="mini"><i id="tpb"></i></div></div>';
        if (st.load) body += '<label class="f">Нагрузка, кг<input type="number" step="0.5" min="0" inputmode="decimal" id="kg" value="' + esc(R.kg) + '" placeholder="' + (e && e.id === 'dbraise' ? '4' : 'вес рюкзака') + '"></label>';
      }
      ctl = '<div class="runctl">' + dir + '<button class="btn" data-a="rDone">Готово</button><button class="btn line" data-a="rSkip">Пропустить</button></div>';
    } else if (st.t === 'info') {
      body = badge + '<div class="rtitle">' + esc(st.title) + '</div><div class="rtext">' + esc(st.sub) + '</div>';
      ctl = '<div class="runctl two">' + dir + '<button class="btn" data-a="rSkip">' + esc(st.btn || 'Дальше') + '</button></div>';
    } else if (st.t === 'input') {
      body = '<div class="rtitle">' + esc(st.title) + '</div><div class="rsub">' + esc(st.sub) + '</div><label class="f">Результат, ' + esc(st.unit) + '<input type="number" inputmode="numeric" id="inp" min="0" style="font-size:32px;text-align:center"></label>';
      ctl = '<div class="runctl two">' + dir + '<button class="btn" data-a="rInput">Сохранить</button></div>';
    } else if (st.t === 'stopwatch') {
      body = '<div class="rtitle">' + esc(st.title) + '</div><div class="rsub">' + esc(st.sub) + '</div><div class="big" id="tm">0:00</div>';
      ctl = '<div class="runctl two"><button class="btn ghost" data-a="rPause">Пауза</button><button class="btn" data-a="rStop">Стоп</button></div>';
    }
    var vb = F.audio.ok() ? IC.vol : IC.mute;
    el.innerHTML = '<div class="run"><div class="bar"><button class="iconbtn" data-a="rExit" aria-label="Выйти из тренировки">' + IC.close + '</button><div class="prog"><i style="width:' + pct + '%"></i></div><span class="small muted">' + (R.i + 1) + '/' + n + '</span><button class="iconbtn" data-a="rVoice" aria-label="Голос включить или выключить">' + vb + '</button></div>' + runStage(st) + '<div class="run-body">' + body + runCues(st) + '</div>' + ctl + '</div>';
    mountAll(el, st.tempo);
    tick(true);
  }

  function setText(id, t) { var x = $('#' + id); if (x && x.textContent !== t) x.textContent = t; }
  function tick(first) {
    if (!R) return;
    var st = R.steps[R.i]; if (!st) return;
    if (R.paused) return;
    var el = now() - R.t0step;
    if (st.t === 'prep' || st.t === 'rest' || st.t === 'time') {
      var total = st.sec * 1000 + R.extra, rem = total - el, sec = Math.ceil(rem / 1000);
      setText('tm', st.t === 'prep' ? String(Math.max(0, sec)) : fmtTime(rem / 1000));
      var rg = $('#rg'); if (rg) rg.setAttribute('stroke-dashoffset', (CIRC * (1 - Math.max(0, Math.min(1, rem / total)))).toFixed(1));
      if (!first && sec <= 3 && sec >= 1 && R.lastBeep !== sec && (st.sec >= 10 || st.t === 'prep')) { R.lastBeep = sec; F.audio.beep(660, 90); }
      if (!first && st.t === 'time' && st.sec >= 30 && rem <= 10500 && rem > 3000 && !R.said10 && F.audio.ok()) { R.said10 = true; F.audio.say('Осталось десять секунд', { queue: true }); }
      if (!first && rem <= 0) { F.audio.beep(990, 260); next(); }
    } else if (st.t === 'stopwatch') {
      setText('tm', fmtTime(el / 1000 - 0.999));
    } else if (st.t === 'reps' && R.tm) tickTempo();
  }
  function tickTempo() {
    var st = R.steps[R.i], d = parseTempo(st.tempo), tm = R.tm; if (!d) return;
    var cyc = d[0] + d[1] + d[2] + d[3], el = (now() - tm.t0) / 1000, k = Math.floor(el / cyc), x = el - k * cyc, ph = 0, acc = 0, names = ['Опускание', 'Пауза', 'Подъём', 'Пауза вверху'];
    for (var i = 0; i < 4; i++) { if (d[i] === 0) continue; if (x < acc + d[i]) { ph = i; break; } acc += d[i]; ph = i; }
    var left = acc + d[ph] - x;
    var cnt = '';
    if (k > tm.k) { tm.k = k; R.reps = Math.min(99, k); setText('rp', String(R.reps)); cnt = String(R.reps); }
    if (ph !== tm.ph) {
      tm.ph = ph; F.audio.beep([520, 700, 880, 700][ph], 80);
      /* дыхание: вдох на первой фазе (опускание), выдох на усилии (подъём) */
      var word = S.s.breath === false ? '' : (ph === 0 ? 'Вдох' : (ph === 2 ? 'Выдох' : ''));
      if (cnt || word) F.audio.say((cnt ? cnt + '. ' : '') + word);
    } else if (cnt) F.audio.say(cnt);
    var box = $('#tph'); if (box) box.innerHTML = '<b>' + names[ph] + ' ' + Math.ceil(left) + '</b> <button class="btn small line" data-a="tmOff">Выключить</button>';
    var bar = $('#tpb'); if (bar) bar.style.width = (x / cyc * 100).toFixed(1) + '%';
  }

  function finish() {
    clearInterval(timer); timer = 0; F.wake.off(); coachStop(); F.audio.say('Тренировка завершена');
    var sec = Math.round((Date.now() - R.t0) / 1000), sets = R.res.length, el = $('#run');
    var strength = R.sess.kind === 'strength' || R.sess.kind === 'custom';
    el.innerHTML = '<div class="run"><div class="run-body"><div class="rtitle">Готово</div><div class="rsub">' + esc(R.sess.title) + '</div><div class="card flat"><div class="kv"><span>Время</span><b>' + fmtTime(sec) + '</b></div>' + (sets ? '<div class="kv"><span>Записано подходов</span><b>' + sets + '</b></div>' : '') + '<div class="kv"><span>Серия дней</span><b>' + (streak() + (doneToday() ? 0 : 1)) + '</b></div></div>' +
      (strength ? '<div class="stack center"><div class="small muted">Запас повторений в последнем рабочем подходе</div><div class="seg" style="align-self:center" role="group" aria-label="Запас повторений">' + [['0', '0'], ['1', '1'], ['2', '2'], ['3', '3+']].map(function (x) { return '<button data-a="rir" data-v="' + x[0] + '" aria-pressed="false">' + x[1] + '</button>'; }).join('') + '</div><div class="small muted">Если запас 2 и больше во всех подходах на верхней границе диапазона, в следующем блоке усложняйте.</div></div>' : '') +
      '</div><button class="btn" data-a="rSave">Сохранить</button></div>';
  }
  function doneToday() { return S.log.some(function (l) { return l.date === D.ymd(D.today()); }); }
  function saveRun() {
    var by = {};
    R.res.forEach(function (r) { if (!r.reps) return; var b = by[r.ex] || (by[r.ex] = { reps: [], kg: 0 }); b.reps.push(r.reps); if (r.kg) b.kg = Math.max(b.kg, r.kg); });
    Object.keys(by).forEach(function (k) { S.last[k] = { reps: by[k].reps, kg: by[k].kg || null, date: D.ymd(D.today()) }; });
    S.log.push({ id: R.sess.id, cy: S.cycle || 1, date: D.ymd(D.today()), title: R.sess.title, kind: R.sess.kind, sec: Math.round((Date.now() - R.t0) / 1000), res: R.res, rir: R.rir == null ? null : R.rir });
    save(); endRun();
  }
  function endRun() { clearInterval(timer); timer = 0; F.wake.off(); coachStop(); R = null; closeAll(); render(); }
  function runExit() {
    if (!R) return;
    R.paused = true; R.pauseAt = now(); coachStop();
    var btns = [{ t: 'Продолжить', fn: function () { R.t0step += now() - R.pauseAt; R.paused = false; } }];
    if (R.res.length) btns.push({ t: 'Завершить и сохранить', cls: 'ghost', fn: function () { R.paused = false; finish(); } });
    btns.push({ t: 'Выйти без сохранения', cls: 'danger', fn: function () { endRun(); } });
    dialog({ title: 'Выйти из тренировки?', text: 'Прогресс текущего занятия не сохранится, если выйти без сохранения.', btns: btns });
  }

  /* ---------- Питание (версия 0.4): меню, рецепты, покупки ---------- */
  var FD = F.FOOD, FOODS = FD.foods, RECS = {}, SLOTS = ['b', 'l', 's', 'd'];
  var SLOT_N = { b: 'Завтрак', l: 'Обед', s: 'Перекус', d: 'Ужин' };
  var SLOT_PL = { b: 'Завтраки', l: 'Обеды', s: 'Перекусы', d: 'Ужины' };
  var VEG = ['carrot', 'beet', 'onion', 'cabbage', 'potato', 'tomato', 'cucumber', 'pepper', 'zucchini'];
  var RK = 1; /* множитель порций в открытом рецепте */
  FD.recipes.forEach(function (r) { RECS[r.id] = r; });
  V.pmod = 'train'; V.ntab = 'menu'; V.fday = D.dow(D.today()); V.rslot = 'all';

  var r0 = function (x) { return Math.round(x); };
  var f1 = function (x) { return (Math.round(x * 10) / 10).toString().replace('.', ','); };
  function nutr(r, k) {
    k = k || 1;
    var t = { kcal: 0, p: 0, f: 0, c: 0, salt: (r.salt || 0) * k, veg: 0 };
    r.ingr.forEach(function (it) {
      var f = FOODS[it[0]], x = it[1] * k / 100;
      t.kcal += f.v[0] * x; t.p += f.v[1] * x; t.f += f.v[2] * x; t.c += f.v[3] * x; t.salt += (f.s || 0) * x;
      if (f.cat === 'Овощи и фрукты') t.veg += it[1] * k;
    });
    return t;
  }
  function frac(n) {
    var w = Math.floor(n + 1e-9);
    if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
    if (Math.abs(n - w - 0.5) < 1e-6) return (w ? w + ' ' : '') + '½';
    return null;
  }
  function qty(id, g, k) {
    var f = FOODS[id], t, n;
    if (f.piece) {
      n = g / f.piece; t = frac(n);
      if (t) return t + ' ' + (f.pn === 'ломтик' ? (n === 1 ? 'ломтик' : (n < 5 ? 'ломтика' : 'ломтиков')) : 'шт') + ' (' + r0(g) + ' г)';
    }
    if (f.tsp) { n = g / f.tsp; t = frac(n); if (t) return t + ' ч. л. (' + r0(g) + ' г)'; }
    return (k === 1 || g < 20 ? r0(g) : r0(g / 5) * 5) + ' г';
  }
  function eff(i) {
    var b = FD.menu[i], o = {};
    SLOTS.forEach(function (s) { o[s] = (S.food.swap && S.food.swap[i + ':' + s]) || b[s]; });
    return o;
  }
  function dateOf(i) { return D.ymd(D.add(D.monday(D.today()), i)); }
  function dayTot(i, onlyEaten) {
    var e = eff(i), eat = S.food.eaten[dateOf(i)] || {}, t = { kcal: 0, p: 0, f: 0, c: 0, salt: 0, veg: 0 };
    SLOTS.forEach(function (s) { if (onlyEaten && !eat[s]) return; var x = nutr(RECS[e[s]]); for (var k in t) t[k] += x[k]; });
    return t;
  }
  function eatCount(i) { var eat = S.food.eaten[dateOf(i)] || {}; return SLOTS.filter(function (s) { return eat[s]; }).length; }

  /* список покупок: округление до упаковки */
  function buy(id, g) {
    var f = FOODS[id], n, r;
    if (id === 'egg') { n = Math.ceil(g / f.piece - 1e-9); var pack = Math.ceil(n / 10) * 10; return pack + ' шт (нужно ' + n + ')'; }
    if (id === 'apple') return Math.ceil(g / 150 - 1e-9) + ' шт';
    if (id === 'banana') return Math.ceil(g / 100 - 1e-9) + ' шт';
    if (id === 'bread') return Math.ceil(g / 50 - 1e-9) * 50 + ' г (около ' + Math.ceil(g / 30 - 1e-9) + ' ломтиков)';
    if (id === 'oil') return Math.ceil(g / 0.92 / 50 - 1e-9) * 50 + ' мл';
    var gg = VEG.indexOf(id) >= 0 ? g * 1.1 : g, step = gg < 300 ? 50 : 100;
    r = Math.ceil(gg / step - 1e-9) * step;
    return r >= 1000 ? (r / 1000).toString().replace('.', ',') + ' кг' : r + ' г';
  }
  function shopList() {
    var need = {}, m = S.food.people || 1;
    for (var i = 0; i < 7; i++) { var e = eff(i); SLOTS.forEach(function (s) { RECS[e[s]].ingr.forEach(function (it) { need[it[0]] = (need[it[0]] || 0) + it[1]; }); }); }
    return Object.keys(need).map(function (id) { var g = need[id] * m; return { id: id, name: FOODS[id].n, cat: FOODS[id].cat, g: g, buy: buy(id, g) }; });
  }

  /* ---------- Экран «Программа → Питание» ---------- */
  function progSeg() {
    return '<div class="seg" role="group" aria-label="Что показать">' + [['train', 'Тренировки'], ['food', 'Питание']].map(function (x) { return '<button data-a="pmod" data-v="' + x[0] + '" aria-pressed="' + (V.pmod === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
  }
  function vFood() {
    var out = '<header class="top"><p class="kicker">Программа</p><h1>Питание</h1></header>' + progSeg() +
      '<div class="seg scroll" role="group" aria-label="Раздел питания">' + [['menu', 'Меню'], ['rec', 'Рецепты'], ['shop', 'Покупки'], ['info', 'Принципы']].map(function (x) { return '<button data-a="ntab" data-v="' + x[0] + '" aria-pressed="' + (V.ntab === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
    if (V.ntab === 'menu') out += foodMenu();
    else if (V.ntab === 'rec') out += foodRecipes();
    else if (V.ntab === 'shop') out += foodShop();
    else out += foodInfo();
    return out;
  }
  function bar(p) { return '<div class="mini"><i style="width:' + Math.max(0, Math.min(100, p)) + '%"></i></div>'; }
  function mealRow(i, s, withSwap) {
    var e = eff(i), id = e[s], r = RECS[id], t = nutr(r), date = dateOf(i), on = !!(S.food.eaten[date] || {})[s], sw = !!(S.food.swap && S.food.swap[i + ':' + s]);
    return '<div class="srow"><button class="cbbtn" data-a="eat" data-day="' + i + '" data-s="' + s + '" aria-pressed="' + on + '" aria-label="Отметить: ' + esc(SLOT_N[s]) + '"><span class="cb' + (on ? ' on' : '') + '">' + (on ? '✓' : '') + '</span></button>' +
      '<button class="grow tt" data-a="rec" data-id="' + id + '"><div class="s">' + SLOT_N[s] + (sw ? ' · заменено' : '') + '</div><div class="t">' + esc(r.name) + '</div><div class="s">' + r0(t.kcal) + ' ккал · белок ' + r0(t.p) + ' г · ' + r.min + ' мин</div></button>' +
      (withSwap ? '<button class="iconbtn sm" data-a="swap" data-day="' + i + '" data-s="' + s + '" aria-label="Заменить блюдо: ' + esc(SLOT_N[s]) + '">' + IC.swap + '</button>' : '') + '</div>';
  }
  function foodMenu() {
    var i = V.fday, bm = FD.menu[i], plan = dayTot(i), got = dayTot(i, true), n = eatCount(i);
    var chips = F.DAYS.map(function (d, k) { return '<button class="wk' + (k === D.dow(D.today()) ? ' now' : '') + (eatCount(k) === 4 ? ' full' : '') + '" data-a="fday" data-v="' + k + '" aria-pressed="' + (k === i) + '">' + d + '</button>'; }).join('');
    var out = '<div class="chips" role="group" aria-label="Дни недели">' + chips + '</div>';
    out += '<section class="card"><div class="row between"><h2>' + esc(bm.day) + ', ' + D.fmt(D.add(D.monday(D.today()), i)) + '</h2><span class="chip' + (n === 4 ? ' ok' : ' plain') + '">съедено ' + n + ' из 4</span></div>' +
      '<div class="goal"><div class="row between"><span class="small muted">Энергия, оценка</span><b>' + r0(got.kcal) + ' / ' + r0(plan.kcal) + ' ккал</b></div>' + bar(got.kcal / plan.kcal * 100) + '</div>' +
      '<div class="goal"><div class="row between"><span class="small muted">Белок, ориентир 110–130 г</span><b>' + r0(got.p) + ' / ' + r0(plan.p) + ' г</b></div>' + bar(got.p / plan.p * 100) + '</div>' +
      '<div class="list">' + SLOTS.map(function (s) { return mealRow(i, s, true); }).join('') + '</div>' +
      '<p class="small muted">Нажмите на кружок, когда поели. Название открывает рецепт. Завтрак не раньше чем через 3 часа после подъёма, ужин за 3 часа до сна.' + (bm.train ? ' В тренировочный день перекус съешьте в течение 1–2 часов после занятия.' : '') + '</p></section>';
    out += '<section class="card flat"><h3>День в цифрах (по плану)</h3>' +
      '<div class="nut4"><div><b>' + r0(plan.kcal) + '</b><span>ккал</span></div><div><b>' + r0(plan.p) + '</b><span>белок, г</span></div><div><b>' + r0(plan.f) + '</b><span>жир, г</span></div><div><b>' + r0(plan.c) + '</b><span>углев., г</span></div></div>' +
      '<div class="kv"><span>Овощи и фрукты (норма от 400 г)</span><b>' + r0(plan.veg / 10) * 10 + ' г</b></div><div class="kv"><span>Соль, оценка (норма менее 5 г)</span><b>' + f1(plan.salt) + ' г</b></div>' +
      '<p class="small muted">Числа оценочные: ошибка 10–15%. Это не лечебная диета.</p></section>';
    var hasSwap = Object.keys(S.food.swap || {}).length > 0;
    if (hasSwap) out += '<button class="btn line" data-a="menuReset">Вернуть меню по умолчанию</button>';
    return out;
  }
  function foodRecipes() {
    var chips = [['all', 'Все']].concat(SLOTS.map(function (s) { return [s, SLOT_PL[s]]; })).map(function (x) { return '<button class="wk wide" data-a="rslot" data-v="' + x[0] + '" aria-pressed="' + (V.rslot === x[0]) + '">' + x[1] + '</button>'; }).join('');
    var rows = FD.recipes.filter(function (r) { return V.rslot === 'all' || r.slot === V.rslot; }).map(function (r) {
      var t = nutr(r);
      return '<button class="item" data-a="rec" data-id="' + r.id + '"><div class="grow"><div class="t">' + esc(r.name) + '</div><div class="s">' + SLOT_N[r.slot] + ' · ' + r0(t.kcal) + ' ккал · белок ' + r0(t.p) + ' г · ' + r.min + ' мин</div></div><span class="muted">›</span></button>';
    }).join('');
    return '<div class="chips" role="group" aria-label="Приём пищи">' + chips + '</div><section class="card"><div class="list">' + rows + '</div></section><p class="small muted">Все рецепты на одну порцию. Внутри можно изменить число порций, количества пересчитаются.</p>';
  }
  function foodShop() {
    var list = shopList(), got = 0, m = S.food.people || 1;
    list.forEach(function (x) { if (S.food.shop[x.id]) got++; });
    var out = '<section class="card"><div class="row between"><h2>На неделю</h2><span class="chip plain">куплено ' + got + ' из ' + list.length + '</span></div>' + bar(got / list.length * 100) +
      '<div class="cfgrow"><span>Едоков <i class="small muted">количества умножаются</i></span><span class="stp"><button data-a="people" data-d="-1" aria-label="Меньше">−</button><output>' + m + '</output><button data-a="people" data-d="1" aria-label="Больше">+</button></span></div>' +
      '<div class="row"><button class="btn small ghost" data-a="shopCopy">Копировать список</button><button class="btn small line" data-a="shopReset">Снять отметки</button></div></section>';
    FD.cats.forEach(function (cat) {
      var items = list.filter(function (x) { return x.cat === cat; }); if (!items.length) return;
      out += '<section class="card"><h3>' + esc(cat) + '</h3><div class="list">' + items.map(function (x) {
        var on = !!S.food.shop[x.id];
        return '<button class="srow shopi' + (on ? ' got' : '') + '" data-a="shopTog" data-k="' + x.id + '" aria-pressed="' + on + '"><span class="cb' + (on ? ' on' : '') + '">' + (on ? '✓' : '') + '</span><span class="grow tt"><span class="t">' + esc(x.name) + '</span><span class="s block">по меню ' + r0(x.g) + ' г</span></span><b class="buy">' + esc(x.buy) + '</b></button>';
      }).join('') + '</div></section>';
    });
    out += '<section class="card flat"><h3>Проверьте дома</h3><p class="small muted">Соль (не более 5 г в сутки на всё), чёрный перец, паприка, зира для плова, лавровый лист, чеснок, лимон, зелень. Овощи, картофель и капуста даны с запасом 10% на очистки. Ягоды и брокколи можно брать замороженными.</p></section>';
    return out;
  }
  function foodInfo() {
    var kv = function (a, b, c) { return '<div class="kv"><span>' + a + (c ? '<div class="small muted">' + c + '</div>' : '') + '</span><b>' + b + '</b></div>'; };
    var li = function (a) { return '<ul class="ul">' + a.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'; };
    var out = '<section class="card"><h2>Ориентиры</h2>' +
      kv('Энергия', '2100–2300 ккал', 'оценка: расход 2470–2720 минус 300–500; проверка по весу и талии') +
      kv('Белок', '110–130 г', '1,35–1,6 г на кг; порции 30–40 г в основных приёмах') +
      kv('Овощи и фрукты', 'от 400 г', 'ВОЗ; в меню 700–910 г') +
      kv('Соль', 'менее 5 г', 'ВОЗ; считается и соль хлеба, сыра, мяса') +
      kv('Рыба', '2 раза в неделю', 'AHA 2018; в меню 3 раза') +
      kv('Жиры', 'около 30%', 'энергии; ВОЗ менее 30%') + '</section>';
    out += '<section class="card"><h3>Ритм дня</h3>' + li(['Завтрак через 3 часа и больше после подъёма.', 'Обед через 3–4 часа после завтрака, самый большой приём.', 'Перекус со сладким заложен каждый день; в тренировочный день сразу после занятия.', 'Ужин не позже чем за 3 часа до сна; если не успеваете, запеканка d3 или салат d5.']) + '</section>';
    out += '<section class="card"><h3>Соль и давление</h3><p class="small muted">Давление 130/85 относится к категории «высокое нормальное». Диетические подходы (DASH, средиземноморский, северный) снижали давление в среднем на 4,3/2,4 мм рт. ст. (Ndanuko, 2016). Меню построено на овощах, цельных крупах, рыбе, кисломолочных продуктах и с малым количеством соли.</p>' +
      li(['Солите в конце и щепоткой.', 'Скрытая соль: хлеб, сыр, колбасы, консервы, соленья, соусы.', 'На упаковке соль = натрий × 2,5.', 'Специи без соли: перец, паприка, зира, лимон, чеснок, зелень.', 'Домашнее давление измерьте до интервалов; при среднем от 135/85 сначала врач.']) + '</section>';
    out += '<section class="card"><h3>Сладкое</h3>' + li(['Одна порция сладкого в день уже в плане: шоколад 70% (20 г), мёд, банан, ягоды.', 'Шоколад отмеряйте заранее в контейнер.', 'Сорвались: ничего не «отрабатывайте», следующий приём по плану.']) + '</section>';
    out += '<section class="card"><h3>Корректировка раз в 2 недели</h3>' + li(['Вес падает на 0,25–0,5 кг в неделю, талия уменьшается: ничего не менять.', 'Вес и талия стоят при выполнении меню: убрать 150–200 ккал (2 ломтика хлеба или 2 ч. л. масла). Ниже 2000 ккал самостоятельно не опускаться.', 'Вес падает быстрее 0,7 кг в неделю, слабость, упали веса: добавить 150–200 ккал (картофель, крупа, банан).', 'Головокружение, сильная слабость, боль в груди: это не вопрос меню, остановиться и к врачу.']) + '<p class="small muted">Взвешивание утром до еды, 3 раза в неделю, среднее за неделю. Талия раз в неделю.</p></section>';
    out += '<div class="notice">Это не лечебная диета и не диагноз. Калории и белок посчитаны по справочным значениям продуктов, ошибка 10–15%. При диабете, болезнях почек, сердца, ЖКТ меню согласуйте с врачом. Подробности, расчёты и таблицы в Word «Программа питания».</div>';
    out += '<section class="card flat"><h3>Источники</h3><div class="stack small">' + [
      ['ВОЗ: здоровое питание (овощи и фрукты 400 г, соль менее 5 г, сахар, жиры)', 'https://who.int/europe/news-room/fact-sheets/item/nutrition---maintaining-a-healthy-lifestyle'],
      ['ВОЗ 2013: натрий менее 2 г, калий не менее 3,5 г', 'https://www.news-medical.net/news/20130131/Adults-should-consume-less-than-5-g-of-salt-and-at-least-3510-mg-of-potassium-per-day-WHO.aspx'],
      ['Ndanuko 2016: диета и давление (мета-анализ)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4717885'],
      ['AHA 2018: рыба дважды в неделю', 'https://www.sciencedaily.com/releases/2018/05/180517081837.htm'],
      ['Белок в пожилом возрасте и при снижении веса', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10272976']
    ].map(function (x) { return '<a href="' + x[1] + '" target="_blank" rel="noopener">' + esc(x[0]) + '</a>'; }).join('') + '</div></section>';
    return out;
  }
  function foodCard() {
    var i = D.dow(D.today()), n = eatCount(i), got = dayTot(i, true), plan = dayTot(i);
    return '<section class="card flat"><div class="row between"><h3>Питание сегодня</h3><span class="chip' + (n === 4 ? ' ok' : ' plain') + '">' + n + ' из 4</span></div>' +
      '<div class="list">' + SLOTS.map(function (s) { return mealRow(i, s, false); }).join('') + '</div>' +
      '<div class="goal"><div class="row between"><span class="small muted">Съедено, оценка</span><b>' + r0(got.kcal) + ' ккал · белок ' + r0(got.p) + ' г</b></div>' + bar(got.kcal / plan.kcal * 100) + '</div>' +
      '<button class="link" data-a="foodOpen">Меню на неделю, рецепты, покупки</button></section>';
  }

  /* рецепт */
  function openRecipe(id) { RK = 1; var el = document.createElement('div'); el.dataset.rid = id; fillRecipe(el, id); pushOv(el, 'rec'); }
  function fillRecipe(el, id) {
    var r = RECS[id], t = nutr(r, RK), keep = el.scrollTop;
    el.innerHTML = '<div class="sheet"><div class="bar"><button class="iconbtn" data-a="back" aria-label="Назад">' + IC.back + '</button><div class="grow"><div class="small muted">' + SLOT_N[r.slot] + ' · ' + r.id + '</div><h2>' + esc(r.name) + '</h2></div></div>' +
      '<section class="card"><div class="nut4"><div><b>' + r0(t.kcal) + '</b><span>ккал</span></div><div><b>' + r0(t.p) + '</b><span>белок, г</span></div><div><b>' + r0(t.f) + '</b><span>жир, г</span></div><div><b>' + r0(t.c) + '</b><span>углев., г</span></div></div>' +
      '<div class="row"><span class="chip plain">' + r.min + ' мин</span><span class="chip plain">соль ≈ ' + f1(t.salt) + ' г</span>' + (r.batch ? '<span class="chip">можно варить на ' + r.batch + ' порции</span>' : '') + '</div>' +
      '<div class="cfgrow"><span>Порции</span><span class="stp"><button data-a="rkMinus" data-id="' + id + '" aria-label="Меньше">−</button><output>' + frac(RK) + '</output><button data-a="rkPlus" data-id="' + id + '" aria-label="Больше">+</button></span></div>' +
      '<p class="small muted">Числа оценочные (ошибка 10–15%), на ' + (RK === 1 ? 'одну порцию' : frac(RK) + ' порции') + '.</p></section>' +
      '<section class="card"><h3>Продукты</h3><div class="list">' + r.ingr.map(function (it) { return '<div class="kv"><span>' + esc(FOODS[it[0]].n) + '</span><b>' + esc(qty(it[0], it[1] * RK, RK)) + '</b></div>'; }).join('') + '</div></section>' +
      '<section class="card det"><h3>Приготовление</h3><ol>' + r.steps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol></section>' +
      (r.tip ? '<div class="notice info">' + esc(r.tip) + '</div>' : '') + '</div>';
    el.scrollTop = keep;
  }
  function rkChange(id, d) {
    var n = Math.round((RK + d) * 2) / 2; RK = Math.max(0.5, Math.min(8, n));
    var el = document.querySelector('[data-rid="' + id + '"]'); if (el) fillRecipe(el, id);
  }

  /* замена блюда в меню */
  function openSwap(i, s) {
    var el = document.createElement('div'), cur = eff(i)[s];
    el.innerHTML = '<div class="sheet"><div class="bar"><button class="iconbtn" data-a="back" aria-label="Назад">' + IC.back + '</button><div class="grow"><div class="small muted">' + esc(FD.menu[i].day) + ' · ' + SLOT_N[s] + '</div><h2>Заменить блюдо</h2></div></div>' +
      '<section class="card"><div class="list">' + FD.recipes.filter(function (r) { return r.slot === s; }).map(function (r) {
        var t = nutr(r);
        return '<button class="item" data-a="swapTo" data-day="' + i + '" data-s="' + s + '" data-id="' + r.id + '"><div class="grow"><div class="t">' + esc(r.name) + '</div><div class="s">' + r0(t.kcal) + ' ккал · белок ' + r0(t.p) + ' г · ' + r.min + ' мин</div></div>' + (r.id === cur ? '<span class="chip ok">сейчас</span>' : '<span class="muted">›</span>') + '</button>';
      }).join('') + '</div></section><p class="small muted">Замена сохраняется для этого дня недели во всех неделях, список покупок пересчитается.</p></div>';
    pushOv(el, 'swap');
  }

  var FA = {
    pmod: function (el) { V.pmod = el.dataset.v; render(); },
    ntab: function (el) { V.ntab = el.dataset.v; render(); window.scrollTo(0, 0); },
    fday: function (el) { V.fday = +el.dataset.v; render(); },
    rslot: function (el) { V.rslot = el.dataset.v; render(); },
    foodOpen: function () { V.tab = 'prog'; V.pmod = 'food'; V.ntab = 'menu'; V.fday = D.dow(D.today()); render(); window.scrollTo(0, 0); },
    eat: function (el) {
      var d = dateOf(+el.dataset.day), s = el.dataset.s, m = S.food.eaten[d] || (S.food.eaten[d] = {});
      if (m[s]) delete m[s]; else m[s] = true;
      if (!Object.keys(m).length) delete S.food.eaten[d];
      save(); render();
    },
    rec: function (el) { openRecipe(el.dataset.id); },
    rkPlus: function (el) { rkChange(el.dataset.id, 0.5); },
    rkMinus: function (el) { rkChange(el.dataset.id, -0.5); },
    swap: function (el) { openSwap(+el.dataset.day, el.dataset.s); },
    swapTo: function (el) {
      var i = +el.dataset.day, s = el.dataset.s, id = el.dataset.id, key = i + ':' + s;
      if (FD.menu[i][s] === id) delete S.food.swap[key]; else S.food.swap[key] = id;
      save(); closeTop(true); toast('Меню обновлено');
    },
    menuReset: function () {
      dialog({ title: 'Вернуть меню по умолчанию?', text: 'Все замены блюд будут отменены, список покупок вернётся к исходному. Отметки «съедено» сохранятся.', btns: [{ t: 'Вернуть', fn: function () { S.food.swap = {}; save(); render(); } }, { t: 'Отмена', cls: 'line' }] });
    },
    people: function (el) { S.food.people = Math.max(1, Math.min(6, (S.food.people || 1) + +el.dataset.d)); save(); render(); },
    shopTog: function (el) { var k = el.dataset.k; if (S.food.shop[k]) delete S.food.shop[k]; else S.food.shop[k] = true; save(); render(); },
    shopReset: function () { S.food.shop = {}; save(); render(); },
    shopCopy: function () {
      var lines = ['Список покупок на неделю' + ((S.food.people || 1) > 1 ? ' (на ' + S.food.people + ')' : '')], list = shopList();
      FD.cats.forEach(function (cat) {
        var items = list.filter(function (x) { return x.cat === cat; }); if (!items.length) return;
        lines.push('', cat); items.forEach(function (x) { lines.push('☐ ' + x.name + ' — ' + x.buy); });
      });
      var text = lines.join('\n'), manual = function () { dialog({ title: 'Список покупок', html: '<textarea readonly id="shopTxt" aria-label="Список покупок">' + esc(text) + '</textarea><p class="small muted">Выделите текст и скопируйте.</p>', btns: [{ t: 'Закрыть' }] }); var t = $('#shopTxt'); if (t) { t.focus(); t.select(); } };
      try { navigator.clipboard.writeText(text).then(function () { toast('Список скопирован'); }, manual); } catch (e) { manual(); }
    }
  };

  /* ---------- Действия ---------- */
  function setPos(w) { S.pos = { week: Math.max(0, Math.min(12, w)), since: D.ymd(D.today()) }; V.week = null; save(); }
  function refreshTopSess() {
    var t = stack[stack.length - 1];
    if (t && t.dataset.kind === 'sess') { var sh = t.firstElementChild; if (sh && sh.dataset.sid) fillSess(t, sh.dataset.sid); }
  }
  var A = {
    tab: function (el) { closeAll(); coachStop(); V.tab = el.dataset.v; if (V.tab === 'prog') V.week = null; render(); window.scrollTo(0, 0); },
    selWeek: function (el) { V.week = +el.dataset.v; render(); },
    stab: function (el) { V.stab = el.dataset.v; render(); },
    back: function () { if (!R) coachStop(); closeTop(true); refreshTopSess(); },
    card: function (el) { var st = R && R.steps[R.i]; openCard(el.dataset.ex, st && st.ex === el.dataset.ex ? { tempo: st.tempo } : null); },
    openSess: function (el) { openSess(el.dataset.id); },
    startSess: function (el) { startSess(el.dataset.id); },
    startForma: function () { S.mode = 'forma'; setPos(0); render(); },
    startOwn: function () { S.mode = 'own'; save(); render(); },
    nextWeek: function () {
      var w = S.pos ? S.pos.week : 0, p = F.weekProgress(w);
      var go = function () { setPos(w + 1); toast('Неделя ' + (w + 1)); render(); };
      if (p.done < p.total) dialog({ title: 'Перейти к неделе ' + (w + 1) + '?', text: 'Выполнено ' + p.done + ' из ' + p.total + '. Невыполненные тренировки останутся в разделе «Программа», их можно сделать позже.', btns: [{ t: 'Перейти', fn: go }, { t: 'Остаться', cls: 'line' }] });
      else go();
    },
    setWeek: function (el) { setPos(+el.dataset.v); toast('Текущая неделя ' + el.dataset.v); render(); },
    pickOther: function () { V.tab = 'prog'; V.week = S.pos ? S.pos.week : 0; render(); window.scrollTo(0, 0); },
    newCycle: function () {
      dialog({ title: 'Начать программу заново?', text: 'Отметки выполнения готовой программы обнулятся и вы вернётесь к неделе 0. История, замеры, тесты и ваши тренировки сохранятся.', btns: [{ t: 'Начать заново', fn: function () { S.cycle = (S.cycle || 1) + 1; S.mode = 'forma'; setPos(0); render(); } }, { t: 'Отмена', cls: 'line' }] });
    },
    goMeas: function () { closeAll(); V.tab = 'stat'; V.stab = 'body'; render(); },
    goBp: function () { closeAll(); V.tab = 'stat'; V.stab = 'bp'; render(); },
    chk: function (el) { S.checks[el.dataset.k] = el.checked; save(); },
    tog: function (el) { S.s[el.dataset.k] = el.checked; save(); if (el.dataset.k === 'voice' && !el.checked) coachStop(); },
    theme: function (el) { S.s.theme = el.dataset.v; save(); applyTheme(); render(); },
    coach: function (el) { S.s.coach = el.dataset.v; save(); render(); },
    mode: function (el) { S.mode = el.dataset.v; if (S.mode === 'forma' && !S.pos) setPos(0); save(); render(); },
    testVoice: function () { if (!window.speechSynthesis) return toast('В этом браузере нет синтеза речи'); if (!S.s.voice) return toast('Сначала включите голос'); F.audio.unlock(); F.audio.say('Голос работает. Приседайте медленно, спина прямая, пятки на полу.'); },
    saveMeas: function () {
      var g = function (id) { var v = parseFloat($('#' + id).value.replace(',', '.')); return isNaN(v) ? null : v; };
      var o = { d: D.ymd(D.today()), w: g('m_w'), waist: g('m_waist'), hr: g('m_hr') };
      if (!o.w && !o.waist && !o.hr) return;
      S.meas = S.meas.filter(function (m) { return m.d !== o.d; }); S.meas.push(o); S.meas.sort(function (a, b) { return a.d < b.d ? -1 : 1; }); save(); render();
    },
    delMeas: function (el) { S.meas = S.meas.filter(function (m) { return m.d !== el.dataset.d; }); save(); render(); },
    saveBp: function () {
      var s = parseInt($('#b_s').value, 10), d = parseInt($('#b_d').value, 10);
      if (!(s >= 70 && s <= 260 && d >= 40 && d <= 160)) return dialog({ title: 'Проверьте значения', text: 'Верхнее давление от 70 до 260, нижнее от 40 до 160.', btns: [{ t: 'Понятно' }] });
      S.bp.push({ d: D.ymd(D.today()), sys: s, dia: d, when: $('#b_t').value }); save(); render();
    },
    delBp: function (el) { S.bp.splice(+el.dataset.v, 1); save(); render(); },
    zones: function () { openZones(); },
    exp: function () { $('#bk').value = store.export(); $('#bkmsg').textContent = 'Данные показаны. Скопируйте текст.'; },
    copy: function () { var t = store.export(); $('#bk').value = t; try { navigator.clipboard.writeText(t).then(function () { $('#bkmsg').textContent = 'Скопировано.'; }, function () { $('#bk').select(); $('#bkmsg').textContent = 'Выделено, скопируйте вручную.'; }); } catch (e) { $('#bk').select(); } },
    imp: function () { try { var o = JSON.parse($('#bk').value); if (!o || !(o.v >= 1)) throw 0; store.replace(o); S = store.get(); $('#bkmsg').textContent = 'Данные загружены.'; applyTheme(); } catch (e) { $('#bkmsg').textContent = 'Не удалось прочитать текст.'; } },
    /* библиотека */
    lgrp: function (el) { V.lg = el.dataset.v; if (el.dataset.ns === 'pick') renderPicker(); else render(); },
    sayCard: function (el) { F.audio.unlock(); sayCard(el.dataset.ex, el); },
    /* настройка занятия программы */
    cfg: function (el) { openCfg(el.dataset.id); },
    cfgSets: function (el) { cfgChange(el.dataset.id, el.dataset.ex, 'sets', +el.dataset.d); },
    cfgN: function (el) { cfgChange(el.dataset.id, el.dataset.ex, 'n', +el.dataset.d); },
    cfgRest: function (el) { cfgChange(el.dataset.id, el.dataset.ex, 'rest', +el.dataset.d); },
    cfgRm: function (el) {
      var id = el.dataset.id, o = S.over[id] || (S.over[id] = {}), rm = o._rm || (o._rm = []), i = rm.indexOf(el.dataset.ex);
      if (i >= 0) rm.splice(i, 1); else rm.push(el.dataset.ex);
      save(); var t = document.querySelector('[data-cfg="' + id + '"]'); if (t) renderCfg(t, id);
    },
    cfgReset: function (el) {
      var id = el.dataset.id; delete S.over[id]; save();
      var t = document.querySelector('[data-cfg="' + id + '"]'); if (t) renderCfg(t, id); else refreshTopSess();
    },
    saveAsOwn: function (el) {
      var id = el.dataset.id, p = id.split('-'), w = +p[0], d = +p[1], wi = F.weekInfo(w), sess = F.session(w, d);
      var items = F.applyOver(id, F.baseItems(w, d) || []).map(function (it) {
        var o = { ex: it.ex, sets: it.sets, rest: it.rest || 45, side: !!it.side };
        if (it.sec) o.sec = F.pick(it.sec, Math.max(1, wi.wib)); else o.reps = F.pick(it.reps, Math.max(1, wi.wib));
        return o;
      });
      openBuilder(null, { id: null, name: sess.title.replace(/^Тренировка\s+/, '') + ' (моя)', warm: true, cool: true, items: items });
    },
    /* свои тренировки */
    newCustom: function () { openBuilder(null); },
    editCustom: function (el) { openBuilder(el.dataset.id); },
    dupCustom: function (el) {
      var c = S.custom.filter(function (x) { return String(x.id) === el.dataset.id; })[0]; if (!c) return;
      var n = JSON.parse(JSON.stringify(c)); n.id = S.nid++; n.name = (c.name || 'Тренировка') + ' (копия)'; S.custom.push(n); save(); closeAll(); toast('Копия создана'); render();
    },
    bBack: function () {
      if (B && !B.id && B.items.length) return dialog({ title: 'Закрыть без сохранения?', text: 'Введённая тренировка не будет сохранена.', btns: [{ t: 'Закрыть', cls: 'danger', fn: function () { B = null; closeTop(true); refreshTopSess(); } }, { t: 'Продолжить', cls: 'line' }] });
      B = null; closeTop(true); refreshTopSess();
    },
    bWarm: function (el) { B.warm = el.checked; },
    bCool: function (el) { B.cool = el.checked; },
    bUp: function (el) { var i = +el.dataset.i; if (i > 0) { var t = B.items[i - 1]; B.items[i - 1] = B.items[i]; B.items[i] = t; renderBuilder(); } },
    bDown: function (el) { var i = +el.dataset.i; if (i < B.items.length - 1) { var t = B.items[i + 1]; B.items[i + 1] = B.items[i]; B.items[i] = t; renderBuilder(); } },
    bDel: function (el) { B.items.splice(+el.dataset.i, 1); renderBuilder(); },
    bSets: function (el) { var it = B.items[+el.dataset.i]; it.sets = Math.max(1, Math.min(10, it.sets + +el.dataset.d)); renderBuilder(); },
    bVal: function (el) { var it = B.items[+el.dataset.i], dd = +el.dataset.d; if (it.sec) it.sec = Math.max(5, Math.min(3600, it.sec + dd * 5)); else it.reps = Math.max(1, Math.min(200, it.reps + dd)); renderBuilder(); },
    bRest: function (el) { var it = B.items[+el.dataset.i]; it.rest = Math.max(0, Math.min(300, it.rest + +el.dataset.d * 15)); renderBuilder(); },
    bMode: function (el) { var it = B.items[+el.dataset.i]; if (el.dataset.v === 'sec' && !it.sec) { delete it.reps; it.sec = 30; } if (el.dataset.v === 'reps' && !it.reps) { delete it.sec; it.reps = 10; } renderBuilder(); },
    bSide: function (el) { B.items[+el.dataset.i].side = el.checked; },
    bAdd: function () { openPicker(); },
    pickTog: function (el) { var i = P.sel.indexOf(el.dataset.ex); if (i >= 0) P.sel.splice(i, 1); else P.sel.push(el.dataset.ex); renderPicker(); },
    pickDone: function () { var add = P.sel.map(newItem); P = null; B.items = B.items.concat(add); closeTop(true); renderBuilder(); },
    bSave: function () {
      if (!B.items.length) return;
      B.name = (B.name || '').trim() || 'Моя тренировка ' + (S.custom.length + 1);
      if (B.id) { var k = S.custom.findIndex(function (x) { return x.id === B.id; }); if (k >= 0) S.custom[k] = B; else S.custom.push(B); }
      else { B.id = S.nid++; S.custom.push(B); }
      save(); B = null; closeAll(); toast('Тренировка сохранена'); render();
    },
    bRemove: function () {
      dialog({ title: 'Удалить тренировку?', text: 'Тренировка «' + B.name + '» будет удалена. История выполненных тренировок останется.', btns: [{ t: 'Удалить', cls: 'danger', fn: function () { S.custom = S.custom.filter(function (x) { return x.id !== B.id; }); save(); B = null; closeAll(); render(); } }, { t: 'Отмена', cls: 'line' }] });
    },
    /* тренировка */
    rExit: function () { runExit(); },
    rPrev: function () { prevStep(); },
    rSkip: function () { next(); },
    rVoice: function (el) { S.s.voice = !S.s.voice; save(); if (!S.s.voice) coachStop(); el.innerHTML = F.audio.ok() ? IC.vol : IC.mute; if (S.s.voice && R) { F.audio.unlock(); announce(R.steps[R.i]); } },
    rPause: function (el) {
      if (R.paused) { R.t0step += now() - R.pauseAt; R.paused = false; el.textContent = 'Пауза'; }
      else { R.paused = true; R.pauseAt = now(); el.textContent = 'Продолжить'; coachStop(); }
    },
    rPlus: function () { R.extra += 15000; },
    rMinus: function () { R.reps = Math.max(0, R.reps - 1); setText('rp', String(R.reps)); },
    rPlus1: function () { R.reps = Math.min(99, R.reps + 1); setText('rp', String(R.reps)); },
    rDone: function () {
      var st = R.steps[R.i];
      if (!st.nolog && !st.quick) {
        var kgEl = $('#kg'), kg = kgEl ? parseFloat(kgEl.value.replace(',', '.')) : NaN;
        R.res.push({ ex: st.ex, set: st.set, side: st.side || null, reps: R.reps, kg: isNaN(kg) ? null : kg });
        if (!isNaN(kg)) S.loads[st.ex] = kg;
      }
      next();
    },
    tmOn: function () { var st = R.steps[R.i]; if (!parseTempo(st.tempo)) return; F.audio.unlock(); coachStop(); R.tm = { t0: now(), k: 0, ph: -1 }; R.reps = 0; setText('rp', '0'); tickTempo(); },
    tmOff: function () { R.tm = null; var b = $('#tph'); if (b) b.innerHTML = '<button class="btn small ghost" data-a="tmOn">Включить метроном</button>'; },
    rInput: function () {
      var st = R.steps[R.i], v = parseFloat($('#inp').value);
      if (isNaN(v)) return;
      var wk = S.tests[st.week] || (S.tests[st.week] = {}); wk[st.key] = v; save(); R.res.push({ ex: st.ex, test: st.key, value: v }); next();
    },
    rStop: function () {
      var st = R.steps[R.i], v = Math.max(0, Math.floor((now() - R.t0step) / 1000));
      var wk = S.tests[st.week] || (S.tests[st.week] = {}); wk[st.key] = v; save(); R.res.push({ ex: st.ex, test: st.key, value: v }); next();
    },
    rir: function (el) { R.rir = +el.dataset.v; document.querySelectorAll('[data-a=rir]').forEach(function (b) { b.setAttribute('aria-pressed', b === el ? 'true' : 'false'); }); },
    rSave: function () { saveRun(); }
  };

  Object.keys(FA).forEach(function (k) { A[k] = FA[k]; });
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-a]'); if (!el) return;
    var f = A[el.dataset.a]; if (!f) return;
    if (el.tagName === 'INPUT' && el.type === 'checkbox') return;
    f(el, e);
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.matches && el.matches('input[type=checkbox][data-a]')) { var f = A[el.dataset.a]; if (f) f(el, e); return; }
    if (el.dataset && el.dataset.set) { var v = parseFloat(el.value); if (!isNaN(v)) { S.s[el.dataset.set] = v; save(); render(); } return; }
    if (el.matches && el.matches('select[data-pos]')) { setPos(+el.value); toast('Текущая неделя ' + el.value); return; }
    if (el.dataset && el.dataset.t) {
      var w = el.dataset.w, k = el.dataset.t; S.tests[w] = S.tests[w] || {};
      if (el.value === '') delete S.tests[w][k]; else S.tests[w][k] = parseFloat(el.value);
      save();
    }
  });
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.id && el.id.indexOf('lq_') === 0) { V.lq = el.value; var ns = el.id.slice(3); fillLib(ns, ns === 'pick' ? P.sel : null, ns === 'pick' ? 'pickTog' : 'card'); }
  });
  $('.tabbar').addEventListener('click', function (e) { var b = e.target.closest('button[data-v]'); if (b) A.tab(b); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && R && S.s.wake) F.wake.on(); });

  /* вкладки */
  $('.tabbar nav').innerHTML = [['today', 'Сегодня'], ['prog', 'Программа'], ['lib', 'Упражнения'], ['stat', 'Прогресс'], ['set', 'Настройки']].map(function (t) { return '<button data-v="' + t[0] + '">' + IC[t[0]] + '<span>' + t[1] + '</span></button>'; }).join('');

  render();
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* офлайн-режим недоступен */ }); });
  }
  window.FORMA.debug = { A: A, get R() { return R; }, go: go, V: V, get S() { return S; }, announce: announce, stack: stack };
})();
