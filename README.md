# ondrejulehla.dev — osobní portfolio

Osobní web: profil, CV a případové studie projektů. Postaveno na **Astro 5+ / Tailwind CSS 4 / GSAP / Three.js**, dvojjazyčné (EN + CS), light/dark theme, statický výstup s Lighthouse ~100.

## Příkazy

| Příkaz | Popis |
| --- | --- |
| `npm run dev` | Dev server na `localhost:4321` |
| `npm run build` | i18n parity check + produkční build do `dist/` |
| `npm run preview` | Servíruje `dist/` |
| `npm run check` | `astro check` (typy) |
| `npm run pdf` | Vygeneruje `public/cv/*.pdf` a `public/og/*.png` z buildnutého webu (vyžaduje Chrome) |

## Kde se edituje obsah

- **CV data (single source of truth)** — [src/data/cv.ts](src/data/cv.ts): profil, zkušenosti, vzdělání, skills, jazyky. Každý text je `{ en, cs }`. Z těchto dat se generuje web i PDF.
- **Kontakty a odkazy** — [src/data/site.ts](src/data/site.ts)
- **Případové studie** — `src/content/projects/{en,cs}/<slug>.mdx`; oba jazyky musí mít stejný slug (hlídá build). Frontmatter: title, summary, role, year, tech, problem/solution/outcome, cover, links.
- **UI texty** — [src/i18n/ui.ts](src/i18n/ui.ts); chybějící český klíč = chyba typecheck.
- **Barvy/tokeny** — [src/styles/global.css](src/styles/global.css) (`:root` + `[data-theme='dark']`)

Po změně CV dat spusť `npm run build && npm run pdf` a commitni přegenerovaná PDF/OG.

## Architektura

- Hlavní web je čistě statický, JS ≈ 49 KB gzip (GSAP animace, deferred).
- 3D playground (`/en/playground`) načítá Three.js (~134 KB gzip) **až po kliknutí** na enter-gate — hlavní stránky se ho nikdy nedotknou. Svět je plně procedurální, žádné GLB assety.
- View Transitions přes `<ClientRouter />`, morph karty projektu → detail.
- Reduced-motion: animace se vypnou, playground nabídne fallback.

## Deploy

Vercel (statický output). `vercel.json` nastavuje immutable cache pro `/_astro` a security hlavičky. Před launchem změnit `site` v [astro.config.mjs](astro.config.mjs) na finální doménu a aktualizovat `Sitemap:` v [public/robots.txt](public/robots.txt).

## TODO před spuštěním

- [ ] Nahradit placeholder data v `cv.ts` (vzdělání, praxe — hledej `TODO(Ondřej)`)
- [ ] Doplnit reálné texty, čísla a screenshoty do case studies (hledej `TODO` v MDX)
- [ ] Potvrdit GitHub/LinkedIn URL v `site.ts`
- [ ] Koupit doménu, nastavit ve Vercelu, aktualizovat `astro.config.mjs` + `robots.txt`
- [ ] Přegenerovat `npm run pdf` po finálních datech
