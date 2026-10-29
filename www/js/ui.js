/* Interface (DOM): HUD, abas, telas, efeitos, toasts e modais. Construída uma vez; atualizada no lugar. */
(function (root) {
  'use strict';
  var D = root.D, E = root.E, M = root.M, G = root.G, F = root.F;

  // ---------- helpers ----------
  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === undefined || v === null) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { add(el, x); });
    else el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function txt(el, v) { if (el.textContent !== v) el.textContent = v; }
  function html(el, v) { if (el._h !== v) { el._h = v; el.innerHTML = v; } }
  function cls(el, c, on) { if (el.classList.contains(c) !== !!on) el.classList.toggle(c, !!on); }
  function show(el, on) { cls(el, 'hidden', !on); }
  function vibrate(ms) { try { if (G.s.settings.vib && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  function btnLabel(btn, main, sub) { html(btn, main + (sub ? '<small>' + sub + '</small>' : '')); }
  // Escapa texto para inserção segura em HTML (dados vindos de save/importação nunca entram crus).
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(v) { return String(v).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  // Modo dos bônus: 'ad' (anúncio recompensado real), 'paid' (comprou remover anúncios) ou 'free' (sem SDK de anúncios).
  function bonusMode() { return G.s.noAds ? 'paid' : (root.AdService.available() ? 'ad' : 'free'); }
  var MODE_ICON = { ad: '▶ ', paid: '⚡ ', free: '🎁 ' };

  // Executa uma ação de compra com feedback (som, vibração ou tremida)
  function act(btn, fn) {
    var ok = fn();
    if (ok) { root.Sfx.buy(); vibrate(12); UI.update(); }
    else { root.Sfx.error(); btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake'); }
    return ok;
  }

  var UI = { tab: 'home', bizMode: 1, invTab: 'stock', sel: { stock: 'NXS', crypto: 'BYTE' }, qty: 1, moreTab: 'fin', screens: {} };
  root.UI = UI;
  UI.h = h;
  UI.esc = esc;
  UI.bonusMode = bonusMode;

  var LOGO_SVG =
    '<svg viewBox="0 0 100 100" aria-hidden="true">' +
    '<circle cx="50" cy="50" r="45" fill="none" stroke="#9a4a00" stroke-width="3" opacity=".55"/>' +
    '<circle cx="50" cy="50" r="38" fill="none" stroke="#fff3c4" stroke-width="1.5" opacity=".5"/>' +
    '<g fill="#7a3500">' +
    '<rect x="20" y="54" width="11" height="22" rx="1.5"/><rect x="33" y="40" width="11" height="36" rx="1.5"/>' +
    '<rect x="46" y="26" width="12" height="50" rx="1.5"/><rect x="60" y="44" width="11" height="32" rx="1.5"/>' +
    '<rect x="73" y="58" width="8" height="18" rx="1.5"/><polygon points="52,14 55,22 49,22"/></g>' +
    '<g fill="#ffe28a">' +
    '<rect x="36" y="45" width="2.5" height="3"/><rect x="40" y="45" width="2.5" height="3"/><rect x="36" y="52" width="2.5" height="3"/>' +
    '<rect x="49" y="32" width="2.5" height="3"/><rect x="53" y="32" width="2.5" height="3"/><rect x="49" y="40" width="2.5" height="3"/>' +
    '<rect x="53" y="48" width="2.5" height="3"/><rect x="63" y="50" width="2.5" height="3"/><rect x="23" y="60" width="2.5" height="3"/></g>' +
    '<text x="50" y="91" text-anchor="middle" font-size="11" font-weight="900" fill="#7a3500" font-family="sans-serif">$ CIFRÓPOLIS $</text>' +
    '</svg>';
  UI.LOGO_SVG = LOGO_SVG;

  // ---------- efeitos ----------
  var fxRoot, fxCount = 0;
  UI.floatText = function (x, y, text, color) {
    if (fxCount > 40) return;
    var el = h('div', { class: 'float', text: text });
    el.style.left = x + 'px'; el.style.top = y + 'px';
    if (color) el.style.color = color;
    fxRoot.appendChild(el); fxCount++;
    el.addEventListener('animationend', function () { el.remove(); fxCount--; });
  };
  UI.coins = function (x, y, n) {
    if (UI.reduceMotion()) return;
    for (var i = 0; i < n; i++) {
      if (fxCount > 60) return;
      var c = h('div', { class: 'coin' });
      var a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 70;
      c.style.left = (x - 9) + 'px'; c.style.top = (y - 9) + 'px';
      c.style.setProperty('--dx', Math.cos(a) * d + 'px');
      c.style.setProperty('--dy', (Math.sin(a) * d - 40) + 'px');
      fxRoot.appendChild(c); fxCount++;
      c.addEventListener('animationend', function (e) { e.target.remove(); fxCount--; });
    }
  };

  // ---------- toasts ----------
  UI.toast = function (content, kind, onClick, ms) {
    var box = document.getElementById('toasts');
    while (box.children.length >= 2) box.firstChild.remove();
    var t = h('div', { class: 'toast ' + (kind || '') }, h('span', { html: content }));
    t.addEventListener('click', function () { if (onClick) onClick(); t.remove(); });
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, ms || 3200);
  };

  // ---------- modais ----------
  var modalStack = [];
  UI.modal = function (o) {
    var bg = h('div', { class: 'modal-bg' });
    var box = h('div', { class: 'modal' });
    if (o.icon) box.appendChild(h('div', { class: 'mi', text: o.icon }));
    if (o.title) box.appendChild(h('h3', { text: o.title }));
    if (o.html) box.appendChild(h('div', { html: o.html }));
    if (o.body) box.appendChild(o.body);
    var btns = h('div', { class: 'mbtns' });
    var entry = { bg: bg, closable: o.closable !== false, onClose: o.onClose };
    function close() {
      bg.remove();
      modalStack = modalStack.filter(function (m) { return m !== entry; });
      if (entry.onClose) entry.onClose();
    }
    entry.close = close;
    (o.buttons || [{ label: 'OK', cls: 'btn' }]).forEach(function (b) {
      var el = h('button', { class: b.cls || 'btn', html: b.label });
      el.addEventListener('click', function () {
        if (b.fn && b.fn(el) === false) return;
        if (!b.keep) close();
      });
      btns.appendChild(el);
    });
    box.appendChild(btns);
    bg.appendChild(box);
    if (entry.closable) bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    document.getElementById('modal-root').appendChild(bg);
    modalStack.push(entry);
    return close;
  };
  UI.hasModal = function () { return modalStack.length > 0; };
  UI.closeTopModal = function () {
    var m = modalStack[modalStack.length - 1];
    if (m && m.closable) { m.close(); return true; }
    return !!m;
  };

  // ---------- HUD ----------
  var hud = {};
  function buildHud() {
    var el = document.getElementById('hud');
    hud.cash = h('div', { id: 'cash', text: '$0' });
    hud.ips = h('div', { id: 'ips', text: '+$0/s' });
    hud.boost = h('span', { class: 'chip boost hidden' });
    hud.stars = h('span', { class: 'chip star' });
    hud.boost.addEventListener('click', function () { UI.go('home'); });
    hud.stars.addEventListener('click', function () { UI.moreTab = 'legacy'; UI.go('more'); });
    el.appendChild(h('div', { class: 'hud-top' },
      h('div', { class: 'cash-wrap' }, hud.cash, hud.ips),
      h('div', { class: 'hud-badges' }, hud.boost, hud.stars)));
    var goals = h('div', { id: 'goals' });
    hud.goals = {};
    [['short', 'CURTO'], ['mid', 'MÉDIO'], ['long', 'LONGO']].forEach(function (p) {
      var g = { t: h('div', { class: 'gt' }), bar: h('i') };
      g.el = h('div', { class: 'goal ' + p[0] }, h('div', { class: 'gk', text: '🎯 ' + p[1] }), g.t, h('div', { class: 'bar' }, g.bar));
      hud.goals[p[0]] = g;
      goals.appendChild(g.el);
    });
    el.appendChild(goals);
  }
  var lastCash = 0;
  function updateHud() {
    var s = G.s, now = Date.now();
    txt(hud.cash, F.money(s.cash));
    if (s.cash > lastCash * 1.0001 + 1) { hud.cash.classList.remove('pulse'); void hud.cash.offsetWidth; hud.cash.classList.add('pulse'); }
    lastCash = s.cash;
    txt(hud.ips, '+' + F.money(E.passiveIncome(s, now), true) + '/s');
    var bt = [];
    if (s.boost.adUntil > now) bt.push('x2 ' + F.time((s.boost.adUntil - now) / 1000));
    if (s.boost.tourUntil > now) bt.push('🏆x1,5 ' + F.time((s.boost.tourUntil - now) / 1000));
    show(hud.boost, bt.length > 0);
    if (bt.length) txt(hud.boost, '⚡ ' + bt.join(' · '));
    txt(hud.stars, '⭐ ' + s.stars);
    ['short', 'mid', 'long'].forEach(function (k) {
      var gp = G.goalProgress(k), g = hud.goals[k];
      txt(g.t, gp.def.txt);
      g.bar.style.width = (gp.frac * 100).toFixed(1) + '%';
    });
  }
  UI.flashGoal = function (kind) {
    var g = hud.goals[kind]; if (!g) return;
    g.el.classList.remove('flash'); void g.el.offsetWidth; g.el.classList.add('flash');
  };

  // ---------- abas ----------
  var TABS = [
    { id: 'home', icon: '👆', label: 'Início' },
    { id: 'biz', icon: '🏪', label: 'Negócios' },
    { id: 'inv', icon: '📈', label: 'Investir' },
    { id: 'lux', icon: '💎', label: 'Luxo' },
    { id: 'more', icon: '📊', label: 'Mais' }
  ];
  var tabBtns = {};
  function buildTabs() {
    var bar = document.getElementById('tabbar');
    TABS.forEach(function (t) {
      var b = h('button', { 'data-tab': t.id, 'aria-label': t.label },
        h('span', { class: 'ti', text: t.icon }), h('span', { text: t.label }), h('i', { class: 'dot' }));
      b.addEventListener('click', function () { UI.go(t.id); });
      tabBtns[t.id] = b;
      bar.appendChild(b);
    });
  }
  function shownScreen() { return G.isUnlocked(UI.tab) ? UI.tab : 'locked'; }
  UI.go = function (tab) {
    UI.tab = tab;
    var shown = shownScreen();
    Object.keys(UI.screens).forEach(function (k) { cls(UI.screens[k].el, 'active', k === shown); });
    Object.keys(tabBtns).forEach(function (k) { cls(tabBtns[k], 'on', k === tab); });
    var scr = UI.screens[shown];
    if (scr.onShow) scr.onShow();
    UI.update();
  };
  UI.tabButton = function (id) { return tabBtns[id]; };

  function screen(id) {
    var el = h('section', { class: 'screen', id: 'scr-' + id });
    document.getElementById('screens').appendChild(el);
    UI.screens[id] = { el: el };
    return UI.screens[id];
  }

  function seg(options, get, set) {
    var el = h('div', { class: 'seg' });
    var btns = options.map(function (o) {
      var b = h('button', { text: o[1] });
      b.addEventListener('click', function () { set(o[0]); refresh(); UI.update(); });
      el.appendChild(b);
      return b;
    });
    function refresh() { btns.forEach(function (b, i) { cls(b, 'on', options[i][0] === get()); }); }
    refresh();
    el.refresh = refresh;
    return el;
  }

  // =====================================================================
  // MISSÕES DIÁRIAS (cartão na tela Início)
  // =====================================================================
  var daily = {};
  function buildDaily(parent) {
    daily.timer = h('div', { class: 'muted' });
    daily.rows = [0, 1, 2].map(function (i) {
      var x = { ico: h('div', { class: 'mico' }), txt: h('div', { class: 'mtxt' }), bar: h('i'), sub: h('div', { class: 'muted' }), btn: h('button', { class: 'btn mbtn' }) };
      x.btn.addEventListener('click', function () {
        var a = G.claimDaily(i);
        if (!a) { act(x.btn, function () { return false; }); return; }
        root.Sfx.big(); vibrate(15);
        var rc = x.btn.getBoundingClientRect();
        UI.coins(rc.left + rc.width / 2, rc.top, 10);
        UI.toast('📅 Missão concluída: <b>+' + F.money(a) + '</b>', 'good');
        root.Game.save(); UI.update();
      });
      x.el = h('div', { class: 'mission' }, x.ico, h('div', { class: 'grow' }, x.txt, h('div', { class: 'bar' }, x.bar), x.sub), x.btn);
      return x;
    });
    daily.bonus = h('button', { class: 'btn wide pink', id: 'dailyBonus' });
    daily.bonus.addEventListener('click', function () {
      var a = G.claimDailyBonus();
      if (!a) { act(daily.bonus, function () { return false; }); return; }
      root.Sfx.big(); vibrate(30);
      var rc = daily.bonus.getBoundingClientRect();
      UI.coins(rc.left + rc.width / 2, rc.top, 18);
      UI.toast('🎁 Baú diário: <b>+' + F.money(a) + '</b> · sequência de ' + G.s.daily.streak + ' dia(s)!', 'good', null, 4500);
      root.Game.save(); UI.update();
    });
    daily.card = h('div', { class: 'card daily', id: 'dailyCard' },
      h('div', { class: 'row' }, h('div', { class: 'title grow', text: '📅 Missões do dia' }), daily.timer),
      daily.rows.map(function (x) { return x.el; }), daily.bonus);
    parent.appendChild(daily.card);
  }
  UI.updateDaily = function () {
    var dl = G.s.daily;
    show(daily.card, !!dl && dl.list.length > 0);
    if (!dl) return;
    var d = new Date(), midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    txt(daily.timer, 'renova em ' + F.time((midnight - Date.now()) / 1000));
    daily.rows.forEach(function (x, i) {
      var m = dl.list[i];
      show(x.el, !!m);
      if (!m) return;
      var p = G.dailyProgress(m), isMoney = p.def.stat === 'earned';
      txt(x.ico, p.def.icon);
      txt(x.txt, G.dailyText(m));
      x.bar.style.width = (m.claimed ? 100 : p.frac * 100).toFixed(1) + '%';
      txt(x.sub, m.claimed ? 'Resgatado: +' + F.money(m.reward) : (isMoney ? F.money(p.cur) + ' / ' + F.money(p.target) : F.num(p.cur) + ' / ' + F.num(p.target)) + ' · prêmio ' + F.money(G.dailyReward(m)));
      cls(x.el, 'claimed', m.claimed);
      if (m.claimed) { btnLabel(x.btn, '✓'); cls(x.btn, 'done', true); cls(x.btn, 'off', false); cls(x.btn, 'ready', false); }
      else if (p.done) { btnLabel(x.btn, 'Resgatar'); cls(x.btn, 'done', false); cls(x.btn, 'off', false); cls(x.btn, 'ready', true); }
      else { btnLabel(x.btn, Math.floor(p.frac * 100) + '%'); cls(x.btn, 'done', false); cls(x.btn, 'off', true); cls(x.btn, 'ready', false); }
    });
    if (dl.bonus) { btnLabel(daily.bonus, '✓ Baú aberto — volte amanhã', 'sequência: ' + dl.streak + ' dia(s)'); cls(daily.bonus, 'done', true); cls(daily.bonus, 'off', false); }
    else if (G.dailyBonusReady()) { btnLabel(daily.bonus, '🎁 Abrir baú diário', '+' + F.money(G.dailyBonusAmount())); cls(daily.bonus, 'done', false); cls(daily.bonus, 'off', false); }
    else { btnLabel(daily.bonus, '🎁 Baú diário', 'conclua e resgate as 3 missões'); cls(daily.bonus, 'done', false); cls(daily.bonus, 'off', true); }
  };

  // =====================================================================
  // ABA BLOQUEADA (desbloqueio progressivo)
  // =====================================================================
  var LOCK_INFO = {
    inv: { icon: '📈', title: 'Investimentos', desc: 'Bolsa de valores, criptomoedas voláteis e imóveis que pagam aluguel — inclusive offline.' },
    lux: { icon: '💎', title: 'Luxo & Coleção', desc: 'Relógios, carros, iates, jatos e obras de arte que dão bônus permanentes e status.' }
  };
  function buildLocked() {
    var sc = screen('locked'), r = {};
    r.icon = h('div', { class: 'lock-ico' });
    r.title = h('h3');
    r.desc = h('p', { class: 'muted' });
    r.req = h('div', { class: 'lock-req' });
    r.bar = h('i');
    r.go = h('button', { class: 'btn', text: '🏪 Ir para Negócios' });
    r.go.addEventListener('click', function () { UI.go('biz'); });
    sc.el.appendChild(h('div', { class: 'card empty-state' }, r.icon, r.title, r.desc, r.req, h('div', { class: 'bar big' }, r.bar), r.go));
    sc.update = function () {
      var info = LOCK_INFO[UI.tab] || LOCK_INFO.inv, need = D.UNLOCKS[UI.tab] || 1, have = G.s.lifetimeEarned;
      txt(r.icon, '🔒' + info.icon);
      txt(r.title, info.title);
      txt(r.desc, info.desc);
      txt(r.req, 'Desbloqueia ao faturar ' + F.money(need) + ' no total · ' + F.money(have) + ' até agora');
      r.bar.style.width = Math.min(100, have / need * 100).toFixed(1) + '%';
    };
  }

  // =====================================================================
  // INÍCIO: toque, bônus voluntários, missões, carreira, habilidades
  // =====================================================================
  function buildHome() {
    var sc = screen('home'), el = sc.el, r = {};
    r.tap = h('button', { id: 'tapBtn', 'aria-label': 'Toque para ganhar dinheiro', html: LOGO_SVG });
    r.tapVal = h('div', { class: 'tap-val' });
    r.tap.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      root.Sfx.unlock();
      var v = G.tap();
      UI.floatText(e.clientX, e.clientY - 20, '+' + F.money(v, true));
      UI.coins(e.clientX, e.clientY, 3);
      root.Sfx.coin();
      vibrate(6);
      r.tap.classList.add('press');
      setTimeout(function () { r.tap.classList.remove('press'); }, 70);
    });
    r.tap.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.appendChild(h('div', { class: 'tap-zone' }, r.tap, r.tapVal));

    r.boostBtn = h('button', { class: 'btn pink' });
    r.quickBtn = h('button', { class: 'btn alt' });
    function boostDone() { root.Sfx.big(); UI.toast('⚡ Turbo x2 ativado!', 'good'); UI.update(); root.Game.save(); }
    r.boostBtn.addEventListener('click', function () {
      var mode = bonusMode(), now = Date.now();
      if (mode === 'free') {
        if (!G.useFreeBoost()) { root.Sfx.error(); UI.toast('⏳ Turbo grátis disponível em ' + F.time((G.s.boost.turboAt - now) / 1000), 'info'); return; }
        boostDone(); return;
      }
      if (G.s.boost.adUntil - now > (D.AD_BOOST_MAX_H * 60 - D.AD_BOOST_MIN) * 60000) { UI.toast('⚡ Turbo já está no máximo (' + D.AD_BOOST_MAX_H + 'h).', 'info'); return; }
      if (mode === 'paid') { G.applyAdBoost(); boostDone(); return; }
      root.AdService.rewarded('turbo').then(function (ok) {
        if (!ok) { UI.toast('Anúncio não concluído — nenhuma recompensa foi dada.', 'info'); return; }
        G.applyAdBoost(); boostDone();
      });
    });
    function quickDone() {
      var a = G.applyQuickCash();
      if (!a) return;
      root.Sfx.big();
      var rc = r.quickBtn.getBoundingClientRect();
      UI.coins(rc.left + rc.width / 2, rc.top, 14);
      UI.toast('💰 +' + F.money(a) + ' de lucro rápido!', 'good'); UI.update(); root.Game.save();
    }
    r.quickBtn.addEventListener('click', function () {
      if (!G.quickCashReady()) { root.Sfx.error(); UI.toast('⏳ Disponível em ' + F.time((G.s.boost.quickAt - Date.now()) / 1000), 'info'); return; }
      if (bonusMode() !== 'ad') { quickDone(); return; }
      root.AdService.rewarded('quick_cash').then(function (ok) {
        if (!ok) { UI.toast('Anúncio não concluído — nenhuma recompensa foi dada.', 'info'); return; }
        quickDone();
      });
    });
    r.bonusNote = h('div', { class: 'muted note' });
    el.appendChild(h('div', { class: 'ad-row' }, r.boostBtn, r.quickBtn));
    el.appendChild(r.bonusNote);
    buildDaily(el);

    el.appendChild(h('h2', { text: 'Carreira' }));
    r.jobIco = h('div', { class: 'ico' });
    r.jobCur = h('div', { class: 'muted' });
    r.jobNext = h('div', { class: 'title' });
    r.jobDesc = h('div', { class: 'muted' });
    r.jobBtn = h('button', { class: 'btn', id: 'jobBtn' });
    r.jobBtn.addEventListener('click', function () { act(r.jobBtn, G.buyJob); });
    el.appendChild(h('div', { class: 'card' },
      h('div', { class: 'row' }, r.jobIco, h('div', { class: 'grow' }, r.jobCur, r.jobNext, r.jobDesc), r.jobBtn)));

    el.appendChild(h('h2', { text: 'Habilidades' }));
    r.skills = D.SKILLS.map(function (k) {
      var x = { name: h('div', { class: 'title' }), desc: h('div', { class: 'muted', text: k.desc }), btn: h('button', { class: 'btn' }) };
      x.btn.addEventListener('click', function () { act(x.btn, function () { return G.buySkill(k.id); }); });
      el.appendChild(h('div', { class: 'card' }, h('div', { class: 'row' },
        h('div', { class: 'ico', text: k.icon }), h('div', { class: 'grow' }, x.name, x.desc), x.btn)));
      return x;
    });

    sc.update = function () {
      var s = G.s, now = Date.now();
      txt(r.tapVal, '+' + F.money(E.tapValue(s, now), true) + ' por toque');
      var mode = bonusMode(), ic = MODE_ICON[mode], active = s.boost.adUntil > now;
      if (mode === 'free') {
        var ready = G.freeBoostReady();
        btnLabel(r.boostBtn, ic + 'Turbo x2', active ? 'ativo: ' + F.time((s.boost.adUntil - now) / 1000)
          : ready ? D.AD_BOOST_MIN + ' min de renda dobrada' : 'recarga: ' + F.time((s.boost.turboAt - now) / 1000));
        cls(r.boostBtn, 'off', !ready);
      } else {
        btnLabel(r.boostBtn, ic + 'Turbo x2', active ? 'ativo: ' + F.time((s.boost.adUntil - now) / 1000) + ' (+30 min)' : D.AD_BOOST_MIN + ' min de renda dobrada');
        cls(r.boostBtn, 'off', false);
      }
      if (G.quickCashReady()) btnLabel(r.quickBtn, ic + 'Lucro rápido', '+' + F.money(G.quickCashAmount()));
      else btnLabel(r.quickBtn, '⏳ Lucro rápido', 'em ' + F.time((s.boost.quickAt - now) / 1000));
      cls(r.quickBtn, 'off', !G.quickCashReady());
      txt(r.bonusNote, mode === 'free' ? '🎁 Versão sem anúncios: bônus gratuitos com tempo de recarga.'
        : mode === 'ad' ? '▶ Opcional: assista a um anúncio para receber o bônus.' : '⚡ Anúncios removidos: bônus instantâneos.');
      UI.updateDaily();

      var cur = D.JOBS[s.jobs - 1], next = D.JOBS[s.jobs];
      txt(r.jobCur, cur ? 'Cargo atual: ' + cur.name + ' · salário ' + F.money(E.salary(s), true) + '/s' : 'Você está desempregado(a)');
      if (next) {
        txt(r.jobIco, next.icon);
        txt(r.jobNext, next.name);
        txt(r.jobDesc, '+' + F.num(next.tap) + ' por toque · +' + F.money(next.sal, true) + '/s');
        btnLabel(r.jobBtn, 'Contratar', F.money(next.cost));
        cls(r.jobBtn, 'off', s.cash < next.cost);
        cls(r.jobBtn, 'done', false);
      } else {
        txt(r.jobIco, '👑'); txt(r.jobNext, 'Topo da carreira!'); txt(r.jobDesc, 'Agora o império é com seus negócios.');
        btnLabel(r.jobBtn, '✓'); cls(r.jobBtn, 'done', true); cls(r.jobBtn, 'off', false);
      }
      D.SKILLS.forEach(function (k, i) {
        var x = r.skills[i], lv = E.skill(s, k.id);
        txt(x.name, k.name + ' · Nv ' + lv);
        if (lv >= k.max) { btnLabel(x.btn, 'MÁX'); cls(x.btn, 'done', true); cls(x.btn, 'off', false); }
        else { var c = E.skillCost(s, k.id); btnLabel(x.btn, 'Melhorar', F.money(c)); cls(x.btn, 'off', s.cash < c); }
      });
    };
    UI.homeRefs = r;
  }

  // =====================================================================
  // NEGÓCIOS
  // =====================================================================
  var bizCards = {};
  function buildBiz() {
    var sc = screen('biz'), el = sc.el;
    el.appendChild(seg([[1, 'x1'], [10, 'x10'], [100, 'x100'], ['max', 'MÁX']],
      function () { return UI.bizMode; }, function (v) { UI.bizMode = v; }));
    var teaser = h('div', { class: 'teaser' });
    D.BUSINESSES.forEach(function (b) {
      var c = {};
      c.lv = h('span', { class: 'lv' });
      c.ico = h('div', { class: 'ico', style: 'background:' + b.color + '33' }, b.icon, c.lv);
      c.name = h('div', { class: 'title', text: b.name });
      c.sub = h('div', { class: 'muted' });
      c.fill = h('i'); c.ptxt = h('span');
      c.pbar = h('div', { class: 'pbar' }, c.fill, c.ptxt);
      c.buy = h('button', { class: 'btn' });
      c.mgr = h('button', { class: 'btn alt' });
      c.emp = h('button', { class: 'btn ghost' });
      c.evt = h('div', { class: 'evt hidden' });
      c.el = h('div', { class: 'card biz', id: 'biz-' + b.id },
        h('div', { class: 'row' }, c.ico, h('div', { class: 'grow' }, c.name, c.sub)),
        c.pbar,
        h('div', { class: 'biz-actions' }, c.buy, c.mgr, c.emp),
        c.evt);
      c.ico.addEventListener('click', function () {
        if (G.runBiz(b.id)) { root.Sfx.coin(); vibrate(8); }
        else if (G.s.biz[b.id].lvl === 0) UI.toast('Compre o negócio primeiro!', 'info');
      });
      c.buy.addEventListener('click', function () {
        act(c.buy, function () { return G.buyBiz(b.id, UI.bizMode === 'max' ? 'max' : UI.bizMode); });
      });
      c.mgr.addEventListener('click', function () {
        if (G.s.biz[b.id].mgr) { UI.toast('👔 ' + b.mgrName + ' cuida de tudo — produção automática, inclusive offline.', 'info'); return; }
        act(c.mgr, function () { return G.hireManager(b.id); });
      });
      c.emp.addEventListener('click', function () { act(c.emp, function () { return G.hireEmployee(b.id); }); });
      bizCards[b.id] = c;
      el.appendChild(c.el);
    });
    el.appendChild(teaser);

    sc.update = function () {
      var s = G.s, now = Date.now(), firstLocked = -1;
      D.BUSINESSES.forEach(function (b, i) {
        var st = s.biz[b.id], c = bizCards[b.id], locked = st.lvl === 0;
        if (locked && firstLocked < 0) firstLocked = i;
        var visible = !locked || firstLocked === i || (firstLocked >= 0 && i === firstLocked + 1);
        show(c.el, visible);
        if (!visible) return;
        cls(c.el, 'locked', locked);
        txt(c.lv, locked ? '🔒' : 'Nv ' + st.lvl);
        var k = UI.bizMode === 'max' ? Math.max(1, E.bizMaxBuy(s, b.id, s.cash)) : UI.bizMode;
        var cost = E.bizCost(s, b.id, k);
        btnLabel(c.buy, locked ? 'Abrir negócio' : 'Comprar x' + k, F.money(cost));
        cls(c.buy, 'off', s.cash < cost);
        if (locked) {
          txt(c.sub, b.cat + ' · rende ' + F.money(b.rev / b.t, true) + '/s por nível');
          show(c.mgr, false); show(c.emp, false);
          txt(c.ptxt, 'Gerente: ' + b.mgrName);
        } else {
          var nm = E.nextMilestone(st.lvl);
          txt(c.sub, b.cat + ' · ' + (nm ? 'x2 receita no Nv ' + nm : 'todos os marcos!') + (st.emp ? ' · 👥 +' + st.emp * 50 + '%' : ''));
          show(c.mgr, true); show(c.emp, true);
          if (st.mgr) { btnLabel(c.mgr, '👔 Gerente', 'automático'); cls(c.mgr, 'done', true); cls(c.mgr, 'off', false); }
          else { btnLabel(c.mgr, '👔 Gerente', F.money(b.mgr)); cls(c.mgr, 'done', false); cls(c.mgr, 'off', s.cash < b.mgr); }
          if (st.emp >= D.EMP_MAX) { btnLabel(c.emp, '👥 Equipe', 'completa'); cls(c.emp, 'off', false); }
          else { var ec = E.empCost(s, b.id); btnLabel(c.emp, '👥 ' + st.emp + '/' + D.EMP_MAX, F.money(ec)); cls(c.emp, 'off', s.cash < ec); }
          var producing = st.mgr || st.running;
          var T = E.bizTime(s, b.id), rev = E.bizCycleNet(s, b.id, now); // líquido de salários do ciclo
          txt(c.ptxt, producing || st.mgr ? F.money(rev, true) + ' a cada ' + (T < 10 ? T.toFixed(1).replace('.', ',') + 's' : F.time(T))
            : '▶ Toque no ícone para produzir ' + F.money(rev, true));
          cls(c.ico, 'idle', !producing);
        }
        // evento ativo
        var ev = s.events.filter(function (e) { return e.biz === b.id && e.until > now; })[0];
        show(c.evt, !!ev);
        if (ev) {
          var t = G.EVENT_TYPES[ev.type], good = ev.mult > 1;
          cls(c.evt, 'good', good); cls(c.evt, 'bad', !good);
          var key = ev.id + ev.type + (ev.cost ? 1 : 0);
          if (c.evtKey !== key) {
            c.evtKey = key;
            c.evt.innerHTML = '';
            c.evtTime = h('b');
            var title = ev.type === 'promo' && ev.mult === 1.5 ? 'Campanha no ar! x1,5' : t.title + ' (x' + String(ev.mult).replace('.', ',') + ')';
            add(c.evt, [h('span', { text: t.icon }), h('div', { class: 'grow' }, title, ' · ', c.evtTime)]);
            if (ev.cost) {
              var fb = h('button', { class: 'btn ' + (ev.type === 'crise' ? 'red' : 'alt'), html: t.fix + '<small>' + F.money(ev.cost) + '</small>' });
              fb.addEventListener('click', function () { act(fb, function () { return G.resolveEvent(ev.id); }); });
              c.evt.appendChild(fb);
            }
          }
          txt(c.evtTime, F.time((ev.until - now) / 1000));
        } else c.evtKey = null;
      });
      var hidden = D.BUSINESSES.length - D.BUSINESSES.filter(function (b) { return !bizCards[b.id].el.classList.contains('hidden'); }).length;
      show(teaser, hidden > 0);
      if (hidden > 0) txt(teaser, '🔒 +' + hidden + ' negócios a descobrir em Cifrópolis...');
    };

    // barras de progresso suaves (todo frame)
    sc.frame = function () {
      var s = G.s;
      D.BUSINESSES.forEach(function (b) {
        var st = s.biz[b.id], c = bizCards[b.id];
        if (st.lvl === 0) { c.fill.style.transform = 'scaleX(0)'; return; }
        var fast = st.mgr && E.bizTime(s, b.id) < 0.35;
        cls(c.pbar, 'fast', fast);
        if (!fast) c.fill.style.transform = 'scaleX(' + Math.min(1, st.prog).toFixed(3) + ')';
      });
    };
  }
  var lastPayFx = {};
  UI.bizPay = function (p) {
    if (UI.tab !== 'biz') return;
    var now = Date.now();
    if (lastPayFx[p.id] && now - lastPayFx[p.id] < 450) return;
    lastPayFx[p.id] = now;
    var c = bizCards[p.id];
    var f = h('div', { class: 'payfx', text: '+' + F.money(p.amount, true) });
    c.el.style.position = 'relative';
    c.el.appendChild(f);
    f.addEventListener('animationend', function () { f.remove(); });
    if (!G.s.biz[p.id].mgr) root.Sfx.pay();
  };

  // =====================================================================
  // INVESTIR: ações, cripto, imóveis
  // =====================================================================
  function buildInv() {
    var sc = screen('inv'), el = sc.el, r = {};
    r.seg = seg([['stock', '📈 Ações'], ['crypto', '🪙 Cripto'], ['prop', '🏠 Imóveis']],
      function () { return UI.invTab; }, function (v) { UI.invTab = v; drawChart(true); });
    el.appendChild(r.seg);

    r.tour = h('div', { class: 'card tour-banner' });
    r.tour.addEventListener('click', function () { UI.moreTab = 'tour'; UI.go('more'); });
    r.tourTxt = h('div', { class: 'grow small' });
    add(r.tour, [h('div', { style: 'font-size:28px', text: '🏆' }), r.tourTxt, h('b', { text: '›' })]);
    el.appendChild(r.tour);

    // painel de mercado
    r.market = h('div');
    r.dIco = h('div', { class: 'ico' }); r.dName = h('div', { class: 'title' }); r.dSub = h('div', { class: 'muted' });
    r.dPrice = h('div', { class: 'price', style: 'font-size:18px' }); r.dChg = h('div', { class: 'small', style: 'text-align:right' });
    r.canvas = h('canvas', { class: 'chart' });
    r.kv = h('div', { class: 'kv' });
    var qtyBox = h('div', { class: 'qty' });
    r.qtyBtns = [[1, '1'], [10, '10'], [100, '100'], ['max', 'MÁX']].map(function (q) {
      var b = h('button', { text: q[1] });
      b.addEventListener('click', function () { UI.qty = q[0]; UI.update(); });
      qtyBox.appendChild(b);
      return { b: b, v: q[0] };
    });
    r.buyB = h('button', { class: 'btn alt', id: 'tradeBuy' });
    r.sellB = h('button', { class: 'btn pink', id: 'tradeSell' });
    r.buyB.addEventListener('click', function () {
      var id = UI.sel[UI.invTab];
      act(r.buyB, function () { return G.buyAsset(id, UI.qty === 'max' ? 'max' : UI.qty); });
    });
    r.sellB.addEventListener('click', function () {
      var id = UI.sel[UI.invTab];
      var res = G.sellAsset(id, UI.qty === 'max' ? 'max' : UI.qty);
      if (res === false) { act(r.sellB, function () { return false; }); return; }
      root.Sfx.buy(); vibrate(12);
      var rc = r.sellB.getBoundingClientRect();
      UI.floatText(rc.left + rc.width / 2, rc.top, (res >= 0 ? '+' : '') + F.money(res, true), res >= 0 ? '#2ee6a8' : '#ff5d6c');
      UI.update();
    });
    r.market.appendChild(h('div', { class: 'card' },
      h('div', { class: 'row' }, r.dIco, h('div', { class: 'grow' }, r.dName, r.dSub), h('div', null, r.dPrice, r.dChg)),
      h('div', { style: 'height:10px' }), r.canvas, r.kv, qtyBox,
      h('div', { class: 'trade-btns' }, r.buyB, r.sellB),
      h('div', { class: 'muted', style: 'margin-top:8px;text-align:center', text: 'Corretagem de 0,5% por operação. Lucro nas vendas conta para o torneio semanal.' })));
    r.listCard = h('div', { class: 'card', style: 'padding:6px' });
    r.rows = {};
    M.ASSETS.forEach(function (a) {
      var x = { price: h('div', { class: 'price' }), chg: h('div', { class: 'small', style: 'text-align:right' }), own: h('div', { class: 'muted' }) };
      x.el = h('div', { class: 'asset-row' }, h('div', { class: 'ico', text: a.icon }),
        h('div', { class: 'grow' }, h('div', { class: 'title', text: a.name + ' ' }), x.own), h('div', null, x.price, x.chg));
      x.el.addEventListener('click', function () { UI.sel[a.type] = a.id; drawChart(true); UI.update(); });
      r.rows[a.id] = x;
      r.listCard.appendChild(x.el);
    });
    r.market.appendChild(r.listCard);
    r.newsCard = h('div', { class: 'card' });
    r.market.appendChild(h('h2', { text: '📰 Notícias do mercado' }));
    r.market.appendChild(r.newsCard);
    el.appendChild(r.market);

    // imóveis
    r.props = h('div');
    r.propRows = D.PROPS.map(function (p) {
      var x = { name: h('div', { class: 'title' }), sub: h('div', { class: 'muted' }), btn: h('button', { class: 'btn' }) };
      x.btn.addEventListener('click', function () { act(x.btn, function () { return G.buyProp(p.id); }); });
      r.props.appendChild(h('div', { class: 'card' }, h('div', { class: 'row' },
        h('div', { class: 'ico', text: p.icon }), h('div', { class: 'grow' }, x.name, x.sub), x.btn)));
      return x;
    });
    r.props.appendChild(h('div', { class: 'muted', style: 'text-align:center;padding:6px', text: 'Aluguéis caem na conta o tempo todo — inclusive offline. Manutenção: 10% do aluguel.' }));
    el.appendChild(r.props);

    var lastDraw = '';
    function drawChart(force) {
      if (UI.invTab === 'prop') return;
      var s = G.s, id = UI.sel[UI.invTab], m = s.mkt[id];
      var key = id + ':' + m.hist.length + ':' + m.n + ':' + r.canvas.clientWidth;
      if (!force && key === lastDraw) return;
      lastDraw = key;
      var cv = r.canvas, dpr = root.devicePixelRatio || 1;
      var w = cv.clientWidth || 300, hgt = cv.clientHeight || 150;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr); }
      var ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, hgt);
      var pts = m.hist.concat([m.p]);
      var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
      var hold = s.hold[id];
      if (hold && hold.qty > 0) { min = Math.min(min, hold.avg); max = Math.max(max, hold.avg); }
      var pad = (max - min) * 0.12 || max * 0.05 || 1;
      min -= pad; max += pad;
      var X = function (i) { return 6 + (w - 12) * i / Math.max(1, pts.length - 1); };
      var Y = function (v) { return hgt - 8 - (hgt - 16) * (v - min) / (max - min); };
      var up = pts[pts.length - 1] >= pts[0];
      var col = up ? '#2ee6a8' : '#ff5d6c';
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
      for (var g = 1; g < 4; g++) { ctx.beginPath(); ctx.moveTo(0, hgt * g / 4); ctx.lineTo(w, hgt * g / 4); ctx.stroke(); }
      ctx.beginPath();
      pts.forEach(function (v, i) { if (i === 0) ctx.moveTo(X(i), Y(v)); else ctx.lineTo(X(i), Y(v)); });
      ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.lineTo(X(pts.length - 1), hgt); ctx.lineTo(X(0), hgt); ctx.closePath();
      var grd = ctx.createLinearGradient(0, 0, 0, hgt);
      grd.addColorStop(0, up ? 'rgba(46,230,168,0.35)' : 'rgba(255,93,108,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd; ctx.fill();
      if (hold && hold.qty > 0) {
        ctx.setLineDash([5, 4]); ctx.strokeStyle = '#ffc93c'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(0, Y(hold.avg)); ctx.lineTo(w, Y(hold.avg)); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#ffc93c'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('seu preço médio', 6, Y(hold.avg) - 4);
      }
      ctx.beginPath(); ctx.arc(X(pts.length - 1), Y(pts[pts.length - 1]), 3.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    }

    sc.onShow = function () { drawChart(true); };
    sc.update = function () {
      var s = G.s, now = Date.now(), type = UI.invTab;
      r.seg.refresh();
      // torneio
      var rk = M.ranking(s, now).findIndex(function (x) { return x.me; }) + 1;
      html(r.tourTxt, '<b>Torneio semanal da bolsa</b> <span class="sim-tag">rivais simulados</span><br>Você está em <b>#' + rk + '</b> · lucro ' + F.money(s.tour.score) +
        ' · termina em ' + F.time((M.weekEnd(s.tour.week) - now) / 1000));
      show(r.market, type !== 'prop');
      show(r.props, type === 'prop');
      if (type === 'prop') {
        D.PROPS.forEach(function (p, i) {
          var x = r.propRows[i], n = s.props[p.id] || 0, c = E.propCost(s, p.id);
          txt(x.name, p.name + (n ? ' ×' + n : ''));
          txt(x.sub, 'Aluguel ' + F.money(p.rent * (1 + E.luxBonus(s, 'rent')) * E.starMult(s), true) + '/s cada' + (n ? ' · total ' + F.money(n * p.rent * (1 + E.luxBonus(s, 'rent')) * E.starMult(s), true) + '/s' : ''));
          btnLabel(x.btn, 'Comprar', F.money(c));
          cls(x.btn, 'off', s.cash < c);
        });
        return;
      }
      M.ASSETS.forEach(function (a) {
        var x = r.rows[a.id];
        show(x.el, a.type === type);
        if (a.type !== type) return;
        var ch = M.change(s, a.id), hq = s.hold[a.id] ? s.hold[a.id].qty : 0;
        txt(x.price, F.money(s.mkt[a.id].p, true));
        txt(x.chg, F.pct(ch)); cls(x.chg, 'pos', ch >= 0); cls(x.chg, 'neg', ch < 0);
        txt(x.own, a.id + (hq ? ' · você tem ' + F.num(hq) : ''));
        cls(x.el, 'sel', UI.sel[type] === a.id);
      });
      var id = UI.sel[type], a = M.BY_ID[id], m = s.mkt[id], hold = s.hold[id] || { qty: 0, avg: 0 };
      txt(r.dIco, a.icon); txt(r.dName, a.name); txt(r.dSub, id + (a.type === 'crypto' ? ' · alta volatilidade' : ' · Bolsa de Cifrópolis'));
      txt(r.dPrice, F.money(m.p, true));
      var ch = M.change(s, id);
      txt(r.dChg, F.pct(ch) + ' (6 min)'); cls(r.dChg, 'pos', ch >= 0); cls(r.dChg, 'neg', ch < 0);
      var val = hold.qty * m.p, pl = hold.qty ? val * (1 - D.TRADE_FEE) - hold.avg * hold.qty : 0;
      html(r.kv,
        '<span>Em carteira</span><b>' + F.num(hold.qty) + '</b>' +
        '<span>Preço médio</span><b>' + (hold.qty ? F.money(hold.avg, true) : '—') + '</b>' +
        '<span>Valor atual</span><b>' + F.money(val, true) + '</b>' +
        '<span>Lucro/prejuízo (se vender)</span><b class="' + (pl >= 0 ? 'pos' : 'neg') + '">' + (hold.qty ? (pl >= 0 ? '+' : '') + F.money(pl, true) : '—') + '</b>');
      r.qtyBtns.forEach(function (q) { cls(q.b, 'on', UI.qty === q.v); });
      var bq = UI.qty === 'max' ? G.maxBuyAsset(id) : UI.qty;
      var sq = UI.qty === 'max' ? hold.qty : Math.min(UI.qty, hold.qty);
      btnLabel(r.buyB, 'Comprar ' + F.num(bq), F.money(bq * m.p * (1 + D.TRADE_FEE), true));
      btnLabel(r.sellB, 'Vender ' + F.num(sq), F.money(sq * m.p * (1 - D.TRADE_FEE), true));
      cls(r.buyB, 'off', bq <= 0 || s.cash < bq * m.p * (1 + D.TRADE_FEE));
      cls(r.sellB, 'off', sq <= 0);
      html(r.newsCard, s.news.length ? s.news.slice(0, 4).map(function (n) {
        return '<div class="news">' + (n.up ? '🟢 ' : '🔴 ') + esc(n.txt) + '</div>';
      }).join('') : '<div class="muted">Sem notícias por enquanto. Fique de olho: notícias mexem nos preços!</div>');
      drawChart(false);
    };
  }

  // =====================================================================
  // LUXO & COLEÇÃO
  // =====================================================================
  function buildLux() {
    var sc = screen('lux'), el = sc.el, r = { items: {}, heads: {} };
    r.hero = h('div', { class: 'card stat-hero' });
    el.appendChild(r.hero);
    D.LUX_CATS.forEach(function (cat) {
      r.heads[cat.id] = h('h2');
      el.appendChild(r.heads[cat.id]);
      var grid = h('div', { class: 'lux-grid' });
      D.LUXURY.filter(function (l) { return l.cat === cat.id; }).forEach(function (l) {
        var x = { btn: h('button', { class: 'btn' }) };
        x.el = h('div', { class: 'card lux', id: 'lux-' + l.id },
          h('div', { class: 'big', text: l.icon }), h('div', { class: 'nm', text: l.name }),
          h('div', { class: 'muted', text: bonusText(l) }), x.btn);
        x.btn.addEventListener('click', function () { act(x.btn, function () { return G.buyLux(l.id); }); });
        r.items[l.id] = x;
        grid.appendChild(x.el);
      });
      el.appendChild(grid);
    });
    el.appendChild(h('div', { class: 'muted', style: 'text-align:center;padding:8px', text: 'Itens de luxo são permanentes: continuam com você mesmo após o Legado (prestígio). Complete uma categoria para +5% de renda global.' }));
    sc.update = function () {
      var s = G.s, col = E.completedCollections(s);
      html(r.hero, '<div class="muted">Status social</div><div class="v">✨ ' + E.status(s) + ' · ' + E.statusTitle(s) + '</div>' +
        '<div class="muted">Coleções completas: <b>' + col + '/' + D.LUX_CATS.length + '</b> · Bônus de renda: <b class="pos">+' +
        Math.round((E.luxBonus(s, 'inc') + col * D.COLLECTION_BONUS) * 100) + '%</b></div>');
      D.LUX_CATS.forEach(function (cat) {
        var items = D.LUXURY.filter(function (l) { return l.cat === cat.id; });
        var own = items.filter(function (l) { return s.lux[l.id]; }).length;
        txt(r.heads[cat.id], cat.icon + ' ' + cat.name + ' · ' + own + '/' + items.length + (own === items.length ? ' ✓' : ''));
      });
      D.LUXURY.forEach(function (l) {
        var x = r.items[l.id], own = !!s.lux[l.id];
        cls(x.el, 'own', own);
        if (own) { btnLabel(x.btn, 'Na coleção ✓'); cls(x.btn, 'done', true); cls(x.btn, 'off', false); }
        else { btnLabel(x.btn, 'Comprar', F.money(l.cost)); cls(x.btn, 'done', false); cls(x.btn, 'off', s.cash < l.cost); }
      });
    };
  }
  function bonusText(l) {
    var b = l.bonus, parts = [];
    if (b.inc) parts.push('+' + Math.round(b.inc * 100) + '% renda');
    if (b.tap) parts.push('+' + Math.round(b.tap * 100) + '% toque');
    if (b.rent) parts.push('+' + Math.round(b.rent * 100) + '% aluguéis');
    if (b.speed) parts.push('+' + Math.round(b.speed * 100) + '% velocidade');
    if (b.offline) parts.push('+' + b.offline + 'h offline');
    return parts.join(' · ') + ' · ✨' + l.status;
  }

  // =====================================================================
  // MAIS: finanças, torneio, legado, ajustes
  // =====================================================================
  function buildMore() {
    var sc = screen('more'), el = sc.el, r = {};
    r.seg = seg([['fin', '💰\nFinanças'], ['ach', '🏅\nConquistas'], ['tour', '🏆\nTorneio'], ['legacy', '🌅\nLegado'], ['set', '⚙️\nAjustes']],
      function () { return UI.moreTab; }, function (v) { UI.moreTab = v; if (v === 'set') r.bakDirty = true; });
    r.seg.classList.add('seg-icons');
    el.appendChild(r.seg);

    // Conquistas
    r.ach = h('div');
    r.achHero = h('div', { class: 'card stat-hero' });
    r.achGrid = h('div', { class: 'ach-grid' });
    r.achItems = D.ACHIEVEMENTS.map(function (a) {
      var x = { bar: h('i'), sub: h('div', { class: 'muted' }) };
      x.el = h('div', { class: 'ach', id: 'ach-' + a.id }, h('div', { class: 'ach-ico', text: a.icon }),
        h('div', { class: 'grow' }, h('div', { class: 'title', text: a.name }), h('div', { class: 'small', text: a.txt }), h('div', { class: 'bar' }, x.bar), x.sub));
      r.achGrid.appendChild(x.el);
      return x;
    });
    add(r.ach, [r.achHero, r.achGrid]);
    el.appendChild(r.ach);

    // Finanças
    r.fin = h('div');
    r.finInc = h('div', { class: 'card' }); r.finNw = h('div', { class: 'card' }); r.finStats = h('div', { class: 'card' });
    add(r.fin, [h('h2', { text: 'Fluxo por segundo' }), r.finInc, h('h2', { text: 'Patrimônio líquido' }), r.finNw, h('h2', { text: 'Estatísticas' }), r.finStats]);
    el.appendChild(r.fin);

    // Torneio
    r.tour = h('div');
    r.tourHead = h('div', { class: 'card' });
    r.tourClaim = h('button', { class: 'btn wide pink hidden', style: 'margin-bottom:10px' });
    r.tourClaim.addEventListener('click', function () { UI.claimTour(); });
    r.tourRank = h('div', { class: 'card' });
    add(r.tour, [r.tourHead, r.tourClaim, h('h2', { text: 'Classificação' }), r.tourRank,
      h('div', { class: 'card small', html: '<b>Prêmios no fim da semana</b><br>🥇 1º: 30 min de renda + Turbo x1,5 por 2h<br>🥈 2º–3º: 20 min + x1,5 por 1h<br>🏅 4º–5º: 10 min + x1,5 por 30 min<br>🎗️ Demais: 3 min de renda<br><span class="muted">Pontuação = lucro realizado com vendas de ações e cripto na semana. Rivais simulados localmente (jogo 100% offline).</span>' })]);
    el.appendChild(r.tour);

    // Legado
    r.legacy = h('div');
    r.legInfo = h('div', { class: 'card stat-hero' });
    r.legBtn = h('button', { class: 'btn wide pink', id: 'legacyBtn' });
    r.legBtn.addEventListener('click', function () { UI.confirmPrestige(); });
    add(r.legacy, [r.legInfo, r.legBtn, h('div', { class: 'card small', html:
      '<b>Como funciona o Legado</b><br>Você recomeça do zero, mas cada ⭐ Estrela de Legado dá <b>+10% de renda permanente</b> (negócios, salário, aluguel e toque).<br><br>' +
      '<b>Mantém:</b> estrelas, itens de luxo, metas, estatísticas, torneio.<br><b>Zera:</b> dinheiro, negócios, carreira, habilidades, imóveis e investimentos.<br><br>' +
      '<span class="muted">Estrelas = √(faturamento total ÷ 100 M) − estrelas já recebidas.</span>' })]);
    el.appendChild(r.legacy);

    // Ajustes
    r.set = h('div');
    function toggle(label, key, onChange) {
      var sw = h('button', { class: 'switch', 'aria-label': label });
      sw.addEventListener('click', function () { G.s.settings[key] = !G.s.settings[key]; if (onChange) onChange(G.s.settings[key]); root.Game.save(); UI.update(); });
      var row = h('div', { class: 'toggle' }, h('span', { text: label }), sw);
      row.sw = sw; row.key = key;
      return row;
    }
    r.toggles = [toggle('🔊 Sons', 'sound', function (v) { root.Sfx.setEnabled(v); }), toggle('📳 Vibração', 'vib'),
      toggle('🐢 Reduzir animações', 'reduceMotion', UI.applySettings), toggle('🔠 Texto maior', 'bigText', UI.applySettings)];
    r.adsCard = h('div', { class: 'card' });
    r.adsTxt = h('div', { class: 'muted', style: 'margin:4px 0 10px' });
    r.noAdsBtn = h('button', { class: 'btn wide', id: 'noAdsBtn' });
    r.noAdsBtn.addEventListener('click', function () { UI.buyNoAds(); });
    r.restoreBtn = h('button', { class: 'btn ghost wide', style: 'margin-top:8px', text: 'Restaurar compra' });
    r.restoreBtn.addEventListener('click', function () {
      root.Store.restore().then(function (ok) {
        if (ok) { G.s.noAds = true; root.Game.save(); UI.update(); }
        UI.toast(ok ? 'Compra restaurada ✓' : 'Nenhuma compra encontrada.', ok ? 'good' : 'info');
      });
    });
    add(r.adsCard, [h('div', { class: 'title', text: 'Anúncios e compras' }), r.adsTxt, r.noAdsBtn, r.restoreBtn]);
    var tutBtn = h('button', { class: 'btn ghost wide', text: '🎓 Rever tutorial' });
    tutBtn.addEventListener('click', function () { G.s.tutorial = 0; UI.go('home'); root.Tutorial.start(); });
    var expBtn = h('button', { class: 'btn ghost', text: '📤 Exportar save' });
    var impBtn = h('button', { class: 'btn ghost', text: '📥 Importar save' });
    var ta = h('textarea', { placeholder: 'Código do save aparece aqui / cole um código para importar' });
    expBtn.addEventListener('click', function () {
      root.Game.save(); ta.value = G.exportSave(); ta.select();
      try { navigator.clipboard.writeText(ta.value); UI.toast('Código copiado!', 'good'); } catch (e) { UI.toast('Copie o código abaixo.', 'info'); }
    });
    impBtn.addEventListener('click', function () {
      var code = ta.value;
      var check;
      try { check = root.SaveIO.sanitize(root.SaveIO.decode(code), G.newState(), Date.now()); }
      catch (e) { root.Sfx.error(); UI.toast('❌ ' + esc(e.message), 'bad', null, 4500); return; }
      UI.modal({ icon: '📥', title: 'Substituir o progresso atual?',
        html: '<p>O save importado tem <b>' + F.money(E.netWorth(check)) + '</b> de patrimônio e <b>' + check.stars + ' ⭐</b>.</p>' +
          '<p>Seu progresso atual será guardado como backup e poderá ser restaurado aqui mesmo.</p>',
        buttons: [
          { label: 'Importar', cls: 'btn', fn: function () {
            try { G.importSave(code); } catch (e) { UI.toast('❌ ' + esc(e.message), 'bad', null, 4500); return; }
            ta.value = ''; r.bakDirty = true; UI.applySettings(); root.Sfx.setEnabled(G.s.settings.sound);
            UI.toast('✓ Save importado.', 'good'); UI.go('home');
          } },
          { label: 'Cancelar', cls: 'btn ghost' }] });
    });
    r.bakList = h('div');
    var resetBtn = h('button', { class: 'btn red wide', text: '🗑️ Apagar todo o progresso' });
    resetBtn.addEventListener('click', function () {
      UI.modal({ icon: '⚠️', title: 'Apagar tudo?', html: '<p>Todo o progresso, incluindo estrelas, coleção e conquistas, será apagado.</p><p>Uma cópia fica em <b>Backups locais</b> até a próxima importação ou restauração.</p>',
        buttons: [{ label: 'Apagar progresso', cls: 'btn red', fn: function () {
          UI.modal({ icon: '⚠️', title: 'Tem certeza?', html: '<p>Esta é a última confirmação.</p>', buttons: [
            { label: 'Sim, apagar', cls: 'btn red', fn: function () { G.reset(); r.bakDirty = true; UI.applySettings(); UI.go('home'); root.Tutorial.start(); } },
            { label: 'Cancelar', cls: 'btn ghost' }] });
        } },
                  { label: 'Cancelar', cls: 'btn ghost' }] });
    });
    add(r.set, [h('div', { class: 'card' }, r.toggles), r.adsCard,
      h('div', { class: 'card' }, tutBtn, h('div', { style: 'height:8px' }),
        h('div', { class: 'title', text: 'Exportar / importar' }),
        h('div', { class: 'muted', style: 'margin:4px 0 8px', text: 'O jogo salva sozinho no aparelho a cada 10 s e ao sair. Exporte para guardar uma cópia fora do aparelho.' }),
        ta, h('div', { class: 'trade-btns', style: 'margin-top:8px' }, expBtn, impBtn)),
      h('div', { class: 'card' }, h('div', { class: 'title', text: 'Backups locais' }),
        h('div', { class: 'muted', style: 'margin:4px 0 8px', text: 'Cópias automáticas guardadas no aparelho.' }), r.bakList),
      resetBtn,
      h('div', { class: 'muted', style: 'text-align:center;padding:16px', html: D.GAME_NAME + ' · v' + D.VERSION + ' · Feito para jogar com uma mão 🤙<br>Funciona 100% offline.' })]);
    el.appendChild(r.set);

    var BAK_LABEL = { auto: '🕒 Backup automático', pre: '↩️ Antes da última importação/restauração', bad: '🩹 Save danificado (cópia original)' };
    function renderBackups() {
      r.bakDirty = false;
      r.bakList.innerHTML = '';
      var info = G.backupInfo(), keys = Object.keys(info);
      if (!keys.length) { r.bakList.appendChild(h('div', { class: 'muted', text: 'Nenhum backup ainda — o primeiro é criado em alguns minutos.' })); return; }
      keys.forEach(function (k) {
        var b = info[k];
        var when = b.valid && b.time ? new Date(b.time).toLocaleString('pt-BR') : '';
        var desc = b.valid ? when + ' · patrimônio ' + F.money(b.nw) : 'Não pode ser carregado (' + (b.error || 'inválido') + ')';
        var btn = h('button', { class: 'btn ghost', text: b.valid ? 'Restaurar' : 'Copiar' });
        btn.addEventListener('click', function () {
          if (!b.valid) {
            ta.value = G.backupRaw(k) || '';
            try { navigator.clipboard.writeText(ta.value); UI.toast('Conteúdo copiado para você guardar.', 'good'); } catch (e) { UI.toast('Conteúdo exibido na caixa de texto acima.', 'info'); }
            return;
          }
          UI.modal({ icon: '↩️', title: 'Restaurar este backup?', html: '<p>' + esc(desc) + '</p><p>O progresso atual será guardado como "antes da última restauração".</p>',
            buttons: [{ label: 'Restaurar', cls: 'btn', fn: function () {
              try { G.restoreBackup(k); UI.toast('✓ Backup restaurado.', 'good'); UI.applySettings(); UI.go('home'); } catch (e) { UI.toast('❌ ' + esc(e.message), 'bad'); }
              r.bakDirty = true;
            } }, { label: 'Cancelar', cls: 'btn ghost' }] });
        });
        r.bakList.appendChild(h('div', { class: 'bak-row' }, h('div', { class: 'grow' }, h('div', { class: 'small', text: BAK_LABEL[k] }), h('div', { class: 'muted', text: desc })), btn));
      });
    }

    sc.update = function () {
      var s = G.s, now = Date.now(), t = UI.moreTab;
      r.seg.refresh();
      show(r.fin, t === 'fin'); show(r.ach, t === 'ach'); show(r.tour, t === 'tour'); show(r.legacy, t === 'legacy'); show(r.set, t === 'set');
      if (t === 'ach') {
        var n = E.achCount(s);
        html(r.achHero, '<div class="muted">Conquistas</div><div class="v">🏅 ' + n + '/' + D.ACHIEVEMENTS.length + '</div>' +
          '<div class="muted">Bônus permanente: <b class="pos">+' + Math.round(n * D.ACH_BONUS * 100) + '%</b> na receita dos negócios · mantido após o Legado</div>');
        D.ACHIEVEMENTS.forEach(function (a, i) {
          var x = r.achItems[i], p = G.achProgress(a);
          cls(x.el, 'done', p.done);
          x.bar.style.width = (p.done ? 100 : p.frac * 100).toFixed(1) + '%';
          var money = a.t === 'earned' || a.t === 'ips' || a.t === 'tprofit';
          txt(x.sub, p.done ? '✓ Concluída · +1%' : (money ? F.money(p.cur) + ' / ' + F.money(p.target) : F.num(p.cur) + ' / ' + F.num(p.target)));
        });
      }
      if (t === 'fin') {
        var b = E.breakdown(s, now), pv = E.portfolioValue(s), nw = E.netWorth(s);
        var mf = G.measuredFlow();
        var neg = function (v) { return (v > 0 ? '-' : '') + F.money(v, true); };
        html(r.finInc, '<div class="kv">' +
          '<span>🏪 Negócios com gerente (receita)</span><b class="pos">+' + F.money(b.biz, true) + '</b>' +
          '<span>👥 Salários de funcionários</span><b class="neg">' + neg(b.empUpkeep) + '</b>' +
          '<span>💼 Salário (carreira)</span><b class="pos">+' + F.money(b.salary, true) + '</b>' +
          '<span>🏠 Aluguéis</span><b class="pos">+' + F.money(b.rent, true) + '</b>' +
          '<span>🔧 Manutenção de imóveis</span><b class="neg">' + neg(b.rentUpkeep) + '</b>' +
          '<span><b>Resultado líquido</b></span><b class="' + (b.net >= 0 ? 'pos' : 'neg') + '">' + F.money(b.net, true) + '/s</b>' +
          '<span>📏 Medido nos últimos ' + (mf ? Math.round(mf.secs) + ' s' : '60 s') + '</span><b>' + (mf ? '≈ ' + F.money(mf.net, true) + '/s' : 'medindo…') + '</b>' +
          '</div>' +
          (b.manual.running || b.manual.idle ? '<div class="fin-note">⚙️ Sem gerente: ' + (b.manual.running ? b.manual.running + ' em produção (+' + F.money(b.manual.net, true) + ' líquido ao concluir)' : '') +
            (b.manual.running && b.manual.idle ? ' · ' : '') + (b.manual.idle ? b.manual.idle + ' parado(s) — toque no ícone para produzir' : '') + '. Esses ciclos entram no valor medido, não no fluxo contínuo.</div>' : '') +
          '<div class="kv" style="margin-top:8px">' +
          '<span>👆 Valor do toque</span><b>' + F.money(E.tapValue(s, now), true) + '</b>' +
          '<span>⚡ Multiplicador global</span><b>x' + E.globalMult(s, now).toFixed(2).replace('.', ',') + '</b>' +
          '<span>🏅 Conquistas</span><b>+' + Math.round(E.achCount(s) * D.ACH_BONUS * 100) + '%</b>' +
          '<span>Total já pago em salários</span><b>' + F.money(s.stats.wagesPaid) + '</b>' +
          '<span>Total já pago em manutenção</span><b>' + F.money(s.stats.rentUpkeepPaid) + '</b></div>' +
          '<div class="fin-note">Salários são pagos a cada ciclo concluído, descontados da receita daquele ciclo. O fluxo inclui turbos e eventos ativos; os ganhos offline não.</div>');
        html(r.finNw, '<div class="kv">' +
          '<span>💵 Dinheiro</span><b>' + F.money(s.cash) + '</b>' +
          '<span>📈 Ações e cripto</span><b>' + F.money(pv) + '</b>' +
          '<span>🏢 Negócios, imóveis e luxo (valor de venda)</span><b>' + F.money(nw - s.cash - pv) + '</b>' +
          '<span><b>Patrimônio total</b></span><b style="color:var(--gold)">' + F.money(nw) + '</b></div>');
        html(r.finStats, '<div class="kv">' +
          '<span>Faturamento nesta vida</span><b>' + F.money(s.runEarned) + '</b>' +
          '<span>Faturamento total</span><b>' + F.money(s.lifetimeEarned) + '</b>' +
          '<span>Toques</span><b>' + F.num(s.stats.taps) + '</b>' +
          '<span>Ganho com toques</span><b>' + F.money(s.stats.tapEarned) + '</b>' +
          '<span>Ciclos de produção</span><b>' + F.num(s.stats.bizRuns) + '</b>' +
          '<span>Operações na bolsa</span><b>' + F.num(s.stats.trades) + '</b>' +
          '<span>Lucro na bolsa</span><b class="' + (s.stats.tradeProfit >= 0 ? 'pos' : 'neg') + '">' + F.money(s.stats.tradeProfit) + '</b>' +
          '<span>Corretagem paga</span><b>' + F.money(s.stats.fees) + '</b>' +
          '<span>Legados feitos</span><b>' + s.prestiges + '</b>' +
          '<span>Tempo de jogo</span><b>' + F.time(s.stats.playSec) + '</b></div>');
      } else if (t === 'tour') {
        var rank = M.ranking(s, now);
        var me = rank.findIndex(function (x) { return x.me; }) + 1;
        html(r.tourHead, '<div class="row"><div style="font-size:40px">🏆</div><div class="grow"><div class="title">Torneio Semanal da Bolsa</div>' +
          '<div class="sim-tag">Modo offline · rivais simulados no aparelho</div>' +
          '<div class="muted">Termina em ' + F.time((M.weekEnd(s.tour.week) - now) / 1000) + ' · Sua posição: <b style="color:var(--gold)">#' + me + '</b>' +
          (s.tour.best ? ' · Melhor: #' + s.tour.best : '') + '</div></div></div>');
        html(r.tourRank, '<table class="rank">' + rank.map(function (x, i) {
          return '<tr class="' + (x.me ? 'me' : '') + '"><td>' + (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + 'º') + '</td><td>' + x.name + '</td><td>' + F.money(x.score) + '</td></tr>';
        }).join('') + '</table>');
        show(r.tourClaim, !!s.tour.pending);
        if (s.tour.pending) html(r.tourClaim, '🎁 Resgatar prêmio da semana passada (#' + s.tour.pending.rank + ')');
      } else if (t === 'legacy') {
        var pot = E.potentialStars(s);
        var nextAt = Math.pow(s.starsClaimed + pot + 1, 2) * D.STAR_DIVISOR;
        html(r.legInfo, '<div class="muted">Estrelas de Legado</div><div class="v">⭐ ' + s.stars + '</div>' +
          '<div class="muted">Bônus permanente atual: <b class="pos">+' + Math.round(s.stars * D.STAR_BONUS * 100) + '%</b></div>' +
          '<div style="margin-top:10px;font-size:15px">Se fundar um Legado agora: <b style="color:var(--gold)">+' + pot + ' ⭐</b></div>' +
          '<div class="muted">Próxima estrela ao faturar ' + F.money(nextAt) + ' no total (' + F.money(s.lifetimeEarned) + ' até agora)</div>');
        btnLabel(r.legBtn, pot > 0 ? '🌅 Fundar Legado (+' + pot + ' ⭐)' : 'Fature mais para ganhar estrelas', pot > 0 ? 'recomeçar com +' + Math.round((s.stars + pot) * 10) + '% de renda' : '');
        cls(r.legBtn, 'off', pot < 1);
      } else {
        r.toggles.forEach(function (tg) { cls(tg.sw, 'on', !!s.settings[tg.key]); tg.sw.setAttribute('aria-pressed', String(!!s.settings[tg.key])); });
        var storeOn = root.Store.available(), adsOn = root.AdService.available();
        if (s.noAds) {
          txt(r.adsTxt, 'Anúncios removidos nesta conta: os bônus são instantâneos.');
        } else if (!adsOn && !storeOn) {
          txt(r.adsTxt, 'Esta versão não exibe anúncios e não vende nada: nenhum SDK de anúncios ou loja está configurado. Os bônus (Turbo e Lucro rápido) são gratuitos, com tempo de recarga.');
        } else {
          txt(r.adsTxt, 'Anúncios são sempre opcionais: você só vê um se tocar em ▶ para ganhar um bônus. A compra única deixa os bônus instantâneos, sem vídeo.');
        }
        show(r.noAdsBtn, storeOn && !s.noAds);
        show(r.restoreBtn, storeOn);
        if (storeOn && !s.noAds) btnLabel(r.noAdsBtn, '🚫 Remover anúncios', 'compra única · bônus sem vídeo');
        if (r.bakDirty) renderBackups();
      }
    };
  }

  // ---------- fluxos com modal ----------
  UI.confirmPrestige = function () {
    var s = G.s, pot = E.potentialStars(s);
    if (pot < 1) { root.Sfx.error(); UI.toast('Você ainda não tem estrelas para ganhar. Continue faturando!', 'info'); return; }
    UI.modal({ icon: '🌅', title: 'Fundar Legado?', html:
      '<p>Você recomeça do zero com <b>+' + pot + ' ⭐</b> (total ' + (s.stars + pot) + ').</p><div class="big-num">+' + Math.round((s.stars + pot) * 10) + '% renda</div>' +
      '<p>Mantém: estrelas, luxo, metas e estatísticas.<br>Zera: dinheiro, negócios, carreira, habilidades, imóveis e investimentos.</p>',
      buttons: [
        { label: 'Fundar Legado', cls: 'btn pink', fn: function () {
          var g = G.prestige();
          root.Sfx.big(); vibrate(40);
          root.Game.save();
          UI.go('home');
          UI.toast('🌅 Novo Legado! +' + g + ' ⭐ — sua renda agora tem +' + Math.round(G.s.stars * 10) + '%.', 'good', null, 5000);
        } },
        { label: 'Ainda não', cls: 'btn ghost' }] });
  };

  UI.claimTour = function () {
    var res = G.claimTourReward();
    if (!res) return;
    root.Sfx.big();
    UI.modal({ icon: '🏆', title: res.label + ' — #' + res.rank, html: '<div class="big-num">+' + F.money(res.cash) + '</div>' +
      (res.boostH ? '<p>Turbo x1,5 por ' + F.time(res.boostH * 3600) + ' ativado!</p>' : '<p>Continue negociando para subir no ranking!</p>') });
    root.Game.save();
    UI.update();
  };

  // Compra real pela loja configurada (Store.available()). Sem loja, o botão nem aparece.
  UI.buyNoAds = function () {
    if (G.s.noAds || !root.Store.available()) return;
    root.Store.buyRemoveAds().then(function (ok) {
      if (!ok) { UI.toast('Compra não concluída. Nada foi cobrado pelo jogo.', 'info'); return; }
      G.s.noAds = true; root.Game.save(); root.Sfx.big();
      UI.toast('✓ Obrigado! Anúncios removidos.', 'good'); UI.update();
    });
  };

  UI.showOffline = function (off) {
    if (!off || off.amount <= 0) return;
    var claimed = false, mode = bonusMode(), p = off.parts;
    var line = function (label, v, neg) { return v > 0 ? '<span>' + label + '</span><b class="' + (neg ? 'neg' : 'pos') + '">' + (neg ? '-' : '+') + F.money(v) + '</b>' : ''; };
    var buttons = [];
    if (mode !== 'free') buttons.push({ label: MODE_ICON[mode] + 'Dobrar para ' + F.money(off.amount * 2), cls: 'btn pink', keep: true, fn: function () {
      if (claimed) return false;
      var give = function () {
        if (claimed) return;
        claimed = true;
        G.earnReward(off.amount);
        root.Sfx.big();
        UI.toast('💰 Ganhos offline dobrados: +' + F.money(off.amount), 'good');
        UI.closeTopModal(); root.Game.save(); UI.update();
      };
      if (mode === 'paid') { give(); return false; }
      root.AdService.rewarded('offline_double').then(function (ok) {
        if (ok) give(); else UI.toast('Anúncio não concluído — nenhuma recompensa foi dada.', 'info');
      });
      return false;
    } });
    buttons.push({ label: 'Coletar', cls: 'btn', fn: function () { claimed = true; root.Sfx.buy(); } });
    UI.modal({ icon: '🌙', title: 'Bem-vindo(a) de volta!', closable: false, html:
      '<p>Você ficou fora por <b>' + F.time(off.elapsed) + '</b>.' + (off.capped ? '<br>Contamos <b>' + F.time(off.secs) + '</b> (limite de ' + off.capH + 'h — aumente com a habilidade Sono Produtivo).' : '') + '</p>' +
      '<div class="big-num">+' + F.money(off.amount) + '</div>' +
      '<div class="kv left">' + line('🏪 Negócios com gerente', p.biz) + line('💼 Salário', p.salary) + line('🏠 Aluguéis (líquido)', p.rent) +
      line('⚙️ Ciclos manuais concluídos', p.manual) + line('👥 Salários de funcionários', p.empUpkeep, true) + '</div>' +
      '<p class="muted small">Média de ' + F.money(off.rate, true) + '/s enquanto você estava fora.</p>',
      buttons: buttons });
    // botão "voltar" do Android equivale a Coletar (o valor base já foi creditado)
    modalStack[modalStack.length - 1].closable = true;
  };

  // Reduzir animações / texto maior (preferências de acessibilidade)
  UI.applySettings = function () {
    var st = G.s.settings, b = document.body;
    var sysReduce = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    cls(b, 'reduce-motion', st.reduceMotion || sysReduce);
    cls(b, 'big-text', st.bigText);
  };
  UI.reduceMotion = function () { return document.body.classList.contains('reduce-motion'); };

  // ---------- montagem e atualização ----------
  UI.build = function () {
    fxRoot = document.getElementById('fx');
    buildHud(); buildTabs();
    buildHome(); buildBiz(); buildInv(); buildLux(); buildMore(); buildLocked();
    UI.applySettings();
    UI.go('home');
  };

  UI.update = function () {
    updateHud();
    var sc = UI.screens[shownScreen()];
    if (sc && sc.update) sc.update();
    // indicadores nas abas
    var s = G.s;
    var bizAlert = D.BUSINESSES.some(function (b) {
      var st = s.biz[b.id];
      return (st.lvl === 0 && s.cash >= E.bizCost(s, b.id, 1)) || (st.lvl > 0 && !st.mgr && s.cash >= b.mgr) ||
        s.events.some(function (e) { return e.biz === b.id && e.cost && e.until > Date.now(); });
    });
    cls(tabBtns.biz, 'alert', bizAlert && UI.tab !== 'biz');
    cls(tabBtns.more, 'alert', !!s.tour.pending || (E.potentialStars(s) >= Math.max(1, Math.ceil(s.stars * 0.5)) && E.potentialStars(s) > 0));
    var nextJob = D.JOBS[s.jobs];
    var dailyReady = !!s.daily && (G.dailyBonusReady() || s.daily.list.some(function (m) { return !m.claimed && G.dailyProgress(m).done; }));
    cls(tabBtns.home, 'alert', UI.tab !== 'home' && ((!!nextJob && s.cash >= nextJob.cost) || dailyReady));
    Object.keys(D.UNLOCKS).forEach(function (k) { cls(tabBtns[k], 'locked', !G.isUnlocked(k)); });
  };

  UI.frame = function () {
    var sc = UI.screens[shownScreen()];
    if (sc && sc.frame) sc.frame();
  };
})(this);
