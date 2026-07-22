// Dotless mirror of /.well-known/agent-skills/index.json.
import type { APIRoute } from 'astro';
import { agentSkillsIndexResponse } from '@/lib/well-known';

export const GET: APIRoute = () => agentSkillsIndexResponse();
