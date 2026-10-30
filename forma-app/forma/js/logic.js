/* Логика: прогрессия по неделям, сборка тренировки в шаги, фразы для голоса. Не зависит от DOM. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else root.FitLogic = factory(root.FitData);
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  var EX = D.EX;

  function plural(n, f) {
    n = Math.abs(n) | 0;
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return f[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return f[1];
    return f[2];
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function pick(v, phase) {
    if (Array.isArray(v)) return v[Math.min(phase, v.length - 1)];
    return v;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtTime(s) {
    s = Math.max(0, Math.round(s));
    var m = Math.floor(s / 60);
    return pad2(m) + ':' + pad2(s % 60);
  }
  function fmtMin(sec) { return Math.max(1, Math.round(sec / 60)) + ' мин'; }

  /* ---------- Прогрессия ---------- */
  function weekInfo(week) {
    week = Math.max(1, Math.min(12, week | 0 || 1));
    var phase = Math.floor((week - 1) / 4), wk = (week - 1) % 4;
    return { week: week, phase: phase, wk: wk, deload: wk === 3,
      repBonus: [0, 1, 2, 0][wk], holdBonus: [0, 5, 10, 0][wk] };
  }

  function resolveBlock(b, wi) {
    var fixed = !!b.fixed;
    var out = { title: b.title, kind: b.kind || 'main', mode: b.mode, fixed: fixed, items: [] };
    if (b.mode === 'circuit') {
      var rounds = pick(b.rounds, wi.phase);
      if (!fixed && wi.deload && rounds > 2) rounds -= 1;
      out.rounds = rounds;
      out.restRound = pick(b.restRound, wi.phase);
      out.restItem = pick(b.restItem, wi.phase);
    }
    b.items.forEach(function (it) {
      var id = pick(it.ex, wi.phase), e = EX[id];
      var val = pick(it.val, wi.phase);
      if (!fixed) {
        if (e.type === 'reps') val += wi.repBonus;
        else if (e.hold) val += wi.holdBonus;
      }
      var item = { ex: id, val: val };
      if (b.mode === 'straight') {
        var sets = pick(it.sets, wi.phase);
        if (!fixed && wi.deload && sets > 2) sets -= 1;
        item.sets = sets;
        item.rest = pick(it.rest, wi.phase);
      }
      out.items.push(item);
    });
    return out;
  }

  function dayIdForWeek(dayId, week) {
    return (week === 12 && dayId === 'E') ? 'T' : dayId;
  }

  function resolveDay(dayId, week) {
    dayId = dayIdForWeek(dayId, week);
    var day = D.DAYS[dayId], wi = weekInfo(week);
    var blocks = [clone(D.WARMUP)];
    var main = day.blocks.map(function (b) { return resolveBlock(b, wi); });
    var warm = resolveBlock(D.WARMUP, wi);
    var cool = resolveBlock(day.cooldown === 'mobility' ? D.MOBILITY : D.COOLDOWN, wi);
    return {
      id: dayId, title: day.title, short: day.short, focus: day.focus,
      week: wi.week, phase: wi.phase, deload: wi.deload,
      blocks: [warm].concat(main, [cool])
    };
  }

  /* ---------- Сборка тренировки в шаги ---------- */
  function restVal(x, mul, fixed) {
    if (fixed) return x;
    return Math.max(0, Math.round((x * mul) / 5) * 5);
  }

  function workSegs(exId, val, meta) {
    var e = EX[exId];
    var mode = e.stopwatch ? 'stopwatch' : e.type;
    function w(side) {
      return { type: 'work', exId: exId, mode: mode, target: val, side: side || null,
        setNo: meta.setNo, setTotal: meta.setTotal, roundNo: meta.roundNo || 0, roundTotal: meta.roundTotal || 0,
        block: meta.block, blockKind: meta.blockKind, circuit: !!meta.circuit,
        itemNo: meta.itemNo, itemTotal: meta.itemTotal };
    }
    if (e.perSide) {
      return [w('right'), { type: 'rest', kind: 'switch', dur: 4 }, w('left')];
    }
    return [w(null)];
  }

  function compile(workout, opts) {
    opts = opts || {};
    var restMul = opts.restMul || 1;
    var prep = opts.prep === undefined ? 10 : opts.prep;
    var units = [];
    workout.blocks.forEach(function (b) {
      var fixed = b.fixed;
      if (b.mode === 'circuit') {
        for (var r = 1; r <= b.rounds; r++) {
          b.items.forEach(function (it, ii) {
            var last = ii === b.items.length - 1;
            units.push({
              segs: workSegs(it.ex, it.val, { setNo: r, setTotal: b.rounds, roundNo: r, roundTotal: b.rounds,
                block: b.title, blockKind: b.kind, circuit: true, itemNo: ii + 1, itemTotal: b.items.length }),
              rest: restVal(last ? b.restRound : b.restItem, restMul, fixed)
            });
          });
        }
      } else {
        b.items.forEach(function (it, ii) {
          for (var s = 1; s <= it.sets; s++) {
            units.push({
              segs: workSegs(it.ex, it.val, { setNo: s, setTotal: it.sets,
                block: b.title, blockKind: b.kind, circuit: false, itemNo: ii + 1, itemTotal: b.items.length }),
              rest: restVal(it.rest, restMul, fixed)
            });
          }
        });
      }
    });
    var segs = [];
    if (prep > 0) segs.push({ type: 'rest', kind: 'prep', dur: prep });
    units.forEach(function (u, i) {
      u.segs.forEach(function (s) { segs.push(s); });
      if (i < units.length - 1 && u.rest > 0) segs.push({ type: 'rest', kind: 'rest', dur: u.rest });
    });
    var work = 0;
    segs.forEach(function (s) { if (s.type === 'work') { s.n = ++work; } });
    return { segs: segs, workCount: work };
  }

  function segSeconds(s, tempoMul) {
    if (s.type === 'rest') return s.dur;
    var e = EX[s.exId];
    if (s.mode === 'reps') return s.target * e.tempo * (tempoMul || 1);
    if (s.mode === 'stopwatch') return 150;
    return s.target;
  }

  function estimateSeconds(workout, opts) {
    var c = compile(workout, opts), t = 0;
    c.segs.forEach(function (s) { t += segSeconds(s, opts && opts.tempoMul); });
    return t;
  }

  function countSets(workout) {
    var n = 0;
    workout.blocks.forEach(function (b) {
      if (b.mode === 'circuit') n += b.rounds * b.items.length;
      else b.items.forEach(function (it) { n += it.sets; });
    });
    return n;
  }

  function mainNames(workout) {
    var seen = {}, out = [];
    workout.blocks.forEach(function (b) {
      if (b.kind === 'warmup' || b.kind === 'cooldown') return;
      b.items.forEach(function (it) {
        if (!seen[it.ex]) { seen[it.ex] = 1; out.push(EX[it.ex].name); }
      });
    });
    return out;
  }

  /* ---------- Фразы для голоса и экрана ---------- */
  var GEN = ['', 'одного', 'двух', 'трёх', 'четырёх', 'пяти', 'шести', 'семи', 'восьми', 'девяти', 'десяти',
    'одиннадцати', 'двенадцати', 'тринадцати', 'четырнадцати', 'пятнадцати', 'шестнадцати', 'семнадцати',
    'восемнадцати', 'девятнадцати', 'двадцати'];
  function genWord(n) { return GEN[n] || String(n); }

  function timeText(s) {
    var m = Math.floor(s / 60), r = s % 60, out = [];
    if (m) out.push(m + ' ' + plural(m, ['минута', 'минуты', 'минут']));
    if (r || !m) out.push(r + ' ' + plural(r, ['секунда', 'секунды', 'секунд']));
    return out.join(' ');
  }
  function targetText(seg) {
    if (seg.mode === 'reps') return seg.target + ' ' + plural(seg.target, ['повторение', 'повторения', 'повторений']);
    if (seg.mode === 'time') return timeText(seg.target);
    return 'до отказа';
  }
  function sideText(seg) {
    return seg.side === 'right' ? 'Правая сторона.' : seg.side === 'left' ? 'Левая сторона.' : '';
  }
  function setLabel(seg) {
    if (seg.circuit) return seg.roundTotal > 1 ? 'Раунд ' + seg.roundNo + ' из ' + seg.roundTotal : '';
    return seg.setTotal > 1 ? 'Подход ' + seg.setNo + ' из ' + seg.setTotal : '';
  }
  function setSpeech(seg) {
    var n = seg.circuit ? seg.roundTotal : seg.setTotal;
    if (n <= 1) return '';
    return (seg.circuit ? 'Раунд ' : 'Подход ') + (seg.circuit ? seg.roundNo : seg.setNo) + ' из ' + genWord(n) + '.';
  }
  // Что сказать, объявляя следующее упражнение
  function announce(seg, withCue, prefix) {
    var e = EX[seg.exId], parts = [];
    if (prefix) parts.push(prefix);
    parts.push(e.name + '.');
    if (sideText(seg)) parts.push(sideText(seg));
    if (setSpeech(seg)) parts.push(setSpeech(seg));
    parts.push(targetText(seg) + '.');
    if (withCue && e.cue) parts.push(e.cue);
    return parts.join(' ');
  }

  return { plural: plural, clone: clone, pick: pick, fmtTime: fmtTime, fmtMin: fmtMin, weekInfo: weekInfo,
    resolveDay: resolveDay, dayIdForWeek: dayIdForWeek, compile: compile, segSeconds: segSeconds,
    estimateSeconds: estimateSeconds, countSets: countSets, mainNames: mainNames,
    timeText: timeText, targetText: targetText, setLabel: setLabel, sideText: sideText,
    announce: announce, genWord: genWord,
    fixedBlock: function (b) { return resolveBlock(b, weekInfo(1)); } };
});
