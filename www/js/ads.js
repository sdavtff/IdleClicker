/* Monetização justa.
 * - Somente anúncios RECOMPENSADOS e VOLUNTÁRIOS (o jogador escolhe assistir).
 * - Nenhum intersticial, nenhum pop-up de compra repetitivo.
 * - Compra única "Remover anúncios": as recompensas passam a ser instantâneas, sem vídeo.
 *
 * Esta versão é 100% offline: AdService e Store são implementações de demonstração.
 * Para produção, troque os corpos de AdService.rewarded() e Store.buyRemoveAds() pelos
 * SDKs reais (ex.: AdMob Rewarded + Google Play Billing via plugins Capacitor). A interface
 * (Promise<boolean>) foi pensada para isso. */
(function (root) {
  'use strict';

  var AdService = {
    // Retorna Promise<boolean>: true = recompensa liberada.
    rewarded: function (label) {
      var s = root.G && root.G.s;
      if (s && s.noAds) return Promise.resolve(true); // comprou: recompensa direta, sem anúncio
      return new Promise(function (resolve) {
        var secs = 5;
        var el = document.createElement('div');
        el.className = 'ad-screen';
        el.innerHTML =
          '<div class="ad-tag">Anúncio de demonstração</div>' +
          '<div class="ad-count">' + secs + '</div>' +
          '<div class="ad-art">🎮</div>' +
          '<h3 style="margin:14px 0 6px">Aqui entraria um vídeo recompensado</h3>' +
          '<p style="opacity:.75;max-width:320px;font-size:14px">Recompensa: <b>' + label + '</b><br>Versão offline: nenhum anúncio real é carregado.</p>' +
          '<div style="display:flex;gap:10px;margin-top:22px">' +
          '<button class="btn ghost" data-a="cancel">Cancelar</button>' +
          '<button class="btn alt off" data-a="ok">Aguarde...</button></div>';
        document.body.appendChild(el);
        var okBtn = el.querySelector('[data-a=ok]'), cnt = el.querySelector('.ad-count');
        var timer = setInterval(function () {
          secs--;
          cnt.textContent = secs > 0 ? secs : '✓';
          if (secs <= 0) {
            clearInterval(timer);
            okBtn.classList.remove('off');
            okBtn.textContent = 'Receber recompensa';
          }
        }, 1000);
        function close(v) { clearInterval(timer); el.remove(); resolve(v); }
        el.querySelector('[data-a=cancel]').onclick = function () { close(false); };
        okBtn.onclick = function () { if (secs <= 0) close(true); };
      });
    }
  };

  var Store = {
    PRICE_LABEL: 'R$ 9,90',
    // Compra única não-consumível. Demonstração: simula uma compra bem-sucedida.
    buyRemoveAds: function () {
      return Promise.resolve(true);
    },
    restore: function () {
      var s = root.G && root.G.s;
      return Promise.resolve(!!(s && s.noAds));
    }
  };

  root.AdService = AdService;
  root.Store = Store;
})(this);
