#!/usr/bin/env node
/* Checagem visual: percorre todas as telas/subabas em vários tamanhos de celular (e com "texto maior"),
 * salva capturas e acusa: elementos que estouram a largura, alvos de toque < 40 px e textos cortados.
 * Uso: node tools/visual-check.js [pasta_de_screenshots] */
'use strict';
const path = require('path');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', 'www');
const OUT = process.argv[2] || path.join(__dirname, '..', 'test-shots', 'visual');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const SIZES = [[320, 568, 'se'], [360, 740, 'android-pequeno'], [393, 851, 'pixel'], [412, 915, 'android-grande'], [480, 1000, 'phablet']];
const VIEWS = [
  ['home', null], ['biz', null], ['inv', 'Ações'], ['inv', 'Cripto'], ['inv', 'Imóveis'], ['lux', null],
  ['more', 'Finanças'], ['more', 'Conquistas'], ['more', 'Torneio'], ['more', 'Legado'], ['more', 'Ajustes']
];

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const problems = [];
  const errors = [];
  for (const big of [false, true]) {
    for (const [w, hgt, name] of SIZES) {
      const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      page.on('pageerror', e => errors.push(String(e)));
      await page.goto(url);
      await page.waitForSelector('#tapBtn');
      // estado de meio de jogo: vários negócios, luxo, ações, evento ativo, missões
      await page.evaluate((big) => {
        G.s.tutorial = -1; document.getElementById('tut-root').innerHTML = '';
        G.earn(5e9);
        ['suco', 'burger', 'escola', 'pixel', 'radio'].forEach(id => { G.buyBiz(id, 30); G.hireManager(id); G.hireEmployee(id); });
        G.buyBiz('arena', 3);
        G.buyJob(); G.buyJob(); G.buyJob(); G.buyLux('w1'); G.buyLux('c1'); G.buyProp('kitnet'); G.buyAsset('NXS', 25);
        G.s.events.push({ id: 'x', biz: 'arena', type: 'crise', mult: 0.5, until: Date.now() + 60000, cost: 12345 });
        G.s.settings.bigText = big; UI.applySettings();
        document.getElementById('toasts').innerHTML = '';
      }, big);
      await page.waitForTimeout(600);
      for (const [tab, sub] of VIEWS) {
        await page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; });
        await page.locator('#tabbar [data-tab=' + tab + ']').click();
        if (sub) await page.locator('.screen.active .seg button', { hasText: sub }).first().click();
        await page.waitForTimeout(250);
        const label = `${name}${big ? '-texto-maior' : ''}-${tab}${sub ? '-' + sub : ''}`;
        const res = await page.evaluate(() => {
          const out = { overflow: [], small: [], clipped: [] };
          const vw = document.documentElement.clientWidth;
          const scr = document.querySelector('.screen.active');
          const roots = [document.getElementById('hud'), document.getElementById('tabbar'), scr];
          roots.forEach(root => root.querySelectorAll('*').forEach(el => {
            if (!el.offsetParent && el.tagName !== 'BODY') return;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            if (r.right > vw + 1 || r.left < -1) out.overflow.push((el.id || el.className || el.tagName) + ' ' + Math.round(r.left) + '→' + Math.round(r.right));
            if (el.tagName === 'BUTTON' && (r.height < 40 || r.width < 40) && !el.closest('.tut-bubble')) out.small.push((el.textContent || el.getAttribute('aria-label') || el.className).trim().slice(0, 30) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
          }));
          scr.querySelectorAll('.title, .btn').forEach(el => {
            if (!el.offsetParent) return;
            if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).textOverflow !== 'ellipsis') out.clipped.push(el.textContent.trim().slice(0, 40));
          });
          if (scr.scrollWidth > scr.clientWidth + 1) out.overflow.push('tela com rolagem horizontal');
          return out;
        });
        for (const k of ['overflow', 'small', 'clipped']) res[k].forEach(p => problems.push(`${label}: ${k}: ${p}`));
        await page.screenshot({ path: path.join(OUT, label + '.png') });
      }
      await ctx.close();
    }
  }
  await browser.close();
  server.close();
  const uniq = [...new Set(problems)];
  uniq.forEach(p => console.log('PROBLEMA ' + p));
  console.log(`\n${uniq.length} problema(s) visual(is); ${errors.length} erro(s) de JS. Capturas em ${OUT}`);
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
  process.exit(uniq.length || errors.length ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(2); });
