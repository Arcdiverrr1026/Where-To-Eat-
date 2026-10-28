import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
let existing = "";
try {
  existing = await readFile(".env", "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const defaults = {
  POSTGRES_PASSWORD: randomBytes(24).toString("hex"),
  DEMO_USERNAME: "demo",
  DEMO_PASSWORD: "eat-together-2026",
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD: randomBytes(24).toString("hex"),
  APP_ORIGIN: "http://localhost:8080",
  WEB_PORT: "8080",
  AMAP_API_KEY: "",
};
const additions = Object.entries(defaults)
  .filter(([key]) => !new RegExp(`^${key}=`, "m").test(existing))
  .map(([key, value]) => `${key}=${value}`);
if (additions.length)
  await writeFile(
    ".env",
    `${existing}${existing && !existing.endsWith("\n") ? "\n" : ""}${additions.join("\n")}\n`,
    { mode: 0o600 },
  );
console.log(
  "Local .env ready. Existing settings preserved. Admin password stays in .env.",
);
