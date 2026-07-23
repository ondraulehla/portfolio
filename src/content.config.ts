import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/projects' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),
      role: z.string(),
      year: z.number(),
      order: z.number(),
      featured: z.boolean().default(true),
      tech: z.array(z.string()),
      problem: z.string(),
      solution: z.string(),
      outcome: z.string(),
      cover: image(),
      links: z
        .object({
          repo: z.string().url().optional(),
          // live may be an external URL or an on-site path (e.g. /en/neural-network)
          live: z.string().optional(),
        })
        .default({}),
    }),
});

const notes = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    date: z.coerce.date(),
  }),
});

export const collections = { projects, notes };
