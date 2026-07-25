import{_ as e,a as t,c as n,d as r,f as i,g as a,i as o,l as s,n as c,o as l,p as u,r as d,s as f,t as p,u as m}from"../workflow-runner-DqAlT4Z4.mjs";import{t as h}from"../file-system-BEi2Aye1.mjs";import{existsSync as g,mkdirSync as _,writeFileSync as v}from"node:fs";import y from"node:path";import{execSync as b}from"node:child_process";const x=r({summary:i().describe(`Summary of the documentation updates needed based on the code changes`),changes:n(r({path:i().describe(`Relative path to the documentation file`),action:f([`create`,`update`,`delete`]).describe(`The action to perform on the file`),content:i().describe(`The full new content of the file (empty string if action is delete)`),explanation:i().describe(`Short explanation of why this change is needed`)})).describe(`List of suggested documentation changes`)}).strict();r({githubToken:i().min(1),llm:i().min(1),model:i().min(1),apiKey:i().min(1),owner:i().min(1),repo:i().min(1),pullNumber:m().int().positive().optional(),lookbackCommits:m().int().positive().default(10).describe(`Number of commits to look back if no audit PR is found`),docPattern:i().describe(`Regex to find documentation files in the repository`),debug:s().optional(),summaryLlm:i().optional(),summaryModel:i().optional()});const S={id:`doc-sync`,system:`You are an expert technical writer ensuring documentation stays perfectly synchronized with the codebase.
Your goal is the most precise, minimal set of documentation changes needed — no more, no less.
Maintain the existing tone, style, and structure of the documentation at all times.
Do not output any reasoning or analysis. Output only the final result.
You MUST always respond with a single JSON object — never a bare array. The root must be an object with exactly two keys: "summary" and "changes".`,user:`---
## PR code changes:
{{code_diff}}
## Existing documentation:
{{documentation}}
---
## Rules
- Analyze the diff to identify what features, APIs, or behaviors changed
- Only update documentation that is directly affected by this diff
- If a new feature was added with no existing doc, specify where a new file should be created following the project's existing structure
- If a feature was removed, flag the doc for deletion or update — do not keep stale content
- If only internal implementation changed with no behavior or API impact, skip it
- Do not rewrite sections that are still accurate
- If no documentation changes are needed, return an empty changes array and a summary stating so
---
## Output format
You MUST return a single JSON object — not an array, not markdown, not any wrapper. The root level must be an object.

\`\`\`json
{
  "summary": "A concise summary of the documentation updates needed based on the code changes",
  "changes": [
    {
      "path": "relative/path/to/doc.md",
      "action": "update" | "create" | "delete",
      "content": "The full new content of the file (empty string if action is delete)",
      "explanation": "Short explanation of why this change is needed"
    }
  ]
}
\`\`\`

CRITICAL: The response root MUST be a JSON object with "summary" (string) and "changes" (array). Do NOT return a bare array at the top level.`,overrides:{}};function C(e){try{return b(e,{encoding:`utf8`}).trim()}catch(t){throw a.error(`Git command failed: ${e}\nError: ${t.stderr||t.message}`),t}}async function w(e,t,n,r){a.log(`Searching for last merged audit PR...`);try{let r=(await e.listMergedPRs(t,n)).find(e=>e.merged_at&&(e.title.startsWith(`docs: sync documentation`)||e.title.includes(`Documentation Sync`)));if(r)return a.log(`Found last audit PR #${r.number}. Using its merge commit as baseline.`),(await e.request(`/repos/${t}/${n}/pulls/${r.number}`)).merge_commit_sha}catch(e){a.warn(`Failed to search PR history: ${e instanceof Error?e.message:String(e)}`)}a.log(`No audit PR found. Falling back to lookback of ${r} commits.`);try{return C(`git rev-list -n 1 HEAD~${r}`)}catch{return a.warn(`Lookback of ${r} commits failed (likely fewer commits in history). Falling back to first commit.`),C(`git rev-list --max-parents=0 HEAD`)}}async function T(n){let{githubToken:r,llm:i,model:s,apiKey:f,owner:p,repo:m,pullNumber:b,lookbackCommits:T=10,docPattern:E=`.*\\.md`,debug:D=!1,summaryLlm:O,summaryModel:k,githubClient:A}=n;D&&a.debug(`Running Doc Sync Workflow for ${p}/${m}${b?`#${b}`:` (Audit Mode)`}`);try{a.log(`Step 1: Initializing GitHub Client...`);let n=A||new u(r),j=new e(n),M=``,N=`main`;if(b){if(a.log(`Step 2: Fetching PR #${b} diff...`),M=(await j.buildPRContext(p,m,b).catch(e=>{throw Error(`Failed to build PR context: ${e instanceof Error?e.message:String(e)}`)})).diff,O&&k){a.log(`Step 2b: Summarizing large diff...`),c();let e=t.create(O,{apiKey:f,model:k});M=await d(M,e)}N=(await n.getPRDetails(p,m,b)).base.ref}else{a.log(`Step 2: Audit Mode - Computing diff from baseline to HEAD...`),C(`git fetch origin main`),C(`git checkout main`),C(`git pull origin main`);let e=await w(n,p,m,T);if(a.log(`Baseline SHA: ${e}`),M=C(`git diff ${e}...HEAD -- . ':!dist'`),!M)return a.log(`No changes found between baseline and HEAD.`),{synced:!1,changes:[]};if(O&&k){a.log(`Step 2b: Summarizing large diff...`),c();let e=t.create(O,{apiKey:f,model:k});M=await d(M,e)}}a.log(`Step 3: Searching for documentation matching pattern: ${E}...`);let P=h(E);P||a.warn(`No documentation found matching the provided pattern.`),a.log(`Step 4: Loading and rendering prompt...`);let F=o.render(S,{code_diff:M,documentation:P||`No documentation provided for these changes.`});a.log(`Step 5: Generating doc updates using ${i}:${s}...`),c();let I=await l(t.create(i,{apiKey:f,model:s}),x,{prompt:F.user,systemPrompt:F.system},{maxRetries:3,jsonMode:!0}).catch(e=>{throw Error(`LLM request failed: ${e instanceof Error?e.message:String(e)}`)});if(!I.success)throw Error(`LLM Generation failed: ${I.error}`);let L=I.data;if(D&&a.debug(`Generated Doc Updates:`,L),L.changes.length===0)return a.log(`No documentation updates needed.`),{synced:!1,changes:[]};a.log(`Step 6: Applying changes to a sync branch...`);let R=b?`bot/docs-sync-${b}`:`bot/docs-sync-audit-${Date.now()}`;C(`git config user.name "github-actions[bot]"`),C(`git config user.email "github-actions[bot]@users.noreply.github.com"`),C(`git checkout -B ${R} origin/${N}`);for(let e of L.changes){let t=y.join(process.cwd(),e.path),n=y.dirname(t);e.action===`create`||e.action===`update`?(g(n)||_(n,{recursive:!0}),v(t,e.content,`utf8`),a.log(`Updated: ${e.path}`)):e.action===`delete`&&g(t)&&(C(`git rm ${e.path}`),a.log(`Deleted: ${e.path}`))}C(`git add .`),C(`git commit -m "${(b?`docs: sync documentation for PR #${b}\n\n${L.summary}`:`docs: sync documentation audit\n\n${L.summary}`).replace(/"/g,`\\"`)}"`),C(`git push origin ${R} --force`),a.log(`Step 7: Creating/Updating Sync PR...`);let z=b?`docs: sync documentation for PR #${b}`:`docs: sync documentation audit`,B=`## 📄 Documentation Sync\n\n${L.summary}\n\n### Changes\n`+L.changes.map(e=>`- ${e.action===`create`?`✅ Created`:e.action===`update`?`🔄 Updated`:`🗑️ Deleted`}: \`${e.path}\` (${e.explanation})`).join(`
`)+`

---
_Auto-generated by Doc Sync Workflow_`,V=await n.listPRs(p,m,`${p}:${R}`);if(V.length>0){let e=V[0];await n.updatePR(p,m,e.number,z,B),a.log(`Updated existing PR #${e.number}`)}else{let e=await n.createPR(p,m,z,R,N,B);a.log(`Created new PR #${e.number}`)}return a.log(`Doc Sync Workflow completed successfully.`),{synced:!0,changes:L.changes}}catch(e){let t=e instanceof Error?e.message:String(e);throw a.error(`Workflow failed at step: ${t}`),e}}process.env.NODE_ENV!==`test`&&p(T).run();export{T as runDocSyncWorkflow};