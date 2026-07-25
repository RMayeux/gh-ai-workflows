import{_ as e,a as t,c as n,d as r,f as i,g as a,h as o,i as s,l as c,m as l,n as u,o as d,p as f,r as p,s as m,t as h}from"../workflow-runner-DqAlT4Z4.mjs";import{t as g}from"../date-BLOVFp3M.mjs";const _=r({summary:i().min(1,`Summary is required`),issues:n(r({severity:m([`error`,`warning`,`info`]),status:m([`new`,`persisting`]),description:i()})).default([]),resolvedIssues:n(r({description:i()})).default([]),approved:c().default(!1)}),v={id:`pr-review`,system:`You are a staff engineer reviewing a PR diff. Return ONLY valid JSON with this schema:
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

Provide a summary of the changes, a list of specific issues (with severity and status), resolved issues since the last review, and a final decision on whether the PR is approved.`,overrides:{}};async function y(n){let{githubToken:r,llm:i,model:c,apiKey:m,owner:h,repo:y,pullNumber:b,maxTokens:x=4096,debug:S=!1,summaryLlm:C,summaryModel:w,githubClient:T}=n;S&&a.debug(`Running PR Review Workflow for ${h}/${y}#${b}`);try{a.log(`Step 1: Initializing GitHub Client...`);let n=T||new f(r);a.log(`Step 2: Gathering PR context...`);let E=await new e(n).buildPRContext(h,y,b).catch(e=>{throw Error(`Failed to gather PR context: ${e.message}`)}),D=E.diff;if(C&&w){a.log(`Step 2b: Summarizing large diff...`),u();let e=t.create(C,{apiKey:m,model:w});D=await p(D,e)}a.log(`Step 3: Loading and rendering prompt...`);let O=(await n.listComments(h,y,b)).filter(e=>e.body?.includes(`### 🤖 AI Code Review`)).sort((e,t)=>new Date(t.created_at).getTime()-new Date(e.created_at).getTime())[0]?.body||``,k=2e3,A=O.length>k?O.slice(0,k)+`

_(previous comment truncated)`:O,j=A.length>0,M=s.render(v,{pr_title:E.details.title,pr_body:E.details.body??``,changed_files:E.files.join(`, `),code_diff:D,previous_comment:A,has_previous:j});a.log(`Step 4: Generating review using ${i}:${c}...`),u();let N=await d(t.create(i,{apiKey:m,model:c}),_,{prompt:M.user,systemPrompt:M.system,maxTokens:x},{maxRetries:3,jsonMode:!0}).catch(e=>{throw Error(`LLM request failed: ${e.message}`)});if(!N.success)throw Error(`LLM Review failed: ${N.error}`);let P=N.data;S&&a.debug(`Generated Review:`,P),a.log(`Step 5: Posting review comment to GitHub...`);let F=`### 🤖 AI Code Review — updated ${g()}\n\n`;F+=`**Summary:** ${P.summary}\n\n`;let I=P.issues.filter(e=>e.status===`new`),L=P.issues.filter(e=>e.status===`persisting`);return I.length>0&&(F+=`**New issues**
`,F+=I.map(e=>`- [ ] [${e.severity}] ${e.description}`).join(`
`)+`

`),L.length>0&&(F+=`**Persisting issues**
`,F+=L.map(e=>`- [ ] [${e.severity}] ${e.description}`).join(`
`)+`

`),P.resolvedIssues.length>0&&(F+=`**Resolved issues**
`,F+=P.resolvedIssues.map(e=>`- [x] ${e.description}`).join(`
`)+`

`),P.issues.length===0&&P.resolvedIssues.length===0?F+=`✅ No issues found!`:P.issues.length===0&&(F+=`✅ All previous issues have been resolved!`),await o(n,h,y,b,`### 🤖 AI Code Review`,F).catch(e=>{throw Error(`Failed to post comment: ${e.message}`)}),a.log(`Step 6: Applying PR labels...`),await l(n,h,y,b,{add:P.approved?[`approved`]:[`needs-changes`]}),a.log(`PR Review Workflow completed successfully.`),P}catch(e){let t=e instanceof Error?e.message:String(e);throw a.error(`Workflow failed at step: ${t}`),e}}process.env.NODE_ENV!==`test`&&h(y,{requiredEnvVars:[`GITHUB_EVENT_PULL_REQUEST_NUMBER`]}).run();export{y as runPRReviewWorkflow};