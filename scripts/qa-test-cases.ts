import { runQATestCasesWorkflow } from '../src/features/qa-test-cases';

async function main() {
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

  const inputs = {
    githubToken: process.env.GITHUB_TOKEN || '',
    llm: process.env.LLM || '',
    model: process.env.MODEL || '',
    apiKey: process.env.API_KEY || '',
    owner: process.env.GITHUB_REPOSITORY_OWNER || '',
    repo: process.env.GITHUB_REPOSITORY_NAME || '',
    pullNumber: parseInt(process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER || '0', 10),
    projectContext: process.env.PROJECT_CONTEXT || undefined,
    docPattern: process.env.DOC_PATTERN || undefined,
    debug: process.env.DEBUG === 'true',
  };

  try {
    await runQATestCasesWorkflow(inputs);
    process.exit(0);
  } catch (error) {
    console.error('Workflow failed:', error);
    process.exit(1);
  }
}

main();
