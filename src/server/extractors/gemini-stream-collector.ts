export type GeminiGenerateContentResult = {
  text?: string;
  modelVersion?: string;
  sdkHttpResponse?: {
    headers?: Record<string, string>;
  };
  usageMetadata?: {
    promptTokenCount?: number;
    thoughtsTokenCount?: number;
  };
};

export async function collectGeminiStreamedResponse(
  streamPromise: Promise<AsyncGenerator<GeminiGenerateContentResult>>,
  onFieldProgress?: (field: { name: string; value: unknown }) => void
): Promise<GeminiGenerateContentResult> {
  const stream = await streamPromise;
  let combinedText = '';
  let modelVersion: string | undefined;
  let sdkHttpResponse: GeminiGenerateContentResult['sdkHttpResponse'];
  let usageMetadata: GeminiGenerateContentResult['usageMetadata'];
  const scanner = onFieldProgress
    ? (await import('./partial-json-field-scanner')).createFieldScanner()
    : null;

  for await (const chunk of stream) {
    if (typeof chunk.text === 'string' && chunk.text.length > 0) {
      combinedText += chunk.text;
      if (scanner && onFieldProgress) {
        for (const field of scanner.feed(chunk.text)) {
          try {
            onFieldProgress(field);
          } catch {
            // Best effort only; never block stream collection on UI progress.
          }
        }
      }
    }
    if (chunk.modelVersion && !modelVersion) {
      modelVersion = chunk.modelVersion;
    }
    if (chunk.sdkHttpResponse && !sdkHttpResponse) {
      sdkHttpResponse = chunk.sdkHttpResponse;
    }
    if (chunk.usageMetadata) {
      usageMetadata = chunk.usageMetadata;
    }
  }

  return {
    text: combinedText,
    modelVersion,
    sdkHttpResponse,
    usageMetadata
  };
}
