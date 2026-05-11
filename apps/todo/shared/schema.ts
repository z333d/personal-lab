/**
 * Drizzle schema for the todo app's D1 database.
 *
 * Auth tables (user/session/account/verification) are reused from @lab/lib;
 * todo-specific tables are added here. The combined `schema` export is what
 * the build script and runtime helpers look for.
 */
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { authSchema } from '@lab/lib/auth-schema';

// Re-export the auth tables so Drizzle's introspection sees them as part of
// this app's schema.
export const { user, session, account, verification } = authSchema;

// ────────── Business tables ──────────
export const todos = sqliteTable('todos', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// REQUIRED: build script and runtime expect this exact name.
export const schema = { user, session, account, verification, todos };
