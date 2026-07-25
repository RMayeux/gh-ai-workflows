import{a as e,c as t,d as n,f as r,g as i,h as a,i as o,l as s,n as c,o as l,r as u,s as d,t as f,u as p}from"../workflow-runner-_DpMNe5R.mjs";import{t as m}from"../file-system-Br-4RWIy.mjs";import{existsSync as h,mkdirSync as g,writeFileSync as _}from"node:fs";import v from"node:path";import{execSync as y}from"node:child_process";const b=p({summary:n().describe(`Summary of the documentation updates needed based on the code changes`),changes:d(p({path:n().describe(`Relative path to the documentation file`),action:l([`create`,`update`,`delete`]).describe(`The action to perform on the file`),content:n().describe(`The full new content of the file (empty string if action is delete)`),explanation:n().describe(`Short explanation of why this change is needed`)})).describe(`List of suggested documentation changes`)}).strict();p({githubToken:n().min(1),llm:n().min(1),model:n().min(1),apiKey:n().min(1),owner:n().min(1),repo:n().min(1),pullNumber:s().int().positive().optional(),lookbackCommits:s().int().positive().default(10).describe(`Number of commits to look back if no audit PR is found`),docPattern:n().describe(`Regex to find documentation files in the repository`),debug:t().optional()});const x={id:`doc-sync`,system:`You are an expert technical writer ensuring documentation stays perfectly synchronized with the codebase.
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

CRITICAL: The response root MUST be a JSON object with "summary" (string) and "changes" (array). Do NOT return a bare array at the top level.`,overrides:{}};function S(e){try{return y(e,{encoding:`utf8`}).trim()}catch(t){throw a.error(`Git command failed: ${e}\nError: ${t.stderr||t.message}`),t}}async function C(e,t,n,r){a.log(`Searching for last merged audit PR...`);try{let r=(await e.listMergedPRs(t,n)).find(e=>e.merged_at&&(e.title.startsWith(`docs: sync documentation`)||e.title.includes(`Documentation Sync`)));if(r)return a.log(`Found last audit PR #${r.number}. Using its merge commit as baseline.`),(await e.request(`/repos/${t}/${n}/pulls/${r.number}`)).merge_commit_sha}catch(e){a.warn(`Failed to search PR history: ${e instanceof Error?e.message:String(e)}`)}a.log(`No audit PR found. Falling back to lookback of ${r} commits.`);try{return S(`git rev-list -n 1 HEAD~${r}`)}catch{return a.warn(`Lookback of ${r} commits failed (likely fewer commits in history). Falling back to first commit.`),S(`git rev-list --max-parents=0 HEAD`)}}async function w(t){let{githubToken:n,llm:s,model:l,apiKey:d,owner:f,repo:p,pullNumber:y,lookbackCommits:w=10,docPattern:T=`.*\\.md`,debug:E=!1,githubClient:D}=t;E&&a.debug(`Running Doc Sync Workflow for ${f}/${p}${y?`#${y}`:` (Audit Mode)`}`);try{a.log(`Step 1: Initializing GitHub Client...`);let t=D||new r(n),O=new i(t),k=``,A=`main`;if(y)a.log(`Step 2: Fetching PR #${y} diff...`),k=(await O.buildPRContext(f,p,y).catch(e=>{throw Error(`Failed to build PR context: ${e instanceof Error?e.message:String(e)}`)})).diff,A=(await t.getPRDetails(f,p,y)).base.ref;else{a.log(`Step 2: Audit Mode - Computing diff from baseline to HEAD...`),S(`git fetch origin main`),S(`git checkout main`),S(`git pull origin main`);let e=await C(t,f,p,w);if(a.log(`Baseline SHA: ${e}`),k=S(`git diff ${e}...HEAD -- . ':!dist'`),!k)return a.log(`No changes found between baseline and HEAD.`),{synced:!1,changes:[]}}a.log(`Step 3: Searching for documentation matching pattern: ${T}...`);let j=m(T);j||a.warn(`No documentation found matching the provided pattern.`),a.log(`Step 4: Loading and rendering prompt...`);let M=u.render(x,{code_diff:k,documentation:j||`No documentation provided for these changes.`});a.log(`Step 5: Generating doc updates using ${s}:${l}...`),c();let N=await e(o.create(s,{apiKey:d,model:l}),b,{prompt:M.user,systemPrompt:M.system},{maxRetries:3,jsonMode:!0}).catch(e=>{throw Error(`LLM request failed: ${e instanceof Error?e.message:String(e)}`)});if(!N.success)throw Error(`LLM Generation failed: ${N.error}`);let P=N.data;if(E&&a.debug(`Generated Doc Updates:`,P),P.changes.length===0)return a.log(`No documentation updates needed.`),{synced:!1,changes:[]};a.log(`Step 6: Applying changes to a sync branch...`);let F=y?`bot/docs-sync-${y}`:`bot/docs-sync-audit-${Date.now()}`;S(`git config user.name "github-actions[bot]"`),S(`git config user.email "github-actions[bot]@users.noreply.github.com"`),S(`git checkout -B ${F} origin/${A}`);for(let e of P.changes){let t=v.join(process.cwd(),e.path),n=v.dirname(t);e.action===`create`||e.action===`update`?(h(n)||g(n,{recursive:!0}),_(t,e.content,`utf8`),a.log(`Updated: ${e.path}`)):e.action===`delete`&&h(t)&&(S(`git rm ${e.path}`),a.log(`Deleted: ${e.path}`))}S(`git add .`),S(`git commit -m "${(y?`docs: sync documentation for PR #${y}\n\n${P.summary}`:`docs: sync documentation audit\n\n${P.summary}`).replace(/"/g,`\\"`)}"`),S(`git push origin ${F} --force`),a.log(`Step 7: Creating/Updating Sync PR...`);let I=y?`docs: sync documentation for PR #${y}`:`docs: sync documentation audit`,L=`## 📄 Documentation Sync\n\n${P.summary}\n\n### Changes\n`+P.changes.map(e=>`- ${e.action===`create`?`✅ Created`:e.action===`update`?`🔄 Updated`:`🗑️ Deleted`}: \`${e.path}\` (${e.explanation})`).join(`
`)+`

---
_Auto-generated by Doc Sync Workflow_`,R=await t.listPRs(f,p,`${f}:${F}`);if(R.length>0){let e=R[0];await t.updatePR(f,p,e.number,I,L),a.log(`Updated existing PR #${e.number}`)}else{let e=await t.createPR(f,p,I,F,A,L);a.log(`Created new PR #${e.number}`)}return a.log(`Doc Sync Workflow completed successfully.`),{synced:!0,changes:P.changes}}catch(e){let t=e instanceof Error?e.message:String(e);throw a.error(`Workflow failed at step: ${t}`),e}}process.env.NODE_ENV!==`test`&&f(w).run();export{w as runDocSyncWorkflow};