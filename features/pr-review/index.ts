import { GitHubClient, ContextBuilder } from '@platform/github';
import { generateStructured } from '@core/structured-generation';
import { ProviderRegistry } from '@core/registry';
import { PromptEngine } from '@core/prompt-engine';
import { Logger } from '@core/telemetry';
import { registerAllProviders } from '@platform/llm';
import { PRReviewSchema } from './schema';
import { upsertBotComment, syncLabels } from '@platform/github';
import { formatTimestamp } from '@core/utils/date';
import { PR_REVIEW_PROMPT } from './prompt';
import { createRunner } from '@core/workflow-runner';

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
    
    const comments = await gh.listComments(owner, repo, pullNumber);
    const botComment = comments
      .filter(c => c.body?.includes('### 🤖 AI Code Review'))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    const previousCommentBody = botComment?.body || '';

    // ponytail: truncate previous comment to 2000 chars, conditional template avoids empty section
    const MAX_PREV_CHARS = 2000;
    const truncatedComment = previousCommentBody.length > MAX_PREV_CHARS
      ? previousCommentBody.slice(0, MAX_PREV_CHARS) + '\n\n_(previous comment truncated)'
      : previousCommentBody;
    const hasPrevious = truncatedComment.length > 0;

    const prompt = PromptEngine.render(PR_REVIEW_PROMPT, {
      pr_title: context.details.title,
      pr_body: context.details.body ?? '',
      changed_files: context.files.join(', '),
      code_diff: context.diff,
      previous_comment: truncatedComment,
      has_previous: hasPrevious,
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
    
    const date = formatTimestamp();
    let body = `### 🤖 AI Code Review — updated ${date}\n\n`;
    body += `**Summary:** ${review.summary}\n\n`;

    const newIssues = review.issues.filter(i => i.status === 'new');
    const persistingIssues = review.issues.filter(i => i.status === 'persisting');

    if (newIssues.length > 0) {
      body += `**New issues**\n`;
      body += newIssues.map(i => `- [ ] [${i.severity}] ${i.description}`).join('\n') + '\n\n';
    }

    if (persistingIssues.length > 0) {
      body += `**Persisting issues**\n`;
      body += persistingIssues.map(i => `- [ ] [${i.severity}] ${i.description}`).join('\n') + '\n\n';
    }

    if (review.resolvedIssues.length > 0) {
      body += `**Resolved issues**\n`;
      body += review.resolvedIssues.map(i => `- [x] ${i.description}`).join('\n') + '\n\n';
    }

    if (review.issues.length === 0 && review.resolvedIssues.length === 0) {
      body += `✅ No issues found!`;
    } else if (review.issues.length === 0) {
      body += `✅ All previous issues have been resolved!`;
    }

    await upsertBotComment(gh, owner, repo, pullNumber, '### 🤖 AI Code Review', body).catch(err => {
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

if (process.env.NODE_ENV !== 'test') {
  createRunner(runPRReviewWorkflow, { requiredEnvVars: ['GITHUB_EVENT_PULL_REQUEST_NUMBER'] }).run();
}
