/* Efeitos sonoros sintetizados (WebAudio) — sem arquivos externos, funciona offline. */
(function (root) {
  'use strict';
  var ctx = null, master = null, enabled = true, lastTap = 0;

  function ensure() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type, vol, slideTo) {
    var c = ensure(); if (!c) return;
    var t = c.currentTime + start;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.5, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  var Sfx = {
    setEnabled: function (v) { enabled = !!v; },
    unlock: function () { if (enabled) ensure(); },
    coin: function () {
      if (!enabled) return;
      var now = Date.now();
      if (now - lastTap < 35) return; // evita saturar com toques múltiplos
      lastTap = now;
      var f = 1100 + Math.random() * 500;
      tone(f, 0, 0.09, 'square', 0.12);
      tone(f * 1.5, 0.045, 0.12, 'triangle', 0.18);
    },
    buy: function () {
      if (!enabled) return;
      tone(660, 0, 0.1, 'triangle', 0.3);
      tone(880, 0.07, 0.1, 'triangle', 0.3);
      tone(1320, 0.14, 0.18, 'triangle', 0.25);
    },
    big: function () {
      if (!enabled) return;
      [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, i * 0.07, 0.25, 'triangle', 0.25); });
    },
    pay: function () {
      if (!enabled) return;
      tone(1500 + Math.random() * 300, 0, 0.06, 'sine', 0.08);
    },
    error: function () {
      if (!enabled) return;
      tone(220, 0, 0.15, 'sawtooth', 0.12, 160);
    },
    alert: function () {
      if (!enabled) return;
      tone(440, 0, 0.12, 'square', 0.12);
      tone(330, 0.13, 0.18, 'square', 0.12);
    }
  };
  root.Sfx = Sfx;
})(this);
