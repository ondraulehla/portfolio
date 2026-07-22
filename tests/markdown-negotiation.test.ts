import { describe, expect, it } from 'vitest';
import { markdownTwin, prefersMarkdown } from '../functions/_middleware';

describe('prefersMarkdown', () => {
  // The dangerous direction: a real browser must never be handed raw markdown.
  it('rejects the Accept headers real browsers send', () => {
    const browsers = [
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      '*/*',
      'text/css,*/*;q=0.1',
      null,
      '',
    ];
    for (const accept of browsers) {
      expect(prefersMarkdown(accept), `accept: ${accept}`).toBe(false);
    }
  });

  it('accepts markdown when it is named, with or without parameters', () => {
    expect(prefersMarkdown('text/markdown')).toBe(true);
    expect(prefersMarkdown('text/markdown, text/plain')).toBe(true);
    expect(prefersMarkdown('text/plain, text/markdown;q=0.9')).toBe(true);
    expect(prefersMarkdown('TEXT/MARKDOWN')).toBe(true);
    expect(prefersMarkdown('  text/markdown  ')).toBe(true);
  });

  it('does not match media types that merely contain the word', () => {
    expect(prefersMarkdown('text/markdown-extra')).toBe(false);
    expect(prefersMarkdown('application/text/markdown')).toBe(false);
  });
});

describe('markdownTwin', () => {
  it('maps the pages that actually publish a twin', () => {
    expect(markdownTwin('/')).toBe('/index.md');
    expect(markdownTwin('/index.html')).toBe('/index.md');
    expect(markdownTwin('/projects/agent-audit')).toBe('/projects/agent-audit.md');
    expect(markdownTwin('/projects/agent-audit/')).toBe('/projects/agent-audit.md');
  });

  it('leaves everything else alone', () => {
    const untouched = [
      '/playground',
      '/neural-network',
      '/projects',
      '/projects/agent-audit.md',
      '/projects/nested/path',
      '/_astro/index.abc123.js',
      '/.well-known/api-catalog',
      '/llms.txt',
      '/cv/ondrej-ulehla-en.pdf',
    ];
    for (const path of untouched) {
      expect(markdownTwin(path), `path: ${path}`).toBeNull();
    }
  });

  it('does not let a crafted path escape the projects directory', () => {
    expect(markdownTwin('/projects/../secret')).toBeNull();
    expect(markdownTwin('/projects/a/../../etc/passwd')).toBeNull();
    expect(markdownTwin('/projects/UPPER')).toBeNull();
  });
});
