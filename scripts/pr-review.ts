import { runPRReviewWorkflow } from '../packages/github/src/workflows/pr-review';

async function main() {
  const inputs = {
    githubToken: process.env.GITHUB_TOKEN || '',
    llm: process.env.LLM || '',
    model: process.env.MODEL || '',
    apiKey: process.env.API_KEY || '',
    owner: process.env.GITHUB_REPOSITORY_OWNER || '',
    repo: process.env.GITHUB_REPOSITORY_NAME || '',
    pullNumber: parseInt(process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER || '0', 10),
    promptVersion: process.env.PROMPT_VERSION || '1.0.0',
    maxTokens: process.env.MAX_TOKENS ? parseInt(process.env.MAX_TOKENS, 10) : 4096,
    debug: process.env.DEBUG === 'true',
  };

  if (!inputs.githubToken || !inputs.llm || !inputs.model || !inputs.apiKey || !inputs.owner || !inputs.repo || !inputs.pullNumber) {
    console.error('Missing required environment variables');
    console.error('Required: GITHUB_TOKEN, LLM, MODEL, API_KEY, GITHUB_REPOSITORY_OWNER, GITHUB_REPOSITORY_NAME, GITHUB_EVENT_PULL_REQUEST_NUMBER');
    process.exit(1);
  }

  try {
    await runPRReviewWorkflow(inputs);
    process.exit(0);
  } catch (error) {
    console.error('Workflow failed:', error);
    process.exit(1);
  }
}

main();
