import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../db/schema';

/**
 * Create a Better Auth instance configured for Cloudflare D1
 * This must be called with the D1 database binding from the request context
 */
export function createAuth(d1: D1Database, options?: { baseURL?: string }) {
  const db = drizzle(d1, { schema });
  
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    
    baseURL: options?.baseURL || 'http://localhost:4321',
    basePath: '/api/auth',
    
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // Can enable later with Resend
    },
    
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // Update session every 24 hours
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },
    
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: 'customer',
        },
        phone: {
          type: 'string',
          required: false,
        },
      },
    },
    
    account: {
      accountLinking: {
        enabled: true,
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
