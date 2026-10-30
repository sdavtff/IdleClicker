/* Fórmulas de economia (funções puras sobre o estado). Usadas pelo jogo e pelo simulador de balanceamento. */
(function (root) {
  'use strict';
  var D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.D;
  var E = {};

  var BIZ = {}; D.BUSINESSES.forEach(function (b) { BIZ[b.id] = b; });
  var LUX = {}; D.LUXURY.forEach(function (l) { LUX[l.id] = l; });
  var PROP = {}; D.PROPS.forEach(function (p) { PROP[p.id] = p; });
  var SKILL = {}; D.SKILLS.forEach(function (s) { SKILL[s.id] = s; });
  var MERIT = {}; D.MERIT_SHOP.forEach(function (m) { MERIT[m.id] = m; });
  var STOCK = {}; D.STOCKS.forEach(function (a) { STOCK[a.id] = a; });
  E.BIZ = BIZ; E.LUX = LUX; E.PROP = PROP; E.SKILL = SKILL; E.MERIT = MERIT; E.STOCK = STOCK;

  // ---------- v2.0: meta-progressão ----------
  E.meritLvl = function (s, id) { return (s.merit && s.merit.items[id]) || 0; };

  // Patente de Legado (índice em D.LEGACY_RANKS) pelas estrelas recebidas
  E.legacyRank = function (s) {
    var r = 0;
    for (var i = 0; i < D.LEGACY_RANKS.length; i++) if (s.stars >= D.LEGACY_RANKS[i].stars) r = i;
    return r;
  };
  E.hasRank = function (s, name) {
    var i = D.LEGACY_RANKS.findIndex(function (x) { return x.name === name; });
    return i >= 0 && E.legacyRank(s) >= i;
  };

  // Nível do império: floor(log10(faturamento total) / 0,5) — sobe a cada meia ordem de grandeza
  E.empireLevel = function (s) {
    return s.lifetimeEarned >= 10 ? Math.floor(Math.log10(s.lifetimeEarned) / D.EMPIRE_STEP) : 0;
  };
  E.empireNextAt = function (lvl) { return Math.pow(10, (lvl + 1) * D.EMPIRE_STEP); };

  // Evento de setor ativo: rodízio fixo a cada D.SECTOR_EVENT_DAYS dias (pela data local)
  E.sectorEventAt = function (now) {
    var d = new Date(now);
    var days = Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
    var block = Math.floor(days / D.SECTOR_EVENT_DAYS);
    var ev = D.SECTOR_EVENTS[((block % D.SECTOR_EVENTS.length) + D.SECTOR_EVENTS.length) % D.SECTOR_EVENTS.length];
    var endDay = (block + 1) * D.SECTOR_EVENT_DAYS;
    var endLocal = new Date(endDay * 86400000);
    var ends = new Date(endLocal.getUTCFullYear(), endLocal.getUTCMonth(), endLocal.getUTCDate()).getTime();
    return { ev: ev, ends: ends };
  };
  E.sectorMult = function (id, now) {
    var ev = E.sectorEventAt(now).ev;
    return ev.cats.indexOf(BIZ[id].cat) >= 0 ? ev.mult : 1;
  };

  // Melhorias de empresa compradas (st.up = quantas, em sequência)
  E.upgCount = function (s) {
    return D.BUSINESSES.reduce(function (a, b) { return a + ((s.biz[b.id] && s.biz[b.id].up) || 0); }, 0);
  };
  E.upgMult = function (s, id) {
    var n = (s.biz[id] && s.biz[id].up) || 0, m = 1;
    for (var i = 0; i < n; i++) if (D.BIZ_UPGRADES[i].mult) m *= D.BIZ_UPGRADES[i].mult;
    return m;
  };
  E.upgSpeed = function (s, id) {
    var n = (s.biz[id] && s.biz[id].up) || 0, m = 1;
    for (var i = 0; i < n; i++) if (D.BIZ_UPGRADES[i].speed) m *= D.BIZ_UPGRADES[i].speed;
    return m;
  };
  E.upgCost = function (s, id, i) { return BIZ[id].cost * D.BIZ_UPGRADES[i].costMul * E.costDiscount(s); };

  // Eficiência: patamares de ciclos concluídos → +5% de receita cada
  E.effLevel = function (s, id) {
    var runs = (s.biz[id] && s.biz[id].runs) || 0, l = 0;
    for (var i = 0; i < D.EFFICIENCY.length; i++) if (runs >= D.EFFICIENCY[i]) l = i + 1;
    return l;
  };
  E.effMult = function (s, id) { return 1 + D.EFF_BONUS * E.effLevel(s, id); };

  E.mgrCost = function (s, id) {
    return BIZ[id].mgr * (1 - 0.15 * E.meritLvl(s, 'mmgr')) * (E.hasRank(s, 'Duque') ? 0.75 : 1);
  };

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
      (1 + 0.05 * E.meritLvl(s, 'minc')) * (E.hasRank(s, 'Lenda Eterna') ? 1.25 : 1) *
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
    // eventos de setor duram dias e valem também offline; eventos aleatórios (minutos) e turbos não
    return b.rev * st.lvl * E.milestoneMult(st.lvl) *
      (1 + D.EMP_BONUS * st.emp) *
      (1 + 0.1 * E.skill(s, 'carisma')) *
      E.upgMult(s, id) * E.effMult(s, id) * E.sectorMult(id, now) *
      E.globalMult(s, now, noTemp) *
      (noTemp ? 1 : E.eventMult(s, id, now));
  };

  E.bizTime = function (s, id) {
    return BIZ[id].t / ((1 + 0.06 * E.skill(s, 'tempo')) * (1 + E.luxBonus(s, 'speed')) * E.upgSpeed(s, id));
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

  // Funcionário n (0-based). Custo = o MENOR entre:
  //   (a) fórmula original: 10 × preço-base × 2,6^n  — barata no início do jogo;
  //   (b) renda-base do negócio no nível atual × EMP_COST_SEC × EMP_COST_GROWTH^n (piso: preço-base)
  //       — mantém o retorno alcançável em negócios caros/avançados, onde (a) chegava a meses ou anos.
  // Renda-base = sem multiplicadores globais, para o preço não variar com turbos, estrelas ou eventos.
  // Nenhum funcionário ficou mais caro do que na v1.1.0.
  E.empCost = function (s, id) {
    var b = BIZ[id], st = s.biz[id], lvl = st ? st.lvl : 0, e = st ? st.emp : 0;
    var classic = b.cost * 10 * Math.pow(2.6, e);
    var baseIncome = b.rev * lvl * E.milestoneMult(lvl) / b.t;
    var scaled = Math.max(b.cost, baseIncome * D.EMP_COST_SEC) * Math.pow(D.EMP_COST_GROWTH, e);
    return Math.min(classic, scaled);
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

  E.renoLvl = function (s, id) { return (s.reno && s.reno[id]) || 0; };
  E.renoCost = function (s, id) { return PROP[id].cost * D.RENO_COST_MUL * Math.pow(D.RENO_GROWTH, E.renoLvl(s, id)); };
  // Aluguel de UMA unidade do imóvel (com reformas, luxo e estrelas)
  E.propRent = function (s, id) {
    return PROP[id].rent * (1 + D.RENO_BONUS * E.renoLvl(s, id)) * (1 + E.luxBonus(s, 'rent')) * E.starMult(s);
  };
  E.rentGross = function (s) {
    var t = 0;
    D.PROPS.forEach(function (p) { var n = s.props[p.id] || 0; if (n) t += n * E.propRent(s, p.id); });
    return t;
  };

  // Dividendos por segundo das ações em carteira: qtd × preço × rendimento/h ÷ 3600 (× estrelas)
  E.dividendRate = function (s) {
    var t = 0;
    for (var id in s.hold) {
      var a = STOCK[id], h = s.hold[id];
      if (a && a.div && h.qty > 0 && s.mkt[id]) t += h.qty * s.mkt[id].p * a.div / 3600;
    }
    return t;
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
    var sal = E.salary(s), rent = E.rentGross(s), rentUp = E.rentUpkeep(s), div = E.dividendRate(s);
    return {
      biz: biz, salary: sal, rent: rent, div: div,
      empUpkeep: emp, rentUpkeep: rentUp,
      income: biz + sal + rent + div,
      expenses: emp + rentUp,
      net: biz + sal + rent + div - emp - rentUp,
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
    var v = flat * (1 + 0.5 * E.skill(s, 'toque')) * (1 + E.luxBonus(s, 'tap')) * (1 + 0.25 * E.meritLvl(s, 'mtap')) *
      E.starMult(s) * E.tempMult(s, now);
    return v + E.passiveIncome(s, now) * 0.02 * E.skill(s, 'smart');
  };

  E.offlineCapHours = function (s) {
    return D.OFFLINE_BASE_H + E.skill(s, 'offline') + E.luxBonus(s, 'offline') +
      2 * E.meritLvl(s, 'moff') + (E.hasRank(s, 'Conde') ? 2 : 0);
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
      if (st && st.lvl > 0) {
        var v = b.cost * (Math.pow(b.r, st.lvl) - 1) / (b.r - 1);
        for (var i = 0; i < (st.up || 0); i++) v += b.cost * D.BIZ_UPGRADES[i].costMul;
        biz += Math.min(v, 1e300) * 0.5;
      }
    });
    D.PROPS.forEach(function (p) {
      var r = E.renoLvl(s, p.id);
      if (r > 0) props += p.cost * D.RENO_COST_MUL * (Math.pow(D.RENO_GROWTH, r) - 1) / (D.RENO_GROWTH - 1) * 0.5;
    });
    return Math.min(1e300, s.cash + E.portfolioValue(s) + props + lux + biz);
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
