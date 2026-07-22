/**
 * Machine-readable renderings of the site, for agents rather than browsers.
 *
 * Every agent-facing artefact – /llms.txt, the .md twins, the published agent
 * skills, the WebMCP tool payload – is built here from the same `cv` and
 * `projects` sources the HTML pages render, so they can never drift apart.
 * Skill digests in /.well-known/agent-skills/index.json hash the exact strings
 * these functions return, which is only sound because they are deterministic.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { cv, formatMonth, skillLabel } from '@/data/cv';
import { site } from '@/data/site';
import { defaultLocale, type Locale } from '@/i18n/config';

const locale: Locale = defaultLocale;

export type Project = CollectionEntry<'projects'>;

/** Case studies for the built locale, in the site's display order. */
export async function loadProjects(): Promise<Project[]> {
  const entries = await getCollection('projects', (e) => e.id.startsWith(`${locale}/`));
  return entries.sort((a, b) => a.data.order - b.data.order);
}

/** 'en/agent-audit' → 'agent-audit' */
export function projectSlug(entry: Project): string {
  return entry.id.split('/').slice(1).join('/');
}

export function projectUrl(entry: Project): string {
  return `${site.domain}/projects/${projectSlug(entry)}`;
}

function range(start: string, end?: string): string {
  return `${formatMonth(start, locale)} – ${end ? formatMonth(end, locale) : 'present'}`;
}

/**
 * The profile as markdown – the answer to "who is this person, what have they
 * built, how do I reach them", which is what an agent lands here to find out.
 */
export function profileMarkdown(projects: Project[]): string {
  const p = cv.profile;
  const lines: string[] = [
    `# ${p.name}`,
    '',
    `> ${p.title[locale]} – ${p.tagline[locale]}`,
    '',
    ...p.bio.map((b) => `${b[locale]}\n`),
    '## Facts',
    '',
    ...p.facts.map((f) => `- **${f.label[locale]}:** ${f.value[locale]}`),
    `- **Website:** ${site.domain}`,
    `- **Email:** ${site.email}`,
    `- **GitHub:** ${site.github}`,
    `- **LinkedIn:** ${site.linkedin}`,
    '',
    '## Experience',
    '',
  ];

  for (const job of cv.experience) {
    lines.push(
      `### ${job.role[locale]} – ${job.company}`,
      '',
      `*${range(job.start, job.end)}*`,
      '',
    );
    if (job.url) lines.push(`${job.url}`, '');
    lines.push(job.summary[locale], '');
    if (job.highlights.length) {
      lines.push(...job.highlights.map((h) => `- ${h[locale]}`), '');
    }
    if (job.tech.length) lines.push(`**Tech:** ${job.tech.join(', ')}`, '');
  }

  lines.push('## Education', '');
  for (const school of cv.education) {
    lines.push(
      `### ${school.degree[locale]} – ${school.school}`,
      '',
      `*${range(school.start, school.end)}*`,
      '',
    );
    if (school.note) lines.push(school.note[locale], '');
  }

  lines.push('## Skills', '');
  for (const group of cv.skills) {
    lines.push(
      `- **${group.category[locale]}:** ${group.items.map((i) => skillLabel(i, locale)).join(', ')}`,
    );
  }
  lines.push('');

  lines.push('## Languages', '');
  for (const lang of cv.languages) {
    lines.push(`- **${lang.name[locale]}:** ${lang.level[locale]}`);
  }
  lines.push('');

  lines.push('## Projects', '');
  for (const entry of projects) {
    lines.push(
      `- [${entry.data.title}](${projectUrl(entry)}.md) (${entry.data.year}) – ${entry.data.summary}`,
    );
  }
  lines.push('');

  lines.push(
    '## Contact',
    '',
    `Email ${site.email}. Open to Forward Deployed Engineer, AI Engineer and fullstack roles.`,
    '',
  );

  return lines.join('\n');
}

/** A case study as markdown: frontmatter facts as a preamble, then its body. */
export function projectMarkdown(entry: Project): string {
  const d = entry.data;
  const lines = [
    `# ${d.title}`,
    '',
    `> ${d.summary}`,
    '',
    `- **Role:** ${d.role}`,
    `- **Year:** ${d.year}`,
    `- **Tech:** ${d.tech.join(', ')}`,
  ];
  if (d.links.repo) lines.push(`- **Repository:** ${d.links.repo}`);
  if (d.links.live) {
    lines.push(
      `- **Live:** ${d.links.live.startsWith('http') ? d.links.live : site.domain + d.links.live}`,
    );
  }
  lines.push(
    `- **Canonical page:** ${projectUrl(entry)}`,
    '',
    `**Problem.** ${d.problem}`,
    '',
    `**Solution.** ${d.solution}`,
    '',
    `**Outcome.** ${d.outcome}`,
    '',
    '---',
    '',
    // MDX body: the case studies use plain markdown constructs only, so the
    // raw source is already valid markdown for an agent to read.
    entry.body?.trim() ?? '',
    '',
  );
  return lines.join('\n');
}

