/**
 * Markdown content negotiation, the free way.
 *
 * Cloudflare's own "Markdown for Agents" does this, but it is gated behind the
 * Pro plan. The site already publishes a .md twin of every page (see
 * src/lib/agent-content.ts), so all that is missing is serving it when a client
 * asks for `Accept: text/markdown`. HTML stays the default for browsers.
 *
 * public/_routes.json limits this to "/" and "/projects/*", so assets, llms.txt,
 * .well-known, the lab and the playground are served straight from the static
 * store with no Worker invocation. Its wildcards are trailing-only, so
 * /projects/* also catches the .md twins themselves – markdownTwin() returns
 * null for those (the dot fails the pattern) and they pass through untouched.
 *
 * The types below are declared locally rather than pulled from
 * @cloudflare/workers-types: this directory is outside tsconfig's include, and
 * one dependency is not worth it for two signatures.
 */

interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}
interface MiddlewareContext {
  request: Request;
  next: () => Promise<Response>;
  env: { ASSETS?: AssetFetcher };
}

/**
 * The .md twin for a path, or null if the path has none.
 * Deliberately strict: only the two shapes actually published as markdown.
 */
export function markdownTwin(pathname: string): string | null {
  if (pathname === '/' || pathname === '/index.html') return '/index.md';
  const clean = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return /^\/projects\/[a-z0-9-]+$/.test(clean) ? `${clean}.md` : null;
}

/**
 * True only when markdown is asked for by name. A browser's
 * `text/html,application/xhtml+xml,...,*​/*;q=0.8` must never match – matching
 * `*​/*` here would serve every visitor raw markdown.
 */
export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  return accept
    .split(',')
    .some((part) => part.trim().toLowerCase().split(';')[0] === 'text/markdown');
}

/** Tell caches that this URL varies by Accept, so HTML and markdown stay apart. */
function varyOnAccept(response: Response): Response {
  const out = new Response(response.body, response);
  const existing = out.headers.get('Vary');
  const parts = existing ? existing.split(',').map((p) => p.trim()) : [];
  if (!parts.some((p) => p.toLowerCase() === 'accept')) parts.push('Accept');
  out.headers.set('Vary', parts.join(', '));
  return out;
}

export const onRequest = async (context: MiddlewareContext): Promise<Response> => {
  const { request, next, env } = context;

  if (request.method !== 'GET' && request.method !== 'HEAD') return next();

  const url = new URL(request.url);
  const twin = markdownTwin(url.pathname);
  if (!twin) return next();

  // Vary is set on the HTML too – a cached HTML response without it would be
  // handed to an agent that asked for markdown.
  if (!prefersMarkdown(request.headers.get('Accept')) || !env.ASSETS) {
    return varyOnAccept(await next());
  }

  const md = await env.ASSETS.fetch(new Request(new URL(twin, url).toString(), { method: 'GET' }));
  // twin missing for any reason: fall back to the HTML rather than 404
  if (!md.ok) return varyOnAccept(await next());

  const out = new Response(md.body, md);
  out.headers.set('Content-Type', 'text/markdown; charset=utf-8');
  out.headers.set('Content-Location', twin);
  out.headers.set('Vary', 'Accept');
  return out;
};
