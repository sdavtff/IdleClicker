# Changelog

## 2.0.0 — grande atualização
### Negócios
- 4 novos setores de fim de jogo: Rede Aurora Hotéis (Turismo), Clínica Vida Plena (Saúde), TransCifra Logística e Órbita Cifrão Espacial (12 empresas no total).
- Melhorias por empresa (Marketing, Automação, Expansão regional), eficiência por ciclos concluídos (+5% por patamar),
  estatísticas individuais (ciclos, faturado, salários pagos), janela de detalhes e ranking das empresas mais lucrativas.
- Eventos de setor: a cada 2 dias, duas categorias ficam +25% em alta (rodízio fixo, vale offline).
### Investimentos e finanças
- Ações pagam dividendos por hora (inclusive offline); 2 ações e 1 cripto novas; resumo da carteira com lucro/prejuízo.
- 2 imóveis novos e reformas (+20% de aluguel por nível, até 10).
- Painel de finanças: evolução do patrimônio (gráfico), composição da renda, ranking das empresas, dividendos e ganhos offline.
### Progressão e conteúdo
- Nível do império (sobe com o faturamento total) com recompensas.
- Medalhas de Mérito (ganhas jogando, nunca vendidas) e Loja de Mérito com 6 melhorias permanentes e 2 itens exclusivos.
- Desafios semanais (3 por semana + "semana perfeita"), 6 novos tipos de missão diária, 20 novas conquistas (51 no total),
  7 novos itens de luxo (categoria Mansões & Ilhas e Exclusivos de Mérito), novas metas.
- Segundo torneio semanal: Corrida Empresarial (faturamento produtivo); rivais simulados marcados com 🤖 nos dois torneios.
- Patentes de Legado (Herdeiro → Lenda Eterna) com vantagens ao recomeçar; Legado também rende medalhas.
### Interface
- Ícones SVG próprios, transições direcionais, cartões com cor do setor, partículas de compra, brilho de subida de nível,
  saldo com contagem animada, chip de perfil (nível, estrelas, medalhas), barra de progresso do império, banner de evento.
### Correções
- Botão de gerente mostrava/comparava o preço-base, ignorando descontos.
- Laço lento repassava sempre 0,25 s aos sistemas de meta em quadros longos (histórico de patrimônio atrasava).
- Itens exclusivos (preço em dinheiro zero) não podem ser comprados com dinheiro.
### Save e desempenho
- Save v3 com validação de todos os campos novos e presente de atualização para quem vem da 1.x.
- 3 backups automáticos em rodízio + 1 backup diário; recuperação tenta do mais recente ao mais antigo.
- Salvamento rápido logo após compras; blocos lentos do painel de finanças atualizam 1×/s.
### Testes
- 68 testes unitários, 55 verificações E2E, atualização a partir da 1.0.0/1.1.0/1.1.1 (20 cada),
  checagem visual (5 tamanhos × 2 escalas de texto) e teste de desempenho com CPU 4× mais lenta (11 verificações).


## 1.1.1 — correção e polimento
### Painel financeiro
- Salários de funcionários eram descontados a cada frame (inclusive na produção manual), mas o painel só somava
  negócios com gerente; sem dinheiro, a parte não paga "sumia". Agora o salário é pago a cada ciclo concluído,
  descontado da receita do próprio ciclo (sempre positiva) — com ou sem gerente. O faturamento conta o líquido.
- Painel mostra negócios sem gerente (em produção/parados), totais realmente pagos em salários e manutenção e o
  fluxo **medido** nos últimos 60 s (créditos e débitos reais).
### Economia
- Custo de funcionário: o menor entre a fórmula antiga e 30 s da renda-base do negócio × 2,6^n — início idêntico,
  10º funcionário dos negócios tardios passou de meses/anos para dias de retorno. Gerente do Banco: $10 B → $2 B.
- Simulador e testes desligam eventos aleatórios de fato (`G.options.randomEvents`); simulações de 15 min a 12 h,
  com Legado e com eventos, sem NaN/Infinity/saldo negativo.
### Robustez e segurança
- Uma exceção no laço do jogo congelava tudo; agora o laço reagenda antes e trata o erro.
- Cópia para a área de transferência informa sucesso/falha real; placar do torneio e estatísticas da bolsa limitados.
### Interface e acessibilidade
- Alvos de toque ≥ 44 px (segmentados, quantidades, botão de evento); interruptores ocupam a linha inteira, com
  `role="switch"` e `aria-checked`.
- Toasts posicionados logo abaixo da altura real do HUD; metas concluídas em sequência viram um único aviso.
- Metas do topo abrem detalhe com progresso numérico; título do torneio quebra linha.
- "Rever tutorial" não pula etapas já cumpridas (botão "Próximo").
### Testes
- 51 testes unitários, 43 verificações E2E, 18 de atualização v1.0 → atual e checagem visual em 5 tamanhos × 2 escalas.


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
- 35 testes unitários (`npm test`), 36 verificações de ponta a ponta no navegador (`npm run test:e2e`) e
  teste de atualização v1.0 → v1.1 com o código real da v1.0 (`npm run test:upgrade`).

## 1.0.0
- Primeira versão jogável.
