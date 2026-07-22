import type { APIRoute, GetStaticPaths } from 'astro';
import { skillResponse, skillStaticPaths } from '@/lib/well-known';

export const getStaticPaths: GetStaticPaths = () => skillStaticPaths();
export const GET: APIRoute = ({ props }) => skillResponse(props.skill);
