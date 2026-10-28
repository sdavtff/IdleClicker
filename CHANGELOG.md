# Changelog

## 1.1.0
### Segurança e save
- Validação campo a campo de saves carregados e importados (`www/js/save.js`): tipos, faixas, IDs conhecidos,
  sem poluição de protótipo, estrelas limitadas ao faturamento, versões futuras recusadas.
- Correção de XSS: texto vindo do save (notícias) é escapado antes de ir para o HTML.
- Save ilegível nunca é perdido: cópia em `_corrupt`, restauração automática do backup `_auto` e aviso ao jogador.
- Backups `_auto` (5 min) e `_preimport` (antes de importar/restaurar/apagar), com restauração em Ajustes.
- Importação com confirmação, mensagem de erro clara e limite de tamanho; importar não gera ganho offline repetido.
- Migração de versão (v1 → v2).
### Economia
- Guardas contra NaN/Infinity (dinheiro infinito + "MÁX" gerava NaN), limites de nível e quantidade.
- Corrigido `int()` do validador que transformava valores inválidos em 0 em vez do padrão.
- Prêmios não contam como faturamento produtivo (missão "Fature" não se autoalimenta).
- Prêmios de missões e baú calculados no resgate e limitados a uma fração do patrimônio.
- Cartão do negócio mostra receita líquida de salários; painel de finanças explica negócios sem gerente e conquistas.
### Offline e relógio
- Tempo ausente medido a partir do maior horário já visto (anti-manipulação do relógio).
- Temporizadores e boosts não ficam presos no futuro se o relógio for atrasado; semana do torneio não regride.
- Resumo offline detalhado por fonte.
### Monetização
- Removidos a tela de anúncio falsa e a compra simulada. Sem SDK real: bônus gratuitos com recarga, loja oculta.
### Progressão
- 31 conquistas (+1% permanente cada), missões diárias com baú e sequência, desbloqueio progressivo das abas.
### Interface e acessibilidade
- Tela de carregamento e tela de erro no boot, tela de aba bloqueada, painel de conquistas, cartão de missões.
- Opções "Reduzir animações" (respeita também a preferência do sistema) e "Texto maior"; foco visível; contraste maior.
- Apagar progresso com dupla confirmação; torneio identificado como "rivais simulados".
### Testes
- 35 testes unitários (`npm test`) e 36 verificações de ponta a ponta no navegador (`npm run test:e2e`).

## 1.0.0
- Primeira versão jogável.
