export interface Exiter {
  exit: (code: number) => never;
}

export interface RunnerInputs {
  githubToken: string;
  llm: string;
  model: string;
  apiKey: string;
  owner: string;
  repo: string;
  pullNumber: number;
  maxTokens?: number;
  lookbackCommits?: number;
  projectContext?: string;
  debug?: boolean;
  [key: string]: unknown;
}

type WorkflowFunction = (inputs: RunnerInputs) => Promise<unknown>;

const defaultExiter: Exiter = { exit: (code) => process.exit(code) };

export interface CreateRunnerOptions {
  requiredEnvVars?: string[];
  validate?: (inputs: RunnerInputs) => { success: boolean; error?: { message: string } };
  exiter?: Exiter;
}

export function createRunner(workflowFn: WorkflowFunction, options: CreateRunnerOptions = {}) {
  const exiter = options.exiter ?? defaultExiter;
  return {
    run: async () => {
      const baseRequired: Record<string, string | undefined> = {
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
        LLM: process.env.LLM,
        MODEL: process.env.MODEL,
        API_KEY: process.env.API_KEY,
        GITHUB_REPOSITORY_OWNER: process.env.GITHUB_REPOSITORY_OWNER,
        GITHUB_REPOSITORY_NAME: process.env.GITHUB_REPOSITORY_NAME,
      };

      const missingVars = Object.entries(baseRequired)
        .filter(([, value]) => !value)
        .map(([key]) => key);

      if (options.requiredEnvVars) {
        for (const key of options.requiredEnvVars) {
          if (!process.env[key]) {
            missingVars.push(key);
          }
        }
      }

      if (missingVars.length > 0) {
        console.error('Missing required environment variables:');
        console.error(missingVars.join(', '));
        exiter.exit(1);
      }

      const inputs: RunnerInputs = {
        githubToken: process.env.GITHUB_TOKEN || '',
        llm: process.env.LLM || '',
        model: process.env.MODEL || '',
        apiKey: process.env.API_KEY || '',
        owner: process.env.GITHUB_REPOSITORY_OWNER || '',
        repo: process.env.GITHUB_REPOSITORY_NAME || '',
        pullNumber: parseInt(process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER || '0', 10),
        debug: process.env.DEBUG === 'true',
      };

      Object.keys(process.env).forEach(key => {
        if (key.startsWith('WORKFLOW_') || key === 'DOC_PATTERN' || key === 'PROJECT_CONTEXT' || key === 'MAX_TOKENS') {
          const camelKey = key.toLowerCase().replace(/([-_][a-z])/g, group =>
            group.toUpperCase().replace('-', '').replace('_', '')
          );
          inputs[camelKey] = process.env[key];
        }
      });

      if (process.env.MAX_TOKENS) {
        inputs.maxTokens = parseInt(process.env.MAX_TOKENS, 10);
      }
      if (process.env.LOOKBACK_COMMITS) {
        inputs.lookbackCommits = parseInt(process.env.LOOKBACK_COMMITS, 10);
      }

      if (options.validate) {
        const validation = options.validate(inputs);
        if (!validation.success) {
          console.error('Input validation failed:', validation.error?.message);
          exiter.exit(1);
        }
      }

      try {
        await workflowFn(inputs);
        exiter.exit(0);
      } catch (error) {
        console.error('Workflow failed:', error);
        exiter.exit(1);
      }
    }
  };
}
