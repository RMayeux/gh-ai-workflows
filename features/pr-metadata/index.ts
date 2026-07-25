import { GitHubClient, ContextBuilder } from '@platform/github';
import { generateStructured } from '@core/structured-generation';
import { ProviderRegistry } from '@core/registry';
import { PromptEngine } from '@core/prompt-engine';
import { Logger } from '@core/telemetry';
import { registerAllProviders } from '@platform/llm';
import { PRMetadataSchema } from './schema';
import { syncLabels } from '@platform/github/labels';
import { PR_METADATA_PROMPT } from './prompt';
import { createRunner } from '@core/workflow-runner';

export interface PRMetadataWorkflowInputs {
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


export async function runPRMetadataWorkflow(inputs: PRMetadataWorkflowInputs & { githubClient?: GitHubClient }) {
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

  if (debug) Logger.debug(`Running PR Metadata Workflow for ${owner}/${repo}#${pullNumber}`);

  try {
    // 1. Initialize GitHub Client
    Logger.log('Step 1: Initializing GitHub Client...');
    const gh = injectedClient || new GitHubClient(githubToken);
    const contextBuilder = new ContextBuilder(gh);

    // 2. Gather Context
    Logger.log('Step 2: Fetching PR diff and files...');
    const context = await contextBuilder.buildPRContext(owner, repo, pullNumber).catch(err => {
      throw new Error(`Failed to build PR context: ${err.message}`);
    });

    // 3. Load Prompt
    Logger.log('Step 3: Loading and rendering prompt...');

    const prompt = PromptEngine.render(PR_METADATA_PROMPT, {
      changed_files: context.files.join('\\n'),
      code_diff: context.diff,
      pr_title: context.details.title,
      pr_body: context.details.body ?? '',
    });

    // 4. Generate Structured Output
    Logger.log(`Step 4: Generating metadata using ${llm}:${model}...`);
    registerAllProviders();
    const provider = ProviderRegistry.create(llm, { apiKey, model });

    const generationResult = await generateStructured(provider, PRMetadataSchema, {
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
      throw new Error(`LLM Generation failed: ${generationResult.error}`);
    }

    const result = generationResult.data!;
    if (debug) Logger.debug('Generated Metadata:', result);

    // 5. Update GitHub PR
    Logger.log('Step 5: Updating PR title, body and labels...');
    await gh.updatePR(owner, repo, pullNumber, result.title, result.body).catch(err => {
      throw new Error(`Failed to update PR: ${err.message}`);
    });

    const labelsToAdd = [];
    if (result.change_type) labelsToAdd.push(result.change_type);
    if (result.breaking) labelsToAdd.push('breaking-change');
    if (result.doc_impact) labelsToAdd.push('doc-impact');

    const changed = context.details.additions + context.details.deletions;
    if (changed < 50) labelsToAdd.push('size/XS');
    else if (changed < 200) labelsToAdd.push('size/S');
    else if (changed < 500) labelsToAdd.push('size/M');
    else if (changed < 1000) labelsToAdd.push('size/L');
    else labelsToAdd.push('size/XL');

    await syncLabels(gh, owner, repo, pullNumber, { add: labelsToAdd });

    Logger.log('PR Metadata Workflow completed successfully.');
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error(`Workflow failed at step: ${message}`);
    throw error;
  }
}

if (process.env.NODE_ENV !== 'test') {
  createRunner(runPRMetadataWorkflow, { requiredEnvVars: ['GITHUB_EVENT_PULL_REQUEST_NUMBER'] }).run();
}
