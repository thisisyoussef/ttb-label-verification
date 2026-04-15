import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import serveStatic from 'serve-static';

const labelsDir = path.resolve(__dirname, 'evals/labels/assets');

function toolbenchLabelsPlugin() {
  const middleware = serveStatic(labelsDir, { index: false });
  return {
    name: 'toolbench-labels',
    configureServer(server: {
      middlewares: { use: (path: string, handler: ReturnType<typeof serveStatic>) => void };
    }) {
      server.middlewares.use('/toolbench/labels', middleware);
    },
    configurePreviewServer(server: {
      middlewares: { use: (path: string, handler: ReturnType<typeof serveStatic>) => void };
    }) {
      server.middlewares.use('/toolbench/labels', middleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), toolbenchLabelsPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5176,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4176,
  },
});
