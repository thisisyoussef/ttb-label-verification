import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { clamp01, type DemoConfig } from './recordAssistantDemoConfig';

function runCommand(binary: string, args: string[], label: string) {
  const result = spawnSync(binary, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.status !== 0) {
    throw new Error(
      `${label} failed.\n` +
        `command: ${binary} ${args.join(' ')}\n` +
        `stdout:\n${result.stdout}\n` +
        `stderr:\n${result.stderr}`
    );
  }
}

function synthesizeNarrationWithSystemVoice(
  config: DemoConfig,
  scriptPath: string,
  audioPath: string
) {
  try {
    runCommand(
      'say',
      [
        '-v',
        config.systemVoice.voice,
        '-r',
        String(config.systemVoice.rate),
        '-f',
        scriptPath,
        '-o',
        audioPath
      ],
      'Narration synthesis'
    );
  } catch (error) {
    runCommand(
      'say',
      ['-r', String(config.systemVoice.rate), '-f', scriptPath, '-o', audioPath],
      `Narration synthesis fallback after ${String(error)}`
    );
  }
}

async function synthesizeNarrationWithElevenLabs(
  config: DemoConfig,
  scriptPath: string,
  audioPath: string
) {
  if (!config.elevenlabs.apiKey) {
    throw new Error(
      'DEMO_TTS_PROVIDER is set to elevenlabs, but ELEVENLABS_API_KEY is missing.'
    );
  }

  const text = (await fs.readFile(scriptPath, 'utf8')).trim();
  const endpoint = new URL(
    `${config.elevenlabs.apiBase.replace(/\/$/, '')}/text-to-speech/${config.elevenlabs.voiceId}`
  );
  endpoint.searchParams.set('output_format', config.elevenlabs.outputFormat);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': config.elevenlabs.apiKey,
      Accept: 'audio/mpeg'
    },
    body: JSON.stringify({
      text,
      model_id: config.elevenlabs.modelId,
      voice_settings: {
        stability: clamp01(config.elevenlabs.stability, 0.45),
        similarity_boost: clamp01(config.elevenlabs.similarityBoost, 0.8),
        style: clamp01(config.elevenlabs.style, 0.2),
        speed: Number.isFinite(config.elevenlabs.speed)
          ? config.elevenlabs.speed
          : 0.92,
        use_speaker_boost: config.elevenlabs.useSpeakerBoost
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `ElevenLabs narration synthesis failed with ${response.status} ${response.statusText}.\n${errorText}`
    );
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(audioPath, audioBuffer);
}

export async function synthesizeNarration(
  config: DemoConfig,
  scriptPath: string,
  audioPath: string
) {
  if (config.ttsProvider === 'elevenlabs') {
    await synthesizeNarrationWithElevenLabs(config, scriptPath, audioPath);
    return;
  }

  synthesizeNarrationWithSystemVoice(config, scriptPath, audioPath);
}

export function transcodeRawVideo(rawVideoPath: string, videoPath: string) {
  runCommand(
    'ffmpeg',
    [
      '-y',
      '-i',
      rawVideoPath,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-an',
      videoPath
    ],
    'Raw video transcode'
  );
}

export function muxNarratedVideo(
  rawVideoPath: string,
  audioPath: string,
  narratedPath: string
) {
  runCommand(
    'ffmpeg',
    [
      '-y',
      '-i',
      rawVideoPath,
      '-i',
      audioPath,
      '-vf',
      'tpad=stop_mode=clone:stop_duration=120,format=yuv420p',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      '-shortest',
      narratedPath
    ],
    'Narrated video mux'
  );
}

export async function writeSummaryFile(
  summaryPath: string,
  details: Record<string, string>
) {
  await fs.writeFile(summaryPath, JSON.stringify(details, null, 2), 'utf8');
}
