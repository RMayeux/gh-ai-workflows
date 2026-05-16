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
    const loader = new PromptLoader(path.resolve(__dirname, '../../../core/prompts'));
    const definition = await loader.loadWithFallback('pr-review', promptVersion).catch(err => {
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
    
    // Remove previous AI review comments to avoid clutter
    try {
      const comments = await gh.listComments(owner, repo, pullNumber);
      const aiComments = comments.filter(c => c.body?.startsWith('### 🤖 AI Code Review'));
      for (const comment of aiComments) {
        await gh.deleteComment(owner, repo, comment.id);
      }
      if (aiComments.length > 0) {
        Logger.log(`Removed ${aiComments.length} previous AI review comments.`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      Logger.error(`Failed to clean up old comments: ${message}`);
      // Non-critical, continue to post new comment
    }

    const commentBody = `### 🤖 AI Code Review\n\n**Summary:** ${review.summary}\n\n`;
    
    if (review.issues.length > 0) {
      const issuesTable = review.issues
        .map(i => `| ${i.severity} | ${i.description} |`)
        .join('\n');
      
      const commentWithIssues = commentBody + `**Issues:**\n| Severity | Description |\n|---|---|\n${issuesTable}\n`;
      await gh.postComment(owner, repo, pullNumber, commentWithIssues).catch(err => {
        throw new Error(`Failed to post comment: ${err.message}`);
      });
    } else {
      await gh.postComment(owner, repo, pullNumber, commentBody + `✅ No issues found!`).catch(err => {
        throw new Error(`Failed to post comment: ${err.message}`);
      });
    }

    // 6. Apply Labels
    Logger.log('Step 6: Applying PR labels...');
    const labels = review.approved ? ['approved'] : ['needs-changes'];
    await gh.addLabels(owner, repo, pullNumber, labels).catch(err => {
      throw new Error(`Failed to apply labels: ${err.message}`);
    });

    Logger.log('PR Review Workflow completed successfully.');
    return review;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error(`Workflow failed at step: ${message}`);
    throw error;
  }
}
