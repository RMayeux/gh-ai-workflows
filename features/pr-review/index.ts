import { GitHubClient } from '@platform/github';
import { Logger } from '@core/telemetry';
import { upsertBotComment, syncLabels } from '@platform/github';
import { formatTimestamp } from '@core/utils/date';
import { PRReviewSchema } from './schema';
import { PR_REVIEW_PROMPT } from './prompt';
import { createRunner } from '@core/workflow-runner';
import { runPipeline } from '@core/workflow-pipeline';
import type { PipelineInputs } from '@core/workflow-pipeline';

export type PRReviewWorkflowInputs = PipelineInputs;

export async function runPRReviewWorkflow(inputs: PipelineInputs & { githubClient?: GitHubClient }) {
  const { owner, repo, pullNumber, debug } = inputs;

  if (debug) Logger.debug(`Running PR Review Workflow for ${owner}/${repo}#${pullNumber}`);

  try {
    return await runPipeline(inputs, {
      promptDef: PR_REVIEW_PROMPT,
      schema: PRReviewSchema,
      prepareVariables: async ({ gh, codeDiff, context }) => {
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

        return {
          pr_title: context.details.title,
          pr_body: context.details.body ?? '',
          changed_files: context.files.join(', '),
          code_diff: codeDiff,
          previous_comment: truncatedComment,
          has_previous: hasPrevious,
        };
      },
      handleResult: async ({ gh }, review) => {
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
          body += '✅ No issues found!';
        } else if (review.issues.length === 0) {
          body += '✅ All previous issues have been resolved!';
        }

        await upsertBotComment(gh, owner, repo, pullNumber, '### 🤖 AI Code Review', body);

        const labelsToAdd = review.approved ? ['approved'] : ['needs-changes'];
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
  createRunner(runPRReviewWorkflow, { requiredEnvVars: ['GITHUB_EVENT_PULL_REQUEST_NUMBER'] }).run();
}
