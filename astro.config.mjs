// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  redirects: {
    '/en': '/',
    '/en/neural-network': '/neural-network',
    '/en/playground': '/playground',
    '/en/projects/[slug]': '/projects/[slug]',
  },
  // TODO: replace with the final custom domain before launch
  site: 'https://ondrejulehla.dev',
  output: 'static',
  trailingSlash: 'ignore',
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/cv/print'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
