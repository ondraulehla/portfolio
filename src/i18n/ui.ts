import type { Locale } from './config';

const en = {
  'site.title': 'OU – Fullstack Developer & AI Engineer',
  'site.description':
    'Fullstack developer and AI engineer building fast, well-crafted products – from client analysis to production deployment.',
  'nav.about': 'About',
  'nav.experience': 'Experience',
  'nav.projects': 'Projects',
  'nav.contact': 'Contact',
  'nav.playground': 'Playground',
  'nav.lab': 'Neural Lab',
  'nav.menu': 'Menu',
  'theme.toggle': 'Toggle color theme',
  'theme.palette': 'Choose accent palette',
  'palette.original': 'Original',
  'lang.switch': 'Přepnout do češtiny',
  'lang.switchShort': 'CS',
  'skip.content': 'Skip to content',

  'hero.available': 'Open to new opportunities',
  'hero.title.line1': 'Fullstack developer',
  'hero.title.line2': '& AI engineer',
  'hero.subtitle':
    'I build and ship complete products – working directly with clients from analysis and architecture through robust backends and AI integrations to polished frontend design.',
  'hero.cta.projects': 'View projects',
  'hero.cta.cv': 'Download CV',
  'hero.cta.playground': 'Explore in 3D',

  'about.heading': 'About',

  'experience.heading': 'Experience',
  'experience.present': 'Present',

  'education.heading': 'Education',

  'skills.heading': 'Skills',

  'projects.heading': 'Selected projects',
  'projects.viewCase': 'Read case study',
  'projects.all': 'All projects',
  'project.problem': 'Problem',
  'project.solution': 'Solution',
  'project.outcome': 'Outcome',
  'project.role': 'Role',
  'project.year': 'Year',
  'project.stack': 'Stack',
  'project.repo': 'Source code',
  'project.live': 'Live',
  'project.back': 'Back to projects',
  'project.next': 'Next project',

  'contact.heading': "Let's talk",
  'contact.kicker': 'Contact',
  'contact.text': 'Interested in working together, or just want to say hi?',
  'contact.copy': 'Copy email',
  'contact.copy.short': 'Copy',
  'contact.copied': 'Copied!',
  'contact.cv': 'Download CV (PDF)',
  'contact.cv.short': 'CV (PDF)',

  'playground.title': '3D Playground',
  'playground.description':
    'A small interactive 3D world. Take off, fly over the island and discover my projects – built with Three.js.',
  'playground.enter': 'Take off',
  'playground.loading': 'Loading world…',
  'playground.controls': 'Controls',
  'playground.controls.turn': 'turn',
  'playground.controls.pitch': 'climb & dive',
  'playground.controls.boost': 'boost',
  'playground.controls.alt': 'WASD works too',
  'playground.resume': 'Resume flight',
  'playground.visited': 'projects',
  'playground.sound': 'Sound',
  'playground.on': 'on',
  'playground.off': 'off',
  'playground.enterProject': 'to open project',
  'playground.pressEnter': 'Press Enter',
  'playground.fallback.motion':
    'You have reduced motion enabled, so the 3D experience is off by default.',
  'playground.fallback.webgl': "Your browser doesn't support WebGL, so the 3D world can't run here.",
  'playground.fallback.anyway': 'Load it anyway',
  'playground.back': 'Back to site',
  'playground.hint.gas': 'accelerate',
  'playground.hint.steer': 'steer',

  'nn.title': 'Neural Network Lab',
  'nn.intro':
    'The interactive neural network from my master’s thesis “Modeling Neural Networks in Virtual Reality”. Build your own network: pick the input features, add layers and neurons, click an edge to change a single weight – and watch the decision surface learn your dataset by backpropagation, live in the browser, while the 3D model lights up below.',
  'nn.panel.config': 'Configuration',
  'nn.panel.surface': 'Decision surface',
  'nn.panel.network': 'Network',
  'nn.panel.model': '3D model',
  'nn.dataset': 'Dataset',
  'nn.classes': 'Classes',
  'nn.classesTip': 'How many classes the dataset generates – the output layer follows along',
  'nn.activation': 'Activation',
  'nn.layers': 'Layers',
  'nn.input': 'Input',
  'nn.output': 'Output',
  'nn.addLayer': '+ Layer',
  'nn.removeLayer': 'Remove layer',
  'nn.lr': 'Learning rate',
  'nn.epoch': 'Epoch',
  'nn.loss': 'Loss',
  'nn.acc': 'Accuracy',
  'nn.pause': '⏸ Pause',
  'nn.resume': '▶ Resume',
  'nn.reset': 'Reset',
  'nn.turbo': '×5',
  'nn.turboTip': 'Fast-forward: five times the training steps per frame',
  'nn.challenges': 'Challenges',
  'nn.ch.spiral': 'Learn the spiral',
  'nn.ch.spiralTip': 'All six input features and two hidden layers – watch the surface wind up',
  'nn.ch.xor': 'XOR without depth',
  'nn.ch.xorTip': 'The x·y feature makes XOR linearly separable – one tiny hidden layer is enough',
  'nn.ch.classes': 'Three rings',
  'nn.ch.classesTip':
    'Concentric classes under a softmax – the quadratic features are what makes them separable',
  'nn.surface':
    'Decision surface – every point gets the colour of the class the network predicts there; hover to probe the network, click to pin the point (rings mark the neurons it fires)',
  'nn.class': 'Class',
  'nn.edges': 'Edges',
  'nn.edges.weights': 'Weights',
  'nn.edges.flow': 'Signal flow',
  'nn.edges.weightsTip': 'Edge colour and thickness show the sign and size of each weight',
  'nn.edges.flowTip':
    'Edge colour and thickness show each connection’s real contribution for the probed point: weight × source activation',
  'nn.schematic':
    'Network – neuron colour = its activation for the probed point (blue low, orange high); click an edge to edit its weight, a neuron to edit its bias',
  'nn.model': '3D network – same activation colours, neurons on rings glow and grow, drag to orbit',
  'nn.webgl': 'Your browser doesn’t support WebGL, so the 3D model can’t render – the decision surface still works.',
  'nn.links.thesis': 'Download the thesis (PDF, 1.4 MB)',
  'nn.links.case': 'Read the case study',
  'nn.links.code': 'Original code on GitHub',
  'nn.about.title': 'How it works',
  'nn.about.p1':
    'The network is a small multilayer perceptron running entirely in your browser – plain TypeScript, no ML library. Every animation frame it takes a few gradient-descent steps on the visible dataset, and the decision surface repaints each point of the plane with the colour of the class the network currently predicts there.',
  'nn.about.p2':
    'The whole architecture is yours to break. Choose which engineered features of the point (x, y) feed the input layer, add hidden layers and neurons, and switch the output between a single sigmoid unit and a 2–4-class softmax – the datasets regenerate with matching classes. Click any edge in the schematic to set that weight by hand and watch the surface deform; resume training and backpropagation repairs your intervention.',
  'nn.about.p3':
    'In the original thesis this ran as two cooperating systems: a web app encoded the architecture, weights and training parameters, and a virtual-reality world in Resonite decoded them into a walk-through 3D model of the network – a “3D brain” driving objects in the scene. The 3D view above is a nod to that world: each layer’s neurons sit on a ring, glow and grow with their activations, while edges carry the sign and strength of their weights.',

  'footer.rights': 'All rights reserved.',
  'footer.built':
    'Designed & built by Ondřej Úlehla with Astro, Tailwind, GSAP and Three.js.',

  'notfound.title': 'Page not found',
  'notfound.text': "The page you're looking for doesn't exist or has moved.",
  'notfound.home': 'Back home',

  'cv.print.title': 'Curriculum Vitae',
} as const;

