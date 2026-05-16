import { GitHubClient, ContextBuilder } from '../index';
import { generateStructured } from '@gh-ai-workflows/core';
import { ProviderRegistry } from '@gh-ai-workflows/core';
import { registerAllProviders } from '@gh-ai-workflows/providers';
import { PRMetadataSchema } from '@gh-ai-workflows/validators';
import { PromptEngine, PromptLoader } from '@gh-ai-workflows/core';
import { Logger } from '@gh-ai-workflows/core';
import path from 'node:path';

export interface PRMetadataWorkflowInputs {
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

export async function runPRMetadataWorkflow(inputs: PRMetadataWorkflowInputs & { githubClient?: GitHubClient }) {
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
    const loader = new PromptLoader(path.resolve(__dirname, '../../../core/prompts'));
    const definition = await loader.loadWithFallback('pr-metadata', promptVersion).catch(err => {
      throw new Error(`Failed to load prompt: ${err.message}`);
    });
    
    const prompt = PromptEngine.render(definition, {
      registry: '',
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

    const labels = [];
    if (result.change_type) labels.push(result.change_type);
    if (result.breaking) labels.push('breaking-change');
    if (result.doc_impact) labels.push('doc-impact');

    const changed = context.details.additions + context.details.deletions;
    if (changed < 50) labels.push('size/XS');
    else if (changed < 200) labels.push('size/S');
    else if (changed < 500) labels.push('size/M');
    else if (changed < 1000) labels.push('size/L');
    else labels.push('size/XL');

    await gh.addLabels(owner, repo, pullNumber, labels).catch(err => {
      throw new Error(`Failed to add labels: ${err.message}`);
    });

    Logger.log('PR Metadata Workflow completed successfully.');
    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error(`Workflow failed at step: ${message}`);
    throw error;
  }
}
