import type { APIRoute, GetStaticPaths } from 'astro';
import { loadProjects, projectMarkdown, projectSlug } from '@/lib/agent-content';

export const getStaticPaths: GetStaticPaths = async () => {
  const projects = await loadProjects();
  return projects.map((entry) => ({ params: { slug: projectSlug(entry) }, props: { entry } }));
};

export const GET: APIRoute = ({ props }) =>
  new Response(projectMarkdown(props.entry), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
