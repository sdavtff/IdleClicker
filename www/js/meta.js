/* v2.0 — Meta-progressão: nível do império, desafios semanais, Corrida Empresarial (torneio 2),
 * histórico do patrimônio e medalhas por conquista. Estende o objeto G; não toca no DOM (roda no Node). */
(function (root) {
  'use strict';
  var isNode = typeof module !== 'undefined' && module.exports;
  var D = isNode ? require('./data.js') : root.D;
  var E = isNode ? require('./economy.js') : root.E;
  var M = isNode ? require('./market.js') : root.M;
  var F = isNode ? require('./fmt.js') : root.F;
  var G = isNode ? require('./game.js') : root.G;

  var NW_EVERY = 60;      // amostra do patrimônio a cada 60 s de jogo
  var NW_MAX = 120;       // 120 amostras = 2 h de histórico
  var nwAcc = 0;

  function income(s, now) { return E.passiveIncome(s, now, true) + E.tapValue(s, now); }
  // Prêmio em dinheiro: N minutos de renda, limitado a uma fração do patrimônio (mesma regra das missões)
  function cashReward(s, now, minutes, nwCap) {
    return Math.max(100, Math.min(income(s, now) * minutes * 60, Math.max(1000, E.netWorth(s) * nwCap)));
  }

  // ---------------- nível do império ----------------
  function checkEmpire() {
    var s = G.s, lvl = E.empireLevel(s), guard = 0;
    while (s.empire.claimed < lvl && guard++ < 200) {
      s.empire.claimed++;
      var n = D.EMPIRE_MEDALS + (s.empire.claimed % 5 === 0 ? 5 : 0);
      G.addMedals(n, 'Nível ' + s.empire.claimed + ' do império');
      G.emit('empireUp', { lvl: s.empire.claimed, medals: n });
    }
  }

  // ---------------- desafios semanais ----------------
  function statOf(s, stat) { return s.stats[stat] || 0; }
  function weeklyAvailable(s, d) {
    if (d.req === 'biz2') return E.ownedCount(s) >= 2;
    if (d.req === 'inv') return !!s.unlocks.inv;
    return true;
  }
  function weeklyTarget(s, d, now) {
    var levels = D.BUSINESSES.reduce(function (a, b) { return a + s.biz[b.id].lvl; }, 0);
    switch (d.id) {
      case 'w_earn': return G.round2(Math.max(5000, income(s, now) * 3600 * 2));
      case 'w_levels': return Math.max(50, Math.min(1000, Math.round(levels * 0.4 / 10) * 10));
      case 'w_daily': return 3;
      case 'w_fix': return 6;
      case 'w_trade': return 15;
      case 'w_goals': return 6;
      case 'w_manual': return 300;
    }
    return 1;
  }
  G.ensureWeekly = function (now) {
    var s = G.s, wk = M.weekId(now);
    if (s.weekly && wk <= s.weekly.week) return false; // relógio atrasado não gera semana nova
    var r = G.seededRng(wk * 40503 + 7);
    var pool = D.WEEKLY.filter(function (d) { return weeklyAvailable(s, d); });
    var list = [];
    while (list.length < 3 && pool.length) {
      var d = pool.splice(Math.floor(r() * pool.length), 1)[0];
      list.push({ id: d.id, target: weeklyTarget(s, d, now), base: statOf(s, d.stat), claimed: false, reward: 0 });
    }
    s.weekly = { week: wk, list: list, bonus: false };
    G.emit('weeklyNew', s.weekly);
    return true;
  };
  G.weeklyProgress = function (m) {
    var d = D.WEEKLY_BY_ID[m.id];
    var cur = Math.max(0, Math.min(m.target, statOf(G.s, d.stat) - m.base));
    return { def: d, cur: cur, target: m.target, done: cur >= m.target, frac: cur / m.target };
  };
  G.weeklyText = function (m) {
    var d = D.WEEKLY_BY_ID[m.id];
    return d.txt.replace('{n}', F.num(m.target)).replace('{m}', F.money(m.target));
  };
  G.weeklyReward = function (m) {
    var d = D.WEEKLY_BY_ID[m.id];
    return { cash: cashReward(G.s, G.now(), d.rewardMin, 0.5), medals: d.medals };
  };
  G.claimWeekly = function (i) {
    var s = G.s, m = s.weekly && s.weekly.list[i];
    if (!m || m.claimed || !G.weeklyProgress(m).done) return null;
    var rw = G.weeklyReward(m);
    m.claimed = true; m.reward = rw.cash;
    G.earnReward(rw.cash);
    G.addMedals(rw.medals, 'Desafio semanal');
    G.emit('weeklyClaim', m);
    return rw;
  };
  G.weeklyBonusReady = function () {
    var w = G.s.weekly;
    return !!w && !w.bonus && w.list.length > 0 && w.list.every(function (m) { return m.claimed; });
  };
  G.claimWeeklyBonus = function () {
    var s = G.s;
    if (!G.weeklyBonusReady()) return 0;
    s.weekly.bonus = true;
    s.stats.weeklyDone++;
    return G.addMedals(D.WEEKLY_BONUS_MEDALS, 'Semana perfeita');
  };

  // ---------------- Corrida Empresarial (torneio semanal 2, rivais simulados) ----------------
  // Pontuação = faturamento produtivo na semana (toques, negócios, salário, aluguel, dividendos; sem prêmios).
  // Rivais: base = 4 h da renda passiva do jogador no início da semana, acompanhando o crescimento.
  function raceBase(s, now) { return Math.max(5000, E.passiveIncome(s, now, true) * 3600 * 4); }
  function checkRace(now) {
    var s = G.s, wk = M.weekId(now), r = s.race;
    if (r.week === wk) { r.base = Math.max(r.base, raceBase(s, now) * 0.5); return; }
    if (r.week !== null && wk < r.week) return;
    var score = M.raceScore(s);
    if (r.week !== null && score > 0 && !r.pending) {
      var rank = M.raceRanking(s, now, true).findIndex(function (x) { return x.me; }) + 1;
      r.pending = { rank: rank, week: r.week, score: score };
      if (!r.best || rank < r.best) r.best = rank;
      if (rank === 1) s.stats.racesWon++;
      G.emit('raceEnd', r.pending);
    }
    r.week = wk;
    r.start = s.stats.prodEarned;
    r.base = raceBase(s, now);
  }
  G.checkRace = checkRace;
  G.claimRaceReward = function () {
    var s = G.s, p = s.race.pending, now = G.now();
    if (!p) return null;
    var rw = M.rewardFor(p.rank);
    var cash = cashReward(s, now, rw.min, 0.5);
    G.earnReward(cash);
    G.addMedals(rw.medals, 'Corrida Empresarial');
    s.race.pending = null;
    return { cash: cash, medals: rw.medals, label: rw.label, rank: p.rank };
  };

  // ---------------- histórico do patrimônio ----------------
  function sampleNetWorth(now, force) {
    var s = G.s;
    if (!force && nwAcc < NW_EVERY) return;
    nwAcc = 0;
    var v = E.netWorth(s);
    if (!isFinite(v)) return;
    s.nwHist.push({ t: now, v: v });
    if (s.nwHist.length > NW_MAX) s.nwHist.splice(0, s.nwHist.length - NW_MAX);
  }
  G.sampleNetWorth = function (now) { sampleNetWorth(now || G.now(), true); };

  // ---------------- laço lento (chamado por G.tick 4x/s) ----------------
  G.metaTick = function (now, dt) {
    nwAcc += dt;
    checkEmpire();
    G.ensureWeekly(now);
    checkRace(now);
    sampleNetWorth(now, false);
  };

  // conquistas e Legado também rendem medalhas
  G.on('ach', function () { G.addMedals(1, 'Conquista'); });

  if (isNode) module.exports = G;
})(this);
