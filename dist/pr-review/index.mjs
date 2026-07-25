import{a as e,c as t,d as n,f as r,g as i,h as a,i as o,m as s,n as c,o as l,p as u,r as d,s as f,t as p,u as m}from"../workflow-runner-C3E85YtQ.mjs";import{t as h}from"../date-BLOVFp3M.mjs";const g=m({summary:n().min(1,`Summary is required`),issues:f(m({severity:l([`error`,`warning`,`info`]),status:l([`new`,`persisting`]),description:n()})).default([]),resolvedIssues:f(m({description:n()})).default([]),approved:t().default(!1)}),_={id:`pr-review`,system:`You are a staff engineer reviewing a PR diff. Return ONLY valid JSON with this schema:
{"summary":"string","issues":[{"severity":"error|warning|info","status":"new|persisting","description":"string"}],"resolvedIssues":[{"description":"string"}],"approved":boolean}

No code fences, no preamble, no trailing commas. Omit issues/resolvedIssues arrays if empty.
- Summary: what the code does, soundness, dominant concern. No file lists.
- Issues: one sentence per finding, name the behavior not the file. error=must-fix (crash, data loss, security), warning=should-fix (logic gaps, perf), info=optional.
- Status: new=not in previous review, persisting=still present.
- Resolved: copy verbatim from previous review.
- Approved: true iff no error-severity issues. Recompute from scratch.
- Check: logic errors, null access, security flaws, perf issues, contract breaks.
- Never: flag formatting/lint, hallucinate issues, repeat findings.`,user:`Please review the following Pull Request:

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