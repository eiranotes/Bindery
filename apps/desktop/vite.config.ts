import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  clearScreen: false,
  server: {
    strictPort: true,
    port: 5173,
    host: '127.0.0.1'
  }
});