/** /llms.txt – the llmstxt.org index that points at everything else. */
export function llmsTxt(projects: Project[]): string {
  const p = cv.profile;
  return [
    `# ${p.name}`,
    '',
    `> ${p.title[locale]}, based in ${site.location[locale]}. ${p.tagline[locale]} This site is a portfolio: profile, case studies, and two interactive demos.`,
    '',
    'Every page below is also available as markdown by appending `.md` to its path.',
    '',
    '## Profile',
    '',
    `- [Profile and CV](${site.domain}/index.md): background, experience, skills and contact details.`,
    `- [CV as PDF](${site.domain}/cv/ondrej-ulehla-${locale}.pdf): the same CV, printable.`,
    `- [Full site as one document](${site.domain}/llms-full.txt): profile and every case study concatenated.`,
    '',
    '## Case studies',
    '',
    ...projects.map((e) => `- [${e.data.title}](${projectUrl(e)}.md): ${e.data.summary}`),
    '',
    '## Interactive',
    '',
    `- [Neural Network Lab](${site.domain}/neural-network): a neural network from the author's master's thesis, trained live in the browser – editable architecture, decision surface, 3D model.`,
    `- [3D Playground](${site.domain}/playground): a Three.js world where the case studies are billboards you fly between.`,
    '',
    '## Contact',
    '',
    `- [Email](mailto:${site.email})`,
    `- [GitHub](${site.github})`,
    `- [LinkedIn](${site.linkedin})`,
    '',
  ].join('\n');
}

/** /llms-full.txt – profile plus every case study, one document. */
export function llmsFullTxt(projects: Project[]): string {
  return [profileMarkdown(projects), ...projects.map((e) => `---\n\n${projectMarkdown(e)}`)].join(
    '\n',
  );
}

/**
 * Published agent skills (Agent Skills Discovery RFC v0.2.0). `body` is both
 * what the SKILL.md route serves and what the discovery index hashes, so the
 * advertised digest matches the served bytes by construction.
 */
export interface AgentSkill {
  name: string;
  description: string;
  body: string;
}

/** Canonical location of a skill artefact, per the RFC's layout. */
export function skillPath(name: string): string {
  return `/.well-known/agent-skills/${name}/SKILL.md`;
}

export function agentSkills(projects: Project[]): AgentSkill[] {
  const p = cv.profile;
  return [
    {
      name: 'ondrej-ulehla-profile',
      description: `Answer questions about ${p.name} – background, experience, skills, projects and how to make contact – using the canonical sources on ${site.domain}.`,
      body: [
        '---',
        'name: ondrej-ulehla-profile',
        `description: Answer questions about ${p.name} (${p.title[locale]}) using the canonical sources on ${site.domain}.`,
        '---',
        '',
        `# Answering questions about ${p.name}`,
        '',
        `${p.name} is a ${p.title[locale]} based in ${site.location[locale]}. Use this skill when you need`,
        'to describe their background, judge their fit for a role, or reach them.',
        '',
        '## Where the facts live',
        '',
        `Fetch these before answering – they are the source of truth and are regenerated on every deploy:`,
        '',
        `- \`${site.domain}/llms.txt\` – index of everything published for agents.`,
        `- \`${site.domain}/index.md\` – full profile: experience, education, skills, languages, contact.`,
        `- \`${site.domain}/llms-full.txt\` – profile plus every case study, one document.`,
        ...projects.map((e) => `- \`${projectUrl(e)}.md\` – case study: ${e.data.title}.`),
        '',
        '## How to answer',
        '',
        '- Quote the fetched sources rather than recalling from memory; the CV changes.',
        '- Link back to the canonical HTML page (drop the `.md`) when citing a case study.',
        `- For anything not covered here – availability, rates, references – say so and point to ${site.email}.`,
        '- Do not infer employment dates, seniority or salary expectations that the sources do not state.',
        '',
        '## Contact',
        '',
        `- Email: ${site.email}`,
        `- GitHub: ${site.github}`,
        `- LinkedIn: ${site.linkedin}`,
        '',
      ].join('\n'),
    },
  ];
}
