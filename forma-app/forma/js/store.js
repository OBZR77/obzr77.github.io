/* Хранилище: настройки, история, вес, тесты, свои тренировки (localStorage) */
var FitStore = (function () {
  'use strict';
  var PREFIX = 'fit.v1.';
  var mem = {};

  function get(k, def) {
    try {
      var v = localStorage.getItem(PREFIX + k);
      if (v !== null) return JSON.parse(v);
    } catch (e) { /* storage недоступен — работаем из памяти */ }
    return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : def;
  }
  function set(k, v) {
    mem[k] = v;
    try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }

  /* ---------- даты ---------- */
  function iso(d) {
    var m = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
  }
  function parseISO(s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
  function mondayOf(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  }
  function todayISO() { return iso(new Date()); }

  /* ---------- настройки ---------- */
  var DEFAULTS = {
    voice: true, cues: true, voiceRate: 1, voiceURI: '', repMode: 'auto', tempoMul: 1,
    beeps: true, vibrate: true, prep: 10, restMul: 1, defaultRest: 60, wakeLock: true,
    startMonday: '', baseline: { situps: 50, pushups: 80, plank: 180 },
    startWeight: 82, goalMin: 78, goalMax: 80
  };
  function settings() {
    var s = get('settings', {}) || {};
    var out = {};
    for (var k in DEFAULTS) out[k] = DEFAULTS[k];
    for (var k2 in s) out[k2] = s[k2];
    out.baseline = {};
    for (var b in DEFAULTS.baseline) out.baseline[b] = (s.baseline && s.baseline[b] !== undefined) ? s.baseline[b] : DEFAULTS.baseline[b];
    if (!out.startMonday) {
      out.startMonday = iso(mondayOf(new Date()));
      set('settings', out);
    }
    return out;
  }
  function saveSettings(s) { set('settings', s); }

  function currentWeek(s) {
    var diff = Math.round((mondayOf(new Date()) - parseISO(s.startMonday)) / (7 * 86400000));
    return { raw: diff + 1, week: Math.max(1, Math.min(12, diff + 1)), finished: diff + 1 > 12 };
  }
  function setWeek(s, week) {
    var m = mondayOf(new Date());
    m.setDate(m.getDate() - (week - 1) * 7);
    s.startMonday = iso(m);
    saveSettings(s);
  }

  /* ---------- коллекции ---------- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function history() { return get('history', []); }
  function addHistory(e) { var h = history(); e.id = uid(); h.push(e); set('history', h); return e; }
  function removeHistory(id) { set('history', history().filter(function (x) { return x.id !== id; })); }

  function weights() { return get('weights', []).slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }); }
  function addWeight(date, kg) {
    var w = get('weights', []).filter(function (x) { return x.date !== date; });
    w.push({ date: date, kg: kg });
    set('weights', w);
  }
  function removeWeight(date) { set('weights', get('weights', []).filter(function (x) { return x.date !== date; })); }

  function tests() { return get('tests', []); }
  function addTest(key, value, date) {
    var t = tests();
    t.push({ id: uid(), date: date || todayISO(), key: key, value: value });
    set('tests', t);
  }
  function removeTest(id) { set('tests', tests().filter(function (x) { return x.id !== id; })); }

  function customs() { return get('custom', []); }
  function saveCustom(w) {
    var list = customs();
    if (!w.id) { w.id = uid(); list.push(w); }
    else {
      var found = false;
      for (var i = 0; i < list.length; i++) if (list[i].id === w.id) { list[i] = w; found = true; }
      if (!found) list.push(w);
    }
    set('custom', list);
    return w;
  }
  function removeCustom(id) { set('custom', customs().filter(function (x) { return x.id !== id; })); }

  /* ---------- резервная копия ---------- */
  function exportAll() {
    return JSON.stringify({
      app: 'forma', version: 1, exported: new Date().toISOString(),
      settings: get('settings', {}), history: history(), weights: get('weights', []),
      tests: tests(), custom: customs()
    }, null, 2);
  }
  function importAll(text) {
    var d = JSON.parse(text);
    if (!d || d.app !== 'forma') throw new Error('Это не файл резервной копии приложения');
    set('settings', d.settings || {});
    set('history', d.history || []);
    set('weights', d.weights || []);
    set('tests', d.tests || []);
    set('custom', d.custom || []);
  }
  function resetAll() {
    ['settings', 'history', 'weights', 'tests', 'custom'].forEach(function (k) {
      delete mem[k];
      try { localStorage.removeItem(PREFIX + k); } catch (e) { /* ignore */ }
    });
  }

  return { iso: iso, parseISO: parseISO, mondayOf: mondayOf, todayISO: todayISO, uid: uid,
    settings: settings, saveSettings: saveSettings, currentWeek: currentWeek, setWeek: setWeek,
    history: history, addHistory: addHistory, removeHistory: removeHistory,
    weights: weights, addWeight: addWeight, removeWeight: removeWeight,
    tests: tests, addTest: addTest, removeTest: removeTest,
    customs: customs, saveCustom: saveCustom, removeCustom: removeCustom,
    exportAll: exportAll, importAll: importAll, resetAll: resetAll, DEFAULTS: DEFAULTS };
})();
