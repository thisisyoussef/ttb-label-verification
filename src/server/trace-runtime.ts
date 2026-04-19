type TraceableOptions<TInput, TOutput> = {
  name?: string;
  run_type?: string;
  processInputs?: (input: TInput) => unknown;
  processOutputs?: (output: TOutput) => unknown;
  tags?: string[];
};

type LocalRunTree = {
  name: string;
  runType?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
};

const runTreeStack: LocalRunTree[] = [];

export function getCurrentRunTree(_createIfMissing = false) {
  return runTreeStack.at(-1) ?? null;
}

export function traceable<TInput, TOutput>(
  fn: (input: TInput) => Promise<TOutput> | TOutput,
  options?: TraceableOptions<TInput, TOutput>
) {
  return async (input: TInput): Promise<TOutput> => {
    const runTree: LocalRunTree = {
      name: (options?.name ?? fn.name) ?? 'traceable',
      runType: options?.run_type,
      metadata: {},
      tags: [...(options?.tags ?? [])]
    };

    runTreeStack.push(runTree);

    try {
      options?.processInputs?.(input);
      const output = await fn(input);
      options?.processOutputs?.(output);
      return output;
    } finally {
      runTreeStack.pop();
    }
  };
}
