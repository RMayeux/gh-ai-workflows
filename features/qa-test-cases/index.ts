import { GitHubClient, ContextBuilder } from '@platform/github';
import { generateStructured } from '@core/structured-generation';
import { ProviderRegistry } from '@core/registry';
import { PromptEngine } from '@core/prompt-engine';
import { Logger } from '@core/telemetry';
import { registerAllProviders } from '@platform/llm';
import { QATestCasesSchema, QATestCasesInputs, QATestCasesInputsSchema } from './schema';
import { upsertBotComment } from '@platform/github/comments';
import { collectDocs } from '@core/utils/file-system';
import { formatTimestamp } from '@core/utils/date';
import { QA_TEST_CASES } from './prompt';
import { createRunner } from '@core/workflow-runner';

export async function runQATestCasesWorkflow(inputs: QATestCasesInputs & { githubClient?: GitHubClient }) {
  const {
    githubToken,
    llm,
    model,
    apiKey,
    owner,
    repo,
    pullNumber,
    projectContext,
    docPattern,
    debug = false,
    githubClient: injectedClient,
  } = inputs;

  if (debug) Logger.debug(`Running QA Test Cases Workflow for ${owner}/${repo}#${pullNumber}`);

  try {
    // 1. Initialize GitHub Client
    Logger.log('Step 1: Initializing GitHub Client...');
    const gh = injectedClient || new GitHubClient(githubToken);
    const contextBuilder = new ContextBuilder(gh);

    // 2. Gather Context
    Logger.log('Step 2: Fetching PR diff and files...');
    const context = await contextBuilder.buildPRContext(owner, repo, pullNumber).catch(err => {
      throw new Error(`Failed to build PR context: ${err instanceof Error ? err.message : String(err)}`);
    });

    // 3. Collect Docs (Optional)
    let projectDocs = '';
    if (docPattern) {
      Logger.log(`Step 3: Searching for documentation matching pattern: ${docPattern}...`);
      projectDocs = collectDocs(docPattern);
      if (!projectDocs) {
        Logger.warn('No documentation found matching the provided pattern.');
      }
    } else {
      Logger.log('Step 3: No docPattern provided, skipping documentation collection.');
    }

    // 4. Load Prompt
    Logger.log('Step 4: Loading and rendering prompt...');
    
    const comments = await gh.listComments(owner, repo, pullNumber);
    const botComment = comments
      .filter(c => c.body?.includes('🧪 QA Test Cases'))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    const previousCommentBody = botComment?.body || '';

    const date = formatTimestamp();

    const prompt = PromptEngine.render(QA_TEST_CASES, {
      project_context: projectContext || 'No project context provided.',
      code_diff: context.diff,
      documentation: projectDocs || 'No documentation provided for these changes.',
      previous_comment: previousCommentBody,
      date,
    });

    // 5. Generate Structured Output
    Logger.log(`Step 5: Generating QA test cases using ${llm}:${model}...`);
    registerAllProviders();
    const provider = ProviderRegistry.create(llm, { apiKey, model });

    const generationResult = await generateStructured(provider, QATestCasesSchema, {
      prompt: prompt.user,
      systemPrompt: prompt.system,
    }, {
      maxRetries: 3,
      jsonMode: true
    }).catch(err => {
      throw new Error(`LLM request failed: ${err instanceof Error ? err.message : String(err)}`);
    });

    if (!generationResult.success) {
      throw new Error(`LLM Generation failed: ${generationResult.error}`);
    }

    const result = generationResult.data!;
    if (debug) Logger.debug('Generated QA Test Cases:', result);

    // 6. GitHub Integration
    Logger.log('Step 6: Updating GitHub PR...');

    let body = `### 🧪 QA Test Cases — updated ${date}\n\n`;
    body += `> ${result.summary} (**Total active tests: ${result.totalTests}**)\n\n`;

    if (result.impactedFeatures.length > 0) {
      body += `**New / updated**\n`;
      for (const feature of result.impactedFeatures) {
        body += `**${feature.featureSlug}**\n`;
        body += feature.testCases.map(tc => `- [ ] ${tc}`).join('\n') + '\n';
      }
      body += `\n`;
    }

    if (result.unchangedTestCases.length > 0) {
      body += `**Already covered**\n`;
      body += result.unchangedTestCases.map(tc => `- [ ] ${tc}`).join('\n') + '\n\n';
    }

    if (result.retiredTestCases.length > 0) {
      body += `**Retired**\n`;
      body += result.retiredTestCases.map(tc => `~~- ${tc}~~`).join('\n') + '\n';
    }

    await upsertBotComment(gh, owner, repo, pullNumber, '🧪 QA Test Cases', body).catch(err => {
      throw new Error(`Failed to post QA comment: ${err.message}`);
    });

    Logger.log('QA Test Cases Workflow completed successfully.');
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error(`Workflow failed at step: ${message}`);
    throw error;
  }
}

if (process.env.NODE_ENV !== 'test') {
  createRunner(runQATestCasesWorkflow, {
    requiredEnvVars: ['GITHUB_EVENT_PULL_REQUEST_NUMBER'],
    validate: (inputs) => {
      const result = QATestCasesInputsSchema.safeParse(inputs);
      if (!result.success) {
        console.error('Invalid or missing environment variables:');
        console.error(JSON.stringify(result.error.format(), null, 2));
      }
      return { success: result.success, error: result.success ? undefined : { message: JSON.stringify(result.error.format()) } };
    },
  }).run();
}
