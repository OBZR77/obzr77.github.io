/* Форма: интерфейс и экран тренировки. */
(function () {
  'use strict';
  var F = window.FORMA, E = F.EX, D = F.date, store = F.store;
  var S = store.load();
  var Q = new URLSearchParams(location.search);
  var SPEED = parseFloat(Q.get('speed')) || 1; /* ?speed=20 ускоряет таймеры для проверки */
  var now = function () { return performance.now() * SPEED; };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var V = { tab: 'today', week: null, mtab: 'body' };
  var save = function () { store.save(); };

  var IC = {
    today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
    plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    meas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="3" height="6" rx="1"/><rect x="18" y="9" width="3" height="6" rx="1"/><path d="M6 12h12M8 7v10M16 7v10"/></svg>'
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
  function todayInfo() { var t = D.today(); return { t: t, w: F.weekOf(t), d: D.dow(t) }; }
  function doneEntry(id) { for (var i = S.log.length - 1; i >= 0; i--) if (S.log[i].id === id) return S.log[i]; return null; }
  function streak() {
    var set = {}; S.log.forEach(function (l) { set[l.date] = 1; });
    var d = D.today(), n = 0;
    if (!set[D.ymd(d)]) d = D.add(d, -1);
    while (set[D.ymd(d)]) { n++; d = D.add(d, -1); }
    return n;
  }
  function fmtTime(sec) { sec = Math.max(0, Math.ceil(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function ytUrl(id) { return 'https://www.youtube.com/results?search_query=' + encodeURIComponent((E[id] ? E[id].q : id) + ' упражнение техника'); }
  function rangeTxt(r, unit) { return r ? (r[0] === r[1] ? r[0] : r[0] + '–' + r[1]) + (unit || '') : ''; }

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
    return big ? '<div class="stage ph">' + IC.bell + '<span>Картинка появится позже.<br>Техника ниже, видео по кнопке YouTube.</span></div>' : '';
  }
  function mountAll(root, tempo) { root.querySelectorAll('[data-media]').forEach(function (el) { mountMedia(el, el.dataset.media, tempo || el.dataset.tempo); }); }

  /* ---------- Главные экраны ---------- */
  function sessCard(sess, w, d, opts) {
    opts = opts || {};
    var done = doneEntry(sess.id);
    var kindChip = { strength: 'Силовая', circuit: 'Круговая', intervals: 'Интервалы', light: 'Лёгкий день', long: 'Кардио', test: 'Тест', walk: 'Прогулка', rest: 'Отдых', prep: 'Подготовка' }[sess.kind];
    var html = '<section class="card"><div class="row between"><span class="chip">' + esc(kindChip) + '</span>' + (done ? '<span class="chip ok">Выполнено</span>' : (sess.min ? '<span class="chip plain">≈ ' + sess.min + ' мин</span>' : '')) + '</div>' +
      '<div class="stack"><h2>' + esc(sess.title) + '</h2><p class="muted">' + esc(sess.sub) + '</p></div>';
    if (sess.preview.length) {
      html += '<div class="list">' + sess.preview.slice(0, opts.all ? 99 : 5).map(function (p) { return '<button class="item" data-a="card" data-ex="' + esc(p.ex) + '"><div class="grow"><div class="t">' + esc(E[p.ex].n) + '</div><div class="s">' + esc(p.txt) + '</div></div><span class="muted">›</span></button>'; }).join('') + '</div>';
      if (!opts.all && sess.preview.length > 5) html += '<button class="link" data-a="openSess" data-w="' + w + '" data-d="' + d + '">Все упражнения (' + sess.preview.length + ')</button>';
    }
    if (sess.kind === 'prep') html += '<button class="btn" data-a="openSess" data-w="' + w + '" data-d="' + d + '">Открыть список</button>';
    else if (sess.kind !== 'rest') html += '<button class="btn" data-a="startSess" data-w="' + w + '" data-d="' + d + '">' + (done ? 'Повторить' : 'Начать') + '</button>';
    return html + '</section>';
  }

  function vToday() {
    var ti = todayInfo(), out = '<header class="top"><p class="kicker">' + esc(longDate(ti.t)) + '</p>';
    if (!S.s.start) {
      var def = ti.d === 0 ? ti.t : D.nextMonday(ti.t);
      return out + '<h1>Форма</h1></header>' +
        '<section class="card"><h2>Когда начинаем?</h2><p class="muted">Программа идёт 12 недель плюс неделя 0 для подготовки и замеров. Выберите понедельник, с которого начинается неделя 0. Дни можно переставлять и менять позже в настройках.</p>' +
        '<label class="f">Понедельник недели 0<input type="date" id="startDate" value="' + D.ymd(def) + '"></label><button class="btn" data-a="setStart">Начать программу</button></section>' + safety();
    }
    var w = ti.w;
    if (w < 0) {
      var left = Math.round((D.parse(S.s.start) - ti.t) / 864e5);
      return out + '<h1>Старт через ' + left + ' дн.</h1><p class="muted">Неделя 0 начинается ' + esc(D.fmtFull(S.s.start)) + '. Пока можно прочитать план и купить тонометр и резину.</p></header>' + sessCard(F.session(0, 0), 0, 0) + '<button class="btn ghost" data-a="tab" data-v="plan">Открыть план</button>' + safety();
    }
    if (w > 12) {
      return out + '<h1>12 недель позади</h1></header><section class="card"><p>Проведите итоговые тесты и сравните результаты: талия, силовые показатели и самочувствие важнее одного веса. Затем составим следующий цикл.</p><button class="btn" data-a="tab" data-v="meas">Открыть замеры</button><button class="btn line" data-a="newCycle">Начать новый цикл</button></section>' + safety();
    }
    var wi = F.weekInfo(w), sess = F.session(w, ti.d);
    out += '<h1>' + (w === 0 ? 'Неделя 0' : 'Неделя ' + w + ' из 12') + '</h1><div class="row"><span class="chip">' + esc(wi.blockName) + '</span>' + (w > 0 ? '<span class="chip plain">запас ' + wi.rir + '</span>' : '') + (wi.deload ? '<span class="chip warn">разгрузка</span>' : '') + (wi.test ? '<span class="chip warn">тесты</span>' : '') + '</div></header>';
    out += gateNotice(sess);
    out += sessCard(sess, w, ti.d);
    out += '<section class="card flat"><div class="row between"><h3>Эта неделя</h3><span class="chip plain">серия: ' + streak() + ' дн.</span></div><div class="weekstrip">' +
      F.DAYS.map(function (n, i) { var s = F.session(w, i), dn = doneEntry(s.id); return '<button class="day' + (i === ti.d ? ' today' : '') + (dn ? ' done' : '') + '" data-a="openSess" data-w="' + w + '" data-d="' + i + '" aria-label="' + esc(F.DAYS_FULL[i] + ': ' + s.title) + '"><span>' + n + '</span><b>' + F.dateOf(w, i).getDate() + '</b><span class="mark">' + (dn ? '✓' : '') + '</span></button>'; }).join('') + '</div></section>';
    var last = S.meas[S.meas.length - 1];
    if (last) out += '<section class="card flat"><h3>Последние замеры</h3><div class="kv"><span>Дата</span><b>' + esc(D.fmtFull(last.d)) + '</b></div>' + (last.w ? '<div class="kv"><span>Вес</span><b>' + last.w + ' кг</b></div>' : '') + (last.waist ? '<div class="kv"><span>Талия</span><b>' + last.waist + ' см</b></div>' : '') + (last.hr ? '<div class="kv"><span>Пульс покоя</span><b>' + last.hr + '</b></div>' : '') + '</section>';
    return out + safety();
  }
  function safety() { return '<p class="small muted">Приложение не заменяет врача. При боли в груди, перебоях сердца, головокружении, резкой головной боли или необычной одышке прекратите нагрузку и обратитесь за медицинской помощью.</p>'; }
  function gateNotice(sess) {
    if (!F.isIntervals(sess)) return '';
    var g = F.bpGate();
    if (g.state === 'high') return '<div class="notice danger">Среднее давление по вашим записям ' + g.sys + '/' + g.dia + ': это от порога 135/85, принятого для домашних измерений. До интервалов сначала обратитесь к врачу. Сегодня замените занятие быстрой ходьбой в зоне 1–2.</div>';
    if (g.state === 'few') return '<div class="notice">Интервалы начинайте только после недели домашних измерений давления: 14 записей, утро и вечер. Сейчас записано: ' + g.n + '. <button class="link" data-a="tab" data-v="meas">Открыть замеры</button></div>';
    return '';
  }

  function vPlan() {
    var ti = todayInfo(), cur = ti.w;
    if (V.week == null) V.week = (cur != null && cur >= 0 && cur <= 12) ? cur : 0;
    var w = V.week, wi = F.weekInfo(w), chips = '';
    for (var i = 0; i <= 12; i++) chips += '<button class="wk' + (i === cur ? ' now' : '') + '" data-a="selWeek" data-v="' + i + '" aria-pressed="' + (i === w) + '">' + i + '</button>';
    var out = '<header class="top"><p class="kicker">План</p><h1>' + (w === 0 ? 'Неделя 0: подготовка' : 'Неделя ' + w) + '</h1></header><div class="chips" role="group" aria-label="Недели">' + chips + '</div>';
    out += '<section class="card flat"><div class="row"><span class="chip">' + esc(wi.blockName) + '</span>' + (w > 0 ? '<span class="chip plain">запас повторений ' + wi.rir + '</span>' : '') + (wi.deload ? '<span class="chip warn">разгрузка: меньше подходов</span>' : '') + (wi.test ? '<span class="chip warn">тесты</span>' : '') + '</div>' +
      '<p class="small muted">' + (w === 0 ? 'Тонометр, резина, стартовые замеры и тесты.' : 'Три недели нагрузки, четвёртая лёгкая. Прогрессия сложностью, темпом и нагрузкой рюкзака, не количеством повторений.') + '</p></section>';
    out += '<section class="card"><div class="list">';
    for (var d = 0; d < 7; d++) {
      var s = F.session(w, d), dn = doneEntry(s.id), isToday = (cur === w && ti.d === d);
      out += '<button class="item" data-a="openSess" data-w="' + w + '" data-d="' + d + '"><span class="dot' + (dn ? ' done' : '') + (isToday ? ' today' : '') + '">' + F.DAYS[d] + '</span><div class="grow"><div class="t">' + esc(s.title) + '</div><div class="s">' + (S.s.start ? esc(D.fmt(F.dateOf(w, d))) + ' · ' : '') + (s.min ? '≈ ' + s.min + ' мин' : 'без нагрузки') + (dn ? ' · выполнено' : '') + '</div></div><span class="muted">›</span></button>';
    }
    return out + '</div></section>';
  }

  function vMeas() {
    var out = '<header class="top"><p class="kicker">Замеры</p><h1>Показатели</h1></header><div class="seg" role="group" aria-label="Раздел">' +
      [['body', 'Вес и талия'], ['bp', 'Давление'], ['tests', 'Тесты']].map(function (x) { return '<button data-a="mtab" data-v="' + x[0] + '" aria-pressed="' + (V.mtab === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
    if (V.mtab === 'body') {
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
    if (V.mtab === 'bp') {
      var g = F.bpGate(), b14 = S.bp.slice(-14);
      out += '<section class="card"><h2>Домашнее давление</h2><p class="muted small">Плечевой тонометр, сидя после 5 минут покоя, два измерения с интервалом минута. Неделя: утром и вечером, 14 записей. Здесь можно записать среднее из двух.</p><div class="grid3"><label class="f">Верхнее<input type="number" inputmode="numeric" id="b_s"></label><label class="f">Нижнее<input type="number" inputmode="numeric" id="b_d"></label><label class="f">Когда<select id="b_t"><option value="утро">Утро</option><option value="вечер">Вечер</option></select></label></div><button class="btn" data-a="saveBp">Записать</button></section>';
      var msg = '';
      if (b14.length) {
        var sy = 0, di = 0; b14.forEach(function (x) { sy += x.sys; di += x.dia; });
        sy = Math.round(sy / b14.length); di = Math.round(di / b14.length);
        msg = '<div class="kv"><span>Записей в расчёте</span><b>' + b14.length + ' из 14</b></div><div class="kv"><span>Среднее</span><b>' + sy + '/' + di + '</b></div>';
        if (b14.length >= 14) msg += (g.state === 'high' ? '<div class="notice danger">Среднее от порога 135/85 для домашних измерений. До интервалов сначала врач. Приложение диагнозов не ставит.</div>' : '<div class="notice info">Среднее ниже порога 135/85 для домашних измерений (ESC/ESH). Интервалы разрешены, если самочувствие в порядке.</div>');
        else msg += '<p class="small muted">Для вывода нужно 14 записей.</p>';
      } else msg = '<p class="muted">Записей пока нет. Весной было 130/85.</p>';
      out += '<section class="card flat"><h3>Среднее за неделю</h3>' + msg + '</section>';
      if (S.bp.length) out += '<section class="card flat"><h3>Записи</h3><div class="list">' + S.bp.slice(-10).reverse().map(function (m, i) { var idx = S.bp.length - 1 - i; return '<div class="item"><div class="grow"><div class="t">' + m.sys + '/' + m.dia + ' · ' + esc(m.when) + '</div><div class="s">' + esc(D.fmtFull(m.d)) + '</div></div><button class="link" data-a="delBp" data-v="' + idx + '">Удалить</button></div>'; }).join('') + '</div></section>';
    }
    if (V.mtab === 'tests') {
      out += '<section class="card"><h2>Тесты</h2><p class="small muted">Недели 0, 4, 8, 12. Порядок в день теста: отжимания, через 5 минут пресс, через 5 минут планка. Подтягивания и ноги в отдельные дни. Планка в секундах.</p><div class="scroll-x"><table class="tbl"><thead><tr><th>Показатель</th>' + F.TEST_WEEKS.map(function (w) { return '<th>Нед. ' + w + '</th>'; }).join('') + '</tr></thead><tbody>' +
        F.TEST_FIELDS.map(function (f) { return '<tr><td>' + esc(f.n) + '<div class="small muted">' + f.u + '</div></td>' + F.TEST_WEEKS.map(function (w) { var v = (S.tests[w] || {})[f.k]; return '<td><input type="number" inputmode="numeric" data-t="' + f.k + '" data-w="' + w + '" value="' + (v == null ? '' : v) + '" aria-label="' + esc(f.n + ', неделя ' + w) + '"></td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div><p class="small muted">Старт: отжимания 50, пресс 52 (сентябрь), планка 3 мин (180 с), подтягивания 3–4, наклон +23 см.</p></section>';
    }
    return out;
  }

  function vMore() {
    var sw = function (k, t, sub) { return '<label class="switch"><span><b>' + t + '</b>' + (sub ? '<div class="small muted">' + sub + '</div>' : '') + '</span><input type="checkbox" data-a="tog" data-k="' + k + '"' + (S.s[k] ? ' checked' : '') + '></label>'; };
    var out = '<header class="top"><p class="kicker">Ещё</p><h1>Настройки</h1></header>';
    out += '<section class="card"><h2>Программа</h2><label class="f">Понедельник недели 0<input type="date" id="startDate2" value="' + (S.s.start || '') + '" data-a="chgStart"></label>' + sw('bands', 'Есть резина с дверным креплением', 'Если нет, тяга резиной заменяется на Y-T-W лёжа') + '</section>';
    out += '<section class="card"><h2>Во время тренировки</h2>' + sw('voice', 'Голосовые подсказки', 'Нужен русский голос в настройках Android') + sw('beep', 'Звуковые сигналы', 'Отсчёт трёх последних секунд') + sw('wake', 'Не гасить экран') + '</section>';
    out += '<section class="card"><h2>Тема</h2><div class="seg" role="group" aria-label="Тема">' + [['auto', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(function (x) { return '<button data-a="theme" data-v="' + x[0] + '" aria-pressed="' + (S.s.theme === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div></section>';
    out += '<section class="card"><h2>Справочник</h2><button class="btn ghost" data-a="lib">Упражнения (' + Object.keys(E).length + ')</button><button class="btn ghost" data-a="zones">Зоны пульса</button></section>';
    out += '<section class="card"><h2>Данные</h2><p class="small muted">Всё хранится на этом устройстве. Скопируйте текст в надёжное место для резервной копии или вставьте сохранённый ранее.</p><textarea id="bk" spellcheck="false" aria-label="Резервная копия"></textarea><div class="row"><button class="btn small ghost" data-a="exp">Показать данные</button><button class="btn small ghost" data-a="copy">Копировать</button><button class="btn small line" data-a="imp">Загрузить из текста</button></div><div id="bkmsg" class="small muted"></div></section>';
    out += '<section class="card flat"><h3>О программе</h3><p class="small muted">Форма, версия 0.1. Программа составлена по данным Александра и открытым рекомендациям: ВОЗ 2020, ACSM 2009, ESC/ESH 2018, Tanaka 2001. Расчёты питания и зон пульса оценочные. Приложение не ставит диагнозов и не заменяет врача.</p></section>';
    return out;
  }

  function render() {
    applyTheme();
    var f = { today: vToday, plan: vPlan, meas: vMeas, more: vMore }[V.tab];
    var app = $('#app'), keep = window.scrollY;
    app.innerHTML = '<main class="page">' + f() + '</main>';
    document.querySelectorAll('.tabbar button').forEach(function (b) { if (b.dataset.v === V.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    window.scrollTo(0, keep);
  }

  /* ---------- Карточка упражнения ---------- */
  function openCard(id, ctx) {
    var e = E[id]; if (!e) return;
    var last = S.last[id], el = document.createElement('div');
    el.innerHTML = '<div class="sheet"><div class="bar"><button class="iconbtn" data-a="back" aria-label="Назад">' + IC.back + '</button><h2 class="grow">' + esc(e.n) + '</h2></div>' +
      mediaBox(id, true) +
      '<section class="card"><h3>Как делать</h3><p>' + esc(e.how) + '</p>' + (ctx && ctx.tempo ? '<div class="notice info">Темп ' + esc(ctx.tempo) + ': первая цифра секунды опускания (самая тяжёлая часть), вторая пауза, третья подъём.</div>' : '') + '<p class="small muted">Дышите ровно, выдох на усилии, дыхание не задерживайте. При боли в суставе остановитесь и замените упражнение.</p></section>' +
      '<section class="card"><h3>Область внимания</h3><div class="row">' + e.m.map(function (m) { return '<span class="chip">' + esc(m) + '</span>'; }).join('') + e.s.map(function (m) { return '<span class="chip plain">' + esc(m) + '</span>'; }).join('') + '</div></section>' +
      (last ? '<section class="card flat"><h3>Прошлый раз</h3><p>' + esc(D.fmtFull(last.date)) + ': ' + last.reps.join(' · ') + ' повторений' + (last.kg ? ', ' + last.kg + ' кг' : '') + '</p></section>' : '') +
      '<a class="btn ghost block" style="text-align:center;text-decoration:none;display:block" href="' + ytUrl(id) + '" target="_blank" rel="noopener">Смотреть на YouTube</a></div>';
    pushOv(el, 'card'); mountAll(el, ctx && ctx.tempo);
  }

  function openSess(w, d) {
    var s = F.session(w, d), el = document.createElement('div'), body = '';
    if (s.kind === 'prep') {
      var tasks = [['tono', 'Купить плечевой тонометр'], ['bp7', '7 дней измерять давление утром и вечером (раздел «Замеры → Давление»)'], ['bands', 'Купить набор резин разной жёсткости с дверным креплением'], ['bar', 'Дверной распорный турник, по желанию (проверьте проём и нагрузку)'], ['hrmax', 'Посмотреть максимальный пульс в часах; если выше 173, использовать своё значение'], ['meas', 'Утром натощак: вес, пульс покоя лёжа, талия (раздел «Замеры»)'], ['photo', 'Фото в профиль для сравнения']];
      body = '<section class="card"><h3>Список подготовки</h3>' + tasks.map(function (t) { return '<label class="switch"><span>' + esc(t[1]) + '</span><input type="checkbox" data-a="chk" data-k="' + t[0] + '"' + (S.checks[t[0]] ? ' checked' : '') + '></label>'; }).join('') + '</section><button class="btn" data-a="goMeas">Открыть замеры</button>';
    } else {
      body = gateNotice(s) + '<section class="card"><p class="muted">' + esc(s.sub) + '</p>' + (s.preview.length ? '<div class="list">' + s.preview.map(function (p) { return '<button class="item" data-a="card" data-ex="' + esc(p.ex) + '"><div class="grow"><div class="t">' + esc(E[p.ex].n) + '</div><div class="s">' + esc(p.txt) + '</div></div><span class="muted">›</span></button>'; }).join('') + '</div>' : '') + '</section>' + (s.kind !== 'rest' ? '<div class="cta"><button class="btn block" data-a="startSess" data-w="' + w + '" data-d="' + d + '">Начать</button></div>' : '');
    }
    el.innerHTML = '<div class="sheet"><div class="bar"><button class="iconbtn" data-a="back" aria-label="Назад">' + IC.back + '</button><div class="grow"><div class="small muted">' + F.DAYS_FULL[d] + (S.s.start ? ', ' + D.fmt(F.dateOf(w, d)) : '') + ', неделя ' + w + '</div><h2>' + esc(s.title) + '</h2></div></div>' + body + '</div>';
    pushOv(el, 'sess');
  }

  /* ---------- Тренировка ---------- */
  var R = null, timer = 0;
  var NO_BPM = { t: 'info' };

  function beginSession(w, d) {
    var sess = F.session(w, d), steps = sess.build();
    if (!steps.length) return;
    F.audio.unlock(); F.wake.on();
    R = { sess: sess, w: w, d: d, steps: steps, i: -1, res: [], t0: Date.now(), paused: false, extra: 0, tm: null, reps: 0, kg: '', lastBeep: null };
    var el = document.createElement('div'); el.id = 'run'; pushOv(el, 'run');
    go(0);
    timer = setInterval(tick, 100);
  }
  function startSess(w, d) {
    var sess = F.session(w, d);
    if (F.isIntervals(sess)) {
      var g = F.bpGate();
      if (g.state === 'high') return dialog({ title: 'Сначала врач', text: 'Среднее давление по вашим записям ' + g.sys + '/' + g.dia + ' (порог для домашних измерений 135/85). Интервалы сегодня не рекомендуются: сначала обратитесь к врачу. Можно заменить занятие быстрой ходьбой в зоне 1–2.', btns: [{ t: 'Заменить прогулкой', fn: function () { beginWalk(); } }, { t: 'Закрыть', cls: 'line' }] });
      if (g.state === 'few') return dialog({ title: 'Нужна неделя измерений', text: 'Интервалы начинайте после недели домашних измерений давления: 14 записей, утро и вечер. Сейчас записано ' + g.n + '. Если вы уже измеряли давление и согласовали нагрузку с врачом, можно подтвердить и продолжить.', btns: [{ t: 'Открыть замеры', fn: function () { closeAll(); V.tab = 'meas'; V.mtab = 'bp'; render(); } }, { t: 'Заменить прогулкой', cls: 'ghost', fn: beginWalk }, { t: 'Подтверждаю, начать', cls: 'line', fn: function () { S.bpAck = true; save(); beginSession(w, d); } }] });
    }
    beginSession(w, d);
  }
  function beginWalk() {
    var sess = { id: 'walk-' + Date.now(), kind: 'walk', title: 'Быстрая ходьба', sub: '', min: 30, preview: [], build: function () { return [{ t: 'time', ex: 'walk', sec: 1800, title: 'Быстрая ходьба 30 минут', sub: 'Зоны 1–2, пульс 116–139. Закончить раньше можно кнопкой «Дальше».', nolog: true, skippable: true, say: 'Быстрая ходьба' }]; } };
    F.audio.unlock(); F.wake.on();
    R = { sess: sess, w: 0, d: 0, steps: sess.build(), i: -1, res: [], t0: Date.now(), paused: false, extra: 0, tm: null, reps: 0, kg: '', lastBeep: null, noLog: true };
    var el = document.createElement('div'); el.id = 'run'; pushOv(el, 'run'); go(0); timer = setInterval(tick, 100);
  }

  function go(i) {
    R.i = i; var st = R.steps[i];
    R.t0step = now(); R.extra = 0; R.paused = false; R.tm = null; R.lastBeep = null;
    R.reps = st.target || 0; R.kg = st.load ? (S.loads[st.ex] || '') : '';
    if (st.t === 'prep') F.audio.say(st.say);
    else if (st.t === 'rest' && !st.short) F.audio.say(st.say);
    else if (st.t === 'time') F.audio.say(st.say || st.title);
    else if (st.t === 'reps' && !st.quick) F.audio.say(st.set > 1 ? 'Подход ' + st.set : (st.say || st.title));
    else if (st.t === 'info') F.audio.say(st.title);
    renderRun();
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

  function runMedia(st) { return st.ex && E[st.ex] && E[st.ex].media ? '<div class="stage" data-media="' + E[st.ex].media + '" data-tempo="' + esc(st.tempo || '') + '"></div>' : ''; }
  var CIRC = 2 * Math.PI * 100;
  function ring() { return '<div class="ringwrap"><svg viewBox="0 0 220 220" aria-hidden="true"><circle class="ring-bg" cx="110" cy="110" r="100" fill="none" stroke-width="12"/><circle class="ring-fg" id="rg" cx="110" cy="110" r="100" fill="none" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + CIRC.toFixed(1) + '" stroke-dashoffset="0"/></svg><div class="big" id="tm"></div></div>'; }

  function renderRun() {
    var el = $('#run'); if (!el) return;
    var st = R.steps[R.i], n = R.steps.length, pct = Math.round(R.i / n * 100), body = '', ctl = '';
    var badge = st.badge ? '<span class="chip badge">' + esc(st.badge) + '</span>' : '';
    var dir = '<button class="btn line" data-a="rPrev">Назад</button>';
    if (st.t === 'prep') {
      body = badge + '<div class="rtitle">' + esc(st.title) + '</div><div class="rsub">' + esc(st.sub) + '</div>' + runMedia(st) + '<div class="big" id="tm">5</div><div class="rsub">Приготовьтесь</div>';
      ctl = '<div class="runctl">' + dir + '<button class="btn ghost" data-a="rPause">Пауза</button><button class="btn" data-a="rSkip">Начать</button></div>';
    } else if (st.t === 'rest') {
      body = '<div class="rtitle">' + esc(st.title) + '</div>' + ring() + '<div class="rsub">' + esc(st.sub) + '</div>' + (st.next && E[st.next] ? '<button class="link center" data-a="card" data-ex="' + st.next + '">Как делать: ' + esc(E[st.next].n) + '</button>' : '');
      ctl = '<div class="runctl rest"><button class="btn line" data-a="rPlus">+15 с</button><button class="btn ghost" data-a="rPause">Пауза</button><button class="btn" data-a="rSkip">Пропустить</button></div>';
    } else if (st.t === 'time') {
      body = badge + '<div class="rtitle">' + esc(st.title) + '</div>' + (st.side ? '<div class="rsub">' + esc(st.side) + (st.sets > 1 ? ' · подход ' + st.set + ' из ' + st.sets : '') + '</div>' : (st.sets > 1 ? '<div class="rsub">Подход ' + st.set + ' из ' + st.sets + '</div>' : '')) + runMedia(st) + ring() + '<div class="rsub">' + esc(st.sub) + '</div>' + (st.range ? '<div class="rsub small">Диапазон ' + rangeTxt(st.range, ' с') + '</div>' : '');
      ctl = '<div class="runctl">' + dir + '<button class="btn ghost" data-a="rPause">Пауза</button><button class="btn" data-a="rSkip">' + (st.skippable ? 'Дальше' : 'Пропустить') + '</button></div>';
    } else if (st.t === 'reps') {
      var e = E[st.ex];
      body = badge + '<div class="rtitle">' + esc(st.title) + '</div>' + (st.quick ? '<div class="rsub">' + (st.side ? esc(st.side) + ' · ' : '') + 'Выполните ' + st.target + ' повторений</div>' : '<div class="rsub">' + (st.side ? esc(st.side) + ' · ' : '') + 'Подход ' + st.set + ' из ' + st.sets + '</div>') + runMedia(st);
      if (!st.quick) {
        body += '<div class="card flat center"><div class="small muted">Цель</div><div class="big sm">' + st.target + '</div><div class="small muted">' + (st.range ? 'диапазон ' + rangeTxt(st.range) + ', ' : '') + 'не до отказа</div></div>';
        if (st.tempo) body += '<div class="phasebox"><div class="small muted">Темп ' + esc(st.tempo) + ' (опускание, пауза, подъём, секунды)</div><div id="tph"><button class="btn small ghost" data-a="tmOn">Включить метроном</button></div><div class="mini"><i id="tpb"></i></div></div>';
        if (st.load) body += '<label class="f">Нагрузка, кг<input type="number" step="0.5" min="0" inputmode="decimal" id="kg" value="' + esc(R.kg) + '" placeholder="' + (e && e.id === 'dbraise' ? '4' : 'вес рюкзака') + '"></label>';
        body += '<div class="stepper"><button data-a="rMinus" aria-label="Меньше">−</button><output id="rp">' + R.reps + '</output><button data-a="rPlus1" aria-label="Больше">+</button></div><div class="small muted center">Сделано повторений</div>';
      }
      ctl = '<div class="runctl">' + dir + '<button class="btn" data-a="rDone">Готово</button><button class="btn line" data-a="rSkip">Пропустить</button></div>';
    } else if (st.t === 'info') {
      body = badge + '<div class="rtitle">' + esc(st.title) + '</div><div class="rsub" style="text-align:left;font-size:16px">' + esc(st.sub) + '</div>' + runMedia(st);
      ctl = '<div class="runctl two">' + dir + '<button class="btn" data-a="rSkip">' + esc(st.btn || 'Дальше') + '</button></div>';
    } else if (st.t === 'input') {
      body = '<div class="rtitle">' + esc(st.title) + '</div><div class="rsub">' + esc(st.sub) + '</div><label class="f">Результат, ' + esc(st.unit) + '<input type="number" inputmode="numeric" id="inp" min="0" style="font-size:32px;text-align:center"></label>';
      ctl = '<div class="runctl two">' + dir + '<button class="btn" data-a="rInput">Сохранить</button></div>';
    } else if (st.t === 'stopwatch') {
      body = '<div class="rtitle">' + esc(st.title) + '</div><div class="rsub">' + esc(st.sub) + '</div><div class="big" id="tm">0:00</div>';
      ctl = '<div class="runctl two"><button class="btn ghost" data-a="rPause">Пауза</button><button class="btn" data-a="rStop">Стоп</button></div>';
    }
    el.innerHTML = '<div class="run"><div class="bar"><button class="iconbtn" data-a="rExit" aria-label="Выйти из тренировки">' + IC.close + '</button><div class="prog"><i style="width:' + pct + '%"></i></div><span class="small muted">' + (R.i + 1) + '/' + n + '</span>' + (st.ex && E[st.ex] ? '<button class="iconbtn" data-a="card" data-ex="' + st.ex + '" aria-label="Карточка упражнения">' + IC.info + '</button>' : '') + '</div><div class="run-body">' + body + '</div>' + ctl + '</div>';
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
    if (k > tm.k) { tm.k = k; R.reps = Math.min(99, k); setText('rp', String(R.reps)); F.audio.say(String(R.reps)); }
    if (ph !== tm.ph) { tm.ph = ph; F.audio.beep([520, 700, 880, 700][ph], 80); }
    var box = $('#tph'); if (box) box.innerHTML = '<b>' + names[ph] + ' ' + Math.ceil(left) + '</b> <button class="btn small line" data-a="tmOff">Выключить</button>';
    var bar = $('#tpb'); if (bar) bar.style.width = (x / cyc * 100).toFixed(1) + '%';
  }

  function finish() {
    clearInterval(timer); timer = 0; F.wake.off(); F.audio.say('Тренировка завершена');
    var sec = Math.round((Date.now() - R.t0) / 1000), sets = R.res.length, el = $('#run');
    var strength = R.sess.kind === 'strength';
    el.innerHTML = '<div class="run"><div class="run-body"><div class="rtitle">Готово</div><div class="rsub">' + esc(R.sess.title) + '</div><div class="card flat"><div class="kv"><span>Время</span><b>' + fmtTime(sec) + '</b></div>' + (sets ? '<div class="kv"><span>Записано подходов</span><b>' + sets + '</b></div>' : '') + '<div class="kv"><span>Серия дней</span><b>' + (streak() + (doneToday() ? 0 : 1)) + '</b></div></div>' +
      (strength ? '<div class="stack center"><div class="small muted">Запас повторений в последнем рабочем подходе</div><div class="seg" style="align-self:center" role="group" aria-label="Запас повторений">' + [['0', '0'], ['1', '1'], ['2', '2'], ['3', '3+']].map(function (x) { return '<button data-a="rir" data-v="' + x[0] + '" aria-pressed="false">' + x[1] + '</button>'; }).join('') + '</div><div class="small muted">Если запас 2 и больше во всех подходах на верхней границе диапазона, в следующем блоке усложняйте.</div></div>' : '') +
      '</div><button class="btn" data-a="rSave">Сохранить</button></div>';
  }
  function doneToday() { return S.log.some(function (l) { return l.date === D.ymd(D.today()); }); }
  function saveRun() {
    if (!R.noLog) {
      var by = {};
      R.res.forEach(function (r) { if (!r.reps) return; var b = by[r.ex] || (by[r.ex] = { reps: [], kg: 0 }); b.reps.push(r.reps); if (r.kg) b.kg = Math.max(b.kg, r.kg); });
      Object.keys(by).forEach(function (k) { S.last[k] = { reps: by[k].reps, kg: by[k].kg || null, date: D.ymd(D.today()) }; });
      S.log.push({ id: R.sess.id, date: D.ymd(D.today()), week: R.w, day: R.d, title: R.sess.title, kind: R.sess.kind, sec: Math.round((Date.now() - R.t0) / 1000), res: R.res, rir: R.rir == null ? null : R.rir });
    }
    save(); endRun();
  }
  function endRun() { clearInterval(timer); timer = 0; F.wake.off(); R = null; closeAll(); render(); }
  function runExit() {
    if (!R) return;
    R.paused = true; R.pauseAt = now();
    var btns = [{ t: 'Продолжить', fn: function () { R.t0step += now() - R.pauseAt; R.paused = false; } }];
    if (R.res.length) btns.push({ t: 'Завершить и сохранить', cls: 'ghost', fn: function () { R.paused = false; finish(); } });
    btns.push({ t: 'Выйти без сохранения', cls: 'danger', fn: function () { endRun(); } });
    dialog({ title: 'Выйти из тренировки?', text: 'Прогресс текущего занятия не сохранится, если выйти без сохранения.', btns: btns });
  }

  /* ---------- Действия ---------- */
  var A = {
    tab: function (el) { closeAll(); V.tab = el.dataset.v; if (V.tab === 'plan') V.week = null; render(); window.scrollTo(0, 0); },
    selWeek: function (el) { V.week = +el.dataset.v; render(); },
    mtab: function (el) { V.mtab = el.dataset.v; render(); },
    back: function () { closeTop(true); },
    card: function (el) { var st = R && R.steps[R.i]; openCard(el.dataset.ex, st && st.ex === el.dataset.ex ? { tempo: st.tempo } : null); },
    openSess: function (el) { openSess(+el.dataset.w, +el.dataset.d); },
    startSess: function (el) { startSess(+el.dataset.w, +el.dataset.d); },
    setStart: function () { var v = $('#startDate').value; if (!v) return; S.s.start = D.ymd(D.monday(D.parse(v))); save(); render(); },
    chgStart: function () { },
    newCycle: function () { dialog({ title: 'Новый цикл', text: 'Выберите новый понедельник недели 0 в настройках. История тренировок и замеров сохранится.', btns: [{ t: 'Открыть настройки', fn: function () { V.tab = 'more'; render(); } }, { t: 'Отмена', cls: 'line' }] }); },
    goMeas: function () { closeAll(); V.tab = 'meas'; V.mtab = 'body'; render(); },
    chk: function (el) { S.checks[el.dataset.k] = el.checked; save(); },
    tog: function (el) { S.s[el.dataset.k] = el.checked; save(); },
    theme: function (el) { S.s.theme = el.dataset.v; save(); applyTheme(); render(); },
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
    lib: function () {
      var el = document.createElement('div'), ids = Object.keys(E).sort(function (a, b) { return E[a].n.localeCompare(E[b].n, 'ru'); });
      el.innerHTML = '<div class="sheet"><div class="bar"><button class="iconbtn" data-a="back" aria-label="Назад">' + IC.back + '</button><h2 class="grow">Упражнения</h2></div><input type="text" id="q" placeholder="Поиск" aria-label="Поиск упражнения"><section class="card"><div class="list" id="ql">' + ids.map(function (id) { return '<button class="item" data-a="card" data-ex="' + id + '" data-n="' + esc(E[id].n.toLowerCase()) + '"><div class="grow"><div class="t">' + esc(E[id].n) + '</div><div class="s">' + esc(E[id].m.join(', ')) + '</div></div><span class="muted">›</span></button>'; }).join('') + '</div></section></div>';
      pushOv(el, 'lib');
      $('#q', el).addEventListener('input', function (e) { var v = e.target.value.toLowerCase(); el.querySelectorAll('#ql .item').forEach(function (b) { b.style.display = b.dataset.n.indexOf(v) >= 0 ? '' : 'none'; }); });
    },
    zones: function () {
      var el = document.createElement('div');
      el.innerHTML = '<div class="sheet"><div class="bar"><button class="iconbtn" data-a="back" aria-label="Назад">' + IC.back + '</button><h2 class="grow">Зоны пульса</h2></div><section class="card"><p class="small muted">Максимальный пульс 173 (формула Танака 208 − 0,7 × возраст, разброс около 10 уд/мин), пульс покоя 60, метод Карвонена. Ориентируйтесь на самочувствие, а не только на цифры.</p><table class="tbl"><thead><tr><th>Зона</th><th>Пульс</th><th>Для чего</th></tr></thead><tbody>' + F.ZONES.map(function (z) { return '<tr><td>' + z[0] + '</td><td>' + z[1] + '</td><td>' + esc(z[2]) + '</td></tr>'; }).join('') + '</tbody></table></section></div>';
      pushOv(el, 'zones');
    },
    exp: function () { $('#bk').value = store.export(); $('#bkmsg').textContent = 'Данные показаны. Скопируйте текст.'; },
    copy: function () { var t = store.export(); $('#bk').value = t; try { navigator.clipboard.writeText(t).then(function () { $('#bkmsg').textContent = 'Скопировано.'; }, function () { $('#bk').select(); $('#bkmsg').textContent = 'Выделено, скопируйте вручную.'; }); } catch (e) { $('#bk').select(); } },
    imp: function () { try { var o = JSON.parse($('#bk').value); if (!o || o.v !== 1) throw 0; store.replace(o); S = store.get(); $('#bkmsg').textContent = 'Данные загружены.'; applyTheme(); } catch (e) { $('#bkmsg').textContent = 'Не удалось прочитать текст.'; } },
    /* тренировка */
    rExit: function () { runExit(); },
    rPrev: function () { prevStep(); },
    rSkip: function () { var st = R.steps[R.i]; if (st.t === 'time' && st.skippable) { next(); return; } next(); },
    rPause: function (el) {
      if (R.paused) { R.t0step += now() - R.pauseAt; R.paused = false; el.textContent = 'Пауза'; }
      else { R.paused = true; R.pauseAt = now(); el.textContent = 'Продолжить'; }
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
    tmOn: function () { var st = R.steps[R.i]; if (!parseTempo(st.tempo)) return; F.audio.unlock(); R.tm = { t0: now(), k: 0, ph: -1 }; R.reps = 0; setText('rp', '0'); tickTempo(); },
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

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-a]'); if (!el) return;
    var f = A[el.dataset.a]; if (!f) return;
    if (el.tagName === 'INPUT' && el.type === 'checkbox') return;
    f(el, e);
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.matches && el.matches('input[type=checkbox][data-a]')) { var f = A[el.dataset.a]; if (f) f(el, e); return; }
    if (el.id === 'startDate2') { if (el.value) { S.s.start = D.ymd(D.monday(D.parse(el.value))); save(); el.value = S.s.start; } return; }
    if (el.dataset && el.dataset.t) {
      var w = el.dataset.w, k = el.dataset.t; S.tests[w] = S.tests[w] || {};
      if (el.value === '') delete S.tests[w][k]; else S.tests[w][k] = parseFloat(el.value);
      save();
    }
  });
  $('.tabbar').addEventListener('click', function (e) { var b = e.target.closest('button[data-v]'); if (b) A.tab(b); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && R && S.s.wake) F.wake.on(); });

  /* вкладки */
  $('.tabbar nav').innerHTML = [['today', 'Сегодня'], ['plan', 'План'], ['meas', 'Замеры'], ['more', 'Ещё']].map(function (t) { return '<button data-v="' + t[0] + '">' + IC[t[0]] + '<span>' + t[1] + '</span></button>'; }).join('');

  render();
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* офлайн-режим недоступен */ }); });
  }
  window.FORMA.debug = { A: A, get R() { return R; }, go: go, V: V };
})();
