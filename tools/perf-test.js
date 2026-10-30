#!/usr/bin/env node
/* Medição de desempenho no Chromium com CPU desacelerada 4× (simula um celular modesto).
 * Mede: tempo até o jogo ficar pronto, custo médio do UI.update por tela, tempo médio de quadro e
 * memória JS antes/depois de uma sessão longa simulada (2 h de jogo acelerado + 2.000 toques).
 * Uso: node tools/perf-test.js */
'use strict';
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', 'www');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const LIMITS = { bootMs: 2500, updateMs: 8, frameMs: 16.7, heapGrowthMB: 8 };
const results = [];
const check = (n, ok, info) => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (info ? ' — ' + info : '')); };

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch({ args: ['--js-flags=--expose-gc'] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 851 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => !document.getElementById('loading') && window.G && G.s);
  const boot = Date.now() - t0;
  check('Inicialização (CPU 4× mais lenta)', boot < LIMITS.bootMs, boot + ' ms');

  // estado de meio/fim de jogo para as telas ficarem "cheias"
  await page.evaluate(() => {
    G.s.tutorial = -1; document.getElementById('tut-root').innerHTML = '';
    G.earn(1e15); G.addMedals(200, 'perf');
    D.BUSINESSES.slice(0, 9).forEach(b => { G.buyBiz(b.id, 60); G.hireManager(b.id); G.hireEmployee(b.id); G.buyUpgrade(b.id); });
    D.PROPS.slice(0, 5).forEach(p => { G.buyProp(p.id); G.renovate(p.id); });
    ['NXS', 'MEL', 'BYTE'].forEach(id => G.buyAsset(id, 100));
    for (let i = 0; i < 120; i++) G.sampleNetWorth(Date.now() - (120 - i) * 60000);
  });

  for (const [tab, sub] of [['home'], ['biz'], ['inv'], ['lux'], ['more', 'fin'], ['more', 'tour']]) {
    const ms = await page.evaluate(([tab, sub]) => {
      if (sub) UI.moreTab = sub;
      UI.go(tab);
      const n = 60, t = performance.now();
      for (let i = 0; i < n; i++) { G.tick(0.2); UI.update(); }
      return (performance.now() - t) / n;
    }, [tab, sub]);
    check('UI.update + tick na tela ' + tab + (sub ? '/' + sub : ''), ms < LIMITS.updateMs, ms.toFixed(2) + ' ms (limite ' + LIMITS.updateMs + ')');
  }

  // tempo médio de quadro real (rAF) na tela de negócios, a mais animada
  await page.evaluate(() => UI.go('biz'));
  const frame = await page.evaluate(() => new Promise(res => {
    let n = 0; const t = performance.now();
    function f() { if (++n < 120) requestAnimationFrame(f); else res((performance.now() - t) / n); }
    requestAnimationFrame(f);
  }));
  check('Tempo médio de quadro na tela Negócios', frame < LIMITS.frameMs * 1.5, frame.toFixed(1) + ' ms');

  // sessão longa: memória estável
  const heap = async () => { await page.evaluate(() => window.gc && window.gc()); const m = await cdp.send('Runtime.getHeapUsage'); return m.usedSize / 1048576; };
  const h0 = await heap();
  await page.evaluate(async () => {
    const btn = document.getElementById('tapBtn');
    UI.go('home');
    for (let i = 0; i < 28800; i++) { // 2 h de jogo em passos de 0,25 s
      G.tick(0.25);
      if (i % 40 === 0) UI.update();
      if (i % 14 === 0) btn.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, clientY: 300, bubbles: true }));
      if (i % 2000 === 0) await new Promise(r => setTimeout(r, 0));
    }
    await new Promise(r => setTimeout(r, 1500));
  });
  const h1 = await heap();
  const dom = await page.evaluate(() => ({ nodes: document.getElementsByTagName('*').length, fx: document.getElementById('fx').children.length }));
  check('Memória estável após sessão longa (2 h simuladas + 2.000 toques)', h1 - h0 < LIMITS.heapGrowthMB && dom.fx === 0,
    h0.toFixed(1) + ' → ' + h1.toFixed(1) + ' MB · ' + dom.nodes + ' nós DOM · efeitos pendentes: ' + dom.fx);
  const saveBytes = await page.evaluate(() => JSON.stringify(G.s).length);
  check('Tamanho do save', saveBytes < 200000, (saveBytes / 1024).toFixed(1) + ' KB');
  check('Sem erros de JS', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server.close();
  const failed = results.filter(x => !x).length;
  console.log(`\n${results.length - failed}/${results.length} verificações de desempenho passaram.`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(2); });
