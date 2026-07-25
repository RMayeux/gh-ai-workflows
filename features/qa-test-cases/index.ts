import { GitHubClient } from '@platform/github';
import { Logger } from '@core/telemetry';
import { collectDocs } from '@core/utils/file-system';
import { formatTimestamp } from '@core/utils/date';
import { QATestCasesSchema, QATestCasesInputs, QATestCasesInputsSchema } from './schema';
import { upsertBotComment } from '@platform/github/comments';
import { QA_TEST_CASES } from './prompt';
import { createRunner } from '@core/workflow-runner';
import { runPipeline } from '@core/workflow-pipeline';
import type { PipelineInputs } from '@core/workflow-pipeline';

export async function runQATestCasesWorkflow(inputs: QATestCasesInputs & { githubClient?: GitHubClient }) {
  const { owner, repo, pullNumber, debug, projectContext, docPattern, githubToken, llm, model, apiKey, summaryLlm, summaryModel, githubClient: injectedClient } = inputs;

  if (debug) Logger.debug(`Running QA Test Cases Workflow for ${owner}/${repo}#${pullNumber}`);

  try {
    return await runPipeline(
      { githubToken, llm, model, apiKey, owner, repo, pullNumber, debug, summaryLlm, summaryModel, githubClient: injectedClient },
      {
      promptDef: QA_TEST_CASES,
      schema: QATestCasesSchema,
      prepareVariables: async ({ gh, codeDiff }) => {
        let projectDocs = '';
        if (docPattern) {
          Logger.log('Searching for documentation...');
          projectDocs = collectDocs(docPattern);
          if (!projectDocs) Logger.warn('No documentation found matching the provided pattern.');
        }

        const comments = await gh.listComments(owner, repo, pullNumber);
        const botComment = comments
          .filter(c => c.body?.includes('🧪 QA Test Cases'))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        const previousCommentBody = botComment?.body || '';

        const date = formatTimestamp();

        return {
          project_context: projectContext || 'No project context provided.',
          code_diff: codeDiff,
          documentation: projectDocs || 'No documentation provided for these changes.',
          previous_comment: previousCommentBody,
          date,
        };
      },
      handleResult: async ({ gh }, result) => {
        const date = formatTimestamp();
        let body = `### 🧪 QA Test Cases — updated ${date}\n\n`;
        body += `> ${result.summary} (**Total active tests: ${result.totalTests}**)\n\n`;

        if (result.impactedFeatures.length > 0) {
          body += `**New / updated**\n`;
          for (const feature of result.impactedFeatures) {
            body += `**${feature.featureSlug}**\n`;
            body += feature.testCases.map(tc => `- [ ] ${tc}`).join('\n') + '\n';
          }
          body += '\n';
        }

        if (result.unchangedTestCases.length > 0) {
          body += `**Already covered**\n`;
          body += result.unchangedTestCases.map(tc => `- [ ] ${tc}`).join('\n') + '\n\n';
        }

        if (result.retiredTestCases.length > 0) {
          body += `**Retired**\n`;
          body += result.retiredTestCases.map(tc => `~~- ${tc}~~`).join('\n') + '\n';
        }

        await upsertBotComment(gh, owner, repo, pullNumber, '🧪 QA Test Cases', body);
      },
    });
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
