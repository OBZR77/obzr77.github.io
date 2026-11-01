/* Форма: хранилище, календарь, сборка занятий, голос и сигналы. */
(function () {
  'use strict';
  var F = window.FORMA, E = F.EX;

  /* ---------- Хранилище ---------- */
  var KEY = 'forma.v1';
  function def() {
    return {
      v: 1,
      s: { start: null, voice: true, beep: true, wake: true, theme: 'auto', bands: false },
      log: [], meas: [], bp: [], tests: {}, loads: {}, last: {}, checks: {}, bpAck: false
    };
  }
  function merge(a, b) {
    for (var k in b) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], b[k]);
      else a[k] = b[k];
    }
    return a;
  }
  var S = def();
  F.store = {
    get: function () { return S; },
    load: function () { try { var r = localStorage.getItem(KEY); if (r) S = merge(def(), JSON.parse(r)); } catch (e) { /* хранилище недоступно */ } return S; },
    save: function () { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } },
    replace: function (o) { S = merge(def(), o); F.store.save(); },
    export: function () { return JSON.stringify(S); }
  };

  /* ---------- Даты ---------- */
  var D = (F.date = {});
  D.pad = function (n) { return (n < 10 ? '0' : '') + n; };
  D.ymd = function (d) { return d.getFullYear() + '-' + D.pad(d.getMonth() + 1) + '-' + D.pad(d.getDate()); };
  D.parse = function (s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  D.add = function (d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return x; };
  D.dow = function (d) { return (d.getDay() + 6) % 7; };
  D.monday = function (d) { return D.add(d, -D.dow(d)); };
  D.nextMonday = function (d) { return D.add(d, 7 - D.dow(d)); };
  D.fmt = function (d) { return D.pad(d.getDate()) + '.' + D.pad(d.getMonth() + 1); };
  D.fmtFull = function (s) { var d = typeof s === 'string' ? D.parse(s) : s; return D.pad(d.getDate()) + '.' + D.pad(d.getMonth() + 1) + '.' + d.getFullYear(); };
  D.today = function () { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  /* неделя программы для даты (0 — подготовка), null если старт не задан */
  F.weekOf = function (date) {
    if (!S.s.start) return null;
    var days = Math.round((date - D.parse(S.s.start)) / 864e5);
    return Math.floor(days / 7);
  };
  F.dateOf = function (week, dayIdx) { return D.add(D.parse(S.s.start), week * 7 + dayIdx); };

  /* ---------- Сборка шагов ---------- */
  var SIDES = {
    default: ['Левая нога', 'Правая нога'],
    row1: ['Левая рука', 'Правая рука'],
    archer: ['Влево', 'Вправо'],
    deadbug: ['Левая сторона', 'Правая сторона'],
    sideplank: ['Левая сторона', 'Правая сторона'],
    openbook: ['Левая сторона', 'Правая сторона'],
    hipflexor: ['Левая нога', 'Правая нога'],
    hamstring: ['Левая нога', 'Правая нога'],
    shoulderwall: ['Левая рука', 'Правая рука'],
    ankle: ['Левая нога', 'Правая нога']
  };
  function sideNames(id) { return SIDES[id] || SIDES['default']; }
  function pick(r, wib) {
    var lo = r[0], hi = r[1];
    if (wib === 2) return Math.round((lo + hi) / 2);
    if (wib === 3) return hi;
    return lo;
  }
  function nm(id) { return E[id] ? E[id].n : id; }
  function prep(id, sub) { return { t: 'prep', sec: 5, ex: id, title: nm(id), sub: sub || 'Приготовьтесь', say: 'Приготовьтесь. ' + nm(id) }; }
  function rest(sec, sub, nextEx) { return { t: 'rest', sec: sec, title: 'Отдых', sub: sub || '', next: nextEx || null, say: 'Отдых' }; }
  function info(title, text, btn, extra) { var o = { t: 'info', title: title, sub: text, btn: btn || 'Дальше' }; if (extra) for (var k in extra) o[k] = extra[k]; return o; }
  function timed(id, sec, sub, o) { var r = { t: 'time', ex: id, sec: sec, title: nm(id), sub: sub || '', say: nm(id) }; if (o) for (var k in o) r[k] = o[k]; return r; }

  function warmupSteps() {
    var out = [info('Разминка 8 минут', 'Марш, суставная гимнастика, затем круг упражнений. Двигайтесь без рывков, дыхание ровное.', 'Начать разминку', { badge: 'Разминка' })];
    F.warmup.forEach(function (w) {
      if (w.sec) out.push(timed(w.ex, w.sec, '', { badge: 'Разминка', nolog: true }));
      else out.push({ t: 'reps', ex: w.ex, title: nm(w.ex), target: w.reps, set: 1, sets: 1, badge: 'Разминка', nolog: true, quick: true, say: nm(w.ex) });
    });
    return out;
  }
  function cooldownSteps(min) {
    return [timed('walk', (min || 5) * 60, 'Заминка: спокойная ходьба до снижения пульса, затем лёгкая растяжка нагруженных мышц.', { title: 'Заминка', badge: 'Заминка', nolog: true, say: 'Заминка' })];
  }

  function strengthSteps(items, wi) {
    var steps = [];
    items = items.map(function (it) { return (it.needsBands && !F.store.get().s.bands) ? (function () { var a = it.alt, o = {}; for (var k in a) o[k] = a[k]; o.rest = a.rest; return o; })() : it; });
    items.forEach(function (it, ix) {
      var sets = it.sets;
      if (wi.deload) sets = Math.max(1, sets >= 4 ? sets - 2 : sets - 1);
      var isTime = !!it.sec;
      var tgt = isTime ? pick(it.sec, wi.wib) : pick(it.reps, wi.wib);
      for (var s = 1; s <= sets; s++) {
        var sides = it.side ? sideNames(it.ex) : [null];
        sides.forEach(function (sd, si) {
          if (s === 1 && si === 0) steps.push(prep(it.ex, 'Подходов: ' + sets + (it.side ? ' на каждую сторону' : '')));
          var st = { t: isTime ? 'time' : 'reps', ex: it.ex, title: nm(it.ex), set: s, sets: sets, side: sd, tempo: it.tempo || null, load: !!E[it.ex].load, say: nm(it.ex) + (sd ? ', ' + sd.toLowerCase() : '') };
          if (isTime) { st.sec = tgt; st.range = it.sec; } else { st.target = tgt; st.range = it.reps; }
          steps.push(st);
          if (sd && si === 0) steps.push({ t: 'rest', sec: 10, title: 'Смена стороны', sub: sides[1], say: 'Смените сторону', short: true });
        });
        if (!(ix === items.length - 1 && s === sets)) {
          var nxt = (s === sets) ? items[ix + 1].ex : it.ex;
          var rsub = (s === sets) ? 'Дальше: ' + nm(nxt) : 'Следующий подход ' + (s + 1) + ' из ' + sets;
          steps.push(rest(it.rest || 60, rsub, nxt));
        }
      }
    });
    return steps;
  }

  function finalize(steps) { return steps.filter(Boolean); }

  function bpGate() {
    var st = F.store.get(), b = st.bp.slice(-14);
    if (b.length >= 14) {
      var sy = 0, di = 0;
      b.forEach(function (x) { sy += x.sys; di += x.dia; });
      sy /= b.length; di /= b.length;
      if (sy >= 135 || di >= 85) return { state: 'high', sys: Math.round(sy), dia: Math.round(di) };
      return { state: 'ok', sys: Math.round(sy), dia: Math.round(di) };
    }
    return { state: st.bpAck ? 'ack' : 'few', n: b.length };
  }
  F.bpGate = bpGate;

  /* Описание занятия: { id, kind, title, sub, min, preview[], build() } */
  function mk(id, kind, title, sub, min, preview, build) { return { id: id, kind: kind, title: title, sub: sub, min: min, preview: preview || [], build: build }; }

  function strengthPreview(items) { return items.map(function (it) { var e = E[it.ex]; return { ex: it.ex, txt: (it.sets + ' × ' + (it.sec ? it.sec[0] + (it.sec[1] !== it.sec[0] ? '–' + it.sec[1] : '') + ' с' : it.reps[0] + (it.reps[1] !== it.reps[0] ? '–' + it.reps[1] : '')) + (it.side ? ' на сторону' : '') + (it.tempo ? ' · ' + it.tempo : '')) }; }); }

  function lightSession(w, d) {
    var wi = F.weekInfo(w);
    return mk(w + '-' + d, 'light', 'Лёгкий день', 'Подвижность 10 мин, быстрая ходьба 30 мин' + (w >= 1 ? ', мини-подходы подтягиваний' : ''), 45,
      F.mobility.map(function (m) { return { ex: m.ex, txt: m.reps ? m.reps + ' повт.' + (m.side ? ' на сторону' : '') : m.sec + ' с' + (m.side ? ' на сторону' : '') }; }).concat([{ ex: 'walk', txt: '30 мин, зона 1–2' }]).concat(w >= 1 ? [{ ex: 'minipull', txt: F.miniPull[wi.block] }] : []),
      function () {
        var st = [info('Подвижность 10 минут', 'Шесть коротких упражнений. Двигайтесь плавно, без боли.', 'Начать', { badge: 'Подвижность' })];
        F.mobility.forEach(function (m, ix) {
          if (m.side) {
            sideNames(m.ex).forEach(function (sd) {
              if (m.sec) st.push(timed(m.ex, m.sec, sd, { side: sd, nolog: true, badge: 'Подвижность', say: nm(m.ex) + ', ' + sd.toLowerCase() }));
              else st.push({ t: 'reps', ex: m.ex, title: nm(m.ex), target: m.reps, side: sd, set: 1, sets: 1, nolog: true, quick: true, badge: 'Подвижность', say: nm(m.ex) + ', ' + sd.toLowerCase() });
            });
          } else st.push(timed(m.ex, m.sec, '', { nolog: true, badge: 'Подвижность' }));
        });
        st.push(timed('walk', 30 * 60, 'Быстрый шаг в зонах 1–2 (пульс 116–139). Можно говорить целыми фразами. Закончить раньше можно кнопкой «Дальше».', { title: 'Быстрая ходьба 30 минут', nolog: true, say: 'Быстрая ходьба. Тридцать минут', skippable: true }));
        if (w >= 1) st.push(info('Мини-подходы подтягиваний', F.miniPull[wi.block] + '. Это половина вашего максимума, никогда до отказа, с промежутком не меньше часа. Сделайте их на школьном турнике в течение дня.', 'Отметить выполненным', { ex: 'minipull' }));
        return st;
      });
  }

  function longSession(w, d) {
    var wi = F.weekInfo(w), b = wi.block;
    var pull = b === 1 ? { sets: 5, reps: [2, 2], neg: 3 } : b === 2 ? { sets: 6, reps: [2, 3], neg: 4 } : { sets: 5, reps: [3, 4], neg: 0 };
    return mk(w + '-' + d, 'long', 'Длинное кардио и подтягивания', 'Зона 2 (60–90 мин), затем турник дома около 20 минут', 90,
      [{ ex: 'longcardio', txt: '60–90 мин, зона 2' }, { ex: 'pullup', txt: pull.sets + ' × ' + (pull.reps[0] === pull.reps[1] ? pull.reps[0] : pull.reps[0] + '–' + pull.reps[1]) }].concat(pull.neg ? [{ ex: 'negative', txt: pull.neg + ' × 1, 5 с' }] : []),
      function () {
        var st = [timed('longcardio', 60 * 60, 'Ходьба, велосипед, зимой лыжи. Пульс 128–139, разговорный темп. Таймер на 60 минут; закончить раньше или продолжить позже можно кнопкой «Дальше».', { title: 'Длинное кардио', nolog: true, skippable: true, say: 'Длинное кардио. Зона два' })];
        var items = [{ ex: 'pullup', sets: wi.deload ? Math.max(1, pull.sets - 1) : pull.sets, reps: pull.reps, rest: 180 }];
        st = st.concat(strengthSteps(items, { wib: 2, deload: false }).map(function (x) { if (x.t === 'reps') { x.target = pick(pull.reps, wi.wib); } return x; }));
        if (pull.neg) {
          st.push(rest(120, 'Дальше: медленные опускания', 'negative'));
          st = st.concat(strengthSteps([{ ex: 'negative', sets: pull.neg, reps: [1, 1], tempo: '5-0-0', rest: 60 }], { wib: 1, deload: false }));
        }
        return st;
      });
  }

  function testSession(w, d, which) {
    var title = which === 1 ? 'Тест: отжимания, пресс, планка' : which === 2 ? 'Тест: болгарский присед и подтягивания' : which === 3 ? 'Тест: болгарский присед' : 'Тест: подтягивания максимум';
    var prev = which === 1 ? [{ ex: 'testpush', txt: 'максимум' }, { ex: 'testabs', txt: '1 мин' }, { ex: 'testplank', txt: 'до потери положения' }] : which === 2 ? [{ ex: 'testbulg', txt: 'на ногу' }, { ex: 'testpull', txt: 'максимум' }] : which === 3 ? [{ ex: 'testbulg', txt: 'на ногу' }] : [{ ex: 'testpull', txt: 'максимум' }];
    return mk(w + '-' + d, 'test', title, 'Результаты сохраняются в разделе «Замеры → Тесты»', 40, prev, function () {
      var st = [];
      if (which === 1) {
        st = st.concat(warmupSteps());
        st.push(prep('testpush', 'Максимум строго, без пауз'));
        st.push({ t: 'input', key: 'push', ex: 'testpush', title: 'Отжимания подряд', sub: 'Сколько повторений сделали?', unit: 'раз', week: w });
        st.push(rest(300, 'Через 5 минут: подъём корпуса за 1 минуту', 'testabs'));
        st.push(prep('testabs', 'Руки за головой, лопатки касаются пола'));
        st.push(timed('testabs', 60, 'Как можно больше за минуту', { nolog: true }));
        st.push({ t: 'input', key: 'abs', ex: 'testabs', title: 'Подъём корпуса за 1 мин', sub: 'Сколько повторений?', unit: 'раз', week: w });
        st.push(rest(300, 'Через 5 минут: планка на локтях', 'testplank'));
        st.push(prep('testplank', 'Остановите секундомер, когда спина провисла'));
        st.push({ t: 'stopwatch', key: 'plank', ex: 'testplank', title: 'Планка на локтях', sub: 'Нажмите «Стоп», когда потеряли положение тела', week: w });
      }
      if (which === 2 || which === 3) {
        st = st.concat(warmupSteps());
        st.push(prep('testbulg', 'Рюкзак 10 кг у груди, запас 1'));
        st.push({ t: 'input', key: 'bulg', ex: 'testbulg', title: 'Болгарский присед на ногу', sub: 'Сколько повторений на каждую ногу? Введите меньшее.', unit: 'раз', week: w });
      }
      if (which === 2 || which === 4) {
        st.push(info('Подтягивания максимум', 'Турник, хват сверху, без раскачки. Один подход до отказа.', 'Готов(а)', { ex: 'testpull' }));
        st.push({ t: 'input', key: 'pull', ex: 'testpull', title: 'Подтягивания максимум', sub: 'Сколько повторений?', unit: 'раз', week: w });
      }
      st = st.concat(cooldownSteps(3));
      return st;
    });
  }

  F.session = function (w, d) {
    var wi = F.weekInfo(w), st = F.store.get();
    if (d === 6) return mk(w + '-' + d, 'rest', 'Отдых или прогулка', 'Лёгкая подвижность по желанию', 0, [], function () { return []; });
    if (w === 0) {
      if (d === 0) return mk(w + '-' + d, 'prep', 'Подготовка и замеры', 'Тонометр, резина, замеры, фото', 30, [], null);
      if (d === 2) return testSession(w, d, 1);
      if (d === 4) return testSession(w, d, 3);
      if (d === 5) { var s0 = testSession(w, d, 4); return s0; }
      return lightSession(w, d);
    }
    if (w === 12) {
      if (d === 0) return testSession(w, d, 1);
      if (d === 2) return testSession(w, d, 3);
      if (d === 4) return mk(w + '-' + d, 'walk', 'Лёгкая прогулка', 'Подвижность и ходьба, без нагрузки', 40, [{ ex: 'walk', txt: '30–40 мин' }], function () { return [timed('walk', 35 * 60, 'Спокойная прогулка, лёгкая подвижность. Закончить раньше можно кнопкой «Дальше».', { title: 'Лёгкая прогулка', nolog: true, skippable: true })]; });
      if (d === 5) return testSession(w, d, 4);
      return lightSession(w, d);
    }
    if ((w === 4 || w === 8) && d === 4) return testSession(w, d, 1);
    if ((w === 4 || w === 8) && d === 5) return testSession(w, d, 2);
    if (d === 1 || d === 3) return lightSession(w, d);
    if (d === 5) return longSession(w, d);
    var b = wi.block;
    if (d === 0 || d === 2) {
      var key = d === 0 ? 'A' : 'B', items = blockItems(b)[key];
      var ttl = d === 0 ? 'Тренировка A: ноги и кор' : 'Тренировка B: верх, жим и тяга';
      return mk(w + '-' + d, 'strength', ttl, 'Темп указан в каждом упражнении. Запас повторений: ' + wi.rir + (wi.deload ? '. Разгрузочная неделя: меньше подходов' : ''), 55, strengthPreview(items.map(function (it) { return (it.needsBands && !st.s.bands) ? it.alt : it; })), function () {
        var arr = warmupSteps().concat(strengthSteps(items, wi));
        return finalize(arr.concat(cooldownSteps(5)));
      });
    }
    /* пятница: C */
    if (b === 1) {
      return mk(w + '-' + d, 'circuit', 'Тренировка C: круг 40/20', '4 раунда по 5 станций, работа 40 с, отдых 20 с. Пульс в зоне 3 (139–150)', 50,
        F.circuit.map(function (e) { return { ex: e, txt: '40 с / 20 с' }; }),
        function () {
          var steps = warmupSteps();
          steps.push(info('Круг 40/20', '4 раунда по 5 станций. 40 секунд работа, 20 секунд отдых, между раундами 2 минуты. Пульс в рабочих отрезках в зоне 3 (139–150), в конце раунда не выше 150.', 'Начать круг'));
          for (var r = 1; r <= 4; r++) {
            F.circuit.forEach(function (e, i) {
              steps.push(timed(e, 40, 'Раунд ' + r + ' из 4 · станция ' + (i + 1) + ' из 5', { badge: 'Круг', say: nm(e), load: false }));
              if (i < 4) steps.push({ t: 'rest', sec: 20, title: 'Отдых', sub: 'Дальше: ' + nm(F.circuit[i + 1]), next: F.circuit[i + 1], say: 'Отдых', short: true });
              else if (r < 4) steps.push(rest(120, 'Раунд ' + (r + 1) + ' из 4: ' + nm(F.circuit[0]), F.circuit[0]));
            });
          }
          steps.push(info('Кор-финишер 6 минут', 'Мёртвый жук, полая планка, «птица-собака»: по минуте, два круга.', 'Начать'));
          for (var k = 0; k < 2; k++) F.finisher.forEach(function (f) { steps.push(timed(f.ex, f.sec, 'Круг ' + (k + 1) + ' из 2', { nolog: true })); });
          return steps.concat(cooldownSteps(5));
        });
    }
    var n, secW, secR, zone, zn;
    if (b === 2) { n = wi.wib === 4 ? 4 : 5 + wi.wib; secW = 60; secR = 90; zone = wi.wib === 4 ? 3 : 4; zn = wi.wib === 4 ? '139–150' : '150–162'; }
    else { n = [5, 6, 6, 0][wi.wib - 1]; secW = 120; secR = 120; zone = 4; zn = '150–162'; }
    if (n === 0) return mk(w + '-' + d, 'walk', 'Лёгкая прогулка', 'Подвижность и ходьба', 40, [{ ex: 'walk', txt: '35 мин' }], function () { return [timed('walk', 35 * 60, 'Спокойная прогулка.', { title: 'Лёгкая прогулка', nolog: true, skippable: true })]; });
    return mk(w + '-' + d, 'intervals', 'Тренировка C: интервалы без прыжков', n + ' × ' + (secW === 60 ? '1 мин' : '2 мин') + ' в зоне ' + zone + ' (' + zn + '), отдых ' + (secR === 90 ? '90 с' : '2 мин') + ' в зонах 1–2', 50,
      F.intervalFormats.map(function (e) { return { ex: e, txt: 'формат работы' }; }),
      function () {
        var steps = warmupSteps();
        steps.push(info('Интервалы', n + ' отрезков по ' + (secW === 60 ? '1 минуте' : '2 минуты') + ' в зоне ' + zone + ' (' + zn + ' уд/мин), между ними активный отдых. Если пульс не выходит в зону или взлетает выше 162, меняйте формат или темп. При головокружении, боли в груди или необычной одышке остановитесь.', 'Начать интервалы'));
        for (var i = 1; i <= n; i++) {
          var fe = F.intervalFormats[(i - 1) % F.intervalFormats.length];
          steps.push(timed(fe, secW, 'Интервал ' + i + ' из ' + n + ' · зона ' + zone + ' (' + zn + ')', { badge: 'Интервал', say: 'Интервал ' + i + '. ' + nm(fe) }));
          if (i < n) steps.push({ t: 'rest', sec: secR, title: 'Активный отдых', sub: 'Ходьба на месте, зоны 1–2. Дальше: ' + nm(F.intervalFormats[i % F.intervalFormats.length]), next: F.intervalFormats[i % F.intervalFormats.length], say: 'Активный отдых' });
        }
        steps.push(info('Кор 6 минут', 'Мёртвый жук, полая планка, «птица-собака» по минуте, два круга.', 'Начать'));
        for (var k = 0; k < 2; k++) F.finisher.forEach(function (f) { steps.push(timed(f.ex, f.sec, 'Круг ' + (k + 1) + ' из 2', { nolog: true })); });
        return steps.concat(cooldownSteps(5));
      });
  };
  function blockItems(b) { return F.blockItems[b]; }

  F.isIntervals = function (sess) { return sess && sess.kind === 'intervals'; };

  /* ---------- Звук и голос ---------- */
  var ac = null;
  F.audio = {
    unlock: function () { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { /* ignore */ } },
    beep: function (f, ms) {
      if (!F.store.get().s.beep) return;
      try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        var o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = f || 880; g.gain.value = 0.08; o.connect(g); g.connect(ac.destination);
        o.start(); o.stop(ac.currentTime + (ms || 120) / 1000);
      } catch (e) { /* ignore */ }
    },
    say: function (txt) {
      if (!F.store.get().s.voice || !window.speechSynthesis || !txt) return;
      try {
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(txt); u.lang = 'ru-RU'; u.rate = 1;
        window.speechSynthesis.speak(u);
      } catch (e) { /* ignore */ }
    }
  };
  var wl = null;
  F.wake = {
    on: function () {
      if (!F.store.get().s.wake) return;
      try {
        var cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.KeepAwake;
        if (cap && cap.keepAwake) { cap.keepAwake(); return; }
        if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { wl = l; }).catch(function () { /* ignore */ });
      } catch (e) { /* ignore */ }
    },
    off: function () {
      try {
        var cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.KeepAwake;
        if (cap && cap.allowSleep) cap.allowSleep();
        if (wl) { wl.release(); wl = null; }
      } catch (e) { /* ignore */ }
    }
  };
})();
