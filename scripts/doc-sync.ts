import { runDocSyncWorkflow } from '@features/doc-sync';

async function main() {
  const requiredEnvVars = {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    LLM: process.env.LLM,
    MODEL: process.env.MODEL,
    API_KEY: process.env.API_KEY,
    GITHUB_REPOSITORY_OWNER: process.env.GITHUB_REPOSITORY_OWNER,
    GITHUB_REPOSITORY_NAME: process.env.GITHUB_REPOSITORY_NAME,
  };

  const missingVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    console.error('Missing required environment variables:');
    console.error(missingVars.join(', '));
    process.exit(1);
  }

  const inputs: any = {
    githubToken: process.env.GITHUB_TOKEN || '',
    llm: process.env.LLM || '',
    model: process.env.MODEL || '',
    apiKey: process.env.API_KEY || '',
    owner: process.env.GITHUB_REPOSITORY_OWNER || '',
    repo: process.env.GITHUB_REPOSITORY_NAME || '',
    pullNumber: process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER ? parseInt(process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER, 10) : undefined,
    lookbackCommits: process.env.LOOKBACK_COMMITS ? parseInt(process.env.LOOKBACK_COMMITS, 10) : 10,
    docPattern: process.env.DOC_PATTERN || '.*\\.md',
    debug: process.env.DEBUG === 'true',
  };

  try {
    await runDocSyncWorkflow(inputs);
    process.exit(0);
  } catch (error) {
    console.error('Workflow failed:', error);
    process.exit(1);
  }
}

main();
