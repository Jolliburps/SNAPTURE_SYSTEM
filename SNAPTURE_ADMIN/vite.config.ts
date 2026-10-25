import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Keep Django admin on this origin too: both panels share the authenticated
  // session, while Django continues enforcing its own model permissions.
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: Object.fromEntries(
    ['/api', '/admin', '/static', '/media', '/protected-media'].map(path => [path, process.env.SNAPTURE_API_PROXY || 'http://127.0.0.1:8000'])
  ) },
})
