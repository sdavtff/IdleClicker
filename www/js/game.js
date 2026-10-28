/* Estado e regras do jogo: ações do jogador, laço de simulação, eventos, metas, offline, prestígio e save.
 * Não toca no DOM — roda também no Node (simulador de balanceamento). */
(function (root) {
  'use strict';
  var isNode = typeof module !== 'undefined' && module.exports;
  var D = isNode ? require('./data.js') : root.D;
  var E = isNode ? require('./economy.js') : root.E;
  var M = isNode ? require('./market.js') : root.M;

  var G = { s: null, rng: Math.random, now: function () { return Date.now(); }, storage: null };
  var listeners = {};
  G.on = function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); };
  function emit(ev, data) { (listeners[ev] || []).forEach(function (fn) { fn(data); }); }
  G.emit = emit;

  G.newState = function () {
    var now = G.now();
    var s = {
      v: D.SAVE_VERSION,
      cash: 0, runEarned: 0, lifetimeEarned: 0,
      stars: 0, starsClaimed: 0, prestiges: 0,
      biz: {}, jobs: 0, skills: {}, props: {}, lux: {},
      mkt: {}, hold: {}, mktAcc: 0,
      events: [], nextEventAt: now + 60000, nextNewsAt: now + 90000, news: [],
      boost: { adUntil: 0, tourUntil: 0, quickAt: 0 },
      tour: { week: null, score: 0, base: 1000, pending: null, best: null },
      goals: { short: 0, mid: 0, long: 0 },
      stats: { taps: 0, tapEarned: 0, bizRuns: 0, trades: 0, tradeProfit: 0, fees: 0, playSec: 0, adsWatched: 0 },
      settings: { sound: true, vib: true },
      noAds: false,
      tutorial: 0,
      created: now, lastSeen: now
    };
    D.BUSINESSES.forEach(function (b) { s.biz[b.id] = { lvl: 0, emp: 0, mgr: false, prog: 0, running: false }; });
    M.init(s);
    return s;
  };

  // ---------------- dinheiro ----------------
  function earn(a) {
    if (!(a > 0)) return;
    var s = G.s;
    s.cash += a; s.runEarned += a; s.lifetimeEarned += a;
  }
  function spend(a) {
    var s = G.s;
    if (!(a >= 0) || s.cash < a) return false;
    s.cash -= a;
    return true;
  }
  G.earn = earn;

  // ---------------- ações ----------------
  G.tap = function () {
    var s = G.s, v = E.tapValue(s, G.now());
    earn(v);
    s.stats.taps++; s.stats.tapEarned += v;
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
    if (E.skill(s, id) >= k.max) return false;
    if (!spend(E.skillCost(s, id))) return false;
    s.skills[id] = E.skill(s, id) + 1;
    emit('buy', { kind: 'skill', id: id });
    return true;
  };

  // k = número de níveis; 'max' = o máximo possível
  G.buyBiz = function (id, k) {
    var s = G.s;
    if (k === 'max') k = E.bizMaxBuy(s, id, s.cash);
    if (!(k > 0)) return false;
    var c = E.bizCost(s, id, k);
    if (!spend(c)) return false;
    var st = s.biz[id], before = st.lvl;
    st.lvl += k;
    var ms = D.MILESTONES.filter(function (m) { return before < m && st.lvl >= m; });
    emit('buy', { kind: 'biz', id: id, k: k, milestone: ms.length ? ms[ms.length - 1] : null, first: before === 0 });
    return true;
  };

  G.hireManager = function (id) {
    var s = G.s, st = s.biz[id];
    if (st.lvl <= 0 || st.mgr || !spend(E.BIZ[id].mgr)) return false;
    st.mgr = true;
    emit('buy', { kind: 'mgr', id: id });
    return true;
  };

  G.hireEmployee = function (id) {
    var s = G.s, st = s.biz[id];
    if (st.lvl <= 0 || st.emp >= D.EMP_MAX || !spend(E.empCost(s, id))) return false;
    st.emp++;
    emit('buy', { kind: 'emp', id: id });
    return true;
  };

  // Negócio sem gerente: o jogador toca para iniciar um ciclo.
  G.runBiz = function (id) {
    var st = G.s.biz[id];
    if (st.lvl <= 0 || st.mgr || st.running) return false;
    st.running = true; st.prog = 0;
    return true;
  };

  G.buyProp = function (id) {
    var s = G.s;
    if (!spend(E.propCost(s, id))) return false;
    s.props[id] = (s.props[id] || 0) + 1;
    emit('buy', { kind: 'prop', id: id });
    return true;
  };

  G.buyLux = function (id) {
    var s = G.s, l = E.LUX[id];
    if (s.lux[id] || !spend(l.cost)) return false;
    s.lux[id] = true;
    emit('buy', { kind: 'lux', id: id });
    return true;
  };

  G.maxBuyAsset = function (id) {
    var s = G.s, p = s.mkt[id].p;
    return Math.floor(s.cash / (p * (1 + D.TRADE_FEE)));
  };

  G.buyAsset = function (id, qty) {
    var s = G.s, p = s.mkt[id].p;
    if (qty === 'max') qty = G.maxBuyAsset(id);
    if (!(qty > 0)) return false;
    var base = p * qty, fee = base * D.TRADE_FEE;
    if (!spend(base + fee)) return false;
    var h = s.hold[id] || (s.hold[id] = { qty: 0, avg: 0 });
    h.avg = (h.avg * h.qty + base + fee) / (h.qty + qty);
    h.qty += qty;
    s.stats.trades++; s.stats.fees += fee;
    emit('trade', { id: id, qty: qty, buy: true });
    return true;
  };

  G.sellAsset = function (id, qty) {
    var s = G.s, h = s.hold[id];
    if (!h || h.qty <= 0) return false;
    if (qty === 'max' || qty > h.qty) qty = h.qty;
    if (!(qty > 0)) return false;
    var p = s.mkt[id].p, gross = p * qty, fee = gross * D.TRADE_FEE, net = gross - fee;
    var profit = net - h.avg * qty;
    s.cash += net;
    if (profit > 0) { s.runEarned += profit; s.lifetimeEarned += profit; }
    h.qty -= qty;
    if (h.qty <= 0) { h.qty = 0; h.avg = 0; }
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
    emit('buy', { kind: 'event', id: ev.biz });
    return true;
  };

  // ---------------- metas ----------------
  function goalDef(kind, i) {
    var list = D.GOALS[kind];
    if (i < list.length) return list[i];
    var k = i - list.length + 1;
    if (kind === 'short') { var v = 1e6 * Math.pow(10, k); return { t: 'earned', v: v, txt: 'Fature $' + fmtShort(v) + ' no total' }; }
    if (kind === 'mid') { var w = 1e7 * Math.pow(10, k); return { t: 'ips', v: w, txt: 'Renda passiva de $' + fmtShort(w) + '/s' }; }
    var n = 1e12 * Math.pow(10, k); return { t: 'nw', v: n, txt: 'Patrimônio de $' + fmtShort(n) };
  }
  function fmtShort(v) { return (root.F || (isNode ? require('./fmt.js') : null)).num(v); }

  G.goalProgress = function (kind) {
    var s = G.s, g = goalDef(kind, s.goals[kind]), now = G.now(), cur = 0, target = g.v || 1;
    switch (g.t) {
      case 'cash': cur = s.cash; break;
      case 'earned': cur = s.lifetimeEarned; break;
      case 'job': cur = s.jobs; break;
      case 'biz': cur = s.biz[g.id].lvl; break;
      case 'mgr': cur = s.biz[g.id].mgr ? 1 : 0; target = 1; break;
      case 'skill': cur = E.skill(s, g.id); break;
      case 'lux': cur = s.lux[g.id] ? 1 : 0; target = 1; break;
      case 'trade': cur = s.stats.trades; break;
      case 'prop': cur = s.props[g.id] || 0; break;
      case 'owned': cur = E.ownedCount(s); break;
      case 'mgrs': cur = E.mgrCount(s); break;
      case 'ips': cur = E.passiveIncome(s, now); break;
      case 'nw': cur = E.netWorth(s); break;
      case 'luxn': cur = Object.keys(s.lux).filter(function (k) { return s.lux[k]; }).length; break;
      case 'coll': cur = E.completedCollections(s); break;
      case 'prestige': cur = s.prestiges; break;
    }
    return { def: g, cur: cur, target: target, done: cur >= target, frac: Math.min(1, cur / target) };
  };

  var GOAL_REWARD_SEC = { short: 15, mid: 45, long: 120 };
  var GOAL_REWARD_CAP = { short: 0.1, mid: 0.2, long: 0.3 };
  function checkGoals() {
    var s = G.s;
    ['short', 'mid', 'long'].forEach(function (kind) {
      var guard = 0;
      while (guard++ < 1) {
        var gp = G.goalProgress(kind);
        if (!gp.done) break;
        var i = s.goals[kind];
        // recompensa limitada a uma fração do patrimônio para não "pular" metas em cascata
        var reward = Math.min((E.passiveIncome(s, G.now()) + E.tapValue(s, G.now())) * GOAL_REWARD_SEC[kind],
                              E.netWorth(s) * GOAL_REWARD_CAP[kind]);
        reward = Math.max(reward, 10 * (i + 1));
        earn(reward);
        s.goals[kind]++;
        emit('goal', { kind: kind, txt: gp.def.txt, reward: reward });
      }
    });
  }

  // ---------------- laço principal ----------------
  var goalAcc = 0;
  G.tick = function (dt) {
    var s = G.s, now = G.now();
    if (!(dt > 0)) return;
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
    while (s.mktAcc >= 1) { s.mktAcc -= 1; M.step(s, G.rng); }
    if (now >= s.nextNewsAt) {
      s.nextNewsAt = now + (100 + G.rng() * 140) * 1000;
      var n = M.news(s, G.rng);
      s.news.unshift({ t: now, txt: n.txt, up: n.up, id: n.id });
      if (s.news.length > 8) s.news.pop();
      emit('news', n);
    }

    goalAcc += dt;
    if (goalAcc >= 0.25) { goalAcc = 0; checkGoals(); checkTournament(now); }
  };

  // ---------------- torneio semanal ----------------
  function checkTournament(now) {
    var s = G.s, wk = M.weekId(now);
    if (s.tour.week === wk) {
      // rivais acompanham o crescimento do jogador durante a semana
      s.tour.base = Math.max(s.tour.base, E.netWorth(s) * 0.05);
      return;
    }
    if (s.tour.week !== null && s.tour.score > 0) {
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
    var cash = Math.max(1000, (E.passiveIncome(s, now) + E.tapValue(s, now)) * rw.min * 60);
    earn(cash);
    if (rw.boostH > 0) s.boost.tourUntil = Math.max(now, s.boost.tourUntil) + rw.boostH * 3600000;
    s.tour.pending = null;
    return { cash: cash, boostH: rw.boostH, label: rw.label, rank: p.rank };
  };

  // ---------------- recompensas por anúncio (sempre voluntárias) ----------------
  G.applyAdBoost = function () {
    var s = G.s, now = G.now();
    var max = now + D.AD_BOOST_MAX_H * 3600000;
    s.boost.adUntil = Math.min(max, Math.max(now, s.boost.adUntil) + D.AD_BOOST_MIN * 60000);
    s.stats.adsWatched++;
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
    earn(a);
    s.boost.quickAt = G.now() + D.QUICK_CASH_CD * 1000;
    s.stats.adsWatched++;
    return a;
  };

  // ---------------- offline ----------------
  G.computeOffline = function () {
    var s = G.s, now = G.now();
    var elapsed = (now - s.lastSeen) / 1000;
    if (!(elapsed > 60)) return null;
    var cap = E.offlineCapHours(s) * 3600;
    var secs = Math.min(elapsed, cap);
    var rate = E.passiveIncome(s, now, true);
    var amount = rate * secs;
    // ciclos manuais em andamento terminam enquanto o jogador está fora
    D.BUSINESSES.forEach(function (b) {
      var st = s.biz[b.id];
      if (st.running && !st.mgr) { amount += E.bizRevenue(s, b.id, now, true); st.running = false; st.prog = 0; }
    });
    // a bolsa continua mexendo (até 30 min simulados)
    var steps = Math.min(Math.floor(elapsed), 1800);
    for (var i = 0; i < steps; i++) M.step(s, G.rng);
    s.events = [];
    earn(amount);
    s.lastSeen = now;
    return { elapsed: elapsed, secs: secs, capped: elapsed > cap, capH: cap / 3600, amount: amount, rate: rate };
  };

  // ---------------- prestígio (Legado) ----------------
  G.prestige = function () {
    var s = G.s, gain = E.potentialStars(s);
    if (gain < 1) return 0;
    var keep = {
      stars: s.stars + gain, starsClaimed: s.starsClaimed + gain, prestiges: s.prestiges + 1,
      lifetimeEarned: s.lifetimeEarned, lux: s.lux, mkt: s.mkt, tour: s.tour, goals: s.goals,
      stats: s.stats, settings: s.settings, noAds: s.noAds, tutorial: s.tutorial, created: s.created,
      boost: s.boost, news: s.news
    };
    var n = G.newState();
    Object.keys(keep).forEach(function (k) { n[k] = keep[k]; });
    G.s = n;
    emit('prestige', { gain: gain });
    return gain;
  };

  // ---------------- save / load ----------------
  function merge(def, saved) {
    if (saved === null || typeof saved !== 'object' || Array.isArray(saved)) return saved === undefined ? def : saved;
    if (def === null || typeof def !== 'object' || Array.isArray(def)) return saved;
    var out = {};
    Object.keys(def).forEach(function (k) { out[k] = k in saved ? merge(def[k], saved[k]) : def[k]; });
    Object.keys(saved).forEach(function (k) { if (!(k in out)) out[k] = saved[k]; });
    return out;
  }

  G.save = function () {
    if (!G.storage || !G.s) return false;
    G.s.lastSeen = G.now();
    try { G.storage.setItem(D.SAVE_KEY, JSON.stringify(G.s)); return true; } catch (e) { return false; }
  };

  G.load = function () {
    var raw = null;
    try { raw = G.storage && G.storage.getItem(D.SAVE_KEY); } catch (e) { raw = null; }
    if (raw) {
      try {
        var saved = JSON.parse(raw);
        G.s = merge(G.newState(), saved);
        M.init(G.s);
        return true;
      } catch (e) { /* save corrompido: começa de novo */ }
    }
    G.s = G.newState();
    return false;
  };

  G.reset = function () {
    try { G.storage && G.storage.removeItem(D.SAVE_KEY); } catch (e) { /* ignore */ }
    G.s = G.newState();
  };

  G.exportSave = function () { return btoa(unescape(encodeURIComponent(JSON.stringify(G.s)))); };
  G.importSave = function (str) {
    try {
      var saved = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
      if (typeof saved !== 'object' || !saved.biz) return false;
      G.s = merge(G.newState(), saved);
      M.init(G.s);
      return true;
    } catch (e) { return false; }
  };

  if (isNode) module.exports = G;
  else root.G = G;
})(this);
