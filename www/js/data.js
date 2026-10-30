/* Conteúdo do jogo: negócios, carreira, habilidades, ativos, imóveis, luxo e metas.
 * Todo o mundo de Cifrópolis é original. Ajuste valores aqui para balancear. */
(function (root) {
  'use strict';
  var D = {};

  D.GAME_NAME = 'Cifrópolis';
  D.VERSION = '2.0.0';
  D.SAVE_KEY = 'cifropolis_save_v1';
  D.SAVE_VERSION = 3;
  D.MAX_BIZ_LVL = 100000;  // limite de nível por negócio (evita overflow nos custos)
  D.MAX_BUY_PER_TAP = 10000;

  // custo(n) = cost * r^n   |   receita/ciclo = rev * nivel * marcos * multiplicadores
  D.BUSINESSES = [
    { id: 'suco',   name: 'Suco da Esquina',     cat: 'Varejo',       icon: '🍹', color: '#ff9f1c', cost: 10,    r: 1.15, rev: 1.5,   t: 1.5, mgr: 750,   mgrName: 'Dona Cida' },
    { id: 'burger', name: 'Burgão Sobre Rodas',  cat: 'Restaurantes', icon: '🍔', color: '#ff595e', cost: 120,   r: 1.15, rev: 12,    t: 4,   mgr: 9000,  mgrName: 'Chef Tavinho' },
    { id: 'escola', name: 'Academia Saber+',     cat: 'Educação',     icon: '🎓', color: '#8ac926', cost: 1400,  r: 1.14, rev: 110,   t: 8,   mgr: 8e4,   mgrName: 'Profª Lúcia' },
    { id: 'pixel',  name: 'PixelForja Apps',     cat: 'Tecnologia',   icon: '💻', color: '#1982c4', cost: 16000, r: 1.14, rev: 900,   t: 15,  mgr: 6e5,   mgrName: 'Dev Kenji' },
    { id: 'radio',  name: 'Rede Onda Viva',      cat: 'Mídia',        icon: '📺', color: '#9b5de5', cost: 2e5,   r: 1.13, rev: 8000,  t: 30,  mgr: 6e6,   mgrName: 'Âncora Bia' },
    { id: 'arena',  name: 'Arena Fênix',         cat: 'Esportes',     icon: '🏟️', color: '#f15bb5', cost: 2.5e6, r: 1.13, rev: 7e4,   t: 60,  mgr: 6e7,   mgrName: 'Técnico Duda' },
    { id: 'solar',  name: 'SolarVolt Energia',   cat: 'Energia',      icon: '⚡', color: '#f9c80e', cost: 3.5e7, r: 1.12, rev: 6.5e5, t: 120, mgr: 7e8,   mgrName: 'Engª Raissa' },
    { id: 'banco',  name: 'Banco Cofre Dourado', cat: 'Bancos',       icon: '🏦', color: '#00bbf9', cost: 5e8,   r: 1.12, rev: 6e6,   t: 240, mgr: 2e9,   mgrName: 'Sr. Valença' },
    // v2.0 — fase avançada (desbloqueiam em sequência, como os demais)
    { id: 'hotel',  name: 'Rede Aurora Hotéis',  cat: 'Turismo',      icon: '🏨', color: '#ff7aa2', cost: 1e13,  r: 1.15, rev: 1.2e8, t: 300, mgr: 5e13,  mgrName: 'Concierge Íris' },
    { id: 'saude',  name: 'Clínica Vida Plena',  cat: 'Saúde',        icon: '🏥', color: '#3ddc97', cost: 1e17,  r: 1.15, rev: 2.4e9, t: 360, mgr: 5e17,  mgrName: 'Drª Helena' },
    { id: 'logist', name: 'TransCifra Logística', cat: 'Logística',   icon: '🚚', color: '#ffb347', cost: 1e21,  r: 1.15, rev: 5e10,  t: 420, mgr: 5e21,  mgrName: 'Capitão Rui' },
    { id: 'espaco', name: 'Órbita Cifrão Espacial', cat: 'Aeroespacial', icon: '🛰️', color: '#7c8cff', cost: 1e25,  r: 1.15, rev: 1e12,  t: 480, mgr: 5e25,  mgrName: 'Astronauta Lia' }
  ];

  // Melhorias de empresa (v2.0): compradas em sequência, uma vez por empresa. Custo = preço-base × costMul.
  // Efeitos: mult (× receita) ou speed (÷ tempo do ciclo). Mantidas até o Legado (como os níveis).
  D.BIZ_UPGRADES = [
    { id: 'mkt',  name: 'Campanha de marketing', icon: '📣', req: 25,  costMul: 5000, mult: 1.5,  desc: '+50% de receita' },
    { id: 'auto', name: 'Automação da produção', icon: '🤖', req: 75,  costMul: 2e6,  speed: 1.25, desc: 'ciclos 25% mais rápidos' },
    { id: 'exp',  name: 'Expansão regional',     icon: '🗺️', req: 150, costMul: 1e10, mult: 2,    desc: 'receita x2 (novas filiais)' }
  ];

  // Eficiência (v2.0): bônus por produtividade conforme os ciclos concluídos pela empresa (permanente na partida).
  D.EFFICIENCY = [100, 1000, 10000, 100000, 1000000]; // cada patamar: +5% de receita
  D.EFF_BONUS = 0.05;

  // Marcos de nível: cada um dobra a receita do negócio.
  D.MILESTONES = [25, 50, 100, 150, 200, 250, 300, 400, 500];

  D.EMP_MAX = 10;          // funcionários por negócio
  D.EMP_BONUS = 0.5;       // +50% receita cada
  D.EMP_UPKEEP = 0.08;     // salário: 8% da receita base por funcionário, pago a cada ciclo concluído
  D.EMP_COST_SEC = 30;     // custo escalado do funcionário: segundos de renda-base do negócio no nível atual
  D.EMP_COST_GROWTH = 2.6; // × 2,6 a cada contratação (mesmo fator da fórmula original)

  // Carreira (sequencial e cumulativa). Fase inicial do jogo.
  D.JOBS = [
    { id: 'panfleteiro', name: 'Panfleteiro',        icon: '📄', cost: 25,    tap: 1,     sal: 0.5 },
    { id: 'entregador',  name: 'Entregador de Bike', icon: '🚲', cost: 300,   tap: 4,     sal: 3 },
    { id: 'vendedor',    name: 'Vendedor',           icon: '🛍️', cost: 4000,  tap: 15,    sal: 20 },
    { id: 'supervisor',  name: 'Supervisor',         icon: '📋', cost: 6e4,   tap: 60,    sal: 150 },
    { id: 'consultor',   name: 'Consultor',          icon: '💼', cost: 1e6,   tap: 300,   sal: 1200 },
    { id: 'diretor',     name: 'Diretor Executivo',  icon: '🏢', cost: 2e7,   tap: 1500,  sal: 1e4 },
    { id: 'ceo',         name: 'CEO Visionário',     icon: '👑', cost: 5e8,   tap: 1e4,   sal: 1e5 }
  ];

  // Habilidades com níveis. custo = cost * g^nivel
  D.SKILLS = [
    { id: 'toque',   name: 'Toque de Ouro',     icon: '👆', desc: '+50% de ganho por toque',        cost: 50,   g: 1.9, max: 50 },
    { id: 'carisma', name: 'Carisma',           icon: '😎', desc: '+10% receita dos negócios',      cost: 500,  g: 1.85, max: 50 },
    { id: 'smart',   name: 'Toque Inteligente', icon: '🧠', desc: 'Toque rende +2% da renda/s',     cost: 2000, g: 2.2, max: 25 },
    { id: 'negocia', name: 'Negociador',        icon: '🤝', desc: '-3% no custo dos negócios',      cost: 5000, g: 2.5, max: 10 },
    { id: 'tempo',   name: 'Gestão do Tempo',   icon: '⏱️', desc: '+6% velocidade de produção',     cost: 8000, g: 2.3, max: 15 },
    { id: 'offline', name: 'Sono Produtivo',    icon: '😴', desc: '+1h de ganhos offline',          cost: 2e4,  g: 3,   max: 8 }
  ];

  // Bolsa de Cifrópolis — preços oscilam a cada segundo.
  D.STOCKS = [
  // div = dividendos por hora (fração do preço), pagos continuamente a quem tem a ação (inclusive offline).
    { id: 'NXS', name: 'NexaSoft',        icon: '🧬', p: 120, vol: 0.008, drift: 0.00004, div: 0.010 },
    { id: 'VRD', name: 'Verdana Agro',    icon: '🌾', p: 45,  vol: 0.005, drift: 0.00003, div: 0.020 },
    { id: 'ORB', name: 'Órbita Aero',     icon: '🚀', p: 310, vol: 0.011, drift: 0.00005, div: 0.004 },
    { id: 'MAR', name: 'Maré Logística',  icon: '🚢', p: 28,  vol: 0.006, drift: 0.00002, div: 0.025 },
    { id: 'LUM', name: 'Lúmen Saúde',     icon: '💊', p: 88,  vol: 0.007, drift: 0.00004, div: 0.015 },
    { id: 'AUR', name: 'Aurora Energia',  icon: '🔋', p: 64,  vol: 0.006, drift: 0.00003, div: 0.022 },
    { id: 'MEL', name: 'Mel Doce Alimentos', icon: '🍯', p: 19, vol: 0.004, drift: 0.00002, div: 0.030 }
  ];
  D.CRYPTOS = [
    { id: 'BYTE', name: 'ByteCoin',  icon: '🪙', p: 2400, vol: 0.025, drift: 0.0001 },
    { id: 'GATO', name: 'GatoMoeda', icon: '🐱', p: 0.8,  vol: 0.045, drift: 0.0001 },
    { id: 'NEB',  name: 'Nébula',    icon: '🌌', p: 140,  vol: 0.032, drift: 0.0001 },
    { id: 'LUA',  name: 'LuaToken',  icon: '🌙', p: 12,   vol: 0.038, drift: 0.0001 }
  ];
  D.TRADE_FEE = 0.005; // 0,5% de corretagem

  D.NEWS = {
    up: ['{n} anuncia lucro recorde!', '{n} fecha parceria gigante', 'Analistas elevam {n} para COMPRA', '{n} lança produto revolucionário'],
    down: ['{n} sofre investigação', 'CEO da {n} renuncia', '{n} decepciona no balanço', 'Recall de produtos da {n}']
  };

  // Imóveis geram aluguel contínuo (inclusive offline). Manutenção = 10% do aluguel.
  D.PROPS = [
    { id: 'kitnet',    name: 'Kitnet no Centro',     icon: '🏠', cost: 5000,  rent: 8,     g: 1.12 },
    { id: 'apto',      name: 'Apartamento Vista Mar', icon: '🏢', cost: 1.2e5, rent: 150,   g: 1.12 },
    { id: 'praia',     name: 'Casa de Praia',        icon: '🏖️', cost: 2e6,   rent: 2200,  g: 1.13 },
    { id: 'comercial', name: 'Torre Comercial',      icon: '🏙️', cost: 6e7,   rent: 5.5e4, g: 1.13 },
    { id: 'shopping',  name: 'Shopping Cifrão',      icon: '🛒', cost: 2e9,   rent: 1.6e6, g: 1.14 },
    { id: 'resort',    name: 'Resort Costa Dourada', icon: '🏝️', cost: 8e10,  rent: 5e7,   g: 1.14 },
    { id: 'arranha',   name: 'Arranha-céu Cifrão',   icon: '🌆', cost: 3e12,  rent: 1.5e9, g: 1.15 }
  ];
  D.PROP_UPKEEP = 0.1;
  // Reforma (v2.0): por tipo de imóvel; cada nível +20% de aluguel daquele tipo. custo = custo-base × 3 × 2,2^nível
  D.RENO_MAX = 10;
  D.RENO_BONUS = 0.2;
  D.RENO_COST_MUL = 3;
  D.RENO_GROWTH = 2.2;

  // Luxo & coleção. bonus: inc (negócios), tap, rent, speed, offline (horas)
  D.LUX_CATS = [
    { id: 'watch', name: 'Relógios', icon: '⌚' },
    { id: 'car',   name: 'Carros',   icon: '🏎️' },
    { id: 'yacht', name: 'Iates',    icon: '🛥️' },
    { id: 'jet',   name: 'Jatos',    icon: '🛩️' },
    { id: 'art',   name: 'Arte',     icon: '🖼️' },
    { id: 'mansion', name: 'Mansões & Ilhas', icon: '🏝️' },
    { id: 'exclusive', name: 'Exclusivos de Mérito', icon: '🎖️' }
  ];
  D.LUXURY = [
    { id: 'w1', cat: 'watch', name: 'Cronos Clássico',          icon: '⌚',  cost: 2e4,   status: 5,   bonus: { tap: 0.25 } },
    { id: 'w2', cat: 'watch', name: 'Cronos Platina',           icon: '⌚',  cost: 3e6,   status: 25,  bonus: { tap: 0.5 } },
    { id: 'w3', cat: 'watch', name: 'Cronos Diamante Eterno',   icon: '💎',  cost: 5e8,   status: 120, bonus: { tap: 1 } },
    { id: 'c1', cat: 'car',   name: 'Vento Turbo',              icon: '🚗',  cost: 8e4,   status: 10,  bonus: { inc: 0.03 } },
    { id: 'c2', cat: 'car',   name: 'Raio GT',                  icon: '🏎️', cost: 2.5e6, status: 30,  bonus: { inc: 0.06 } },
    { id: 'c3', cat: 'car',   name: 'Vórtex Hiper',             icon: '🏎️', cost: 1.5e8, status: 90,  bonus: { inc: 0.1 } },
    { id: 'y1', cat: 'yacht', name: 'Lancha Maré Alta',         icon: '🚤',  cost: 1e6,   status: 20,  bonus: { rent: 0.15 } },
    { id: 'y2', cat: 'yacht', name: 'Iate Aurora',              icon: '🛥️', cost: 3e8,   status: 110, bonus: { inc: 0.12 } },
    { id: 'j1', cat: 'jet',   name: 'Jatinho Nimbus',           icon: '🛩️', cost: 5e7,   status: 70,  bonus: { speed: 0.1 } },
    { id: 'j2', cat: 'jet',   name: 'Jato Estratos X',          icon: '✈️',  cost: 2e10,  status: 300, bonus: { inc: 0.2 } },
    { id: 'a1', cat: 'art',   name: 'Aurora sobre Cifrópolis',  icon: '🖼️', cost: 5e5,   status: 15,  bonus: { offline: 1 } },
    { id: 'a2', cat: 'art',   name: 'O Magnata de Bronze',      icon: '🗿',  cost: 8e7,   status: 80,  bonus: { inc: 0.08 } },
    { id: 'a3', cat: 'art',   name: 'Mosaico Neon',             icon: '🎨',  cost: 1e10,  status: 250, bonus: { inc: 0.15 } },
    // v2.0
    { id: 'c4', cat: 'car',   name: 'Aurora Elétrico Concept',  icon: '🚘',  cost: 2e12,  status: 180, bonus: { inc: 0.12 } },
    { id: 'y3', cat: 'yacht', name: 'Mega-iate Leviatã',        icon: '🛳️', cost: 1e14,  status: 400, bonus: { inc: 0.15 } },
    { id: 'm1', cat: 'mansion', name: 'Cobertura Horizonte',    icon: '🏙️', cost: 4e9,   status: 60,  bonus: { rent: 0.25 } },
    { id: 'm2', cat: 'mansion', name: 'Mansão Vila Dourada',    icon: '🏰',  cost: 2e11,  status: 150, bonus: { offline: 1 } },
    { id: 'm3', cat: 'mansion', name: 'Ilha Esmeralda',         icon: '🏝️', cost: 5e13,  status: 350, bonus: { inc: 0.2 } },
    // exclusivos: só com Medalhas de Mérito (não à venda por dinheiro)
    { id: 'x1', cat: 'exclusive', name: 'Troféu Cifrão de Ouro', icon: '🏆',  cost: 0, merit: 60,  status: 200, bonus: { inc: 0.05 } },
    { id: 'x2', cat: 'exclusive', name: 'Estátua do Fundador',  icon: '🗽',  cost: 0, merit: 150, status: 400, bonus: { inc: 0.1, tap: 0.5 } }
  ];
  D.COLLECTION_BONUS = 0.05; // +5% renda global por categoria completa

  D.STATUS_TITLES = [
    [0, 'Anônimo'], [10, 'Emergente'], [50, 'Influente'], [150, 'Figurão'],
    [400, 'Magnata'], [800, 'Lenda de Cifrópolis'], [1500, 'Ícone Global'], [2600, 'Mito Vivo']
  ];

  // Metas: curto, médio e longo prazo (sempre visíveis).
  D.GOALS = {
    short: [
      { t: 'cash', v: 25, txt: 'Junte $25 tocando' },
      { t: 'job', v: 1, txt: 'Consiga um emprego' },
      { t: 'biz', id: 'suco', v: 1, txt: 'Abra o Suco da Esquina' },
      { t: 'biz', id: 'suco', v: 10, txt: 'Suco da Esquina nível 10' },
      { t: 'skill', id: 'toque', v: 1, txt: 'Aprenda Toque de Ouro' },
      { t: 'biz', id: 'burger', v: 1, txt: 'Abra o Burgão Sobre Rodas' },
      { t: 'job', v: 2, txt: 'Vire Entregador de Bike' },
      { t: 'mgr', id: 'suco', txt: 'Contrate a gerente Dona Cida' },
      { t: 'biz', id: 'suco', v: 25, txt: 'Suco da Esquina nível 25' },
      { t: 'biz', id: 'burger', v: 10, txt: 'Burgão nível 10' },
      { t: 'biz', id: 'escola', v: 1, txt: 'Abra a Academia Saber+' },
      { t: 'mgr', id: 'burger', txt: 'Contrate o Chef Tavinho' },
      { t: 'lux', id: 'w1', txt: 'Compre o Cronos Clássico' },
      { t: 'trade', v: 1, txt: 'Compre sua primeira ação' },
      { t: 'prop', id: 'kitnet', v: 1, txt: 'Compre uma Kitnet' },
      { t: 'biz', id: 'burger', v: 25, txt: 'Burgão nível 25' },
      { t: 'biz', id: 'pixel', v: 1, txt: 'Abra a PixelForja Apps' },
      { t: 'mgr', id: 'escola', txt: 'Contrate a Profª Lúcia' },
      { t: 'lux', id: 'c1', txt: 'Compre o carro Vento Turbo' },
      { t: 'biz', id: 'suco', v: 50, txt: 'Suco da Esquina nível 50' },
      { t: 'biz', id: 'escola', v: 25, txt: 'Academia nível 25' },
      { t: 'biz', id: 'radio', v: 1, txt: 'Abra a Rede Onda Viva' },
      { t: 'mgr', id: 'pixel', txt: 'Contrate o Dev Kenji' },
      { t: 'biz', id: 'pixel', v: 25, txt: 'PixelForja nível 25' },
      { t: 'lux', id: 'a1', txt: 'Compre a obra "Aurora sobre Cifrópolis"' },
      { t: 'biz', id: 'arena', v: 1, txt: 'Abra a Arena Fênix' },
      { t: 'mgr', id: 'radio', txt: 'Contrate a Âncora Bia' },
      { t: 'biz', id: 'radio', v: 25, txt: 'Onda Viva nível 25' },
      { t: 'biz', id: 'solar', v: 1, txt: 'Abra a SolarVolt Energia' },
      { t: 'mgr', id: 'arena', txt: 'Contrate o Técnico Duda' },
      { t: 'biz', id: 'banco', v: 1, txt: 'Abra o Banco Cofre Dourado' },
      // v2.0 (sempre acrescentadas no fim: o índice da meta fica salvo)
      { t: 'upg', v: 1, txt: 'Compre uma melhoria de empresa' },
      { t: 'reno', v: 1, txt: 'Reforme um imóvel' },
      { t: 'biz', id: 'hotel', v: 1, txt: 'Abra a Rede Aurora Hotéis' },
      { t: 'upg', v: 8, txt: 'Tenha 8 melhorias de empresa' },
      { t: 'biz', id: 'saude', v: 1, txt: 'Abra a Clínica Vida Plena' },
      { t: 'biz', id: 'logist', v: 1, txt: 'Abra a TransCifra Logística' },
      { t: 'biz', id: 'espaco', v: 1, txt: 'Abra a Órbita Cifrão Espacial' }
    ],
    mid: [
      { t: 'earned', v: 1e3, txt: 'Fature $1 K no total' },
      { t: 'owned', v: 2, txt: 'Tenha 2 negócios' },
      { t: 'ips', v: 50, txt: 'Renda passiva de $50/s' },
      { t: 'owned', v: 3, txt: 'Tenha 3 negócios' },
      { t: 'mgrs', v: 2, txt: 'Tenha 2 gerentes' },
      { t: 'ips', v: 500, txt: 'Renda passiva de $500/s' },
      { t: 'owned', v: 4, txt: 'Tenha 4 negócios' },
      { t: 'mgrs', v: 3, txt: 'Tenha 3 gerentes' },
      { t: 'ips', v: 5000, txt: 'Renda passiva de $5 K/s' },
      { t: 'owned', v: 5, txt: 'Tenha 5 negócios' },
      { t: 'mgrs', v: 5, txt: 'Tenha 5 gerentes' },
      { t: 'ips', v: 5e4, txt: 'Renda passiva de $50 K/s' },
      { t: 'owned', v: 7, txt: 'Tenha 7 negócios' },
      { t: 'ips', v: 5e5, txt: 'Renda passiva de $500 K/s' },
      { t: 'owned', v: 8, txt: 'Tenha os 8 negócios' },
      { t: 'mgrs', v: 8, txt: 'Tenha os 8 gerentes' },
      { t: 'ips', v: 1e7, txt: 'Renda passiva de $10 M/s' },
      { t: 'owned', v: 10, txt: 'Tenha 10 negócios' },
      { t: 'ips', v: 1e9, txt: 'Renda passiva de $1 B/s' },
      { t: 'owned', v: 12, txt: 'Tenha os 12 negócios' },
      { t: 'mgrs', v: 12, txt: 'Tenha os 12 gerentes' }
    ],
    long: [
      { t: 'nw', v: 1e4, txt: 'Patrimônio de $10 K' },
      { t: 'nw', v: 1e6, txt: 'Torne-se milionário ($1 M)' },
      { t: 'luxn', v: 3, txt: 'Tenha 3 itens de luxo' },
      { t: 'nw', v: 1e8, txt: 'Patrimônio de $100 M' },
      { t: 'prestige', v: 1, txt: 'Faça seu 1º Legado (prestígio)' },
      { t: 'nw', v: 1e9, txt: 'Torne-se bilionário ($1 B)' },
      { t: 'coll', v: 1, txt: 'Complete uma coleção de luxo' },
      { t: 'nw', v: 1e11, txt: 'Patrimônio de $100 B' },
      { t: 'nw', v: 1e12, txt: 'Torne-se trilionário ($1 T)' },
      { t: 'empire', v: 25, txt: 'Alcance o nível 25 do império' },
      { t: 'nw', v: 1e15, txt: 'Patrimônio de $1 Qa' },
      { t: 'stars', v: 100, txt: 'Tenha 100 estrelas de Legado' }
    ]
  };

  // Rivais simulados (marcados com 🤖 na interface: não são jogadores reais)
  D.TOUR_BOTS = ['TubarãoDoPregão 🤖', 'Ana_Touro 🤖', 'Zé Dividendos 🤖', 'MiaCripto 🤖', 'Lobo de Cifrópolis 🤖',
                 'Kátia Tendência 🤖', 'Beto Ações 🤖', 'DonaLiquidez 🤖', 'Rico Vapor 🤖'];

  D.OFFLINE_BASE_H = 4;
  D.STAR_DIVISOR = 1e8;   // estrelas = floor(sqrt(faturamento_total / 1e8))
  D.STAR_BONUS = 0.1;     // +10% renda por estrela
  D.AD_BOOST_MIN = 30;    // anúncio voluntário: x2 por 30 min
  D.AD_BOOST_MAX_H = 4;
  D.QUICK_CASH_MIN = 10;  // anúncio voluntário: 10 min de renda instantânea
  D.QUICK_CASH_CD = 15 * 60;
  D.FREE_BOOST_CD_MIN = 30; // sem anúncios: recarga do Turbo gratuito após terminar


  // Conquistas: permanentes (sobrevivem ao Legado). Cada uma dá +1% de receita dos negócios.
  // t = tipo de verificação (ver G.achProgress), v = alvo.
  D.ACH_BONUS = 0.01;
  D.ACHIEVEMENTS = [
    { id: 'tap100',    icon: '👆', name: 'Dedo Ligeiro',        t: 'taps',     v: 100,   txt: 'Toque 100 vezes' },
    { id: 'tap5k',     icon: '🖐️', name: 'Mão de Ouro',         t: 'taps',     v: 5000,  txt: 'Toque 5.000 vezes' },
    { id: 'tap50k',    icon: '🦾', name: 'Incansável',          t: 'taps',     v: 50000, txt: 'Toque 50.000 vezes' },
    { id: 'job_all',   icon: '👑', name: 'Topo da Carreira',    t: 'jobs',     v: 7,     txt: 'Chegue a CEO Visionário' },
    { id: 'biz3',      icon: '🏪', name: 'Empreendedor',        t: 'owned',    v: 3,     txt: 'Tenha 3 negócios' },
    { id: 'biz_all',   icon: '🏙️', name: 'Dono da Cidade',      t: 'owned',    v: 8,     txt: 'Tenha os 8 negócios' },
    { id: 'mgr1',      icon: '👔', name: 'Primeiro Gerente',    t: 'mgrs',     v: 1,     txt: 'Contrate um gerente' },
    { id: 'mgr_all',   icon: '🗂️', name: 'Diretoria Completa',  t: 'mgrs',     v: 8,     txt: 'Contrate os 8 gerentes' },
    { id: 'lvl100',    icon: '💯', name: 'Centenário',          t: 'maxlvl',   v: 100,   txt: 'Leve um negócio ao nível 100' },
    { id: 'lvl250',    icon: '🚀', name: 'Expansão Total',      t: 'maxlvl',   v: 250,   txt: 'Leve um negócio ao nível 250' },
    { id: 'emp_full',  icon: '👥', name: 'Equipe dos Sonhos',   t: 'empfull',  v: 1,     txt: 'Complete a equipe (10) de um negócio' },
    { id: 'earn1m',    icon: '💵', name: 'Primeiro Milhão',     t: 'earned',   v: 1e6,   txt: 'Fature $1 M no total' },
    { id: 'earn1b',    icon: '💰', name: 'Bilionário',          t: 'earned',   v: 1e9,   txt: 'Fature $1 B no total' },
    { id: 'earn1t',    icon: '🏦', name: 'Trilionário',         t: 'earned',   v: 1e12,  txt: 'Fature $1 T no total' },
    { id: 'earn1qa',   icon: '🌌', name: 'Além dos Trilhões',   t: 'earned',   v: 1e15,  txt: 'Fature $1 Qa no total' },
    { id: 'ips1k',     icon: '📈', name: 'Renda Própria',       t: 'ips',      v: 1e3,   txt: 'Renda passiva de $1 K/s' },
    { id: 'ips1m',     icon: '📊', name: 'Máquina de Dinheiro', t: 'ips',      v: 1e6,   txt: 'Renda passiva de $1 M/s' },
    { id: 'ips1b',     icon: '⚙️', name: 'Império Automático',  t: 'ips',      v: 1e9,   txt: 'Renda passiva de $1 B/s' },
    { id: 'trade10',   icon: '🔁', name: 'Operador',            t: 'trades',   v: 10,    txt: 'Faça 10 operações na bolsa' },
    { id: 'profit1m',  icon: '🐂', name: 'Touro da Bolsa',      t: 'tprofit',  v: 1e6,   txt: 'Lucre $1 M no total na bolsa' },
    { id: 'prop10',    icon: '🏘️', name: 'Senhorio',            t: 'propn',    v: 10,    txt: 'Tenha 10 imóveis' },
    { id: 'shopping',  icon: '🛒', name: 'Rei do Varejo',       t: 'prop',     id2: 'shopping', v: 1, txt: 'Compre o Shopping Cifrão' },
    { id: 'lux1',      icon: '⌚', name: 'Gosto Refinado',      t: 'luxn',     v: 1,     txt: 'Compre um item de luxo' },
    { id: 'coll1',     icon: '🏆', name: 'Colecionador',        t: 'coll',     v: 1,     txt: 'Complete uma coleção de luxo' },
    { id: 'lux_all',   icon: '💎', name: 'Acervo Completo',     t: 'luxn',     v: 13,    txt: 'Tenha 13 itens de luxo' },
    { id: 'fix5',      icon: '🧯', name: 'Apaga-Incêndio',      t: 'fixed',    v: 5,     txt: 'Resolva 5 crises ou concorrentes' },
    { id: 'daily7',    icon: '📅', name: 'Disciplina',          t: 'daily',    v: 7,     txt: 'Complete as missões diárias em 7 dias' },
    { id: 'tourwin',   icon: '🥇', name: 'Campeão do Pregão',   t: 'tourwin',  v: 1,     txt: 'Vença um torneio semanal' },
    { id: 'legacy1',   icon: '🌅', name: 'Herdeiro',            t: 'prestige', v: 1,     txt: 'Funde seu primeiro Legado' },
    { id: 'legacy5',   icon: '🏛️', name: 'Dinastia',            t: 'prestige', v: 5,     txt: 'Funde 5 Legados' },
    { id: 'stars100',  icon: '🌟', name: 'Constelação',         t: 'stars',    v: 100,   txt: 'Tenha 100 estrelas de Legado' },
    // v2.0
    { id: 'upg1',      icon: '📣', name: 'Primeira Melhoria',   t: 'upg',      v: 1,     txt: 'Compre uma melhoria de empresa' },
    { id: 'upg12',     icon: '🧰', name: 'Gestor Moderno',      t: 'upg',      v: 12,    txt: 'Tenha 12 melhorias de empresa' },
    { id: 'upg_all',   icon: '🏗️', name: 'Conglomerado',        t: 'upg',      v: 36,    txt: 'Compre as 36 melhorias' },
    { id: 'eff3',      icon: '⚙️', name: 'Máquina Azeitada',    t: 'effmax',   v: 3,     txt: 'Leve uma empresa à eficiência 3' },
    { id: 'eff5',      icon: '🏭', name: 'Excelência Total',    t: 'effmax',   v: 5,     txt: 'Leve uma empresa à eficiência máxima' },
    { id: 'biz12',     icon: '🌐', name: 'Império Global',      t: 'owned',    v: 12,    txt: 'Tenha os 12 negócios' },
    { id: 'space',     icon: '🛰️', name: 'Para o Espaço',       t: 'biz',      id2: 'espaco', v: 1, txt: 'Abra a Órbita Cifrão Espacial' },
    { id: 'div1m',     icon: '💹', name: 'Rentista',            t: 'divs',     v: 1e6,   txt: 'Receba $1 M em dividendos' },
    { id: 'div1t',     icon: '🏛️', name: 'Barão dos Dividendos', t: 'divs',    v: 1e12,  txt: 'Receba $1 T em dividendos' },
    { id: 'reno10',    icon: '🔨', name: 'Mestre de Obras',     t: 'renon',    v: 10,    txt: 'Faça 10 reformas em imóveis' },
    { id: 'prop50',    icon: '🏘️', name: 'Latifundiário',       t: 'propn',    v: 50,    txt: 'Tenha 50 imóveis' },
    { id: 'lux20',     icon: '👑', name: 'Coleção Lendária',    t: 'luxn',     v: 20,    txt: 'Tenha todos os 20 itens de luxo' },
    { id: 'emp10',     icon: '🏛️', name: 'Cidade em Ascensão',  t: 'empire',   v: 10,    txt: 'Alcance o nível 10 do império' },
    { id: 'emp25',     icon: '🗼', name: 'Metrópole',           t: 'empire',   v: 25,    txt: 'Alcance o nível 25 do império' },
    { id: 'emp40',     icon: '🌆', name: 'Megalópole',          t: 'empire',   v: 40,    txt: 'Alcance o nível 40 do império' },
    { id: 'weekly3',   icon: '📆', name: 'Semana Perfeita',     t: 'weekly',   v: 1,     txt: 'Conclua os 3 desafios de uma semana' },
    { id: 'racewin',   icon: '🏁', name: 'Campeão da Corrida',  t: 'racewin',  v: 1,     txt: 'Vença a Corrida Empresarial' },
    { id: 'merit100',  icon: '🎖️', name: 'Condecorado',         t: 'meritall', v: 100,   txt: 'Ganhe 100 Medalhas de Mérito' },
    { id: 'baron',     icon: '🎩', name: 'Título de Barão',     t: 'stars',    v: 100,   txt: 'Alcance a patente Barão (100 ⭐)' },
    { id: 'duke',      icon: '🦚', name: 'Título de Duque',     t: 'stars',    v: 1e4,   txt: 'Alcance a patente Duque (10.000 ⭐)' }
  ];

  // Missões diárias: 3 sorteadas por dia entre as disponíveis (req). Progresso = estatística atual − valor no início.
  // target(s, ctx): alvo escalado ao momento do jogador; rewardMin: minutos de renda pagos ao concluir.
  D.DAILY = [
    { id: 'taps',   icon: '👆', txt: 'Toque {n} vezes',                 stat: 'taps',        rewardMin: 5 },
    { id: 'levels', icon: '🏪', txt: 'Compre {n} níveis de negócios',   stat: 'bizLevels',   rewardMin: 8 },
    { id: 'runs',   icon: '⚙️', txt: 'Complete {n} ciclos de produção', stat: 'bizRuns',     rewardMin: 6 },
    { id: 'earn',   icon: '💵', txt: 'Fature {m}',                      stat: 'earned',      rewardMin: 8 },
    { id: 'skills', icon: '🧠', txt: 'Melhore {n} habilidades',          stat: 'skillsBought', rewardMin: 8, req: 'skills' },
    { id: 'trades', icon: '📈', txt: 'Faça {n} operações na bolsa',     stat: 'trades',      rewardMin: 6, req: 'inv' },
    { id: 'props',  icon: '🏠', txt: 'Compre {n} imóveis',              stat: 'propsBought', rewardMin: 10, req: 'props' },
    { id: 'fix',    icon: '🧯', txt: 'Resolva {n} crise ou concorrente', stat: 'eventsFixed', rewardMin: 10, req: 'biz2' },
    // v2.0
    { id: 'manual', icon: '✋', txt: 'Produza {n} ciclos tocando nas empresas', stat: 'manualRuns', rewardMin: 6 },
    { id: 'emps',   icon: '👥', txt: 'Contrate {n} funcionários',        stat: 'empHired',    rewardMin: 8, req: 'biz2' },
    { id: 'upgs',   icon: '📣', txt: 'Compre {n} melhoria de empresa',    stat: 'upgBought',   rewardMin: 12, req: 'upg' },
    { id: 'renos',  icon: '🔨', txt: 'Reforme {n} imóvel',               stat: 'renoDone',    rewardMin: 10, req: 'props' },
    { id: 'divs',   icon: '💹', txt: 'Receba {m} em dividendos',         stat: 'divEarned',   rewardMin: 8, req: 'inv' },
    { id: 'goals',  icon: '🎯', txt: 'Conclua {n} metas do topo',        stat: 'goalsDone',   rewardMin: 8 }
  ];
  D.DAILY_BY_ID = {}; D.DAILY.forEach(function (d) { D.DAILY_BY_ID[d.id] = d; });
  D.DAILY_BONUS_MIN = 15; // baú por concluir as 3 do dia

  // Desbloqueio progressivo das abas (por faturamento total, que nunca diminui).
  D.UNLOCKS = { inv: 3000, lux: 15000 };

  // ===================== v2.0: meta-progressão =====================

  // Desafios semanais: 3 por semana (segunda a domingo), mais longos que as missões diárias.
  // Pagam dinheiro e Medalhas de Mérito. Progresso = estatística atual − valor no início da semana.
  D.WEEKLY = [
    { id: 'w_earn',   icon: '💰', txt: 'Fature {m} na semana',              stat: 'prodEarned',  medals: 12, rewardMin: 30 },
    { id: 'w_levels', icon: '🏪', txt: 'Compre {n} níveis de negócios',     stat: 'bizLevels',   medals: 10, rewardMin: 25 },
    { id: 'w_daily',  icon: '📅', txt: 'Abra o baú diário {n} vezes',       stat: 'dailyDone',   medals: 15, rewardMin: 30 },
    { id: 'w_fix',    icon: '🧯', txt: 'Resolva {n} crises ou concorrentes', stat: 'eventsFixed', medals: 10, rewardMin: 25, req: 'biz2' },
    { id: 'w_trade',  icon: '📈', txt: 'Faça {n} operações na bolsa',       stat: 'trades',      medals: 10, rewardMin: 20, req: 'inv' },
    { id: 'w_goals',  icon: '🎯', txt: 'Conclua {n} metas do topo',         stat: 'goalsDone',   medals: 12, rewardMin: 25 },
    { id: 'w_manual', icon: '✋', txt: 'Produza {n} ciclos manuais',        stat: 'manualRuns',  medals: 10, rewardMin: 20 }
  ];
  D.WEEKLY_BY_ID = {}; D.WEEKLY.forEach(function (d) { D.WEEKLY_BY_ID[d.id] = d; });
  D.WEEKLY_BONUS_MEDALS = 20;

  // Eventos de setor: a cada 2 dias dois setores ficam em alta (+25% de receita), em rodízio fixo.
  D.SECTOR_EVENT_DAYS = 2;
  D.SECTOR_EVENTS = [
    { id: 'consumo', name: 'Semana do Consumidor', icon: '🛍️', cats: ['Varejo', 'Restaurantes'], mult: 1.25 },
    { id: 'tech',    name: 'Boom Tecnológico',     icon: '💻', cats: ['Tecnologia', 'Mídia'],     mult: 1.25 },
    { id: 'verao',   name: 'Verão Solar',          icon: '☀️', cats: ['Energia', 'Esportes'],     mult: 1.25 },
    { id: 'saber',   name: 'Feira do Conhecimento', icon: '🎓', cats: ['Educação', 'Saúde'],      mult: 1.25 },
    { id: 'turismo', name: 'Alta Temporada',       icon: '🏨', cats: ['Turismo', 'Bancos'],       mult: 1.25 },
    { id: 'espaco',  name: 'Corrida Espacial',     icon: '🛰️', cats: ['Aeroespacial', 'Logística'], mult: 1.25 }
  ];

  // Medalhas de Mérito: ganhas jogando (desafios, torneios, nível do império, conquistas, Legado).
  // Não são vendidas. Gastas na Loja de Mérito em melhorias permanentes (mantidas no Legado).
  D.MERIT_SHOP = [
    { id: 'mtap',   name: 'Luvas de Ouro',      icon: '🧤', desc: '+25% no valor do toque',             cost: 25, growth: 1.6, max: 5 },
    { id: 'moff',   name: 'Cofre Noturno',      icon: '🌙', desc: '+2h no limite de ganhos offline',     cost: 20, growth: 1.8, max: 3 },
    { id: 'mquick', name: 'Contador Ágil',      icon: '🧮', desc: 'Lucro rápido recarrega 3 min antes',  cost: 15, growth: 1.7, max: 3 },
    { id: 'mmgr',   name: 'Headhunter',         icon: '🕵️', desc: 'Gerentes 15% mais baratos',          cost: 25, growth: 2,   max: 2 },
    { id: 'minc',   name: 'Consultoria de Elite', icon: '📊', desc: '+5% de receita dos negócios',      cost: 30, growth: 1.5, max: 10 },
    { id: 'mstart', name: 'Fundo Fiduciário',   icon: '💼', desc: 'Cada Legado começa com mais dinheiro', cost: 20, growth: 2, max: 4 }
  ];
  D.MERIT_START_CASH = [0, 1e4, 1e6, 1e8, 1e10]; // por nível do Fundo Fiduciário

  // Nível do império: sobe a cada meia ordem de grandeza de faturamento total (nunca diminui).
  D.EMPIRE_STEP = 0.5;  // nível = floor(log10(faturamento total) / 0.5)
  D.EMPIRE_MEDALS = 2;  // medalhas por nível; +5 a cada 5 níveis

  // Patentes de Legado (pelas estrelas acumuladas): vantagens permanentes ao recomeçar.
  D.LEGACY_RANKS = [
    { stars: 0,     name: 'Fundador',          icon: '🌱', perk: 'Comece sua dinastia.' },
    { stars: 10,    name: 'Herdeiro',          icon: '🎓', perk: 'Recomeça com o emprego Panfleteiro e $1 K.' },
    { stars: 100,   name: 'Barão',             icon: '🎩', perk: 'Recomeça com o Suco da Esquina nível 25 e gerente.' },
    { stars: 1000,  name: 'Conde',             icon: '🦉', perk: '+2h no limite de ganhos offline.' },
    { stars: 1e4,   name: 'Duque',             icon: '🦚', perk: 'Gerentes 25% mais baratos.' },
    { stars: 1e5,   name: 'Magnata Imperial',  icon: '👑', perk: 'Recomeça com os 4 primeiros negócios no nível 25 e gerentes.' },
    { stars: 1e6,   name: 'Lenda Eterna',      icon: '🌟', perk: '+25% de receita dos negócios.' }
  ];

  // Corrida Empresarial (torneio semanal 2): pontuação = faturamento produtivo na semana. Rivais simulados.
  D.RACE_BOTS = ['Grupo Atlas 🤖', 'Holding Nébula 🤖', 'Cia. Ventania 🤖', 'Rede Prisma 🤖', 'Fundo Coral 🤖',
                 'Indústrias Delta 🤖', 'Casa Mercúrio 🤖', 'Grupo Horizonte 🤖', 'Aliança Sol 🤖'];

  if (typeof module !== 'undefined' && module.exports) module.exports = D;
  else root.D = D;
})(this);
