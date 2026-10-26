// Runs a SQL file against the Supabase database from .env.local.
// pg is deliberately not an app dependency: install it anywhere and point PG_DIR at it.
// Usage: PG_DIR=/path/with/node_modules node scripts/db.mjs supabase/schema.sql
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

process.loadEnvFile(".env.local");
const { Client } = createRequire(`${process.env.PG_DIR}/`)("pg");
const url = new URL(process.env.POSTGRES_URL_NON_POOLING);
url.searchParams.delete("sslmode"); // pg's sslmode=require now means verify-full; Supabase's cert chain needs no-verify
const db = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
await db.connect();
const res = await db.query(readFileSync(process.argv[2], "utf8"));
console.log([res].flat().map((r) => r.command).join(", "));
await db.end();
