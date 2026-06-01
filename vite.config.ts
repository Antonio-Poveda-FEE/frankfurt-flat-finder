import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Relative base ('./') + HashRouter means the app works under any GitHub Pages
// subpath (e.g. username.github.io/frankfurt-flat-finder/) without rebuilding.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
