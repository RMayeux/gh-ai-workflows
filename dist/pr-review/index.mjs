import{a as e,c as t,d as n,f as r,g as i,h as a,i as o,m as s,n as c,o as l,p as u,r as d,s as f,t as p,u as m}from"../workflow-runner-DZ9uSkdM.mjs";import{t as h}from"../date-BLOVFp3M.mjs";const g=m({summary:n().min(1,`Summary is required`),issues:f(m({severity:l([`error`,`warning`,`info`]),status:l([`new`,`persisting`]),description:n()})).default([]),resolvedIssues:f(m({description:n()})).default([]),approved:t().default(!1)}),_={id:`pr-review`,system:`You are a staff engineer reviewing a PR diff. Return ONLY valid JSON with this schema:
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
{{#has_previous}}
## Previous review comment:
{{previous_comment}}
{{/has_previous}}
# CHANGED FILES
{{changed_files}}

# CODE DIFF
{{code_diff}}

Provide a summary of the changes, a list of specific issues (with severity and status), resolved issues since the last review, and a final decision on whether the PR is approved.`,overrides:{}};async function v(t){let{githubToken:n,llm:l,model:f,apiKey:p,owner:m,repo:v,pullNumber:y,maxTokens:b=4096,debug:x=!1,githubClient:S}=t;x&&a.debug(`Running PR Review Workflow for ${m}/${v}#${y}`);try{a.log(`Step 1: Initializing GitHub Client...`);let t=S||new r(n);a.log(`Step 2: Gathering PR context...`);let C=await new i(t).buildPRContext(m,v,y).catch(e=>{throw Error(`Failed to gather PR context: ${e.message}`)});a.log(`Step 3: Loading and rendering prompt...`);let w=(await t.listComments(m,v,y)).filter(e=>e.body?.includes(`### 🤖 AI Code Review`)).sort((e,t)=>new Date(t.created_at).getTime()-new Date(e.created_at).getTime())[0]?.body||``,T=2e3,E=w.length>T?w.slice(0,T)+`

_(previous comment truncated)`:w,D=E.length>0,O=d.render(_,{pr_title:C.details.title,pr_body:C.details.body??``,changed_files:C.files.join(`, `),code_diff:C.diff,previous_comment:E,has_previous:D});a.log(`Step 4: Generating review using ${l}:${f}...`),c();let k=await e(o.create(l,{apiKey:p,model:f}),g,{prompt:O.user,systemPrompt:O.system,maxTokens:b},{maxRetries:3,jsonMode:!0}).catch(e=>{throw Error(`LLM request failed: ${e.message}`)});if(!k.success)throw Error(`LLM Review failed: ${k.error}`);let A=k.data;x&&a.debug(`Generated Review:`,A),a.log(`Step 5: Posting review comment to GitHub...`);let j=`### 🤖 AI Code Review — updated ${h()}\n\n`;j+=`**Summary:** ${A.summary}\n\n`;let M=A.issues.filter(e=>e.status===`new`),N=A.issues.filter(e=>e.status===`persisting`);return M.length>0&&(j+=`**New issues**
`,j+=M.map(e=>`- [ ] [${e.severity}] ${e.description}`).join(`
`)+`

`),N.length>0&&(j+=`**Persisting issues**
`,j+=N.map(e=>`- [ ] [${e.severity}] ${e.description}`).join(`
`)+`

`),A.resolvedIssues.length>0&&(j+=`**Resolved issues**
`,j+=A.resolvedIssues.map(e=>`- [x] ${e.description}`).join(`
`)+`

`),A.issues.length===0&&A.resolvedIssues.length===0?j+=`✅ No issues found!`:A.issues.length===0&&(j+=`✅ All previous issues have been resolved!`),await s(t,m,v,y,`### 🤖 AI Code Review`,j).catch(e=>{throw Error(`Failed to post comment: ${e.message}`)}),a.log(`Step 6: Applying PR labels...`),await u(t,m,v,y,{add:A.approved?[`approved`]:[`needs-changes`]}),a.log(`PR Review Workflow completed successfully.`),A}catch(e){let t=e instanceof Error?e.message:String(e);throw a.error(`Workflow failed at step: ${t}`),e}}process.env.NODE_ENV!==`test`&&p(v,{requiredEnvVars:[`GITHUB_EVENT_PULL_REQUEST_NUMBER`]}).run();export{v as runPRReviewWorkflow};