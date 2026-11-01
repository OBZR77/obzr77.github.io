/* Форма: хранилище, календарь, сборка занятий, голос и сигналы. */
(function () {
  'use strict';
  var F = window.FORMA, E = F.EX;

  /* ---------- Хранилище ---------- */
  var KEY = 'forma.v1';
  function def() {
    return {
      v: 2,
      s: { start: null, voice: true, coach: 'full', beep: true, wake: true, theme: 'auto', bands: false, age: 50, hrRest: 60, goalMin: 30 },
      mode: null, pos: null, cycle: 1, over: {}, custom: [], nid: 1,
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
  /* версия 1 хранила дату старта и привязывала занятия к календарю */
  function migrate(o) {
    if (o.v < 2) {
      o.v = 2;
      if (o.s.start && !o.pos) {
        var days = Math.round((D.today() - D.parse(o.s.start)) / 864e5), w = Math.max(0, Math.min(12, Math.floor(days / 7)));
        o.mode = 'forma'; o.pos = { week: w, since: D.ymd(D.today()) };
      }
    }
    return o;
  }
  var S = def();
  F.store = {
    get: function () { return S; },
    load: function () { try { var r = localStorage.getItem(KEY); if (r) S = migrate(merge(def(), JSON.parse(r))); } catch (e) { /* хранилище недоступно */ } return S; },
    save: function () { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } },
    replace: function (o) { S = migrate(merge(def(), o)); F.store.save(); },
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
  /* зоны пульса пользователя: zr(1, 2) даёт «116–139» */
  F.zones = function () { return F.hr(S.s.age || 50, S.s.hrRest || 60); };
  function zr(a, b) { var h = F.zones(); return h.z[a - 1][0] + '–' + h.z[(b || a) - 1][1]; }
  F.zr = zr;

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
    ankle: ['Левая нога', 'Правая нога'],
    tricepstretch: ['Левая рука', 'Правая рука'],
    chest: ['Левая сторона', 'Правая сторона']
  };
  function sideNames(id) { return SIDES[id] || SIDES['default']; }
  function pick(r, wib) {
    var lo = r[0], hi = r[1];
    if (wib === 2) return Math.round((lo + hi) / 2);
    if (wib === 3) return hi;
    return lo;
  }
  F.pick = pick;
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
    var r = lightSession0(w, d); r.opt = true; return r;
  }
  function lightSession0(w, d) {
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
        st.push(timed('walk', 30 * 60, 'Быстрый шаг в зонах 1–2 (пульс ' + zr(1, 2) + '). Можно говорить целыми фразами. Закончить раньше можно кнопкой «Дальше».', { title: 'Быстрая ходьба 30 минут', nolog: true, say: 'Быстрая ходьба. Тридцать минут', skippable: true }));
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
        var st = [timed('longcardio', 60 * 60, 'Ходьба, велосипед, зимой лыжи. Пульс ' + zr(2) + ', разговорный темп. Таймер на 60 минут; закончить раньше или продолжить позже можно кнопкой «Дальше».', { title: 'Длинное кардио', nolog: true, skippable: true, say: 'Длинное кардио. Зона два' })];
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
      var key = d === 0 ? 'A' : 'B', items = F.applyOver(w + '-' + d, blockItems(b)[key]);
      var ttl = d === 0 ? 'Тренировка A: ноги и кор' : 'Тренировка B: верх, жим и тяга';
      return mk(w + '-' + d, 'strength', ttl, 'Темп указан в каждом упражнении. Запас повторений: ' + wi.rir + (wi.deload ? '. Разгрузочная неделя: меньше подходов' : ''), 55, strengthPreview(items.map(function (it) { return (it.needsBands && !st.s.bands) ? it.alt : it; })), function () {
        var arr = warmupSteps().concat(strengthSteps(items, wi));
        return finalize(arr.concat(cooldownSteps(5)));
      });
    }
    /* пятница: C */
    if (b === 1) {
      return mk(w + '-' + d, 'circuit', 'Тренировка C: круг 40/20', '4 раунда по 5 станций, работа 40 с, отдых 20 с. Пульс в зоне 3 (' + zr(3) + ')', 50,
        F.circuit.map(function (e) { return { ex: e, txt: '40 с / 20 с' }; }),
        function () {
          var steps = warmupSteps();
          steps.push(info('Круг 40/20', '4 раунда по 5 станций. 40 секунд работа, 20 секунд отдых, между раундами 2 минуты. Пульс в рабочих отрезках в зоне 3 (' + zr(3) + '), в конце раунда не выше ' + F.zones().z[2][1] + '.', 'Начать круг'));
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
    if (b === 2) { n = wi.wib === 4 ? 4 : 5 + wi.wib; secW = 60; secR = 90; zone = wi.wib === 4 ? 3 : 4; zn = zr(zone); }
    else { n = [5, 6, 6, 0][wi.wib - 1]; secW = 120; secR = 120; zone = 4; zn = zr(4); }
    if (n === 0) return mk(w + '-' + d, 'walk', 'Лёгкая прогулка', 'Подвижность и ходьба', 40, [{ ex: 'walk', txt: '35 мин' }], function () { return [timed('walk', 35 * 60, 'Спокойная прогулка.', { title: 'Лёгкая прогулка', nolog: true, skippable: true })]; });
    return mk(w + '-' + d, 'intervals', 'Тренировка C: интервалы без прыжков', n + ' × ' + (secW === 60 ? '1 мин' : '2 мин') + ' в зоне ' + zone + ' (' + zn + '), отдых ' + (secR === 90 ? '90 с' : '2 мин') + ' в зонах 1–2', 50,
      F.intervalFormats.map(function (e) { return { ex: e, txt: 'формат работы' }; }),
      function () {
        var steps = warmupSteps();
        steps.push(info('Интервалы', n + ' отрезков по ' + (secW === 60 ? '1 минуте' : '2 минуты') + ' в зоне ' + zone + ' (' + zn + ' уд/мин), между ними активный отдых. Если пульс не выходит в зону или взлетает выше ' + F.zones().z[3][1] + ', меняйте формат или темп. При головокружении, боли в груди или необычной одышке остановитесь.', 'Начать интервалы'));
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


  /* ---------- Настройка занятий: переопределения подходов, повторов и отдыха ---------- */
  F.applyOver = function (id, items) {
    var o = (S.over || {})[id]; if (!o) return items;
    var rm = o._rm || [];
    return items.filter(function (it) { return rm.indexOf(it.ex) < 0; }).map(function (it) {
      var q = o[it.ex]; if (!q) return it;
      var r = {}; for (var k in it) r[k] = it[k];
      if (q.sets) r.sets = q.sets;
      if (q.n) { if (it.sec) r.sec = [q.n, q.n]; else r.reps = [q.n, q.n]; }
      if (q.rest != null) r.rest = q.rest;
      return r;
    });
  };
  /* состав силового занятия без переопределений (для окна «Настроить») */
  F.baseItems = function (w, d) {
    var wi = F.weekInfo(w);
    if (w >= 1 && w <= 12 && (d === 0 || d === 2)) return blockItems(wi.block)[d === 0 ? 'A' : 'B'].map(function (it) { return (it.needsBands && !S.s.bands) ? it.alt : it; });
    return null;
  };

  /* ---------- Недели без привязки к календарю ---------- */
  /* занятия недели в порядке выполнения (без дня отдыха) */
  F.slots = function (w) {
    var out = [];
    for (var d = 0; d < 7; d++) { var x = F.session(w, d); if (x.kind !== 'rest') out.push({ d: d, sess: x }); }
    return out;
  };
  function isDone(id) {
    var bound = /^\d+-\d+$/.test(id);
    for (var i = S.log.length - 1; i >= 0; i--) { var l = S.log[i]; if (l.id === id && (!bound || (l.cy || 1) === (S.cycle || 1))) return l; }
    return null;
  }
  F.isDone = isDone;
  F.weekProgress = function (w) {
    var sl = F.slots(w), n = 0, req = 0;
    sl.forEach(function (x) { if (x.sess.opt) return; req++; if (isDone(x.sess.id)) n++; });
    return { done: n, total: req, slots: sl };
  };
  /* ближайшее невыполненное занятие текущей недели */
  F.nextSlot = function (w) {
    var sl = F.slots(w);
    for (var i = 0; i < sl.length; i++) if (!sl[i].sess.opt && !isDone(sl[i].sess.id)) return sl[i];
    return null;
  };
  F.programPct = function () {
    var done = 0, total = 0;
    for (var w = 0; w <= 12; w++) { var p = F.weekProgress(w); done += p.done; total += p.total; }
    return Math.round(done / total * 100);
  };

  /* ---------- Свои тренировки и быстрые подборки ---------- */
  function estMin(items, warm, cool) {
    var sec = 0;
    items.forEach(function (it) {
      var sides = it.side ? 2 : 1, work = it.sec ? it.sec[0] : it.reps[0] * 4;
      sec += it.sets * sides * (work + (it.rest || 0)) + (it.side ? it.sets * 10 : 0);
    });
    return Math.max(1, Math.round(sec / 60 + (warm ? 8 : 0) + (cool ? 5 : 0)));
  }
  F.customItems = function (c) {
    return c.items.map(function (it) {
      var o = { ex: it.ex, sets: it.sets || 3, rest: it.rest == null ? 45 : it.rest, side: !!it.side };
      if (it.sec) o.sec = [it.sec, it.sec]; else o.reps = [it.reps || 10, it.reps || 10];
      return o;
    });
  };
  F.customSession = function (c) {
    var items = F.customItems(c);
    return mk('c:' + c.id, 'custom', c.name || 'Моя тренировка', (c.warm ? 'Разминка, ' : '') + items.length + ' упражнений' + (c.cool ? ', заминка' : ''), estMin(items, c.warm, c.cool), strengthPreview(items), function () {
      var st = [];
      if (c.warm) st = st.concat(warmupSteps());
      st = st.concat(strengthSteps(items, { wib: 1, deload: false }));
      if (c.cool) st = st.concat(cooldownSteps(5));
      return st;
    });
  };
  function mobilitySteps(list) {
    var st = [];
    list.forEach(function (m) {
      if (m.side) {
        sideNames(m.ex).forEach(function (sd) {
          if (m.sec) st.push(timed(m.ex, m.sec, sd, { side: sd, nolog: true, badge: 'Подвижность', say: nm(m.ex) + ', ' + sd.toLowerCase() }));
          else st.push({ t: 'reps', ex: m.ex, title: nm(m.ex), target: m.reps, side: sd, set: 1, sets: 1, nolog: true, quick: true, badge: 'Подвижность', say: nm(m.ex) + ', ' + sd.toLowerCase() });
        });
      } else if (m.sec) st.push(timed(m.ex, m.sec, '', { nolog: true, badge: 'Подвижность' }));
      else st.push({ t: 'reps', ex: m.ex, title: nm(m.ex), target: m.reps, set: 1, sets: 1, nolog: true, quick: true, badge: 'Подвижность', say: nm(m.ex) });
    });
    return st;
  }
  var STRETCH = [{ ex: 'quadstretch', sec: 30, side: true }, { ex: 'hamstring', sec: 40, side: true }, { ex: 'glutestretch', sec: 40, side: true }, { ex: 'chest', sec: 30, side: true }, { ex: 'tricepstretch', sec: 30, side: true }, { ex: 'child', sec: 60 }];
  var CORE = [
    { ex: 'deadbug', sets: 2, reps: [10, 10], rest: 30, side: true }, { ex: 'plank', sets: 3, sec: [40, 40], rest: 30 },
    { ex: 'sideplank', sets: 2, sec: [30, 30], rest: 30, side: true }, { ex: 'revcrunch', sets: 2, reps: [12, 12], rest: 30 }, { ex: 'superman', sets: 2, reps: [10, 10], rest: 30 }
  ];
  F.QUICK = [
    { key: 'warm', title: 'Разминка 8 минут', sub: 'Марш, суставы, лёгкий круг. Перед любой тренировкой.', min: 8, ex: ['march', 'joints', 'catcow', 'pausesquat', 'glute2', 'scapular'] },
    { key: 'mob', title: 'Подвижность 10 минут', sub: 'Мягкие упражнения на суставы и растяжение, без нагрузки.', min: 10, ex: F.mobility.map(function (m) { return m.ex; }) },
    { key: 'core', title: 'Пресс и кор 10 минут', sub: 'Без прыжков и резких движений.', min: 10, ex: CORE.map(function (m) { return m.ex; }) },
    { key: 'stretch', title: 'Растяжка после тренировки', sub: 'Шесть упражнений, 8 минут.', min: 8, ex: STRETCH.map(function (m) { return m.ex; }) },
    { key: 'walk', title: 'Быстрая ходьба 30 минут', sub: 'Можно закончить раньше.', min: 30, ex: ['walk'] }
  ];
  F.quickSession = function (key) {
    var q = F.QUICK.filter(function (x) { return x.key === key; })[0]; if (!q) return null;
    var prev = q.ex.map(function (e) { return { ex: e, txt: '' }; });
    return mk('q:' + key, 'quick', q.title, q.sub, q.min, prev, function () {
      if (key === 'warm') return warmupSteps();
      if (key === 'mob') return mobilitySteps(F.mobility);
      if (key === 'stretch') return mobilitySteps(STRETCH);
      if (key === 'core') return strengthSteps(CORE, { wib: 1, deload: false });
      return [timed('walk', 1800, 'Быстрый шаг в зонах 1–2 (пульс ' + zr(1, 2) + '). Закончить раньше можно кнопкой «Дальше».', { title: 'Быстрая ходьба 30 минут', nolog: true, skippable: true, say: 'Быстрая ходьба' })];
    });
  };
  /* любое занятие по идентификатору: «неделя-слот», «c:номер», «q:ключ» */
  F.sessById = function (id) {
    if (id.indexOf('c:') === 0) { var c = S.custom.filter(function (x) { return 'c:' + x.id === id; })[0]; return c ? F.customSession(c) : null; }
    if (id.indexOf('q:') === 0) return F.quickSession(id.slice(2));
    var p = id.split('-'); return F.session(+p[0], +p[1]);
  };

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
    ok: function () { return !!window.speechSynthesis && !!F.store.get().s.voice; },
    cancel: function () { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } },
    say: function (txt, o) {
      o = o || {};
      if (!F.store.get().s.voice || !window.speechSynthesis || !txt) { if (o.onend) setTimeout(o.onend, 0); return false; }
      try {
        if (!o.queue) window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(txt); u.lang = 'ru-RU'; u.rate = o.rate || 1;
        if (o.onend) { u.onend = o.onend; u.onerror = o.onend; }
        window.speechSynthesis.speak(u);
        return true;
      } catch (e) { if (o.onend) setTimeout(o.onend, 0); return false; }
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
