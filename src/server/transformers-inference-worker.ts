import { parentPort } from 'node:worker_threads';

type InferenceRequest = {
  id: string;
  prompt: string;
  imageBase64: string;
  imageMimeType: string;
  model: string;
  dtype: string;
  cacheDir: string;
};

type InferenceResponse =
  | { id: string; success: true; text: string }
  | { id: string; success: false; error: string };

let pipeline: any = null;

async function loadPipeline(request: InferenceRequest) {
  if (pipeline) return pipeline;

  const transformers = await import('@huggingface/transformers');

  transformers.env.cacheDir = request.cacheDir;

  if (process.env.NODE_ENV === 'production') {
    transformers.env.allowRemoteModels = false;
  }

  pipeline = await (transformers.pipeline as Function)(
    'image-text-to-text',
    request.model,
    { dtype: request.dtype }
  );

  return pipeline;
}

parentPort?.on('message', async (request: InferenceRequest) => {
  try {
    const pipe = await loadPipeline(request);

    const imageUrl = `data:${request.imageMimeType};base64,${request.imageBase64}`;

    const output = await pipe(
      {
        role: 'user',
        content: [
          { type: 'image', image: imageUrl },
          { type: 'text', text: request.prompt }
        ]
      },
      { max_new_tokens: 2048 }
    );

    const text =
      typeof output === 'string'
        ? output
        : Array.isArray(output)
          ? (output[0]?.generated_text?.at(-1)?.content ?? '')
          : '';

    parentPort?.postMessage({
      id: request.id,
      success: true,
      text
    } satisfies InferenceResponse);
  } catch (error) {
    parentPort?.postMessage({
      id: request.id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown inference error'
    } satisfies InferenceResponse);
  }
});
