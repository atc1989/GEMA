/**
 * PostgREST schema for GEMA tables and RPCs.
 *
 * After the public → gema move, every `.from(...)` / `.rpc(...)` call goes
 * through this schema via `db: { schema: GEMA_DB_SCHEMA }` on the clients.
 * Auth (`supabase.auth.*`) is unaffected — it still uses the Auth API.
 */
export const GEMA_DB_SCHEMA = "gema" as const;
