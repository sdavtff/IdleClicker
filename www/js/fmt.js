/* Formatação de números grandes (K, M, B, T...) e tempo — padrão PT-BR (vírgula decimal). */
(function (root) {
  'use strict';
  var SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

  function suffix(tier) {
    if (tier < SUF.length) return SUF[tier];
    var k = tier - SUF.length; // depois de Dc: aa, ab, ac...
    return String.fromCharCode(97 + (Math.floor(k / 26) % 26)) + String.fromCharCode(97 + (k % 26));
  }

  function num(n, small) {
    if (n === undefined || n === null || isNaN(n)) return '0';
    if (!isFinite(n)) return '∞';
    var neg = n < 0;
    n = Math.abs(n);
    var s;
    if (n < 1000) {
      if (small && n < 100 && n % 1 !== 0) s = n.toFixed(n < 10 ? 2 : 1);
      else s = String(Math.floor(n));
    } else {
      var tier = Math.floor(Math.log10(n) / 3);
      var v = n / Math.pow(1000, tier);
      if (v >= 999.995) { tier++; v = v / 1000; }
      s = (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : v.toFixed(0)) + ' ' + suffix(tier);
    }
    return (neg ? '-' : '') + s.replace('.', ',');
  }

  function money(n, small) {
    return (n < 0 ? '-$' : '$') + num(Math.abs(n), small);
  }

  function time(sec) {
    sec = Math.max(0, Math.floor(sec));
    var d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600),
        m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
    if (m > 0) return m + 'm ' + (s < 10 ? '0' : '') + s + 's';
    return s + 's';
  }

  function pct(x, digits) {
    var v = (x * 100).toFixed(digits === undefined ? 1 : digits).replace('.', ',');
    return (x > 0 ? '+' : '') + v + '%';
  }

  var F = { num: num, money: money, time: time, pct: pct };
  if (typeof module !== 'undefined' && module.exports) module.exports = F;
  else root.F = F;
})(this);
