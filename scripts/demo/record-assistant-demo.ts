import fs from 'node:fs/promises';
import path from 'node:path';
import {
  createNarrationText,
  formatRunTs,
  getDemoConfig
} from './recordAssistantDemoConfig';
import { runRecordedDemo } from './recordAssistantDemoBrowser';
import {
  muxNarratedVideo,
  synthesizeNarration,
  transcodeRawVideo,
  writeSummaryFile
} from './recordAssistantDemoMedia';

async function run() {
  const config = getDemoConfig();
  const runId = formatRunTs();
  const rawDir = path.join(config.outputDir, 'raw');
  await fs.mkdir(rawDir, { recursive: true });

  const scriptPath = path.join(
    config.outputDir,
    `ttb-assistant-demo-script-${runId}.txt`
  );
  const audioExtension = config.ttsProvider === 'elevenlabs' ? 'mp3' : 'aiff';
  const audioPath = path.join(
    config.outputDir,
    `ttb-assistant-demo-narration-${runId}.${audioExtension}`
  );
  const videoPath = path.join(
    config.outputDir,
    `ttb-label-verification-demo-${runId}.mp4`
  );
  const narratedPath = path.join(
    config.outputDir,
    `ttb-label-verification-demo-${runId}-narrated.mp4`
  );
  const summaryPath = path.join(
    config.outputDir,
    `ttb-label-verification-demo-${runId}.json`
  );
  await fs.writeFile(scriptPath, createNarrationText(), 'utf8');

  const { rawVideoPath } = await runRecordedDemo(config, rawDir);
  await synthesizeNarration(config, scriptPath, audioPath);
  transcodeRawVideo(rawVideoPath, videoPath);
  muxNarratedVideo(rawVideoPath, audioPath, narratedPath);

  await writeSummaryFile(summaryPath, {
    baseUrl: config.baseUrl,
    ttsProvider: config.ttsProvider,
    rawVideoPath,
    scriptPath,
    audioPath,
    videoPath,
    narratedPath
  });

  console.log(`RAW_VIDEO=${rawVideoPath}`);
  console.log(`SCRIPT_FILE=${scriptPath}`);
  console.log(`NARRATION_AUDIO=${audioPath}`);
  console.log(`FINAL_VIDEO=${videoPath}`);
  console.log(`FINAL_VIDEO_WITH_NARRATION=${narratedPath}`);
  console.log(`SUMMARY_FILE=${summaryPath}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
