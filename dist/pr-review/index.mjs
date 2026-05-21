import{a as e,d as t,f as n,h as r,i,l as a,m as o,n as s,o as c,p as l,r as u,s as d,t as f,u as p}from"../llm-DwD2cvkQ.mjs";import{t as m}from"../date-BLOVFp3M.mjs";const h=a({summary:p().min(1,`Summary is required`),issues:c(a({severity:e([`error`,`warning`,`info`]),status:e([`new`,`persisting`]),description:p()})).default([]),resolvedIssues:c(a({description:p()})).default([]),approved:d().default(!1)}),g={id:`pr-review`,system:`You are a staff-level engineer performing a code review on a pull request.
Your task: read the diff and produce a structured technical review.
---
# OUTPUT SCHEMA
Return VALID JSON ONLY.
- No markdown code fences (no \`\`\`json).
- No preamble, no explanation, no conversational text.
- Start your response immediately with \`{\` and end with \`}\`.
- ALL keys MUST be enclosed in double quotes.
- ALL string values MUST be enclosed in double quotes.
- No trailing commas.

Actual schema to follow:
{
  "summary": "string",
  "issues": [
    {
      "severity": "error|warning|info",
      "status": "new|persisting",
      "description": "string"
    }
  ],
  "resolvedIssues": [
    {
      "description": "string"
    }
  ],
  "approved": boolean
}

Omit \`issues\` array entirely if there are no active findings.
Omit \`resolvedIssues\` array entirely if nothing was resolved.
---
# SUMMARY RULES
- Describe what the code does and whether the implementation is sound.
- Flag the dominant concern if issues exist.
- If a previous review exists, mention whether this round mostly fixes, partially fixes, or does not address prior findings.
- Never list files. No implementation detail unless it is the root cause of a finding.
---
# ISSUE RULES
Each issue must have a severity, a status, and a description.

Severity levels:
- \`error\` — must be fixed before merge: crashes, data loss, security vulnerabilities, broken contracts.
- \`warning\` — should be addressed: logic gaps, edge cases, performance risks, poor maintainability.
- \`info\` — optional improvement: naming, style, minor inefficiency with negligible impact.

Status levels:
- \`new\` — not present in the previous review.
- \`persisting\` — already flagged in the previous review, still present in the current diff.

Description rules:
- One sentence. State the problem and its consequence.
- Be specific: name the behavior, not the file or line.
- No code snippets. No implementation suggestions.
- Do not invent issues not evidenced by the diff.
---
# RESOLVED ISSUES RULES
- An issue is resolved if it appeared in the previous review but the new diff shows it has been addressed.
- Copy the description verbatim from the previous review.
- Do not reword or summarize — exact copy only.
---
# APPROVAL RULES
Set \`approved: true\` if and only if there are no \`error\`-severity issues in the current diff.
Set \`approved: false\` if one or more \`error\`-severity issues exist.
Never inherit the previous approval status — recompute from scratch.
---
# ANALYSIS RULES
You MUST check for:
- Logic errors and incorrect edge case handling
- Null/undefined access, missing error handling, or unsafe assumptions
- Security vulnerabilities: injection, auth bypass, data exposure, unsafe deserialization
- Performance: unnecessary allocations, blocking calls, unindexed queries, O(n²) patterns
- Contract breakage: changed signatures, payload shapes, or behavioral guarantees

You MUST NOT:
- Flag formatting, linting, or generated code
- Mention dependency bumps unless they introduce a behavioral or security risk
- Hallucinate issues not evidenced by the diff
- Repeat the same finding under different wording
- Re-flag a resolved issue as persisting`,user:`Please review the following Pull Request:

Title: {{pr_title}}
Description: {{pr_body}}

## Previous review comment (if any):
{{previous_comment}}

# CHANGED FILES
{{changed_files}}

# CODE DIFF
{{code_diff}}

Provide a summary of the changes, a list of specific issues (with severity and status), resolved issues since the last review, and a final decision on whether the PR is approved.`,overrides:{}};async function _(e){let{githubToken:a,llm:c,model:d,apiKey:p,owner:_,repo:v,pullNumber:y,maxTokens:b=4096,debug:x=!1,githubClient:S}=e;x&&o.debug(`Running PR Review Workflow for ${_}/${v}#${y}`);try{o.log(`Step 1: Initializing GitHub Client...`);let e=S||new t(a);o.log(`Step 2: Gathering PR context...`);let C=await new r(e).buildPRContext(_,v,y).catch(e=>{throw Error(`Failed to gather PR context: ${e.message}`)});o.log(`Step 3: Loading and rendering prompt...`);let w=(await e.listComments(_,v,y)).filter(e=>e.body?.includes(`### 🤖 AI Code Review`)).sort((e,t)=>new Date(t.created_at).getTime()-new Date(e.created_at).getTime())[0]?.body||``,T=s.render(g,{pr_title:C.details.title,pr_body:C.details.body??``,changed_files:C.files.join(`, `),code_diff:C.diff,previous_comment:w});o.log(`Step 4: Generating review using ${c}:${d}...`),f();let E=await i(u.create(c,{apiKey:p,model:d}),h,{prompt:T.user,systemPrompt:T.system,maxTokens:b},{maxRetries:3,jsonMode:!0}).catch(e=>{throw Error(`LLM request failed: ${e.message}`)});if(!E.success)throw Error(`LLM Review failed: ${E.error}`);let D=E.data;x&&o.debug(`Generated Review:`,D),o.log(`Step 5: Posting review comment to GitHub...`);let O=`### 🤖 AI Code Review — updated ${m()}\n\n`;O+=`**Summary:** ${D.summary}\n\n`;let k=D.issues.filter(e=>e.status===`new`),A=D.issues.filter(e=>e.status===`persisting`);return k.length>0&&(O+=`**New issues**
`,O+=k.map(e=>`- [ ] [${e.severity}] ${e.description}`).join(`
`)+`

`),A.length>0&&(O+=`**Persisting issues**
`,O+=A.map(e=>`- [ ] [${e.severity}] ${e.description}`).join(`
`)+`

`),D.resolvedIssues.length>0&&(O+=`**Resolved issues**
`,O+=D.resolvedIssues.map(e=>`- [x] ${e.description}`).join(`
`)+`

`),D.issues.length===0&&D.resolvedIssues.length===0?O+=`✅ No issues found!`:D.issues.length===0&&(O+=`✅ All previous issues have been resolved!`),await l(e,_,v,y,`### 🤖 AI Code Review`,O).catch(e=>{throw Error(`Failed to post comment: ${e.message}`)}),o.log(`Step 6: Applying PR labels...`),await n(e,_,v,y,{add:D.approved?[`approved`]:[`needs-changes`]}),o.log(`PR Review Workflow completed successfully.`),D}catch(e){let t=e instanceof Error?e.message:String(e);throw o.error(`Workflow failed at step: ${t}`),e}}async function v(){let e={GITHUB_TOKEN:process.env.GITHUB_TOKEN,LLM:process.env.LLM,MODEL:process.env.MODEL,API_KEY:process.env.API_KEY,GITHUB_REPOSITORY_OWNER:process.env.GITHUB_REPOSITORY_OWNER,GITHUB_REPOSITORY_NAME:process.env.GITHUB_REPOSITORY_NAME,GITHUB_EVENT_PULL_REQUEST_NUMBER:process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER},t=Object.entries(e).filter(([e,t])=>!t).map(([e])=>e);t.length>0&&(console.error(`Missing required environment variables:`),console.error(t.join(`, `)),process.exit(1));let n={githubToken:process.env.GITHUB_TOKEN||``,llm:process.env.LLM||``,model:process.env.MODEL||``,apiKey:process.env.API_KEY||``,owner:process.env.GITHUB_REPOSITORY_OWNER||``,repo:process.env.GITHUB_REPOSITORY_NAME||``,pullNumber:parseInt(process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER||`0`,10),maxTokens:process.env.MAX_TOKENS?parseInt(process.env.MAX_TOKENS,10):4096,debug:process.env.DEBUG===`true`};try{await _(n),process.exit(0)}catch(e){console.error(`Workflow failed:`,e),process.exit(1)}}process.env.NODE_ENV!==`test`&&v();export{_ as runPRReviewWorkflow};