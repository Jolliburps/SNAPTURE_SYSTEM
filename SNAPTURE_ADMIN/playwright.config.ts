import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests', workers: 1, timeout: 120000, reporter: 'list',
  use: { channel: 'chrome', baseURL: 'http://127.0.0.1:5174', viewport: { width: 1440, height: 960 }, trace: 'retain-on-failure' },
  webServer: [
    { command: '.venv\\Scripts\\python.exe server/manage.py runserver 127.0.0.1:8001 --noreload --settings=admin_config.e2e_settings', url: 'http://127.0.0.1:8001/api/cesd/csrf/', reuseExistingServer: false, timeout: 60000 },
    { command: 'npm run dev -- --port 5174', env: { SNAPTURE_API_PROXY: 'http://127.0.0.1:8001' }, url: 'http://127.0.0.1:5174', reuseExistingServer: false, timeout: 30000 },
  ],
})
