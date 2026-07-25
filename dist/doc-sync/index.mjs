import{a as e,c as t,d as n,f as r,h as i,i as a,l as o,m as s,n as c,o as l,p as u,r as d,s as f,t as p,u as m}from"../workflow-pipeline-D8UQastu.mjs";import{t as h}from"../file-system-CfDL-3oZ.mjs";import{existsSync as g,mkdirSync as _,writeFileSync as v}from"node:fs";import y from"node:path";import{execSync as b}from"node:child_process";const x=t({summary:o().describe(`Summary of the documentation updates needed based on the code changes`),changes:e(t({path:o().describe(`Relative path to the documentation file`),action:a([`create`,`update`,`delete`]).describe(`The action to perform on the file`),content:o().describe(`The full new content of the file (empty string if action is delete)`),explanation:o().describe(`Short explanation of why this change is needed`)})).describe(`List of suggested documentation changes`)}).strict();t({githubToken:o().min(1),llm:o().min(1),model:o().min(1),apiKey:o().min(1),owner:o().min(1),repo:o().min(1),pullNumber:f().int().positive().optional(),lookbackCommits:f().int().positive().default(10).describe(`Number of commits to look back if no audit PR is found`),docPattern:o().describe(`Regex to find documentation files in the repository`),debug:l().optional(),summaryLlm:o().optional(),summaryModel:o().optional()});const S={id:`doc-sync`,system:`You are an expert technical writer ensuring documentation stays perfectly synchronized with the codebase.
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

CRITICAL: The response root MUST be a JSON object with "summary" (string) and "changes" (array). Do NOT return a bare array at the top level.`,overrides:{}};function C(e){try{return b(e,{encoding:`utf8`}).trim()}catch(t){throw s.error(`Git command failed: ${e}\nError: ${t.stderr||t.message}`),t}}async function w(e,t,n,r){s.log(`Searching for last merged audit PR...`);try{let r=(await e.listMergedPRs(t,n)).find(e=>e.merged_at&&(e.title.startsWith(`docs: sync documentation`)||e.title.includes(`Documentation Sync`)));if(r)return s.log(`Found last audit PR #${r.number}. Using its merge commit as baseline.`),(await e.request(`/repos/${t}/${n}/pulls/${r.number}`)).merge_commit_sha}catch(e){s.warn(`Failed to search PR history: ${e instanceof Error?e.message:String(e)}`)}s.log(`No audit PR found. Falling back to lookback of ${r} commits.`);try{return C(`git rev-list -n 1 HEAD~${r}`)}catch{return s.warn(`Lookback of ${r} commits failed. Falling back to first commit.`),C(`git rev-list --max-parents=0 HEAD`)}}async function T(e,t,n){if(e.changes.length===0)return s.log(`No documentation updates needed.`),!1;s.log(`Applying changes to a sync branch...`);let r=t?`bot/docs-sync-${t}`:`bot/docs-sync-audit-${Date.now()}`;C(`git config user.name "github-actions[bot]"`),C(`git config user.email "github-actions[bot]@users.noreply.github.com"`),C(`git checkout -B ${r} origin/${n}`);for(let t of e.changes){let e=y.join(process.cwd(),t.path),n=y.dirname(e);t.action===`create`||t.action===`update`?(g(n)||_(n,{recursive:!0}),v(e,t.content,`utf8`),s.log(`Updated: ${t.path}`)):t.action===`delete`&&g(e)&&(C(`git rm ${t.path}`),s.log(`Deleted: ${t.path}`))}return C(`git add .`),C(`git commit -m "${(t?`docs: sync documentation for PR #${t}\n\n${e.summary}`:`docs: sync documentation audit\n\n${e.summary}`).replace(/"/g,`\\"`)}"`),C(`git push origin ${r} --force`),!0}async function E(e,t,n,r,i,a){let o=r?`docs: sync documentation for PR #${r}`:`docs: sync documentation audit`,c=`## 📄 Documentation Sync\n\n${i.summary}\n\n### Changes\n`+i.changes.map(e=>`- ${e.action===`create`?`✅ Created`:e.action===`update`?`🔄 Updated`:`🗑️ Deleted`}: \`${e.path}\` (${e.explanation})`).join(`
`)+`

---
_Auto-generated by Doc Sync Workflow_`,l=r?`bot/docs-sync-${r}`:`bot/docs-sync-audit-${Date.now()}`,u=await e.listPRs(t,n,`${t}:${l}`);if(u.length>0){let r=u[0];await e.updatePR(t,n,r.number,o,c),s.log(`Updated existing PR #${r.number}`)}else{let r=await e.createPR(t,n,o,l,a,c);s.log(`Created new PR #${r.number}`)}}async function D(e){let{owner:t,repo:a,githubToken:o,apiKey:c,llm:l,model:f,docPattern:p,lookbackCommits:g,summaryLlm:_,summaryModel:v,githubClient:y}=e,b=y||new i(o);C(`git fetch origin main`),C(`git checkout main`),C(`git pull origin main`);let D=await w(b,t,a,g??10);s.log(`Baseline SHA: ${D}`);let O=C(`git diff ${D}...HEAD -- . ':!dist'`);if(!O)return s.log(`No changes found between baseline and HEAD.`),{synced:!1,changes:[]};if(_&&v){m();let e=u.create(_,{apiKey:c,model:v});O=await n(O,e)}let k=h(p??`.*\\.md`),A=r.render(S,{code_diff:O,documentation:k||`No documentation provided for these changes.`});m();let j=await d(u.create(l,{apiKey:c,model:f}),x,{prompt:A.user,systemPrompt:A.system},{maxRetries:3,jsonMode:!0});if(!j.success)throw Error(`LLM Generation failed: ${j.error}`);let M=j.data,N=await T(M,void 0,`main`);return N&&await E(b,t,a,void 0,M,`main`),{synced:N,changes:M.changes}}async function O(e){let{owner:t,repo:n,pullNumber:r,debug:i,docPattern:a,apiKey:o,llm:c,model:l,githubToken:u,summaryLlm:d,summaryModel:f,githubClient:m}=e;i&&s.debug(`Running Doc Sync Workflow for ${t}/${n}${r?`#${r}`:` (Audit Mode)`}`);try{if(!r)return D(e);let s=await p({githubToken:u,llm:c,model:l,apiKey:o,owner:t,repo:n,pullNumber:r,debug:i,summaryLlm:d,summaryModel:f,githubClient:m},{promptDef:S,schema:x,prepareVariables:async({codeDiff:e})=>({code_diff:e,documentation:h(a??`.*\\.md`)||`No documentation provided for these changes.`}),handleResult:async({gh:e},i)=>{let a=(await e.getPRDetails(t,n,r)).base.ref;await T(i,r,a)&&await E(e,t,n,r,i,a)}});return{synced:s.changes.length>0,changes:s.changes}}catch(e){let t=e instanceof Error?e.message:String(e);throw s.error(`Workflow failed at step: ${t}`),e}}process.env.NODE_ENV!==`test`&&c(O).run();export{O as runDocSyncWorkflow};