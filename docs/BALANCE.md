# Balanceamento

Todos os números estão em `www/js/data.js`; as fórmulas, em `www/js/economy.js`.
A tabela abaixo foi **gerada pelo próprio código do jogo** com `node tools/balance-sim.js 120 3`:
um jogador "guloso" que toca 3×/s, sempre compra o item com menor tempo de retorno e resgata as missões diárias
(eventos aleatórios desligados para o resultado ser reproduzível; bônus e bolsa não usados).

## Fórmulas

| O quê | Fórmula |
|---|---|
| Custo do próximo nível | `custo = base × r^nível × (1 − 0,03 × Negociador)` com `r` de 1,12 a 1,15 |
| Custo de k níveis | `base × r^n × (r^k − 1)/(r − 1)` |
| Máximo comprável | `k = ⌊ log(dinheiro × (r−1)/custo_próximo + 1) / log r ⌋` |
| Receita por ciclo | `rev × nível × 2^(marcos atingidos) × (1 + 0,5 × funcionários) × (1 + 0,1 × Carisma) × multiplicador_global × evento` |
| Marcos (x2) | níveis 25, 50, 100, 150, 200, 250, 300, 400, 500 |
| Tempo do ciclo | `t / ((1 + 0,06 × Gestão do Tempo) × (1 + bônus de velocidade))` |
| Multiplicador global | `(1 + 0,1 × estrelas) × (1 + 0,01 × conquistas) × (1 + bônus de luxo + 0,05 × coleções completas) × turbo (x2, x1,5 torneio)` |
| Funcionário | custo `base × 10 × 2,6^n`; salário = 8% da receita base por funcionário, só enquanto produz |
| Habilidade | `custo × g^nível` (g de 1,85 a 3) |
| Imóvel | `custo × g^quantidade`; aluguel líquido = 90% |
| Toque | `(1 + Σ toque dos empregos) × (1 + 0,5 × Toque de Ouro) × (1 + bônus de toque) × estrelas × turbo + 0,02 × Toque Inteligente × renda/s` |
| Estrelas de Legado | `⌊√(faturamento total / 10^8)⌋ − estrelas já recebidas`; +10% de renda cada |
| Offline | `renda passiva líquida × min(tempo fora, 4 h + bônus)` |
| Prêmio de meta | `min((renda/s + toque) × {15, 45, 120} s, patrimônio × {10, 20, 30}%)` para curto/médio/longo |

## Negócios

| Negócio | Categoria | Custo base | r | Receita/ciclo | Ciclo | $/s por nível | Gerente |
|---|---|---:|---:|---:|---:|---:|---:|
| 🍹 Suco da Esquina | Varejo | $10 | 1,15 | $1,50 | 1,5 s | $1 | $750 |
| 🍔 Burgão Sobre Rodas | Restaurantes | $120 | 1,15 | $12 | 4 s | $3 | $9 K |
| 🎓 Academia Saber+ | Educação | $1,4 K | 1,14 | $110 | 8 s | $13,75 | $80 K |
| 💻 PixelForja Apps | Tecnologia | $16 K | 1,14 | $900 | 15 s | $60 | $600 K |
| 📺 Rede Onda Viva | Mídia | $200 K | 1,13 | $8 K | 30 s | $267 | $6 M |
| 🏟️ Arena Fênix | Esportes | $2,5 M | 1,13 | $70 K | 60 s | $1,17 K | $60 M |
| ⚡ SolarVolt Energia | Energia | $35 M | 1,12 | $650 K | 120 s | $5,4 K | $700 M |
| 🏦 Banco Cofre Dourado | Bancos | $500 M | 1,12 | $6 M | 240 s | $25 K | $10 B |

## Tabela das primeiras 2 horas (v1.1 — jogador ativo, 3 toques/s, resgata missões diárias)

