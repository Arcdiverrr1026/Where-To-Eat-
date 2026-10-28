import { config } from "./config.js";
import { pool } from "./db.js";
import { initialize } from "./init-db.js";
import { app } from "./app.js";
await initialize();
const server = app.listen(config.port, "0.0.0.0", () =>
  console.log(`Where To Eat Express API listening on ${config.port}`),
);
server.requestTimeout = 15000;
server.headersTimeout = 10000;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
