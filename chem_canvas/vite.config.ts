import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
    // Pre-bundle these to avoid AMD/UMD conflicts at runtime
    include: ['dagre', 'reactflow', 'es6-promise-pool', '@excalidraw/excalidraw']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'os': path.resolve(__dirname, 'src/shims/os.ts')
    }
  },
  server: {
    port: 1755,
    strictPort: true,
    host: '0.0.0.0',
    proxy: {}
  },
});
