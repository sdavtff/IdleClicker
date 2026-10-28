# Cifrópolis — Documento de Design (resumo)

> **Do zero ao império.** Um simulador de magnata para celular que une o *idle/clicker* "de zero a herói"
> ao simulador de império de negócios, em retrato, para jogar com uma mão.

## 1. Visão

Você chega a **Cifrópolis**, uma metrópole neon fictícia, com os bolsos vazios. Começa tocando na moeda
para ganhar trocados, arruma um emprego, abre um quiosque de suco… e termina dono de bancos, usinas solares,
iates e jatos, competindo no torneio semanal da bolsa.

**Pilares**
1. **Progresso sempre visível**: três metas (curto, médio e longo prazo) fixas no topo da tela.
2. **Toque satisfatório**: moedas voando, números flutuantes, som e vibração a cada toque.
3. **Decisões simples com profundidade**: comprar nível × gerente × funcionário × investir × luxo.
4. **Respeito ao jogador**: 100% offline, anúncios só por escolha do jogador, compra única que remove anúncios de verdade.

**Mundo e identidade (100% original)**: cidade *Cifrópolis*; empresas *Suco da Esquina*, *Burgão Sobre Rodas*,
*Academia Saber+*, *PixelForja Apps*, *Rede Onda Viva*, *Arena Fênix*, *SolarVolt Energia*, *Banco Cofre Dourado*;
ações *NexaSoft*, *Verdana Agro*, *Órbita Aero*, *Maré Logística*, *Lúmen Saúde*; criptos *ByteCoin*, *GatoMoeda*, *Nébula*.
Paleta roxo-noite com dourado, menta e rosa; logo da moeda com o horizonte da cidade (SVG próprio).

## 2. Público

- 16–45 anos, jogadores casuais e *mid-core* de Android que gostam de *idle*, *tycoon* e números grandes.
- Sessões curtas (2–5 min) várias vezes ao dia + sessões longas de otimização.
- Jogam com uma mão, em pé, no transporte — por isso tudo fica no terço inferior e as abas ficam embaixo.

## 3. Loop principal

```
Tocar → $ → comprar emprego/habilidade → $ por toque maior
      → abrir negócio → tocar no negócio para produzir → contratar GERENTE → renda passiva
      → mais níveis / marcos x2 / funcionários → investir (bolsa, cripto, imóveis) → luxo (bônus + status)
      → faturar bilhões → LEGADO (prestígio): recomeça com +10% por estrela → loop mais rápido
```

| Fase | Duração típica | O que o jogador faz | Desbloqueio-chave |
|---|---|---|---|
| Inicial | 0–5 min | Toca, compra Panfleteiro → Entregador, abre o Suco | 1º emprego, 1º negócio |
| Intermediária | 5–30 min | Gerentes automatizam, abre 3–6 negócios, 1º luxo | Renda passiva > renda por toque (~15 min) |
| Avançada | 30 min+ | Imóveis, bolsa, cripto, coleções, torneio | 1ª estrela de Legado (~28 min), prestígio ideal entre 60 e 120 min |

## 4. Sistemas

| Sistema | Como funciona |
|---|---|
| **Toque** | `toque = (1 + Σ toque dos empregos) × (1 + 0,5×Toque de Ouro) × bônus de luxo × estrelas × turbo + 2% da renda/s × Toque Inteligente` |
| **Carreira** | 7 cargos sequenciais e cumulativos (Panfleteiro → CEO Visionário): somam $ por toque e salário/s |
| **Habilidades** | 6 habilidades com níveis: Toque de Ouro, Carisma (+receita), Toque Inteligente, Negociador (−custo), Gestão do Tempo (+velocidade), Sono Produtivo (+horas offline) |
| **Negócios** | 8 categorias (Varejo, Restaurantes, Educação, Tecnologia, Mídia, Esportes, Energia, Bancos). Cada um tem **níveis**, **marcos** (x2 nos níveis 25/50/100/150…), **funcionários** (até 10, +50% cada, recebem salário só enquanto produzem) e **gerente** (automatiza; produz offline). Sem gerente, o jogador toca no ícone para cada ciclo |
| **Eventos aleatórios** | A cada 1,5–3,5 min, num negócio: *Promoção viral* (x3), *Influencer* (x2), *Crise de fornecedores* (−50%, pague para resolver), *Concorrente* (−30%, lance campanha e vire x1,5) |
| **Bolsa** | 5 ações + 3 criptos. Preço = âncora × e^x (x reverte à média, âncora passeia com leve alta). Cripto tem 3–6× a volatilidade. Notícias geram choques. Gráfico de 6 min, compra/venda 1/10/100/MÁX, corretagem 0,5%, preço médio e lucro/prejuízo |
| **Imóveis** | 5 imóveis compráveis várias vezes (custo ×1,12–1,14). Aluguel contínuo, inclusive offline; manutenção 10% |
| **Luxo & coleção** | 13 itens em 5 categorias (relógios, carros, iates, jatos, arte). Cada item dá status e bônus (renda, toque, aluguel, velocidade, horas offline). Categoria completa = +5% renda global. Itens são permanentes (sobrevivem ao Legado) |
| **Finanças** | Painel de receitas (negócios, salário, aluguéis), despesas (funcionários, manutenção), resultado líquido/s e patrimônio (dinheiro, carteira, ativos) |
| **Torneio semanal** | Semana de segunda a domingo (horário de Brasília). Pontuação = lucro realizado na bolsa. 9 rivais simulados localmente (determinísticos por semana, escalam com o patrimônio). Prêmios: dinheiro + Turbo x1,5 |
| **Legado (prestígio)** | Estrelas = ⌊√(faturamento total ÷ 100 M)⌋ − estrelas já recebidas. Cada estrela: +10% de renda permanente |
| **Offline** | Ao voltar: renda passiva líquida (gerentes + salário + aluguel − despesas) × tempo fora, limitado a 4 h (+1 h por nível de Sono Produtivo, +1 h com a obra *Aurora sobre Cifrópolis*). Opção voluntária de dobrar |
| **Metas** | 3 trilhas (31 curtas, 17 médias, 9 longas, depois geradas infinitamente). Cada meta paga um prêmio proporcional à renda (limitado a uma fração do patrimônio) |

