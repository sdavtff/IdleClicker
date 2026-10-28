#!/usr/bin/env node
/* Simulador de balanceamento: um jogador "guloso" joga 2 horas, usando o MESMO código do jogo.
 * Uso: node tools/balance-sim.js [minutos] [toques_por_segundo]
 * Gera a tabela de balanceamento (docs/BALANCE.md). */
'use strict';
const path = require('path');
const js = (f) => path.join(__dirname, '..', 'www', 'js', f);
const D = require(js('data.js'));
const E = require(js('economy.js'));
const G = require(js('game.js'));
const F = require(js('fmt.js'));

const MINUTES = +process.argv[2] || 120;
const TPS = +process.argv[3] || 3; // toques/segundo de um jogador ativo
const PRESTIGE = process.argv[4] === 'prestige'; // funda Legado quando as estrelas novas >= max(5, estrelas atuais)

let seed = 12345;
G.rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
let clock = Date.UTC(2026, 9, 26, 12, 0, 0);
G.now = () => clock;
G.s = G.newState();
G.s.nextEventAt = Infinity; // eventos aleatórios desligados para resultado reprodutível
G.s.nextNewsAt = Infinity;
let s = G.s;

const marks = new Set((MINUTES > 120 ? Array.from({ length: Math.floor(MINUTES / 30) }, (_, i) => (i + 1) * 30)
  : [1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 75, 90, 105, 120]).filter(m => m <= MINUTES));
const rows = [];
const firsts = [];
const seen = new Set();
function note(key, label, t) { if (!seen.has(key)) { seen.add(key); firsts.push([t, label]); } }

function manualUptime(id) { const T = E.bizTime(s, id); return T / (T + 0.6); }

// Retorna a melhor compra (menor tempo de retorno)
function bestOption() {
  const now = clock;
  const opts = [];
  const gm = E.tempMult(s, now);
  const tapGain = () => TPS;
  // emprego
  const j = D.JOBS[s.jobs];
  if (j) {
    const mult = (1 + 0.5 * E.skill(s, 'toque')) * (1 + E.luxBonus(s, 'tap')) * E.starMult(s) * gm;
    opts.push({ cost: j.cost, gain: j.sal * E.starMult(s) + j.tap * mult * tapGain(), go: () => G.buyJob(), label: 'Emprego: ' + j.name });
  }
  // habilidades
  const flat = 1 + D.JOBS.slice(0, s.jobs).reduce((a, x) => a + x.tap, 0);
  if (E.skill(s, 'toque') < 50) opts.push({ cost: E.skillCost(s, 'toque'), gain: flat * 0.5 * E.starMult(s) * tapGain(), go: () => G.buySkill('toque') });
  let bizInc = 0;
  D.BUSINESSES.forEach(b => { if (s.biz[b.id].lvl > 0) bizInc += E.bizIncome(s, b.id, now) * (s.biz[b.id].mgr ? 1 : manualUptime(b.id)); });
  if (E.skill(s, 'carisma') < 50) opts.push({ cost: E.skillCost(s, 'carisma'), gain: bizInc * 0.1 / (1 + 0.1 * E.skill(s, 'carisma')), go: () => G.buySkill('carisma') });
  if (E.skill(s, 'tempo') < 15) opts.push({ cost: E.skillCost(s, 'tempo'), gain: bizInc * 0.06 / (1 + 0.06 * E.skill(s, 'tempo')), go: () => G.buySkill('tempo') });
  // negócios
  D.BUSINESSES.forEach(b => {
    const st = s.biz[b.id];
    const up = st.mgr ? 1 : manualUptime(b.id);
    const cur = E.bizIncome(s, b.id, now) * up;
    st.lvl++; const nxt = E.bizIncome(s, b.id, now) * (st.mgr ? 1 : manualUptime(b.id)); st.lvl--;
    // bônus para alcançar marcos: olha até o próximo marco
    const nm = E.nextMilestone(st.lvl);
    if (nm && nm - st.lvl <= 15 && st.lvl > 0) {
      const k = nm - st.lvl, c = E.bizCost(s, b.id, k);
      const l0 = st.lvl; st.lvl = nm; const after = E.bizIncome(s, b.id, now) * (st.mgr ? 1 : manualUptime(b.id)); st.lvl = l0;
      opts.push({ cost: c, gain: after - cur, go: () => G.buyBiz(b.id, k) });
    }
    opts.push({ cost: E.bizCost(s, b.id, 1), gain: Math.max(nxt - cur, 1e-9), go: () => G.buyBiz(b.id, 1) });
    if (st.lvl > 0 && !st.mgr) opts.push({ cost: b.mgr, gain: E.bizIncome(s, b.id, now) * (1 - manualUptime(b.id)) + E.bizIncome(s, b.id, now) * 0.4, go: () => G.hireManager(b.id) });
    if (st.lvl > 0 && st.mgr && st.emp < D.EMP_MAX) {
      const g = E.bizIncome(s, b.id, now) * D.EMP_BONUS / (1 + D.EMP_BONUS * st.emp) - D.EMP_UPKEEP * b.rev * st.lvl / b.t;
      if (g > 0) opts.push({ cost: E.empCost(s, b.id), gain: g, go: () => G.hireEmployee(b.id) });
    }
  });
  // imóveis
  D.PROPS.forEach(p => opts.push({ cost: E.propCost(s, p.id), gain: p.rent * (1 - D.PROP_UPKEEP) * E.starMult(s), go: () => G.buyProp(p.id) }));
  // luxo com bônus de renda
  D.LUXURY.forEach(l => { if (!s.lux[l.id] && l.bonus.inc) opts.push({ cost: l.cost, gain: bizInc * l.bonus.inc, go: () => G.buyLux(l.id) }); });
  opts.forEach(o => { o.payback = o.cost / o.gain; });
  opts.sort((a, b) => a.payback - b.payback);
  return opts[0];
}

