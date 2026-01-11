import type { APIRoute } from 'astro';
import { createAuth } from '../../../lib/auth';

// This is a catch-all route for Better Auth
export const prerender = false;

export const ALL: APIRoute = async ({ request, locals }) => {
  const runtime = (locals as any).runtime;
  const env = runtime?.env;

  if (!env?.DB) {
    return new Response('Database not configured', { status: 500 });
  }

  const baseURL = env?.SITE_URL || 'http://localhost:4321';
  const auth = createAuth(env.DB, { 
    baseURL,
    env: {
      GOOGLE_CLIENT_ID: env?.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: env?.GOOGLE_CLIENT_SECRET,
    },
  });

  // Better Auth handles all /api/auth/* routes
  return auth.handler(request);
};

// Export individual methods for Astro
export const GET = ALL;
export const POST = ALL;
