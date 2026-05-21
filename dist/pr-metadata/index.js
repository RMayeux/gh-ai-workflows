import{a as e,d as t,f as n,h as r,i,l as a,m as o,n as s,o as c,r as l,s as u,t as d,u as f}from"../llm-DEcbmguB.mjs";const p=a({title:f().min(1,`Title is required`).max(72,`Title must be under 72 characters`),body:f().min(1,`Body is required`),change_type:e([`feat`,`fix`,`refactor`,`perf`,`docs`,`test`,`build`,`ci`,`chore`]),breaking:u().default(!1),doc_impact:u().default(!1),doc_slugs:c(f()).default([])}),m={id:`pr-metadata`,system:`You are a staff-level engineer analyzing a pull request.
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
{{code_diff}}`,overrides:{}};async function h(e){let{githubToken:a,llm:c,model:u,apiKey:f,owner:h,repo:g,pullNumber:_,maxTokens:v=4096,debug:y=!1,githubClient:b}=e;y&&o.debug(`Running PR Metadata Workflow for ${h}/${g}#${_}`);try{o.log(`Step 1: Initializing GitHub Client...`);let e=b||new t(a),x=new r(e);o.log(`Step 2: Fetching PR diff and files...`);let S=await x.buildPRContext(h,g,_).catch(e=>{throw Error(`Failed to build PR context: ${e.message}`)});o.log(`Step 3: Loading and rendering prompt...`);let C=s.render(m,{registry:``,changed_files:S.files.join(`\\n`),code_diff:S.diff,pr_title:S.details.title,pr_body:S.details.body??``});o.log(`Step 4: Generating metadata using ${c}:${u}...`),d();let w=await i(l.create(c,{apiKey:f,model:u}),p,{prompt:C.user,systemPrompt:C.system,maxTokens:v},{maxRetries:3,jsonMode:!0}).catch(e=>{throw Error(`LLM request failed: ${e.message}`)});if(!w.success)throw Error(`LLM Generation failed: ${w.error}`);let T=w.data;y&&o.debug(`Generated Metadata:`,T),o.log(`Step 5: Updating PR title, body and labels...`),await e.updatePR(h,g,_,T.title,T.body).catch(e=>{throw Error(`Failed to update PR: ${e.message}`)});let E=[];T.change_type&&E.push(T.change_type),T.breaking&&E.push(`breaking-change`),T.doc_impact&&E.push(`doc-impact`);let D=S.details.additions+S.details.deletions;return D<50?E.push(`size/XS`):D<200?E.push(`size/S`):D<500?E.push(`size/M`):D<1e3?E.push(`size/L`):E.push(`size/XL`),await n(e,h,g,_,{add:E}),o.log(`PR Metadata Workflow completed successfully.`),T}catch(e){let t=e instanceof Error?e.message:String(e);throw o.error(`Workflow failed at step: ${t}`),e}}async function g(){let e={GITHUB_TOKEN:process.env.GITHUB_TOKEN,LLM:process.env.LLM,MODEL:process.env.MODEL,API_KEY:process.env.API_KEY,GITHUB_REPOSITORY_OWNER:process.env.GITHUB_REPOSITORY_OWNER,GITHUB_REPOSITORY_NAME:process.env.GITHUB_REPOSITORY_NAME,GITHUB_EVENT_PULL_REQUEST_NUMBER:process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER},t=Object.entries(e).filter(([e,t])=>!t).map(([e])=>e);t.length>0&&(console.error(`Missing required environment variables:`),console.error(t.join(`, `)),process.exit(1));let n={githubToken:process.env.GITHUB_TOKEN||``,llm:process.env.LLM||``,model:process.env.MODEL||``,apiKey:process.env.API_KEY||``,owner:process.env.GITHUB_REPOSITORY_OWNER||``,repo:process.env.GITHUB_REPOSITORY_NAME||``,pullNumber:parseInt(process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER||`0`,10),maxTokens:process.env.MAX_TOKENS?parseInt(process.env.MAX_TOKENS,10):4096,debug:process.env.DEBUG===`true`};try{await h(n),process.exit(0)}catch(e){console.error(`Workflow failed:`,e),process.exit(1)}}process.env.NODE_ENV!==`test`&&g();export{h as runPRMetadataWorkflow};