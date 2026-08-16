import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from the custom domain's root (squadref.online), not a
// /soccerPicker/ subpath, so the base stays '/' everywhere — dev, preview,
// vitest, and the GitHub Pages build alike.
export default defineConfig({
  plugins: [react()],
  base: '/',
})
