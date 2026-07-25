import{a as e,c as t,d as n,f as r,g as i,h as a,i as o,m as s,n as c,o as l,p as u,r as d,s as f,t as p,u as m}from"../workflow-runner-CvtoOyD5.mjs";import{t as h}from"../date-BLOVFp3M.mjs";const g=m({summary:n().min(1,`Summary is required`),issues:f(m({severity:l([`error`,`warning`,`info`]),status:l([`new`,`persisting`]),description:n()})).default([]),resolvedIssues:f(m({description:n()})).default([]),approved:t().default(!1)}),_={id:`pr-review`,system:`You are a staff-level engineer performing a code review on a pull request.
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

Provide a summary of the changes, a list of specific issues (with severity and status), resolved issues since the last review, and a final decision on whether the PR is approved.`,overrides:{}};async function v(t){let{githubToken:n,llm:l,model:f,apiKey:p,owner:m,repo:v,pullNumber:y,maxTokens:b=4096,debug:x=!1,githubClient:S}=t;x&&a.debug(`Running PR Review Workflow for ${m}/${v}#${y}`);try{a.log(`Step 1: Initializing GitHub Client...`);let t=S||new r(n);a.log(`Step 2: Gathering PR context...`);let C=await new i(t).buildPRContext(m,v,y).catch(e=>{throw Error(`Failed to gather PR context: ${e.message}`)});a.log(`Step 3: Loading and rendering prompt...`);let w=(await t.listComments(m,v,y)).filter(e=>e.body?.includes(`### 🤖 AI Code Review`)).sort((e,t)=>new Date(t.created_at).getTime()-new Date(e.created_at).getTime())[0]?.body||``,T=d.render(_,{pr_title:C.details.title,pr_body:C.details.body??``,changed_files:C.files.join(`, `),code_diff:C.diff,previous_comment:w});a.log(`Step 4: Generating review using ${l}:${f}...`),c();let E=await e(o.create(l,{apiKey:p,model:f}),g,{prompt:T.user,systemPrompt:T.system,maxTokens:b},{maxRetries:3,jsonMode:!0}).catch(e=>{throw Error(`LLM request failed: ${e.message}`)});if(!E.success)throw Error(`LLM Review failed: ${E.error}`);let D=E.data;x&&a.debug(`Generated Review:`,D),a.log(`Step 5: Posting review comment to GitHub...`);let O=`### 🤖 AI Code Review — updated ${h()}\n\n`;O+=`**Summary:** ${D.summary}\n\n`;let k=D.issues.filter(e=>e.status===`new`),A=D.issues.filter(e=>e.status===`persisting`);return k.length>0&&(O+=`**New issues**
`,O+=k.map(e=>`- [ ] [${e.severity}] ${e.description}`).join(`
`)+`

`),A.length>0&&(O+=`**Persisting issues**
`,O+=A.map(e=>`- [ ] [${e.severity}] ${e.description}`).join(`
`)+`

`),D.resolvedIssues.length>0&&(O+=`**Resolved issues**
`,O+=D.resolvedIssues.map(e=>`- [x] ${e.description}`).join(`
`)+`

`),D.issues.length===0&&D.resolvedIssues.length===0?O+=`✅ No issues found!`:D.issues.length===0&&(O+=`✅ All previous issues have been resolved!`),await s(t,m,v,y,`### 🤖 AI Code Review`,O).catch(e=>{throw Error(`Failed to post comment: ${e.message}`)}),a.log(`Step 6: Applying PR labels...`),await u(t,m,v,y,{add:D.approved?[`approved`]:[`needs-changes`]}),a.log(`PR Review Workflow completed successfully.`),D}catch(e){let t=e instanceof Error?e.message:String(e);throw a.error(`Workflow failed at step: ${t}`),e}}process.env.NODE_ENV!==`test`&&p(v,{requiredEnvVars:[`GITHUB_EVENT_PULL_REQUEST_NUMBER`]}).run();export{v as runPRReviewWorkflow};