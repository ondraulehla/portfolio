import type { APIRoute } from 'astro';
import { apiCatalogResponse } from '@/lib/well-known';

export const GET: APIRoute = () => apiCatalogResponse();