| Min | Faturado (vida) | Renda passiva/s | Valor do toque | Patrimônio | Gerentes | Empregos | ⭐ disponíveis | ⭐ ativas | Conquistas | Negócios (nível) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | $1,51 K | $3 | $15 | $812 | 0 | 2 | 0 | 0 | 1 | 🍹6 |
| 2 | $11,9 K | $157 | $84 | $1,47 K | 1 | 3 | 0 | 0 | 2 | 🍹25 🍔3 |
| 3 | $38,3 K | $115 | $84 | $27,4 K | 1 | 3 | 0 | 0 | 2 | 🍹25 🍔4 |
| 5 | $169 K | $2,82 K | $84 | $71,8 K | 1 | 3 | 0 | 0 | 4 | 🍹50 🍔7 🎓1 |
| 10 | $3,51 M | $13,6 K | $2,86 K | $739 K | 3 | 5 | 0 | 0 | 5 | 🍹51 🍔35 🎓29 💻6 |
| 15 | $16,1 M | $50,9 K | $3,05 K | $4,74 M | 4 | 5 | 0 | 0 | 6 | 🍹57 🍔50 🎓35 💻25 📺4 |
| 20 | $49,7 M | $112 K | $3,05 K | $17,2 M | 4 | 5 | 0 | 0 | 6 | 🍹59 🍔54 🎓50 💻29 📺7 |
| 30 | $182 M | $151 K | $17,9 K | $93,6 M | 4 | 6 | 1 | 0 | 7 | 🍹65 🍔54 🎓50 💻35 📺11 🏟️7 |
| 45 | $901 M | $604 K | $18,8 K | $546 M | 5 | 6 | 3 | 0 | 9 | 🍹70 🍔58 🎓62 💻50 📺35 🏟️9 |
| 60 | $3,39 B | $3,43 M | $18,8 K | $1,27 B | 6 | 6 | 5 | 0 | 12 | 🍹79 🍔63 🎓62 💻51 📺50 🏟️25 ⚡5 |
| 75 | $8,60 B | $8,06 M | $137 K | $4,03 B | 6 | 7 | 9 | 0 | 14 | 🍹79 🍔65 🎓62 💻62 📺51 🏟️31 ⚡8 |
| 90 | $16,8 B | $9,93 M | $143 K | $10,8 B | 6 | 7 | 12 | 0 | 14 | 🍹79 🍔67 🎓64 💻62 📺51 🏟️35 ⚡10 |
| 105 | $29,6 B | $21,3 M | $143 K | $14,0 B | 7 | 7 | 17 | 0 | 14 | 🍹79 🍔67 🎓64 💻62 📺51 🏟️50 ⚡25 |
| 120 | $55,5 B | $30,6 M | $143 K | $25,5 B | 7 | 7 | 23 | 0 | 16 | 🍹100 🍔71 🎓67 💻65 📺54 🏟️50 ⚡28 🏦7 |

*⭐ disponíveis = estrelas que o Legado daria naquele momento; ⭐ ativas = estrelas já recebidas.*

### Marcos de ritmo (jogador ativo)

| Tempo | Acontecimento |
|---|---|
| 9 s | 1º emprego (Panfleteiro) e 1º negócio (Suco da Esquina) |
| ~2 min | 1º gerente → começa a renda passiva; 2º negócio |
| ~5–6 min | 3º e 4º negócios (Academia, PixelForja) |
| ~10 min | 1º item de luxo (Vento Turbo) e 5º negócio |
| ~15 min | Renda passiva passa a renda por toque |
| ~22 min | Arena Fênix (6º negócio) |
| ~25 min | **1ª estrela de Legado disponível** |
| ~23–38 min | Imóveis entram no ótimo de retorno |
| ~52 min | SolarVolt Energia (7º negócio) |
| ~1 h 47 min | Banco Cofre Dourado (8º negócio) |

Comparado à v1.0, as missões diárias e conquistas aceleram a primeira sessão em ~1,5× (sem saltos: os prêmios são
limitados a uma fração do patrimônio).

### Longo prazo com Legado (`node tools/balance-sim.js 480 3 prestige`)

Estratégia: fundar Legado quando as estrelas novas ≥ max(5, estrelas atuais). Resultado da simulação de 8 h:
1º Legado aos ~54 min (+5 ⭐), depois a cada 30–45 min, dobrando as estrelas (5 → 10 → 20 → 40 → 81 → …).
Todos os números permanecem finitos e não negativos (o simulador aborta se encontrar NaN, Infinity ou saldo negativo).

## Recompensas de progressão (v1.1)

| Recurso | Recompensa | Limite |
|---|---|---|
| Metas curto/médio/longo | (renda/s + toque) × 15 / 45 / 120 s | ≤ 10 / 20 / 30 % do patrimônio |
| Missão diária | (renda/s + toque) × 5–10 min, calculado no resgate | ≤ 25 % do patrimônio (mín. $25) |
| Baú diário (3 missões) | (renda/s + toque) × 15 min × (1 + 0,1 × sequência, até +70 %) | ≤ 50 % do patrimônio |
| Conquista (31) | +1 % permanente na receita dos negócios (mantida no Legado) | máx. +31 % |
| Torneio semanal | 3–30 min de renda + Turbo x1,5 por até 2 h | 1 prêmio por semana |
| Turbo gratuito (sem anúncios) | x2 por 30 min | recarga de 30 min após terminar, não acumula |
| Lucro rápido | 10 min de renda | recarga de 15 min |

Prêmios não contam como "faturamento produtivo" (estatística `prodEarned`), então a missão "Fature $X" não se
completa com o prêmio de outra missão. Eles contam, sim, para o faturamento total e para as estrelas de Legado.

## Limites numéricos

- Dinheiro e faturamento: teto de 1e300 (abaixo de `Number.MAX_VALUE`); `earn()` ignora valores não finitos.
- Nível por negócio ≤ 100.000; até 10.000 níveis por compra; ações por operação ≤ 1e15.
- Compras com custo infinito ou NaN são recusadas; o saldo nunca fica negativo (despesas param em $0).

Para re-balancear: edite `data.js` e rode `npm run balance`.
