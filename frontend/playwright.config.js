import { defineConfig } from '@playwright/test';
import { tmpdir } from 'node:os';
import path from 'node:path';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:8012', viewport: { width: 1440, height: 1000 }, actionTimeout: 10000, trace: 'retain-on-failure' },
  webServer: {
    command: `${path.resolve('../.venv/bin/python')} -m uvicorn app.main:app --app-dir .. --host 127.0.0.1 --port 8012`,
    url: 'http://127.0.0.1:8012/health',
    reuseExistingServer: false,
    env: {
      SQLITE_PATH: path.join(tmpdir(), `wte-private-e2e-${process.pid}.db`),
      AMAP_API_KEY: '', AMAP_JS_API_KEY: '', AMAP_SECURITY_JS_CODE: '',
      USE_MOCK_FALLBACK: 'false', RECOMMENDATION_PREWARM_ENABLED: 'false',
      ADMIN_TOKEN: 'e2e-legacy-only',
    },
  },
});
