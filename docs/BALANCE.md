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
| 🏨 Rede Aurora Hotéis | Turismo | $10 T | 1,15 | $120 M | 300 s | $400 K | $50 T |
| 🏥 Clínica Vida Plena | Saúde | $100 Qa | 1,15 | $2,4 B | 360 s | $6,7 M | $500 Qa |
| 🚚 TransCifra Logística | Logística | $1 Sx | 1,15 | $50 B | 420 s | $119 M | $5 Sx |
| 🛰️ Órbita Cifrão Espacial | Aeroespacial | $10 Sp | 1,15 | $1 T | 480 s | $2,1 B | $50 Sp |

## Tabela das primeiras 2 horas (v2.0 — jogador ativo, 3 toques/s, resgata missões e desafios, compra melhorias/reformas/mérito; eventos aleatórios desligados)

| Min | Faturado (vida) | Renda passiva/s | Valor do toque | Patrimônio | Gerentes | Empregos | ⭐ disponíveis | ⭐ ativas | Conquistas | Negócios (nível) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | $1,99 K | $3 | $15 | $1,29 K | 0 | 2 | 0 | 0 | 1 | 🍹6 |
| 2 | $12,3 K | $163 | $84 | $1,63 K | 1 | 3 | 0 | 0 | 2 | 🍹26 🍔4 |
| 3 | $44,8 K | $227 | $84 | $30,7 K | 1 | 3 | 0 | 0 | 2 | 🍹29 🍔5 |
| 5 | $431 K | $3,77 K | $486 | $98,1 K | 2 | 4 | 0 | 0 | 6 | 🍹50 🍔26 🎓8 💻1 |
| 10 | $5,11 M | $23,6 K | $2,86 K | $1,21 M | 3 | 5 | 0 | 0 | 8 | 🍹55 🍔50 🎓27 💻7 |
| 15 | $23,3 M | $71,8 K | $3,05 K | $8,77 M | 4 | 5 | 0 | 0 | 8 | 🍹61 🍔50 🎓35 💻27 📺5 |
| 20 | $67,4 M | $150 K | $3,05 K | $34,4 M | 4 | 5 | 0 | 0 | 8 | 🍹63 🍔52 🎓50 💻29 📺8 🏟️1 |
| 30 | $375 M | $685 K | $22,3 K | $151 M | 5 | 6 | 1 | 0 | 10 | 🍹68 🍔56 🎓52 💻50 📺28 🏟️5 |
| 45 | $2,62 B | $3,74 M | $22,3 K | $1,32 B | 6 | 6 | 5 | 0 | 12 | 🍹73 🍔62 🎓59 💻51 📺35 🏟️27 ⚡3 |
| 60 | $9,53 B | $9,16 M | $171 K | $3,80 B | 6 | 7 | 9 | 0 | 14 | 🍹78 🍔68 🎓65 💻57 📺51 🏟️34 ⚡9 |
| 75 | $22,2 B | $20,8 M | $171 K | $8,44 B | 6 | 7 | 14 | 0 | 15 | 🍹79 🍔69 🎓66 💻58 📺52 🏟️50 ⚡10 |
| 90 | $53,1 B | $45,6 M | $171 K | $24,4 B | 7 | 7 | 23 | 0 | 15 | 🍹81 🍔71 🎓67 💻59 📺54 🏟️50 ⚡29 |
| 105 | $107 B | $57,0 M | $171 K | $66,6 B | 7 | 7 | 32 | 0 | 17 | 🍹82 🍔72 🎓69 💻60 📺55 🏟️50 ⚡32 🏦1 |
| 120 | $165 B | $104 M | $171 K | $108 B | 7 | 7 | 40 | 0 | 17 | 🍹82 🍔72 🎓69 💻61 📺56 🏟️50 ⚡32 🏦2 |

*⭐ disponíveis = estrelas que o Legado daria naquele momento; ⭐ ativas = estrelas já recebidas.*

### Marcos de ritmo (jogador ativo)

| Tempo | Acontecimento |
|---|---|
| 9 s | 1º emprego (Panfleteiro) e 1º negócio (Suco da Esquina) |
| ~2 min | 1º gerente → começa a renda passiva; 2º negócio |
| ~4–5 min | 3º e 4º negócios (Academia, PixelForja) |
| ~10 min | 5º negócio (Rede Onda Viva) |
| ~17 min | Arena Fênix (6º negócio) |
| ~22 min | **1ª estrela de Legado disponível** |
| ~33 min | SolarVolt Energia (7º negócio) |
| ~1 h 32 min | Banco Cofre Dourado (8º negócio) |
| ~4 h (com Legados) | Rede Aurora Hotéis (9º) |
| ~5 h 25 min | Clínica Vida Plena (10º) |
| 12 h+ | TransCifra Logística e Órbita Cifrão Espacial (objetivos de longo prazo) |

