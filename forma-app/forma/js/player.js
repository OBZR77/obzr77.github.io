/* Плеер тренировки: таймеры, автосчёт повторений, голосовое сопровождение */
var FitPlayer = (function () {
  'use strict';
  var L = FitLogic, D = FitData, V = FitVoice;
  var S = null, timer = null, wake = null, els = {};
  var RING_C = 2 * Math.PI * 90;

  var ICON = {
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5l11 7L4 19z"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>',
    on: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
    off: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>'
  };

  function $(id) { return document.getElementById(id); }

  function init() {
    ['player', 'pExit', 'pBar', 'pElapsed', 'pVoice', 'pBlock', 'pKind', 'pName', 'pSet', 'pRing', 'pBig', 'pUnit',
      'pCue', 'pNext', 'pDone', 'pPrev', 'pPause', 'pPlus', 'pSkip', 'pMode', 'pOverlay'].forEach(function (id) { els[id] = $(id); });
    els.pExit.innerHTML = ICON.close;
    els.pPrev.innerHTML = ICON.prev;
    els.pSkip.innerHTML = ICON.next;
    els.pRing.style.strokeDasharray = RING_C;
    els.pDone.addEventListener('click', onDone);
    els.pPrev.addEventListener('click', back);
    els.pSkip.addEventListener('click', skip);
    els.pPause.addEventListener('click', togglePause);
    els.pPlus.addEventListener('click', function () { addRest(15); });
    els.pExit.addEventListener('click', requestExit);
    els.pVoice.addEventListener('click', toggleVoice);
    els.pMode.addEventListener('click', toggleMode);
    document.addEventListener('visibilitychange', function () {
      if (S && document.visibilityState === 'visible') requestWake();
    });
  }

  /* ---------- запуск и завершение ---------- */
  function start(workout, opts, cb) {
    var c = L.compile(workout, { restMul: opts.restMul, prep: opts.prep });
    S = {
      workout: workout, opts: opts, cb: cb || {}, segs: c.segs, workCount: c.workCount,
      idx: -1, startedAt: Date.now(), pausedTotal: 0, pausedAt: 0, paused: false, modal: false,
      seen: {}, doneSets: 0, repMode: opts.repMode, voice: opts.voice, lastRc: -1, flags: {}
    };
    V.configure({ enabled: opts.voice, rate: opts.voiceRate, voiceURI: opts.voiceURI, beeps: opts.beeps, vibrate: opts.vibrate });
    V.unlock();
    els.pOverlay.hidden = true;
    els.player.hidden = false;
    document.body.classList.add('no-scroll');
    requestWake();
    enter(0);
    clearInterval(timer);
    timer = setInterval(tick, 100);
  }

  function requestWake() {
    if (!S || !S.opts.wakeLock || !navigator.wakeLock) return;
    try {
      navigator.wakeLock.request('screen').then(function (l) { wake = l; }, function () { /* без блокировки экрана */ });
    } catch (e) { /* ignore */ }
  }
  function releaseWake() {
    try { if (wake) wake.release(); } catch (e) { /* ignore */ }
    wake = null;
  }

  function close() {
    clearInterval(timer); timer = null;
    V.stop();
    releaseWake();
    els.player.hidden = true;
    els.pOverlay.hidden = true;
    document.body.classList.remove('no-scroll');
    var cb = S && S.cb;
    S = null;
    if (cb && cb.onClose) cb.onClose();
  }

  function elapsedSec() {
    if (!S) return 0;
    var now = S.paused ? S.pausedAt : Date.now();
    return Math.max(0, (now - S.startedAt - S.pausedTotal) / 1000);
  }

  function finish() {
    clearInterval(timer); timer = null;
    V.stop();
    V.cue.done();
    var secs = Math.round(elapsedSec());
    V.say('Тренировка завершена. Отличная работа!');
    S.modal = true;
    var mins = Math.max(1, Math.round(secs / 60));
    els.pOverlay.hidden = false;
    els.pOverlay.innerHTML =
      '<div class="ov-card"><h2>Готово!</h2>' +
      '<p class="ov-sub">' + mins + ' мин · подходов: ' + S.doneSets + '</p>' +
      '<p class="ov-q">Как вы себя чувствуете после тренировки?</p>' +
      '<div class="ov-rpe">' +
      '<button data-rpe="1">Легко</button><button data-rpe="2">Нормально</button>' +
      '<button data-rpe="3">Тяжело</button><button data-rpe="4">Очень тяжело</button></div>' +
      '<button class="ghost" data-rpe="0">Пропустить</button></div>';
    Array.prototype.forEach.call(els.pOverlay.querySelectorAll('[data-rpe]'), function (b) {
      b.addEventListener('click', function () {
        var rpe = +b.getAttribute('data-rpe');
        var sum = { seconds: secs, sets: S.doneSets, rpe: rpe || null };
        var cb = S.cb;
        if (cb && cb.onFinish) cb.onFinish(sum);
        close();
      });
    });
  }

  function requestExit() {
    if (!S || S.modal) return;
    var wasPaused = S.paused;
    if (!wasPaused) pause();
    var worked = elapsedSec() >= 180;
    els.pOverlay.hidden = false;
    S.modal = true;
    els.pOverlay.innerHTML =
      '<div class="ov-card"><h2>Завершить тренировку?</h2>' +
      '<button class="primary" data-x="stay">Продолжить</button>' +
      (worked ? '<button data-x="save">Завершить и сохранить</button>' : '') +
      '<button class="ghost danger" data-x="quit">Выйти без сохранения</button></div>';
    Array.prototype.forEach.call(els.pOverlay.querySelectorAll('[data-x]'), function (b) {
      b.addEventListener('click', function () {
        var x = b.getAttribute('data-x');
        els.pOverlay.hidden = true;
        S.modal = false;
        if (x === 'stay') { if (!wasPaused) resume(); }
        else if (x === 'save') {
          var secs = Math.round(elapsedSec()), sets = S.doneSets, cb = S.cb;
          if (cb && cb.onFinish) cb.onFinish({ seconds: secs, sets: sets, rpe: null, partial: true });
          close();
        } else close();
      });
    });
  }

  function askResult(ex, defVal, done) {
    S.modal = true;
    V.stop();
    V.cue.done();
    V.say('Введите результат');
    els.pOverlay.hidden = false;
    els.pOverlay.innerHTML =
      '<div class="ov-card"><h2>' + ex.name + '</h2>' +
      '<p class="ov-q">Результат (' + ex.test.unit + ')</p>' +
      '<input id="pRes" type="number" inputmode="numeric" min="0" value="' + (defVal || '') + '">' +
      '<button class="primary" id="pResOk">Сохранить</button>' +
      '<button class="ghost" id="pResSkip">Не сохранять</button></div>';
    var inp = $('pRes');
    setTimeout(function () { inp.focus(); inp.select(); }, 50);
    function fin(save) {
      var v = Math.round(+inp.value);
      els.pOverlay.hidden = true;
      S.modal = false;
      done(save && v > 0 ? v : 0);
    }
    $('pResOk').addEventListener('click', function () { fin(true); });
    $('pResSkip').addEventListener('click', function () { fin(false); });
  }

  /* ---------- шаги ---------- */
  function nextWork(i) {
    for (var j = i + 1; j < S.segs.length; j++) if (S.segs[j].type === 'work') return S.segs[j];
    return null;
  }
  function prevWorkIdx(i) {
    for (var j = i - 1; j >= 0; j--) if (S.segs[j].type === 'work') return j;
    return -1;
  }

  function enter(i) {
    if (i >= S.segs.length) { finish(); return; }
    S.idx = i;
    var seg = S.segs[i], now = Date.now();
    S.t0 = now; S.flags = {}; S.lastRc = -1; S.repCount = 0; S.finishAt = 0;
    if (seg.type === 'rest') {
      S.endAt = now + seg.dur * 1000;
      S.restTotal = seg.dur;
      var nxt = nextWork(i);
      if (seg.kind === 'prep') {
        V.say('Приготовьтесь. ' + (nxt ? L.announce(nxt, S.opts.cues, 'Первое упражнение:') : ''));
      } else if (seg.kind === 'switch') {
        V.say('Смена стороны.', { rate: 1.1 });
      } else if (nxt) {
        var first = !S.seen[nxt.exId];
        if (seg.dur >= 15) V.say('Отдых ' + L.timeText(seg.dur) + '. ' + L.announce(nxt, S.opts.cues && first && seg.dur >= 20, 'Дальше:'));
        else V.say(L.announce(nxt, false, 'Дальше:'));
      }
    } else {
      var ex = D.EX[seg.exId];
      S.seen[seg.exId] = true;
      S.segStart = now;
      if (seg.mode === 'time') S.endAt = now + seg.target * 1000;
      if (seg.mode === 'reps') {
        S.tempo = Math.max(0.8, ex.tempo * (S.opts.tempoMul || 1)) * 1000;
        S.nextRepAt = now + 1100 + S.tempo;
      }
      V.cue.go();
      V.say(seg.mode === 'stopwatch' ? 'Начали! Остановите секундомер, когда закончите.' : 'Начали!', { rate: 1.1 });
    }
    render();
  }

  function advance() { enter(S.idx + 1); }

  function completeWork() {
    var seg = S.segs[S.idx], ex = D.EX[seg.exId];
    if (seg.side !== 'left') S.doneSets++;
    if (ex.test) {
      var val = seg.mode === 'stopwatch' ? Math.round((Date.now() - S.segStart) / 1000) : 0;
      askResult(ex, val, function (v) {
        if (v > 0) FitStore.addTest(ex.test.key, v);
        advance();
      });
      return;
    }
    V.cue.done();
    advance();
  }

  function onDone() {
    if (!S || S.modal) return;
    var seg = S.segs[S.idx];
    if (seg.type === 'rest') advance();
    else completeWork();
  }
  function skip() {
    if (!S || S.modal) return;
    var seg = S.segs[S.idx];
    advance();
  }
  function back() {
    if (!S || S.modal) return;
    var seg = S.segs[S.idx];
    if (seg.type === 'work' && Date.now() - S.t0 > 3000) { enter(S.idx); return; }
    var j = prevWorkIdx(S.idx);
    if (j >= 0) enter(j);
    else enter(S.idx);
  }
  function addRest(sec) {
    if (!S || S.modal) return;
    var seg = S.segs[S.idx];
    if (seg.type !== 'rest') return;
    S.endAt += sec * 1000;
    S.restTotal += sec;
    S.lastRc = -1;
    V.say('Плюс ' + sec + ' секунд', { rate: 1.1 });
  }

  function pause() {
    if (!S || S.paused) return;
    S.paused = true; S.pausedAt = Date.now();
    V.stop();
    render();
  }
  function resume() {
    if (!S || !S.paused) return;
    var d = Date.now() - S.pausedAt;
    S.paused = false;
    S.pausedTotal += d;
    S.t0 += d; S.segStart += d;
    if (S.endAt) S.endAt += d;
    if (S.nextRepAt) S.nextRepAt += d;
    if (S.finishAt) S.finishAt += d;
    requestWake();
    render();
  }
  function togglePause() {
    if (!S || S.modal) return;
    if (S.paused) resume(); else pause();
  }
  function toggleVoice() {
    if (!S) return;
    S.voice = !S.voice;
    V.configure({ enabled: S.voice });
    if (!S.voice) V.stop();
    render();
  }
  function toggleMode() {
    if (!S) return;
    S.repMode = S.repMode === 'auto' ? 'manual' : 'auto';
    var seg = S.segs[S.idx];
    if (seg.type === 'work' && seg.mode === 'reps') {
      S.repCount = 0; S.finishAt = 0;
      S.nextRepAt = Date.now() + 800 + S.tempo;
    }
    render();
  }

  /* ---------- такт ---------- */
  function tick() {
    if (!S || S.paused || S.modal) return;
    var seg = S.segs[S.idx], now = Date.now();
    if (seg.type === 'rest') {
      var rem = (S.endAt - now) / 1000, rc = Math.ceil(rem);
      if (rc !== S.lastRc) {
        S.lastRc = rc;
        if (seg.kind !== 'switch') {
          if (rc > 0 && rc <= 3) V.cue.tick();
          if (rc === 10 && S.restTotal >= 20) V.say('Десять секунд', { rate: 1.1 });
        }
      }
      if (rem <= 0) { advance(); return; }
    } else if (seg.mode === 'time') {
      var left = (S.endAt - now) / 1000, lc = Math.ceil(left);
      if (lc !== S.lastRc) {
        S.lastRc = lc;
        var half = Math.round(seg.target / 2);
        if (lc > 0 && lc <= 3) V.cue.tick();
        else if (lc === 10 && seg.target > 25) V.say('Десять секунд', { rate: 1.1 });
        else if (lc === half && seg.target >= 40 && half > 12) V.say('Половина', { rate: 1.1 });
      }
      if (left <= 0) { completeWork(); return; }
    } else if (seg.mode === 'stopwatch') {
      var el = Math.floor((now - S.segStart) / 1000);
      if (el !== S.lastRc) {
        S.lastRc = el;
        if (el > 0 && el % 30 === 0) V.say(L.timeText(el), { rate: 1.1 });
      }
    } else if (seg.mode === 'reps') {
      if (S.repMode === 'auto' && !S.finishAt && S.repCount < seg.target && now >= S.nextRepAt) {
        S.repCount++;
        S.nextRepAt += S.tempo;
        var n = S.repCount, total = seg.target;
        if (S.voice && (S.tempo >= 1500 || n % 5 === 0 || total - n <= 2)) V.say(String(n), { rate: 1.2 });
        else V.cue.count();
        if (n >= total) S.finishAt = now + 900;
      }
      if (S.finishAt && now >= S.finishAt) { completeWork(); return; }
    }
    renderTick();
  }

  /* ---------- отображение ---------- */
  function setText(el, t) { if (el.textContent !== t) el.textContent = t; }

  function render() {
    if (!S) return;
    var seg = S.segs[S.idx], isRest = seg.type === 'rest', nxt = nextWork(S.idx);
    els.player.className = 'player ' + (isRest ? 'is-rest' : 'is-work') + (S.paused ? ' paused' : '');
    els.pPause.innerHTML = S.paused ? ICON.play : ICON.pause;
    els.pVoice.innerHTML = S.voice ? ICON.on : ICON.off;
    els.pPlus.hidden = !(isRest && seg.kind === 'rest');
    els.pMode.hidden = isRest || seg.mode !== 'reps';
    els.pMode.textContent = S.repMode === 'auto' ? 'Автосчёт голосом: вкл' : 'Автосчёт голосом: выкл';
    if (isRest) {
      var e = nxt ? D.EX[nxt.exId] : null;
      setText(els.pKind, seg.kind === 'prep' ? 'Приготовьтесь' : seg.kind === 'switch' ? 'Смена стороны' : 'Отдых');
      setText(els.pBlock, nxt ? nxt.block : '');
      setText(els.pName, e ? 'Дальше: ' + e.name : '');
      setText(els.pSet, nxt ? [L.sideText(nxt).replace('.', ''), L.setLabel(nxt), L.targetText(nxt)].filter(Boolean).join(' · ') : '');
      setText(els.pCue, e ? e.cue : '');
      setText(els.pNext, '');
      setText(els.pUnit, 'сек');
      setText(els.pDone, seg.kind === 'prep' ? 'Начать сейчас' : 'Пропустить отдых');
    } else {
      var ex = D.EX[seg.exId];
      var kind = seg.circuit && seg.itemTotal > 1 ? 'Упражнение ' + seg.itemNo + ' из ' + seg.itemTotal : 'Упражнение';
      setText(els.pKind, seg.blockKind === 'warmup' ? 'Разминка' : seg.blockKind === 'cooldown' ? 'Заминка' : kind);
      setText(els.pBlock, seg.block);
      setText(els.pName, ex.name);
      setText(els.pSet, [L.sideText(seg).replace('.', ''), L.setLabel(seg)].filter(Boolean).join(' · '));
      setText(els.pCue, ex.cue);
      var nx = S.segs[S.idx + 1], nw = nextWork(S.idx);
      if (nw) {
        var rs = nx && nx.type === 'rest' && nx.kind !== 'switch' ? 'отдых ' + nx.dur + ' с, затем ' : '';
        setText(els.pNext, 'Дальше: ' + rs + D.EX[nw.exId].name);
      } else setText(els.pNext, 'Это последнее упражнение');
      setText(els.pDone, 'Готово');
      setText(els.pUnit, seg.mode === 'time' ? 'осталось' : seg.mode === 'stopwatch' ? 'секундомер'
        : (S.repMode === 'auto' ? 'из ' + seg.target : plural(seg.target)));
    }
    renderTick();
  }
  function plural(n) { return L.plural(n, ['повторение', 'повторения', 'повторений']); }

  function renderTick() {
    if (!S) return;
    var seg = S.segs[S.idx], now = S.paused ? S.pausedAt : Date.now(), frac = 1;
    if (seg.type === 'rest') {
      var rem = Math.max(0, (S.endAt - now) / 1000);
      setText(els.pBig, String(Math.ceil(rem)));
      frac = S.restTotal ? rem / S.restTotal : 0;
    } else if (seg.mode === 'time') {
      var left = Math.max(0, (S.endAt - now) / 1000);
      setText(els.pBig, left >= 60 ? L.fmtTime(Math.ceil(left)) : String(Math.ceil(left)));
      frac = seg.target ? left / seg.target : 0;
    } else if (seg.mode === 'stopwatch') {
      setText(els.pBig, L.fmtTime((now - S.segStart) / 1000));
      frac = (((now - S.segStart) / 1000) % 60) / 60;
    } else {
      if (S.repMode === 'auto') { setText(els.pBig, String(S.repCount)); frac = seg.target ? 1 - S.repCount / seg.target : 0; }
      else { setText(els.pBig, String(seg.target)); frac = 1; }
    }
    els.pRing.style.strokeDashoffset = RING_C * (1 - Math.max(0, Math.min(1, frac)));
    setText(els.pElapsed, L.fmtTime(elapsedSec()));
    els.pBar.style.width = Math.min(100, (S.idx / S.segs.length) * 100) + '%';
  }

  return { init: init, start: start, requestExit: requestExit, active: function () { return !!S; },
    isModal: function () { return !!(S && S.modal); } };
})();
