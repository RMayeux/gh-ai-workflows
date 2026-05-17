import { writeFileSync, existsSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { GitHubClient, ContextBuilder } from '@platform/github';
import { generateStructured, ProviderRegistry, PromptEngine, PromptLoader, Logger } from '@core';
import { registerAllProviders } from '@platform/llm';
import { DocSyncSchema, DocSyncInputs } from './schema';
import { collectDocs } from '@core/utils/file-system';

function runGitCommand(command: string) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch (error: any) {
    Logger.error(`Git command failed: ${command}\nError: ${error.stderr || error.message}`);
    throw error;
  }
}

async function findAuditBaseline(gh: GitHubClient, owner: string, repo: string, lookback: number): Promise<string> {
  Logger.log('Searching for last merged audit PR...');
  
  try {
    const mergedPRs = await gh.listMergedPRs(owner, repo);
    const auditPR = mergedPRs.find(pr => 
      pr.merged_at && 
      (pr.title.startsWith('docs: sync documentation') || pr.title.includes('Documentation Sync'))
    );

    if (auditPR) {
      Logger.log(`Found last audit PR #${auditPR.number}. Using its merge commit as baseline.`);
      // Get the merge commit SHA of the PR
      const prDetails = await gh.request<any>(`/repos/${owner}/${repo}/pulls/${auditPR.number}`);
      return prDetails.merge_commit_sha;
    }
  } catch (e) {
    Logger.warn(`Failed to search PR history: ${e instanceof Error ? e.message : String(e)}`);
  }

  Logger.log(`No audit PR found. Falling back to lookback of ${lookback} commits.`);
  try {
    return runGitCommand(`git rev-list -n 1 HEAD~${lookback}`);
  } catch (e) {
    Logger.warn(`Lookback of ${lookback} commits failed (likely fewer commits in history). Falling back to first commit.`);
    return runGitCommand(`git rev-list --max-parents=0 HEAD`);
  }
}

