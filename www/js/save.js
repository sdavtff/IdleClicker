/* Validação, migração e (de)codificação de saves.
 * Nunca confia no conteúdo salvo/importado: cada campo é lido com tipo, faixa e valor padrão seguros.
 * Chaves desconhecidas são descartadas (evita poluição de protótipo e lixo no estado). */
(function (root) {
  'use strict';
  var isNode = typeof module !== 'undefined' && module.exports;
  var D = isNode ? require('./data.js') : root.D;
  var M = isNode ? require('./market.js') : root.M;

  var BIG = 1e300;              // teto para valores monetários (bem abaixo de Number.MAX_VALUE)
  var MAX_IMPORT_CHARS = 400000; // saves reais têm ~20 KB
  var EXPORT_PREFIX = 'CIF1:';

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return isObj(o) && Object.prototype.hasOwnProperty.call(o, k); }
  function get(o, k) { return has(o, k) ? o[k] : undefined; }

  // número finito dentro de [min, max]; senão, o padrão
  function num(v, def, min, max) {
    if (typeof v === 'string' && v.trim() !== '') v = Number(v);
    if (typeof v !== 'number' || !isFinite(v)) return def;
    return Math.min(max, Math.max(min, v));
  }
  function int(v, def, min, max) {
    var n = num(v, def, min, max);
    return n === def ? def : Math.floor(n);
  }
  function bool(v, def) { return typeof v === 'boolean' ? v : def; }
  function str(v, def, maxLen) {
    if (typeof v !== 'string') return def;
    return v.replace(/[<>]/g, '').slice(0, maxLen);
  }

  var S = { BIG: BIG, MAX_IMPORT_CHARS: MAX_IMPORT_CHARS, EXPORT_PREFIX: EXPORT_PREFIX, num: num, int: int };

  /* Migrações: cada função recebe o objeto bruto da versão N e devolve o da versão N+1.
   * v1 → v2: surgem clockMax, conquistas, missões diárias e novas opções de acessibilidade
   * (todos com padrão seguro no sanitize, então nada precisa ser convertido). */
  var MIGRATIONS = {
    1: function (raw) { return raw; },
    // v2 → v3 (2.0.0): novas empresas, melhorias, reformas, mérito, império, desafios e corrida —
    // tudo com padrão seguro no sanitize; o presente de atualização é calculado lá (fromVersion < 3).
    2: function (raw) { return raw; }
  };

  S.migrate = function (raw, v) {
    while (v < D.SAVE_VERSION) {
      if (MIGRATIONS[v]) raw = MIGRATIONS[v](raw);
      v++;
    }
    return raw;
  };

  /* Constrói um estado limpo a partir de dados não confiáveis.
   * fresh: estado padrão (G.newState()); now: horário atual.
   * Lança Error com mensagem em PT-BR se o formato for inaceitável. */
  S.sanitize = function (raw, fresh, now) {
    if (!isObj(raw)) throw new Error('O save não é um objeto válido.');
    if (!isObj(raw.biz)) throw new Error('O save não contém dados de negócios.');
    var v = int(raw.v, 1, 0, 1e9);
    if (v > D.SAVE_VERSION) throw new Error('Este save é de uma versão mais nova do jogo (v' + v + ').');
    var fromVersion = Math.max(1, v);
    raw = S.migrate(raw, fromVersion);
    var s = fresh;

    s.cash = num(raw.cash, 0, 0, BIG);
    s.runEarned = num(raw.runEarned, 0, 0, BIG);
    s.lifetimeEarned = Math.max(s.runEarned, num(raw.lifetimeEarned, 0, 0, BIG));
    // estrelas nunca podem passar do que o faturamento total permite
    var maxStars = Math.floor(Math.sqrt(s.lifetimeEarned / D.STAR_DIVISOR));
    s.starsClaimed = int(raw.starsClaimed, 0, 0, maxStars);
    s.stars = int(raw.stars, 0, 0, s.starsClaimed);
    s.prestiges = int(raw.prestiges, 0, 0, 1e6);

    D.BUSINESSES.forEach(function (b) {
      var o = get(raw.biz, b.id);
      if (!isObj(o)) return;
      var lvl = int(o.lvl, 0, 0, D.MAX_BIZ_LVL);
      s.biz[b.id] = {
        lvl: lvl,
        emp: lvl > 0 ? int(o.emp, 0, 0, D.EMP_MAX) : 0,
        mgr: lvl > 0 && bool(o.mgr, false),
        prog: num(o.prog, 0, 0, 0.999),
        running: lvl > 0 && bool(o.running, false),
        up: lvl > 0 ? int(o.up, 0, 0, D.BIZ_UPGRADES.length) : 0,
        runs: num(o.runs, 0, 0, BIG),
        earned: num(o.earned, 0, 0, BIG),
        wages: num(o.wages, 0, 0, BIG)
      };
    });
    s.jobs = int(raw.jobs, 0, 0, D.JOBS.length);
    D.SKILLS.forEach(function (k) {
      var lv = int(get(raw.skills, k.id), 0, 0, k.max);
      if (lv > 0) s.skills[k.id] = lv;
    });
    D.PROPS.forEach(function (p) {
      var n = int(get(raw.props, p.id), 0, 0, 1e5);
      if (n > 0) s.props[p.id] = n;
    });
    D.LUXURY.forEach(function (l) { if (get(raw.lux, l.id) === true) s.lux[l.id] = true; });

    // bolsa
    M.ASSETS.forEach(function (a) {
      var m = get(raw.mkt, a.id), def = s.mkt[a.id];
      if (isObj(m)) {
        var hist = Array.isArray(m.hist) ? m.hist.filter(function (x) { return typeof x === 'number' && isFinite(x) && x > 0; }).slice(-M.HIST_LEN) : [];
        var p = num(m.p, a.p, a.p * 0.001, a.p * 1e4);
        s.mkt[a.id] = {
          p: p,
          anchor: num(m.anchor, a.p, a.p * 0.01, a.p * 1e3),
          x: num(m.x, 0, -10, 10),
          hist: hist.length ? hist : [p],
          n: int(m.n, 0, 0, 1e12)
        };
      } else s.mkt[a.id] = def;
      var h = get(raw.hold, a.id);
      if (isObj(h)) {
        var q = int(h.qty, 0, 0, 1e15);
        if (q > 0) s.hold[a.id] = { qty: q, avg: num(h.avg, 0, 0, BIG) };
      }
    });
    s.mktAcc = num(raw.mktAcc, 0, 0, 0.999);

    // eventos ativos (só os de negócios e tipos conhecidos, com duração limitada)
    var EV = { promo: [1.5, 3], viral: [2, 2], crise: [0.5, 0.5], rival: [0.7, 0.7] };
    s.events = (Array.isArray(raw.events) ? raw.events : []).slice(0, 10).filter(function (e) {
      return isObj(e) && EV[e.type] && s.biz[e.biz] && s.biz[e.biz].lvl > 0;
    }).map(function (e) {
      var ev = {
        id: str(e.id, String(now), 40), biz: e.biz, type: e.type,
        mult: num(e.mult, EV[e.type][1], EV[e.type][0], EV[e.type][1]),
        until: num(e.until, 0, 0, now + 3 * 60000)
      };
      if (e.type === 'crise' || e.type === 'rival') ev.cost = num(e.cost, 50, 0, BIG);
      return ev;
    });
    s.nextEventAt = num(raw.nextEventAt, s.nextEventAt, 0, now + 10 * 60000);
    s.nextNewsAt = num(raw.nextNewsAt, s.nextNewsAt, 0, now + 10 * 60000);
    s.news = (Array.isArray(raw.news) ? raw.news : []).slice(0, 8).filter(function (n) {
      return isObj(n) && M.BY_ID[n.id] && typeof n.txt === 'string';
    }).map(function (n) {
      return { t: num(n.t, now, 0, now), txt: str(n.txt, '', 140), up: bool(n.up, true), id: n.id };
    });

    var b = raw.boost;
    s.boost = {
      adUntil: num(get(b, 'adUntil'), 0, 0, now + D.AD_BOOST_MAX_H * 3600000),
      tourUntil: num(get(b, 'tourUntil'), 0, 0, now + 6 * 3600000),
      quickAt: num(get(b, 'quickAt'), 0, 0, now + D.QUICK_CASH_CD * 1000),
      turboAt: num(get(b, 'turboAt'), 0, 0, now + (D.AD_BOOST_MAX_H * 60 + D.FREE_BOOST_CD_MIN) * 60000)
    };

    var t = raw.tour;
    s.tour = {
      week: has(t, 'week') && t.week !== null ? int(t.week, null, 0, 1e7) : null,
      score: num(get(t, 'score'), 0, -BIG, BIG),
      base: num(get(t, 'base'), 1000, 1000, BIG),
      pending: null,
      best: has(t, 'best') && t.best !== null ? int(t.best, null, 1, D.TOUR_BOTS.length + 1) : null
    };
    var p = get(t, 'pending');
    if (isObj(p)) s.tour.pending = { rank: int(p.rank, 10, 1, D.TOUR_BOTS.length + 1), week: int(p.week, 0, 0, 1e7), score: num(p.score, 0, -BIG, BIG) };

    ['short', 'mid', 'long'].forEach(function (k) { s.goals[k] = int(get(raw.goals, k), 0, 0, 1e4); });
    Object.keys(s.stats).forEach(function (k) {
      s.stats[k] = num(get(raw.stats, k), 0, k === 'tradeProfit' ? -BIG : 0, BIG);
    });
    Object.keys(s.settings).forEach(function (k) { s.settings[k] = bool(get(raw.settings, k), s.settings[k]); });
    s.noAds = bool(raw.noAds, false);
    s.tutorial = int(raw.tutorial, 0, -1, 20);

    // desbloqueios: saves antigos que já passaram do limite ganham a aba direto (sem perder acesso)
    Object.keys(D.UNLOCKS).forEach(function (k) {
      s.unlocks[k] = get(raw.unlocks, k) === true || s.lifetimeEarned >= D.UNLOCKS[k] || s.prestiges > 0;
    });
    // ----- v2.0 -----
    D.PROPS.forEach(function (p) {
      var r = int(get(raw.reno, p.id), 0, 0, D.RENO_MAX);
      if (r > 0 && s.props[p.id] > 0) s.reno[p.id] = r;
    });
    var mr = raw.merit;
    s.merit = {
      bal: int(get(mr, 'bal'), 0, 0, 1e9),
      earned: int(get(mr, 'earned'), 0, 0, 1e9),
      spent: int(get(mr, 'spent'), 0, 0, 1e9),
      items: {}
    };
    D.MERIT_SHOP.forEach(function (m) {
      var l = int(get(get(mr, 'items'), m.id), 0, 0, m.max);
      if (l > 0) s.merit.items[m.id] = l;
    });
    s.merit.earned = Math.max(s.merit.earned, s.merit.bal);
    var empLvl = s.lifetimeEarned >= 10 ? Math.floor(Math.log10(s.lifetimeEarned) / D.EMPIRE_STEP) : 0;
    s.empire = { claimed: int(get(raw.empire, 'claimed'), empLvl, 0, empLvl) };
    var wk = raw.weekly;
    if (isObj(wk) && Array.isArray(wk.list)) {
      var wlist = wk.list.slice(0, 3).filter(function (m) { return isObj(m) && D.WEEKLY_BY_ID[m.id]; }).map(function (m) {
        return { id: m.id, target: num(m.target, 1, 1, BIG), base: num(m.base, 0, -BIG, BIG), claimed: bool(m.claimed, false), reward: num(m.reward, 0, 0, BIG) };
      });
      if (wlist.length) s.weekly = { week: int(wk.week, 0, 0, 1e7), list: wlist, bonus: bool(wk.bonus, false) };
    }
    var rc = raw.race;
    s.race = {
      week: has(rc, 'week') && rc.week !== null ? int(rc.week, null, 0, 1e7) : null,
      start: num(get(rc, 'start'), 0, 0, BIG),
      base: num(get(rc, 'base'), 5000, 5000, BIG),
      pending: null,
      best: has(rc, 'best') && rc.best !== null ? int(rc.best, null, 1, D.RACE_BOTS.length + 1) : null
    };
    var rp = get(rc, 'pending');
    if (isObj(rp)) s.race.pending = { rank: int(rp.rank, 10, 1, D.RACE_BOTS.length + 1), week: int(rp.week, 0, 0, 1e7), score: num(rp.score, 0, 0, BIG) };
    s.nwHist = (Array.isArray(raw.nwHist) ? raw.nwHist : []).slice(-120).filter(function (x) {
      return isObj(x) && typeof x.v === 'number' && isFinite(x.v) && x.v >= 0 && typeof x.t === 'number' && isFinite(x.t);
    }).map(function (x) { return { t: Math.min(x.t, now), v: Math.min(x.v, BIG) }; });

    // conquistas: só ids conhecidos
    D.ACHIEVEMENTS.forEach(function (a) { if (get(raw.ach, a.id) === true) s.ach[a.id] = true; });
    // missões diárias: dia + progresso numérico por missão conhecida
    var dl = raw.daily;
    if (isObj(dl) && Array.isArray(dl.list)) {
      var day = int(dl.day, 0, 0, 99991231);
      var list = dl.list.slice(0, 3).filter(function (m) { return isObj(m) && D.DAILY_BY_ID[m.id]; }).map(function (m) {
        return {
          id: m.id,
          target: num(m.target, 1, 1, BIG),
          base: num(m.base, 0, -BIG, BIG),
          reward: num(m.reward, 0, 0, BIG),
          done: bool(m.done, false),
          claimed: bool(m.claimed, false)
        };
      });
      if (list.length === 3) s.daily = { day: day, list: list, bonus: bool(dl.bonus, false), streak: int(dl.streak, 0, 0, 1e5) };
    }

    // Presente de atualização para saves anteriores à 2.0: 1 medalha por conquista + 2 por nível do império
    // (sem notificações em massa: o nível do império já alcançado é marcado como resgatado).
    if (fromVersion < 3) {
      var gift = Math.min(120, Object.keys(s.ach).length + 2 * empLvl);
      s.merit.bal += gift; s.merit.earned += gift;
      s.empire.claimed = empLvl;
      s.upgradeGift = gift;
    }
    s.stats.meritEarned = s.merit.earned;

    s.created = num(raw.created, now, 0, now);
    s.lastSeen = num(raw.lastSeen, now, 0, BIG);
    s.clockMax = Math.max(s.lastSeen, num(raw.clockMax, 0, 0, BIG));
    s.v = D.SAVE_VERSION;
    return s;
  };

  // Codificação do backup em texto (Base64 de UTF-8) com prefixo de identificação.
  function b64encode(txt) {
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(txt)));
    return Buffer.from(txt, 'utf8').toString('base64');
  }
  function b64decode(b) {
    if (typeof atob === 'function') return decodeURIComponent(escape(atob(b)));
    return Buffer.from(b, 'base64').toString('utf8');
  }
  S.encode = function (state) { return EXPORT_PREFIX + b64encode(JSON.stringify(state)); };

  // Decodifica texto de backup → objeto bruto (ainda NÃO validado). Lança Error com mensagem amigável.
  S.decode = function (text) {
    if (typeof text !== 'string') throw new Error('Código vazio.');
    text = text.trim();
    if (!text) throw new Error('Cole um código de save primeiro.');
    if (text.length > MAX_IMPORT_CHARS) throw new Error('Código grande demais para ser um save.');
    if (text.indexOf(EXPORT_PREFIX) === 0) text = text.slice(EXPORT_PREFIX.length);
    var json;
    try { json = b64decode(text.replace(/\s+/g, '')); } catch (e) { throw new Error('O código não está em um formato reconhecido.'); }
    try { return JSON.parse(json); } catch (e) { throw new Error('O código está corrompido (JSON inválido).'); }
  };

  if (isNode) module.exports = S;
  else root.SaveIO = S;
})(this);
