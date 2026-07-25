import{a as e,c as t,d as n,f as r,g as i,h as a,i as o,n as s,o as c,p as l,r as u,s as d,t as f,u as p}from"../workflow-runner-C3E85YtQ.mjs";const m=p({title:n().min(1,`Title is required`).max(72,`Title must be under 72 characters`),body:n().min(1,`Body is required`),change_type:c([`feat`,`fix`,`refactor`,`perf`,`docs`,`test`,`build`,`ci`,`chore`]),breaking:t().default(!1),doc_impact:t().default(!1),doc_slugs:d(n()).default([])}),h={id:`pr-metadata`,system:`You are a staff-level engineer analyzing a pull request.
Your task: read the diff and produce structured PR metadata.
---
# OUTPUT SCHEMA
Return VALID JSON ONLY.
- No markdown code fences (no \`\`\`json).
- No preamble, no explanation, no conversational text.
- Start your response immediately with \`{\` and end with \`}\`.
- ALL keys MUST be enclosed in double quotes.
- ALL string values MUST be enclosed in double quotes.
- No trailing commas.

Example of CORRECT format:
{
  "title": "feat(auth): add token refresh rotation",
  "body": "## What changed\\nOne paragraph describing changes.\\n\\n## Impacted features\\n| Domain | Feature | Impact |\\n|---|---|---|\\n| auth | login | Session expiry resets on activity |",
  "change_type": "feat"
}

Example of INCORRECT format (DO NOT DO THIS):
Here is the metadata:
{
  title: "feat(auth): add token refresh rotation",
  "body": '...',
  "change_type": "feat"
}

Actual schema to follow:
{
  "title": "string (max 72 chars)",
  "body": "string",
  "change_type": "feat|fix|refactor|perf|docs|test|build|ci|chore"
}
---
# TITLE RULES
- Under 72 characters
- Conventional commit style: type(domain): description
- Infer the domain from the diff — it is the logical business area most affected
  (e.g. "auth", "billing", "search"), not a filename, folder, or layer name
- If multiple domains changed, pick the one with the highest user/business impact
- Be specific. "feat(auth): add token refresh rotation" not "feat: update auth"

Allowed types: feat fix refactor perf docs test build ci chore
---
# BODY RULES
Use this exact structure. Omit a section entirely if it has nothing to say.

## What changed
One paragraph. Written for a reviewer who knows the codebase but not this PR.
Focus on WHAT changed from a feature/behavior perspective, not HOW.
Group by domain if multiple features are touched.
Mention renamed endpoints or changed contracts only if consumers need updating.
Never list files. Never describe implementation details.

## Impacted features
| Domain | Feature | Impact |
|--------|---------|--------|
| auth   | login   | Session expiry now resets on activity |

Only include features with real behavioral change.
Infer domain and feature names from the logical groupings in the diff.
Do not invent slugs from assumed directory conventions.
---
# ANALYSIS RULES
Think about features, not files.
Ask: "What can a user or system DO differently after this PR?"

You MUST identify:
- New or changed feature behavior (the main job)
- Removed or replaced flows
- Schema or contract changes that affect feature behavior
- Permission or access changes

You MUST NOT:
- List files, routes, or folder paths as the subject of any description
- Mention frontend/UI changes unless they reflect a business rule change
- Mention dependency bumps unless they change observable behavior
- Mention formatting, linting, or generated files
- Hallucinate features not evidenced by the diff`,user:`# FEATURE REGISTRY
{{registry}}

# CHANGED FILES
{{changed_files}}

# CODE DIFF
{{code_diff}}`,overrides:{}};async function g(t){let{githubToken:n,llm:c,model:d,apiKey:f,owner:p,repo:g,pullNumber:_,maxTokens:v=4096,debug:y=!1,githubClient:b}=t;y&&a.debug(`Running PR Metadata Workflow for ${p}/${g}#${_}`);try{a.log(`Step 1: Initializing GitHub Client...`);let t=b||new r(n),x=new i(t);a.log(`Step 2: Fetching PR diff and files...`);let S=await x.buildPRContext(p,g,_).catch(e=>{throw Error(`Failed to build PR context: ${e.message}`)});a.log(`Step 3: Loading and rendering prompt...`);let C=u.render(h,{registry:``,changed_files:S.files.join(`\\n`),code_diff:S.diff,pr_title:S.details.title,pr_body:S.details.body??``});a.log(`Step 4: Generating metadata using ${c}:${d}...`),s();let w=await e(o.create(c,{apiKey:f,model:d}),m,{prompt:C.user,systemPrompt:C.system,maxTokens:v},{maxRetries:3,jsonMode:!0}).catch(e=>{throw Error(`LLM request failed: ${e.message}`)});if(!w.success)throw Error(`LLM Generation failed: ${w.error}`);let T=w.data;y&&a.debug(`Generated Metadata:`,T),a.log(`Step 5: Updating PR title, body and labels...`),await t.updatePR(p,g,_,T.title,T.body).catch(e=>{throw Error(`Failed to update PR: ${e.message}`)});let E=[];T.change_type&&E.push(T.change_type),T.breaking&&E.push(`breaking-change`),T.doc_impact&&E.push(`doc-impact`);let D=S.details.additions+S.details.deletions;return D<50?E.push(`size/XS`):D<200?E.push(`size/S`):D<500?E.push(`size/M`):D<1e3?E.push(`size/L`):E.push(`size/XL`),await l(t,p,g,_,{add:E}),a.log(`PR Metadata Workflow completed successfully.`),T}catch(e){let t=e instanceof Error?e.message:String(e);throw a.error(`Workflow failed at step: ${t}`),e}}process.env.NODE_ENV!==`test`&&f(g,{requiredEnvVars:[`GITHUB_EVENT_PULL_REQUEST_NUMBER`]}).run();export{g as runPRMetadataWorkflow};