export async function runDocSyncWorkflow(inputs: DocSyncInputs & { githubClient?: GitHubClient }) {
  const {
    githubToken,
    llm,
    model,
    apiKey,
    owner,
    repo,
    pullNumber,
    lookbackCommits = 10,
    docPattern,
    debug = false,
    githubClient: injectedClient,
  } = inputs;

  if (debug) Logger.debug(`Running Doc Sync Workflow for ${owner}/${repo}${pullNumber ? `#${pullNumber}` : ' (Audit Mode)'}`);

  try {
    // 1. Initialize GitHub Client
    Logger.log('Step 1: Initializing GitHub Client...');
    const gh = injectedClient || new GitHubClient(githubToken);
    const contextBuilder = new ContextBuilder(gh);

    // 2. Gather Context (Diff)
    let codeDiff = '';
    let baseBranch = 'main';

    if (pullNumber) {
      Logger.log(`Step 2: Fetching PR #${pullNumber} diff...`);
      const context = await contextBuilder.buildPRContext(owner, repo, pullNumber).catch(err => {
        throw new Error(`Failed to build PR context: ${err instanceof Error ? err.message : String(err)}`);
      });
      codeDiff = context.diff;
      
      const prDetails = await gh.getPRDetails(owner, repo, pullNumber);
      baseBranch = prDetails.base.ref;
    } else {
      Logger.log('Step 2: Audit Mode - Computing diff from baseline to HEAD...');
      
      // Ensure we have latest from main
      runGitCommand('git fetch origin main');
      runGitCommand('git checkout main');
      runGitCommand('git pull origin main');

      const baselineSha = await findAuditBaseline(gh, owner, repo, lookbackCommits);
      Logger.log(`Baseline SHA: ${baselineSha}`);
      
      codeDiff = runGitCommand(`git diff ${baselineSha}...HEAD`);
      if (!codeDiff) {
        Logger.log('No changes found between baseline and HEAD.');
        return { synced: false, changes: [] };
      }
    }

    // 3. Collect Docs
    Logger.log(`Step 3: Searching for documentation matching pattern: ${docPattern}...`);
    const projectDocs = collectDocs(docPattern);
    if (!projectDocs) {
      Logger.warn('No documentation found matching the provided pattern.');
    }

    // 4. Load Prompt
    Logger.log('Step 4: Loading and rendering prompt...');
    const loader = new PromptLoader();
    const definition = await loader.load('doc-sync').catch(err => {
      throw new Error(`Failed to load prompt: ${err instanceof Error ? err.message : String(err)}`);
    });
    
    const prompt = PromptEngine.render(definition, {
      code_diff: codeDiff,
      documentation: projectDocs || 'No documentation provided for these changes.',
    });

    // 5. Generate Structured Output
    Logger.log(`Step 5: Generating doc updates using ${llm}:${model}...`);
    registerAllProviders();
    const provider = ProviderRegistry.create(llm, { apiKey, model });

    const generationResult = await generateStructured(provider, DocSyncSchema, {
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
    if (debug) Logger.debug('Generated Doc Updates:', result);

    if (result.changes.length === 0) {
      Logger.log('No documentation updates needed.');
      return { synced: false, changes: [] };
    }

    // 6. Apply Changes via Git
    Logger.log('Step 6: Applying changes to a sync branch...');
    
    const branchName = pullNumber ? `bot/docs-sync-${pullNumber}` : `bot/docs-sync-audit-${Date.now()}`;
    
    // Setup git identity
    runGitCommand('git config user.name "github-actions[bot]"');
    runGitCommand('git config user.email "github-actions[bot]@users.noreply.github.com"');

    runGitCommand(`git checkout -B ${branchName} origin/${baseBranch}`);

    for (const change of result.changes) {
      const filePath = path.join(process.cwd(), change.path);
      const dirPath = path.dirname(filePath);

      if (change.action === 'create' || change.action === 'update') {
        if (!existsSync(dirPath)) {
          mkdirSync(dirPath, { recursive: true });
        }
        writeFileSync(filePath, change.content, 'utf8');
        Logger.log(`Updated: ${change.path}`);
      } else if (change.action === 'delete') {
        if (existsSync(filePath)) {
          runGitCommand(`git rm ${change.path}`);
          Logger.log(`Deleted: ${change.path}`);
        }
      }
    }

    // Commit and Push
    runGitCommand('git add .');
    const commitMsg = pullNumber 
      ? `docs: sync documentation for PR #${pullNumber}\n\n${result.summary}`
      : `docs: sync documentation audit\n\n${result.summary}`;
    runGitCommand(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
    
    runGitCommand(`git push origin ${branchName} --force`);

    // 7. Open/Update PR
    Logger.log('Step 7: Creating/Updating Sync PR...');
    
    const prTitle = pullNumber 
      ? `docs: sync documentation for PR #${pullNumber}` 
      : `docs: sync documentation audit`;
    const prBody = `## 📄 Documentation Sync\n\n${result.summary}\n\n### Changes\n` + 
      result.changes.map(c => `- ${c.action === 'create' ? '✅ Created' : c.action === 'update' ? '🔄 Updated' : '🗑️ Deleted'}: \`${c.path}\` (${c.explanation})`).join('\n') +
      `\n\n---\n_Auto-generated by Doc Sync Workflow_`;

    const existingPRs = await gh.listPRs(owner, repo, `${owner}:${branchName}`);
    if (existingPRs.length > 0) {
      const pr = existingPRs[0];
      await gh.updatePR(owner, repo, pr.number, prTitle, prBody);
      Logger.log(`Updated existing PR #${pr.number}`);
    } else {
      const newPR = await gh.createPR(owner, repo, prTitle, branchName, baseBranch, prBody);
      Logger.log(`Created new PR #${newPR.number}`);
    }

    Logger.log('Doc Sync Workflow completed successfully.');
    return { synced: true, changes: result.changes };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error(`Workflow failed at step: ${message}`);
    throw error;
  }
}
