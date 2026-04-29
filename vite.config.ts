import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: {
      // DM-Fox 代理：绕过 CORS 预检
      '/codex': {
        target: 'https://dm-fox.rjj.cc',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
