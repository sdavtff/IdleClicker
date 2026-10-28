#!/usr/bin/env node
/* Teste de atualização: joga com o código REAL da v1.0 (extraído do git), salva, troca para o código atual
 * na mesma origem (mesmo localStorage) e verifica se o progresso foi preservado e migrado.
 * Uso: node tools/upgrade-test.js [commit_v1.0] */
'use strict';
const path = require('path');
const http = require('http');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const { chromium } = require('playwright');

const OLD = process.argv[2] || '3014fcd';
const repo = path.join(__dirname, '..');
const oldDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cif-old-'));
execSync(`git archive ${OLD} www | tar -x -C ${oldDir}`, { cwd: repo });
const roots = { old: path.join(oldDir, 'www'), cur: path.join(repo, 'www') };
let root = roots.old;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
const results = [];
const check = (n, ok, info) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (info ? ' — ' + info : '')); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 393, height: 851 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  // v1.0: cria progresso pela própria API do jogo antigo
  await page.goto(url);
  await page.waitForSelector('#tapBtn');
  const oldInfo = await page.evaluate(() => {
    for (let i = 0; i < 40; i++) G.tap();
    G.earn(2e7);
    G.buyJob(); G.buyJob(); G.buyJob();
    G.buyBiz('suco', 60); G.hireManager('suco'); G.hireEmployee('suco');
    G.buyBiz('burger', 30); G.hireManager('burger');
    G.buySkill('toque'); G.buySkill('carisma');
    G.buyProp('kitnet'); G.buyLux('w1'); G.buyLux('c1');
    G.buyAsset('NXS', 10);
    G.s.tutorial = -1;
    Game.save();
    const s = G.s;
    return { v: s.v, cash: Math.round(s.cash), lifetime: Math.round(s.lifetimeEarned), jobs: s.jobs, suco: s.biz.suco.lvl, mgr: s.biz.suco.mgr,
             emp: s.biz.suco.emp, burger: s.biz.burger.lvl, skills: JSON.stringify(s.skills), props: s.props.kitnet, lux: Object.keys(s.lux).sort().join(','),
             nxs: s.hold.NXS.qty, taps: s.stats.taps };
  });
  check('Save da v1.0 criado', oldInfo.v === 1 && oldInfo.suco === 60, JSON.stringify(oldInfo));

  // troca para o código atual na mesma origem e recarrega
  root = roots.cur;
  await page.reload();
  await page.waitForSelector('#tapBtn');
  await page.waitForTimeout(500);
  const cur = await page.evaluate(() => {
    const s = G.s;
    return { v: s.v, version: D.VERSION, cash: Math.round(s.cash), lifetime: Math.round(s.lifetimeEarned), jobs: s.jobs, suco: s.biz.suco.lvl, mgr: s.biz.suco.mgr,
             emp: s.biz.suco.emp, burger: s.biz.burger.lvl, skills: JSON.stringify(s.skills), props: s.props.kitnet, lux: Object.keys(s.lux).sort().join(','),
             nxs: s.hold.NXS && s.hold.NXS.qty, taps: s.stats.taps, unlocks: s.unlocks, daily: !!s.daily, bad: localStorage.getItem(G.KEYS.bad) };
  });
  check('Atualizado para o formato atual', cur.v === 2 && cur.version === '1.1.0', 'v' + cur.v + ' / ' + cur.version);
  for (const k of ['jobs', 'suco', 'mgr', 'emp', 'burger', 'skills', 'props', 'lux', 'nxs', 'taps']) check('Preservado: ' + k, cur[k] === oldInfo[k], oldInfo[k] + ' → ' + cur[k]);
  check('Dinheiro preservado (sem perdas)', cur.cash >= oldInfo.cash, oldInfo.cash + ' → ' + cur.cash);
  check('Faturamento total preservado', cur.lifetime >= oldInfo.lifetime);
  check('Jogador antigo mantém abas desbloqueadas', cur.unlocks.inv && cur.unlocks.lux);
  check('Missões diárias criadas para o save antigo', cur.daily);
  check('Nenhum save marcado como corrompido', cur.bad === null);
  check('Sem erros de JS na atualização', errors.length === 0, errors.join(' | '));
  await browser.close();
  server.close();
  fs.rmSync(oldDir, { recursive: true, force: true });
  const failed = results.filter(x => !x).length;
  console.log(`\n${results.length - failed}/${results.length} verificações passaram.`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(2); });
