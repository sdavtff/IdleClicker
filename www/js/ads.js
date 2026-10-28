/* Monetização justa — camada de integração.
 *
 * Regras do jogo:
 * - Só anúncios RECOMPENSADOS e VOLUNTÁRIOS; nenhum intersticial, nenhum pop-up de compra.
 * - Recompensa só é concedida quando o SDK confirma que o anúncio foi assistido até o fim.
 * - Nenhum pagamento é simulado: sem loja configurada, não há compra disponível.
 *
 * Estado desta versão: NENHUM SDK de anúncios ou de pagamentos está integrado (o jogo é 100% offline).
 * Por isso AdService.available() e Store.available() retornam false e o jogo oferece os mesmos
 * bônus de forma GRATUITA, com tempo de recarga (ver G.useFreeBoost / G.applyQuickCash).
 *
 * Para integrar de verdade (ex.: plugin Capacitor de AdMob e Google Play Billing), implemente
 * `provider` abaixo com as funções reais; o restante do jogo já usa esta interface. */
(function (root) {
  'use strict';

  // Ponto único de integração. Deixe null enquanto não houver SDK real configurado.
  // Formato esperado:
  //   { showRewarded: function (placement) { return Promise<boolean /* true só se assistiu até o fim */> } }
  var provider = null;

  var AdService = {
    available: function () { return !!(provider && typeof provider.showRewarded === 'function'); },
    // Promise<boolean>. Sem provedor real: nunca concede recompensa.
    rewarded: function (placement) {
      if (!AdService.available()) return Promise.resolve(false);
      return Promise.resolve()
        .then(function () { return provider.showRewarded(placement); })
        .then(function (ok) { return ok === true; }, function () { return false; });
    },
    setProvider: function (p) { provider = p; }
  };

  // Compras dentro do app. Sem integração com uma loja real, nada é vendido.
  var storeProvider = null;
  var Store = {
    available: function () { return !!(storeProvider && typeof storeProvider.buy === 'function'); },
    // Promise<boolean>: true só quando a loja confirma a compra.
    buyRemoveAds: function () {
      if (!Store.available()) return Promise.resolve(false);
      return Promise.resolve()
        .then(function () { return storeProvider.buy('remove_ads'); })
        .then(function (ok) { return ok === true; }, function () { return false; });
    },
    restore: function () {
      if (!Store.available() || typeof storeProvider.restore !== 'function') return Promise.resolve(false);
      return Promise.resolve()
        .then(function () { return storeProvider.restore('remove_ads'); })
        .then(function (ok) { return ok === true; }, function () { return false; });
    },
    setProvider: function (p) { storeProvider = p; }
  };

  root.AdService = AdService;
  root.Store = Store;
})(this);
