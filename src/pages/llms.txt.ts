import type { APIRoute } from 'astro';
import { llmsTxt, loadProjects } from '@/lib/agent-content';

export const GET: APIRoute = async () => {
  const body = llmsTxt(await loadProjects());
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
