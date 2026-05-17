import { GitHubClient, ContextBuilder } from '@platform/github';
import { generateStructured, ProviderRegistry, PromptEngine, PromptLoader, Logger } from '@core';
import { registerAllProviders } from '@platform/llm';
import { PRReviewSchema } from '@features/pr-review/schema';
import { replaceBotComments, syncLabels } from '@platform/github';
import { formatAIList } from '@core/utils/markdown';
import path from 'node:path';

export interface PRReviewWorkflowInputs {
  githubToken: string;
  llm: string;
  model: string;
  apiKey: string;
  owner: string;
  repo: string;
  pullNumber: number;
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
    maxTokens = 4096,
    debug = false,
    githubClient: injectedClient,
  } = inputs;

  if (debug) Logger.debug(`Running PR Review Workflow for ${owner}/${repo}#${pullNumber}`);

  try {
    // 1. Initialize GitHub Client
    Logger.log('Step 1: Initializing GitHub Client...');
    const gh = injectedClient || new GitHubClient(githubToken);
    
    // 2. Gather Context
    Logger.log('Step 2: Gathering PR context...');
    const contextBuilder = new ContextBuilder(gh);
    const context = await contextBuilder.buildPRContext(owner, repo, pullNumber).catch(err => {
      throw new Error(`Failed to gather PR context: ${err.message}`);
    });

    // 3. Load and Render Prompt
    Logger.log('Step 3: Loading and rendering prompt...');
    const loader = new PromptLoader();
    const definition = await loader.load('pr-review').catch(err => {
      throw new Error(`Failed to load prompt: ${err.message}`);
    });
    
    const prompt = PromptEngine.render(definition, {
      pr_title: context.details.title,
      pr_body: context.details.body ?? '',
      changed_files: context.files.join(', '),
      code_diff: context.diff,
    });

    // 4. Generate Structured Review
    Logger.log(`Step 4: Generating review using ${llm}:${model}...`);
    registerAllProviders();
    const provider = ProviderRegistry.create(llm, { apiKey, model });

    const generationResult = await generateStructured(provider, PRReviewSchema, {
      prompt: prompt.user,
      systemPrompt: prompt.system,
      maxTokens,
    }, {
      maxRetries: 3,
      jsonMode: true
    }).catch(err => {
      throw new Error(`LLM request failed: ${err.message}`);
    });

    if (!generationResult.success) {
      throw new Error(`LLM Review failed: ${generationResult.error}`);
    }

    const review = generationResult.data!;
    if (debug) Logger.debug('Generated Review:', review);

    // 5. Post Review Comment
    Logger.log('Step 5: Posting review comment to GitHub...');
    
    await replaceBotComments(gh, owner, repo, pullNumber, '### 🤖 AI Code Review');

    const summary = `### 🤖 AI Code Review\n\n**Summary:** ${review.summary}\n\n`;
    const issuesContent = formatAIList('Issues', review.issues.map(i => `[${i.severity}] ${i.description}`));
    
    const finalBody = review.issues.length > 0 
      ? summary + issuesContent 
      : summary + `✅ No issues found!`;

    await gh.postComment(owner, repo, pullNumber, finalBody).catch(err => {
      throw new Error(`Failed to post comment: ${err.message}`);
    });

    // 6. Apply Labels
    Logger.log('Step 6: Applying PR labels...');
    const labelsToAdd = review.approved ? ['approved'] : ['needs-changes'];
    await syncLabels(gh, owner, repo, pullNumber, { add: labelsToAdd });

    Logger.log('PR Review Workflow completed successfully.');
    return review;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error(`Workflow failed at step: ${message}`);
    throw error;
  }
}
