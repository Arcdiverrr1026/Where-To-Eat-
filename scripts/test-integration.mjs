import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
const dockerArgs = ["compose", "-f", "compose.test.yaml"];
function docker(args) {
  const result = spawnSync("docker", [...dockerArgs, ...args], {
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("Test database command failed");
}
let simulation;
let exitCode = 1;
try {
  docker(["up", "-d", "--wait"]);
  simulation = spawn(
    "postman",
    [
      "simulation",
      "run",
      "postman/simulations/amap.sim.yaml",
      "--port",
      "4901",
      "--no-history",
      "--output",
      "ndjson",
    ],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  let log = "";
  let ready = false;
  simulation.stdout.on("data", (chunk) => {
    log += chunk;
    process.stdout.write(chunk);
    if (log.includes('"listening"')) ready = true;
  });
  simulation.on("error", (error) => console.error(error.message));
  const until = Date.now() + 45000;
  while (!ready && Date.now() < until && simulation.exitCode === null)
    await new Promise((resolve) => setTimeout(resolve, 200));
  if (!ready)
    throw new Error(
      "Postman simulation did not become ready. Install Postman CLI >= 1.70.",
    );
  const tests = spawn(
    process.execPath,
    ["--test", "tests/integration.test.js"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL:
          "postgres://wte_test:test-only-password@127.0.0.1:55439/where_to_eat_test",
        AMAP_API_KEY: "test-only-not-a-real-key",
        AMAP_BASE_URL: "http://127.0.0.1:4901/amap",
        MAP_TIMEOUT_MS: "300",
        APP_ORIGIN: "http://localhost:8080",
        DEMO_USERNAME: "demo",
        DEMO_PASSWORD: "test-demo-password",
        ADMIN_USERNAME: "admin",
        ADMIN_PASSWORD: "test-admin-password",
      },
    },
  );
  const [code] = await once(tests, "exit");
  exitCode = code ?? 1;
} catch (error) {
  console.error(error.message);
} finally {
  simulation?.kill("SIGINT");
  docker(["down"]);
}
process.exitCode = exitCode;
