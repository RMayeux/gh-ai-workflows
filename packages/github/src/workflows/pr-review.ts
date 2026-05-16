import { GitHubClient, ContextBuilder } from '@gh-ai-workflows/github';
import { generateStructured, ProviderRegistry } from '@gh-ai-workflows/core';
import { registerAllProviders } from '@gh-ai-workflows/providers';
import { PRReviewSchema } from '@gh-ai-workflows/validators';
import { PromptEngine, PromptLoader } from '@gh-ai-workflows/core';
import { Logger } from '@gh-ai-workflows/core';
import path from 'node:path';

export interface PRReviewWorkflowInputs {
  githubToken: string;
  llm: string;
  model: string;
  apiKey: string;
  owner: string;
  repo: string;
  pullNumber: number;
  promptVersion: string;
  maxTokens?: number;
  debug?: boolean;
}

export async function runPRReviewWorkflow(inputs: PRReviewWorkflowInputs & { githubClient?: GitHubClient }) {
  const {
    githubToken,
    llm,
    model,
    apiKey,
    owner,
    repo,
    pullNumber,
    promptVersion,
    maxTokens = 4096,
    debug = false,
    githubClient: injectedClient,
  } = inputs;

  if (debug) Logger.log(`Running PR Review Workflow for ${owner}/${repo}#${pullNumber}`);

  // 1. Initialize GitHub Client
  const gh = injectedClient || new GitHubClient(githubToken);
  
  // 2. Gather Context (basic metadata)
  const prDetails = await gh.getPRDetails(owner, repo, pullNumber);

  // 3. Load Prompt
  const loader = new PromptLoader(path.resolve(__dirname, '../../../core/prompts'));
  const definition = await loader.loadWithFallback('pr-review', promptVersion);
  
  const prompt = PromptEngine.render(definition, {
    pr_title: prDetails.title,
    pr_body: prDetails.body ?? '',
  });

  // 4. Generate Structured Review
  if (debug) Logger.log(`Generating review using ${llm}:${model}...`);
  
  registerAllProviders();
  const provider = ProviderRegistry.create(llm, { apiKey });

  const generationResult = await generateStructured(provider, PRReviewSchema, {
    prompt: prompt.user,
    systemPrompt: prompt.system,
    maxTokens,
  }, {
    maxRetries: 3,
    jsonMode: true
  });

  if (!generationResult.success) {
    throw new Error(`LLM Review failed: ${generationResult.error}`);
  }

  const review = generationResult.data!;
  if (debug) Logger.log('Generated Review:', review);

  // 5. Post Review Comment
  const commentBody = `### 🤖 AI Code Review\n\n**Summary:** ${review.summary}\n\n`;
  
  if (review.issues.length > 0) {
    const issuesTable = review.issues
      .map(i => `| ${i.severity} | ${i.description} |`)
      .join('\n');
    
    const commentWithIssues = commentBody + `**Issues:**\n| Severity | Description |\n|---|---|\n${issuesTable}\n`;
    await gh.postComment(owner, repo, pullNumber, commentWithIssues);
  } else {
    await gh.postComment(owner, repo, pullNumber, commentBody + `✅ No issues found!`);
  }

  // 6. Apply Labels
  const labels = review.approved ? ['approved'] : ['needs-changes'];
  await gh.addLabels(owner, repo, pullNumber, labels);

  return review;
}
