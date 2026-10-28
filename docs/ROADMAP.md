# Próximos passos

## Curto prazo (antes de publicar)
1. **Anúncios reais**: trocar o corpo de `AdService.rewarded()` (`www/js/ads.js`) por AdMob Rewarded
   (ex.: plugin `@capacitor-community/admob`). Manter somente o formato *rewarded*; nunca intersticial.
2. **Compra real**: implementar `Store.buyRemoveAds()` e `Store.restore()` com Google Play Billing
   (produto não-consumível `remove_ads`), validando a compra e persistindo `noAds`.
3. **Assinatura de release**: gerar keystore própria e publicar um AAB (`./gradlew bundleRelease`) na Play Console.
4. **Backup na nuvem opcional**: Google Play Games Saved Games (mantendo o jogo 100% jogável offline).
5. **Acessibilidade**: modo de alto contraste, tamanho de fonte, opção de reduzir animações.
6. **Testes em aparelhos reais**: Android 8 a 15, telas de 5" a 7", aparelhos de entrada (2 GB de RAM).
7. **Idiomas**: extrair textos para um arquivo `i18n` (EN/ES) — a base já está centralizada em `data.js` e `ui.js`.

## Médio prazo (conteúdo)
- **Mais negócios** por categoria (ex.: Varejo → Mercadinho → Rede de Supermercados) e **regiões da cidade** desbloqueáveis.
- **Gerentes com personalidade**: raridades e habilidades (ex.: "−20% tempo de ciclo").
- **Pesquisa & Desenvolvimento**: árvore de *upgrades* permanentes comprados com estrelas.
- **Bolsa avançada**: dividendos, ordens limitadas, IPO das suas próprias empresas.
- **Eventos sazonais** (Carnaval, Black Friday, Natal) com itens de luxo exclusivos.
- **Conquistas** com recompensas e coleção expandida (barcos, imóveis icônicos, NFTs fictícios satirizados).
- **Personalização**: avatar do magnata, escritório e garagem que mostram os itens de luxo.

## Longo prazo (social e retenção)
- **Torneio semanal online** com ranking real (servidor leve; manter os rivais locais como fallback offline).
- **Clubes de investidores** (guildas) com metas cooperativas.
- **Passe de temporada justo**: somente cosméticos; nada de vantagem paga.
- **Telemetria opcional** (com consentimento) para ajustar o balanceamento com dados reais de retenção D1/D7/D30.

## Técnico
- Migrar o save para `@capacitor/preferences` (redundância ao `localStorage`).
- *Service worker* para jogar também como PWA no navegador.
- Testes unitários das fórmulas (`economy.js`) e testes E2E no CI (o `tools/smoke-test.js` já serve de base).
- Pipeline de CI que gera o APK automaticamente a cada *push* (GitHub Actions + `setup-android`).
