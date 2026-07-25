import{a as e,c as t,i as n,l as r,m as i,n as a,o,t as s}from"../workflow-pipeline-D8UQastu.mjs";import{t as c}from"../labels-BwKk-Jy0.mjs";const l=t({title:r().min(1,`Title is required`).max(72,`Title must be under 72 characters`),body:r().min(1,`Body is required`),change_type:n([`feat`,`fix`,`refactor`,`perf`,`docs`,`test`,`build`,`ci`,`chore`]),breaking:o().default(!1),doc_impact:o().default(!1),doc_slugs:e(r()).default([])}),u={id:`pr-metadata`,system:`You are a staff engineer analyzing a PR diff. Return ONLY valid JSON with this schema:
{"title":"string (max 72 chars)","body":"string","change_type":"feat|fix|refactor|perf|docs|test|build|ci|chore"}

No code fences, no preamble, no trailing commas.
- Title: conventional commit type(domain): description, under 72 chars. Pick the domain with highest business impact.
- Body: "## What changed" (one paragraph, feature-focused, no file lists). If behavioral features changed add "## Impacted features" table (Domain | Feature | Impact).
- Change type: infer from diff intent.
- Think features not files. What can a user do differently?
- Never list files, routes, or dependency bumps. No hallucination.`,user:`# CHANGED FILES
{{changed_files}}

# CODE DIFF
{{code_diff}}`,overrides:{}};async function d(e){let{owner:t,repo:n,pullNumber:r,debug:a}=e;a&&i.debug(`Running PR Metadata Workflow for ${t}/${n}#${r}`);try{return await s(e,{promptDef:u,schema:l,prepareVariables:({codeDiff:e,context:t})=>({changed_files:t.files.join(`\\n`),code_diff:e,pr_title:t.details.title,pr_body:t.details.body??``}),handleResult:async({gh:e,context:i},a)=>{await e.updatePR(t,n,r,a.title,a.body);let o=[];a.change_type&&o.push(a.change_type),a.breaking&&o.push(`breaking-change`),a.doc_impact&&o.push(`doc-impact`);let s=i.details.additions+i.details.deletions;s<50?o.push(`size/XS`):s<200?o.push(`size/S`):s<500?o.push(`size/M`):s<1e3?o.push(`size/L`):o.push(`size/XL`),await c(e,t,n,r,{add:o})}})}catch(e){let t=e instanceof Error?e.message:String(e);throw i.error(`Workflow failed at step: ${t}`),e}}process.env.NODE_ENV!==`test`&&a(d,{requiredEnvVars:[`GITHUB_EVENT_PULL_REQUEST_NUMBER`]}).run();export{d as runPRMetadataWorkflow};