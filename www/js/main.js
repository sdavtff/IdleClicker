/* Inicialização: carrega o save, calcula ganhos offline, roda o laço do jogo e salva automaticamente. */
(function (root) {
  'use strict';
  var G = root.G, UI = root.UI, F = root.F, D = root.D;

  var storage = null;
  try { storage = root.localStorage; storage.setItem('__t', '1'); storage.removeItem('__t'); } catch (e) { storage = null; }
  // Sem localStorage (raro): mantém em memória para o jogo funcionar mesmo assim.
  if (!storage) {
    var mem = {};
    storage = { getItem: function (k) { return k in mem ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; } };
  }
  G.storage = storage;

  var Game = {
    save: function () { return G.save(); }
  };
  root.Game = Game;

  function wireEvents() {
    G.on('buy', function (e) {
      if (e.kind === 'biz' && e.first) {
        root.Sfx.big();
        UI.toast('🎉 Novo negócio: <b>' + root.E.BIZ[e.id].name + '</b>!', 'good');
      } else if (e.kind === 'biz' && e.milestone) {
        root.Sfx.big();
        UI.toast('🚀 Marco Nv ' + e.milestone + ': receita x2 em <b>' + root.E.BIZ[e.id].name + '</b>!', 'good');
      } else if (e.kind === 'mgr') {
        UI.toast('👔 ' + root.E.BIZ[e.id].mgrName + ' contratado(a)! Produção automática.', 'good');
      } else if (e.kind === 'lux') {
        root.Sfx.big();
        var l = root.E.LUX[e.id];
        UI.toast(l.icon + ' <b>' + l.name + '</b> entrou para a coleção!', 'good');
        var col = root.E.completedCollections(G.s);
        if (col > (Game._col || 0)) UI.toast('🏆 Coleção completa! +5% de renda global.', 'good', null, 4500);
        Game._col = col;
      } else if (e.kind === 'job') {
        UI.toast('💼 Novo cargo: <b>' + D.JOBS[G.s.jobs - 1].name + '</b>', 'good');
      }
    });
    G.on('goal', function (g) {
      UI.flashGoal(g.kind);
      root.Sfx.big();
      UI.toast('✅ Meta concluída: ' + g.txt + ' <b>+' + F.money(g.reward) + '</b>', 'good');
    });
    G.on('bizEvent', function (ev) {
      var t = G.EVENT_TYPES[ev.type], b = root.E.BIZ[ev.biz];
      if (t.good) root.Sfx.big(); else root.Sfx.alert();
      UI.toast(t.icon + ' <b>' + b.name + '</b>: ' + t.title + ' ' + t.desc, t.good ? 'good' : 'bad', function () { UI.go('biz'); }, 5000);
    });
    G.on('news', function (n) {
      if (UI.tab === 'inv' || (G.s.hold[n.id] && G.s.hold[n.id].qty > 0))
        UI.toast((n.up ? '🟢 ' : '🔴 ') + UI.esc(n.txt), 'info', function () { UI.go('inv'); }, 4000);
    });
    G.on('ach', function (a) {
      root.Sfx.big();
      UI.toast(a.icon + ' Conquista: <b>' + a.name + '</b> · +1% de receita permanente', 'good', function () { UI.moreTab = 'ach'; UI.go('more'); }, 4500);
    });
    G.on('unlock', function (k) {
      root.Sfx.big();
      var names = { inv: '📈 Investimentos', lux: '💎 Luxo & Coleção' };
      UI.toast('🔓 Nova área desbloqueada: <b>' + names[k] + '</b>!', 'good', function () { UI.go(k); }, 5000);
      var b = UI.tabButton(k);
      if (b) { b.classList.remove('unlock-pop'); void b.offsetWidth; b.classList.add('unlock-pop'); }
    });
    G.on('saveError', function () {
      UI.toast('⚠️ Não foi possível salvar no aparelho (armazenamento cheio ou bloqueado). Exporte seu save em Mais › Ajustes.', 'bad', null, 7000);
    });
    G.on('bizPay', UI.bizPay);
    G.on('tourEnd', function (p) {
      UI.toast('🏆 O torneio semanal terminou! Você ficou em #' + p.rank + '. Toque para resgatar.', 'good', function () { UI.moreTab = 'tour'; UI.go('more'); }, 6000);
    });
  }

  function catchUp(sec) {
    // pequenas pausas (< 60 s) são simuladas em tempo real; maiores usam o cálculo offline
    while (sec > 0) { var d = Math.min(0.5, sec); G.tick(d); sec -= d; }
  }

  function offlineCheck() {
    var off = G.computeOffline();
    if (off) UI.showOffline(off);
    else if (G.clockBack && !Game._clockWarned) {
      Game._clockWarned = true;
      UI.toast('🕒 O relógio do aparelho voltou no tempo. Ganhos offline voltam a contar quando ele passar do último horário registrado.', 'info', null, 7000);
    }
  }

  function resume() {
    var gap = (Date.now() - G.s.lastSeen) / 1000;
    if (gap > 60 || gap < -120) offlineCheck();
    else if (gap > 0.5) catchUp(gap);
    G.touch(Date.now());
    G.save();
    last = performance.now();
  }

  var last = 0, uiAcc = 0, saveAcc = 0;
  function frame(t) {
    // o app voltou de segundo plano antes do evento visibilitychange: aplica o tempo ausente
    var gapMs = Date.now() - G.s.lastSeen;
    if (gapMs > 2000 || gapMs < -120000) { resume(); t = last; }
    var dt = Math.min(0.5, Math.max(0, (t - last) / 1000));
    last = t;
    G.tick(dt);
    G.touch(Date.now());
    UI.frame();
    uiAcc += dt; saveAcc += dt;
    if (uiAcc >= 0.2) { uiAcc = 0; UI.update(); root.Tutorial.update(); }
    if (saveAcc >= 10) { saveAcc = 0; G.save(); }
    requestAnimationFrame(frame);
  }

  function setupBackButton() {
    var cap = root.Capacitor;
    var App = cap && cap.Plugins && cap.Plugins.App;
    if (!App || !App.addListener) return;
    App.addListener('backButton', function () {
      if (UI.closeTopModal()) return;
      if (UI.tab !== 'home') { UI.go('home'); return; }
      G.save();
      if (App.minimizeApp) App.minimizeApp(); else if (App.exitApp) App.exitApp();
    });
    App.addListener('pause', function () { G.save(); });
    App.addListener('resume', function () { resume(); });
  }

  function loadNotice(res) {
    if (res.status === 'recovered') {
      UI.modal({ icon: '🩹', title: 'Save recuperado', html:
        '<p>Seu save principal estava danificado (' + UI.esc(res.error) + '). Restauramos o <b>backup automático</b> mais recente.</p>' +
        '<p class="muted small">A cópia danificada foi guardada em Mais › Ajustes › Backups locais.</p>' });
    } else if (res.status === 'failed') {
      UI.modal({ icon: '⚠️', title: 'Não foi possível ler o save', html:
        '<p>' + UI.esc(res.error) + '</p><p>Um novo jogo foi iniciado. <b>O save original não foi apagado</b>: está em Mais › Ajustes › Backups locais, para você copiar ou tentar de novo depois de atualizar o jogo.</p>' });
    }
  }

  function boot() {
    var res = G.load();
    root.Sfx.setEnabled(G.s.settings.sound);
    Game._col = root.E.completedCollections(G.s);
    UI.build();
    wireEvents();
    G.checkTournament(Date.now());
    G.ensureDaily(Date.now());
    if (res.status === 'ok' || res.status === 'recovered') offlineCheck();
    loadNotice(res);
    if (G.s.tour.pending) setTimeout(function () { UI.toast('🏆 Prêmio do torneio esperando por você!', 'good', function () { UI.moreTab = 'tour'; UI.go('more'); }, 6000); }, 1500);
    G.touch(Date.now());
    // não sobrescreve o save principal ilegível antes de guardar a cópia (G.load já guardou em KEYS.bad)
    G.save();
    UI.update();
    root.Tutorial.start();
    var loading = document.getElementById('loading');
    if (loading) loading.remove();

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) G.save(); else resume();
    });
    root.addEventListener('pagehide', function () { G.save(); });
    setupBackButton();
    document.addEventListener('pointerdown', function () { root.Sfx.unlock(); }, { once: true });
    last = performance.now();
    requestAnimationFrame(frame);
  }

  // Falha inesperada no boot: mostra uma tela amigável em vez de uma tela vazia.
  function safeBoot() {
    try { boot(); } catch (e) {
      if (root.console) console.error(e);
      var el = document.getElementById('loading');
      if (el) {
        el.classList.add('error');
        el.innerHTML = '';
        var box = document.createElement('div');
        box.className = 'boot-error';
        var t = document.createElement('h3'); t.textContent = 'Algo deu errado ao abrir o jogo';
        var p = document.createElement('p'); p.textContent = 'Seu progresso não foi apagado. Tente abrir de novo. (' + (e && e.message ? e.message : e) + ')';
        var b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Tentar de novo';
        b.onclick = function () { location.reload(); };
        box.appendChild(t); box.appendChild(p); box.appendChild(b);
        el.appendChild(box);
      }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeBoot);
  else safeBoot();
})(this);
