/* v2.0 — Componentes visuais: ícones SVG, partículas de compra, gráfico de área, detalhes da empresa e perfil.
 * Usa os utilitários expostos por ui.js em UI._ (não duplica lógica de jogo). */
(function (root) {
  'use strict';
  var D = root.D, E = root.E, G = root.G, F = root.F, UI = root.UI;
  var h = UI.h, esc = UI.esc, _ = UI._;

  // ---------- ícones (traço único, herdam a cor do texto) ----------
  function svg(body) {
    return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }
  UI.ICON = {
    home: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M14.6 9.4c-.5-.8-1.5-1.2-2.6-1.2-1.6 0-2.7.8-2.7 2s1.2 1.6 2.7 1.9 2.9.8 2.9 2-1.3 2-2.9 2c-1.2 0-2.3-.5-2.8-1.3"/>'),
    biz: svg('<path d="M3.5 9.5 5 4.5h14l1.5 5"/><path d="M3.5 9.5h17a2.8 2.8 0 0 1-5.6 0 2.8 2.8 0 0 1-5.8 0 2.8 2.8 0 0 1-5.6 0z"/><path d="M5 12.5v7h14v-7"/><path d="M10 19.5v-4h4v4"/>'),
    inv: svg('<path d="M3.5 20.5h17"/><path d="m4.5 15.5 4.5-5 3.5 3 6.5-7.5"/><path d="M15 6h4v4"/>'),
    lux: svg('<path d="M6.5 3.5h11l3.5 5-9 12-9-12z"/><path d="M3 8.5h18M9.5 3.5 8 8.5l4 12 4-12-1.5-5"/>'),
    more: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>'),
    info: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>')
  };

  // ---------- partículas (compras, prêmios) ----------
  var COLORS = ['#ffc93c', '#2ee6a8', '#4cc9f0', '#ff7ab6', '#fff3b0'];
  UI.burstAt = function (x, y, n, big) {
    if (UI.reduceMotion()) return;
    var fx = document.getElementById('fx');
    if (!fx || fx.childElementCount > 80) return;
    var ring = h('div', { class: 'burst-ring' + (big ? ' big' : '') });
    ring.style.left = x + 'px'; ring.style.top = y + 'px';
    fx.appendChild(ring);
    ring.addEventListener('animationend', function () { ring.remove(); });
    for (var i = 0; i < n; i++) {
      var p = h('div', { class: 'spark' });
      var a = (i / n) * Math.PI * 2 + Math.random() * 0.6, d = (big ? 70 : 38) + Math.random() * (big ? 70 : 30);
      p.style.left = x + 'px'; p.style.top = y + 'px';
      p.style.background = COLORS[i % COLORS.length];
      p.style.setProperty('--dx', Math.cos(a) * d + 'px');
      p.style.setProperty('--dy', Math.sin(a) * d + 'px');
      fx.appendChild(p);
      p.addEventListener('animationend', function (e) { e.target.remove(); });
    }
  };

  // ---------- gráfico de área (canvas) ----------
  UI.drawArea = function (cv, values, color) {
    var dpr = root.devicePixelRatio || 1, w = cv.clientWidth || 300, hgt = cv.clientHeight || 150;
    var key = values.length + ':' + values[values.length - 1] + ':' + w;
    if (cv._key === key) return;
    cv._key = key;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(hgt * dpr); }
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    var pts = values.filter(function (v) { return isFinite(v); });
    if (pts.length < 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Coletando dados… (1 ponto por minuto de jogo)', w / 2, hgt / 2);
      ctx.textAlign = 'start';
      return;
    }
    var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
    var pad = (max - min) * 0.1 || max * 0.05 || 1;
    var lo = Math.max(0, min - pad), hi = max + pad;
    var X = function (i) { return 6 + (w - 12) * i / (pts.length - 1); };
    var Y = function (v) { return hgt - 10 - (hgt - 22) * (v - lo) / (hi - lo); };
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    for (var g = 1; g < 4; g++) { ctx.beginPath(); ctx.moveTo(0, hgt * g / 4); ctx.lineTo(w, hgt * g / 4); ctx.stroke(); }
    ctx.beginPath();
    pts.forEach(function (v, i) { if (i === 0) ctx.moveTo(X(i), Y(v)); else ctx.lineTo(X(i), Y(v)); });
    ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.lineTo(X(pts.length - 1), hgt); ctx.lineTo(X(0), hgt); ctx.closePath();
    var grd = ctx.createLinearGradient(0, 0, 0, hgt);
    grd.addColorStop(0, color + '66'); grd.addColorStop(1, color + '00');
    ctx.fillStyle = grd; ctx.fill();
    ctx.beginPath(); ctx.arc(X(pts.length - 1), Y(pts[pts.length - 1]), 3.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.font = '600 10px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.textAlign = 'right';
    ctx.fillText(F.money(max), w - 6, 12);
    ctx.fillText(F.money(min), w - 6, hgt - 2);
    ctx.textAlign = 'start';
  };

  // ---------- detalhes da empresa (estatísticas + melhorias) ----------
  UI.bizDetail = function (id) {
    var b = E.BIZ[id], body = h('div', { class: 'biz-detail' });
    function render() {
      var s = G.s, st = s.biz[id], now = Date.now();
      body.innerHTML = '';
      var T = E.bizTime(s, id), net = E.bizCycleNet(s, id, now), eff = E.effLevel(s, id);
      var nextEff = D.EFFICIENCY[eff];
      var mults = [
        ['Marcos de nível', E.milestoneMult(st.lvl)],
        ['Funcionários', 1 + D.EMP_BONUS * st.emp],
        ['Melhorias', E.upgMult(s, id)],
        ['Eficiência', E.effMult(s, id)],
        ['Evento de setor', E.sectorMult(id, now)],
        ['Bônus globais', E.globalMult(s, now, true)]
      ];
      body.appendChild(h('div', { class: 'kv left', html:
        '<span>Nível</span><b>' + F.num(st.lvl) + '</b>' +
        '<span>Lucro por ciclo (líquido)</span><b>' + F.money(net, true) + '</b>' +
        '<span>Tempo do ciclo</span><b>' + (T < 10 ? T.toFixed(2).replace('.', ',') + ' s' : F.time(T)) + '</b>' +
        '<span>Renda por segundo</span><b>' + (st.mgr ? F.money(net / T, true) + '/s' : 'manual') + '</b>' +
        '<span>Funcionários</span><b>' + st.emp + '/' + D.EMP_MAX + '</b>' +
        '<span>Ciclos concluídos</span><b>' + F.num(st.runs) + '</b>' +
        '<span>Faturado nesta partida</span><b>' + F.money(st.earned) + '</b>' +
        '<span>Salários pagos</span><b>' + F.money(st.wages) + '</b>' +
        '<span>⚙️ Eficiência</span><b>' + eff + '/' + D.EFFICIENCY.length + (nextEff ? ' · próxima em ' + F.num(nextEff - st.runs) + ' ciclos' : ' · máxima') + '</b>' }));
      body.appendChild(h('div', { class: 'mult-chips', html: mults.map(function (m) {
        return '<span class="' + (m[1] > 1.0001 ? 'on' : '') + '">' + m[0] + ' <b>x' + (m[1] >= 100 ? F.num(m[1]) : m[1].toFixed(2).replace('.', ',')) + '</b></span>';
      }).join('') }));
      body.appendChild(h('h2', { text: 'Melhorias da empresa' }));
      D.BIZ_UPGRADES.forEach(function (u, i) {
        var owned = (st.up || 0) > i, isNext = (st.up || 0) === i;
        var cost = E.upgCost(s, id, i), locked = st.lvl < u.req;
        var btn = h('button', { class: 'btn' + (owned ? ' done' : '') });
        if (owned) _.btnLabel(btn, '✓');
        else if (!isNext) { _.btnLabel(btn, '🔒', 'anterior'); btn.classList.add('off'); }
        else if (locked) { _.btnLabel(btn, '🔒', 'Nv ' + u.req); btn.classList.add('off'); }
        else { _.btnLabel(btn, 'Comprar', F.money(cost)); if (s.cash < cost) btn.classList.add('off'); }
        btn.addEventListener('click', function () {
          if (owned) return;
          _.act(btn, function () { return G.buyUpgrade(id); });
          render();
        });
        body.appendChild(h('div', { class: 'upg-row' + (owned ? ' got' : '') },
          h('div', { class: 'ico', text: u.icon }),
          h('div', { class: 'grow' }, h('div', { class: 'title wrap', text: u.name }),
            h('div', { class: 'muted small', text: u.desc + ' · exige nível ' + u.req + (owned ? '' : ' · ' + F.money(cost)) })),
          btn));
      });
      body.appendChild(h('p', { class: 'muted small', text: 'Melhorias e estatísticas zeram no Legado, junto com os níveis. A eficiência sobe com os ciclos concluídos (+5% por patamar).' }));
    }
    render();
    UI.modal({ icon: b.icon, title: b.name, body: body, buttons: [{ label: 'Fechar', cls: 'btn ghost' }] });
  };

  // ---------- perfil do império ----------
  UI.profile = function () {
    var s = G.s, lvl = E.empireLevel(s), rk = D.LEGACY_RANKS[E.legacyRank(s)], next = D.LEGACY_RANKS[E.legacyRank(s) + 1];
    var lo = lvl ? Math.pow(10, lvl * D.EMPIRE_STEP) : 0, hi = E.empireNextAt(lvl);
    var frac = Math.max(0, Math.min(1, (s.lifetimeEarned - lo) / (hi - lo)));
    UI.modal({ icon: '🏛️', title: 'Seu império', html:
      '<div class="profile-grid">' +
      '<div><div class="sum-k">Nível do império</div><div class="sum-v">' + lvl + '</div></div>' +
      '<div><div class="sum-k">Patente</div><div class="sum-v">' + rk.icon + ' ' + rk.name + '</div></div>' +
      '<div><div class="sum-k">Medalhas</div><div class="sum-v">🎖️ ' + F.num(s.merit.bal) + '</div></div></div>' +
      '<p>Próximo nível ao faturar <b>' + F.money(hi) + '</b> no total</p>' +
      '<div class="bar big"><i style="width:' + (frac * 100).toFixed(1) + '%"></i></div>' +
      '<p class="muted small">Cada nível dá ' + D.EMPIRE_MEDALS + ' 🎖️ (+5 a cada 5 níveis). O nível nunca diminui, nem no Legado.</p>' +
      '<div class="kv left">' +
      '<span>⭐ Estrelas de Legado</span><b>' + F.num(s.stars) + (next ? ' (próxima patente: ' + F.num(next.stars) + ')' : '') + '</b>' +
      '<span>🏅 Conquistas</span><b>' + E.achCount(s) + '/' + D.ACHIEVEMENTS.length + '</b>' +
      '<span>🏢 Empresas</span><b>' + E.ownedCount(s) + '/' + D.BUSINESSES.length + '</b>' +
      '<span>💎 Itens de luxo</span><b>' + Object.keys(s.lux).length + '/' + D.LUXURY.length + '</b>' +
      '<span>💰 Faturamento total</span><b>' + F.money(s.lifetimeEarned) + '</b></div>',
      buttons: [
        { label: '🎖️ Loja de Mérito', cls: 'btn', fn: function () { UI.luxTab = 'merit'; UI.go('lux'); } },
        { label: '🌅 Legado e patentes', cls: 'btn ghost', fn: function () { UI.moreTab = 'legacy'; UI.go('more'); } },
        { label: 'Fechar', cls: 'btn ghost' }] });
  };
})(this);
