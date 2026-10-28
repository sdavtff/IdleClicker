# Balanceamento

Todos os números estão em `www/js/data.js`; as fórmulas, em `www/js/economy.js`.
A tabela abaixo foi **gerada pelo próprio código do jogo** com `node tools/balance-sim.js 120 3`:
um jogador "guloso" que toca 3×/s e sempre compra o item com menor tempo de retorno (eventos aleatórios
desligados para o resultado ser reproduzível; anúncios e bolsa não usados).

## Fórmulas

| O quê | Fórmula |
|---|---|
| Custo do próximo nível | `custo = base × r^nível × (1 − 0,03 × Negociador)` com `r` de 1,12 a 1,15 |
| Custo de k níveis | `base × r^n × (r^k − 1)/(r − 1)` |
| Máximo comprável | `k = ⌊ log(dinheiro × (r−1)/custo_próximo + 1) / log r ⌋` |
| Receita por ciclo | `rev × nível × 2^(marcos atingidos) × (1 + 0,5 × funcionários) × (1 + 0,1 × Carisma) × multiplicador_global × evento` |
| Marcos (x2) | níveis 25, 50, 100, 150, 200, 250, 300, 400, 500 |
| Tempo do ciclo | `t / ((1 + 0,06 × Gestão do Tempo) × (1 + bônus de velocidade))` |
| Multiplicador global | `(1 + 0,1 × estrelas) × (1 + bônus de luxo + 0,05 × coleções completas) × turbo (x2 anúncio, x1,5 torneio)` |
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

## Tabela das primeiras 2 horas (jogador ativo, 3 toques/s)

| Min | Faturado (total) | Renda passiva/s | Valor do toque | Patrimônio | Gerentes | Empregos | Estrelas | Negócios (nível) |
|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | $1,51 K | $3 | $15 | $811 | 0 | 2 | 0 | 🍹6 |
| 2 | $4,69 K | $3 | $15 | $3,99 K | 0 | 2 | 0 | 🍹6 |
| 3 | $32,8 K | $216 | $84 | $18,6 K | 1 | 3 | 0 | 🍹28 🍔5 |
| 5 | $135 K | $502 | $445 | $27,7 K | 1 | 4 | 0 | 🍹35 🍔10 🎓4 |
| 10 | $1,84 M | $4,41 K | $2,86 K | $165 K | 2 | 5 | 0 | 🍹50 🍔31 🎓11 💻4 |
| 15 | $10,4 M | $35,3 K | $3,05 K | $3,05 M | 4 | 5 | 0 | 🍹56 🍔50 🎓33 💻25 📺4 |
| 20 | $28,0 M | $46,3 K | $3,05 K | $17,0 M | 4 | 5 | 0 | 🍹57 🍔50 🎓34 💻25 📺5 |
| 30 | $141 M | $271 K | $17,9 K | $31,0 M | 5 | 6 | 1 | 🍹63 🍔52 🎓50 💻32 📺25 🏟️2 |
| 45 | $664 M | $635 K | $18,8 K | $348 M | 5 | 6 | 2 | 🍹69 🍔58 🎓54 💻50 📺32 🏟️9 |
| 60 | $1,98 B | $1,55 M | $137 K | $650 M | 6 | 7 | 4 | 🍹71 🍔60 🎓55 💻50 📺34 🏟️25 ⚡2 |
| 75 | $5,00 B | $3,76 M | $137 K | $2,10 B | 6 | 7 | 7 | 🍹73 🍔63 🎓59 💻51 📺50 🏟️27 ⚡5 |
| 90 | $10,4 B | $7,37 M | $137 K | $5,68 B | 6 | 7 | 10 | 🍹75 🍔65 🎓61 💻53 📺50 🏟️31 ⚡8 |
| 105 | $19,3 B | $10,5 M | $143 K | $13,1 B | 6 | 7 | 13 | 🍹77 🍔67 🎓64 💻55 📺50 🏟️33 ⚡10 |
| 120 | $34,9 B | $19,3 M | $143 K | $18,0 B | 7 | 7 | 18 | 🍹79 🍔69 🎓65 💻57 📺51 🏟️35 ⚡26 🏦2 |

**Jogador casual (1 toque/s):** a curva é parecida depois dos 10 min (renda passiva de $6,8 K/s aos 10 min,
$1,95 M/s aos 60 min, 18 estrelas aos 120 min) — a renda passiva domina, então tocar mais ajuda no começo, mas não é obrigatório.

### Marcos de ritmo (jogador ativo)

| Tempo | Acontecimento |
|---|---|
| 9 s | 1º emprego (Panfleteiro) e 1º negócio (Suco da Esquina) |
| 2 min 21 s | 1º gerente → começa a renda passiva |
| ~4–6 min | 3º e 4º negócios (Academia, PixelForja) |
| ~12 min | 1º item de luxo (carro Vento Turbo) e 5º negócio |
| ~15 min | Renda passiva passa a renda por toque |
| ~25 min | Arena Fênix (6º negócio) |
| ~28 min | **1ª estrela de Legado disponível** |
| ~30–40 min | Imóveis entram no ótimo de retorno |
| ~53 min | SolarVolt Energia (7º negócio) |
| ~1 h 53 min | Banco Cofre Dourado (8º negócio) |

### Leitura do design
- **0–3 min**: o toque é a principal fonte de renda (fase clicker); compras a cada poucos segundos.
- **3–15 min**: gerentes automatizam; a renda passiva cresce cerca de 10× a cada 5 min.
- **15–60 min**: cada negócio novo leva mais tempo (custo ~12× maior, renda ~4,5× maior); marcos x2 viram metas naturais.
- **60–120 min**: crescimento desacelera (~2× a cada 15 min) — o momento em que o Legado (4–18 estrelas = +40% a +180%) passa a valer a pena. Esse é o "muro" desejado que puxa para o prestígio.

Para re-balancear: edite `data.js` e rode `npm run balance`.
