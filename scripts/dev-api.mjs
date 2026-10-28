// Keep the same container database while running Express with Node's watch mode.
process.env.DATABASE_URL ||= `postgres://wte:${encodeURIComponent(process.env.POSTGRES_PASSWORD || "")}@localhost:5433/where_to_eat`;
process.env.APP_ORIGIN = "http://localhost:5173";
await import("../backend/src/server.js");
