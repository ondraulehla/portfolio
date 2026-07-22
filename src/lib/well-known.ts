/**
 * Bodies for the /.well-known/ discovery documents.
 *
 * Cloudflare Pages has historically dropped directories whose names begin with
 * a dot from a deployment, which would silently 404 everything under
 * /.well-known/. So each document is also emitted under /well-known/ (no dot)
 * and public/_redirects proxies the canonical path onto the mirror. Both route
 * files render from the functions here, so the two copies are byte-identical
 * and the advertised skill digests stay correct whichever one is served.
 */
import { createHash } from 'node:crypto';
import {
  agentSkills,
  loadProjects,
  projectUrl,
  skillPath,
  type AgentSkill,
} from '@/lib/agent-content';
import { site } from '@/data/site';

/** RFC 9727 API catalog, as an RFC 9264 linkset. */
export async function apiCatalogResponse(): Promise<Response> {
  const projects = await loadProjects();
  const linkset = {
    linkset: [
      {
        anchor: `${site.domain}/`,
        'service-doc': [
          {
            href: `${site.domain}/llms.txt`,
            type: 'text/plain',
            title: 'Agent index (llms.txt) – what this site publishes for machines',
          },
        ],
        alternate: [
          {
            href: `${site.domain}/index.md`,
            type: 'text/markdown',
            title: 'Profile and CV as markdown',
          },
          {
            href: `${site.domain}/llms-full.txt`,
            type: 'text/plain',
            title: 'Profile and every case study as one document',
          },
          ...projects.map((entry) => ({
            href: `${projectUrl(entry)}.md`,
            type: 'text/markdown',
            title: `Case study: ${entry.data.title}`,
          })),
        ],
        related: [
          {
            href: `${site.domain}/.well-known/agent-skills/index.json`,
            type: 'application/json',
            title: 'Agent Skills discovery index',
          },
        ],
        author: [{ href: site.github, title: site.name }],
      },
    ],
  };

  return new Response(JSON.stringify(linkset, null, 2), {
    headers: { 'Content-Type': 'application/linkset+json; charset=utf-8' },
  });
}

/** Agent Skills Discovery RFC v0.2.0 index. */
export async function agentSkillsIndexResponse(): Promise<Response> {
  const skills = agentSkills(await loadProjects());
  const index = {
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: skills.map((skill) => ({
      name: skill.name,
      type: 'skill-md',
      description: skill.description,
      // canonical path – _redirects proxies it onto the dotless mirror if the
      // host dropped the dot directory
      url: skillPath(skill.name),
      digest: `sha256:${createHash('sha256').update(skill.body, 'utf8').digest('hex')}`,
    })),
  };
  return new Response(JSON.stringify(index, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** One skill's SKILL.md – the exact bytes the index digests. */
export function skillResponse(skill: AgentSkill): Response {
  return new Response(skill.body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}

export async function skillStaticPaths() {
  const skills = agentSkills(await loadProjects());
  return skills.map((skill) => ({ params: { skill: skill.name }, props: { skill } }));
}
