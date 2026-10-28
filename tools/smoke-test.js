#!/usr/bin/env node
/* Teste de fumaça no navegador (Chromium/Playwright) com viewport de celular e toque.
 * Uso: node tools/smoke-test.js [pasta_de_screenshots]
 * Verifica: abre sem erros, toque gera dinheiro, compras, todas as abas, save persiste após recarregar,
 * ganhos offline, rotação para paisagem e volta. */
'use strict';
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', 'www');
const OUT = process.argv[2] || path.join(__dirname, '..', 'test-shots');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const results = [];
function check(name, ok, info) { results.push({ name, ok: !!ok, info }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : '')); }

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') });

  await page.goto(url);
  await page.waitForSelector('#tapBtn');
  await page.waitForTimeout(400);
  await shot('01-tutorial-inicio');
  check('Abre sem erros de JS', errors.length === 0, errors.join(' | '));

  // toques
  const box = await page.locator('#tapBtn').boundingBox();
  for (let i = 0; i < 30; i++) await page.touchscreen.tap(box.x + box.width / 2 + (i % 5) * 6, box.y + box.height / 2);
  await page.waitForTimeout(300);
  const cash1 = await page.evaluate(() => G.s.cash);
  check('Toque gera dinheiro', cash1 >= 25, 'cash=' + cash1.toFixed(1));
  await shot('02-apos-toques');

  await page.locator('#jobBtn').click();
  await page.waitForTimeout(300);
  check('Comprar emprego', await page.evaluate(() => G.s.jobs) === 1);
  for (let i = 0; i < 10; i++) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(400);
  // o tutorial leva para Negócios
  await page.locator('#biz-suco .btn').first().click();
  await page.waitForTimeout(300);
  check('Abrir primeiro negócio', await page.evaluate(() => G.s.biz.suco.lvl) >= 1);
  await page.locator('#biz-suco .ico').click();
  await page.waitForTimeout(1800);
  check('Produção manual paga', await page.evaluate(() => G.s.stats.bizRuns) >= 1);
  await shot('03-negocios-tutorial');
  await page.waitForTimeout(400);
  const tutStep = await page.evaluate(() => G.s.tutorial);
  check('Tutorial avança até a etapa final', tutStep === 4, 'etapa=' + tutStep);
  await page.locator('.tut-bubble .btn').click();

  // dinheiro de teste para explorar sistemas
  await page.evaluate(() => { G.earn(5e6); UI.update(); });
  await page.locator('#tabbar [data-tab=biz]').click();
  for (let i = 0; i < 3; i++) await page.locator('#biz-suco .biz-actions .btn').nth(1).click().catch(() => {});
  await page.locator('#biz-burger .btn').first().click();
  await page.locator('#biz-escola .btn').first().click();
  await page.waitForTimeout(300);
  check('Gerente contratado', await page.evaluate(() => G.s.biz.suco.mgr));
  check('3 negócios abertos', await page.evaluate(() => E.ownedCount(G.s)) >= 3);
  await shot('04-negocios');

  await page.locator('#tabbar [data-tab=inv]').click();
  await page.waitForTimeout(300);
  await page.locator('#tradeBuy').click();
  await page.waitForTimeout(300);
  const held = await page.evaluate(() => G.s.hold.NXS && G.s.hold.NXS.qty);
  check('Comprar ação', held >= 1, 'qty=' + held);
  await page.evaluate(() => { for (let i = 0; i < 40; i++) M.step(G.s, Math.random); UI.update(); });
  await page.waitForTimeout(300);
  await shot('05-bolsa');
  await page.locator('#tradeSell').click();
  check('Vender ação', await page.evaluate(() => G.s.hold.NXS.qty) === 0);
  await page.locator('.seg button', { hasText: 'Imóveis' }).click();
  await page.waitForTimeout(200);
  await shot('06-imoveis');

  await page.locator('#tabbar [data-tab=lux]').click();
  await page.locator('#lux-w1 .btn').click();
  await page.locator('#lux-c1 .btn').click();
  await page.locator('#lux-a1 .btn').click();
  await page.waitForTimeout(300);
  check('3 itens de luxo comprados', await page.evaluate(() => Object.keys(G.s.lux).length) === 3);
  await shot('07-luxo');

  await page.locator('#tabbar [data-tab=more]').click();
  await page.waitForTimeout(200);
  await shot('08-financas');
  await page.locator('#scr-more .seg button', { hasText: 'Torneio' }).click();
  await page.waitForTimeout(200);
  await shot('09-torneio');
  await page.locator('#scr-more .seg button', { hasText: 'Legado' }).click();
  await page.waitForTimeout(200);
  await shot('10-legado');
  await page.locator('#scr-more .seg button', { hasText: 'Ajustes' }).click();
  await page.waitForTimeout(200);
  await shot('11-ajustes');

  // anúncio voluntário (demonstração)
  await page.locator('#tabbar [data-tab=home]').click();
  await page.locator('.ad-row .btn').first().click();
  await page.waitForSelector('.ad-screen');
  await shot('12-anuncio-demo');
  await page.waitForTimeout(5300);
  await page.locator('.ad-screen [data-a=ok]').click();
  check('Turbo x2 por anúncio voluntário', await page.evaluate(() => G.s.boost.adUntil > Date.now()));
  await shot('13-inicio-turbo');

  // persistência
  const before = await page.evaluate(() => ({ lvl: G.s.biz.suco.lvl, lux: Object.keys(G.s.lux).length, jobs: G.s.jobs }));
  await page.evaluate(() => Game.save());
  await page.reload();
  await page.waitForSelector('#tapBtn');
  const after = await page.evaluate(() => ({ lvl: G.s.biz.suco.lvl, lux: Object.keys(G.s.lux).length, jobs: G.s.jobs }));
  check('Save persiste após recarregar', JSON.stringify(before) === JSON.stringify(after), JSON.stringify(after));

  // offline: simula 3 horas fora
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem(D.SAVE_KEY)); s.lastSeen -= 3 * 3600 * 1000; localStorage.setItem(D.SAVE_KEY, JSON.stringify(s)); });
  await page.evaluate(() => { window.__noSave = true; });
  // recarrega sem deixar o pagehide sobrescrever o save adulterado
  await page.evaluate(() => { G.save = () => true; });
  await page.reload();
  await page.waitForSelector('.modal');
  const offTxt = await page.locator('.modal').innerText();
  check('Modal de ganhos offline', /Bem-vindo/.test(offTxt) && /3h/.test(offTxt), offTxt.replace(/\n/g, ' ').slice(0, 120));
  await shot('14-offline');
  await page.locator('.modal .btn', { hasText: 'Coletar' }).click();

  // rotação
  await page.setViewportSize({ width: 851, height: 393 });
  await page.waitForTimeout(300);
  await shot('15-paisagem');
  const okLand = await page.evaluate(() => document.getElementById('app').getBoundingClientRect().width <= 520 && !!document.getElementById('tapBtn').offsetWidth);
  check('Layout sobrevive à rotação (paisagem)', okLand);
  await page.setViewportSize({ width: 393, height: 851 });
  await page.waitForTimeout(300);
  await shot('16-retrato-de-volta');
  const stateOk = await page.evaluate(() => G.s.biz.suco.lvl > 0);
  check('Estado intacto após rotacionar', stateOk);

  // telas pequenas
  await page.setViewportSize({ width: 320, height: 640 });
  await page.locator('#tabbar [data-tab=biz]').click();
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.querySelector('#scr-biz').scrollWidth > document.querySelector('#scr-biz').clientWidth + 1);
  check('Sem rolagem horizontal em tela 320px', !overflow);
  await shot('17-tela-pequena');

  check('Nenhum erro de JS durante o teste', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  server.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} verificações passaram. Screenshots em ${OUT}`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(2); });
