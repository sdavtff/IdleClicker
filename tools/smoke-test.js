#!/usr/bin/env node
/* Teste de ponta a ponta no navegador (Chromium/Playwright) com viewport de celular e toque.
 * Uso: node tools/smoke-test.js [pasta_de_screenshots]
 * Cobre: abertura sem erros, tutorial, toque, compras, abas (inclusive bloqueadas), bolsa, luxo, missões,
 * conquistas, bônus sem anúncio falso, importação maliciosa/ inválida, save corrompido, persistência,
 * ganhos offline, rotação, tela pequena, reduzir animações e desempenho em sessão longa. */
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
  page.on('dialog', d => { errors.push('dialog inesperado: ' + d.message()); d.dismiss(); });
  const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') });
  const wait = (ms) => page.waitForTimeout(ms);

  await page.goto(url);
  await page.waitForSelector('#tapBtn');
  await wait(400);
  check('Tela de carregamento some após o boot', await page.locator('#loading').count() === 0);
  await shot('01-tutorial-inicio');
  check('Abre sem erros de JS', errors.length === 0, errors.join(' | '));

  // abas bloqueadas no começo
  await page.locator('#tabbar [data-tab=inv]').click();
  await wait(200);
  check('Aba Investir começa bloqueada com tela explicativa', await page.locator('#scr-locked.active').isVisible() &&
    /Desbloqueia ao faturar/.test(await page.locator('#scr-locked').innerText()));
  await shot('02-aba-bloqueada');
  await page.locator('#tabbar [data-tab=home]').click();

  // toques
  const box = await page.locator('#tapBtn').boundingBox();
  for (let i = 0; i < 30; i++) await page.touchscreen.tap(box.x + box.width / 2 + (i % 5) * 6, box.y + box.height / 2);
  await wait(300);
  const cash1 = await page.evaluate(() => G.s.cash);
  check('Toque gera dinheiro', cash1 >= 25, 'cash=' + cash1.toFixed(1));

  await page.locator('#jobBtn').click();
  await wait(300);
  check('Comprar emprego', await page.evaluate(() => G.s.jobs) === 1);
  for (let i = 0; i < 10; i++) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await wait(400);
  await page.locator('#biz-suco .btn').first().click();
  await wait(300);
  check('Abrir primeiro negócio', await page.evaluate(() => G.s.biz.suco.lvl) >= 1);
  await page.locator('#biz-suco .ico').click();
  await wait(1800);
  check('Produção manual paga', await page.evaluate(() => G.s.stats.bizRuns) >= 1);
  await wait(400);
  const tutStep = await page.evaluate(() => G.s.tutorial);
  check('Tutorial avança até a etapa final', tutStep === 4, 'etapa=' + tutStep);
  await page.locator('.tut-bubble .btn').click();

  // missões diárias
  await page.locator('#tabbar [data-tab=home]').click();
  await wait(200);
  check('Cartão de missões diárias com 3 missões', await page.locator('#dailyCard .mission:visible').count() === 3);
  await page.evaluate(() => { G.s.daily.list.forEach(m => { const d = D.DAILY_BY_ID[m.id]; G.s.stats[d.stat === 'earned' ? 'prodEarned' : d.stat] += m.target; }); UI.update(); });
  for (let i = 0; i < 3; i++) await page.locator('#dailyCard .mbtn').nth(i).click();
  await page.locator('#dailyBonus').click();
  await wait(200);
  check('Resgatar missões e baú diário', await page.evaluate(() => G.s.daily.bonus && G.s.daily.list.every(m => m.claimed)));
  await page.locator('#dailyCard').scrollIntoViewIfNeeded();
  await shot('03-missoes');

  // bônus sem anúncio falso
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('.ad-row .btn').first().click();
  await wait(300);
  check('Turbo grátis ativa sem tela de anúncio simulado', await page.locator('.ad-screen').count() === 0 && await page.evaluate(() => G.s.boost.adUntil > Date.now()));
  await page.locator('.ad-row .btn').first().click();
  await wait(200);
  check('Turbo grátis respeita a recarga', await page.evaluate(() => G.s.stats.bonusUsed) === 1);

  // dinheiro de teste para explorar sistemas
  await page.evaluate(() => { G.earn(5e6); UI.update(); });
  await wait(500);
  await page.locator('#tabbar [data-tab=biz]').click();
  for (let i = 0; i < 3; i++) await page.locator('#biz-suco .biz-actions .btn').nth(1).click().catch(() => {});
  await page.locator('#biz-burger .btn').first().click();
  await page.locator('#biz-escola .btn').first().click();
  await wait(300);
  check('Gerente contratado', await page.evaluate(() => G.s.biz.suco.mgr));
  check('3 negócios abertos', await page.evaluate(() => E.ownedCount(G.s)) >= 3);
  await shot('04-negocios');

  await page.locator('#tabbar [data-tab=inv]').click();
  await wait(300);
  check('Investir desbloqueado após faturar', await page.locator('#scr-inv.active').isVisible());
  await page.locator('#tradeBuy').click();
  await wait(300);
  const held = await page.evaluate(() => G.s.hold.NXS && G.s.hold.NXS.qty);
  check('Comprar ação', held >= 1, 'qty=' + held);
  await page.evaluate(() => { for (let i = 0; i < 40; i++) M.step(G.s, Math.random); UI.update(); });
  await wait(300);
  await shot('05-bolsa');
  await page.locator('#tradeSell').click();
  check('Vender ação', await page.evaluate(() => !G.s.hold.NXS));
  await page.locator('.seg button', { hasText: 'Imóveis' }).click();
  await wait(200);
  await shot('06-imoveis');

  await page.locator('#tabbar [data-tab=lux]').click();
  await page.locator('#lux-w1 .btn').click();
  await page.locator('#lux-c1 .btn').click();
  await page.locator('#lux-a1 .btn').click();
  await wait(300);
  check('3 itens de luxo comprados', await page.evaluate(() => Object.keys(G.s.lux).length) === 3);
  await shot('07-luxo');

  await page.locator('#tabbar [data-tab=more]').click();
  await wait(200);
  await shot('08-financas');
  await page.locator('#scr-more .seg button', { hasText: 'Conquistas' }).click();
  await wait(200);
  const achDone = await page.locator('.ach.done').count();
  check('Conquistas listadas e algumas concluídas', await page.locator('.ach').count() === await page.evaluate(() => D.ACHIEVEMENTS.length) && achDone >= 3, 'concluídas=' + achDone);
  await shot('09-conquistas');
  await page.locator('#scr-more .seg button', { hasText: 'Torneio' }).click();
  await wait(200);
  check('Torneio indica rivais simulados', /rivais simulados/i.test(await page.locator('#scr-more').innerText()));
  await shot('10-torneio');
  await page.locator('#scr-more .seg button', { hasText: 'Legado' }).click();
  await wait(200);
  await shot('11-legado');
  await page.locator('#scr-more .seg button', { hasText: 'Ajustes' }).click();
  await wait(300);
  const setTxt = await page.locator('#scr-more').innerText();
  check('Ajustes não oferecem compra simulada', !/simulad/i.test(setTxt) && await page.locator('#noAdsBtn').isHidden());
  await shot('12-ajustes');

  // importação inválida
  const stable = () => page.evaluate(() => JSON.stringify([Object.keys(G.s.biz).map(k => G.s.biz[k].lvl), G.s.jobs, G.s.lux, G.s.stars]));
  const before = await stable();
  await page.locator('#scr-more textarea').fill('isto não é um save');
  await page.locator('#scr-more button', { hasText: 'Importar save' }).click();
  await wait(300);
  check('Importação inválida mostra erro e não altera o jogo', /❌/.test(await page.locator('#toasts').innerText()) && await stable() === before);

  // importação maliciosa (tentativa de XSS e valores absurdos)
  const evil = await page.evaluate(() => {
    const s = JSON.parse(JSON.stringify(G.s));
    s.news = [{ id: 'NXS', t: 1, up: true, txt: '<img src=x onerror="window.__xss=1">Golpe' }];
    s.stars = '<img src=x onerror="window.__xss=2">';
    s.cash = 'NaN'; s.biz.suco.lvl = -50;
    s.tour.pending = { rank: '<script>window.__xss=3</script>', week: 1, score: 1 };
    return SaveIO.encode(s);
  });
  await page.locator('#scr-more textarea').fill(evil);
  await page.locator('#scr-more button', { hasText: 'Importar save' }).click();
  await page.waitForSelector('.modal');
  await shot('13-confirmar-importacao');
  await page.locator('.modal .btn', { hasText: 'Importar' }).click();
  await wait(300);
  await page.evaluate(() => { G.s.unlocks.inv = true; });
  await page.locator('#tabbar [data-tab=inv]').click();
  await page.locator('#scr-inv .seg button', { hasText: 'Ações' }).click();
  await page.locator('#tabbar [data-tab=more]').click();
  await page.locator('#scr-more .seg button', { hasText: 'Torneio' }).click();
  await wait(400);
  const xss = await page.evaluate(() => ({ flag: window.__xss, imgs: document.querySelectorAll('.news img, #scr-more img, .toast img').length, cash: G.s.cash, lvl: G.s.biz.suco.lvl, stars: G.s.stars }));
  check('Save malicioso não executa código e é saneado', xss.flag === undefined && xss.imgs === 0 && xss.cash < 100 && xss.lvl === 0 && xss.stars === 0, JSON.stringify(xss));
  check('Backup "antes da importação" disponível', await page.evaluate(() => !!G.backupInfo().pre));

  // restaura o estado anterior pelo backup
  await page.locator('#scr-more .seg button', { hasText: 'Ajustes' }).click();
  await wait(300);
  await page.locator('.bak-row', { hasText: 'Antes da última' }).locator('button').click();
  await page.locator('.modal .btn', { hasText: 'Restaurar' }).click();
  await wait(300);
  check('Restaurar backup devolve o progresso anterior', await page.evaluate(() => Object.keys(G.s.lux).length) === 3);

  // reduzir animações
  await page.locator('#tabbar [data-tab=more]').click();
  await page.locator('#scr-more .seg button', { hasText: 'Ajustes' }).click();
  await page.locator('.toggle', { hasText: 'Reduzir animações' }).locator('.switch').click();
  check('Reduzir animações aplica classe global', await page.evaluate(() => document.body.classList.contains('reduce-motion')));
  await page.locator('.toggle', { hasText: 'Reduzir animações' }).locator('.switch').click();

  // persistência
  await page.locator('#tabbar [data-tab=home]').click();
  const snap = await page.evaluate(() => ({ lvl: G.s.biz.suco.lvl, lux: Object.keys(G.s.lux).length, jobs: G.s.jobs, ach: Object.keys(G.s.ach).length }));
  await page.evaluate(() => Game.save());
  await page.reload();
  await page.waitForSelector('#tapBtn');
  const after = await page.evaluate(() => ({ lvl: G.s.biz.suco.lvl, lux: Object.keys(G.s.lux).length, jobs: G.s.jobs, ach: Object.keys(G.s.ach).length }));
  check('Save persiste após recarregar', JSON.stringify(snap) === JSON.stringify(after), JSON.stringify(after));

  // offline: simula 3 horas fora
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem(D.SAVE_KEY));
    s.lastSeen -= 3 * 3600 * 1000; s.clockMax -= 3 * 3600 * 1000;
    G.save = () => true; // impede o pagehide de sobrescrever o save ajustado
    localStorage.setItem(D.SAVE_KEY, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForSelector('.modal');
  const offTxt = await page.locator('.modal').innerText();
  check('Resumo de ganhos offline com detalhamento', /Bem-vindo/.test(offTxt) && /3h/.test(offTxt) && /Negócios com gerente/.test(offTxt), offTxt.replace(/\n/g, ' ').slice(0, 140));
  check('Sem botão de "dobrar" quando não há anúncio real', !/Dobrar/.test(offTxt));
  await shot('14-offline');
  await page.locator('.modal .btn', { hasText: 'Coletar' }).click();
  await page.evaluate(() => Game.save());

  // save corrompido no boot
  await page.evaluate(() => {
    localStorage.setItem(G.KEYS.auto, localStorage.getItem(D.SAVE_KEY));
    G.save = () => true;
    localStorage.setItem(D.SAVE_KEY, '{"biz": quebrado');
  });
  await page.reload();
  await page.waitForSelector('.modal');
  const recTxt = await page.locator('.modal').innerText();
  check('Save danificado é recuperado do backup e o original é preservado',
    /recuperado/i.test(recTxt) && await page.evaluate(() => localStorage.getItem(G.KEYS.bad) === '{"biz": quebrado' && G.s.biz.suco.lvl > 0));
  await shot('15-save-recuperado');
  await page.locator('.modal .btn').click();

  // rotação
  await page.setViewportSize({ width: 851, height: 393 });
  await wait(300);
  const okLand = await page.evaluate(() => document.getElementById('app').getBoundingClientRect().width <= 520 && !!document.getElementById('tapBtn').offsetWidth);
  check('Layout sobrevive à rotação (paisagem)', okLand);
  await page.setViewportSize({ width: 393, height: 851 });
  await wait(300);
  check('Estado intacto após rotacionar', await page.evaluate(() => G.s.biz.suco.lvl > 0));

  // telas pequenas e texto maior
  await page.setViewportSize({ width: 320, height: 640 });
  await page.evaluate(() => { G.s.settings.bigText = true; UI.applySettings(); });
  let overflow = false;
  for (const tab of ['home', 'biz', 'inv', 'lux', 'more']) {
    await page.locator('#tabbar [data-tab=' + tab + ']').click();
    await wait(150);
    overflow = overflow || await page.evaluate(() => { const el = document.querySelector('.screen.active'); return el.scrollWidth > el.clientWidth + 1; });
  }
  check('Sem rolagem horizontal em tela 320px com texto maior', !overflow);
  await shot('16-tela-pequena-texto-maior');
  await page.evaluate(() => { G.s.settings.bigText = false; UI.applySettings(); });
  await page.setViewportSize({ width: 393, height: 851 });

  // desempenho: custo do UI.update e estabilidade do DOM numa sessão longa
  await page.locator('#tabbar [data-tab=biz]').click();
  const perf = await page.evaluate(async () => {
    const t0 = performance.now();
    for (let i = 0; i < 300; i++) UI.update();
    const upd = (performance.now() - t0) / 300;
    const n0 = document.getElementsByTagName('*').length;
    const btn = document.getElementById('tapBtn');
    UI.go('home');
    for (let i = 0; i < 400; i++) {
      btn.dispatchEvent(new PointerEvent('pointerdown', { clientX: 200, clientY: 300, bubbles: true }));
      G.tick(0.25);
      if (i % 4 === 0) UI.update();
    }
    await new Promise(r => setTimeout(r, 1500)); // animações terminam e elementos são removidos
    const n1 = document.getElementsByTagName('*').length;
    return { upd: upd, n0: n0, n1: n1, fx: document.getElementById('fx').children.length };
  });
  check('UI.update rápido (< 4 ms em média)', perf.upd < 4, perf.upd.toFixed(2) + ' ms');
  check('Sem vazamento de elementos após 400 toques', perf.fx === 0 && Math.abs(perf.n1 - perf.n0) < 40, JSON.stringify(perf));

  // ---- v2.0: sistemas novos ----
  await page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; G.earn(1e12); G.addMedals(300, 'teste'); UI.go('home'); });
  check('Banner do evento de setor na tela Início', /\+25% em/.test(await page.locator('.sector-banner').innerText()));
  await page.locator('#dailyCard .seg button', { hasText: 'Semanais' }).click();
  await wait(200);
  check('Aba de desafios semanais com 3 desafios', /Desafios da semana/.test(await page.locator('#dailyCard').innerText()) && await page.locator('#dailyCard .mission:visible').count() === 3);
  await page.locator('#dailyCard .seg button', { hasText: 'Diárias' }).click();
  // empresa: detalhe e melhoria
  await page.locator('#tabbar [data-tab=biz]').click();
  await page.evaluate(() => { G.buyBiz('suco', 30); UI.update(); });
  await wait(250);
  await page.locator('#biz-suco .upg-pill').click();
  await page.waitForSelector('.modal .biz-detail');
  const det = await page.locator('.modal').innerText();
  check('Detalhe da empresa mostra estatísticas e melhorias', /Ciclos concluídos/.test(det) && /Campanha de marketing/.test(det) && /Eficiência/.test(det));
  await shot('v2-01-detalhe-empresa');
  await page.locator('.modal .upg-row').first().locator('button').click();
  await wait(250);
  check('Comprar melhoria pelo detalhe da empresa', await page.evaluate(() => G.s.biz.suco.up) === 1);
  await page.locator('.modal .btn', { hasText: 'Fechar' }).click();
  await page.evaluate(() => { const e = document.querySelector('#biz-suco'); e.scrollIntoView({ block: 'center' }); });
  await wait(200);
  await shot('v2-02-negocios');
  // imóveis: reforma
  await page.locator('#tabbar [data-tab=inv]').click();
  await page.locator('#scr-inv .seg button', { hasText: 'Imóveis' }).click();
  await page.evaluate(() => { G.buyProp('kitnet'); UI.update(); });
  await wait(250);
  await page.locator('#prop-kitnet .upg-pill').click();
  check('Reformar imóvel', await page.evaluate(() => E.renoLvl(G.s, 'kitnet')) === 1);
  await page.locator('#scr-inv .seg button', { hasText: 'Ações' }).click();
  await page.evaluate(() => { G.buyAsset('MEL', 100); UI.update(); });
  await wait(250);
  check('Resumo da carteira com dividendos', /dividendos/i.test(await page.locator('#scr-inv .portfolio').first().innerText()));
  // loja de mérito e exclusivo
  await page.locator('#tabbar [data-tab=lux]').click();
  await page.locator('#scr-lux .seg button', { hasText: 'Loja de Mérito' }).click();
  await wait(200);
  await page.locator('#merit-minc').click();
  check('Comprar melhoria na Loja de Mérito', await page.evaluate(() => E.meritLvl(G.s, 'minc')) === 1);
  await shot('v2-03-loja-merito');
  await page.locator('#scr-lux .seg button', { hasText: 'Coleção' }).click();
  await page.locator('#lux-x1 .btn').click();
  check('Resgatar exclusivo de mérito', await page.evaluate(() => G.s.lux.x1 === true));
  // perfil
  await page.locator('#hud .profile').click();
  await page.waitForSelector('.modal');
  check('Perfil do império abre com nível, patente e medalhas', /nível do império/i.test(await page.locator('.modal').innerText()));
  await shot('v2-04-perfil');
  await page.locator('.modal .btn', { hasText: 'Fechar' }).click();
  // finanças: gráfico e ranking
  await page.evaluate(() => { G.sampleNetWorth(Date.now() - 120000); G.sampleNetWorth(Date.now() - 60000); });
  await page.locator('#tabbar [data-tab=more]').click();
  await page.locator('#scr-more .seg button', { hasText: 'Finanças' }).click();
  await wait(300);
  const fin2 = await page.locator('#scr-more').innerText();
  check('Finanças: evolução do patrimônio, composição e ranking de empresas', /evolução do patrimônio/i.test(fin2) && /de onde vem sua renda/i.test(fin2) && /Suco da Esquina/.test(fin2));
  await shot('v2-05-financas');
  // corrida empresarial: resgate de prêmio pendente
  await page.evaluate(() => { G.s.race.pending = { rank: 2, week: G.s.race.week - 1, score: 1e9 }; });
  await page.locator('#scr-more .seg button', { hasText: 'Torneios' }).click();
  await page.locator('#scr-more .seg button', { hasText: 'Corrida' }).click();
  await wait(250);
  const bal0 = await page.evaluate(() => G.s.merit.bal);
  await page.locator('#scr-more button', { hasText: 'Resgatar prêmio' }).click();
  await wait(250);
  check('Resgatar prêmio da Corrida Empresarial (medalhas)', await page.evaluate((b) => G.s.merit.bal === b + 15 && !G.s.race.pending, bal0));
  await page.locator('.modal .btn').first().click();
  await shot('v2-06-corrida');
  await page.locator('#scr-more .seg button', { hasText: 'Legado' }).click();
  await wait(200);
  check('Legado mostra patentes', /patentes de legado/i.test(await page.locator('#scr-more').innerText()) && /Barão/.test(await page.locator('#scr-more').innerText()));
  await page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; UI.go('home'); });

  // ---- v1.1.1: funcionalidades revisadas ----
  await page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; UI.go('home'); });
  // detalhe da meta ao tocar
  await page.locator('#goals .goal.short').click();
  await page.waitForSelector('.modal');
  check('Tocar numa meta abre o detalhe com progresso', /Meta de curto prazo/.test(await page.locator('.modal').innerText()));
  await page.locator('.modal .btn').click();
  // rever tutorial com etapas já cumpridas: não pula sozinho
  await page.locator('#tabbar [data-tab=more]').click();
  await page.locator('#scr-more .seg button', { hasText: 'Ajustes' }).click();
  await page.locator('#scr-more button', { hasText: 'Rever tutorial' }).click();
  await wait(700);
  const t0 = await page.evaluate(() => G.s.tutorial);
  check('Rever tutorial mostra a 1ª etapa e espera o jogador', t0 === 0 && await page.locator('.tut-bubble .btn', { hasText: 'Próximo' }).isVisible(), 'etapa=' + t0);
  for (let i = 0; i < 4; i++) { await page.locator('.tut-bubble .btn').first().click(); await wait(250); }
  await page.locator('.tut-bubble .btn', { hasText: 'Vamos lá' }).click();
  check('Tutorial revisto termina normalmente', await page.evaluate(() => G.s.tutorial) === -1 && await page.locator('.tut-bubble').count() === 0);
  // interruptores acessíveis
  await page.locator('#tabbar [data-tab=more]').click();
  await page.locator('#scr-more .seg button', { hasText: 'Ajustes' }).click();
  const sw = page.locator('button.toggle', { hasText: 'Vibração' });
  const a1 = await sw.getAttribute('aria-checked');
  await sw.click(); await wait(250);
  const a2 = await sw.getAttribute('aria-checked');
  await sw.click(); await wait(250);
  check('Interruptor inteiro é clicável e informa estado (aria-checked)', a1 !== a2 && (a2 === 'true' || a2 === 'false'), a1 + '→' + a2);
  // painel financeiro: linhas novas e coerentes
  await page.evaluate(() => { G.earn(1e7); G.buyBiz('pixel', 5); G.hireEmployee('pixel'); G.runBiz('pixel'); });
  await page.locator('#scr-more .seg button', { hasText: 'Finanças' }).click();
  await wait(400);
  const fin = await page.locator('#scr-more').innerText();
  check('Painel mostra salários, produção manual, medido e totais pagos',
    /Salários de funcionários/.test(fin) && /Sem gerente/.test(fin) && /Medido nos últimos/.test(fin) && /Total já pago em salários/.test(fin));
  // exceção no laço não congela o jogo
  const errBefore = errors.length;
  const resil = await page.evaluate(async () => {
    const orig = UI.frame; let thrown = false;
    UI.frame = function () { if (!thrown) { thrown = true; throw new Error('erro de teste proposital'); } return orig.apply(this, arguments); };
    const p0 = G.s.stats.playSec;
    await new Promise(r => setTimeout(r, 1200));
    UI.frame = orig;
    return { thrown, advanced: G.s.stats.playSec - p0 };
  });
  errors.splice(errBefore); // o erro proposital não conta
  check('Jogo continua rodando após uma exceção no laço', resil.thrown && resil.advanced > 0.5, JSON.stringify(resil));
  // estado extremo: números gigantes não viram NaN/Infinity na tela
  const extreme = await page.evaluate(async () => {
    const s = G.s;
    s.cash = 1e300; s.lifetimeEarned = 1e300; s.runEarned = 1e300;
    D.BUSINESSES.forEach(b => { s.biz[b.id].lvl = 5000; s.biz[b.id].mgr = true; s.biz[b.id].emp = 10; });
    G.buyBiz('suco', 'max'); G.buyAsset('GATO', 'max');
    const bad = [];
    for (const tab of ['home', 'biz', 'inv', 'lux', 'more']) {
      UI.go(tab); UI.update();
      const t = document.body.innerText;
      if (/NaN|Infinity|undefined/.test(t)) bad.push(tab);
    }
    return { bad, cash: s.cash, finite: Number.isFinite(s.cash) };
  });
  check('Estado extremo (1e300) sem NaN/Infinity/undefined na interface', extreme.bad.length === 0 && extreme.finite, JSON.stringify(extreme));
  await page.evaluate(() => { G.reset(); G.s.tutorial = -1; UI.go('home'); });

  check('Nenhum erro de JS durante o teste', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  server.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} verificações passaram. Screenshots em ${OUT}`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(2); });
