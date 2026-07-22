// Dotless mirror of /.well-known/api-catalog – see src/lib/well-known.ts.
import type { APIRoute } from 'astro';
import { apiCatalogResponse } from '@/lib/well-known';

export const GET: APIRoute = () => apiCatalogResponse();
