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
    "Welcome. In this walkthrough, I'm using the TTB Label Verification Assistant the way a real reviewer would use it, and I am also calling out the engineering choices that matter for the take-home brief.",
    "The brief is not just asking for AI output. It is asking for correctness, completeness, code quality, user experience, attention to hidden requirements, and good judgment under time pressure. This prototype is built to make those choices inspectable.",
    "I start on the mock Treasury sign-in screen. That keeps the prototype grounded in the real workflow without pretending this is already integrated into a live federal identity stack. It makes the demo feel operational, but it stays honest about scope.",
    "Once I'm in, the first thing to notice is that the primary reviewer flow stays simple. The app is designed for people across the team's comfort range, from experienced reviewers who want to move quickly to newer reviewers who need a clear checklist and explicit evidence.",
    "I open the Toolbench in the lower right. This is the built-in evaluator surface. It exists for the submission and for internal QA. It lets me load realistic samples, jump between single and batch review, inspect API health, and switch extraction modes without cluttering the normal reviewer experience.",
    "In Actions, extraction mode matters. For this demo I am staying on the cloud path because it is the fastest path, but the same typed contract also supports local extraction. That local mode matters because the stakeholder interviews explicitly called out government firewalls and environments where outbound cloud calls may be blocked or disallowed.",
    "Now I load Simply Elegant. This is not a toy lorem ipsum label. It is grounded in the same kind of COLA-style data the system is built to compare: brand, class or type, alcohol content, net contents, applicant identity, and warning text.",
    "That sample loading path also reflects how the repo was evaluated. The project keeps a checked-in GoldenSet, a live image-backed core subset, and COLA Cloud-backed corpus builders so the system can be tested against something broader than a single happy-path screenshot.",
    "The intake screen stays intentionally plain. The label is on one side, the declared application values are on the other, and the primary action is obvious. The UI supports one or two images because in real label review, the warning, importer statement, or origin evidence may live on a second panel.",
    "When I click Verify Label, the processing view responds immediately. That is a deliberate latency decision. We treat latency as both an engineering problem and a perception problem. Even if extraction takes a few seconds, the reviewer should never stare at a dead screen wondering whether the system hung.",
    "On this branch, the cleanest measured single-label trace landed around 4.36 seconds total, and about 4.35 of that was provider wait time. A broader 28-label production-style run averaged about 5.2 seconds. Those are the numbers we document, instead of hard-coding a fake budget field into the response payload and hoping nobody notices the mismatch.",
    "Now the report is back. The banner gives me the top-line outcome fast, and the rows are ordered so the riskiest or least certain items appear first. An experienced reviewer can skim. A newer reviewer can open rows and follow the evidence in a structured way.",
    "Each row is evidence-first. You see what the application declared, what the label says, and how the comparison landed. This is one of the most important architectural boundaries in the project: the models extract structured facts, but deterministic TypeScript rules decide the result. AI extracts. Rules judge.",
    "That tradeoff matters because it is what keeps the system trustworthy. If extraction is uncertain, the field stays in review. If the warning text is weak, the system stays conservative. It does not quietly turn uncertainty into a pass just to look impressive in a demo.",
    "The government warning path is a good example of that discipline. The warning statement is not treated as a fuzzy vibe check. The validator breaks it into subchecks for presence, exact text, uppercase-and-bold heading, continuous paragraph, and legibility. That is the kind of detail that shows attention to the brief and to the real compliance workflow.",
    "There is also a refine pass behind the scenes for review-heavy cases. The refine endpoint only takes another pass on bounded rows after the first answer is already on screen. That is another tradeoff decision: better evidence when it helps, but not at the cost of delaying the first useful result.",
    "At this point I can export the result, and I will start a second review using the Warning Text Errors preset. This gives me a stable warning-heavy case where the system should surface review instead of over-claiming confidence.",
    "Here the trust model is easier to see. I can open the evidence rows, inspect exactly what was compared, and understand why the field stayed in review. The product is trying to make human judgment faster, not hide judgment behind a confidence score and a colored badge.",
    "Behind the UI, the repo is organized the same way the runtime is organized: shallow, inspectable seams. Server code is grouped by concern instead of thrown into one flat layer. Scripts are grouped by job. Shared contracts sit between client and server. That cleanup matters in a submission because reviewers do read the code, and the code should tell the same story as the product.",
    "The development process was equally deliberate. Story packets define the scope. Contracts and validators are built test-first. Prompt and model changes follow trace-driven development. The current branch verifies with 99 test files and 579 tests, plus typecheck, build, source-size guardrails, and GoldenSet eval coverage.",
    "Now I switch to batch mode. This is for the reviewer who gets a large importer drop and needs to work through a queue instead of checking one label at a time. The product brief called that out explicitly, and it is not just a wrapper around single review.",
    "For the walkthrough, I use the Toolbench batch loader. Intake fills immediately, but it still pauses on matching review first. I can see image counts, CSV row counts, and whether anything is ambiguous before the batch spends model time.",
    "That matching check is important. The CSV is the application side of the comparison, with columns like filename, brand name, class or type, alcohol content, net contents, origin, and applicant details. The images are the label side. Intake makes sure those pairs are credible before review begins.",
    "Once I start the batch, the processing screen streams results as items finish. This tackles perceived latency and real latency together. Clean labels clear quickly, while slower labels usually need another look because the text is weak, ambiguous, split across images, or blocked by warning complexity.",
    "When the run finishes, the dashboard becomes the triage surface. I can sort, filter to needs-review only, open a row, and move label to label with Previous and Next while keeping the same context. That design is about throughput, not visual flair.",
    "Inside the row drill-in, I get the same evidence language as single review. Then I can export the batch and start another one right away. Nothing is persisted server-side. OpenAI calls use the Responses API with store set to false. Local mode remains available when the deployment boundary matters more than speed.",
    "So the story of the prototype is straightforward. It meets the explicit requirements, surfaces the hidden ones, and is honest about tradeoffs. Cloud mode is faster. Local mode is more deployable in restricted environments. Deterministic validators keep the compliance boundary auditable. The UI is simple enough to trust quickly, and the repo carries the evidence needed to defend the decisions behind it."
  ].join('\n\n');
}

export function clamp01(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value));
}
