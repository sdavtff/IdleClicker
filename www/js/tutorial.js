/* Tutorial curto (~1 minuto): tocar, emprego, primeiro negócio, produzir, metas. Pode ser pulado. */
(function (root) {
  'use strict';
  var G = root.G, UI = root.UI, E = root.E;
  var bubble = null, focused = null;
  var shownDone = false; // a etapa já estava cumprida ao ser exibida (ex.: rever tutorial) → avança por botão

  var STEPS = [
    { tab: 'home', who: 'Bem-vindo(a) a Cifrópolis!',
      text: 'Você começa com os bolsos vazios. Toque na moeda para ganhar seus primeiros trocados até juntar $25.',
      target: function () { return document.getElementById('tapBtn'); },
      done: function (s) { return s.cash >= 25 || s.jobs > 0; } },
    { tab: 'home', who: 'Primeiro emprego',
      text: 'Com $25 você já pode trabalhar como Panfleteiro: ganha salário e cada toque rende mais.',
      target: function () { return document.getElementById('jobBtn'); },
      done: function (s) { return s.jobs > 0; } },
    { tab: 'biz', who: 'Seu primeiro negócio',
      text: 'Hora de empreender! Junte $10 (tocando ou com o salário) e abra o Suco da Esquina.',
      target: function () { var c = document.getElementById('biz-suco'); return c && c.querySelector('.btn'); },
      done: function (s) { return s.biz.suco.lvl > 0; } },
    { tab: 'biz', who: 'Produzindo',
      text: 'Toque no ícone 🍹 para produzir. Depois contrate um 👔 gerente: ele produz sozinho, até com o jogo fechado!',
      target: function () { var c = document.getElementById('biz-suco'); return c && c.querySelector('.ico'); },
      done: function (s) { return s.stats.bizRuns > 0; } },
    { tab: null, who: 'Metas sempre à vista',
      text: 'No topo ficam suas metas de curto, médio e longo prazo — cada uma dá um prêmio. Invista, compre luxo e construa seu império. Bom jogo, magnata!',
      target: function () { return document.getElementById('goals'); },
      done: null }
  ];

  function clearFocus() {
    if (focused) focused.classList.remove('tut-focus');
    focused = null;
  }

  function finish() {
    G.s.tutorial = -1;
    clearFocus();
    if (bubble) { bubble.remove(); bubble = null; }
    root.Game.save();
  }

  function render() {
    var s = G.s, i = s.tutorial;
    if (i < 0 || i >= STEPS.length) { finish(); return; }
    var st = STEPS[i];
    if (st.tab && UI.tab !== st.tab) UI.go(st.tab);
    if (!bubble) {
      bubble = UI.h('div', { class: 'tut-bubble' });
      document.getElementById('tut-root').appendChild(bubble);
    }
    bubble.innerHTML = '';
    var skip = UI.h('button', { class: 'skip', text: 'Pular tutorial' });
    skip.addEventListener('click', finish);
    var actions = UI.h('div', { class: 'tut-actions' }, skip, UI.h('span', { class: 'muted', style: 'color:#8b80aa', text: (i + 1) + '/' + STEPS.length }));
    shownDone = !!(st.done && st.done(s));
    if (!st.done) {
      var ok = UI.h('button', { class: 'btn', text: 'Vamos lá!' });
      ok.addEventListener('click', finish);
      actions.appendChild(ok);
    } else if (shownDone) {
      var next = UI.h('button', { class: 'btn', text: 'Próximo ›' });
      next.addEventListener('click', function () { s.tutorial++; render(); });
      actions.appendChild(next);
    }
    bubble.appendChild(UI.h('div', { class: 'tut-who', text: st.who }));
    bubble.appendChild(UI.h('div', { text: st.text }));
    bubble.appendChild(actions);
    focus();
  }

  function focus() {
    var st = STEPS[G.s.tutorial];
    if (!st) return;
    var el = st.target();
    if (el !== focused) {
      clearFocus();
      if (el) {
        el.classList.add('tut-focus');
        focused = el;
        if (el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }

  var Tutorial = {
    start: function () {
      if (G.s.tutorial < 0) return;
      render();
    },
    active: function () { return G.s.tutorial >= 0 && !!bubble; },
    // chamado periodicamente
    update: function () {
      var s = G.s;
      if (s.tutorial < 0 || !bubble) return;
      var st = STEPS[s.tutorial];
      if (st && st.done && !shownDone && st.done(s)) {
        s.tutorial++;
        root.Sfx.buy();
        render();
      } else focus();
    },
    skip: finish
  };
  root.Tutorial = Tutorial;
})(this);
