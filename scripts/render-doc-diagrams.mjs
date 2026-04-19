import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(repoRoot, 'docs', 'diagrams', 'src');
const outputDir = path.join(repoRoot, 'docs', 'diagrams');
const mermaidInkBaseUrl = process.env.MERMAID_INK_BASE_URL ?? 'https://mermaid.ink';

const initConfig = {
  theme: 'base',
  themeVariables: {
    background: '#ffffff',
    primaryColor: '#eff6ff',
    primaryBorderColor: '#2563eb',
    primaryTextColor: '#0f172a',
    secondaryColor: '#f8fafc',
    tertiaryColor: '#ffffff',
    lineColor: '#475569',
    textColor: '#0f172a',
    clusterBkg: '#f8fafc',
    clusterBorder: '#cbd5e1',
    edgeLabelBackground: '#ffffff',
    actorBkg: '#eff6ff',
    actorBorder: '#2563eb',
    actorTextColor: '#0f172a',
    activationBkgColor: '#eff6ff',
    activationBorderColor: '#93c5fd',
    noteBkgColor: '#f8fafc',
    noteBorderColor: '#cbd5e1',
    noteTextColor: '#0f172a',
    signalColor: '#334155',
    signalTextColor: '#0f172a',
    labelBoxBkgColor: '#ffffff',
    labelBoxBorderColor: '#94a3b8',
    sequenceNumberColor: '#0f172a',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  flowchart: {
    curve: 'basis',
    htmlLabels: true,
    nodeSpacing: 35,
    rankSpacing: 50,
    padding: 18,
    useMaxWidth: true
  },
  sequence: {
    useMaxWidth: true,
    wrap: true,
    diagramMarginX: 30,
    diagramMarginY: 20,
    actorMargin: 40,
    messageMargin: 30
  }
};

function encodePayload(code) {
  const styledCode = `%%{init: ${JSON.stringify(initConfig)}}%%\n${code}`;
  const payload = JSON.stringify({ code: styledCode });
  return `pako:${deflateSync(Buffer.from(payload, 'utf8'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeSvg(svg) {
  return svg
    .replace(
    /<style xmlns="http:\/\/www\.w3\.org\/1999\/xhtml">@import url\("https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome\/[^"]+"\);<\/style>/u,
    ''
    )
    .replace(
      /#mermaid-svg\{([^}]*)\}/u,
      '#mermaid-svg{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;$1}'
    )
    .replace(
      /#mermaid-svg svg\{([^}]*)\}/u,
      '#mermaid-svg svg{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;$1}'
    )
    .replace(
      /#mermaid-svg p\{([^}]*)\}/u,
      '#mermaid-svg p{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;$1}'
    );
}

async function renderSvg(code) {
  const encoded = encodePayload(code);
  const url = new URL(`/svg/${encoded}`, mermaidInkBaseUrl);
  let lastError = null;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: 'image/svg+xml,text/plain;q=0.9,*/*;q=0.8'
      }
    });
    const body = await response.text();
    if (response.ok && body.includes('<svg')) {
      return sanitizeSvg(body);
    }
    lastError = new Error(
      `Mermaid Ink render failed on attempt ${attempt} (${response.status}): ${body.slice(0, 400)}`
    );
    if (attempt < 4) {
      await sleep(500 * attempt);
    }
  }

  throw lastError ?? new Error(`Mermaid Ink render failed for ${url}`);
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const entries = (await readdir(sourceDir)).filter((name) => name.endsWith('.mmd')).sort();
  if (entries.length === 0) {
    throw new Error(`No Mermaid source files found in ${sourceDir}`);
  }

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry);
    const outputPath = path.join(outputDir, entry.replace(/\.mmd$/u, '.svg'));
    const code = await readFile(sourcePath, 'utf8');
    const svg = await renderSvg(code);
    await writeFile(outputPath, svg, 'utf8');
    console.log(`rendered ${path.relative(repoRoot, outputPath)}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