## 5. Monetização justa (diferencial)

- **Só anúncios recompensados voluntários**, em 3 pontos: Turbo x2 por 30 min (acumula até 4 h), Lucro rápido (10 min de renda, recarga de 15 min) e Dobrar ganhos offline.
- **Nenhum** intersticial, nenhum anúncio no meio do jogo, nenhum pop-up de compra repetido.
- **Compra única "Remover anúncios"**: as mesmas recompensas ficam instantâneas, sem vídeo. Remove os anúncios de verdade.
- **100% funcional offline** (save local, rivais do torneio simulados no aparelho).
- **Publicidade honesta**: vídeos e capturas da loja devem usar gravações reais do jogo (a pasta de screenshots do teste automatizado já serve de base).
- Nesta versão, `AdService` e `Store` (em `www/js/ads.js`) são *stubs* de demonstração que simulam o vídeo e a compra; a interface `Promise<boolean>` está pronta para plugar AdMob Rewarded + Google Play Billing.

## 6. UX e arte

- Retrato travado (`screenOrientation="portrait"`), coluna central de até 520 px, áreas de toque ≥ 44 px, abas embaixo.
- HUD fixo: dinheiro grande com brilho dourado, renda/s, turbo ativo, estrelas e as 3 metas.
- Feedback: moedas com física simples, números flutuantes, pulso no saldo, sons sintetizados via WebAudio (sem arquivos), vibração curta.
- Números formatados: `1,25 K`, `3,40 M`, `B`, `T`, `Qa`, `Qi`, `Sx`, `Sp`, `Oc`, `No`, `Dc`, depois `aa`, `ab`…
- Tutorial de ~1 min em 5 passos com destaque pulsante, que pode ser pulado e revisto em Ajustes.

---

# Estrutura técnica

**Tecnologia escolhida:** HTML5 + JavaScript puro (sem *framework*, sem etapa de *build*) empacotado com
**Capacitor 7** para Android.

Por quê: carrega rápido mesmo em aparelhos simples (~170 KB de código), roda 100% offline, as mesmas
regras do jogo rodam no Node para o simulador de balanceamento, e gerar o APK só exige Gradle e o Android SDK.

```
IdleClicker/
├── www/                      ← o jogo (é isso que vai dentro do APK)
│   ├── index.html
│   ├── css/style.css         ← tema, layout retrato, animações
│   ├── assets/icon.svg       ← logo/ícone original
│   └── js/
│       ├── fmt.js            ← números grandes (K, M, B…) e tempo, padrão PT-BR
│       ├── data.js           ← TODO o conteúdo e constantes de balanceamento
│       ├── economy.js        ← fórmulas puras (custos, receitas, multiplicadores, patrimônio)
│       ├── market.js         ← bolsa/cripto (passeio aleatório) e torneio semanal
│       ├── game.js           ← estado, ações, laço de simulação, eventos, metas, offline, prestígio, save
│       ├── audio.js          ← efeitos sonoros sintetizados
│       ├── ads.js            ← AdService (recompensado voluntário) e Store (remover anúncios) — stubs
│       ├── ui.js             ← interface: HUD, abas, telas, toasts, modais, efeitos
│       ├── tutorial.js       ← tutorial de 1 minuto
│       └── main.js           ← boot, laço requestAnimationFrame, autosave, offline, botão voltar
├── android/                  ← projeto nativo gerado pelo Capacitor (Gradle)
├── tools/
│   ├── balance-sim.js        ← simulador: joga 2 h com o código real e gera a tabela
│   ├── smoke-test.js         ← teste automatizado no Chromium com viewport de celular
│   └── gen-icons.js          ← gera ícones e splash do Android a partir do SVG
├── docs/                     ← design, balanceamento, próximos passos
├── capacitor.config.json
└── package.json
```

**Arquitetura**
- `game.js`, `economy.js`, `market.js`, `data.js` e `fmt.js` não tocam no DOM: rodam no navegador e no Node.
- Simulação em `requestAnimationFrame` com `dt` limitado; a UI atualiza a cada 200 ms, alterando os elementos no lugar (sem recriar o DOM, para que nenhum toque se perca); as barras de progresso atualizam a cada frame via `transform`.
- **Save**: `localStorage` (persistente no WebView do Capacitor), salvo a cada 10 s, ao pausar ou minimizar o app e ao sair. O save tem versão e é mesclado com o estado padrão, então novos campos não quebram saves antigos. Também dá para exportar e importar o save em texto (Base64).
- **Offline**: `lastSeen` é gravado em todo save; no boot ou ao voltar ao app calcula-se o tempo ausente (pausas curtas, de até 60 s, são simuladas em tempo real).
- **Android**: retrato travado, `adjustMarginsForEdgeToEdge: auto` (Android 15), botão voltar fecha modal → volta para Início → minimiza o app (`@capacitor/app`).
