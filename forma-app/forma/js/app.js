/* Интерфейс приложения «Форма» */
(function () {
  'use strict';
  var D = FitData, L = FitLogic, V = FitVoice, St = FitStore, P = FitPlayer, EX = D.EX;

  var view = document.getElementById('view');
  var tabsEl = document.getElementById('tabs');
  var sheetEl = document.getElementById('sheet');
  var sheetBody = document.getElementById('sheetBody');
  var toastEl = document.getElementById('toast');

  var S = St.settings();
  var ui = { route: { name: 'today' }, progWeek: 0, libGroup: 'all', libQ: '', draft: null, openItem: null,
    expanded: {}, pickQ: '', pickGroup: 'all' };
  var ignorePop = 0, sheetOpen = false, deferredInstall = null, lastRoute = '';

  var DOW = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  var MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var DOW_SHORT = { 1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб', 0: 'Вс' };
  var QUALITY = ['', 'Легко', 'Нормально', 'Тяжело', 'Очень тяжело'];

  var TABS = {
    today: { label: 'Сегодня', icon: '<path d="M3 11l9-8 9 8M5 9.5V20h5v-6h4v6h5V9.5"/>' },
    program: { label: 'Программа', icon: '<path d="M7 2v3M17 2v3M3 9h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"/>' },
    library: { label: 'Упражнения', icon: '<path d="M2 10v4M5 7v10M19 7v10M22 10v4M5 12h14"/>' },
    progress: { label: 'Прогресс', icon: '<path d="M4 20V11M10 20V4M16 20v-8M22 20H2"/>' },
    settings: { label: 'Настройки', icon: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>' }
  };

  /* ---------- утилиты ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function btn(act, label, data, cls) {
    var a = '';
    for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) a += ' data-' + k + '="' + esc(data[k]) + '"';
    return '<button class="' + (cls || 'btn') + '" data-act="' + act + '"' + a + '>' + label + '</button>';
  }
  function fmtSec(v) { return v >= 90 ? L.fmtTime(v).replace(/^0/, '') : v + ' с'; }
  function valText(it) {
    var e = EX[it.ex], t = e.stopwatch ? 'до отказа' : e.type === 'time' ? fmtSec(it.val) : it.val + ' повт.';
    return e.perSide ? t + ' на сторону' : t;
  }
  function dateLabel(d) { return DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()]; }
  function shortDate(iso) { var a = iso.split('-'); return a[2] + '.' + a[1]; }
  function toast(msg) {
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { toastEl.hidden = true; }, 2200);
  }
  function applyVoiceCfg() {
    V.configure({ enabled: S.voice, rate: S.voiceRate, voiceURI: S.voiceURI, beeps: S.beeps, vibrate: S.vibrate });
  }
  function saveS() { St.saveSettings(S); applyVoiceCfg(); }
  function estOpts(w) { return { restMul: (w && w.restMul) || S.restMul, prep: S.prep, tempoMul: S.tempoMul }; }
  function weekDates() {
    var m = St.mondayOf(new Date()), out = [];
    for (var i = 0; i < 7; i++) { var d = new Date(m); d.setDate(m.getDate() + i); out.push(St.iso(d)); }
    return out;
  }

  /* ---------- навигация ---------- */
  function nav(name, params, replace) {
    var st = { name: name, params: params || {} };
    if (replace) history.replaceState(st, ''); else history.pushState(st, '');
    show(st);
  }
  function show(st) { ui.route = st; render(); }

  window.addEventListener('popstate', function (e) {
    if (ignorePop > 0) { ignorePop--; return; }
    if (P.active()) { history.pushState({ name: '__player' }, ''); P.requestExit(); return; }
    if (sheetOpen) { hideSheet(true); return; }
    var st = e.state;
    show(st && st.name && st.name.charAt(0) !== '_' ? st : { name: 'today' });
  });

  function showSheet(html) {
    sheetBody.innerHTML = '<div class="grab"></div>' + html;
    sheetEl.hidden = false;
    if (!sheetOpen) { sheetOpen = true; history.pushState({ name: '__sheet' }, ''); }
  }
  function hideSheet(fromPop) {
    if (!sheetOpen) return;
    sheetOpen = false; sheetEl.hidden = true; sheetBody.innerHTML = '';
    if (!fromPop) { ignorePop++; history.back(); }
  }
  sheetEl.addEventListener('click', function (e) { if (e.target === sheetEl) hideSheet(); });

  /* ---------- запуск тренировки ---------- */
  function startWorkout(w) {
    var plan = L.compile(w, estOpts(w));
    if (!plan.workCount) { toast('Добавьте хотя бы одно упражнение'); return; }
    var opts = { restMul: (w.restMul || S.restMul), prep: S.prep, repMode: S.repMode, tempoMul: S.tempoMul, voice: S.voice,
      cues: S.cues, voiceRate: S.voiceRate, voiceURI: S.voiceURI, beeps: S.beeps, vibrate: S.vibrate, wakeLock: S.wakeLock };
    history.pushState({ name: '__player' }, '');
    var finishedOk = false;
    P.start(w, opts, {
      onFinish: function (sum) {
        finishedOk = true;
        var src = w.src || { type: 'program' };
        St.addHistory({ type: 'workout', date: St.todayISO(), ts: Date.now(), day: w.id || '', week: w.week || null,
          title: w.title, seconds: sum.seconds, sets: sum.sets, rpe: sum.rpe, custom: src.type !== 'program', partial: !!sum.partial });
      },
      onClose: function () {
        // Завершили тренировку, запущенную из редактора: возвращаемся на экран, откуда его открывали
        if (finishedOk && ui.route.name === 'editor') { history.go(-2); return; }
        ignorePop++; history.back(); render();
      }
    });
  }
  function progWorkout(day, week) {
    var w = L.resolveDay(day, week);
    w.src = { type: 'program' };
    return w;
  }
  function openEditor(w, src) {
    ui.draft = L.clone(w);
    ui.draft.src = src;
    ui.draft.restMul = w.restMul || S.restMul;
    ui.openItem = null; ui.expanded = {};
    nav('editor');
  }

  /* ---------- экраны ---------- */
  function vToday() {
    var wk = St.currentWeek(S), wi = L.weekInfo(wk.week), ph = D.PHASES[wi.phase];
    var now = new Date(), slot = D.WEEK.filter(function (w) { return w.dow === now.getDay(); })[0];
    var hist = St.history(), tIso = St.todayISO();
    var doneToday = hist.filter(function (h) { return h.date === tIso && h.type === 'workout'; }).length > 0;
    var walkToday = hist.filter(function (h) { return h.date === tIso && h.type === 'walk'; }).length > 0;
    var h = '<div class="top"><h1>Форма</h1></div>';
    h += '<p class="sub" style="margin:-6px 2px 14px">' + dateLabel(now) + ' · неделя ' + wk.week + ' из 12 · «' + ph.name + '»' +
      (wi.deload ? '<span class="badge">разгрузочная</span>' : '') + '</p>';
    if (wk.finished) {
      h += '<div class="note">12 недель пройдены. Сделайте контрольные тесты на вкладке «Прогресс», затем можно начать цикл заново: Настройки → Программа.</div>';
    }
    if (deferredInstall) {
      h += '<div class="card"><b>Установить приложение</b><p class="sub" style="margin:4px 0 10px">Иконка на экране и работа без интернета.</p>' +
        btn('install', 'Установить', {}, 'btn primary sm') + '</div>';
    }
    if (slot && slot.day) {
      var w = progWorkout(slot.day, wk.week), est = L.estimateSeconds(w, estOpts());
      h += '<div class="card hero"><div class="sub">Тренировка ' + w.id + (w.deload ? ' · разгрузка' : '') + '</div><h2>' + esc(w.title) + '</h2>' +
        '<div class="meta">≈ ' + L.fmtMin(est) + ' · подходов: ' + L.countSets(w) + (doneToday ? ' <span class="badge ok">выполнена сегодня</span>' : '') + '</div>' +
        '<div class="names">' + esc(L.mainNames(w).join(' · ')) + '</div><div class="btns">' +
        btn('start-prog', doneToday ? 'Ещё раз' : 'Начать', { day: slot.day, week: wk.week }, 'btn primary') +
        btn('edit-prog', 'Настроить', { day: slot.day, week: wk.week }) + '</div></div>';
    } else if (slot) {
      h += '<div class="card rest-card"><h2>' + esc(slot.title) + '</h2><p class="meta" style="margin:6px 0 12px">' + esc(slot.text) + '</p><div class="btns">' +
        (slot.dow === 6 ? (walkToday ? '<span class="badge ok">прогулка отмечена</span>' : btn('walk', 'Отметить прогулку', {}, 'btn primary')) : '') +
        btn('tab', 'Выбрать тренировку', { tab: 'program' }) + '</div></div>';
    }
    // неделя
    var dates = weekDates();
    h += '<div class="week">' + [1, 2, 3, 4, 5, 6, 0].map(function (dow, i) {
      var s = D.WEEK.filter(function (x) { return x.dow === dow; })[0];
      var did = hist.some(function (x) { return x.date === dates[i] && (x.type === 'workout' || x.type === 'walk'); });
      var cls = (dow === now.getDay() ? 'today ' : '') + (did ? 'done ' : '') + (s.rest ? 'restd' : '');
      return '<button class="' + cls + '" ' + (s.day ? 'data-act="edit-prog" data-day="' + s.day + '" data-week="' + wk.week + '"' : '') + '>' +
        DOW_SHORT[dow] + '<b>' + (did ? '✓' : (s.day || '·')) + '</b></button>';
    }).join('') + '</div>';
    // вес
    var ws = St.weights(), last = ws.length ? ws[ws.length - 1] : null;
    h += '<div class="card"><div class="sub">Вес</div><div style="font-size:24px;font-weight:700">' +
      (last ? last.kg + ' кг' : S.startWeight + ' кг') + ' <span class="mut sm" style="font-weight:400">цель ' + S.goalMin + '–' + S.goalMax + ' кг</span></div>' +
      '<div class="inline" style="margin-top:10px"><input id="wToday" type="text" inputmode="decimal" autocomplete="off" placeholder="Вес сегодня, кг">' +
      btn('save-weight', 'Записать', { src: 'wToday' }, 'btn') + '</div></div>';
    return h;
  }

  function vProgram() {
    var cur = St.currentWeek(S).week, sel = ui.progWeek || cur, wi = L.weekInfo(sel);
    var h = '<div class="top"><h1>Программа</h1></div><div class="chips" id="wkChips">';
    for (var i = 1; i <= 12; i++) {
      h += '<button class="chip' + (i === sel ? ' on' : '') + (i === cur ? ' cur' : '') + '" data-act="prog-week" data-n="' + i + '">' + i + '</button>';
    }
    h += '</div><p class="sub" style="margin:-2px 2px 12px">Неделя ' + sel + ' · фаза «' + D.PHASES[wi.phase].name + '»' +
      (wi.deload ? '<span class="badge">разгрузочная</span>' : '') + (sel === cur ? '<span class="badge ok">сейчас</span>' : '') + '</p>';
    h += '<div class="list">';
    D.WEEK.forEach(function (s) {
      if (s.day) {
        var w = progWorkout(s.day, sel), est = L.estimateSeconds(w, estOpts());
        h += '<div class="card" style="padding:14px"><div style="display:flex;justify-content:space-between;gap:8px"><div><div class="sub">' + s.name + ' · ' + w.id + '</div>' +
          '<b style="font-size:18px">' + esc(w.title) + '</b><div class="sub">≈ ' + L.fmtMin(est) + ' · подходов: ' + L.countSets(w) + '</div></div></div>' +
          '<div class="btns" style="margin-top:10px">' + btn('start-prog', 'Старт', { day: s.day, week: sel }, 'btn primary sm') +
          btn('edit-prog', 'Настроить', { day: s.day, week: sel }, 'btn sm') + '</div></div>';
      } else {
        h += '<div class="card rest-card" style="padding:12px 14px"><b>' + s.name + ' · ' + esc(s.title) + '</b><div class="sub" style="margin-top:2px">' + esc(s.text) + '</div></div>';
      }
    });
    h += '</div><div class="sec-title">Контрольные тесты</div><div class="card"><p class="sub" style="margin:0 0 10px">Пресс за минуту, отжимания за три минуты и планка до отказа. Можно пройти в любой момент.</p>' +
      btn('edit-prog', 'Открыть тесты', { day: 'T', week: 12 }, 'btn sm') + '</div>';
    var cs = St.customs();
    h += '<div class="sec-title">Свои тренировки</div>';
    if (!cs.length) h += '<p class="sub" style="margin:0 2px 10px">Здесь появятся ваши тренировки. Соберите их из любых упражнений.</p>';
    cs.forEach(function (c) {
      var est = L.estimateSeconds(c, estOpts(c));
      h += '<div class="card" style="padding:14px"><b style="font-size:18px">' + esc(c.title) + '</b><div class="sub">≈ ' + L.fmtMin(est) + ' · подходов: ' + L.countSets(c) + '</div>' +
        '<div class="btns" style="margin-top:10px">' + btn('start-custom', 'Старт', { id: c.id }, 'btn primary sm') + btn('edit-custom', 'Править', { id: c.id }, 'btn sm') +
        btn('del-custom', 'Удалить', { id: c.id }, 'btn sm danger') + '</div></div>';
    });
    h += btn('new-custom', '＋ Собрать свою тренировку', {}, 'btn block');
    return h;
  }

  function exTags(e) {
    return (e.type === 'time' ? '<span class="tag">время</span>' : '<span class="tag">повторы</span>') +
      (e.perSide ? '<span class="tag">на сторону</span>' : '') + (e.impact ? '<span class="tag">прыжки</span>' : '');
  }
  function libList(q, group, act) {
    var h = '';
    D.GROUPS.forEach(function (g) {
      if (g.id === 'test') return;
      if (group !== 'all' && g.id !== group) return;
      var list = D.LIST.filter(function (e) {
        return e.group === g.id && (!q || e.name.toLowerCase().indexOf(q) >= 0);
      });
      if (!list.length) return;
      h += '<div class="sec-title">' + g.name + '</div>';
      list.forEach(function (e) {
        h += '<button class="it" data-act="' + act + '" data-id="' + e.id + '"><span class="tt"><b>' + esc(e.name) + '</b><span>' + exTags(e) + '</span></span>' +
          '<span class="go">' + (act === 'pick-ex' ? '＋' : '›') + '</span></button>';
      });
    });
    return h || '<p class="sub">Ничего не найдено.</p>';
  }
  function groupChips(sel, act) {
    var h = '<div class="chips"><button class="chip' + (sel === 'all' ? ' on' : '') + '" data-act="' + act + '" data-g="all">Все</button>';
    D.GROUPS.forEach(function (g) {
      if (g.id === 'test') return;
      h += '<button class="chip' + (sel === g.id ? ' on' : '') + '" data-act="' + act + '" data-g="' + g.id + '">' + g.name + '</button>';
    });
    return h + '</div>';
  }
  function vLibrary() {
    return '<div class="top"><h1>Упражнения</h1></div>' +
      '<div class="field"><input type="search" id="libQ" data-inp="lib" placeholder="Поиск упражнения" value="' + esc(ui.libQ) + '"></div>' +
      groupChips(ui.libGroup, 'lib-group') + '<div class="list" id="libList">' + libList(ui.libQ.toLowerCase(), ui.libGroup, 'ex-info') + '</div>';
  }
  function exInfoSheet(id, withAdd) {
    var e = EX[id];
    var h = '<h2>' + esc(e.name) + '</h2><div style="margin:6px 0">' + exTags(e) + '</div>' +
      '<div class="kv"><b>Как выполнять</b>' + esc(e.desc) + '</div>' +
      (e.cue ? '<div class="kv"><b>Главная подсказка</b>' + esc(e.cue) + '</div>' : '') +
      (e.easier ? '<div class="kv"><b>Легче</b>' + esc(e.easier) + '</div>' : '') +
      (e.harder ? '<div class="kv"><b>Сложнее</b>' + esc(e.harder) + '</div>' : '');
    h += '<div class="btns" style="margin-top:14px">' + btn('hear', 'Озвучить', { id: id }, 'btn') + btn('close-sheet', 'Закрыть', {}, 'btn primary') + '</div>';
    return h;
  }

  /* ----- прогресс ----- */
  function mmss(sec) { return Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60); }
  function weightChart(ws) {
    if (ws.length < 2) return '<p class="sub">Добавьте два и более измерения, чтобы увидеть график.</p>';
    var W = 320, H = 170, pl = 30, pr = 10, pt = 10, pb = 22;
    var vals = ws.map(function (w) { return w.kg; }).concat([S.goalMin, S.goalMax]);
    var lo = Math.floor(Math.min.apply(null, vals) - 0.5), hi = Math.ceil(Math.max.apply(null, vals) + 0.5);
    var t0 = St.parseISO(ws[0].date).getTime(), t1 = St.parseISO(ws[ws.length - 1].date).getTime(), span = Math.max(t1 - t0, 86400000);
    function x(iso) { return pl + (St.parseISO(iso).getTime() - t0) / span * (W - pl - pr); }
    function y(v) { return pt + (hi - v) / (hi - lo) * (H - pt - pb); }
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="График веса">';
    var step = hi - lo > 8 ? 2 : 1;
    for (var v = lo; v <= hi; v += step) {
      s += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#29434d" stroke-width="1"/><text x="' + (pl - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + '</text>';
    }
    s += '<rect x="' + pl + '" y="' + y(S.goalMax) + '" width="' + (W - pl - pr) + '" height="' + Math.max(2, y(S.goalMin) - y(S.goalMax)) + '" fill="rgba(139,224,78,.2)"/>';
    s += '<polyline fill="none" stroke="#8be04e" stroke-width="2.5" stroke-linejoin="round" points="' + ws.map(function (w) { return x(w.date).toFixed(1) + ',' + y(w.kg).toFixed(1); }).join(' ') + '"/>';
    ws.forEach(function (w) { s += '<circle cx="' + x(w.date).toFixed(1) + '" cy="' + y(w.kg).toFixed(1) + '" r="3.5" fill="#8be04e"/>'; });
    s += '<text x="' + pl + '" y="' + (H - 4) + '">' + shortDate(ws[0].date) + '</text><text x="' + (W - pr) + '" y="' + (H - 4) + '" text-anchor="end">' + shortDate(ws[ws.length - 1].date) + '</text></svg>';
    return s;
  }
  function vProgress() {
    var hist = St.history().filter(function (x) { return x.type === 'workout'; });
    var dates = weekDates(), wkH = hist.filter(function (x) { return dates.indexOf(x.date) >= 0; });
    var mins = Math.round(wkH.reduce(function (a, x) { return a + (x.seconds || 0); }, 0) / 60);
    var ws = St.weights(), last = ws.length ? ws[ws.length - 1] : null, first = ws.length ? ws[0] : null;
    var h = '<div class="top"><h1>Прогресс</h1></div><div class="tiles">' +
      '<div class="tile"><b>' + hist.length + '</b><span>тренировок всего</span></div>' +
      '<div class="tile"><b>' + wkH.length + ' из 5</b><span>на этой неделе</span></div>' +
      '<div class="tile"><b>' + mins + '</b><span>минут на этой неделе</span></div>' +
      '<div class="tile"><b>' + (last ? last.kg : S.startWeight) + ' кг</b><span>' + (last && first && last !== first ? (last.kg - first.kg > 0 ? '+' : '') + (Math.round((last.kg - first.kg) * 10) / 10) + ' кг с начала' : 'цель ' + S.goalMin + '–' + S.goalMax) + '</span></div></div>';
    // вес
    h += '<div class="sec-title">Вес</div><div class="card">' + weightChart(ws) +
      '<div class="inline" style="margin-top:10px"><input id="wProg" type="text" inputmode="decimal" autocomplete="off" placeholder="Вес, кг">' +
      btn('save-weight', 'Записать', { src: 'wProg' }, 'btn') + '</div>';
    if (ws.length) {
      h += '<div class="hist" style="margin-top:8px">' + ws.slice().reverse().slice(0, 6).map(function (w) {
        return '<div class="h"><span>' + shortDate(w.date) + '</span><span><b>' + w.kg + ' кг</b> ' + btn('del-weight', '✕', { date: w.date }, 'btn sm ghost') + '</span></div>';
      }).join('') + '</div>';
    }
    h += '</div>';
    // тесты
    var tests = St.tests();
    h += '<div class="sec-title">Контрольные тесты</div><div class="card">';
    [['situps', 'Пресс за 1 мин', 'раз'], ['pushups', 'Отжимания за 3 мин', 'раз'], ['plank', 'Планка до отказа', 'сек']].forEach(function (t) {
      var list = tests.filter(function (x) { return x.key === t[0]; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      var base = S.baseline[t[0]], lastT = list.length ? list[list.length - 1] : null;
      var f = function (v) { return t[0] === 'plank' ? mmss(v) : String(v); };
      var delta = lastT ? lastT.value - base : 0;
      h += '<div class="set"><div class="lb"><b>' + t[1] + '</b><small>старт: ' + f(base) + (lastT ? ' · последний: ' + f(lastT.value) + ' (' + shortDate(lastT.date) + ')' : '') + '</small></div>' +
        (lastT ? '<b style="color:' + (delta >= 0 ? 'var(--acc)' : 'var(--rest)') + '">' + (delta > 0 ? '+' : '') + (t[0] === 'plank' ? delta + ' с' : delta) + '</b>' : '<span class="mut">—</span>') + '</div>';
    });
    h += '<div class="btns" style="margin-top:10px">' + btn('edit-prog', 'Пройти тесты', { day: 'T', week: 12 }, 'btn primary sm') + btn('manual-test', 'Ввести вручную', {}, 'btn sm') + '</div></div>';
    // история
    h += '<div class="sec-title">История</div><div class="card">';
    var all = St.history().slice().sort(function (a, b) { return b.ts - a.ts; }).slice(0, 12);
    if (!all.length) h += '<p class="sub" style="margin:0">Пока пусто. Первая тренировка появится здесь.</p>';
    else {
      h += '<div class="hist">' + all.map(function (x) {
        var title = x.type === 'walk' ? 'Прогулка' : esc(x.title) + (x.partial ? ' (частично)' : '');
        var info = x.type === 'walk' ? '' : Math.max(1, Math.round((x.seconds || 0) / 60)) + ' мин' + (x.rpe ? ' · ' + QUALITY[x.rpe].toLowerCase() : '');
        return '<div class="h"><span><b>' + shortDate(x.date) + '</b> ' + title + '<br><span class="mut sm">' + info + '</span></span>' + btn('del-hist', '✕', { id: x.id }, 'btn sm ghost') + '</div>';
      }).join('') + '</div>';
    }
    return h + '</div>';
  }

  /* ----- настройки ----- */
  function sw(key, title, hint) {
    return '<div class="set"><div class="lb">' + title + (hint ? '<small>' + hint + '</small>' : '') + '</div><label class="sw"><input type="checkbox" data-chg="set" data-key="' + key + '"' +
      (S[key] ? ' checked' : '') + '><i></i></label></div>';
  }
  function segCtl(key, opts) {
    return '<div class="seg">' + opts.map(function (o) {
      return '<button class="' + (S[key] === o[0] ? 'on' : '') + '" data-act="set-seg" data-key="' + key + '" data-val="' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  function vSettings() {
    var ru = V.ruVoices(), wk = St.currentWeek(S).week;
    var h = '<div class="top"><h1>Настройки</h1></div>';
    if (!V.supported()) h += '<div class="warn">Этот браузер не поддерживает голосовые подсказки. Работают таймеры и звуковые сигналы.</div>';
    else if (!ru.length) h += '<div class="warn">Русский голос пока не найден. На Android откройте «Настройки → Язык и ввод → Синтез речи» (или «Службы речи Google»), установите русский язык и перезапустите приложение.</div>';
    h += '<div class="sec-title">Голос</div><div class="card">' +
      sw('voice', 'Голосовые подсказки', 'Название упражнения, отдых, смена стороны') +
      sw('cues', 'Подсказки по технике', 'Короткая фраза при первом упражнении') +
      '<div class="set"><div class="lb">Скорость речи</div></div>' + segCtl('voiceRate', [[0.85, 'Медленнее'], [1, 'Обычная'], [1.15, 'Быстрее']]);
    if (ru.length > 1) {
      h += '<div class="field" style="margin-top:12px"><label>Голос</label><select data-chg="voice-uri"><option value="">По умолчанию</option>' +
        ru.map(function (v) { return '<option value="' + esc(v.voiceURI) + '"' + (S.voiceURI === v.voiceURI ? ' selected' : '') + '>' + esc(v.name) + '</option>'; }).join('') + '</select></div>';
    }
    h += '<div style="margin-top:12px">' + btn('voice-test', 'Проверить голос', {}, 'btn sm') + '</div></div>';
    h += '<div class="sec-title">Подходы и отдых</div><div class="card">' +
      '<div class="set"><div class="lb">Счёт повторений</div></div>' + segCtl('repMode', [['auto', 'Голосом'], ['manual', 'Вручную']]) +
      '<p class="sub" style="margin:8px 0 12px">«Голосом» — приложение считает повторения вслух в заданном темпе. «Вручную» — вы сами нажимаете «Готово».</p>' +
      '<div class="set"><div class="lb">Темп счёта</div></div>' + segCtl('tempoMul', [[0.85, 'Быстрее'], [1, 'Обычный'], [1.2, 'Медленнее']]) +
      '<div class="set" style="margin-top:12px"><div class="lb">Отдых между подходами</div></div>' + segCtl('restMul', [[0.75, 'Короче'], [1, 'Как в плане'], [1.25, 'Длиннее']]) +
      '<div class="set" style="margin-top:12px"><div class="lb">Отдых в своих тренировках</div>' + stepper('defaultRest', S.defaultRest + ' с', 'dr') + '</div>' +
      '<div class="set"><div class="lb">Подготовка перед стартом</div></div>' + segCtl('prep', [[5, '5 с'], [10, '10 с'], [15, '15 с']]) +
      sw('beeps', 'Звуковые сигналы', 'Сигнал в последние 3 секунды и на старте') +
      sw('vibrate', 'Вибрация') + sw('wakeLock', 'Не гасить экран', 'Во время тренировки') + '</div>';
    h += '<div class="sec-title">Программа</div><div class="card"><div class="field"><label>Текущая неделя</label><select data-chg="week">' +
      Array.apply(null, Array(12)).map(function (_, i) { return '<option value="' + (i + 1) + '"' + (wk === i + 1 ? ' selected' : '') + '>Неделя ' + (i + 1) + ' · ' + D.PHASES[Math.floor(i / 4)].name + '</option>'; }).join('') +
      '</select></div>' + btn('restart-prog', 'Начать программу с 1-й недели', {}, 'btn sm') + '</div>';
    h += '<div class="sec-title">Профиль и цель</div><div class="card">' +
      numField('startWeight', 'Вес на старте, кг', S.startWeight, 0.1) +
      '<div class="inline"><div class="field" style="flex:1"><label>Цель от, кг</label><input type="text" inputmode="decimal" autocomplete="off" data-chg="num" data-key="goalMin" value="' + S.goalMin + '"></div>' +
      '<div class="field" style="flex:1"><label>до, кг</label><input type="text" inputmode="decimal" autocomplete="off" data-chg="num" data-key="goalMax" value="' + S.goalMax + '"></div></div>' +
      '<div class="sub" style="margin-bottom:8px">Результаты на старте</div>' +
      '<div class="inline"><div class="field" style="flex:1"><label>Пресс/мин</label><input type="number" inputmode="numeric" data-chg="base" data-key="situps" value="' + S.baseline.situps + '"></div>' +
      '<div class="field" style="flex:1"><label>Отжим./3 мин</label><input type="number" inputmode="numeric" data-chg="base" data-key="pushups" value="' + S.baseline.pushups + '"></div>' +
      '<div class="field" style="flex:1"><label>Планка, с</label><input type="number" inputmode="numeric" data-chg="base" data-key="plank" value="' + S.baseline.plank + '"></div></div></div>';
    h += '<div class="sec-title">Данные</div><div class="card"><p class="sub" style="margin:0 0 10px">Всё хранится только на этом телефоне. Сохраняйте копию, чтобы не потерять историю при очистке данных браузера.</p><div class="btns">' +
      btn('export', 'Сохранить копию', {}, 'btn sm') + '<label class="btn sm">Загрузить копию<input type="file" accept=".json,application/json" data-chg="import" hidden></label>' +
      btn('reset', 'Стереть всё', {}, 'btn sm danger') + '</div></div>';
    h += '<p class="sub" style="text-align:center;margin:18px 0 4px">Форма · версия 1.0</p>';
    return h;
  }
  function numField(key, label, val, step) {
    return '<div class="field"><label>' + label + '</label><input type="text" inputmode="decimal" autocomplete="off" data-chg="num" data-key="' + key + '" value="' + val + '"></div>';
  }
  function stepper(key, text, id) {
    return '<div class="stp"><button data-act="set-step" data-key="' + key + '" data-d="-1">−</button><output>' + text + '</output><button data-act="set-step" data-key="' + key + '" data-d="1">+</button></div>';
  }

  /* ----- редактор тренировки ----- */
  function blockSecs(b) {
    return L.estimateSeconds({ blocks: [b] }, { restMul: ui.draft.restMul, prep: 0, tempoMul: S.tempoMul });
  }
  function adjRow(label, text, f, bi, ii) {
    return '<div class="stp-row"><span>' + label + '</span><div class="stp"><button data-act="adj" data-f="' + f + '" data-bi="' + bi + '" data-ii="' + ii + '" data-d="-1">−</button><output>' + text + '</output>' +
      '<button data-act="adj" data-f="' + f + '" data-bi="' + bi + '" data-ii="' + ii + '" data-d="1">+</button></div></div>';
  }
  function blockHTML(b, bi) {
    var d = ui.draft, edge = b.kind === 'warmup' || b.kind === 'cooldown', h = '<div class="blk">';
    if (edge) {
      var open = ui.expanded[bi];
      h += '<button class="blk-h" data-act="toggle-blk" data-bi="' + bi + '"><div><b>' + esc(b.title) + '</b><br><span>упражнений: ' + b.items.length + ' · ≈ ' + L.fmtMin(blockSecs(b)) + '</span></div><span>' + (open ? 'Скрыть' : 'Показать') + '</span></button>';
      if (open) b.items.forEach(function (it) { h += '<div class="row-it"><b>' + esc(EX[it.ex].name) + '</b><span>' + valText(it) + '</span></div>'; });
      return h + '</div>';
    }
    if (b.mode === 'circuit') {
      var bo = ui.openItem === 'b' + bi;
      h += '<button class="blk-h" data-act="open-blk" data-bi="' + bi + '"><div><b>' + esc(b.title) + '</b><br><span>по кругу: ' + b.rounds + ' ' + L.plural(b.rounds, ['раунд', 'раунда', 'раундов']) +
        ' · отдых ' + b.restItem + ' / ' + b.restRound + ' с</span></div><span>' + (bo ? 'Скрыть' : 'Изменить') + '</span></button>';
      if (bo) {
        h += '<div class="edit">' + adjRow('Раундов', b.rounds, 'rounds', bi, -1) + adjRow('Отдых между упр.', b.restItem + ' с', 'restItem', bi, -1) +
          adjRow('Отдых после раунда', b.restRound + ' с', 'restRound', bi, -1) + '</div>';
      }
    } else {
      h += '<div class="blk-h"><div><b>' + esc(b.title) + '</b></div></div>';
    }
    b.items.forEach(function (it, ii) {
      var e = EX[it.ex], key = bi + ':' + ii, open = ui.openItem === key;
      var sub = b.mode === 'circuit' ? valText(it) : it.sets + ' × ' + valText(it) + ' · отдых ' + it.rest + ' с';
      h += '<button class="row-it' + (open ? ' open' : '') + '" data-act="open-item" data-bi="' + bi + '" data-ii="' + ii + '"><b>' + esc(e.name) + '</b><span>' + sub + '</span></button>';
      if (open) {
        h += '<div class="edit">';
        if (b.mode !== 'circuit') h += adjRow('Подходов', it.sets, 'sets', bi, ii);
        if (!e.stopwatch) h += adjRow(e.type === 'time' ? 'Время' : 'Повторений', e.type === 'time' ? fmtSec(it.val) : it.val, 'val', bi, ii);
        if (b.mode !== 'circuit') h += adjRow('Отдых', it.rest + ' с', 'rest', bi, ii);
        h += '<div class="acts">' + btn('mv', '↑', { bi: bi, ii: ii, d: -1 }, 'btn sm') + btn('mv', '↓', { bi: bi, ii: ii, d: 1 }, 'btn sm') +
          btn('ex-info', 'Техника', { id: it.ex }, 'btn sm') + btn('rm-item', 'Убрать', { bi: bi, ii: ii }, 'btn sm danger') + '</div></div>';
      }
    });
    return h + '</div>';
  }
  function vEditor() {
    var d = ui.draft;
    if (!d) { ui.route = { name: 'today' }; return vToday(); }
    var est = L.estimateSeconds(d, estOpts(d)), custom = d.src.type !== 'program';
    var h = '<div class="top"><button class="back" data-act="back" aria-label="Назад">‹</button>' +
      (custom ? '<input type="text" data-chg="draft-title" value="' + esc(d.title) + '" aria-label="Название тренировки" maxlength="60">' : '<h1 style="font-size:22px">' + esc(d.title) + '</h1>') + '</div>';
    h += '<p class="sub" style="margin:-4px 2px 10px">≈ ' + L.fmtMin(est) + ' · подходов: ' + L.countSets(d) + (d.week && d.src.type === 'program' ? ' · неделя ' + d.week : '') + '</p>';
    h += '<div class="sub" style="margin:0 2px 6px">Отдых между подходами</div><div class="seg" style="margin-bottom:14px">' + [[0.75, 'Короче'], [1, 'Как в плане'], [1.25, 'Длиннее']].map(function (o) {
      return '<button class="' + (d.restMul === o[0] ? 'on' : '') + '" data-act="rest-mul" data-v="' + o[0] + '">' + o[1] + '</button>';
    }).join('') + '</div>';
    d.blocks.forEach(function (b, bi) { h += blockHTML(b, bi); });
    h += '<div class="btns" style="margin-bottom:6px">' + btn('add-ex', '＋ Добавить упражнение', {}, 'btn block') + '</div>';
    if (custom) {
      var hasW = d.blocks.some(function (b) { return b.kind === 'warmup'; }), hasC = d.blocks.some(function (b) { return b.kind === 'cooldown'; });
      if (!hasW || !hasC) h += '<div class="btns">' + (!hasW ? btn('add-warm', '＋ Разминка', {}, 'btn sm') : '') + (!hasC ? btn('add-cool', '＋ Заминка', {}, 'btn sm') : '') + '</div>';
    }
    h += '<div class="bar-b">' + btn('save-draft', custom ? 'Сохранить' : 'В мои тренировки', {}, 'btn') + btn('start-draft', '▶ Начать', {}, 'btn primary') + '</div>';
    return h;
  }
  function pickerSheet() {
    return '<h2>Добавить упражнение</h2><div class="field" style="margin-top:10px"><input type="search" id="pickQ" data-inp="pick" placeholder="Поиск" value="' + esc(ui.pickQ) + '"></div>' +
      groupChips(ui.pickGroup, 'pick-group') + '<div class="list" id="pickList">' + libList(ui.pickQ.toLowerCase(), ui.pickGroup, 'pick-ex') + '</div>' +
      '<div style="margin-top:8px">' + btn('close-sheet', 'Готово', {}, 'btn primary block') + '</div>';
  }
  function addToDraft(id) {
    var d = ui.draft, e = EX[id], target = null;
    d.blocks.forEach(function (b) { if (b.custom) target = b; });
    if (!target) {
      target = { title: d.src.type === 'program' ? 'Добавленные упражнения' : 'Упражнения', kind: 'main', mode: 'straight', custom: true, items: [] };
      var ci = -1;
      d.blocks.forEach(function (b, i) { if (b.kind === 'cooldown') ci = i; });
      if (ci >= 0) d.blocks.splice(ci, 0, target); else d.blocks.push(target);
    }
    target.items.push({ ex: id, sets: 3, val: e.type === 'reps' ? 12 : 30, rest: S.defaultRest });
    toast('Добавлено: ' + e.name);
    render();
  }

  /* ---------- отрисовка ---------- */
  function render() {
    var name = ui.route.name, h;
    if (name === 'program') h = vProgram();
    else if (name === 'library') h = vLibrary();
    else if (name === 'progress') h = vProgress();
    else if (name === 'settings') h = vSettings();
    else if (name === 'editor') h = vEditor();
    else h = vToday();
    name = ui.route.name;
    var keep = name === lastRoute ? view.scrollTop : 0;
    view.innerHTML = h;
    view.scrollTop = keep;
    lastRoute = name;
    tabsEl.hidden = name === 'editor';
    tabsEl.innerHTML = Object.keys(TABS).map(function (k) {
      return '<button class="' + (k === name ? 'on' : '') + '" data-act="tab" data-tab="' + k + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + TABS[k].icon + '</svg>' + TABS[k].label + '</button>';
    }).join('');
    if (name === 'program') {
      var on = view.querySelector('#wkChips .chip.on');
      if (on) on.parentNode.scrollLeft = on.offsetLeft - on.parentNode.clientWidth / 2 + on.clientWidth / 2;
    }
  }

  /* ---------- действия ---------- */
  var acts = {
    tab: function (t) { if (ui.route.name === t.dataset.tab) { view.scrollTop = 0; return; } nav(t.dataset.tab, {}, true); },
    back: function () { history.back(); },
    'start-prog': function (t) { V.unlock(); startWorkout(progWorkout(t.dataset.day, +t.dataset.week)); },
    'edit-prog': function (t) {
      var w = progWorkout(t.dataset.day, +t.dataset.week);
      openEditor(w, { type: 'program' });
    },
    'prog-week': function (t) { ui.progWeek = +t.dataset.n; render(); },
    walk: function () {
      St.addHistory({ type: 'walk', date: St.todayISO(), ts: Date.now(), title: 'Прогулка' });
      toast('Прогулка отмечена'); render();
    },
    'start-custom': function (t) {
      var c = St.customs().filter(function (x) { return x.id === t.dataset.id; })[0];
      if (c) { V.unlock(); c.src = { type: 'custom', id: c.id }; startWorkout(c); }
    },
    'edit-custom': function (t) {
      var c = St.customs().filter(function (x) { return x.id === t.dataset.id; })[0];
      if (c) openEditor(c, { type: 'custom', id: c.id });
    },
    'del-custom': function (t) {
      if (confirm('Удалить эту тренировку?')) { St.removeCustom(t.dataset.id); render(); }
    },
    'new-custom': function () {
      openEditor({ title: 'Моя тренировка', blocks: [{ title: 'Упражнения', kind: 'main', mode: 'straight', custom: true, items: [] }] }, { type: 'new' });
      showSheet(pickerSheet());
    },
    'save-weight': function (t) {
      var inp = document.getElementById(t.dataset.src), v = parseFloat(String(inp.value).replace(',', '.'));
      if (!(v >= 30 && v <= 300)) { toast('Введите вес в килограммах'); return; }
      St.addWeight(St.todayISO(), Math.round(v * 10) / 10);
      toast('Вес записан'); render();
    },
    'del-weight': function (t) { St.removeWeight(t.dataset.date); render(); },
    'del-hist': function (t) { if (confirm('Удалить запись из истории?')) { St.removeHistory(t.dataset.id); render(); } },
    'manual-test': function () {
      showSheet('<h2>Результаты тестов</h2><p class="sub">Заполните то, что хотите сохранить.</p>' +
        '<div class="field"><label>Подъёмы корпуса за 1 мин</label><input type="number" inputmode="numeric" id="mt1"></div>' +
        '<div class="field"><label>Отжимания за 3 мин</label><input type="number" inputmode="numeric" id="mt2"></div>' +
        '<div class="field"><label>Планка, секунд</label><input type="number" inputmode="numeric" id="mt3"></div>' +
        '<div class="btns">' + btn('save-manual-test', 'Сохранить', {}, 'btn primary') + btn('close-sheet', 'Отмена', {}) + '</div>');
    },
    'save-manual-test': function () {
      [['situps', 'mt1'], ['pushups', 'mt2'], ['plank', 'mt3']].forEach(function (p) {
        var v = Math.round(+document.getElementById(p[1]).value);
        if (v > 0) St.addTest(p[0], v);
      });
      hideSheet(); toast('Сохранено'); render();
    },
    'lib-group': function (t) { ui.libGroup = t.dataset.g; render(); },
    'pick-group': function (t) {
      ui.pickGroup = t.dataset.g; showSheet(pickerSheet());
    },
    'ex-info': function (t) { showSheet(exInfoSheet(t.dataset.id)); },
    hear: function (t) { var e = EX[t.dataset.id]; V.unlock(); V.configure({ enabled: true, rate: S.voiceRate, voiceURI: S.voiceURI }); V.say(e.name + '. ' + e.cue); applyVoiceCfg(); },
    'close-sheet': function () { hideSheet(); },
    'add-ex': function () { showSheet(pickerSheet()); },
    'pick-ex': function (t) { addToDraft(t.dataset.id); },
    'open-item': function (t) {
      var k = t.dataset.bi + ':' + t.dataset.ii;
      ui.openItem = ui.openItem === k ? null : k; render();
    },
    'open-blk': function (t) {
      var k = 'b' + t.dataset.bi;
      ui.openItem = ui.openItem === k ? null : k; render();
    },
    'toggle-blk': function (t) { ui.expanded[t.dataset.bi] = !ui.expanded[t.dataset.bi]; render(); },
    'rest-mul': function (t) { ui.draft.restMul = +t.dataset.v; render(); },
    adj: function (t) {
      var d = ui.draft, bi = +t.dataset.bi, ii = +t.dataset.ii, dir = +t.dataset.d, f = t.dataset.f;
      var b = d.blocks[bi], it = ii >= 0 ? b.items[ii] : null, e = it ? EX[it.ex] : null;
      if (f === 'sets') it.sets = clamp(it.sets + dir, 1, 12);
      else if (f === 'val') {
        var tm = e.type === 'time';
        it.val = clamp(it.val + dir * (tm ? 5 : 1), tm ? 5 : 1, tm ? 900 : 300);
      } else if (f === 'rest') it.rest = clamp(it.rest + dir * 5, 0, 300);
      else if (f === 'rounds') b.rounds = clamp(b.rounds + dir, 1, 12);
      else if (f === 'restItem') b.restItem = clamp(b.restItem + dir * 5, 0, 300);
      else if (f === 'restRound') b.restRound = clamp(b.restRound + dir * 5, 0, 300);
      render();
    },
    mv: function (t) {
      var b = ui.draft.blocks[+t.dataset.bi], i = +t.dataset.ii, j = i + (+t.dataset.d);
      if (j < 0 || j >= b.items.length) return;
      var tmp = b.items[i]; b.items[i] = b.items[j]; b.items[j] = tmp;
      ui.openItem = t.dataset.bi + ':' + j; render();
    },
    'rm-item': function (t) {
      var d = ui.draft, bi = +t.dataset.bi, b = d.blocks[bi];
      b.items.splice(+t.dataset.ii, 1);
      if (!b.items.length && b.custom) d.blocks.splice(bi, 1);
      ui.openItem = null; render();
    },
    'add-warm': function () { var b = L.fixedBlock(D.WARMUP); ui.draft.blocks.unshift(b); render(); },
    'add-cool': function () { var b = L.fixedBlock(D.COOLDOWN); ui.draft.blocks.push(b); render(); },
    'save-draft': function () {
      var d = ui.draft, isProg = d.src.type === 'program';
      var w = { id: d.src.type === 'custom' ? d.src.id : undefined, title: (isProg ? d.title + ' (моя)' : d.title) || 'Моя тренировка',
        blocks: L.clone(d.blocks), restMul: d.restMul };
      w.blocks.forEach(function (b) { delete b.custom; });
      if (!L.compile(w, estOpts(w)).workCount) { toast('Добавьте хотя бы одно упражнение'); return; }
      var saved = St.saveCustom(w);
      d.src = { type: 'custom', id: saved.id }; d.title = saved.title;
      toast('Сохранено в «Свои тренировки»'); render();
    },
    'start-draft': function () { V.unlock(); var w = L.clone(ui.draft); startWorkout(w); },
    'set-seg': function (t) {
      var v = t.dataset.val; S[t.dataset.key] = isNaN(+v) ? v : +v; saveS(); render();
    },
    'set-step': function (t) {
      S[t.dataset.key] = clamp(S[t.dataset.key] + (+t.dataset.d) * 5, 15, 240); saveS(); render();
    },
    'voice-test': function () {
      V.unlock(); applyVoiceCfg();
      V.say('Здравствуйте! Я буду вести вашу тренировку. Отдых 60 секунд. Дальше: приседания. Подход 2 из 4. 12 повторений.');
    },
    'restart-prog': function () {
      if (confirm('Начать программу с 1-й недели? История сохранится.')) { St.setWeek(S, 1); S = St.settings(); toast('Программа начата заново'); render(); }
    },
    export: function () {
      var blob = new Blob([St.exportAll()], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'forma-' + St.todayISO() + '.json';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    },
    reset: function () {
      if (confirm('Стереть настройки, историю, вес и свои тренировки? Это нельзя отменить.')) {
        St.resetAll(); S = St.settings(); applyVoiceCfg(); toast('Данные стёрты'); render();
      }
    },
    install: function () {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      deferredInstall.userChoice.then(function () { deferredInstall = null; render(); });
    }
  };

  var chg = {
    set: function (t) { S[t.dataset.key] = t.checked; saveS(); render(); },
    num: function (t) {
      var v = parseFloat(String(t.value).replace(',', '.'));
      if (v > 0) { S[t.dataset.key] = v; saveS(); }
    },
    base: function (t) {
      var v = Math.round(+t.value);
      if (v > 0) { S.baseline[t.dataset.key] = v; saveS(); }
    },
    'voice-uri': function (t) { S.voiceURI = t.value; saveS(); },
    week: function (t) { St.setWeek(S, +t.value); S = St.settings(); toast('Неделя ' + t.value); render(); },
    'draft-title': function (t) { ui.draft.title = t.value.trim() || 'Моя тренировка'; },
    import: function (t) {
      var f = t.files && t.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try { St.importAll(String(r.result)); S = St.settings(); applyVoiceCfg(); toast('Данные загружены'); render(); }
        catch (e) { toast('Не удалось прочитать файл'); }
      };
      r.readAsText(f);
      t.value = '';
    }
  };

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var a = acts[t.getAttribute('data-act')];
    if (a) { e.preventDefault(); a(t, e); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target.closest('[data-chg]');
    if (t && chg[t.getAttribute('data-chg')]) chg[t.getAttribute('data-chg')](t);
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!t.getAttribute || !t.getAttribute('data-inp')) return;
    if (t.getAttribute('data-inp') === 'lib') {
      ui.libQ = t.value;
      document.getElementById('libList').innerHTML = libList(ui.libQ.toLowerCase(), ui.libGroup, 'ex-info');
    } else if (t.getAttribute('data-inp') === 'pick') {
      ui.pickQ = t.value;
      document.getElementById('pickList').innerHTML = libList(ui.pickQ.toLowerCase(), ui.pickGroup, 'pick-ex');
    }
  });

  /* ---------- запуск ---------- */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferredInstall = e;
    if (ui.route.name === 'today' && !P.active()) render();
  });
  window.addEventListener('appinstalled', function () { deferredInstall = null; toast('Приложение установлено'); });
  if (window.speechSynthesis) {
    speechSynthesis.addEventListener('voiceschanged', function () { if (ui.route.name === 'settings' && !sheetOpen) render(); });
  }

  P.init();
  applyVoiceCfg();
  history.replaceState({ name: 'today' }, '');
  render();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* без офлайн-режима */ }); });
  }
  window.__fit = { ui: ui, nav: nav, S: function () { return S; } };
})();
