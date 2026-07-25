import{_ as e,a as t,c as n,d as r,f as i,i as a,l as o,m as s,n as c,o as l,p as u,r as d,s as f,t as p,u as m}from"../workflow-pipeline-BIGenON_.mjs";import{t as h}from"../file-system--0vQ0XrS.mjs";import{existsSync as g,mkdirSync as _,writeFileSync as v}from"node:fs";import y from"node:path";import{execSync as b}from"node:child_process";const x=n({summary:o().describe(`Summary of the documentation updates needed based on the code changes`),changes:t(n({path:o().describe(`Relative path to the documentation file`),action:a([`create`,`update`,`delete`]).describe(`The action to perform on the file`),content:o().describe(`The full new content of the file (empty string if action is delete)`),explanation:o().describe(`Short explanation of why this change is needed`)})).describe(`List of suggested documentation changes`)}).strict();n({githubToken:o().min(1),llm:o().min(1),model:o().min(1),apiKey:o().min(1),owner:o().min(1),repo:o().min(1),pullNumber:f().int().positive().optional(),lookbackCommits:f().int().positive().default(10).describe(`Number of commits to look back if no audit PR is found`),docPattern:o().describe(`Regex to find documentation files in the repository`),debug:l().optional(),summaryLlm:o().optional(),summaryModel:o().optional()});const S={id:`doc-sync`,system:`You are an expert technical writer ensuring documentation stays perfectly synchronized with the codebase.
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

CRITICAL: The response root MUST be a JSON object with "summary" (string) and "changes" (array). Do NOT return a bare array at the top level.`,overrides:{}};function C(t){try{return b(t,{encoding:`utf8`}).trim()}catch(n){throw e.error(`Git command failed: ${t}\nError: ${n.stderr||n.message}`),n}}async function w(t,n,r,i){e.log(`Searching for last merged audit PR...`);try{let i=(await t.listMergedPRs(n,r)).find(e=>e.merged_at&&(e.title.startsWith(`docs: sync documentation`)||e.title.includes(`Documentation Sync`)));if(i)return e.log(`Found last audit PR #${i.number}. Using its merge commit as baseline.`),(await t.request(`/repos/${n}/${r}/pulls/${i.number}`)).merge_commit_sha}catch(t){e.warn(`Failed to search PR history: ${t instanceof Error?t.message:String(t)}`)}e.log(`No audit PR found. Falling back to lookback of ${i} commits.`);try{return C(`git rev-list -n 1 HEAD~${i}`)}catch{return e.warn(`Lookback of ${i} commits failed. Falling back to first commit.`),C(`git rev-list --max-parents=0 HEAD`)}}async function T(t,n,r){if(t.changes.length===0)return e.log(`No documentation updates needed.`),!1;e.log(`Applying changes to a sync branch...`);let i=n?`bot/docs-sync-${n}`:`bot/docs-sync-audit-${Date.now()}`;C(`git config user.name "github-actions[bot]"`),C(`git config user.email "github-actions[bot]@users.noreply.github.com"`),C(`git checkout -B ${i} origin/${r}`);for(let n of t.changes){let t=y.join(process.cwd(),n.path),r=y.dirname(t);n.action===`create`||n.action===`update`?(g(r)||_(r,{recursive:!0}),v(t,n.content,`utf8`),e.log(`Updated: ${n.path}`)):n.action===`delete`&&g(t)&&(C(`git rm ${n.path}`),e.log(`Deleted: ${n.path}`))}return C(`git add .`),C(`git commit -m "${(n?`docs: sync documentation for PR #${n}\n\n${t.summary}`:`docs: sync documentation audit\n\n${t.summary}`).replace(/"/g,`\\"`)}"`),C(`git push origin ${i} --force`),!0}async function E(t,n,r,i,a,o){let s=i?`docs: sync documentation for PR #${i}`:`docs: sync documentation audit`,c=`## 📄 Documentation Sync\n\n${a.summary}\n\n### Changes\n`+a.changes.map(e=>`- ${e.action===`create`?`✅ Created`:e.action===`update`?`🔄 Updated`:`🗑️ Deleted`}: \`${e.path}\` (${e.explanation})`).join(`
`)+`

---
_Auto-generated by Doc Sync Workflow_`,l=i?`bot/docs-sync-${i}`:`bot/docs-sync-audit-${Date.now()}`,u=await t.listPRs(n,r,`${n}:${l}`);if(u.length>0){let i=u[0];await t.updatePR(n,r,i.number,s,c),e.log(`Updated existing PR #${i.number}`)}else{let i=await t.createPR(n,r,s,l,o,c);e.log(`Created new PR #${i.number}`)}}async function D(t){let{owner:n,repo:a,githubToken:o,apiKey:c,llm:l,model:f,docPattern:p,lookbackCommits:g,summaryLlm:_,summaryModel:v,githubClient:y}=t,b=y||new s(o);C(`git fetch origin main`),C(`git checkout main`),C(`git pull origin main`);let D=await w(b,n,a,g??10);e.log(`Baseline SHA: ${D}`);let O=C(`git diff ${D}...HEAD -- . ':!dist'`);if(!O)return e.log(`No changes found between baseline and HEAD.`),{synced:!1,changes:[]};if(_&&v){m();let e=u.create(_,{apiKey:c,model:v});O=await r(O,e)}let k=h(p??`.*\\.md`),A=i.render(S,{code_diff:O,documentation:k||`No documentation provided for these changes.`});m();let j=await d(u.create(l,{apiKey:c,model:f}),x,{prompt:A.user,systemPrompt:A.system},{maxRetries:3,jsonMode:!0});if(!j.success)throw Error(`LLM Generation failed: ${j.error}`);let M=j.data,N=await T(M,void 0,`main`);return N&&await E(b,n,a,void 0,M,`main`),{synced:N,changes:M.changes}}async function O(t){let{owner:n,repo:r,pullNumber:i,debug:a,docPattern:o,apiKey:s,llm:c,model:l,githubToken:u,summaryLlm:d,summaryModel:f,githubClient:m}=t;a&&e.debug(`Running Doc Sync Workflow for ${n}/${r}${i?`#${i}`:` (Audit Mode)`}`);try{if(!i)return D(t);let e=await p({githubToken:u,llm:c,model:l,apiKey:s,owner:n,repo:r,pullNumber:i,debug:a,summaryLlm:d,summaryModel:f,githubClient:m},{promptDef:S,schema:x,prepareVariables:async({codeDiff:e})=>({code_diff:e,documentation:h(o??`.*\\.md`)||`No documentation provided for these changes.`}),handleResult:async({gh:e},t)=>{let a=(await e.getPRDetails(n,r,i)).base.ref;await T(t,i,a)&&await E(e,n,r,i,t,a)}});return{synced:e.changes.length>0,changes:e.changes}}catch(t){let n=t instanceof Error?t.message:String(t);throw e.error(`Workflow failed at step: ${n}`),t}}process.env.NODE_ENV!==`test`&&c(O).run();export{O as runDocSyncWorkflow};