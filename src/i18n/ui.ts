import type { Locale } from './config';

const en = {
  'site.title': 'Ondřej Úlehla — Fullstack Developer & AI Engineer',
  'site.description':
    'Fullstack developer and AI engineer building fast, well-crafted products — from client analysis to production deployment.',
  'nav.about': 'About',
  'nav.experience': 'Experience',
  'nav.projects': 'Projects',
  'nav.contact': 'Contact',
  'nav.playground': 'Playground',
  'nav.menu': 'Menu',
  'theme.toggle': 'Toggle color theme',
  'lang.switch': 'Přepnout do češtiny',
  'lang.switchShort': 'CS',
  'skip.content': 'Skip to content',

  'hero.available': 'Open to new opportunities',
  'hero.title.line1': 'Fullstack developer',
  'hero.title.line2': '& AI engineer.',
  'hero.subtitle':
    'I design, build and ship complete products — from client analysis and architecture to polished frontend, robust backend and AI integrations.',
  'hero.cta.projects': 'View projects',
  'hero.cta.cv': 'Download CV',
  'hero.cta.playground': 'Explore in 3D',

  'about.heading': 'About me',
  'about.kicker': 'Who I am',

  'experience.heading': 'Experience',
  'experience.kicker': 'Where I worked',
  'experience.present': 'Present',

  'education.heading': 'Education',
  'education.kicker': 'Where I studied',

  'skills.heading': 'Skills',
  'skills.kicker': 'What I work with',

  'projects.heading': 'Selected projects',
  'projects.kicker': 'Case studies',
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
  'contact.text':
    "Interested in working together, or just want to say hi? I'll get back to you within a day.",
  'contact.copy': 'Copy email',
  'contact.copied': 'Copied!',
  'contact.cv': 'Download CV (PDF)',

  'playground.title': '3D Playground',
  'playground.description':
    'A small interactive 3D world. Take off, fly over the island and discover my projects — built with Three.js.',
  'playground.enter': 'Take off',
  'playground.loading': 'Loading world…',
  'playground.controls': '←→ turn · ↑↓ climb & dive (WASD works too)',
  'playground.enterProject': 'to open project',
  'playground.pressEnter': 'Press Enter',
  'playground.fallback.motion':
    'You have reduced motion enabled, so the 3D experience is off by default.',
  'playground.fallback.webgl': "Your browser doesn't support WebGL, so the 3D world can't run here.",
  'playground.fallback.anyway': 'Load it anyway',
  'playground.back': 'Back to site',
  'playground.hint.gas': 'accelerate',
  'playground.hint.steer': 'steer',

  'footer.rights': 'All rights reserved.',
  'footer.built':
    'Designed & built by Ondřej Úlehla with Astro, Tailwind, GSAP and Three.js.',

  'notfound.title': 'Page not found',
  'notfound.text': "The page you're looking for doesn't exist or has moved.",
  'notfound.home': 'Back home',

  'cv.print.title': 'Curriculum Vitae',
} as const;

const cs = {
  'site.title': 'Ondřej Úlehla — Fullstack vývojář & AI inženýr',
  'site.description':
    'Fullstack vývojář a AI inženýr. Stavím rychlé a promyšlené produkty — od analýzy s klientem po nasazení do produkce.',
  'nav.about': 'O mně',
  'nav.experience': 'Zkušenosti',
  'nav.projects': 'Projekty',
  'nav.contact': 'Kontakt',
  'nav.playground': 'Playground',
  'nav.menu': 'Menu',
  'theme.toggle': 'Přepnout barevný režim',
  'lang.switch': 'Switch to English',
  'lang.switchShort': 'EN',
  'skip.content': 'Přeskočit na obsah',

  'hero.available': 'Otevřený novým příležitostem',
  'hero.title.line1': 'Fullstack vývojář',
  'hero.title.line2': '& AI inženýr.',
  'hero.subtitle':
    'Navrhuji, stavím a dodávám kompletní produkty — od analýzy s klientem přes architekturu po vyladěný frontend, robustní backend a AI integrace.',
  'hero.cta.projects': 'Prohlédnout projekty',
  'hero.cta.cv': 'Stáhnout CV',
  'hero.cta.playground': 'Prozkoumat ve 3D',

  'about.heading': 'O mně',
  'about.kicker': 'Kdo jsem',

  'experience.heading': 'Zkušenosti',
  'experience.kicker': 'Kde jsem pracoval',
  'experience.present': 'Současnost',

  'education.heading': 'Vzdělání',
  'education.kicker': 'Kde jsem studoval',

  'skills.heading': 'Dovednosti',
  'skills.kicker': 'S čím pracuji',

  'projects.heading': 'Vybrané projekty',
  'projects.kicker': 'Případové studie',
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
  'contact.text': 'Zajímá vás spolupráce, nebo se chcete jen pozdravit? Ozvu se do jednoho dne.',
  'contact.copy': 'Kopírovat e-mail',
  'contact.copied': 'Zkopírováno!',
  'contact.cv': 'Stáhnout CV (PDF)',

  'playground.title': '3D Playground',
  'playground.description':
    'Malý interaktivní 3D svět. Vzlétněte, prolétněte se nad ostrovem a objevte mé projekty — postaveno na Three.js.',
  'playground.enter': 'Vzlétnout',
  'playground.loading': 'Načítám svět…',
  'playground.controls': '←→ zatáčení · ↑↓ stoupání a klesání (funguje i WASD)',
  'playground.enterProject': 'pro otevření projektu',
  'playground.pressEnter': 'Stiskněte Enter',
  'playground.fallback.motion':
    'Máte zapnuté omezení animací, 3D zážitek je proto ve výchozím stavu vypnutý.',
  'playground.fallback.webgl': 'Váš prohlížeč nepodporuje WebGL, 3D svět zde nelze spustit.',
  'playground.fallback.anyway': 'Přesto načíst',
  'playground.back': 'Zpět na web',
  'playground.hint.gas': 'plyn',
  'playground.hint.steer': 'zatáčení',

  'footer.rights': 'Všechna práva vyhrazena.',
  'footer.built':
    'Navrhl a postavil Ondřej Úlehla s pomocí Astro, Tailwind, GSAP a Three.js.',

  'notfound.title': 'Stránka nenalezena',
  'notfound.text': 'Stránka, kterou hledáte, neexistuje nebo byla přesunuta.',
  'notfound.home': 'Zpět domů',

  'cv.print.title': 'Životopis',
} as const satisfies Record<keyof typeof en, string>;

export const ui = { en, cs } satisfies Record<Locale, Record<keyof typeof en, string>>;
export type UIKey = keyof typeof en;
