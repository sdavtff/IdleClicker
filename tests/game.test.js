/* Testes de regras do jogo (Node, sem dependências): node --test tests/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const js = (f) => path.join(__dirname, '..', 'www', 'js', f);
const F = require(js('fmt.js'));
const D = require(js('data.js'));
const E = require(js('economy.js'));
const M = require(js('market.js'));
const S = require(js('save.js'));
const G = require(js('game.js'));
require(js('meta.js'));

// ---------- ambiente controlado ----------
let clock;
function memStorage() {
  const m = {};
  return {
    data: m,
    getItem: (k) => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: (k) => { delete m[k]; }
  };
}
function fresh(opts = {}) {
  clock = Date.UTC(2026, 9, 28, 15, 0, 0);
  let seed = 42;
  G.rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  G.now = () => clock;
  G.storage = memStorage();
  G.s = G.newState();
  G.options.randomEvents = !!opts.events; // eventos aleatórios desligados nos testes determinísticos
  if (opts.cash) G.s.cash = opts.cash;
  return G.s;
}
// desliga prêmios de metas/conquistas/missões para medir só a economia base
function noRewards(s) {
  s.goals = { short: 1e4, mid: 1e4, long: 1e4 };
  D.ACHIEVEMENTS.forEach((a) => { s.ach[a.id] = true; });
  s.daily = { day: 99999999, list: [], bonus: true, streak: 0 };
}
function advance(sec, step = 0.25) {
  for (let t = 0; t < sec; t += step) { clock += step * 1000; G.tick(step); }
}
const close = (a, b, rel = 1e-9) => assert.ok(Math.abs(a - b) <= Math.abs(b) * rel + 1e-9, `${a} ≈ ${b}`);

// ---------- formatação ----------
test('formata números grandes em PT-BR', () => {
  assert.equal(F.num(0), '0');
  assert.equal(F.num(999), '999');
  assert.equal(F.num(1500), '1,50 K');
  assert.equal(F.num(999999), '1,00 M'); // arredondamento não gera "1000 K"
  assert.equal(F.num(2.5e9), '2,50 B');
  assert.equal(F.num(1e33), '1,00 Dc');
  assert.equal(F.num(1e36), '1,00 aa');
  assert.equal(F.num(-1500), '-1,50 K');
  assert.equal(F.num(NaN), '0');
  assert.equal(F.num(Infinity), '∞');
  assert.equal(F.money(1234.5), '$1,23 K');
  assert.equal(F.money(-50), '-$50');
  assert.equal(F.money(3.25, true), '$3,25');
  assert.equal(F.time(59), '59s');
  assert.equal(F.time(3725), '1h 02m');
  assert.equal(F.time(90000), '1d 1h');
  assert.equal(F.pct(0.123), '+12,3%');
});

// ---------- economia ----------
test('custo de k níveis bate com a soma nível a nível', () => {
  const s = fresh();
  s.biz.suco.lvl = 7;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += 10 * Math.pow(1.15, 7 + i);
  close(E.bizCost(s, 'suco', 12), sum, 1e-12);
});

test('máximo comprável: cabe k e não cabe k+1', () => {
  const s = fresh();
  for (const cash of [9, 10, 55, 1e4, 3.3e7]) {
    s.cash = cash;
    const k = E.bizMaxBuy(s, 'burger', cash);
    if (k > 0) assert.ok(E.bizCost(s, 'burger', k) <= cash * (1 + 1e-12));
    assert.ok(E.bizCost(s, 'burger', k + 1) > cash);
  }
});

test('marcos dobram receita e desconto do Negociador reduz custo', () => {
  assert.equal(E.milestoneMult(24), 1);
  assert.equal(E.milestoneMult(25), 2);
  assert.equal(E.milestoneMult(100), 8);
  const s = fresh();
  const c0 = E.bizCost(s, 'suco', 1);
  s.skills.negocia = 2;
  close(E.bizCost(s, 'suco', 1), c0 * 0.94);
});

// ---------- compras ----------
test('compra sem dinheiro não altera nada; com dinheiro desconta o valor exato', () => {
  const s = fresh({ cash: 5 });
  assert.equal(G.buyBiz('suco', 1), false);
  assert.equal(s.cash, 5);
  assert.equal(s.biz.suco.lvl, 0);
  s.cash = 100;
  const cost = E.bizCost(s, 'suco', 3);
  assert.equal(G.buyBiz('suco', 3), true);
  close(s.cash, 100 - cost);
  assert.equal(s.biz.suco.lvl, 3);
  assert.equal(s.stats.bizLevels, 3);
});

test('IDs inexistentes e quantidades inválidas são recusados', () => {
  const s = fresh({ cash: 1e9 });
  assert.equal(G.buyBiz('nada', 1), false);
  assert.equal(G.buyBiz('suco', -5), false);
  assert.equal(G.buyBiz('suco', NaN), false);
  assert.equal(G.buySkill('hack'), false);
  assert.equal(G.buyLux('x'), false);
  assert.equal(G.buyProp('x'), false);
  assert.equal(G.buyAsset('XXX', 1), false);
  assert.equal(G.buyAsset('NXS', -3), false);
  assert.equal(s.cash, 1e9);
});

test('dinheiro infinito não gera NaN ao comprar o máximo', () => {
  const s = fresh();
  s.cash = Infinity;
  G.buyBiz('suco', 'max');
  assert.ok(Number.isFinite(s.cash) || s.cash === Infinity);
  assert.ok(!Number.isNaN(s.cash));
  assert.ok(s.biz.suco.lvl <= D.MAX_BIZ_LVL);
  G.earn(Infinity);
  assert.ok(!Number.isNaN(s.cash));
});

test('habilidades respeitam o nível máximo', () => {
  const s = fresh({ cash: 1e300 });
  for (let i = 0; i < 20; i++) G.buySkill('negocia');
  assert.equal(s.skills.negocia, 10);
  assert.equal(G.buySkill('negocia'), false);
});

test('emprego é sequencial e soma ao valor do toque', () => {
  const s = fresh({ cash: 25 });
  const before = E.tapValue(s, clock);
  assert.equal(G.buyJob(), true);
  assert.equal(s.jobs, 1);
  assert.equal(E.tapValue(s, clock), before + 1);
  assert.equal(G.buyJob(), false); // sem dinheiro para o próximo
});

// ---------- produção, funcionários e despesas ----------
test('produção manual paga um ciclo e para; gerente automatiza', () => {
  const s = fresh({ cash: 10 });
  noRewards(s);
  G.buyBiz('suco', 1);
  const rev = E.bizRevenue(s, 'suco', clock);
  const c0 = s.cash;
  advance(3);
  assert.equal(s.cash, c0, 'sem tocar, nada é produzido');
  G.runBiz('suco');
  advance(3);
  close(s.cash, c0 + rev);
  assert.equal(s.biz.suco.running, false);
  s.cash = 1e4;
  G.hireManager('suco');
  const c1 = s.cash;
  advance(15.2); // 10 ciclos de 1,5 s (margem para arredondamento)
  close(s.cash - c1, rev * 10, 1e-6);
});

test('funcionários: limite de 10, bônus de 50% e salário só durante a produção', () => {
  const s = fresh({ cash: 1e12 });
  noRewards(s);
  G.buyBiz('burger', 30);
  for (let i = 0; i < 15; i++) G.hireEmployee('burger');
  assert.equal(s.biz.burger.emp, 10);
  // parado (sem gerente e sem rodar): ninguém recebe
  const c0 = s.cash;
  advance(5);
  assert.equal(s.cash, c0);
  // com gerente: receita líquida positiva = receita − salários
  G.hireManager('burger');
  const b = E.breakdown(s, clock, true);
  assert.ok(b.empUpkeep > 0);
  assert.ok(b.net > 0);
});

test('painel de finanças (líquido/s) bate com o dinheiro realmente ganho', () => {
  const s = fresh({ cash: 1e9 });
  G.buyBiz('suco', 40); G.hireManager('suco');
  G.buyBiz('burger', 20); G.hireManager('burger');
  G.hireEmployee('burger'); G.hireEmployee('burger');
  G.buyJob(); G.buyJob();
  G.buyProp('kitnet'); G.buyProp('kitnet');
  noRewards(s);
  const rate = E.breakdown(s, clock, true).net;
  const c0 = s.cash;
  advance(120);
  close(s.cash - c0, rate * 120, 0.02); // ciclos discretos: até 2% de diferença em 2 min
});

test('saldo nunca fica negativo por despesas', () => {
  const s = fresh({ cash: 1e6 });
  G.buyBiz('pixel', 1); G.hireEmployee('pixel');
  s.cash = 0;
  G.runBiz('pixel');
  advance(5);
  assert.ok(s.cash >= 0);
});

// ---------- bolsa e torneio ----------
test('compra e venda de ações aplica corretagem e soma lucro ao torneio', () => {
  const s = fresh({ cash: 1e6 });
  G.checkTournament(clock);
  const p = s.mkt.NXS.p;
  G.buyAsset('NXS', 100);
  close(s.cash, 1e6 - p * 100 * (1 + D.TRADE_FEE));
  s.mkt.NXS.p = p * 2;
  const profit = G.sellAsset('NXS', 'max');
  close(profit, p * 2 * 100 * (1 - D.TRADE_FEE) - p * 100 * (1 + D.TRADE_FEE));
  close(s.tour.score, profit);
  assert.equal(s.hold.NXS, undefined);
  assert.equal(G.sellAsset('NXS', 1), false);
});

test('preços da bolsa ficam positivos e finitos em simulação longa', () => {
  const s = fresh();
  for (let i = 0; i < 200000; i++) M.step(s, G.rng);
  M.ASSETS.forEach((a) => {
    assert.ok(s.mkt[a.id].p > 0 && Number.isFinite(s.mkt[a.id].p), a.id);
    assert.ok(s.mkt[a.id].hist.length <= M.HIST_LEN);
  });
});

// ---------- ganhos offline ----------
function offlineSetup() {
  const s = fresh({ cash: 1e9 });
  G.buyBiz('suco', 30); G.hireManager('suco');
  G.buyProp('kitnet');
  G.touch(clock);
  return s;
}

test('offline: paga renda líquida × tempo e não paga duas vezes', () => {
  const s = offlineSetup();
  const rate = E.breakdown(s, clock, true).net;
  clock += 2 * 3600 * 1000;
  const off = G.computeOffline();
  close(off.amount, rate * 7200, 1e-9);
  assert.equal(off.capped, false);
  assert.equal(G.computeOffline(), null, 'segunda chamada não paga de novo');
});

test('offline: respeita o limite de horas', () => {
  const s = offlineSetup();
  const rate = E.breakdown(s, clock, true).net;
  clock += 30 * 3600 * 1000;
  const off = G.computeOffline();
  assert.equal(off.capped, true);
  close(off.amount, rate * E.offlineCapHours(s) * 3600, 1e-9);
});

test('offline: adiantar o relógio, coletar e voltar não rende de novo', () => {
  const s = offlineSetup();
  const real = clock;
  clock = real + 10 * 3600 * 1000; // adianta 10 h
  assert.ok(G.computeOffline().amount > 0);
  clock = real;                     // volta para a hora certa
  G.touch(clock);
  assert.equal(G.computeOffline(), null);
  assert.equal(G.clockBack, true);
  clock = real + 3600 * 1000;       // 1 h real depois: ainda antes do maior horário visto
  assert.equal(G.computeOffline(), null);
  clock = real + 11 * 3600 * 1000;  // passou 1 h do maior horário visto → paga só essa 1 h
  const off = G.computeOffline();
  close(off.secs, 3600, 1e-6);
});

test('offline: sem renda passiva não há prêmio e ausência curta é ignorada', () => {
  fresh();
  G.touch(clock);
  clock += 30 * 1000;
  assert.equal(G.computeOffline(), null);
  clock += 2 * 3600 * 1000;
  const off = G.computeOffline();
  assert.equal(off.amount, 0);
});

// ---------- Legado ----------
test('Legado: concede estrelas, zera a partida e mantém luxo e conquistas', () => {
  const s = fresh({ cash: 1e12 });
  G.buyBiz('suco', 10); G.buyLux('w1'); G.buyJob();
  s.ach.tap100 = true;
  s.lifetimeEarned = 1e10;
  const gain = E.potentialStars(s);
  assert.equal(gain, 10);
  assert.equal(G.prestige(), 10);
  const n = G.s;
  assert.equal(n.stars, 10);
  // 10 estrelas = patente Herdeiro: recomeça com $1 K e o emprego Panfleteiro
  assert.equal(n.cash, 1000);
  assert.equal(n.biz.suco.lvl, 0);
  assert.equal(n.jobs, 1);
  assert.equal(n.lux.w1, true);
  assert.equal(n.ach.tap100, true);
  assert.equal(E.potentialStars(n), 0);
  assert.equal(G.prestige(), 0, 'sem estrelas novas, nada acontece');
  close(E.starMult(n), 2);
});

// ---------- conquistas, missões e desbloqueios ----------
test('conquista concede +1% permanente', () => {
  const s = fresh({ cash: 10 });
  const m0 = E.globalMult(s, clock, true);
  for (let i = 0; i < 100; i++) G.tap();
  advance(0.5);
  assert.equal(s.ach.tap100, true);
  close(E.globalMult(s, clock, true), m0 * 1.01);
});

test('missões diárias: 3 por dia, progresso, resgate, baú e virada do dia', () => {
  const s = fresh({ cash: 0 });
  G.ensureDaily(clock);
  assert.equal(s.daily.list.length, 3);
  const day = s.daily.day;
  assert.equal(G.ensureDaily(clock), false, 'mesmo dia não regenera');
  assert.equal(G.claimDaily(0), 0, 'não resgata sem concluir');
  // força a conclusão de todas pelo estado de estatísticas
  s.daily.list.forEach((m) => {
    const d = D.DAILY_BY_ID[m.id];
    s.stats[d.stat === 'earned' ? 'prodEarned' : d.stat] += m.target;
  });
  const c0 = s.cash;
  [0, 1, 2].forEach((i) => assert.ok(G.claimDaily(i) > 0));
  assert.equal(G.claimDaily(0), 0, 'não resgata duas vezes');
  assert.ok(s.cash > c0);
  assert.ok(G.dailyBonusReady());
  assert.ok(G.claimDailyBonus() > 0);
  assert.equal(G.claimDailyBonus(), 0);
  assert.equal(s.stats.dailyDone, 1);
  // relógio atrasado não gera dia novo
  assert.equal(G.ensureDaily(clock - 3 * 86400000), false);
  // dia seguinte: novas missões e sequência mantida
  clock += 86400000;
  assert.equal(G.ensureDaily(clock), true);
  assert.notEqual(s.daily.day, day);
  assert.equal(s.daily.streak, 1);
});

test('abas desbloqueiam pelo faturamento total', () => {
  const s = fresh();
  assert.equal(G.isUnlocked('inv'), false);
  s.lifetimeEarned = D.UNLOCKS.inv;
  advance(0.5);
  assert.equal(G.isUnlocked('inv'), true);
  assert.equal(G.isUnlocked('lux'), false);
  assert.equal(G.isUnlocked('home'), true);
});

// ---------- save, importação e dados inválidos ----------
test('salvar e carregar preserva o estado', () => {
  const s = fresh({ cash: 1e6 });
  G.buyBiz('suco', 12); G.hireManager('suco'); G.buyLux('w1'); G.buyAsset('BYTE', 3);
  s.ach.tap100 = true;
  G.save();
  const snapshot = JSON.stringify(G.s);
  const st = G.storage;
  G.s = null;
  assert.equal(G.load().status, 'ok');
  assert.equal(G.storage, st);
  assert.equal(JSON.stringify(G.s), snapshot);
});

test('save antigo (v1, sem campos novos) carrega com padrões seguros', () => {
  fresh();
  const v1 = {
    v: 1, cash: 5000, runEarned: 20000, lifetimeEarned: 20000, stars: 0, starsClaimed: 0, prestiges: 0,
    biz: { suco: { lvl: 15, emp: 1, mgr: true, prog: 0.5, running: false } }, jobs: 2, skills: { toque: 1 },
    props: {}, lux: {}, mkt: {}, hold: {}, events: [], news: [], boost: { adUntil: 0, tourUntil: 0, quickAt: 0 },
    tour: { week: 3000, score: 0, base: 1000, pending: null, best: null }, goals: { short: 5, mid: 2, long: 1 },
    stats: { taps: 50 }, settings: { sound: false, vib: true }, noAds: false, tutorial: -1, created: clock - 1e6, lastSeen: clock
  };
  G.storage.setItem(D.SAVE_KEY, JSON.stringify(v1));
  assert.equal(G.load().status, 'ok');
  const s = G.s;
  assert.equal(s.v, D.SAVE_VERSION);
  assert.equal(s.cash, 5000);
  assert.equal(s.biz.suco.lvl, 15);
  assert.equal(s.biz.burger.lvl, 0);
  assert.equal(s.settings.sound, false);
  assert.equal(s.settings.reduceMotion, false);
  assert.deepEqual(s.ach, {});
  assert.equal(s.unlocks.inv, true, 'jogador antigo que já faturou mantém a aba');
  assert.equal(s.unlocks.lux, true);
  assert.equal(s.stats.taps, 50);
  assert.equal(s.stats.bizLevels, 0);
});

test('save corrompido não é perdido: vai para backup e o backup automático é restaurado', () => {
  const s = fresh({ cash: 777 });
  G.save();
  G.storage.setItem(G.KEYS.auto, G.storage.getItem(D.SAVE_KEY));
  G.storage.setItem(D.SAVE_KEY, '{"cash": 12, "biz": {broken');
  const r = G.load();
  assert.equal(r.status, 'recovered');
  assert.equal(G.s.cash, 777);
  assert.equal(G.storage.getItem(G.KEYS.bad), '{"cash": 12, "biz": {broken');
  void s;
});

test('save ilegível sem backup começa do zero mas guarda a cópia original', () => {
  fresh();
  G.storage.setItem(D.SAVE_KEY, 'lixo');
  const r = G.load();
  assert.equal(r.status, 'failed');
  assert.equal(G.s.cash, 0);
  assert.equal(G.storage.getItem(G.KEYS.bad), 'lixo');
});

test('save de versão futura é recusado sem ser sobrescrito', () => {
  fresh();
  const future = JSON.stringify({ v: 99, biz: {}, cash: 1 });
  G.storage.setItem(D.SAVE_KEY, future);
  const r = G.load();
  assert.equal(r.status, 'failed');
  assert.match(r.error, /versão mais nova/);
  assert.equal(G.storage.getItem(G.KEYS.bad), future);
});

test('importação valida tudo e rejeita conteúdo malicioso', () => {
  fresh({ cash: 123 });
  const evil = {
    v: 2, cash: 'NaN', runEarned: -5, lifetimeEarned: 1e9,
    stars: '<img src=x onerror=alert(1)>', starsClaimed: 999999, prestiges: 1,
    biz: { suco: { lvl: -10, emp: 99, mgr: 'yes' }, burger: { lvl: 1e12, emp: 99, mgr: true }, hacker: { lvl: 5 } },
    jobs: 999, skills: { toque: 9999, evil: 3 }, lux: { w1: true, c1: 'true', zz: true },
    hold: { NXS: { qty: -100, avg: 1 }, BYTE: { qty: 5, avg: 'abc' } },
    news: [{ id: 'NXS', txt: '<script>alert(1)</script>Oi', up: true, t: 1 }, { id: 'X', txt: 'x' }],
    events: [{ id: 'e', biz: 'burger', type: 'promo', mult: 1000, until: 9e15 }, { biz: 'suco', type: 'bad' }],
    tour: { week: 'abc', score: 'x', pending: { rank: '<b>1</b>', week: 1, score: 1 }, best: -3 },
    boost: { adUntil: 9e15, tourUntil: 9e15, quickAt: 9e15 },
    settings: { sound: 'off' }, tutorial: 'x', lastSeen: -5,
    ['__proto__']: { polluted: true }
  };
  const code = S.encode(evil);
  assert.equal(G.importSave(code), true);
  const s = G.s;
  assert.equal(({}).polluted, undefined, 'sem poluição de protótipo');
  assert.equal(Object.getPrototypeOf(s), Object.prototype);
  assert.equal(s.cash, 0);
  assert.equal(s.runEarned, 0);
  assert.equal(s.stars, 0, 'estrela inválida vira 0');
  assert.ok(s.starsClaimed <= Math.floor(Math.sqrt(1e9 / D.STAR_DIVISOR)));
  assert.equal(s.biz.suco.lvl, 0);
  assert.equal(s.biz.suco.emp, 0);
  assert.equal(s.biz.burger.lvl, D.MAX_BIZ_LVL);
  assert.equal(s.biz.burger.emp, D.EMP_MAX);
  assert.equal(s.biz.hacker, undefined);
  assert.equal(s.jobs, D.JOBS.length);
  assert.equal(s.skills.toque, 50);
  assert.equal(s.skills.evil, undefined);
  assert.deepEqual(s.lux, { w1: true });
  assert.equal(s.hold.NXS, undefined);
  assert.equal(s.hold.BYTE.avg, 0);
  assert.equal(s.news.length, 1);
  assert.ok(!/[<>]/.test(s.news[0].txt));
  assert.equal(s.events.length, 1);
  assert.equal(s.events[0].mult, 3);
  assert.ok(s.events[0].until <= clock + 3 * 60000);
  assert.equal(s.tour.week, null);
  assert.equal(s.tour.score, 0);
  assert.equal(typeof s.tour.pending.rank, 'number');
  assert.equal(s.tour.best, 1);
  assert.ok(s.boost.adUntil <= clock + D.AD_BOOST_MAX_H * 3600000);
  assert.equal(s.settings.sound, true);
  assert.equal(s.tutorial, 0);
  // estado anterior guardado para desfazer
  assert.equal(JSON.parse(G.storage.getItem(G.KEYS.pre)).cash, 123);
});

test('importação recusa códigos inválidos com mensagem clara e não altera o jogo', () => {
  const s = fresh({ cash: 50 });
  for (const bad of ['', '   ', '@@@@', S.EXPORT_PREFIX + 'bm90IGpzb24=', 'x'.repeat(S.MAX_IMPORT_CHARS + 1),
                     S.encode([1, 2]), S.encode({ cash: 1 }), S.encode(null)]) {
    assert.throws(() => G.importSave(bad), Error);
    assert.equal(G.s, s);
    assert.equal(G.s.cash, 50);
  }
});

test('importar o mesmo save várias vezes não gera ganho offline repetido', () => {
  const s = fresh({ cash: 1e9 });
  G.buyBiz('suco', 30); G.hireManager('suco');
  const code = G.exportSave();
  clock += 5 * 3600 * 1000;
  G.importSave(code);
  assert.equal(G.computeOffline(), null);
  void s;
});

test('restaurar backup automático', () => {
  fresh({ cash: 999 });
  G.save();
  G.storage.setItem(G.KEYS.auto, G.storage.getItem(D.SAVE_KEY));
  G.s.cash = 1;
  G.restoreBackup('auto');
  assert.equal(G.s.cash, 999);
  assert.equal(JSON.parse(G.storage.getItem(G.KEYS.pre)).cash, 1);
  assert.throws(() => G.restoreBackup('bad'));
});

test('sessão longa simulada (2 h de jogo) mantém todos os números finitos', () => {
  const s = fresh({ events: true });
  s.nextEventAt = clock + 1000; // eventos ligados
  for (let t = 0; t < 7200; t++) {
    clock += 1000;
    G.tap(); G.tap();
    D.BUSINESSES.forEach((b) => G.runBiz(b.id));
    G.tick(1);
    if (t % 5 === 0) {
      G.buyJob();
      D.BUSINESSES.forEach((b) => { G.buyBiz(b.id, 'max'); G.hireManager(b.id); G.hireEmployee(b.id); });
      s.events.forEach((e) => G.resolveEvent(e.id));
      D.SKILLS.forEach((k) => G.buySkill(k.id));
    }
  }
  const nums = [s.cash, s.runEarned, s.lifetimeEarned, E.netWorth(s), E.passiveIncome(s, clock), E.tapValue(s, clock)];
  nums.forEach((v) => assert.ok(Number.isFinite(v) && v >= 0, String(v)));
  assert.ok(s.lifetimeEarned > 1e6, 'progrediu');
  assert.ok(Object.keys(s.ach).length >= 5, 'conquistas destravadas');
});

test('prêmios não contam como faturamento produtivo (missão "Fature" não se autoalimenta)', () => {
  const s = fresh();
  const p0 = s.stats.prodEarned;
  G.earnReward(1e6);
  assert.equal(s.stats.prodEarned, p0);
  assert.equal(s.lifetimeEarned, 1e6, 'mas conta para o faturamento total e o Legado');
  G.tap();
  assert.ok(s.stats.prodEarned > p0);
});

test('cartão do negócio: receita líquida por ciclo bate com o dinheiro recebido em produção manual', () => {
  const s = fresh({ cash: 1e9 });
  noRewards(s);
  G.buyBiz('pixel', 10); G.hireEmployee('pixel'); G.hireEmployee('pixel');
  const T = E.bizTime(s, 'pixel');
  const net = E.bizRevenue(s, 'pixel', clock) - E.bizUpkeep(s, 'pixel') * T;
  const c0 = s.cash;
  G.runBiz('pixel');
  advance(T + 0.5);
  close(s.cash - c0, net, 0.02);
});

// ---------- v1.1.1: painel financeiro = dinheiro realmente movimentado ----------
test('produção manual com funcionários: recebe exatamente o líquido do ciclo e o salário é registrado', () => {
  const s = fresh({ cash: 1e9 });
  noRewards(s);
  G.buyBiz('pixel', 20); G.hireEmployee('pixel'); G.hireEmployee('pixel'); G.hireEmployee('pixel');
  const wages = E.bizCycleWages(s, 'pixel');
  const net = E.bizCycleNet(s, 'pixel', clock);
  assert.ok(wages > 0);
  const c0 = s.cash, w0 = s.stats.wagesPaid, l0 = s.lifetimeEarned;
  G.runBiz('pixel');
  advance(E.bizTime(s, 'pixel') + 0.5);
  close(s.cash - c0, net, 1e-9);
  close(s.stats.wagesPaid - w0, wages, 1e-9);
  close(s.lifetimeEarned - l0, net, 1e-9, 'faturamento conta o líquido, não o bruto');
});

test('sem dinheiro: salários saem da receita do ciclo, saldo nunca fica negativo e nada é perdido', () => {
  const s = fresh({ cash: 1e9 });
  noRewards(s);
  G.buyBiz('arena', 5);
  for (let i = 0; i < 10; i++) G.hireEmployee('arena');
  s.cash = 0;
  const net = E.bizCycleNet(s, 'arena', clock), wages = E.bizCycleWages(s, 'arena');
  G.runBiz('arena');
  let minCash = Infinity;
  for (let t = 0; t < E.bizTime(s, 'arena') + 1; t += 0.25) { clock += 250; G.tick(0.25); minCash = Math.min(minCash, s.cash); }
  assert.ok(minCash >= 0);
  close(s.cash, net, 1e-9);
  close(s.stats.wagesPaid, wages, 1e-9);
});

test('painel: líquido por segundo = dinheiro recebido; fluxo medido bate com o painel', () => {
  const s = fresh({ cash: 1e12 });
  noRewards(s);
  G.buyBiz('suco', 60); G.hireManager('suco'); for (let i = 0; i < 4; i++) G.hireEmployee('suco');
  G.buyBiz('escola', 30); G.hireManager('escola'); for (let i = 0; i < 6; i++) G.hireEmployee('escola');
  G.buyJob(); G.buyJob(); G.buyJob();
  G.buyProp('kitnet'); G.buyProp('apto');
  G.resetFlow();
  const b = E.breakdown(s, clock, true);
  const c0 = s.cash, w0 = s.stats.wagesPaid, r0 = s.stats.rentUpkeepPaid;
  advance(240);
  close(s.cash - c0, b.net * 240, 0.01);
  close(s.stats.wagesPaid - w0, b.empUpkeep * 240, 0.02);
  close(s.stats.rentUpkeepPaid - r0, b.rentUpkeep * 240, 1e-6);
  const mf = G.measuredFlow();
  assert.ok(mf && mf.secs >= 59);
  close(mf.net, b.net, 0.08); // ciclos de 8 s pagam em parcelas dentro da janela de 60 s
  close(mf.wages, b.empUpkeep, 0.08);
  close(mf.rentUp, b.rentUpkeep, 1e-6);
});

test('breakdown lista negócios sem gerente (em produção e parados) fora do fluxo contínuo', () => {
  const s = fresh({ cash: 1e9 });
  G.buyBiz('suco', 10); G.buyBiz('burger', 10); G.hireEmployee('burger');
  G.runBiz('burger');
  const b = E.breakdown(s, clock, true);
  assert.equal(b.manual.running, 1);
  assert.equal(b.manual.idle, 1);
  close(b.manual.net, E.bizCycleNet(s, 'burger', clock, true));
  assert.equal(b.biz, 0);
  assert.equal(b.empUpkeep, 0);
});

test('offline registra salários e manutenção pagos', () => {
  const s = fresh({ cash: 1e9 });
  G.buyBiz('suco', 30); G.hireManager('suco'); G.hireEmployee('suco'); G.buyProp('kitnet');
  G.touch(clock);
  const b = E.breakdown(s, clock, true);
  const w0 = s.stats.wagesPaid;
  clock += 3600 * 1000;
  const off = G.computeOffline();
  close(s.stats.wagesPaid - w0, b.empUpkeep * 3600, 1e-9);
  close(off.amount, b.net * 3600, 1e-9);
});

// ---------- save: falhas de armazenamento e formatos estranhos ----------
test('armazenamento cheio: salvar falha sem travar e avisa uma única vez', () => {
  fresh({ cash: 5 });
  let warned = 0;
  G.on('saveError', () => warned++);
  G.storage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(G.save(), false);
  assert.equal(G.save(), false);
  assert.equal(warned, 1);
  assert.equal(G.s.cash, 5);
});

test('armazenamento ilegível no carregamento começa um jogo novo sem erro', () => {
  fresh();
  G.storage.getItem = () => { throw new Error('SecurityError'); };
  assert.equal(G.load().status, 'new');
  assert.equal(G.s.cash, 0);
});

test('tipos aninhados errados são substituídos por padrões seguros', () => {
  fresh();
  const raw = { v: 2, biz: { suco: [1, 2, 3], burger: 'x' }, stats: 'abc', settings: [1], goals: 7, boost: null,
                mkt: { NXS: { p: -5, hist: 'x' }, BYTE: { p: 1e300, hist: [1, 'a', -2, 3] } }, daily: { day: 1, list: [{ id: 'taps' }] },
                ach: ['tap100'], lux: 'w1', tour: [], news: 'oi', events: {}, hold: { NXS: 5 }, cash: 10 };
  G.storage.setItem(D.SAVE_KEY, JSON.stringify(raw));
  assert.equal(G.load().status, 'ok');
  const s = G.s;
  assert.equal(s.cash, 10);
  assert.equal(s.biz.suco.lvl, 0);
  assert.equal(s.stats.taps, 0);
  assert.equal(s.settings.sound, true);
  assert.equal(s.goals.short, 0);
  assert.ok(s.mkt.NXS.p > 0 && s.mkt.NXS.hist.length === 1);
  assert.ok(s.mkt.BYTE.p <= 2400 * 1e4);
  assert.deepEqual(s.mkt.BYTE.hist, [1, 3]);
  assert.equal(s.daily, null, 'missões com lista incompleta são descartadas e regeneradas');
  assert.deepEqual(s.ach, {});
  assert.deepEqual(s.lux, {});
  assert.deepEqual(s.hold, {});
  assert.deepEqual(s.news, []);
  assert.deepEqual(s.events, []);
});

test('exportar e importar preserva todo o progresso', () => {
  const s = fresh({ cash: 1e9 });
  G.buyBiz('suco', 40); G.hireManager('suco'); G.hireEmployee('suco'); G.buyJob(); G.buySkill('toque');
  G.buyLux('w1'); G.buyProp('kitnet'); G.buyAsset('NEB', 7);
  for (let i = 0; i < 150; i++) G.tap();
  advance(1);
  const before = JSON.parse(JSON.stringify(G.s));
  const code = G.exportSave();
  G.reset();
  assert.equal(G.s.biz.suco.lvl, 0);
  G.importSave(code);
  const after = G.s;
  for (const k of ['cash', 'lifetimeEarned', 'jobs', 'stars']) close(after[k], before[k]);
  assert.deepEqual(after.biz, before.biz);
  assert.deepEqual(after.skills, before.skills);
  assert.deepEqual(after.lux, before.lux);
  assert.deepEqual(after.props, before.props);
  assert.deepEqual(after.hold, before.hold);
  assert.deepEqual(after.ach, before.ach);
  assert.deepEqual(after.stats, before.stats);
  void s;
});

test('restaurar o backup "antes de apagar" desfaz o reset', () => {
  fresh({ cash: 4321 });
  G.save();
  G.reset();
  assert.equal(G.s.cash, 0);
  G.restoreBackup('pre');
  assert.equal(G.s.cash, 4321);
});

// ---------- economia: sem recompensas duplicadas nem compras indevidas ----------
test('prêmio do torneio é pago uma vez e semana regredida não gera prêmio', () => {
  const s = fresh({ cash: 1e6 });
  G.checkTournament(clock);
  s.tour.score = 1e9;
  clock += 8 * 86400000;
  G.checkTournament(clock);
  assert.ok(s.tour.pending);
  assert.ok(G.claimTourReward());
  assert.equal(G.claimTourReward(), null);
  const wk = s.tour.week;
  s.tour.score = 1e9;
  G.checkTournament(clock - 14 * 86400000);
  assert.equal(s.tour.pending, null);
  assert.equal(s.tour.week, wk);
});

test('cada meta e conquista paga uma única vez', () => {
  const s = fresh({ cash: 0 });
  let goals = 0, achs = 0;
  G.on('goal', () => goals++); G.on('ach', () => achs++);
  for (let i = 0; i < 120; i++) G.tap();
  advance(2);
  const g1 = goals, a1 = achs;
  advance(10);
  assert.ok(g1 >= 1 && a1 >= 1);
  assert.equal(goals, g1);
  assert.equal(achs, a1);
});

test('bônus gratuitos respeitam recarga; lucro rápido não paga duas vezes', () => {
  const s = fresh({ cash: 0 });
  assert.equal(G.useFreeBoost(), true);
  assert.equal(G.useFreeBoost(), false);
  clock += (D.AD_BOOST_MIN + D.FREE_BOOST_CD_MIN) * 60000 + 1000;
  assert.equal(G.useFreeBoost(), true);
  assert.ok(G.applyQuickCash() > 0);
  assert.equal(G.applyQuickCash(), 0);
  void s;
});

test('comprar "MÁX" nunca gasta mais que o saldo, em qualquer escala', () => {
  for (const cash of [10, 1234, 5e6, 7.7e12, 3e40, 1e200]) {
    const s = fresh({ cash });
    for (const b of D.BUSINESSES) {
      const c0 = s.cash;
      G.buyBiz(b.id, 'max');
      assert.ok(s.cash >= 0 && s.cash <= c0, b.id + ' @' + cash);
      assert.ok(Number.isFinite(s.cash));
    }
    const c1 = s.cash;
    G.buyAsset('GATO', 'max');
    assert.ok(s.cash >= 0 && s.cash <= c1);
  }
});

test('custos crescem de forma monotônica e finita em toda a faixa de níveis', () => {
  const s = fresh();
  for (const b of D.BUSINESSES) {
    let prev = 0;
    for (const lvl of [0, 1, 10, 100, 500, 1000, 3000]) {
      s.biz[b.id].lvl = lvl;
      const c = E.bizCost(s, b.id, 1);
      assert.ok(c > prev, b.id + ' nível ' + lvl);
      prev = c;
    }
    s.biz[b.id].lvl = D.MAX_BIZ_LVL;
    assert.ok(!Number.isNaN(E.bizCost(s, b.id, 1)));
    s.cash = 1e300;
    assert.equal(G.buyBiz(b.id, 1), false, 'nível máximo não compra mais');
  }
});

test('custo de funcionário nunca supera a fórmula da v1.1.0 e é sempre finito e crescente', () => {
  const s = fresh();
  for (const b of D.BUSINESSES) {
    for (const lvl of [1, 10, 25, 60, 150, 400]) {
      s.biz[b.id].lvl = lvl;
      let prev = 0;
      for (let e = 0; e < D.EMP_MAX; e++) {
        s.biz[b.id].emp = e;
        const c = E.empCost(s, b.id);
        assert.ok(Number.isFinite(c) && c > 0);
        assert.ok(c <= b.cost * 10 * Math.pow(2.6, e) * (1 + 1e-12), `${b.id} lvl ${lvl} emp ${e}`);
        assert.ok(c > prev);
        prev = c;
      }
    }
  }
});

// =====================================================================
// v2.0
// =====================================================================
test('melhorias de empresa: sequência, nível mínimo, custo e efeito', () => {
  const s = fresh({ cash: 1e16 });
  noRewards(s);
  G.buyBiz('suco', 10);
  let info = G.upgradeInfo('suco');
  assert.equal(info.locked, true);
  assert.equal(G.buyUpgrade('suco'), false, 'exige nível 25');
  G.buyBiz('suco', 15);
  const r0 = E.bizRevenue(s, 'suco', clock, true), t0 = E.bizTime(s, 'suco');
  info = G.upgradeInfo('suco');
  close(info.cost, 10 * D.BIZ_UPGRADES[0].costMul);
  const c0 = s.cash;
  assert.equal(G.buyUpgrade('suco'), true);
  close(c0 - s.cash, info.cost);
  close(E.bizRevenue(s, 'suco', clock, true), r0 * 1.5);
  assert.equal(G.buyUpgrade('suco'), false, 'automação exige nível 75');
  G.buyBiz('suco', 50);
  assert.equal(G.buyUpgrade('suco'), true);
  close(E.bizTime(s, 'suco'), t0 / 1.25);
  G.buyBiz('suco', 75);
  assert.equal(G.buyUpgrade('suco'), true);
  assert.equal(G.upgradeInfo('suco').done, true);
  assert.equal(G.buyUpgrade('suco'), false);
  assert.equal(E.upgCount(s), 3);
  assert.equal(s.stats.upgBought, 3);
});

test('eficiência sobe com ciclos concluídos e dá +5% por patamar', () => {
  const s = fresh({ cash: 1e9 });
  noRewards(s);
  G.buyBiz('suco', 10); G.hireManager('suco');
  assert.equal(E.effLevel(s, 'suco'), 0);
  const r0 = E.bizRevenue(s, 'suco', clock, true);
  advance(152); // > 100 ciclos de 1,5 s
  assert.ok(s.biz.suco.runs >= 100);
  assert.equal(E.effLevel(s, 'suco'), 1);
  close(E.bizRevenue(s, 'suco', clock, true), r0 * 1.05);
  s.biz.suco.runs = 2e6;
  assert.equal(E.effLevel(s, 'suco'), 5);
});

test('estatísticas por empresa batem com o dinheiro e salários', () => {
  const s = fresh({ cash: 1e9 });
  noRewards(s);
  G.buyBiz('burger', 20); G.hireManager('burger'); G.hireEmployee('burger');
  const c0 = s.cash;
  advance(40);
  close(s.biz.burger.earned, s.cash - c0, 1e-9);
  close(s.stats.wagesPaid, s.biz.burger.wages, 1e-9);
  assert.equal(s.biz.burger.runs, s.stats.bizRuns);
});

test('reforma: exige imóvel, custa conforme a fórmula, +20% de aluguel e tem limite', () => {
  const s = fresh({ cash: 1e30 });
  assert.equal(G.renovate('kitnet'), false, 'sem imóvel não reforma');
  G.buyProp('kitnet');
  const rent0 = E.propRent(s, 'kitnet');
  close(E.renoCost(s, 'kitnet'), 5000 * 3);
  assert.equal(G.renovate('kitnet'), true);
  close(E.propRent(s, 'kitnet'), rent0 * 1.2);
  close(E.renoCost(s, 'kitnet'), 5000 * 3 * 2.2);
  for (let i = 0; i < 20; i++) G.renovate('kitnet');
  assert.equal(E.renoLvl(s, 'kitnet'), D.RENO_MAX);
  assert.equal(G.renovate('kitnet'), false);
});

test('dividendos: taxa correta, pagos no laço, no offline e não em cripto', () => {
  const s = fresh({ cash: 1e9 });
  noRewards(s);
  G.buyAsset('MEL', 1000);
  G.buyAsset('BYTE', 10);
  const p = s.mkt.MEL.p;
  close(E.dividendRate(s), 1000 * p * 0.03 / 3600);
  G.resetFlow();
  const d0 = s.stats.divEarned;
  advance(10);
  assert.ok(s.stats.divEarned - d0 > 0);
  const b = E.breakdown(s, clock, true);
  close(b.div, E.dividendRate(s));
  G.touch(clock);
  clock += 3600 * 1000;
  const off = G.computeOffline();
  close(off.parts.div, b.div * 3600, 0.05); // preço muda levemente durante a simulação offline da bolsa
  assert.ok(off.amount >= off.parts.div * 0.95);
});

test('Medalhas de Mérito: loja com custo crescente, limite e permanência no Legado', () => {
  const s = fresh();
  G.addMedals(500, 'teste');
  const c1 = G.meritCost('minc');
  assert.equal(G.buyMerit('minc'), true);
  assert.equal(s.merit.bal, 500 - c1);
  assert.ok(G.meritCost('minc') > c1);
  const m0 = E.globalMult(s, clock, true);
  assert.equal(G.buyMerit('minc'), true);
  close(E.globalMult(s, clock, true), m0 * (1 + 0.1) / (1 + 0.05));
  for (let i = 0; i < 20; i++) G.buyMerit('mquick');
  assert.equal(E.meritLvl(s, 'mquick'), 3);
  assert.equal(G.buyMerit('nada'), false);
  s.lifetimeEarned = 1e10;
  G.prestige();
  assert.equal(E.meritLvl(G.s, 'minc'), 2, 'loja de mérito sobrevive ao Legado');
  assert.ok(G.s.merit.bal > 0);
});

test('exclusivos de mérito não podem ser comprados com dinheiro', () => {
  const s = fresh({ cash: 1e300 });
  assert.equal(G.buyLux('x1'), false);
  assert.equal(s.lux.x1, undefined);
  assert.equal(G.buyMeritLux('x1'), false, 'sem medalhas');
  G.addMedals(60, 't');
  assert.equal(G.buyMeritLux('x1'), true);
  assert.equal(s.lux.x1, true);
  assert.equal(s.merit.bal, 0);
  assert.equal(G.buyMeritLux('x1'), false, 'não compra duas vezes');
});

test('nível do império: medalhas pagas uma vez por nível', () => {
  const s = fresh();
  noRewards(s); // conquistas já marcadas: só o império paga medalhas aqui
  s.lifetimeEarned = 1e6; // nível 12
  advance(0.5);
  assert.equal(E.empireLevel(s), 12);
  assert.equal(s.empire.claimed, 12);
  const bal = s.merit.bal;
  assert.equal(bal, 12 * 2 + 2 * 5, '2 por nível + 5 nos níveis 5 e 10');
  advance(5);
  assert.equal(s.merit.bal, bal, 'sem pagamento duplicado');
});

test('desafios semanais: geração, progresso, resgate único, bônus e relógio atrasado', () => {
  const s = fresh();
  advance(0.5);
  assert.ok(s.weekly && s.weekly.list.length === 3);
  const wk = s.weekly.week;
  s.weekly.list.forEach((m) => { s.stats[D.WEEKLY_BY_ID[m.id].stat] += m.target; });
  const b0 = s.merit.bal;
  [0, 1, 2].forEach((i) => assert.ok(G.claimWeekly(i)));
  assert.equal(G.claimWeekly(0), null);
  assert.ok(s.merit.bal > b0);
  assert.equal(G.claimWeeklyBonus(), D.WEEKLY_BONUS_MEDALS);
  assert.equal(G.claimWeeklyBonus(), 0);
  assert.equal(G.ensureWeekly(clock - 30 * 86400000), false, 'relógio atrasado não gera semana nova');
  clock += 7 * 86400000;
  assert.equal(G.ensureWeekly(clock), true);
  assert.ok(s.weekly.week > wk);
});

test('Corrida Empresarial: pontua faturamento produtivo, premia uma vez e ignora semana regredida', () => {
  const s = fresh({ cash: 1e6 });
  advance(0.5);
  assert.notEqual(s.race.week, null);
  G.earnReward(1e12);
  assert.equal(M.raceScore(s), 0, 'prêmios não contam');
  s.stats.prodEarned += 1e15;
  assert.ok(M.raceScore(s) > 0);
  clock += 8 * 86400000;
  advance(0.5);
  assert.ok(s.race.pending);
  assert.equal(s.race.pending.rank, 1);
  const r = G.claimRaceReward();
  assert.ok(r && r.medals === 25);
  assert.equal(G.claimRaceReward(), null);
  const wk = s.race.week;
  G.checkRace(clock - 21 * 86400000);
  assert.equal(s.race.week, wk);
  assert.equal(s.race.pending, null);
});

test('evento de setor: rodízio determinístico a cada 2 dias e multiplica só as categorias do evento', () => {
  const a = E.sectorEventAt(Date.UTC(2026, 9, 10, 12));
  const b = E.sectorEventAt(Date.UTC(2026, 9, 10, 20));
  assert.equal(a.ev.id, b.ev.id);
  const seen = new Set();
  for (let d = 0; d < 12; d++) seen.add(E.sectorEventAt(Date.UTC(2026, 9, 1 + d * 2, 12)).ev.id);
  assert.equal(seen.size, D.SECTOR_EVENTS.length);
  const t = Date.UTC(2026, 9, 10, 12), ev = E.sectorEventAt(t).ev;
  D.BUSINESSES.forEach((bz) => assert.equal(E.sectorMult(bz.id, t), ev.cats.includes(bz.cat) ? ev.mult : 1));
  assert.ok(E.sectorEventAt(t).ends > t);
});

test('patentes de Legado: kits iniciais e descontos', () => {
  let s = fresh();
  s.lifetimeEarned = 1e8 * 100 * 100; s.stars = 0; s.starsClaimed = 0; // dará 100 estrelas
  G.prestige();
  s = G.s;
  assert.equal(s.stars, 100);
  assert.equal(E.legacyRank(s), 2);
  assert.equal(s.biz.suco.lvl, 25, 'Barão: Suco nível 25');
  assert.equal(s.biz.suco.mgr, true);
  assert.equal(s.jobs, 1, 'Herdeiro: emprego Panfleteiro');
  s.stars = 1e4;
  close(E.mgrCost(s, 'burger'), D.BUSINESSES[1].mgr * 0.75, 1e-9);
  const off0 = E.offlineCapHours(s);
  assert.ok(off0 >= D.OFFLINE_BASE_H + 2, 'Conde: +2h offline');
});

test('save v2 (1.1.x) migra para v3 com presente e sem enxurrada de níveis', () => {
  fresh();
  const v2 = { v: 2, cash: 100, runEarned: 1e9, lifetimeEarned: 1e9, biz: { suco: { lvl: 30, emp: 2, mgr: true } },
               ach: { tap100: true, biz3: true, mgr1: true }, stats: { taps: 200 } };
  G.storage.setItem(D.SAVE_KEY, JSON.stringify(v2));
  assert.equal(G.load().status, 'ok');
  const s = G.s;
  assert.equal(s.v, 3);
  assert.equal(s.biz.suco.lvl, 30);
  assert.equal(s.biz.suco.up, 0);
  assert.equal(s.empire.claimed, 18);
  assert.equal(s.upgradeGift, 3 + 2 * 18);
  assert.equal(s.merit.bal, 3 + 2 * 18);
  const bal = s.merit.bal, ach0 = Object.keys(s.ach).length;
  advance(1);
  assert.equal(s.empire.claimed, 18);
  assert.equal(s.merit.bal - bal, Object.keys(s.ach).length - ach0, 'só conquistas novas pagam; níveis já alcançados não');
});

test('campos v3 maliciosos são saneados', () => {
  fresh();
  const evil = {
    v: 3, biz: { suco: { lvl: 5, up: 99, runs: -4, earned: 'x', wages: Infinity }, burger: { lvl: 0, up: 3 } },
    reno: { kitnet: 50, apto: 3 }, props: { apto: 0 },
    merit: { bal: -10, earned: 'abc', spent: 1e99, items: { minc: 999, hack: 3, mtap: '2' } },
    empire: { claimed: 1e9 }, lifetimeEarned: 1000,
    weekly: { week: 'x', list: [{ id: 'w_earn', target: -5 }, { id: 'evil' }], bonus: 'yes' },
    race: { week: 3000, start: -9, base: 'x', pending: { rank: 99, score: -1 }, best: 0 },
    nwHist: [{ t: 1, v: 5 }, { t: 'a', v: 1 }, { t: 2, v: -3 }, 7, { t: 9e15, v: 1e301 }],
    lux: { x1: true }
  };
  G.importSave(S.encode(evil));
  const s = G.s;
  assert.equal(s.biz.suco.up, 3);
  assert.equal(s.biz.suco.runs, 0);
  assert.equal(s.biz.suco.earned, 0);
  assert.equal(s.biz.suco.wages, 0);
  assert.equal(s.biz.burger.up, 0, 'sem nível, sem melhorias');
  assert.deepEqual(s.reno, {}, 'reforma sem imóvel é descartada');
  assert.equal(s.merit.bal, 0);
  assert.equal(s.merit.items.minc, 10);
  assert.equal(s.merit.items.mtap, 2);
  assert.equal(s.merit.items.hack, undefined);
  assert.equal(s.empire.claimed, E.empireLevel(s));
  assert.equal(s.weekly.list.length, 1);
  assert.equal(s.weekly.list[0].target, 1);
  assert.equal(s.race.base, 5000);
  assert.equal(s.race.pending.rank, D.RACE_BOTS.length + 1);
  assert.equal(s.race.best, 1);
  assert.equal(s.nwHist.length, 2);
  assert.ok(s.nwHist.every((x) => x.v >= 0 && x.v <= S.BIG && x.t <= clock));
  assert.equal(s.lux.x1, true, 'exclusivo possuído é mantido (validado como booleano)');
});

test('backups rotativos: 3 automáticos + diário; recuperação usa o mais recente válido', () => {
  const s = fresh({ cash: 1 });
  const st = G.storage;
  for (let i = 1; i <= 4; i++) { s.cash = i; clock += 6 * 60000; G.save(); }
  assert.equal(JSON.parse(st.getItem(G.KEYS.auto)).cash, 4);
  assert.equal(JSON.parse(st.getItem(G.KEYS.auto2)).cash, 3);
  assert.equal(JSON.parse(st.getItem(G.KEYS.auto3)).cash, 2);
  assert.ok(st.getItem(G.KEYS.day));
  st.setItem(D.SAVE_KEY, 'corrompido');
  st.setItem(G.KEYS.auto, '{quebrado');
  const r = G.load();
  assert.equal(r.status, 'recovered');
  assert.equal(r.from, 'auto2');
  assert.equal(G.s.cash, 3);
  const info = G.backupInfo();
  assert.ok(info.auto3 && info.day && info.bad);
});

test('histórico do patrimônio: 1 ponto por minuto, no máximo 120', () => {
  const s = fresh({ cash: 1e6 });
  advance(61 * 3, 1);
  assert.ok(s.nwHist.length >= 2 && s.nwHist.length <= 4);
  for (let i = 0; i < 300; i++) G.sampleNetWorth(clock + i);
  assert.equal(s.nwHist.length, 120);
});

test('gerente usa o custo com descontos (Headhunter)', () => {
  const s = fresh({ cash: 1e12 });
  G.addMedals(1000, 't');
  G.buyMerit('mmgr');
  G.buyBiz('burger', 1);
  const c0 = s.cash;
  assert.equal(G.hireManager('burger'), true);
  close(c0 - s.cash, D.BUSINESSES[1].mgr * 0.85);
});
