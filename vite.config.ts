import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { harnessBridge } from './server/bridge';

// Bindery — local-first 집필 하네스.
// dev 서버가 harnessBridge 미들웨어로 로컬 파일/에이전트 CLI 접근을 제공한다.
// (패키징 단계에서 Tauri adapter로 교체 가능하도록 브리지 인터페이스는 분리되어 있다.)
export default defineConfig({
  plugins: [svelte(), harnessBridge()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@codemirror/view/')) return 'codemirror-view';
          if (id.includes('/node_modules/@codemirror/state/')) return 'codemirror-state';
          if (id.includes('/node_modules/@codemirror/commands/')) return 'codemirror-commands';
          if (id.includes('/node_modules/@codemirror/')) return 'codemirror-language';
          if (id.includes('/node_modules/@lezer/')) return 'lezer';
          return undefined;
        }
      }
    }
  },
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      $prompts: fileURLToPath(new URL('./prompts', import.meta.url))
    }
  },
  server: { port: 5199 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node'
  }
});
