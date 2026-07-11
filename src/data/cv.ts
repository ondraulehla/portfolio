import type { Locale } from '@/i18n/config';

/** Every human-readable string exists in both languages. */
export type L10n = Record<Locale, string>;

export interface ExperienceItem {
  company: string;
  url?: string;
  role: L10n;
  /** ISO year-month, e.g. '2023-06' */
  start: string;
  end?: string;
  summary: L10n;
  highlights: L10n[];
  tech: string[];
}

export interface EducationItem {
  school: string;
  degree: L10n;
  start: string;
  end?: string;
  note?: L10n;
}

export interface SkillGroup {
  category: L10n;
  /** Plain string for universal tech names, L10n for terms that differ per language. */
  items: (string | L10n)[];
}

export function skillLabel(item: string | L10n, locale: Locale): string {
  return typeof item === 'string' ? item : item[locale];
}

export interface CV {
  profile: {
    name: string;
    title: L10n;
    tagline: L10n;
    bio: L10n[];
    facts: { label: L10n; value: L10n }[];
  };
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: SkillGroup[];
  languages: { name: L10n; level: L10n }[];
}

// ============================================================================
// TODO(Ondřej): PLACEHOLDER DATA — replace every entry below with real data.
// The structure is final; only the values need to change.
// ============================================================================
export const cv: CV = {
  profile: {
    name: 'Ondřej Úlehla',
    title: {
      en: 'Fullstack Developer & AI Engineer',
      cs: 'Fullstack vývojář & AI inženýr',
    },
    tagline: {
      en: 'I turn client problems into shipped software.',
      cs: 'Proměňuji problémy klientů v hotový software.',
    },
    bio: [
      {
        en: 'I work across the whole product lifecycle: I sit down with clients, analyse their needs, propose an architecture, and then build it — frontend, backend and infrastructure alike. Lately my focus has shifted heavily towards AI engineering: LLM-powered features, agentic workflows and retrieval pipelines that actually make it to production.',
        cs: 'Pracuji napříč celým životním cyklem produktu: sednu si s klientem, zanalyzuji jeho potřeby, navrhnu architekturu a pak ji postavím — frontend, backend i infrastrukturu. V poslední době se intenzivně věnuji AI inženýrství: funkcím postaveným na LLM, agentním workflow a retrieval pipeline, které se skutečně dostanou do produkce.',
      },
      {
        en: 'What sets me apart is the combination of engineering depth and client-facing work — I write the analysis, defend it in the meeting room, and then deliver the code that makes it real.',
        cs: 'Odlišuje mě kombinace inženýrské hloubky a práce s klienty — napíšu analýzu, obhájím ji na schůzce a pak dodám kód, který ji promění ve skutečnost.',
      },
    ],
    facts: [
      { label: { en: 'Location', cs: 'Lokalita' }, value: { en: 'Prague, CZ', cs: 'Praha, ČR' } },
      { label: { en: 'Focus', cs: 'Zaměření' }, value: { en: 'Fullstack · AI', cs: 'Fullstack · AI' } },
      { label: { en: 'Experience', cs: 'Praxe' }, value: { en: '3+ years', cs: '3+ roky' } },
    ],
  },

  experience: [
    {
      company: 'NetGenium',
      url: 'https://www.netgenium.com',
      role: { en: 'Fullstack Developer & Analyst', cs: 'Fullstack vývojář & analytik' },
      start: '2023-01',
      summary: {
        en: 'Development of enterprise applications on a low-code platform, client analyses and custom integrations.',
        cs: 'Vývoj podnikových aplikací na low-code platformě, analýzy pro klienty a integrace na míru.',
      },
      highlights: [
        {
          en: 'Led analysis and delivery of smaller client projects end-to-end — requirements, data model, implementation, handover.',
          cs: 'Vedl jsem analýzu a dodávku menších klientských projektů end-to-end — požadavky, datový model, implementace, předání.',
        },
        {
          en: 'Designed and built AI-assisted features integrating LLM APIs into business workflows.',
          cs: 'Navrhl a postavil jsem AI funkce integrující LLM API do firemních procesů.',
        },
      ],
      tech: ['TypeScript', 'React', 'Node.js', 'SQL', 'Claude API'],
    },
  ],

  education: [
    {
      school: 'FIT — Faculty of Information Technology',
      degree: {
        en: 'B.Sc. in Computer Science (placeholder)',
        cs: 'Bc. v oboru informatika (placeholder)',
      },
      start: '2019-09',
      end: '2023-06',
      note: {
        en: 'TODO: real school, field, thesis topic.',
        cs: 'TODO: skutečná škola, obor, téma práce.',
      },
    },
  ],

  skills: [
    {
      category: { en: 'Frontend', cs: 'Frontend' },
      items: ['TypeScript', 'React', 'Astro', 'Tailwind CSS', 'GSAP', 'Three.js'],
    },
    {
      category: { en: 'Backend', cs: 'Backend' },
      items: ['Node.js', 'Hono', 'tRPC', 'PostgreSQL', 'Drizzle ORM', 'Redis'],
    },
    {
      category: { en: 'AI Engineering', cs: 'AI inženýrství' },
      items: ['Claude API', 'Agentic workflows', 'RAG pipelines', 'Prompt engineering', 'Evals'],
    },
    {
      category: { en: 'Infrastructure', cs: 'Infrastruktura' },
      items: ['Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Vercel'],
    },
    {
      category: { en: 'Client work', cs: 'Práce s klienty' },
      items: [
        { en: 'Requirements analysis', cs: 'Analýza požadavků' },
        { en: 'Solution design', cs: 'Návrh řešení' },
        { en: 'Workshops & presentations', cs: 'Workshopy a prezentace' },
        { en: 'Technical writing', cs: 'Technická dokumentace' },
      ],
    },
  ],

  languages: [
    { name: { en: 'Czech', cs: 'Čeština' }, level: { en: 'Native', cs: 'Rodilý mluvčí' } },
    { name: { en: 'English', cs: 'Angličtina' }, level: { en: 'Professional (C1)', cs: 'Profesionální (C1)' } },
    { name: { en: 'German', cs: 'Němčina' }, level: { en: 'Basic (A2)', cs: 'Základní (A2)' } },
  ],
};

/** '2023-06' → 'Jun 2023' / 'čer 2023' */
export function formatMonth(iso: string, locale: Locale): string {
  const [y, m] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  return new Intl.DateTimeFormat(locale === 'cs' ? 'cs-CZ' : 'en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
