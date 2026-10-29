/* Fórmulas de economia (funções puras sobre o estado). Usadas pelo jogo e pelo simulador de balanceamento. */
(function (root) {
  'use strict';
  var D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.D;
  var E = {};

  var BIZ = {}; D.BUSINESSES.forEach(function (b) { BIZ[b.id] = b; });
  var LUX = {}; D.LUXURY.forEach(function (l) { LUX[l.id] = l; });
  var PROP = {}; D.PROPS.forEach(function (p) { PROP[p.id] = p; });
  var SKILL = {}; D.SKILLS.forEach(function (s) { SKILL[s.id] = s; });
  E.BIZ = BIZ; E.LUX = LUX; E.PROP = PROP; E.SKILL = SKILL;

  E.skill = function (s, id) { return s.skills[id] || 0; };

  E.luxBonus = function (s, key) {
    var t = 0;
    for (var id in s.lux) if (s.lux[id] && LUX[id] && LUX[id].bonus[key]) t += LUX[id].bonus[key];
    return t;
  };

  E.completedCollections = function (s) {
    var n = 0;
    D.LUX_CATS.forEach(function (c) {
      var items = D.LUXURY.filter(function (l) { return l.cat === c.id; });
      if (items.every(function (l) { return s.lux[l.id]; })) n++;
    });
    return n;
  };

  E.status = function (s) {
    var t = 0;
    for (var id in s.lux) if (s.lux[id] && LUX[id]) t += LUX[id].status;
    return t;
  };

  E.statusTitle = function (s) {
    var st = E.status(s), title = D.STATUS_TITLES[0][1];
    D.STATUS_TITLES.forEach(function (p) { if (st >= p[0]) title = p[1]; });
    return title;
  };

  E.starMult = function (s) { return 1 + D.STAR_BONUS * s.stars; };

  // Boosts temporários (anúncio voluntário x2, prêmio de torneio x1,5)
  E.tempMult = function (s, now) {
    var m = 1;
    if (s.boost.adUntil > now) m *= 2;
    if (s.boost.tourUntil > now) m *= 1.5;
    return m;
  };

  // Bônus permanente das conquistas (+1% por conquista)
  E.achCount = function (s) { return s.ach ? Object.keys(s.ach).length : 0; };
  E.achMult = function (s) { return 1 + D.ACH_BONUS * E.achCount(s); };

  // Multiplicador global de renda dos negócios
  E.globalMult = function (s, now, noTemp) {
    return E.starMult(s) * E.achMult(s) *
      (1 + E.luxBonus(s, 'inc') + D.COLLECTION_BONUS * E.completedCollections(s)) *
      (noTemp ? 1 : E.tempMult(s, now));
  };

  E.milestoneMult = function (lvl) {
    var m = 1;
    for (var i = 0; i < D.MILESTONES.length; i++) if (lvl >= D.MILESTONES[i]) m *= 2;
    return m;
  };

  E.nextMilestone = function (lvl) {
    for (var i = 0; i < D.MILESTONES.length; i++) if (lvl < D.MILESTONES[i]) return D.MILESTONES[i];
    return null;
  };

  E.eventMult = function (s, id, now) {
    var m = 1;
    s.events.forEach(function (ev) { if (ev.biz === id && ev.until > now) m *= ev.mult; });
    return m;
  };

  E.bizRevenue = function (s, id, now, noTemp) {
    var b = BIZ[id], st = s.biz[id];
    if (!st || st.lvl <= 0) return 0;
    return b.rev * st.lvl * E.milestoneMult(st.lvl) *
      (1 + D.EMP_BONUS * st.emp) *
      (1 + 0.1 * E.skill(s, 'carisma')) *
      E.globalMult(s, now, noTemp) *
      (noTemp ? 1 : E.eventMult(s, id, now));
  };

  E.bizTime = function (s, id) {
    return BIZ[id].t / ((1 + 0.06 * E.skill(s, 'tempo')) * (1 + E.luxBonus(s, 'speed')));
  };

  E.bizIncome = function (s, id, now, noTemp) {
    return E.bizRevenue(s, id, now, noTemp) / E.bizTime(s, id);
  };

  // Salário dos funcionários (só é pago enquanto o negócio produz)
  E.bizUpkeep = function (s, id) {
    var b = BIZ[id], st = s.biz[id];
    if (!st || st.lvl <= 0 || st.emp <= 0) return 0;
    return D.EMP_UPKEEP * st.emp * b.rev * st.lvl / b.t;
  };

  E.costDiscount = function (s) { return 1 - 0.03 * E.skill(s, 'negocia'); };

  // Custo para comprar k níveis a partir do nível atual: base * r^n * (r^k - 1)/(r - 1)
  E.bizCost = function (s, id, k) {
    var b = BIZ[id], lvl = s.biz[id] ? s.biz[id].lvl : 0;
    return b.cost * Math.pow(b.r, lvl) * (Math.pow(b.r, k) - 1) / (b.r - 1) * E.costDiscount(s);
  };

  E.bizMaxBuy = function (s, id, cash) {
    var b = BIZ[id], lvl = s.biz[id] ? s.biz[id].lvl : 0;
    var first = b.cost * Math.pow(b.r, lvl) * E.costDiscount(s);
    if (!(cash >= first) || !isFinite(first)) return 0;
    var k = Math.floor(Math.log(cash * (b.r - 1) / first + 1) / Math.log(b.r));
    return isFinite(k) ? Math.min(k, D.MAX_BUY_PER_TAP, D.MAX_BIZ_LVL - lvl) : D.MAX_BUY_PER_TAP;
  };

  E.empCost = function (s, id) {
    var b = BIZ[id], e = s.biz[id] ? s.biz[id].emp : 0;
    return b.cost * 10 * Math.pow(2.6, e);
  };

  E.skillCost = function (s, id) {
    var k = SKILL[id];
    return k.cost * Math.pow(k.g, E.skill(s, id));
  };

  E.propCost = function (s, id) {
    var p = PROP[id];
    return p.cost * Math.pow(p.g, s.props[id] || 0);
  };

  E.salary = function (s) {
    var t = 0;
    for (var i = 0; i < s.jobs; i++) t += D.JOBS[i].sal;
    return t * E.starMult(s);
  };

  E.rentGross = function (s) {
    var t = 0;
    D.PROPS.forEach(function (p) { t += (s.props[p.id] || 0) * p.rent; });
    return t * (1 + E.luxBonus(s, 'rent')) * E.starMult(s);
  };

  E.rentUpkeep = function (s) { return E.rentGross(s) * D.PROP_UPKEEP; };

  /* Detalhamento da renda passiva (automatizada) por segundo. Base do painel de finanças e dos ganhos offline.
   * Salários de funcionários são pagos a cada ciclo concluído, descontados da receita daquele ciclo
   * (ver G.tick); por segundo isso equivale a bizUpkeep. Negócios sem gerente não entram no fluxo contínuo:
   * só rendem quando o jogador toca — aparecem em `manual` (ciclos em andamento agora). */
  E.breakdown = function (s, now, noTemp) {
    var biz = 0, emp = 0, manual = { running: 0, idle: 0, net: 0 };
    D.BUSINESSES.forEach(function (b) {
      var st = s.biz[b.id];
      if (!st || st.lvl <= 0) return;
      if (st.mgr) {
        biz += E.bizIncome(s, b.id, now, noTemp);
        emp += E.bizUpkeep(s, b.id);
      } else if (st.running) {
        manual.running++;
        manual.net += E.bizCycleNet(s, b.id, now, noTemp);
      } else manual.idle++;
    });
    var sal = E.salary(s), rent = E.rentGross(s), rentUp = E.rentUpkeep(s);
    return {
      biz: biz, salary: sal, rent: rent,
      empUpkeep: emp, rentUpkeep: rentUp,
      income: biz + sal + rent,
      expenses: emp + rentUp,
      net: biz + sal + rent - emp - rentUp,
      manual: manual
    };
  };

  // Valor líquido de um ciclo (receita − salários do ciclo). Sempre positivo: a receita por ciclo é
  // ≥ 0,5 × rev × nível × (1 + 0,5 × func.) e os salários do ciclo são ≤ 0,08 × func. × rev × nível.
  E.bizCycleWages = function (s, id) { return E.bizUpkeep(s, id) * E.bizTime(s, id); };
  E.bizCycleNet = function (s, id, now, noTemp) {
    return Math.max(0, E.bizRevenue(s, id, now, noTemp) - E.bizCycleWages(s, id));
  };

  E.passiveIncome = function (s, now, noTemp) { return Math.max(0, E.breakdown(s, now, noTemp).net); };

  E.tapValue = function (s, now) {
    var flat = 1;
    for (var i = 0; i < s.jobs; i++) flat += D.JOBS[i].tap;
    var v = flat * (1 + 0.5 * E.skill(s, 'toque')) * (1 + E.luxBonus(s, 'tap')) *
      E.starMult(s) * E.tempMult(s, now);
    return v + E.passiveIncome(s, now) * 0.02 * E.skill(s, 'smart');
  };

  E.offlineCapHours = function (s) {
    return D.OFFLINE_BASE_H + E.skill(s, 'offline') + E.luxBonus(s, 'offline');
  };

  E.portfolioValue = function (s) {
    var t = 0;
    for (var id in s.hold) if (s.hold[id].qty > 0 && s.mkt[id]) t += s.hold[id].qty * s.mkt[id].p;
    return t;
  };

  E.netWorth = function (s) {
    var props = 0, lux = 0, biz = 0;
    D.PROPS.forEach(function (p) {
      var n = s.props[p.id] || 0;
      if (n > 0) props += p.cost * (Math.pow(p.g, n) - 1) / (p.g - 1) * 0.8;
    });
    for (var id in s.lux) if (s.lux[id] && LUX[id]) lux += LUX[id].cost * 0.7;
    D.BUSINESSES.forEach(function (b) {
      var st = s.biz[b.id];
      if (st && st.lvl > 0) biz += b.cost * (Math.pow(b.r, st.lvl) - 1) / (b.r - 1) * 0.5;
    });
    return s.cash + E.portfolioValue(s) + props + lux + biz;
  };

  E.potentialStars = function (s) {
    return Math.max(0, Math.floor(Math.sqrt(s.lifetimeEarned / D.STAR_DIVISOR)) - s.starsClaimed);
  };

  E.ownedCount = function (s) {
    return D.BUSINESSES.filter(function (b) { return s.biz[b.id] && s.biz[b.id].lvl > 0; }).length;
  };
  E.mgrCount = function (s) {
    return D.BUSINESSES.filter(function (b) { return s.biz[b.id] && s.biz[b.id].mgr; }).length;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = E;
  else root.E = E;
})(this);
