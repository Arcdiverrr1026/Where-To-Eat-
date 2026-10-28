import { readFile } from "node:fs/promises";
import { pool } from "./db.js";
import { hashPassword } from "./auth.js";
import { config } from "./config.js";
export const initialize = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(728419)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const { rowCount } = await client.query(
      "SELECT name FROM schema_migrations WHERE name='001-initial'",
    );
    if (!rowCount) {
      await client.query(
        await readFile(
          new URL("../sql/001-initial.sql", import.meta.url),
          "utf8",
        ),
      );
      await client.query(
        "INSERT INTO schema_migrations(name) VALUES('001-initial')",
      );
    }
    const accounts = [
      [config.demoUsername, process.env.DEMO_PASSWORD, "user"],
      [
        process.env.ADMIN_USERNAME || "admin",
        process.env.ADMIN_PASSWORD,
        "admin",
      ],
    ];
    if (accounts[0][0] === accounts[1][0])
      throw new Error("Demo and admin usernames must differ");
    for (const [username, password, role] of accounts) {
      const existing = await client.query(
        "SELECT id FROM users WHERE username=$1",
        [username],
      );
      if (!existing.rowCount) {
        if (!password || password.length < 10)
          throw new Error(
            "Run npm run setup first: account passwords must be at least 10 characters",
          );
        await client.query(
          "INSERT INTO users(username,password_hash,role) VALUES($1,$2,$3)",
          [username, await hashPassword(password), role],
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
if (process.argv[1]?.endsWith("init-db.js")) {
  try {
    await initialize();
    console.log(
      "Database schema and accounts ready (existing accounts preserved).",
    );
  } finally {
    await pool.end();
  }
}
