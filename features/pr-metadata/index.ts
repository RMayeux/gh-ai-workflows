import { appendFileSync } from 'node:fs';
import { GitHubClient } from '@platform/github';
import { Logger } from '@core/telemetry';
import { syncLabels } from '@platform/github/labels';
import type { GitHubContext } from '@platform/github';
import { PRMetadataSchema } from './schema';
import type { PRMetadata } from './schema';
import { PR_METADATA_PROMPT } from './prompt';
import { createRunner } from '@core/workflow-runner';
import { runPipeline } from '@core/workflow-pipeline';
import type { PipelineInputs } from '@core/workflow-pipeline';

export type PRMetadataWorkflowInputs = PipelineInputs;

async function handleResult(
  gh: GitHubClient,
  context: GitHubContext,
  metadata: PRMetadata,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<void> {
  await gh.updatePR(owner, repo, pullNumber, metadata.title, `${metadata.summary}\n\n${metadata.body}`);

  // ponytail: GITHUB_OUTPUT may not exist outside Actions runner,
  // switch to core.setOutput or structured env writer if >2 outputs
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `summary=${metadata.summary}\n`);
  }

  const labelsToAdd: string[] = [];
  if (metadata.change_type) labelsToAdd.push(metadata.change_type);
  if (metadata.breaking) labelsToAdd.push('breaking-change');
  if (metadata.doc_impact) labelsToAdd.push('doc-impact');

  const changed = context.details.additions + context.details.deletions;
  if (changed < 50) labelsToAdd.push('size/XS');
  else if (changed < 200) labelsToAdd.push('size/S');
  else if (changed < 500) labelsToAdd.push('size/M');
  else if (changed < 1000) labelsToAdd.push('size/L');
  else labelsToAdd.push('size/XL');

  await syncLabels(gh, owner, repo, pullNumber, { add: labelsToAdd });
}

export async function runPRMetadataWorkflow(inputs: PipelineInputs & { githubClient?: GitHubClient }) {
  const { owner, repo, pullNumber, debug } = inputs;

  if (debug) Logger.debug(`Running PR Metadata Workflow for ${owner}/${repo}#${pullNumber}`);

  try {
    return await runPipeline(inputs, {
      promptDef: PR_METADATA_PROMPT,
      schema: PRMetadataSchema,
      prepareVariables: ({ codeDiff, context }) => ({
        changed_files: context.files.join('\\n'),
        code_diff: codeDiff,
        pr_title: context.details.title,
        pr_body: context.details.body ?? '',
      }),
      handleResult: async ({ gh, context }, metadata) => {
        await handleResult(gh, context, metadata, owner, repo, pullNumber);
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error(`Workflow failed at step: ${message}`);
    throw error;
  }
}

if (process.env.NODE_ENV !== 'test') {
  createRunner(runPRMetadataWorkflow, { requiredEnvVars: ['GITHUB_EVENT_PULL_REQUEST_NUMBER'] }).run();
}
