import{_ as e,a as t,c as n,g as r,h as i,i as a,l as o,n as s,o as c,t as l}from"../workflow-pipeline-BIGenON_.mjs";import{t as u}from"../date-BLOVFp3M.mjs";const d=n({summary:o().min(1,`Summary is required`),issues:t(n({severity:a([`error`,`warning`,`info`]),status:a([`new`,`persisting`]),description:o()})).default([]),resolvedIssues:t(n({description:o()})).default([]),approved:c().default(!1)}),f={id:`pr-review`,system:`You are a staff engineer reviewing a PR diff. Return ONLY valid JSON with this schema:
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

Provide a summary of the changes, a list of specific issues (with severity and status), resolved issues since the last review, and a final decision on whether the PR is approved.`,overrides:{}};async function p(t){let{owner:n,repo:a,pullNumber:o,debug:s}=t;s&&e.debug(`Running PR Review Workflow for ${n}/${a}#${o}`);try{return await l(t,{promptDef:f,schema:d,prepareVariables:async({gh:e,codeDiff:t,context:r})=>{let i=(await e.listComments(n,a,o)).filter(e=>e.body?.includes(`### 🤖 AI Code Review`)).sort((e,t)=>new Date(t.created_at).getTime()-new Date(e.created_at).getTime())[0]?.body||``,s=2e3,c=i.length>s?i.slice(0,s)+`

_(previous comment truncated)`:i,l=c.length>0;return{pr_title:r.details.title,pr_body:r.details.body??``,changed_files:r.files.join(`, `),code_diff:t,previous_comment:c,has_previous:l}},handleResult:async({gh:e},t)=>{let s=`### 🤖 AI Code Review — updated ${u()}\n\n`;s+=`**Summary:** ${t.summary}\n\n`;let c=t.issues.filter(e=>e.status===`new`),l=t.issues.filter(e=>e.status===`persisting`);c.length>0&&(s+=`**New issues**
`,s+=c.map(e=>`- [ ] [${e.severity}] ${e.description}`).join(`
`)+`

`),l.length>0&&(s+=`**Persisting issues**
`,s+=l.map(e=>`- [ ] [${e.severity}] ${e.description}`).join(`
`)+`

`),t.resolvedIssues.length>0&&(s+=`**Resolved issues**
`,s+=t.resolvedIssues.map(e=>`- [x] ${e.description}`).join(`
`)+`

`),t.issues.length===0&&t.resolvedIssues.length===0?s+=`✅ No issues found!`:t.issues.length===0&&(s+=`✅ All previous issues have been resolved!`),await r(e,n,a,o,`### 🤖 AI Code Review`,s),await i(e,n,a,o,{add:t.approved?[`approved`]:[`needs-changes`]})}})}catch(t){let n=t instanceof Error?t.message:String(t);throw e.error(`Workflow failed at step: ${n}`),t}}process.env.NODE_ENV!==`test`&&s(p,{requiredEnvVars:[`GITHUB_EVENT_PULL_REQUEST_NUMBER`]}).run();export{p as runPRReviewWorkflow};