export const config = {
  port: Number(process.env.PORT || 3001),
  databaseUrl:
    process.env.DATABASE_URL ||
    `postgres://wte:${encodeURIComponent(process.env.POSTGRES_PASSWORD || "wte")}@localhost:5433/where_to_eat`,
  cookiePath: process.env.COOKIE_PATH || "/",
  origin: process.env.APP_ORIGIN || "http://localhost:8080",
  amapKey: process.env.AMAP_API_KEY?.trim() || "",
  amapBaseUrl: process.env.AMAP_BASE_URL || "https://restapi.amap.com",
  mapTimeout: Number(process.env.MAP_TIMEOUT_MS || 5000),
  demoUsername: process.env.DEMO_USERNAME || "demo",
};
