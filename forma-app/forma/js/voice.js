/* Голос (синтез речи браузера), звуковые сигналы, вибрация */
var FitVoice = (function () {
  'use strict';
  var synth = window.speechSynthesis || null;
  var voices = [];
  var cfg = { enabled: true, rate: 1, voiceURI: '', beeps: true, vibrate: true };
  var actx = null;
  var seq = 0;

  function loadVoices() { if (synth) { try { voices = synth.getVoices() || []; } catch (e) { voices = []; } } }
  if (synth) {
    loadVoices();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', loadVoices);
    else synth.onvoiceschanged = loadVoices;
  }

  function ruVoices() {
    loadVoices();
    return voices.filter(function (v) { return /^ru/i.test(v.lang); });
  }
  function pickVoice() {
    var ru = ruVoices();
    if (cfg.voiceURI) {
      for (var i = 0; i < ru.length; i++) if (ru[i].voiceURI === cfg.voiceURI) return ru[i];
    }
    for (var j = 0; j < ru.length; j++) if (ru[j].default) return ru[j];
    return ru.length ? ru[0] : null;
  }
  function configure(o) { for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) cfg[k] = o[k]; }
  function supported() { return !!synth; }

  // Вызывать из обработчика нажатия: браузеры разрешают звук только после жеста пользователя
  function unlock() {
    try {
      if (!actx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) actx = new AC();
      }
      if (actx && actx.state === 'suspended') actx.resume();
    } catch (e) { /* без звуковых сигналов */ }
  }

  function say(text, o) {
    if (!cfg.enabled || !synth || !text) return;
    o = o || {};
    try {
      var flush = o.flush !== false;
      var my = ++seq;
      if (flush) synth.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'ru-RU';
      var v = pickVoice();
      if (v) u.voice = v;
      u.rate = Math.max(0.5, Math.min(2, cfg.rate * (o.rate || 1)));
      u.pitch = 1;
      u.volume = 1;
      if (o.onend) { u.onend = o.onend; u.onerror = o.onend; }
      // Небольшая задержка после cancel(): иначе Chrome может проглотить новую реплику
      setTimeout(function () {
        if (flush && my !== seq) return;
        try { synth.speak(u); } catch (e) { /* ignore */ }
      }, 40);
    } catch (e) { /* ignore */ }
  }
  function stop() { seq++; if (synth) { try { synth.cancel(); } catch (e) { /* ignore */ } } }

  function beep(freq, dur, vol) {
    if (!cfg.beeps || !actx) return;
    try {
      var o = actx.createOscillator(), g = actx.createGain();
      var d = dur || 0.12, t = actx.currentTime;
      o.type = 'sine';
      o.frequency.value = freq || 880;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.3, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(actx.destination);
      o.start(t); o.stop(t + d + 0.03);
    } catch (e) { /* ignore */ }
  }
  function vibrate(p) {
    if (cfg.vibrate && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* ignore */ } }
  }
  var cue = {
    tick: function () { beep(880, 0.09, 0.3); },
    go: function () { beep(1320, 0.28, 0.35); vibrate(80); },
    done: function () { beep(660, 0.14, 0.3); setTimeout(function () { beep(990, 0.22, 0.3); }, 150); vibrate([60, 60, 60]); },
    count: function () { beep(740, 0.05, 0.18); }
  };

  return { configure: configure, say: say, stop: stop, beep: beep, vibrate: vibrate, cue: cue, unlock: unlock,
    ruVoices: ruVoices, supported: supported };
})();