Comparado à v1.1.1 (mesmas condições), a v2.0 fica ~2× mais rápida na primeira sessão (165 B e 40 ⭐ às 2 h, antes 84 B e 28 ⭐),
pelas melhorias de empresa, eficiência, evento de setor, Loja de Mérito e mais conquistas. Cada sistema foi medido isoladamente
e calibrado (ver "Calibração da v2.0").
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

### Calibração da v2.0 (impacto medido de cada sistema, faturamento às 2 h)

| Sistema | 1ª versão | Ajuste aplicado |
|---|---|---|
| Melhorias de empresa (marketing a 100× o preço-base) | 3,7× | marketing 5.000×, automação 2×10⁶×, expansão 10¹⁰× |
| Evento de setor (+50%) | até 5,5× (a data simulada caiu nos negócios-chave) | +25% |
| Loja de Mérito (Luvas de Ouro barata) | 1,6× aos 10 min | Luvas de 10 → 25 medalhas |
| 4 empresas novas (custo ~14× por degrau) | ciclos de Legado aceleravam para 4 min; estrelas de 2,7 mil a 3,3 milhões em 50 min | degraus de 10.000× no custo e r = 1,15: os ciclos voltam a desacelerar |
| Patentes (Barão 50 … Lenda 25 mil) | todas alcançadas em ~4 h | Herdeiro 10, Barão 100, Conde 1 mil, Duque 10 mil, Magnata Imperial 100 mil, Lenda 1 milhão |

### Longo prazo com Legado na v2.0 (`node tools/balance-sim.js 720 2 prestige events`)

Legados: 49 min (+5 ⭐) → 1h23 (10) → 1h59 (20) → 2h32 (40) → … → 4h12 (11,6 mil). Hotel aos 4h16; depois os ciclos
**desaceleram** (5 → 9 → 13 → 23 → 34 → 59 → 85 → 127 min), com a Clínica aos 5h24. Logística e Espaço ficam além de 12 h.
Nenhum NaN, Infinity ou saldo negativo (o simulador aborta se encontrar).

### Longo prazo com Legado (histórico v1.1)

Estratégia: fundar Legado quando as estrelas novas ≥ max(5, estrelas atuais). Resultado da simulação de 8 h (também rodada com 12 h e eventos aleatórios ligados):
1º Legado aos ~54 min (+5 ⭐), depois a cada 30–45 min, dobrando as estrelas (5 → 10 → 20 → 40 → 81 → …).
Todos os números permanecem finitos e não negativos (o simulador aborta se encontrar NaN, Infinity ou saldo negativo).

## Fórmulas da v2.0

| O quê | Fórmula |
|---|---|
| Melhorias de empresa | em sequência: Marketing (nível 25, 5.000× o preço-base, receita ×1,5), Automação (nível 75, 2×10⁶×, ciclo ÷1,25), Expansão (nível 150, 10¹⁰×, receita ×2) |
| Eficiência | patamares de ciclos concluídos 100 / 1 mil / 10 mil / 100 mil / 1 milhão → +5% de receita cada |
| Evento de setor | rodízio fixo a cada 2 dias (6 eventos), +25% de receita nas 2 categorias do evento (vale também offline) |
| Dividendos | quantidade × preço × rendimento/h ÷ 3600 por segundo (0,4% a 3%/h conforme a ação; cripto não paga) |
| Reforma de imóvel | custo-base × 3 × 2,2^nível; +20% de aluguel por nível naquele tipo; até nível 10 |
| Nível do império | ⌊log10(faturamento total) / 0,5⌋; 2 🎖️ por nível (+5 a cada 5 níveis); nunca diminui |
| Medalhas de Mérito | conquistas (+1), Legado (5 + estrelas/10, até 50), desafios semanais (10–15 + 20 na semana perfeita), torneios (2–25) |
| Loja de Mérito | custo × crescimento^nível; Consultoria +5% receita/nível (até 10), Luvas +25% toque, Cofre +2h offline, Contador −3 min no Lucro rápido, Headhunter −15% gerentes, Fundo Fiduciário dinheiro inicial no Legado |
| Patentes de Legado | Herdeiro (10 ⭐) emprego + $1 K inicial · Barão (100) Suco nv 25 com gerente · Conde (1 mil) +2h offline · Duque (10 mil) gerentes −25% · Magnata Imperial (100 mil) 4 negócios nv 25 · Lenda Eterna (1 milhão) +25% receita |
| Multiplicador global (v2.0) | estrelas × conquistas × (1 + 0,05 × Consultoria) × (Lenda ? 1,25 : 1) × (1 + luxo + coleções) × turbos |

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
