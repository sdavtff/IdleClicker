/* Estado e regras do jogo: ações do jogador, laço de simulação, eventos, metas, conquistas, missões diárias,
 * offline, prestígio e save. Não toca no DOM — roda também no Node (simulador e testes). */
(function (root) {
  'use strict';
  var isNode = typeof module !== 'undefined' && module.exports;
  var D = isNode ? require('./data.js') : root.D;
  var E = isNode ? require('./economy.js') : root.E;
  var M = isNode ? require('./market.js') : root.M;
  var S = isNode ? require('./save.js') : root.SaveIO;
  var F = isNode ? require('./fmt.js') : root.F;

  var G = { s: null, rng: Math.random, now: function () { return Date.now(); }, storage: null };
  var listeners = {};
  G.on = function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); };
  function emit(ev, data) {
    (listeners[ev] || []).forEach(function (fn) {
      try { fn(data); } catch (e) { if (typeof console !== 'undefined') console.error(e); }
    });
  }
  G.emit = emit;

  G.KEYS = {
    main: D.SAVE_KEY,
    auto: D.SAVE_KEY + '_auto',        // último save bom (rotativo, a cada 5 min)
    pre: D.SAVE_KEY + '_preimport',    // estado anterior a uma importação/restauração
    bad: D.SAVE_KEY + '_corrupt'       // cópia intacta de um save que não pôde ser lido
  };
  var BACKUP_EVERY_MS = 5 * 60000;

  G.newState = function () {
    var now = G.now();
    var s = {
      v: D.SAVE_VERSION,
      cash: 0, runEarned: 0, lifetimeEarned: 0,
      stars: 0, starsClaimed: 0, prestiges: 0,
      biz: {}, jobs: 0, skills: {}, props: {}, lux: {},
      mkt: {}, hold: {}, mktAcc: 0,
      events: [], nextEventAt: now + 60000, nextNewsAt: now + 90000, news: [],
      boost: { adUntil: 0, tourUntil: 0, quickAt: 0, turboAt: 0 },
      tour: { week: null, score: 0, base: 1000, pending: null, best: null },
      goals: { short: 0, mid: 0, long: 0 },
      ach: {},
      daily: null,
      unlocks: { inv: false, lux: false },
      stats: {
        taps: 0, tapEarned: 0, bizRuns: 0, trades: 0, tradeProfit: 0, fees: 0, playSec: 0, adsWatched: 0,
        bizLevels: 0, skillsBought: 0, propsBought: 0, eventsFixed: 0, dailyDone: 0, offlineEarned: 0, bonusUsed: 0, prodEarned: 0
      },
      settings: { sound: true, vib: true, reduceMotion: false, bigText: false },
      noAds: false,
      tutorial: 0,
      created: now, lastSeen: now, clockMax: now
    };
    D.BUSINESSES.forEach(function (b) { s.biz[b.id] = { lvl: 0, emp: 0, mgr: false, prog: 0, running: false }; });
    M.init(s);
    return s;
  };

  // ---------------- dinheiro (com guardas contra NaN/Infinity) ----------------
  // isReward: prêmios (metas, missões, baú, torneio, bônus) não contam como "faturamento produtivo",
  // para que a missão "Fature $X" não seja concluída com o prêmio de outra missão.
  function earn(a, isReward) {
    if (!(a > 0) || !isFinite(a)) return;
    var s = G.s;
    s.cash = Math.min(S.BIG, s.cash + a);
    s.runEarned = Math.min(S.BIG, s.runEarned + a);
    s.lifetimeEarned = Math.min(S.BIG, s.lifetimeEarned + a);
    if (!isReward) s.stats.prodEarned = Math.min(S.BIG, s.stats.prodEarned + a);
  }
  function reward(a) { earn(a, true); }
  G.earnReward = reward;
  function spend(a) {
    var s = G.s;
    if (!(a >= 0) || !isFinite(a) || s.cash < a) return false;
    s.cash = Math.max(0, s.cash - a);
    return true;
  }
  G.earn = earn;

  // Registra o horário visto. clockMax nunca diminui: se o relógio do aparelho for atrasado,
  // os ganhos offline só voltam a contar depois que o tempo real passar do maior horário já visto.
  G.touch = function (now) {
    var s = G.s;
    now = now || G.now();
    s.lastSeen = now;
    if (now > s.clockMax) s.clockMax = now;
  };

  // ---------------- ações ----------------
  G.tap = function () {
    var s = G.s, v = E.tapValue(s, G.now());
    earn(v);
    s.stats.taps++; s.stats.tapEarned = Math.min(S.BIG, s.stats.tapEarned + v);
    return v;
  };

  G.buyJob = function () {
    var s = G.s, j = D.JOBS[s.jobs];
    if (!j || !spend(j.cost)) return false;
    s.jobs++;
    emit('buy', { kind: 'job', id: j.id });
    return true;
  };

  G.buySkill = function (id) {
    var s = G.s, k = E.SKILL[id];
    if (!k || E.skill(s, id) >= k.max) return false;
    if (!spend(E.skillCost(s, id))) return false;
    s.skills[id] = E.skill(s, id) + 1;
    s.stats.skillsBought++;
    emit('buy', { kind: 'skill', id: id });
    return true;
  };

  // k = número de níveis; 'max' = o máximo possível (limitado a D.MAX_BUY_PER_TAP e ao nível máximo)
  G.buyBiz = function (id, k) {
    var s = G.s, st = s.biz[id];
    if (!st) return false;
    var room = D.MAX_BIZ_LVL - st.lvl;
    if (k === 'max') k = E.bizMaxBuy(s, id, s.cash);
    k = Math.min(Math.floor(k), D.MAX_BUY_PER_TAP, room);
    if (!(k > 0)) return false;
    var c = E.bizCost(s, id, k);
    if (!spend(c)) return false;
    var before = st.lvl;
    st.lvl += k;
    s.stats.bizLevels += k;
    var ms = D.MILESTONES.filter(function (m) { return before < m && st.lvl >= m; });
    emit('buy', { kind: 'biz', id: id, k: k, milestone: ms.length ? ms[ms.length - 1] : null, first: before === 0 });
    return true;
  };

  G.hireManager = function (id) {
    var s = G.s, st = s.biz[id];
    if (!st || st.lvl <= 0 || st.mgr || !spend(E.BIZ[id].mgr)) return false;
    st.mgr = true;
    emit('buy', { kind: 'mgr', id: id });
    return true;
  };

  G.hireEmployee = function (id) {
    var s = G.s, st = s.biz[id];
    if (!st || st.lvl <= 0 || st.emp >= D.EMP_MAX || !spend(E.empCost(s, id))) return false;
    st.emp++;
    emit('buy', { kind: 'emp', id: id });
    return true;
  };

  // Negócio sem gerente: o jogador toca para iniciar um ciclo.
  G.runBiz = function (id) {
    var st = G.s.biz[id];
    if (!st || st.lvl <= 0 || st.mgr || st.running) return false;
    st.running = true; st.prog = 0;
    return true;
  };

  G.buyProp = function (id) {
    var s = G.s;
    if (!E.PROP[id] || !spend(E.propCost(s, id))) return false;
    s.props[id] = (s.props[id] || 0) + 1;
    s.stats.propsBought++;
    emit('buy', { kind: 'prop', id: id });
    return true;
  };

  G.buyLux = function (id) {
    var s = G.s, l = E.LUX[id];
    if (!l || s.lux[id] || !spend(l.cost)) return false;
    s.lux[id] = true;
    emit('buy', { kind: 'lux', id: id });
    return true;
  };

  var MAX_QTY = 1e15;
  G.maxBuyAsset = function (id) {
    var s = G.s, p = s.mkt[id].p;
    return Math.max(0, Math.min(MAX_QTY, Math.floor(s.cash / (p * (1 + D.TRADE_FEE)))));
  };

  G.buyAsset = function (id, qty) {
    var s = G.s;
    if (!s.mkt[id]) return false;
    var p = s.mkt[id].p;
    if (qty === 'max') qty = G.maxBuyAsset(id);
    qty = Math.floor(qty);
    if (!(qty > 0) || qty > MAX_QTY) return false;
    var base = p * qty, fee = base * D.TRADE_FEE;
    if (!spend(base + fee)) return false;
    var h = s.hold[id] || (s.hold[id] = { qty: 0, avg: 0 });
    h.avg = (h.avg * h.qty + base + fee) / (h.qty + qty);
    h.qty += qty;
    s.stats.trades++; s.stats.fees += fee;
    emit('trade', { id: id, qty: qty, buy: true });
    return true;
  };

  // Retorna o lucro (pode ser 0 ou negativo) ou false se não houve venda.
  G.sellAsset = function (id, qty) {
    var s = G.s, h = s.hold[id];
    if (!h || h.qty <= 0 || !s.mkt[id]) return false;
    if (qty === 'max' || qty > h.qty) qty = h.qty;
    qty = Math.floor(qty);
    if (!(qty > 0)) return false;
    var p = s.mkt[id].p, gross = p * qty, fee = gross * D.TRADE_FEE, net = gross - fee;
    var profit = net - h.avg * qty;
    s.cash = Math.min(S.BIG, s.cash + net);
    if (profit > 0) {
      s.runEarned = Math.min(S.BIG, s.runEarned + profit);
      s.lifetimeEarned = Math.min(S.BIG, s.lifetimeEarned + profit);
    }
    h.qty -= qty;
    if (h.qty <= 0) delete s.hold[id];
    s.stats.trades++; s.stats.fees += fee; s.stats.tradeProfit += profit;
    s.tour.score += profit;
    emit('trade', { id: id, qty: qty, buy: false, profit: profit });
    return profit;
  };

  // ---------------- eventos aleatórios dos negócios ----------------
  var EVENT_TYPES = {
    promo:  { title: 'Promoção viral!',          icon: '🚀', mult: 3,   dur: 30,  good: true,  desc: 'Clientes fazendo fila! Receita x3.' },
    crise:  { title: 'Crise de fornecedores',    icon: '⚠️', mult: 0.5, dur: 90,  good: false, desc: 'Receita caiu 50%. Pague para resolver já.', fix: 'Resolver', costSec: 40 },
    rival:  { title: 'Concorrente abriu ao lado', icon: '🥊', mult: 0.7, dur: 120, good: false, desc: 'Receita -30%. Lance uma campanha para virar o jogo!', fix: 'Campanha', costSec: 30 },
    viral:  { title: 'Influencer visitou!',      icon: '📸', mult: 2,   dur: 60,  good: true,  desc: 'Post viralizou. Receita x2.' }
  };
  G.EVENT_TYPES = EVENT_TYPES;

  function spawnEvent(now) {
    var s = G.s;
    var owned = D.BUSINESSES.filter(function (b) { return s.biz[b.id].lvl > 0; });
    if (!owned.length) return;
    var b = owned[Math.floor(G.rng() * owned.length)];
    if (s.events.some(function (e) { return e.biz === b.id && e.until > now; })) return;
    var r = G.rng(), type = r < 0.3 ? 'promo' : r < 0.5 ? 'viral' : r < 0.75 ? 'crise' : 'rival';
    var t = EVENT_TYPES[type];
    var ev = { id: now + '_' + b.id, biz: b.id, type: type, mult: t.mult, until: now + t.dur * 1000 };
    if (t.costSec) ev.cost = Math.max(50, E.bizIncome(s, b.id, now, true) * t.costSec);
    s.events.push(ev);
    emit('bizEvent', ev);
  }

  G.resolveEvent = function (evId) {
    var s = G.s, now = G.now();
    var ev = s.events.filter(function (e) { return e.id === evId; })[0];
    if (!ev || ev.until <= now || !ev.cost || !spend(ev.cost)) return false;
    if (ev.type === 'rival') { ev.type = 'promo'; ev.mult = 1.5; ev.until = now + 60000; delete ev.cost; }
    else ev.until = now;
    s.stats.eventsFixed++;
    emit('buy', { kind: 'event', id: ev.biz });
    return true;
  };

  // ---------------- metas (curto/médio/longo) ----------------
  function goalDef(kind, i) {
    var list = D.GOALS[kind];
    if (i < list.length) return list[i];
    var k = i - list.length + 1;
    if (kind === 'short') { var v = 1e6 * Math.pow(10, k); return { t: 'earned', v: v, txt: 'Fature $' + F.num(v) + ' no total' }; }
    if (kind === 'mid') { var w = 1e7 * Math.pow(10, k); return { t: 'ips', v: w, txt: 'Renda passiva de $' + F.num(w) + '/s' }; }
    var n = 1e12 * Math.pow(10, k); return { t: 'nw', v: n, txt: 'Patrimônio de $' + F.num(n) };
  }

  // Valor atual de uma métrica usada por metas e conquistas.
  // Renda passiva ignora turbos temporários para que metas não sejam concluídas só por um boost.
  function metric(s, t, id, now) {
    switch (t) {
      case 'cash': return s.cash;
      case 'earned': return s.lifetimeEarned;
      case 'job': case 'jobs': return s.jobs;
      case 'biz': return s.biz[id].lvl;
      case 'mgr': return s.biz[id].mgr ? 1 : 0;
      case 'skill': return E.skill(s, id);
      case 'lux': return s.lux[id] ? 1 : 0;
      case 'trade': case 'trades': return s.stats.trades;
      case 'prop': return s.props[id] || 0;
      case 'propn': return D.PROPS.reduce(function (a, p) { return a + (s.props[p.id] || 0); }, 0);
      case 'owned': return E.ownedCount(s);
      case 'mgrs': return E.mgrCount(s);
      case 'ips': return E.passiveIncome(s, now, true);
      case 'nw': return E.netWorth(s);
      case 'luxn': return Object.keys(s.lux).length;
      case 'coll': return E.completedCollections(s);
      case 'prestige': return s.prestiges;
      case 'taps': return s.stats.taps;
      case 'maxlvl': return D.BUSINESSES.reduce(function (a, b) { return Math.max(a, s.biz[b.id].lvl); }, 0);
      case 'empfull': return D.BUSINESSES.some(function (b) { return s.biz[b.id].emp >= D.EMP_MAX; }) ? 1 : 0;
      case 'tprofit': return s.stats.tradeProfit;
      case 'fixed': return s.stats.eventsFixed;
      case 'daily': return s.stats.dailyDone;
      case 'tourwin': return s.tour.best === 1 ? 1 : 0;
      case 'stars': return s.stars;
    }
    return 0;
  }

  G.goalProgress = function (kind) {
    var s = G.s, g = goalDef(kind, s.goals[kind]);
    var target = (g.t === 'mgr' || g.t === 'lux') ? 1 : (g.v || 1);
    var cur = metric(s, g.t, g.id, G.now());
    return { def: g, cur: cur, target: target, done: cur >= target, frac: Math.max(0, Math.min(1, cur / target)) };
  };

  var GOAL_REWARD_SEC = { short: 15, mid: 45, long: 120 };
  var GOAL_REWARD_CAP = { short: 0.1, mid: 0.2, long: 0.3 };
  function checkGoals(now) {
    var s = G.s;
    ['short', 'mid', 'long'].forEach(function (kind) {
      var gp = G.goalProgress(kind);
      if (!gp.done) return;
      var i = s.goals[kind];
      // recompensa limitada a uma fração do patrimônio para não "pular" metas em cascata
      var reward = Math.min((E.passiveIncome(s, now, true) + E.tapValue(s, now)) * GOAL_REWARD_SEC[kind],
                            E.netWorth(s) * GOAL_REWARD_CAP[kind]);
      reward = Math.max(reward, 10 * (i + 1));
      earn(reward, true);
      s.goals[kind]++;
      emit('goal', { kind: kind, txt: gp.def.txt, reward: reward });
    });
  }

  // ---------------- conquistas ----------------
  G.achProgress = function (a) {
    var s = G.s, cur = metric(s, a.t, a.id2, G.now());
    return { cur: cur, target: a.v, done: !!s.ach[a.id], frac: Math.max(0, Math.min(1, cur / a.v)) };
  };
  function checkAchievements() {
    var s = G.s;
    D.ACHIEVEMENTS.forEach(function (a) {
      if (s.ach[a.id]) return;
      if (metric(s, a.t, a.id2, G.now()) >= a.v) {
        s.ach[a.id] = true;
        emit('ach', a);
      }
    });
  }
  G.checkAchievements = checkAchievements;

  // ---------------- desbloqueios progressivos ----------------
  G.isUnlocked = function (tab) { return !D.UNLOCKS[tab] || !!G.s.unlocks[tab]; };
  function checkUnlocks() {
    var s = G.s;
    Object.keys(D.UNLOCKS).forEach(function (k) {
      if (!s.unlocks[k] && s.lifetimeEarned >= D.UNLOCKS[k]) { s.unlocks[k] = true; emit('unlock', k); }
    });
  }

  // ---------------- missões diárias ----------------
  function dayKey(t) { var d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  G.dayKey = dayKey;
  function dailyStat(s, stat) { return s.stats[stat === 'earned' ? 'prodEarned' : stat] || 0; }
  function dailyAvailable(s, d) {
    switch (d.req) {
      case 'skills': return s.lifetimeEarned >= 100;
      case 'inv': return !!s.unlocks.inv;
      case 'props': return s.lifetimeEarned >= 2e4;
      case 'biz2': return E.ownedCount(s) >= 2;
    }
    return true;
  }
  function seededRng(seed) {
    var x = (seed >>> 0) || 1;
    return function () { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return (x % 1e9) / 1e9; };
  }
  function round2(v) { var p = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1)); return Math.ceil(v / p) * p; }

  function dailyTarget(s, d, now) {
    var levels = D.BUSINESSES.reduce(function (a, b) { return a + s.biz[b.id].lvl; }, 0);
    var income = E.passiveIncome(s, now, true) + E.tapValue(s, now) * 2;
    switch (d.id) {
      case 'taps': return 300;
      case 'levels': return Math.max(10, Math.min(150, Math.round(levels * 0.12 / 5) * 5));
      case 'runs': return 150 * Math.max(1, E.ownedCount(s));
      case 'earn': return round2(Math.max(500, income * 900));
      case 'skills': return 2;
      case 'trades': return 4;
      case 'props': return 2;
      case 'fix': return 1;
    }
    return 1;
  }

  // Gera as missões do dia (determinístico pela data). Relógio atrasado não gera um novo dia.
  G.ensureDaily = function (now) {
    var s = G.s;
    now = now || G.now();
    var dk = dayKey(now);
    if (s.daily && dk <= s.daily.day) return false;
    var yesterday = dayKey(now - 86400000);
    var streak = s.daily && s.daily.bonus && s.daily.day === yesterday ? s.daily.streak : 0;
    var r = seededRng(dk * 2654435761);
    var pool = D.DAILY.filter(function (d) { return dailyAvailable(s, d); });
    var list = [];
    while (list.length < 3 && pool.length) {
      var d = pool.splice(Math.floor(r() * pool.length), 1)[0];
      var target = dailyTarget(s, d, now);
      list.push({
        id: d.id, target: target, base: dailyStat(s, d.stat), reward: 0,
        done: false, claimed: false
      });
    }
    s.daily = { day: dk, list: list, bonus: false, streak: streak };
    emit('dailyNew', s.daily);
    return true;
  };

  G.dailyProgress = function (m) {
    var d = D.DAILY_BY_ID[m.id];
    var cur = Math.max(0, Math.min(m.target, dailyStat(G.s, d.stat) - m.base));
    return { def: d, cur: cur, target: m.target, done: cur >= m.target, frac: cur / m.target };
  };

  G.dailyText = function (m) {
    var d = D.DAILY_BY_ID[m.id];
    return d.txt.replace('{n}', F.num(m.target)).replace('{m}', F.money(m.target));
  };

  // Prêmio calculado no momento do resgate: N minutos da renda atual (acompanha o crescimento durante o dia).
  G.dailyReward = function (m) {
    var s = G.s, now = G.now(), d = D.DAILY_BY_ID[m.id];
    // limitado a 25% do patrimônio: no início do jogo, "minutos de renda" valeriam etapas inteiras
    return Math.max(25, Math.min((E.passiveIncome(s, now, true) + E.tapValue(s, now)) * d.rewardMin * 60,
                                 Math.max(100, E.netWorth(s) * 0.25)));
  };

  G.claimDaily = function (i) {
    var s = G.s, m = s.daily && s.daily.list[i];
    if (!m || m.claimed || !G.dailyProgress(m).done) return 0;
    var a = G.dailyReward(m);
    m.done = m.claimed = true;
    m.reward = a;
    reward(a);
    emit('dailyClaim', m);
    return a;
  };

  G.dailyBonusAmount = function () {
    var s = G.s, now = G.now();
    var streakMult = 1 + Math.min(7, s.daily ? s.daily.streak : 0) * 0.1; // até +70% com 7 dias seguidos
    return Math.max(100, Math.min((E.passiveIncome(s, now, true) + E.tapValue(s, now)) * D.DAILY_BONUS_MIN * 60,
                                  Math.max(500, E.netWorth(s) * 0.5)) * streakMult);
  };
  G.dailyBonusReady = function () {
    var dl = G.s.daily;
    return !!dl && !dl.bonus && dl.list.length > 0 && dl.list.every(function (m) { return m.claimed; });
  };
  G.claimDailyBonus = function () {
    var s = G.s;
    if (!G.dailyBonusReady()) return 0;
    var a = G.dailyBonusAmount();
    reward(a);
    s.daily.bonus = true;
    s.daily.streak++;
    s.stats.dailyDone++;
    return a;
  };

  // ---------------- laço principal ----------------
  var slowAcc = 0;
  G.tick = function (dt) {
    var s = G.s, now = G.now();
    if (!(dt > 0) || !isFinite(dt)) return;
    s.stats.playSec += dt;

    D.BUSINESSES.forEach(function (b) {
      var st = s.biz[b.id];
      if (st.lvl <= 0 || !(st.mgr || st.running)) return;
      var T = E.bizTime(s, b.id);
      st.prog += dt / T;
      var up = E.bizUpkeep(s, b.id) * dt;
      if (up > 0) s.cash = Math.max(0, s.cash - up);
      if (st.prog >= 1) {
        var n = st.mgr ? Math.floor(st.prog) : 1;
        var amt = E.bizRevenue(s, b.id, now) * n;
        earn(amt);
        s.stats.bizRuns += n;
        if (st.mgr) st.prog -= n; else { st.prog = 0; st.running = false; }
        emit('bizPay', { id: b.id, amount: amt });
      }
    });

    var passiveExtra = (E.salary(s) + E.rentGross(s) - E.rentUpkeep(s)) * dt;
    if (passiveExtra > 0) earn(passiveExtra);

    // eventos
    if (s.events.length) s.events = s.events.filter(function (e) { return e.until > now; });
    if (now >= s.nextEventAt) {
      s.nextEventAt = now + (90 + G.rng() * 120) * 1000;
      spawnEvent(now);
    }

    // bolsa
    s.mktAcc += dt;
    var steps = 0;
    while (s.mktAcc >= 1 && steps++ < 5) { s.mktAcc -= 1; M.step(s, G.rng); }
    if (s.mktAcc > 1) s.mktAcc = 0;
    if (now >= s.nextNewsAt) {
      s.nextNewsAt = now + (100 + G.rng() * 140) * 1000;
      var n = M.news(s, G.rng);
      s.news.unshift({ t: now, txt: n.txt, up: n.up, id: n.id });
      if (s.news.length > 8) s.news.pop();
      emit('news', n);
    }

    // verificações mais pesadas 4x por segundo, não a cada frame
    slowAcc += dt;
    if (slowAcc >= 0.25) {
      slowAcc = 0;
      clampTimers(now);
      checkGoals(now);
      checkAchievements();
      checkUnlocks();
      checkTournament(now);
      G.ensureDaily(now);
    }
  };

  // Se o relógio do aparelho for atrasado durante o jogo, temporizadores não podem ficar "presos" no futuro.
  function clampTimers(now) {
    var s = G.s, b = s.boost;
    if (s.nextEventAt > now + 10 * 60000) s.nextEventAt = now + 120000;
    if (s.nextNewsAt > now + 10 * 60000) s.nextNewsAt = now + 120000;
    if (b.adUntil > now + D.AD_BOOST_MAX_H * 3600000) b.adUntil = now + D.AD_BOOST_MAX_H * 3600000;
    if (b.tourUntil > now + 6 * 3600000) b.tourUntil = now + 6 * 3600000;
    if (b.quickAt > now + D.QUICK_CASH_CD * 1000) b.quickAt = now + D.QUICK_CASH_CD * 1000;
    var tmax = now + (D.AD_BOOST_MAX_H * 60 + D.FREE_BOOST_CD_MIN) * 60000;
    if (b.turboAt > tmax) b.turboAt = tmax;
  }

  // ---------------- torneio semanal (rivais simulados localmente) ----------------
  function checkTournament(now) {
    var s = G.s, wk = M.weekId(now);
    if (s.tour.week === wk) {
      // rivais acompanham o crescimento do jogador durante a semana
      s.tour.base = Math.max(s.tour.base, E.netWorth(s) * 0.05);
      return;
    }
    // só encerra a semana se o tempo avançou (relógio atrasado não gera prêmio)
    if (s.tour.week !== null && wk < s.tour.week) return;
    if (s.tour.week !== null && s.tour.score > 0 && !s.tour.pending) {
      var rank = M.ranking(s, now, true).findIndex(function (r) { return r.me; }) + 1;
      s.tour.pending = { rank: rank, week: s.tour.week, score: s.tour.score };
      if (!s.tour.best || rank < s.tour.best) s.tour.best = rank;
      emit('tourEnd', s.tour.pending);
    }
    s.tour.week = wk;
    s.tour.score = 0;
    s.tour.base = Math.max(1000, E.netWorth(s) * 0.1);
  }
  G.checkTournament = checkTournament;

  G.claimTourReward = function () {
    var s = G.s, p = s.tour.pending, now = G.now();
    if (!p) return null;
    var rw = M.rewardFor(p.rank);
    var cash = Math.max(1000, (E.passiveIncome(s, now, true) + E.tapValue(s, now)) * rw.min * 60);
    reward(cash);
    if (rw.boostH > 0) s.boost.tourUntil = Math.max(now, s.boost.tourUntil) + rw.boostH * 3600000;
    s.tour.pending = null;
    return { cash: cash, boostH: rw.boostH, label: rw.label, rank: p.rank };
  };

  // ---------------- bônus (anúncio recompensado, ou gratuito quando não há anúncios) ----------------
  G.applyAdBoost = function () {
    var s = G.s, now = G.now();
    var max = now + D.AD_BOOST_MAX_H * 3600000;
    s.boost.adUntil = Math.min(max, Math.max(now, s.boost.adUntil) + D.AD_BOOST_MIN * 60000);
    s.stats.adsWatched++; // só chamado após anúncio real concluído
  };
  // Versão sem anúncios: o mesmo Turbo x2 de graça, sem acumular, com recarga após terminar.
  G.freeBoostReady = function () { return G.now() >= G.s.boost.turboAt; };
  G.useFreeBoost = function () {
    var s = G.s, now = G.now();
    if (!G.freeBoostReady()) return false;
    s.boost.adUntil = Math.max(now, s.boost.adUntil) + D.AD_BOOST_MIN * 60000;
    s.boost.turboAt = s.boost.adUntil + D.FREE_BOOST_CD_MIN * 60000;
    s.stats.bonusUsed++;
    return true;
  };
  G.quickCashAmount = function () {
    var s = G.s, now = G.now();
    return Math.max(100, (E.passiveIncome(s, now, true) + E.tapValue(s, now)) * D.QUICK_CASH_MIN * 60);
  };
  G.quickCashReady = function () { return G.now() >= G.s.boost.quickAt; };
  G.applyQuickCash = function () {
    var s = G.s;
    if (!G.quickCashReady()) return 0;
    var a = G.quickCashAmount();
    reward(a);
    s.boost.quickAt = G.now() + D.QUICK_CASH_CD * 1000;
    return a;
  };

  // ---------------- offline ----------------
  // Tempo ausente = agora − maior horário já visto (clockMax). Assim, adiantar o relógio, coletar,
  // voltar o relógio e repetir não rende de novo. Cada chamada consome o tempo (sem prêmio duplicado).
  G.computeOffline = function () {
    var s = G.s, now = G.now();
    var ref = Math.max(s.lastSeen, s.clockMax);
    G.clockBack = now < ref - 120000;
    var elapsed = (now - ref) / 1000;
    if (!(elapsed > 60) || !isFinite(elapsed)) return null;
    var cap = E.offlineCapHours(s) * 3600;
    var secs = Math.min(elapsed, cap);
    var b = E.breakdown(s, now, true);
    var rate = Math.max(0, b.net);
    var amount = rate * secs;
    var manual = 0;
    // ciclos manuais em andamento terminam enquanto o jogador está fora
    D.BUSINESSES.forEach(function (bz) {
      var st = s.biz[bz.id];
      if (st.running && !st.mgr) { manual += E.bizRevenue(s, bz.id, now, true); st.running = false; st.prog = 0; }
    });
    amount += manual;
    // a bolsa continua mexendo (até 30 min simulados)
    var steps = Math.min(Math.floor(elapsed), 1800);
    for (var i = 0; i < steps; i++) M.step(s, G.rng);
    s.events = [];
    if (!isFinite(amount) || amount < 0) amount = 0;
    earn(amount);
    s.stats.offlineEarned = Math.min(S.BIG, s.stats.offlineEarned + amount);
    s.lastSeen = s.clockMax = now;
    return {
      elapsed: elapsed, secs: secs, capped: elapsed > cap, capH: cap / 3600, amount: amount, rate: rate,
      parts: { biz: b.biz * secs, salary: b.salary * secs, rent: (b.rent - b.rentUpkeep) * secs, empUpkeep: b.empUpkeep * secs, manual: manual }
    };
  };

  // ---------------- prestígio (Legado) ----------------
  G.prestige = function () {
    var s = G.s, gain = E.potentialStars(s);
    if (gain < 1) return 0;
    var keep = {
      stars: s.stars + gain, starsClaimed: s.starsClaimed + gain, prestiges: s.prestiges + 1,
      lifetimeEarned: s.lifetimeEarned, lux: s.lux, mkt: s.mkt, tour: s.tour, goals: s.goals,
      stats: s.stats, settings: s.settings, noAds: s.noAds, tutorial: s.tutorial, created: s.created,
      boost: s.boost, news: s.news, ach: s.ach, daily: s.daily, unlocks: s.unlocks,
      lastSeen: s.lastSeen, clockMax: s.clockMax
    };
    var n = G.newState();
    Object.keys(keep).forEach(function (k) { n[k] = keep[k]; });
    G.s = n;
    emit('prestige', { gain: gain });
    return gain;
  };

  // ---------------- save / load / backups ----------------
  function store(key, val) {
    try { G.storage.setItem(key, val); return true; } catch (e) { return false; }
  }
  function read(key) {
    try { return G.storage ? G.storage.getItem(key) : null; } catch (e) { return null; }
  }
  // Valida um texto JSON de save. Retorna o estado limpo ou lança Error.
  function parseState(raw) {
    var obj;
    try { obj = JSON.parse(raw); } catch (e) { throw new Error('JSON inválido'); }
    return S.sanitize(obj, G.newState(), G.now());
  }

  var lastBackup = 0;
  G.save = function () {
    if (!G.storage || !G.s) return false;
    G.touch();
    var json;
    try { json = JSON.stringify(G.s); } catch (e) { return false; }
    var ok = store(G.KEYS.main, json);
    var now = G.now();
    if (ok && now - lastBackup > BACKUP_EVERY_MS) { lastBackup = now; store(G.KEYS.auto, json); }
    if (!ok && !G.saveFailed) emit('saveError');
    G.saveFailed = !ok;
    return ok;
  };

  // Retorna { status: 'new' | 'ok' | 'recovered' | 'failed', error? }.
  // Um save ilegível nunca é apagado: é copiado para KEYS.bad antes de qualquer sobrescrita.
  G.load = function () {
    var raw = read(G.KEYS.main);
    if (raw) {
      try {
        G.s = parseState(raw);
        lastBackup = G.now();
        store(G.KEYS.auto, raw);
        return { status: 'ok' };
      } catch (e) {
        if (read(G.KEYS.bad) !== raw) store(G.KEYS.bad, raw);
        var bak = read(G.KEYS.auto);
        if (bak && bak !== raw) {
          try { G.s = parseState(bak); return { status: 'recovered', error: e.message }; } catch (e2) { /* backup também inválido */ }
        }
        G.s = G.newState();
        return { status: 'failed', error: e.message };
      }
    }
    G.s = G.newState();
    return { status: 'new' };
  };

  G.reset = function () {
    var cur = read(G.KEYS.main);
    if (cur) store(G.KEYS.pre, cur); // ainda dá para desfazer pela restauração de backup
    G.s = G.newState();
    G.save();
  };

  G.exportSave = function () { G.touch(); return S.encode(G.s); };

  // Lança Error com mensagem amigável se o código for inválido. Guarda o estado atual em KEYS.pre antes.
  G.importSave = function (text) {
    var raw = S.decode(text);
    var s = S.sanitize(raw, G.newState(), G.now());
    store(G.KEYS.pre, JSON.stringify(G.s));
    // o tempo entre exportar e importar não vira ganho offline (evita repetir o mesmo save para ganhar de novo)
    s.lastSeen = s.clockMax = Math.max(G.now(), s.clockMax);
    G.s = s;
    G.save();
    return true;
  };

  // Informações dos backups locais disponíveis para a tela de ajustes.
  G.backupInfo = function () {
    var out = {};
    ['auto', 'pre', 'bad'].forEach(function (k) {
      var raw = read(G.KEYS[k]);
      if (!raw) return;
      var info = { size: raw.length, valid: false, time: 0, cash: 0 };
      try { var st = parseState(raw); info.valid = true; info.time = st.lastSeen; info.cash = st.cash; info.nw = E.netWorth(st); } catch (e) { info.error = e.message; }
      out[k] = info;
    });
    return out;
  };

  G.restoreBackup = function (kind) {
    var raw = read(G.KEYS[kind]);
    if (!raw) throw new Error('Backup não encontrado.');
    var s = parseState(raw);
    store(G.KEYS.pre, JSON.stringify(G.s));
    s.lastSeen = s.clockMax = Math.max(G.now(), s.clockMax);
    G.s = s;
    G.save();
    return true;
  };

  // Texto bruto de um backup (ex.: save corrompido) para o jogador copiar e guardar.
  G.backupRaw = function (kind) { return read(G.KEYS[kind]); };

  if (isNode) module.exports = G;
  else root.G = G;
})(this);
