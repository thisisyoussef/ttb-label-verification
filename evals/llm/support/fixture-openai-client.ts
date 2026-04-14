import { traceable } from 'langsmith/traceable';

import {
  REVIEW_EXTRACTION_GUARDRAIL_POLICY,
  REVIEW_EXTRACTION_PROMPT_PROFILE,
  REVIEW_EXTRACTION_PROVIDER
} from '../../../src/server/llm-policy';
import type { RawReviewModelOutput } from '../../../src/server/testing/llm-fixture-builders';

type FixtureParseRequest = {
  model?: string;
  store?: boolean | null;
  input?: Array<{
    content?: Array<
      | {
          type?: string;
          image_url?: string;
          file_data?: string;
          filename?: string;
        }
      | string
    >;
  }>;
};

type FixtureParseStep =
  | {
      type: 'output';
      output: RawReviewModelOutput;
    }
  | {
      type: 'error';
      error: Error;
    };

export type FixtureOpenAIResponseScript = {
  fixtureId: string;
  byteSignature: string;
  steps: FixtureParseStep[];
};

function extractByteSignature(request: FixtureParseRequest) {
  const firstMessage = request.input?.[0];
  const content = Array.isArray(firstMessage?.content) ? firstMessage.content : [];
  const mediaPart = content.find(
    (part): part is Exclude<(typeof content)[number], string> =>
      typeof part !== 'string' &&
      (part?.type === 'input_image' || part?.type === 'input_file')
  );
  const dataUrl = mediaPart?.image_url ?? mediaPart?.file_data;

  if (!dataUrl) {
    throw new Error('Fixture parse request is missing media data.');
  }

  const [, base64Payload = ''] = dataUrl.split(',', 2);
  const bytes = Buffer.from(base64Payload, 'base64');

  return bytes.toString('hex');
}

function summarizeOutput(output: RawReviewModelOutput) {
  const presentFieldIds = Object.entries(output.fields)
    .filter(([fieldId, value]) => {
      if (Array.isArray(value)) {
        return fieldId === 'varietals' && value.length > 0;
      }

      return value.present;
    })
    .map(([fieldId]) => fieldId)
    .sort();

  return {
    beverageTypeHint: output.beverageTypeHint ?? 'unknown',
    imageQualityScore: output.imageQuality.score,
    imageIssueCount: output.imageQuality.issues.length,
    presentFieldIds,
    warningSignals: {
      prefixAllCaps: output.warningSignals.prefixAllCaps.status,
      prefixBold: output.warningSignals.prefixBold.status,
      continuousParagraph: output.warningSignals.continuousParagraph.status,
      separateFromOtherContent:
        output.warningSignals.separateFromOtherContent.status
    }
  };
}

export function createFixtureOpenAIClient(
  scripts: FixtureOpenAIResponseScript[]
) {
  const scriptsBySignature = new Map(
    scripts.map((script) => [
      script.byteSignature,
      {
        fixtureId: script.fixtureId,
        steps: [...script.steps]
      }
    ])
  );

  const tracedParse = traceable(
    async (request: FixtureParseRequest) => {
      const byteSignature = extractByteSignature(request);
      const script = scriptsBySignature.get(byteSignature);

      if (!script) {
        throw new Error(
          `No fixture response script was registered for byte signature ${byteSignature}.`
        );
      }

      const step =
        script.steps.length > 1 ? script.steps.shift() : script.steps[0];

      if (!step) {
        throw new Error(
          `Fixture response script ${script.fixtureId} has no remaining steps.`
        );
      }

      if (step.type === 'error') {
        throw step.error;
      }

      return {
        output_parsed: step.output
      };
    },
    {
      name: 'ttb.fixture_openai.responses.parse',
      run_type: 'llm',
      processInputs: (request) => {
        const byteSignature = extractByteSignature(request);
        const script = scriptsBySignature.get(byteSignature);

        return {
          provider: REVIEW_EXTRACTION_PROVIDER,
          promptProfile: REVIEW_EXTRACTION_PROMPT_PROFILE,
          guardrailPolicy: REVIEW_EXTRACTION_GUARDRAIL_POLICY,
          model: request.model,
          store: request.store,
          fixtureId: script?.fixtureId ?? 'unknown-fixture',
          byteSignature,
          noPersistence: true
        };
      },
      processOutputs: (response) => {
        const output = response.output_parsed as RawReviewModelOutput | undefined;

        return output
          ? {
              noPersistence: true,
              ...summarizeOutput(output)
            }
          : { noPersistence: true, missingOutput: true };
      },
      tags: ['ttb', 'llm', 'fixture-openai', 'privacy-safe']
    }
  );

  return {
    parse: tracedParse as (request: FixtureParseRequest) => Promise<{
      output_parsed?: unknown;
    }>
  };
}
