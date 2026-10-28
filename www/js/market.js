/* Bolsa (ações + cripto) e torneio semanal da bolsa. */
(function (root) {
  'use strict';
  var D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.D;
  var M = {};

  M.ASSETS = D.STOCKS.map(function (a) { return Object.assign({ type: 'stock' }, a); })
    .concat(D.CRYPTOS.map(function (a) { return Object.assign({ type: 'crypto' }, a); }));
  var BY_ID = {}; M.ASSETS.forEach(function (a) { BY_ID[a.id] = a; });
  M.BY_ID = BY_ID;

  M.HIST_LEN = 120;     // pontos no gráfico
  M.HIST_EVERY = 3;     // um ponto a cada 3 passos (3 s)

  function gauss(rng) {
    var u = 1 - rng(), v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  M.init = function (s) {
    M.ASSETS.forEach(function (a) {
      if (!s.mkt[a.id]) s.mkt[a.id] = { p: a.p, anchor: a.p, x: 0, hist: [a.p], n: 0 };
    });
  };

  // Um passo (1 s de jogo). Preço = âncora * e^x ; x reverte à média, âncora passeia lentamente.
  M.step = function (s, rng) {
    M.ASSETS.forEach(function (a) {
      var m = s.mkt[a.id];
      m.anchor *= Math.exp(a.drift + a.vol * 0.12 * gauss(rng));
      // mantém a âncora numa faixa razoável em relação ao preço inicial
      if (m.anchor < a.p * 0.15) m.anchor *= 1.002;
      if (m.anchor > a.p * 25) m.anchor *= 0.998;
      m.x = m.x * 0.985 + a.vol * gauss(rng);
      m.p = Math.max(a.p * 0.001, m.anchor * Math.exp(m.x));
      m.n = (m.n || 0) + 1;
      if (m.n % M.HIST_EVERY === 0) {
        m.hist.push(m.p);
        if (m.hist.length > M.HIST_LEN) m.hist.shift();
      }
    });
  };

  // Notícia: choque de preço num ativo aleatório.
  M.news = function (s, rng) {
    var a = M.ASSETS[Math.floor(rng() * M.ASSETS.length)];
    var up = rng() < 0.5;
    var size = (a.type === 'crypto' ? 0.25 + rng() * 0.25 : 0.08 + rng() * 0.1);
    s.mkt[a.id].x += up ? size : -size;
    var list = up ? D.NEWS.up : D.NEWS.down;
    var txt = list[Math.floor(rng() * list.length)].replace('{n}', a.name);
    return { id: a.id, up: up, txt: txt };
  };

  M.change = function (s, id) {
    var m = s.mkt[id];
    var ref = m.hist[0] || m.p;
    return m.p / ref - 1;
  };

  // ---------- Torneio semanal ----------
  // Semanas começam segunda-feira 00:00 (horário de Brasília, UTC-3).
  var WEEK = 7 * 86400;
  var OFFSET = 4 * 86400 + 3 * 3600; // 01/01/1970 foi quinta-feira
  M.weekId = function (now) { return Math.floor((now / 1000 - OFFSET) / WEEK); };
  M.weekEnd = function (id) { return ((id + 1) * WEEK + OFFSET) * 1000; };
  M.weekStart = function (id) { return (id * WEEK + OFFSET) * 1000; };

  function seeded(seed) {
    var x = seed >>> 0 || 1;
    return function () {
      x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
      return (x % 1e9) / 1e9;
    };
  }

  // Rivais simulados (offline): pontuação cresce ao longo da semana proporcional ao patrimônio do jogador no início.
  M.bots = function (s, now, final) {
    var w = s.tour.week;
    var r = seeded(w * 7919 + 17);
    var start = M.weekStart(w), end = M.weekEnd(w);
    var prog = final ? 1 : Math.min(1, Math.max(0, (now - start) / (end - start)));
    return D.TOUR_BOTS.map(function (name) {
      var skill = 0.15 + r() * 1.6;
      var shape = 0.6 + r() * 0.8;
      return { name: name, score: Math.floor(s.tour.base * skill * Math.pow(prog, shape)), bot: true };
    });
  };

  M.ranking = function (s, now, final) {
    var list = M.bots(s, now, final);
    list.push({ name: 'Você', score: Math.floor(s.tour.score), me: true });
    list.sort(function (a, b) { return b.score - a.score; });
    return list;
  };

  M.rewardFor = function (rank) {
    if (rank === 1) return { min: 30, boostH: 2, label: '🥇 Campeão' };
    if (rank <= 3) return { min: 20, boostH: 1, label: '🥈 Pódio' };
    if (rank <= 5) return { min: 10, boostH: 0.5, label: '🏅 Top 5' };
    return { min: 3, boostH: 0, label: '🎗️ Participação' };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = M;
  else root.M = M;
})(this);
