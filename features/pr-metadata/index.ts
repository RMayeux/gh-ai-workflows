import { GitHubClient } from '@platform/github';
import { Logger } from '@core/telemetry';
import { syncLabels } from '@platform/github/labels';
import { PRMetadataSchema } from './schema';
import { PR_METADATA_PROMPT } from './prompt';
import { createRunner } from '@core/workflow-runner';
import { runPipeline } from '@core/workflow-pipeline';
import type { PipelineInputs } from '@core/workflow-pipeline';

export type PRMetadataWorkflowInputs = PipelineInputs;

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
        await gh.updatePR(owner, repo, pullNumber, metadata.title, metadata.body);

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
