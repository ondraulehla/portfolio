/**
 * Bodies for the /.well-known/ discovery documents.
 *
 * Cloudflare Pages drops directories whose names begin with a dot, so these are
 * emitted at /well-known/ (no dot) and public/_redirects 200-proxies the
 * canonical /.well-known/ paths onto them. Verified on the 2026-07-22 deploy:
 * the dotted copies were never served even when built, and once a Functions
 * directory was added they broke asset publishing outright, so they are no
 * longer emitted at all. The canonical URLs still resolve – via the proxy.
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
