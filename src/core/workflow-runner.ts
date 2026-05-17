import { Logger } from './telemetry';

export interface RunnerInputs {
  githubToken: string;
  llm: string;
  model: string;
  apiKey: string;
  owner: string;
  repo: string;
  pullNumber: number;
  debug?: boolean;
  [key: string]: any;
}

type WorkflowFunction = (inputs: RunnerInputs) => Promise<any>;

/**
 * Creates a standardized runner for GitHub Action scripts.
 * Handles env validation and mapping.
 */
export function createRunner(workflowFn: WorkflowFunction) {
  return {
    run: async () => {
      const requiredEnvVars = {
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
        LLM: process.env.LLM,
        MODEL: process.env.MODEL,
        API_KEY: process.env.API_KEY,
        GITHUB_REPOSITORY_OWNER: process.env.GITHUB_REPOSITORY_OWNER,
        GITHUB_REPOSITORY_NAME: process.env.GITHUB_REPOSITORY_NAME,
        GITHUB_EVENT_PULL_REQUEST_NUMBER: process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER,
      };

      const missingVars = Object.entries(requiredEnvVars)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

      if (missingVars.length > 0) {
        console.error('Missing required environment variables:');
        console.error(missingVars.join(', '));
        process.exit(1);
      }

      // Map env vars to typed inputs
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

      // Dynamically add any other environment variables that start with WORKFLOW_
      // or match specific known optional patterns (like DOC_PATTERN)
      Object.keys(process.env).forEach(key => {
        if (key.startsWith('WORKFLOW_') || key === 'DOC_PATTERN' || key === 'PROJECT_CONTEXT' || key === 'MAX_TOKENS') {
          const normalizedKey = key.toLowerCase().replace(/_/g, '');
          // Simple normalization: DOC_PATTERN -> docPattern
          const camelKey = key.toLowerCase().replace(/([-_][a-z])/g, group =>
            group.toUpperCase().replace('-', '').replace('_', '')
          );
          inputs[camelKey] = process.env[key];
        }
      });

      // Special handling for common numeric env vars
      if (process.env.MAX_TOKENS) {
        inputs.maxTokens = parseInt(process.env.MAX_TOKENS, 10);
      }

      try {
        await workflowFn(inputs);
        process.exit(0);
      } catch (error) {
        console.error('Workflow failed:', error);
        process.exit(1);
      }
    }
  };
}
