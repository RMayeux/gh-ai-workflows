import{a as e,c as t,i as n,l as r,m as i,n as a,o,t as s}from"../workflow-pipeline-D8UQastu.mjs";import{n as c,t as l}from"../date-01YGJVuO.mjs";import{t as u}from"../labels-BwKk-Jy0.mjs";const d=t({summary:r().min(1,`Summary is required`),issues:e(t({severity:n([`error`,`warning`,`info`]),status:n([`new`,`persisting`]),description:r()})).default([]),resolvedIssues:e(t({description:r()})).default([]),approved:o().default(!1)}),f={id:`pr-review`,system:`You are a staff engineer reviewing a PR diff. Return ONLY valid JSON with this schema:
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

Provide a summary of the changes, a list of specific issues (with severity and status), resolved issues since the last review, and a final decision on whether the PR is approved.`,overrides:{}};async function p(e){let{owner:t,repo:n,pullNumber:r,debug:a}=e;a&&i.debug(`Running PR Review Workflow for ${t}/${n}#${r}`);try{return await s(e,{promptDef:f,schema:d,prepareVariables:async({gh:e,codeDiff:i,context:a})=>{let o=(await e.listComments(t,n,r)).filter(e=>e.body?.includes(`### 🤖 AI Code Review`)).sort((e,t)=>new Date(t.created_at).getTime()-new Date(e.created_at).getTime())[0]?.body||``,s=2e3,c=o.length>s?o.slice(0,s)+`

_(previous comment truncated)`:o,l=c.length>0;return{pr_title:a.details.title,pr_body:a.details.body??``,changed_files:a.files.join(`, `),code_diff:i,previous_comment:c,has_previous:l}},handleResult:async({gh:e},i)=>{let a=`### 🤖 AI Code Review — updated ${l()}\n\n`;a+=`**Summary:** ${i.summary}\n\n`;let o=i.issues.filter(e=>e.status===`new`),s=i.issues.filter(e=>e.status===`persisting`);o.length>0&&(a+=`**New issues**
`,a+=o.map(e=>`- [ ] [${e.severity}] ${e.description}`).join(`
`)+`

`),s.length>0&&(a+=`**Persisting issues**
`,a+=s.map(e=>`- [ ] [${e.severity}] ${e.description}`).join(`
`)+`

`),i.resolvedIssues.length>0&&(a+=`**Resolved issues**
`,a+=i.resolvedIssues.map(e=>`- [x] ${e.description}`).join(`
`)+`

`),i.issues.length===0&&i.resolvedIssues.length===0?a+=`✅ No issues found!`:i.issues.length===0&&(a+=`✅ All previous issues have been resolved!`),await c(e,t,n,r,`### 🤖 AI Code Review`,a),await u(e,t,n,r,{add:i.approved?[`approved`]:[`needs-changes`]})}})}catch(e){let t=e instanceof Error?e.message:String(e);throw i.error(`Workflow failed at step: ${t}`),e}}process.env.NODE_ENV!==`test`&&a(p,{requiredEnvVars:[`GITHUB_EVENT_PULL_REQUEST_NUMBER`]}).run();export{p as runPRReviewWorkflow};