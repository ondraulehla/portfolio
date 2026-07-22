import type { APIRoute } from 'astro';
import { loadProjects, profileMarkdown } from '@/lib/agent-content';

export const GET: APIRoute = async () => {
  const body = profileMarkdown(await loadProjects());
  return new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
