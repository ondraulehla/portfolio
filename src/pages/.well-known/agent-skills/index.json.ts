import type { APIRoute } from 'astro';
import { agentSkillsIndexResponse } from '@/lib/well-known';

export const GET: APIRoute = () => agentSkillsIndexResponse();
