import { GitHubClient, ContextBuilder } from '@platform/github';
import type { GitHubContext } from '@platform/github';
import { registerAllProviders } from '@platform/llm/register';
import { ProviderRegistry } from '@core/registry';
import { Logger } from '@core/telemetry';
import { summarizeDiff } from '@core/diff-summarizer';
import { generateStructured } from '@core/structured-generation';
import { PromptEngine, PromptDefinition, PromptVariables } from '@core/prompt-engine';
import { z } from 'zod';
import { LLMProvider } from '@platform/llm/types';

export interface PipelineInputs {
  githubToken: string;
  llm: string;
  model: string;
  apiKey: string;
  owner: string;
  repo: string;
  pullNumber: number;
  debug?: boolean;
  summaryLlm?: string;
  summaryModel?: string;
  maxTokens?: number;
  githubClient?: GitHubClient;
}

export interface PipelineContext {
  gh: GitHubClient;
  provider: LLMProvider;
  codeDiff: string;
  context: GitHubContext;
}

export interface PipelineConfig<T> {
  promptDef: PromptDefinition;
  schema: z.ZodSchema<T>;
  prepareVariables: (ctx: PipelineContext) => PromptVariables | Promise<PromptVariables>;
  handleResult: (ctx: PipelineContext, data: T) => Promise<unknown>;
}

export async function runPipeline<T>(
  inputs: PipelineInputs,
  config: PipelineConfig<T>,
): Promise<T> {
  const { debug, githubToken, llm, model, apiKey, owner, repo, pullNumber, summaryLlm, summaryModel } = inputs;

  if (debug) Logger.debug(`Running workflow for ${owner}/${repo}#${pullNumber}`);

  const gh = inputs.githubClient || new GitHubClient(githubToken);
  const contextBuilder = new ContextBuilder(gh);

  Logger.log('Gathering PR context...');
  const context = await contextBuilder.buildPRContext(owner, repo, pullNumber);

  let codeDiff = context.diff;
  if (summaryLlm && summaryModel) {
    Logger.log('Summarizing large diff...');
    registerAllProviders();
    const summaryProvider = ProviderRegistry.create(summaryLlm, { apiKey, model: summaryModel });
    codeDiff = await summarizeDiff(codeDiff, summaryProvider);
  }

  Logger.log('Creating LLM provider...');
  registerAllProviders();
  const provider = ProviderRegistry.create(llm, { apiKey, model });

  const pipelineCtx: PipelineContext = { gh, provider, codeDiff, context };

  const variables = await config.prepareVariables(pipelineCtx);

  Logger.log('Rendering prompt...');
  const prompt = PromptEngine.render(config.promptDef, variables);

  Logger.log(`Generating with ${llm}:${model}...`);
  const request: { prompt: string; systemPrompt: string } & { maxTokens?: number } = {
    prompt: prompt.user,
    systemPrompt: prompt.system,
    ...(inputs.maxTokens ? { maxTokens: inputs.maxTokens } : {}),
  };

  const generationResult = await generateStructured(provider, config.schema, request, {
    maxRetries: 3,
    jsonMode: true,
  });

  if (!generationResult.success) {
    throw new Error(`LLM generation failed: ${generationResult.error}`);
  }

  const data = generationResult.data!;
  if (debug) Logger.debug('Generated result:', data);

  await config.handleResult(pipelineCtx, data);

  return data;
}
