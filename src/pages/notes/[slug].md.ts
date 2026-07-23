import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '@/data/site';

export const getStaticPaths: GetStaticPaths = async () => {
  const entries = await getCollection('notes');
  return entries.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
};

export const GET: APIRoute = ({ props, params }) => {
  const d = props.entry.data;
  const body = [
    `# ${d.title}`,
    '',
    `> ${d.summary}`,
    '',
    `- **Author:** ${site.name}`,
    `- **Published:** ${d.date.toISOString().slice(0, 10)}`,
    `- **Canonical page:** ${site.domain}/notes/${params.slug}`,
    '',
    '---',
    '',
    props.entry.body?.trim() ?? '',
    '',
  ].join('\n');
  return new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
