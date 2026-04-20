import path from 'node:path';
import { loadLocalEnv } from '../../src/server/load-local-env';

loadLocalEnv();

export interface DemoConfig {
  baseUrl: string;
  outputDir: string;
  ttsProvider: string;
  systemVoice: {
    voice: string;
    rate: number;
  };
  elevenlabs: {
    apiBase: string;
    apiKey: string;
    voiceId: string;
    modelId: string;
    outputFormat: string;
    stability: number;
    similarityBoost: number;
    style: number;
    speed: number;
    useSpeakerBoost: boolean;
  };
  waits: {
    boot: number;
    short: number;
    step: number;
    medium: number;
    long: number;
    veryLong: number;
    retry: number;
  };
}

export function getDemoConfig(): DemoConfig {
  return {
    baseUrl: process.env.DEMO_BASE_URL ?? 'http://localhost:5176',
    outputDir: path.resolve(
      process.cwd(),
      process.env.DEMO_OUTPUT_DIR ?? 'output/demo'
    ),
    ttsProvider: (
      process.env.DEMO_TTS_PROVIDER ??
      (process.env.ELEVENLABS_API_KEY?.trim() ? 'elevenlabs' : 'system')
    )
      .trim()
      .toLowerCase(),
    systemVoice: {
      voice: process.env.DEMO_VOICE ?? 'Samantha',
      rate: Number(process.env.DEMO_RATE ?? '152')
    },
    elevenlabs: {
      apiBase:
        process.env.ELEVENLABS_API_BASE?.trim() ||
        'https://api.elevenlabs.io/v1',
      apiKey: process.env.ELEVENLABS_API_KEY?.trim() || '',
      voiceId:
        process.env.ELEVENLABS_VOICE_ID?.trim() || 'JBFqnCBsd6RMkjVDRZzb',
      modelId:
        process.env.ELEVENLABS_MODEL_ID?.trim() || 'eleven_multilingual_v2',
      outputFormat:
        process.env.ELEVENLABS_OUTPUT_FORMAT?.trim() || 'mp3_44100_128',
      stability: Number(process.env.ELEVENLABS_STABILITY ?? '0.45'),
      similarityBoost: Number(process.env.ELEVENLABS_SIMILARITY_BOOST ?? '0.8'),
      style: Number(process.env.ELEVENLABS_STYLE ?? '0.2'),
      speed: Number(process.env.ELEVENLABS_SPEED ?? '0.92'),
      useSpeakerBoost:
        (process.env.ELEVENLABS_USE_SPEAKER_BOOST ?? 'true')
          .trim()
          .toLowerCase() !== 'false'
    },
    waits: {
      boot: 4500,
      short: 1200,
      step: 2800,
      medium: 4600,
      long: 6400,
      veryLong: 8200,
      retry: 12000
    }
  };
}

export function formatRunTs() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '_');
}

export function createNarrationText() {
  return [
    "Welcome. In this walkthrough, I'm using the TTB Label Verification Assistant the same way a reviewer would actually use it.",
    "I start on the mock Treasury sign-in screen. It keeps the prototype grounded in the real workflow without pretending this is already wired into a live federal system.",
    "Once I'm in, I open the Toolbench. This is the built-in evaluator surface. It lets us load realistic labels, jump between scenarios, and inspect controls without cluttering the everyday reviewer experience.",
    "In Actions, extraction mode matters. I'm keeping this run on the cloud path so the demo stays fast, but the same contract can point to a local model instead. That gives the TTB a path to stay inside a restricted network boundary and avoid cloud calls when needed.",
    "Now I load Simply Elegant, a clean sample grounded in real COLA-style data. The toolbench fills both the label image and the declared application values together, so I can move straight into review.",
    "The intake screen stays intentionally simple. The label is on one side, the declared values are on the other, and the primary action is obvious. It also supports one or two images, so front and back label evidence can stay together when a warning or origin statement lives on a separate panel.",
    "When I click Verify Label, the app responds right away with a processing view. That is a deliberate latency decision. Even if extraction takes a few seconds, the reviewer sees motion immediately instead of a dead screen.",
    "Now the report is back. The banner gives me the top-line outcome fast, and the field rows are ordered so the riskiest or least certain items appear first. A veteran reviewer can skim quickly. A newer reviewer can open the rows and follow the evidence.",
    "Each row is evidence-first: what the application declared, what the label says, and how the comparison landed. If the system is uncertain, it stays conservative and pushes the field into review instead of quietly turning uncertainty into a pass.",
    "There's also a refinement step behind the scenes for review-heavy cases. The refine endpoint only takes another pass on bounded problem rows. It can improve extraction, but it still does not get to decide compliance. Deterministic validators keep that boundary intact.",
    "I'll export this result, then start a second review using the Warning Text Errors preset. This gives me a stable warning-heavy case where the system should surface review instead of over-claiming confidence.",
    "Here the trust model is easier to see. I can open the evidence rows, inspect exactly what was compared, and understand why the label was pushed to review. The product is trying to make judgment faster, not hide judgment behind a score.",
    "Now I switch to batch mode. This is for the reviewer who gets a large importer drop and needs to work through a queue instead of checking one label at a time.",
    "For the walkthrough, I use the Toolbench batch loader. The intake fills immediately, but it still pauses on matching review first. I can see image counts, CSV row counts, and whether anything is ambiguous before the batch spends model time.",
    "That matching check is important. The CSV is the application side of the comparison, with columns like filename, brand name, class or type, alcohol content, net contents, origin, and applicant details. The images are the label side. Intake makes sure those pairs are credible before review begins.",
    "Once I start the batch, the processing screen streams results as items finish. This handles perceived latency and real latency at the same time. Clean labels clear quickly, while slower labels usually need another look because the text is weak, ambiguous, or split across fields.",
    "When the run finishes, the dashboard becomes the triage surface. I can sort, filter to needs-review only, open a row, and move label to label with Previous and Next while keeping the same context.",
    "Inside the row drill-in, I get the same evidence language as single review. Then I can export the batch and start another one right away. Nothing is persisted server-side. The architecture stays model-agnostic, deterministic where it matters, and fast enough that reviewers keep using it instead of falling back to manual checks."
  ].join('\n\n');
}

export function clamp01(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value));
}
