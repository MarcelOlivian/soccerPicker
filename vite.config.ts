import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base path is only switched to the repo-scoped path when explicitly building
// for GitHub Pages (see .github/workflows/deploy.yml). Local dev, preview,
// and vitest all keep serving from '/'.
export default defineConfig({
  plugins: [react()],
  base: process.env.GH_PAGES ? '/soccerPicker/' : '/',
})
