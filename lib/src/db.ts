/**
 * Drizzle DB factory wired for Cloudflare D1.
 *
 * Each fullstack app calls `getDb(env, schema)` from its request handler,
 * passing its own merged schema object (auth tables + business tables).
 */
import { drizzle } from 'drizzle-orm/d1';

export function getDb<TSchema extends Record<string, unknown>>(
  env: { DB: D1Database },
  schema: TSchema
) {
  return drizzle(env.DB, { schema });
}

export type Db<TSchema extends Record<string, unknown>> = ReturnType<
  typeof drizzle<TSchema>
>;