const cs = {
  'site.title': 'OU – Fullstack vývojář & AI inženýr',
  'site.description':
    'Fullstack vývojář a AI inženýr. Stavím rychlé a promyšlené produkty – od analýzy s klientem po nasazení do produkce.',
  'nav.about': 'O mně',
  'nav.experience': 'Zkušenosti',
  'nav.projects': 'Projekty',
  'nav.contact': 'Kontakt',
  'nav.playground': 'Playground',
  'nav.lab': 'Neural Lab',
  'nav.menu': 'Menu',
  'theme.toggle': 'Přepnout barevný režim',
  'theme.palette': 'Vybrat barevnou paletu',
  'palette.original': 'Původní',
  'lang.switch': 'Switch to English',
  'lang.switchShort': 'EN',
  'skip.content': 'Přeskočit na obsah',

  'hero.available': 'Otevřený novým příležitostem',
  'hero.title.line1': 'Fullstack vývojář',
  'hero.title.line2': '& AI inženýr',
  'hero.subtitle':
    'Stavím a dodávám kompletní produkty – s klienty od analýzy a architektury přes robustní backend a AI integrace až po vyladěný design frontendu.',
  'hero.cta.projects': 'Prohlédnout projekty',
  'hero.cta.cv': 'Stáhnout CV',
  'hero.cta.playground': 'Prozkoumat ve 3D',

  'about.heading': 'O mně',

  'experience.heading': 'Zkušenosti',
  'experience.present': 'Současnost',

  'education.heading': 'Vzdělání',

  'skills.heading': 'Dovednosti',

  'projects.heading': 'Vybrané projekty',
  'projects.viewCase': 'Přečíst případovou studii',
  'projects.all': 'Všechny projekty',
  'project.problem': 'Problém',
  'project.solution': 'Řešení',
  'project.outcome': 'Výsledek',
  'project.role': 'Role',
  'project.year': 'Rok',
  'project.stack': 'Stack',
  'project.repo': 'Zdrojový kód',
  'project.live': 'Živě',
  'project.back': 'Zpět na projekty',
  'project.next': 'Další projekt',

  'contact.heading': 'Pojďme si napsat',
  'contact.kicker': 'Kontakt',
  'contact.text': 'Zajímá vás spolupráce, nebo se chcete jen pozdravit?',
  'contact.copy': 'Kopírovat e-mail',
  'contact.copy.short': 'Kopírovat',
  'contact.copied': 'Zkopírováno!',
  'contact.cv': 'Stáhnout CV (PDF)',
  'contact.cv.short': 'CV (PDF)',

  'playground.title': '3D Playground',
  'playground.description':
    'Malý interaktivní 3D svět. Vzlétněte, prolétněte se nad ostrovem a objevte mé projekty – postaveno na Three.js.',
  'playground.enter': 'Vzlétnout',
  'playground.loading': 'Načítám svět…',
  'playground.controls': 'Ovládání',
  'playground.controls.turn': 'zatáčení',
  'playground.controls.pitch': 'stoupání a klesání',
  'playground.controls.boost': 'boost',
  'playground.controls.alt': 'funguje i WASD',
  'playground.resume': 'Pokračovat v letu',
  'playground.visited': 'projektů',
  'playground.sound': 'Zvuk',
  'playground.on': 'zap',
  'playground.off': 'vyp',
  'playground.enterProject': 'pro otevření projektu',
  'playground.pressEnter': 'Stiskněte Enter',
  'playground.fallback.motion':
    'Máte zapnuté omezení animací, 3D zážitek je proto ve výchozím stavu vypnutý.',
  'playground.fallback.webgl': 'Váš prohlížeč nepodporuje WebGL, 3D svět zde nelze spustit.',
  'playground.fallback.anyway': 'Přesto načíst',
  'playground.back': 'Zpět na web',
  'playground.hint.gas': 'plyn',
  'playground.hint.steer': 'zatáčení',

  'nn.title': 'Laboratoř neuronových sítí',
  'nn.intro':
    'Interaktivní neuronová síť z mé diplomové práce „Modelování neuronových sítí ve virtuální realitě". Postavte si vlastní síť: zvolte vstupní příznaky, přidejte vrstvy a neurony, kliknutím na hranu změňte jednotlivou váhu – a sledujte, jak se rozhodovací plocha učí váš dataset backpropagací, naživo v prohlížeči. 3D model dole se u toho rozsvěcuje.',
  'nn.panel.config': 'Konfigurace',
  'nn.panel.surface': 'Rozhodovací plocha',
  'nn.panel.network': 'Síť',
  'nn.panel.model': '3D model',
  'nn.dataset': 'Dataset',
  'nn.classes': 'Třídy',
  'nn.classesTip': 'Kolik tříd dataset generuje – výstupní vrstva se přizpůsobí',
  'nn.activation': 'Aktivace',
  'nn.layers': 'Vrstvy',
  'nn.input': 'Vstup',
  'nn.output': 'Výstup',
  'nn.addLayer': '+ Vrstva',
  'nn.removeLayer': 'Odebrat vrstvu',
  'nn.lr': 'Rychlost učení',
  'nn.epoch': 'Epocha',
  'nn.loss': 'Ztráta',
  'nn.acc': 'Přesnost',
  'nn.pause': '⏸ Pauza',
  'nn.resume': '▶ Pokračovat',
  'nn.reset': 'Reset',
  'nn.turbo': '×5',
  'nn.turboTip': 'Zrychlený trénink: pětkrát více kroků na snímek',
  'nn.challenges': 'Výzvy',
  'nn.ch.spiral': 'Nauč síť spirálu',
  'nn.ch.spiralTip': 'Všech šest vstupních featur a dvě skryté vrstvy – sleduj, jak se plocha stočí',
  'nn.ch.xor': 'XOR bez hloubky',
  'nn.ch.xorTip': 'Featura x·y udělá XOR lineárně separovatelný – stačí jedna malá vrstva',
  'nn.ch.classes': 'Tři prstence',
  'nn.ch.classesTip':
    'Soustředné třídy pod softmaxem – oddělitelné je dělají až kvadratické featury',
  'nn.surface':
    'Rozhodovací plocha – každý bod dostane barvu třídy, kterou tam síť predikuje; najetím síť sondujete, kliknutím bod připnete (prstence označí neurony, které pro něj pálí)',
  'nn.class': 'Třída',
  'nn.edges': 'Hrany',
  'nn.edges.weights': 'Váhy',
  'nn.edges.flow': 'Tok signálu',
  'nn.edges.weightsTip': 'Barva a tloušťka hran ukazují znaménko a velikost jednotlivých vah',
  'nn.edges.flowTip':
    'Barva a tloušťka hran ukazují skutečný příspěvek spoje pro zvolený bod: váha × aktivace zdroje',
  'nn.schematic':
    'Síť – barva neuronu = jeho aktivace pro zvolený bod (modrá nízká, oranžová vysoká); kliknutím na hranu upravíte váhu, na neuron jeho bias',
  'nn.model': '3D síť – stejné barvy aktivací, neurony na prstencích září a rostou, táhnutím otočíte',
  'nn.webgl': 'Váš prohlížeč nepodporuje WebGL, 3D model nelze vykreslit – rozhodovací plocha ale funguje.',
  'nn.links.thesis': 'Stáhnout diplomku (PDF, 1,4 MB)',
  'nn.links.case': 'Přečíst case study',
  'nn.links.code': 'Původní kód na GitHubu',
  'nn.about.title': 'Jak to funguje',
  'nn.about.p1':
    'Síť je malý vícevrstvý perceptron běžící celý ve vašem prohlížeči – čistý TypeScript, žádná ML knihovna. Každý snímek animace udělá pár kroků gradientního sestupu na zobrazeném datasetu a rozhodovací plocha překreslí každý bod roviny barvou třídy, kterou tam síť právě predikuje.',
  'nn.about.p2':
    'Celou architekturu si můžete rozbít podle libosti. Vyberte, které odvozené příznaky bodu (x, y) vstupují do sítě, přidejte skryté vrstvy a neurony a přepněte výstup mezi jedním sigmoidovým neuronem a softmaxem se 2–4 třídami – datasety se přegenerují s odpovídajícími třídami. Kliknutím na hranu ve schématu nastavíte konkrétní váhu ručně a uvidíte, jak se plocha zdeformuje; po spuštění tréninku backpropagace váš zásah zase opraví.',
  'nn.about.p3':
    'V původní diplomce to běželo jako dva spolupracující systémy: webová aplikace zakódovala architekturu, váhy a parametry tréninku a svět ve virtuální realitě (Resonite) je dekódoval do průchozího 3D modelu sítě – „3D mozku", který ovládal objekty ve scéně. 3D pohled výše je poctou tomu světu: neurony každé vrstvy sedí na prstenci, září a rostou podle svých aktivací a hrany nesou znaménko i sílu svých vah.',

  'footer.rights': 'Všechna práva vyhrazena.',
  'footer.built':
    'Navrhl a postavil Ondřej Úlehla s pomocí Astro, Tailwind, GSAP a Three.js.',

  'notfound.title': 'Stránka nenalezena',
  'notfound.text': 'Stránka, kterou hledáte, neexistuje nebo byla přesunuta.',
  'notfound.home': 'Zpět domů',

  'cv.print.title': 'Životopis',
} as const satisfies Record<keyof typeof en, string>;

// cs strings are kept for a possible future re-enable but are not built.
export const ui = { en, cs } satisfies Record<Locale | 'cs', Record<keyof typeof en, string>>;
export type UIKey = keyof typeof en;
