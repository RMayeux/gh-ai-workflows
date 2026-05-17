import { existsSync } from 'node:fs';
import path from 'node:path';
import { GitHubClient, ContextBuilder } from '@platform/github';
import { generateStructured, ProviderRegistry, PromptEngine, PromptLoader, Logger } from '@core';
import { registerAllProviders } from '@platform/llm';
import { QATestCasesSchema, QATestCasesInputs } from './schema';
import { replaceBotComments } from '@platform/github/comments';
import { formatAIList } from '@core/utils/markdown';
import { collectDocs } from '@core/utils/file-system';

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
    const loader = new PromptLoader();
    const definition = await loader.load('qa-test-cases').catch(err => {
      throw new Error(`Failed to load prompt: ${err instanceof Error ? err.message : String(err)}`);
    });
    
    const prompt = PromptEngine.render(definition, {
      project_context: projectContext || 'No project context provided.',
      code_diff: context.diff,
      documentation: projectDocs || 'No documentation provided for these changes.',
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

    await replaceBotComments(gh, owner, repo, pullNumber, '🧪 QA Test Cases');

    // Format output
    const featureList = result.impactedFeatures.map(f => f.featureSlug).join(', ');
    let body = `## 🧪 QA Test Cases\n\n`;
    body += `**${result.totalTests} tests — ${featureList}**\n`;
    body += `_${result.summary}_\n\n`;

    for (const feature of result.impactedFeatures) {
      body += formatAIList(feature.featureSlug, feature.testCases, '- [ ] ');
    }

    // Post comment
    await gh.postComment(owner, repo, pullNumber, body).catch(err => {
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
