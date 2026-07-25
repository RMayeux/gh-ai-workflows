import{_ as e,a as t,c as n,h as r,i,l as a,n as o,o as s,t as c}from"../workflow-pipeline-BIGenON_.mjs";const l=n({title:a().min(1,`Title is required`).max(72,`Title must be under 72 characters`),body:a().min(1,`Body is required`),change_type:i([`feat`,`fix`,`refactor`,`perf`,`docs`,`test`,`build`,`ci`,`chore`]),breaking:s().default(!1),doc_impact:s().default(!1),doc_slugs:t(a()).default([])}),u={id:`pr-metadata`,system:`You are a staff engineer analyzing a PR diff. Return ONLY valid JSON with this schema:
{"title":"string (max 72 chars)","body":"string","change_type":"feat|fix|refactor|perf|docs|test|build|ci|chore"}

No code fences, no preamble, no trailing commas.
- Title: conventional commit type(domain): description, under 72 chars. Pick the domain with highest business impact.
- Body: "## What changed" (one paragraph, feature-focused, no file lists). If behavioral features changed add "## Impacted features" table (Domain | Feature | Impact).
- Change type: infer from diff intent.
- Think features not files. What can a user do differently?
- Never list files, routes, or dependency bumps. No hallucination.`,user:`# CHANGED FILES
{{changed_files}}

# CODE DIFF
{{code_diff}}`,overrides:{}};async function d(t){let{owner:n,repo:i,pullNumber:a,debug:o}=t;o&&e.debug(`Running PR Metadata Workflow for ${n}/${i}#${a}`);try{return await c(t,{promptDef:u,schema:l,prepareVariables:({codeDiff:e,context:t})=>({changed_files:t.files.join(`\\n`),code_diff:e,pr_title:t.details.title,pr_body:t.details.body??``}),handleResult:async({gh:e,context:t},o)=>{await e.updatePR(n,i,a,o.title,o.body);let s=[];o.change_type&&s.push(o.change_type),o.breaking&&s.push(`breaking-change`),o.doc_impact&&s.push(`doc-impact`);let c=t.details.additions+t.details.deletions;c<50?s.push(`size/XS`):c<200?s.push(`size/S`):c<500?s.push(`size/M`):c<1e3?s.push(`size/L`):s.push(`size/XL`),await r(e,n,i,a,{add:s})}})}catch(t){let n=t instanceof Error?t.message:String(t);throw e.error(`Workflow failed at step: ${n}`),t}}process.env.NODE_ENV!==`test`&&o(d,{requiredEnvVars:[`GITHUB_EVENT_PULL_REQUEST_NUMBER`]}).run();export{d as runPRMetadataWorkflow};