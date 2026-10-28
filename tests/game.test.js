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
  G.s.nextEventAt = 1e15; // eventos aleatórios desligados nos testes determinísticos
  G.s.nextNewsAt = 1e15;
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
  assert.equal(n.cash, 0);
  assert.equal(n.biz.suco.lvl, 0);
  assert.equal(n.jobs, 0);
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
  s.nextEventAt = clock + 60000; s.nextNewsAt = clock + 90000;
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
  const s = fresh();
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