const totalSec = MINUTES * 60;
let saving = null;
for (let t = 1; t <= totalSec; t++) {
  clock += 1000;
  for (let i = 0; i < TPS; i++) G.tap();
  D.BUSINESSES.forEach(b => G.runBiz(b.id));
  G.tick(1);
  // compra enquanto der (até 20 por segundo)
  for (let k = 0; k < 20; k++) {
    const o = bestOption();
    if (!o) break;
    if (s.cash >= o.cost) { o.go(); saving = null; } else break;
  }
  D.BUSINESSES.forEach(b => {
    if (s.biz[b.id].lvl > 0) note('biz' + b.id, 'Abre ' + b.name, t);
    if (s.biz[b.id].mgr) note('mgr' + b.id, 'Gerente em ' + b.name, t);
  });
  for (let j = 0; j < s.jobs; j++) note('job' + j, 'Emprego ' + D.JOBS[j].name, t);
  D.PROPS.forEach(p => { if (s.props[p.id]) note('prop' + p.id, 'Imóvel ' + p.name, t); });
  D.LUXURY.forEach(l => { if (s.lux[l.id]) note('lux' + l.id, 'Luxo ' + l.name, t); });
  if (E.potentialStars(s) >= 1) note('star', 'Prestígio disponível (1ª estrela)', t);
  // resgata missões diárias concluídas (como um jogador faria)
  if (s.daily) { s.daily.list.forEach((m, i) => G.claimDaily(i)); G.claimDailyBonus(); }
  if (PRESTIGE && E.potentialStars(s) >= Math.max(5, s.stars)) {
    const g = G.prestige();
    s = G.s; s.nextEventAt = Infinity; s.nextNewsAt = Infinity;
    firsts.push([t, 'Legado #' + s.prestiges + ' (+' + g + ' ⭐, total ' + s.stars + ')']);
  }
  const bad = [s.cash, s.lifetimeEarned, E.netWorth(s), E.passiveIncome(s, clock)].some(v => !Number.isFinite(v) || v < 0);
  if (bad) { console.error('ERRO: número inválido no segundo ' + t); process.exit(1); }
  if (t % 60 === 0 && marks.has(t / 60)) {
    const now = clock;
    rows.push({
      min: t / 60,
      cash: s.cash,
      earned: s.runEarned,
      ips: E.passiveIncome(s, now),
      tap: E.tapValue(s, now),
      nw: E.netWorth(s),
      biz: D.BUSINESSES.filter(b => s.biz[b.id].lvl > 0).map(b => b.icon + s.biz[b.id].lvl).join(' '),
      mgr: E.mgrCount(s), jobs: s.jobs,
      stars: E.potentialStars(s), owned: s.stars, ach: Object.keys(s.ach).length
    });
  }
}

const pad = (x, n) => String(x).padEnd(n);
console.log('| Min | Faturado (vida) | Renda passiva/s | Valor do toque | Patrimônio | Gerentes | Empregos | ⭐ disponíveis | ⭐ ativas | Conquistas | Negócios (nível) |');
console.log('|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
rows.forEach(r => console.log(`| ${r.min} | ${F.money(r.earned)} | ${F.money(r.ips)} | ${F.money(r.tap)} | ${F.money(r.nw)} | ${r.mgr} | ${r.jobs} | ${r.stars} | ${r.owned} | ${r.ach} | ${r.biz} |`));
console.log('\nMarcos (primeira vez):');
firsts.forEach(([t, l]) => console.log(`- ${F.time(t)} — ${l}`));
