import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base path must match your GitHub repository name.
// e.g. if your repo is github.com/yourname/gtt-weaving, set base: '/gtt-weaving/'
// Update this before deploying to GitHub Pages.
// Update this to match your GitHub repo name before deploying, e.g. '/gtt-weaving/'
const base = '/gtt-weaving/'

export default defineConfig({
  plugins: [react()],
  base,
})
