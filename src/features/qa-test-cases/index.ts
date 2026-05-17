import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { GitHubClient, ContextBuilder } from '@platform/github';
import { generateStructured, ProviderRegistry, PromptEngine, PromptLoader, Logger } from '@core';
import { registerAllProviders } from '@platform/llm';
import { QATestCasesSchema, QATestCasesInputs } from './schema';

/**
 * Collects content of documentation files that match a given regex.
 */
function collectDocs(docPattern: string): string {
  const matchedDocs = new Set<string>();
  let docContent = '';
  const regex = new RegExp(docPattern);

  // Recursively find all files in the repository
  const allFiles = getAllFilesRecursive(process.cwd());
  
  for (const file of allFiles) {
    const relativePath = path.relative(process.cwd(), file);
    if (regex.test(relativePath)) {
      matchedDocs.add(file);
      try {
        const content = readFileSync(file, 'utf8');
        docContent += `\n\n--- FILE: ${relativePath} ---\n${content}`;
      } catch (err) {
        Logger.error(`Failed to read doc file ${relativePath}: ${err.message}`);
      }
    }
  }

  return docContent;
}

function getAllFilesRecursive(dir: string): string[] {
  let results: string[] = [];
  const list = readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    if (existsSync(fullPath) && !path.extname(fullPath)) {
      // It's a directory - skip .git and node_modules for performance
      const baseName = path.basename(fullPath);
      if (baseName === '.git' || baseName === 'node_modules' || baseName === 'dist') continue;
      try {
        results = results.concat(getAllFilesRecursive(fullPath));
      } catch (e) {}
    } else if (existsSync(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

export async function runQATestCasesWorkflow(inputs: QATestCasesInputs & { githubClient?: GitHubClient }) {
  const {
    githubToken,
    llm,
    model,
    apiKey,
    owner,
    repo,
    pullNumber,
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
      throw new Error(`Failed to build PR context: ${err.message}`);
    });

    // 3. Collect Docs (Optional)
    let impactedDocs = '';
    if (docPattern) {
      Logger.log(`Step 3: Searching for documentation matching pattern: ${docPattern}...`);
      impactedDocs = collectDocs(docPattern);
      if (!impactedDocs) {
        Logger.warn('No documentation found matching the provided pattern.');
      }
    } else {
      Logger.log('Step 3: No docPattern provided, skipping documentation collection.');
    }

    // 4. Load Prompt
    Logger.log('Step 4: Loading and rendering prompt...');
    const loader = new PromptLoader();
    const definition = await loader.load('qa-test-cases').catch(err => {
      throw new Error(`Failed to load prompt: ${err.message}`);
    });
    
    const prompt = PromptEngine.render(definition, {
      code_diff: context.diff,
      impacted_docs: impactedDocs || 'No documentation provided for these changes.',
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
      throw new Error(`LLM request failed: ${err.message}`);
    });

    if (!generationResult.success) {
      throw new Error(`LLM Generation failed: ${generationResult.error}`);
    }

    const result = generationResult.data!;
    if (debug) Logger.debug('Generated QA Test Cases:', result);

    // 6. GitHub Integration
    Logger.log('Step 6: Updating GitHub PR...');

    // Cleanup old QA comments
    try {
      const comments = await gh.listComments(owner, repo, pullNumber);
      const qaComments = comments.filter(c => c.body?.includes('🧪 QA Test Cases'));
      for (const comment of qaComments) {
        await gh.deleteComment(owner, repo, pullNumber, comment.id);
      }
      if (qaComments.length > 0) {
        Logger.log(`Removed ${qaComments.length} previous QA comments.`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      Logger.error(`Failed to clean up old comments: ${message}`);
    }

    // Format output
    const featureList = result.impactedFeatures.map(f => f.featureSlug).join(', ');
    let body = `## 🧪 QA Test Cases\n\n`;
    body += `**${result.totalTests} tests — ${featureList}**\n`;
    body += `_${result.summary}_\n\n`;

    for (const feature of result.impactedFeatures) {
      body += `### ${feature.featureSlug}\n`;
      for (const tc of feature.testCases) {
        body += `- [ ] ${tc}\n`;
      }
      body += `\n`;
    }
    body += `\n---\n_Re-trigger by adding the \`qa-ready\` label._`;

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
