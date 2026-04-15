import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const labelsDir = path.resolve(__dirname, 'evals/labels/assets');

function toolbenchLabelsPlugin(): PluginOption {
<<<<<<< HEAD
  const handler = (
    req: { url?: string },
    res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (data: Buffer) => void },
    next: () => void
  ) => {
=======
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = (req: any, res: any, next: any) => {
>>>>>>> c8548a1 (fix(TTB-000): surface JSON parse error detail in PasteFromJson feedback)
    const prefix = '/toolbench/labels/';
    if (!req.url?.startsWith(prefix)) return next();
    const filename = req.url.slice(prefix.length);
    if (!filename || filename.includes('..')) return next();
    const filePath = path.join(labelsDir, filename);
    try {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' });
      res.end(data);
    } catch {
      next();
    }
  };

  return {
    name: 'toolbench-labels',
    configureServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [react(), toolbenchLabelsPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5176,
    proxy: {
      '/api': 'http://localhost:8787'
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 4176
  }
});
