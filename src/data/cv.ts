import type { Locale } from '@/i18n/config';

/** Strings keep their Czech variant for a possible future re-enable; only en is built. */
export type L10n = Record<Locale, string> & { cs?: string };

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
// Real data. A few dates are approximate – search "CONFIRM" to verify before
// sending the PDF anywhere.
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
        en: "I'm a fullstack developer at NetGenium. I work across the whole lifecycle – sitting down with clients, analysing their needs, designing the solution, and then shipping it across frontend, backend and infrastructure. Over the past two years a growing part of that work has been bringing AI into our products and our own workflow.",
        cs: 'Jsem fullstack vývojář v NetGeniu. Pracuji napříč celým životním cyklem – sednu si s klientem, zanalyzuji potřeby, navrhnu řešení a pak ho dodám na frontendu, backendu i infrastruktuře. V posledních dvou letech je stále větší částí té práce zavádění AI do našich produktů i vlastního fungování.',
      },
      {
        en: 'Lately my focus is AI engineering: RAG pipelines over real client implementations, MCP servers, and automating processes that used to eat entire days – from customs clearance for the Czech Post to resolving client tickets, where the AI has the concrete codebase on hand and can find and fix the reported issue itself.',
        cs: 'V poslední době se soustředím na AI inženýrství: RAG pipeline nad reálnými implementacemi klientů, MCP servery a automatizaci procesů, které dřív zabraly celé dny – od proclení pro Českou poštu po řešení klientských ticketů, kde má AI po ruce konkrétní kód a dokáže nahlášený problém sama najít a opravit.',
      },
    ],
    facts: [
      { label: { en: 'Location', cs: 'Lokalita' }, value: { en: 'Prague, CZ', cs: 'Praha, ČR' } },
      { label: { en: 'Focus', cs: 'Zaměření' }, value: { en: 'Fullstack · AI', cs: 'Fullstack · AI' } },
      { label: { en: 'Experience', cs: 'Praxe' }, value: { en: '5+ years', cs: '5+ let' } },
    ],
  },

  experience: [
    {
      company: 'NetGenium',
      url: 'https://www.netgenium.com',
      role: { en: 'Fullstack Developer & AI Engineer', cs: 'Fullstack vývojář & AI inženýr' },
      start: '2021-01', // CONFIRM start month
      summary: {
        en: 'Enterprise applications on a low-code platform, client delivery, and integrating AI into the company’s products and internal workflow.',
        cs: 'Podnikové aplikace na low-code platformě, dodávky pro klienty a integrace AI do produktů firmy i interního fungování.',
      },
      highlights: [
        {
          en: 'Integrated AI across the platform end to end – from data and retrieval to the tools and interfaces used by developers and clients.',
          cs: 'Integroval jsem AI napříč platformou end-to-end – od dat a retrievalu po nástroje a rozhraní, která používají vývojáři i klienti.',
        },
        {
          en: 'Built RAG pipelines for the LLMs we use with clients, grounding answers in each client’s real implementation so the models reason over actual code and data.',
          cs: 'Postavil jsem RAG pipeline pro LLM, které používáme u klientů – odpovědi ukotvené v reálné implementaci daného klienta, takže modely pracují se skutečným kódem a daty.',
        },
        {
          en: 'Automated internal processes with AI: generating applications in our low-code framework, and near-automatic client-ticket resolution – the AI has the concrete implementation on hand, so it locates the reported problem and fixes it.',
          cs: 'Zautomatizoval jsem interní procesy pomocí AI: generování aplikací v našem low-code frameworku a téměř automatické řešení klientských ticketů – AI má po ruce konkrétní implementaci, takže nahlášený problém najde a opraví.',
        },
        {
          en: 'Automated the customs-clearance process for the Czech Post and built/customized their PostShop (postshop.cz) storefront.',
          cs: 'Zautomatizoval jsem proces proclení pro Českou poštu a upravoval jejich e-shop PostShop (postshop.cz).',
        },
        {
          en: 'Built internal MCP servers and database-backed MCP servers for clients; currently building the new Hello.cz website together with a partner studio.',
          cs: 'Postavil jsem interní MCP servery i databázové MCP servery pro klienty; aktuálně s partnerským studiem stavím nový web Hello.cz.',
        },
      ],
      tech: ['TypeScript', 'JavaScript', 'C#', 'SQL', 'React', 'Claude API', 'RAG', 'MCP'],
    },
    {
      company: 'TU Wien',
      url: 'https://www.tuwien.at',
      role: { en: 'Research Internship (exchange)', cs: 'Výzkumná stáž (výjezd)' },
      start: '2023-02', // CONFIRM dates
      end: '2023-06',
      summary: {
        en: 'Research internship in Vienna during an exchange stay at TU Wien.',
        cs: 'Výzkumná stáž ve Vídni během studijního výjezdu na TU Wien.',
      },
      highlights: [
        {
          en: 'International research experience alongside a demanding CS program.',
          cs: 'Mezinárodní výzkumná zkušenost vedle náročného studia informatiky.',
        },
      ],
      tech: [],
    },
    {
      company: 'Health centre',
      role: { en: 'IT Administrator', cs: 'IT administrátor' },
      start: '2018-01',
      end: '2020-12',
      summary: {
        en: 'IT administration and support during university studies.',
        cs: 'IT administrace a podpora během studia na vysoké škole.',
      },
      highlights: [],
      tech: [],
    },
  ],

  education: [
    {
      school: 'Czech Technical University – FIT',
      degree: {
        en: 'Ing. (Master’s), Software Engineering',
        cs: 'Ing., Softwarové inženýrství',
      },
      start: '2019-09',
      end: '2025-06',
      note: {
        en: 'Included a research internship / exchange semester at TU Wien, Vienna.',
        cs: 'Součástí byla výzkumná stáž / výjezdový semestr na TU Wien ve Vídni.',
      },
    },
  ],

  skills: [
    {
      category: { en: 'Languages', cs: 'Jazyky' },
      items: ['TypeScript', 'JavaScript', 'Python', 'C#', 'C/C++', 'Java', 'SQL'],
    },
    {
      category: { en: 'Frontend', cs: 'Frontend' },
      items: ['React', 'Next.js', 'Vue', 'Astro', 'Tailwind CSS', 'HTML/CSS'],
    },
    {
      category: { en: 'AI Engineering', cs: 'AI inženýrství' },
      items: [
        { en: 'AI agents & tool use', cs: 'AI agenti & tool use' },
        { en: 'RAG pipelines', cs: 'RAG pipeline' },
        'MCP servers',
        'Claude API',
        'Claude Agent SDK',
        'OpenAI API',
        { en: 'Sandboxed code execution', cs: 'Sandboxované spouštění kódu' },
        { en: 'Prompt engineering', cs: 'Prompt engineering' },
      ],
    },
    {
      category: { en: 'Backend & Data', cs: 'Backend & data' },
      items: ['Node.js', 'FastAPI', '.NET', 'PostgreSQL', 'Oracle', 'Redis'],
    },
    {
      category: { en: 'Infrastructure', cs: 'Infrastruktura' },
      items: ['Docker', 'Kubernetes', 'Google Cloud', 'Git', 'CI/CD'],
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
    {
      name: { en: 'English', cs: 'Angličtina' },
      level: { en: 'Fluent · C1', cs: 'Plynulá · C1' },
    },
    { name: { en: 'French', cs: 'Francouzština' }, level: { en: 'Intermediate · B1', cs: 'Středně pokročilá · B1' } },
    { name: { en: 'German', cs: 'Němčina' }, level: { en: 'Basic · A2', cs: 'Základní · A2' } },
  ],
};

/** '2023-06' → 'Jun 2023' */
export function formatMonth(iso: string, _locale: Locale): string {
  const [y, m] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
