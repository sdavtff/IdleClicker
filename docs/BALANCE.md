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
| Funcionário | custo = **menor** entre `10 × preço-base × 2,6^n` e `max(preço-base, 30 s × renda-base no nível atual) × 2,6^n`; salário = 8% da receita base/s por funcionário, **pago a cada ciclo concluído, descontado da receita do ciclo** |
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
| 🏦 Banco Cofre Dourado | Bancos | $500 M | 1,12 | $6 M | 240 s | $25 K | $2 B |

## Tabela das primeiras 2 horas (v1.1.1 — jogador ativo, 3 toques/s, resgata missões, eventos aleatórios desligados)

| Min | Faturado (vida) | Renda passiva/s | Valor do toque | Patrimônio | Gerentes | Empregos | ⭐ disponíveis | ⭐ ativas | Conquistas | Negócios (nível) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | $1,51 K | $3 | $15 | $812 | 0 | 2 | 0 | 0 | 1 | 🍹6 |
| 2 | $11,9 K | $157 | $84 | $1,47 K | 1 | 3 | 0 | 0 | 2 | 🍹25 🍔3 |
| 3 | $44,4 K | $227 | $84 | $30,2 K | 1 | 3 | 0 | 0 | 2 | 🍹29 🍔5 |
| 5 | $183 K | $1,17 K | $445 | $46,1 K | 1 | 4 | 0 | 0 | 4 | 🍹50 🍔10 🎓4 |
| 10 | $2,46 M | $8,91 K | $2,86 K | $345 K | 3 | 5 | 0 | 0 | 5 | 🍹50 🍔32 🎓26 💻6 |
| 15 | $12,7 M | $45,7 K | $3,05 K | $4,13 M | 4 | 5 | 0 | 0 | 6 | 🍹56 🍔50 🎓33 💻25 📺4 |
| 20 | $39,8 M | $98,7 K | $3,05 K | $18,3 M | 4 | 5 | 0 | 0 | 6 | 🍹59 🍔50 🎓50 💻28 📺7 |
| 30 | $216 M | $414 K | $17,9 K | $67,5 M | 5 | 6 | 1 | 0 | 7 | 🍹64 🍔53 🎓50 💻35 📺28 🏟️4 |
| 45 | $1,19 B | $829 K | $18,8 K | $787 M | 5 | 6 | 3 | 0 | 10 | 🍹70 🍔59 🎓55 💻50 📺35 🏟️10 ⚡1 |
| 60 | $4,20 B | $5,37 M | $18,8 K | $1,44 B | 6 | 6 | 6 | 0 | 12 | 🍹74 🍔63 🎓59 💻51 📺50 🏟️31 ⚡5 |
| 75 | $11,0 B | $8,90 M | $137 K | $6,40 B | 6 | 7 | 10 | 0 | 14 | 🍹76 🍔66 🎓62 💻54 📺50 🏟️34 ⚡9 |
| 90 | $21,3 B | $16,9 M | $137 K | $11,7 B | 6 | 7 | 14 | 0 | 14 | 🍹77 🍔67 🎓64 💻55 📺50 🏟️50 ⚡9 |
| 105 | $45,7 B | $34,0 M | $143 K | $21,4 B | 7 | 7 | 21 | 0 | 15 | 🍹79 🍔69 🎓66 💻58 📺53 🏟️50 ⚡30 🏦3 |
| 120 | $83,9 B | $44,6 M | $143 K | $45,9 B | 7 | 7 | 28 | 0 | 15 | 🍹81 🍔71 🎓68 💻60 📺55 🏟️50 ⚡33 🏦5 |

*⭐ disponíveis = estrelas que o Legado daria naquele momento; ⭐ ativas = estrelas já recebidas.*

### Marcos de ritmo (jogador ativo)

| Tempo | Acontecimento |
|---|---|
| 9 s | 1º emprego (Panfleteiro) e 1º negócio (Suco da Esquina) |
| ~2 min | 1º gerente → começa a renda passiva; 2º negócio |
| ~4–6 min | 3º e 4º negócios (Academia, PixelForja) |
| ~12 min | 5º negócio (Rede Onda Viva) |
| ~15 min | Renda passiva passa a renda por toque |
| ~22 min | Arena Fênix (6º negócio) |
| ~26 min | **1ª estrela de Legado disponível** |
| ~37 min | SolarVolt Energia (7º negócio) |
| ~1 h 40 min | Banco Cofre Dourado (8º negócio) |

Comparado à v1.1.0 (mesmas condições, eventos desligados), os primeiros 30 min são idênticos e a segunda hora fica
~1,5× mais rápida, pelo novo custo dos funcionários tardios e pelo gerente do Banco mais barato (28 estrelas às 2 h, antes 22).
*Observação: as tabelas anteriores tinham eventos aleatórios ligados por engano (a trava de relógio reativava o
valor-sentinela usado para desligá-los); agora `G.options.randomEvents` desliga de fato.*

### Custo-benefício por negócio (renda-base, sem multiplicadores)

| Negócio | Nível típico | Gerente: retorno | 1º funcionário | 10º funcionário |
|---|---:|---:|---:|---:|
| Suco da Esquina | 50 | 3 s | 1 s | 1 h 34 min |
| Burgão Sobre Rodas | 50 | 15 s | 4 s | 6 h |
| Academia Saber+ | 50 | 29 s | 10 s | 16 h |
| PixelForja Apps | 50 | 50 s | 27 s | 1 d 17 h |
| Rede Onda Viva | 30 | 6 min | 1 min | 4 d (antes: 17 d) |
| Arena Fênix | 25 | 17 min | 1,5 min | 6 d (antes: 58 d) |
| SolarVolt Energia | 25 | 43 min | 4,7 min | 18 d (antes: 176 d) |
| Banco Cofre Dourado | 10 | 2 h 13 min (antes: 11 h) | 1 h 19 min (antes: 13 h) | 299 d (antes: 8 anos) |

Com estrelas, conquistas e luxo, o retorno real é várias vezes menor. O 10º funcionário é objetivo de fim de jogo.

### Longo prazo com Legado (`node tools/balance-sim.js 480 3 prestige events`)

Estratégia: fundar Legado quando as estrelas novas ≥ max(5, estrelas atuais). Resultado da simulação de 8 h (também rodada com 12 h e eventos aleatórios ligados):
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
