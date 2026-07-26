import { appendFileSync } from 'node:fs';
import { GitHubClient } from '@platform/github';
import { Logger } from '@core/telemetry';
import type { GitHubContext } from '@platform/github';
import { PRMetadataSchema } from './schema';
import type { PRMetadata } from './schema';
import { PR_METADATA_PROMPT } from './prompt';
import { createRunner } from '@core/workflow-runner';
import { runPipeline } from '@core/workflow-pipeline';
import type { PipelineInputs } from '@core/workflow-pipeline';

export type PRMetadataWorkflowInputs = PipelineInputs;

const VERIFICATION_HEADING = '## Verification';

function extractVerificationSection(existingBody: string): string {
  const idx = existingBody.indexOf(VERIFICATION_HEADING);
  if (idx === -1) return '';
  return existingBody.slice(idx);
}

function assembleBody(metadata: PRMetadata, existingBody: string): string {
  const parts: string[] = [metadata.summary, '', '## Changes', ''];
  parts.push(...metadata.changes.map(c => `* ${c}`));

  if (metadata.fixes && metadata.fixes.length > 0) {
    parts.push('', '## Fixes', '');
    parts.push(...metadata.fixes.map(f => `* ${f}`));
  }

  const verification = extractVerificationSection(existingBody);
  if (verification) {
    parts.push('', verification);
  }

  return parts.join('\n');
}

// ponytail: simple top-level grouping for >20 files, per-account thresholds if needed
function prepareChangedFiles(files: string[]): string {
  if (files.length <= 20) return files.join('\n');

  const N_SIGNIFICANT = 15;
  const significant = files.slice(0, N_SIGNIFICANT);
  const rest = files.slice(N_SIGNIFICANT);

  const groups = new Map<string, number>();
  for (const f of rest) {
    const dir = f.includes('/') ? f.slice(0, f.indexOf('/')) : '.';
    groups.set(dir, (groups.get(dir) || 0) + 1);
  }

  const grouped = Array.from(groups.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([dir, count]) => `${dir}/ (${count} files)`);

  return [...significant, ...grouped].join('\n');
}

function filterDiffToSignificant(codeDiff: string, files: string[], nSignificant: number): string {
  if (files.length <= nSignificant) return codeDiff;
  const significant = new Set(files.slice(0, nSignificant));
  const chunks = codeDiff.split(/\ndiff --git /);
  const filtered = chunks.filter(chunk => {
    const match = chunk.match(/^a\/(.+?)\s+b\//);
    return !match || significant.has(match[1]);
  });
  return filtered.join('\ndiff --git ');
}

async function handleResult(
  gh: GitHubClient,
  context: GitHubContext,
  metadata: PRMetadata,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<void> {
  const body = assembleBody(metadata, context.details.body);
  await gh.updatePR(owner, repo, pullNumber, metadata.title, body);

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `summary=${metadata.summary}\n`);
  }
}

export async function runPRMetadataWorkflow(inputs: PipelineInputs & { githubClient?: GitHubClient }) {
  const { owner, repo, pullNumber, debug } = inputs;

  if (debug) Logger.debug(`Running PR Metadata Workflow for ${owner}/${repo}#${pullNumber}`);

  try {
    return await runPipeline(inputs, {
      promptDef: PR_METADATA_PROMPT,
      schema: PRMetadataSchema,
      prepareVariables: ({ codeDiff, context }) => ({
        changed_files: prepareChangedFiles(context.files),
        code_diff: filterDiffToSignificant(codeDiff, context.files, 15),
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
