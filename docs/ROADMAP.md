# Próximos passos

## Curto prazo (antes de publicar)
1. **Anúncios reais** (depende de conta AdMob): registrar um provedor com `AdService.setProvider({ showRewarded })`
   usando um plugin Capacitor de AdMob. Só *rewarded*; recompensa apenas quando o SDK confirmar a conclusão.
2. **Compra real** (depende de conta na Play Console): `Store.setProvider({ buy, restore })` com Google Play Billing
   (produto não-consumível `remove_ads`), com validação de recibo no servidor.
3. **Assinatura de release**: gerar keystore própria e publicar um AAB (`./gradlew bundleRelease`) na Play Console.
4. **Backup na nuvem opcional**: Google Play Games Saved Games (mantendo o jogo 100% jogável offline).
5. **Acessibilidade**: reduzir animações e texto maior já existem (v1.1); falta modo de alto contraste e rótulos completos para leitores de tela.
6. **Testes em aparelhos reais**: Android 8 a 15, telas de 5" a 7", aparelhos de entrada (2 GB de RAM).
7. **Idiomas**: extrair textos para um arquivo `i18n` (EN/ES) — a base já está centralizada em `data.js` e `ui.js`.

## Médio prazo (conteúdo)
- **Mais negócios** por categoria (ex.: Varejo → Mercadinho → Rede de Supermercados) e **regiões da cidade** desbloqueáveis.
- **Gerentes com personalidade**: raridades e habilidades (ex.: "−20% tempo de ciclo").
- **Pesquisa & Desenvolvimento**: árvore de *upgrades* permanentes comprados com estrelas.
- **Bolsa avançada**: dividendos, ordens limitadas, IPO das suas próprias empresas.
- **Eventos sazonais** (Carnaval, Black Friday, Natal) com itens de luxo exclusivos.
- Mais conquistas e coleção expandida (barcos, imóveis icônicos) — o sistema de conquistas já existe (v1.1).
- **Personalização**: avatar do magnata, escritório e garagem que mostram os itens de luxo.

## Longo prazo (social e retenção)
- **Torneio semanal online** com ranking real — exige backend próprio com validação no servidor (o cliente não é confiável: o save é local e editável). Manter os rivais locais como fallback offline.
- **Clubes de investidores** (guildas) com metas cooperativas.
- **Passe de temporada justo**: somente cosméticos; nada de vantagem paga.
- **Telemetria opcional** (com consentimento) para ajustar o balanceamento com dados reais de retenção D1/D7/D30.

## Técnico
- Migrar o save para `@capacitor/preferences` (redundância ao `localStorage`).
- *Service worker* para jogar também como PWA no navegador.
- Rodar `npm test` e `npm run test:e2e` no CI a cada push (os testes já existem).
- Pipeline de CI que gera o APK automaticamente a cada *push* (GitHub Actions + `setup-android`).
