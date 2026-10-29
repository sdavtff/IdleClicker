/* Conteúdo do jogo: negócios, carreira, habilidades, ativos, imóveis, luxo e metas.
 * Todo o mundo de Cifrópolis é original. Ajuste valores aqui para balancear. */
(function (root) {
  'use strict';
  var D = {};

  D.GAME_NAME = 'Cifrópolis';
  D.VERSION = '1.1.0';
  D.SAVE_KEY = 'cifropolis_save_v1';
  D.SAVE_VERSION = 2;
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
    { id: 'banco',  name: 'Banco Cofre Dourado', cat: 'Bancos',       icon: '🏦', color: '#00bbf9', cost: 5e8,   r: 1.12, rev: 6e6,   t: 240, mgr: 2e9,   mgrName: 'Sr. Valença' }
  ];

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
    { id: 'NXS', name: 'NexaSoft',        icon: '🧬', p: 120, vol: 0.008, drift: 0.00004 },
    { id: 'VRD', name: 'Verdana Agro',    icon: '🌾', p: 45,  vol: 0.005, drift: 0.00003 },
    { id: 'ORB', name: 'Órbita Aero',     icon: '🚀', p: 310, vol: 0.011, drift: 0.00005 },
    { id: 'MAR', name: 'Maré Logística',  icon: '🚢', p: 28,  vol: 0.006, drift: 0.00002 },
    { id: 'LUM', name: 'Lúmen Saúde',     icon: '💊', p: 88,  vol: 0.007, drift: 0.00004 }
  ];
  D.CRYPTOS = [
    { id: 'BYTE', name: 'ByteCoin',  icon: '🪙', p: 2400, vol: 0.025, drift: 0.0001 },
    { id: 'GATO', name: 'GatoMoeda', icon: '🐱', p: 0.8,  vol: 0.045, drift: 0.0001 },
    { id: 'NEB',  name: 'Nébula',    icon: '🌌', p: 140,  vol: 0.032, drift: 0.0001 }
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
    { id: 'shopping',  name: 'Shopping Cifrão',      icon: '🛒', cost: 2e9,   rent: 1.6e6, g: 1.14 }
  ];
  D.PROP_UPKEEP = 0.1;

  // Luxo & coleção. bonus: inc (negócios), tap, rent, speed, offline (horas)
  D.LUX_CATS = [
    { id: 'watch', name: 'Relógios', icon: '⌚' },
    { id: 'car',   name: 'Carros',   icon: '🏎️' },
    { id: 'yacht', name: 'Iates',    icon: '🛥️' },
    { id: 'jet',   name: 'Jatos',    icon: '🛩️' },
    { id: 'art',   name: 'Arte',     icon: '🖼️' }
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
    { id: 'a3', cat: 'art',   name: 'Mosaico Neon',             icon: '🎨',  cost: 1e10,  status: 250, bonus: { inc: 0.15 } }
  ];
  D.COLLECTION_BONUS = 0.05; // +5% renda global por categoria completa

  D.STATUS_TITLES = [
    [0, 'Anônimo'], [10, 'Emergente'], [50, 'Influente'], [150, 'Figurão'],
    [400, 'Magnata'], [800, 'Lenda de Cifrópolis']
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
      { t: 'biz', id: 'banco', v: 1, txt: 'Abra o Banco Cofre Dourado' }
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
      { t: 'ips', v: 1e7, txt: 'Renda passiva de $10 M/s' }
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
      { t: 'nw', v: 1e12, txt: 'Torne-se trilionário ($1 T)' }
    ]
  };

  D.TOUR_BOTS = ['TubarãoDoPregão', 'Ana_Touro', 'Zé Dividendos', 'MiaCripto', 'Lobo de Cifrópolis',
                 'Kátia Tendência', 'Beto Ações', 'DonaLiquidez', 'Rico Vapor'];

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
    { id: 'lux_all',   icon: '💎', name: 'Acervo Completo',     t: 'luxn',     v: 13,    txt: 'Tenha todos os 13 itens de luxo' },
    { id: 'fix5',      icon: '🧯', name: 'Apaga-Incêndio',      t: 'fixed',    v: 5,     txt: 'Resolva 5 crises ou concorrentes' },
    { id: 'daily7',    icon: '📅', name: 'Disciplina',          t: 'daily',    v: 7,     txt: 'Complete as missões diárias em 7 dias' },
    { id: 'tourwin',   icon: '🥇', name: 'Campeão do Pregão',   t: 'tourwin',  v: 1,     txt: 'Vença um torneio semanal' },
    { id: 'legacy1',   icon: '🌅', name: 'Herdeiro',            t: 'prestige', v: 1,     txt: 'Funde seu primeiro Legado' },
    { id: 'legacy5',   icon: '🏛️', name: 'Dinastia',            t: 'prestige', v: 5,     txt: 'Funde 5 Legados' },
    { id: 'stars100',  icon: '🌟', name: 'Constelação',         t: 'stars',    v: 100,   txt: 'Tenha 100 estrelas de Legado' }
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
    { id: 'fix',    icon: '🧯', txt: 'Resolva {n} crise ou concorrente', stat: 'eventsFixed', rewardMin: 10, req: 'biz2' }
  ];
  D.DAILY_BY_ID = {}; D.DAILY.forEach(function (d) { D.DAILY_BY_ID[d.id] = d; });
  D.DAILY_BONUS_MIN = 15; // baú por concluir as 3 do dia

  // Desbloqueio progressivo das abas (por faturamento total, que nunca diminui).
  D.UNLOCKS = { inv: 3000, lux: 15000 };

  if (typeof module !== 'undefined' && module.exports) module.exports = D;
  else root.D = D;
})(this);
