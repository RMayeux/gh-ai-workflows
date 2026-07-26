import{a as e,c as t,l as n,m as r,n as i,o as a,s as o,t as s}from"../workflow-pipeline-D8UQastu.mjs";import{n as c,t as l}from"../date-01YGJVuO.mjs";import{t as u}from"../file-system-CfDL-3oZ.mjs";const d=t({summary:n().describe(`One sentence describing what changed and why it matters to QA`),impactedFeatures:e(t({featureSlug:n().describe(`The domain/feature-slug`),testCases:e(n()).describe(`List of test cases in "condition → action → expected result" format`)})).optional().default([]),unchangedTestCases:e(n()).optional().default([]).describe(`Test cases from the previous comment that are still valid, copied verbatim`),retiredTestCases:e(n()).optional().default([]).describe(`Test cases from the previous comment that are no longer relevant, copied verbatim`),totalTests:o().describe(`Total number of active test cases (impacted + unchanged, excluding retired)`)}),f=t({githubToken:n().min(1),llm:n().min(1),model:n().min(1),apiKey:n().min(1),owner:n().min(1),repo:n().min(1),pullNumber:o().int().positive(),projectContext:n().optional().describe(`General context about the project to help the AI understand the domain.`),docPattern:n().optional().describe(`Optional regex to find documentation files in the repository. If provided, all matching files will be included in the prompt.`),debug:a().optional(),summaryLlm:n().optional(),summaryModel:n().optional()}),p={id:`qa-test-cases`,system:`You are a senior QA lead reviewing a pull request before it goes to QA.
Your goal is the most focused, actionable test list possible.
Do not output any reasoning or analysis. Output ONLY a valid JSON object.
Do not rename keys. Do not add new keys. Do not nest differently than the example below.`,user:`---
## Context
{{project_context}}

## PR code changes:
{{code_diff}}

## Documentation:
{{documentation}}

## Previous QA comment (if any):
{{previous_comment}}

---
## Rules
- Read the diff to understand what changed
- Use the documentation to understand the intent and business rules behind those changes
- If no documentation is provided, infer intent from the diff alone and flag each assumption with "(assumed)"
- ONLY generate tests for rules that are NEW or CHANGED in this PR
- Assume everything untouched was already tested — do not include it
- If a rule was only rephrased with no behavior change, skip it
- Group related checks into one TC when possible
- Include at least one negative or edge-case TC per feature when the diff shows a guard, validation, or error path changed
- Test cases must follow this format: starting condition → action → expected result
- No jargon, no code, no technical details
- Skip permission checks unless permissions explicitly changed in this PR

## Rules when a previous comment exists
- Parse the previous comment to extract existing test cases
- A TC is "unchanged" if the behavior it covers has not changed in the new diff — copy it verbatim into unchangedTestCases
- A TC is "retired" if the behavior it covers no longer exists or was replaced — copy its text into retiredTestCases
- A TC is "new" or "updated" if it covers something new or changed — add it to impactedFeatures as usual
- Never rewrite or paraphrase unchanged or retired TCs — copy them character for character
- If no previous comment exists, return empty arrays for unchangedTestCases and retiredTestCases

---
## Output Format
You must return a JSON object that matches EXACTLY this structure — no extra keys, no renamed keys:

{
  "summary": "The scoring step now returns a confidence level alongside the score.",
  "impactedFeatures": [
    {
      "featureSlug": "scoring/confidence",
      "testCases": [
        "Session has completed steps → AI scores step → Score AND confidence level (1–5) both appear"
      ]
    }
  ],
  "unchangedTestCases": [
    "Form has required field empty → User submits → Field is highlighted and submission is blocked"
  ],
  "retiredTestCases": [
    "User submits form with score only → Score appears without confidence"
  ],
  "totalTests": 2
}

---
### Good TC examples:
- "Session has completed steps → AI scores step → Score AND confidence level (1–5) both appear"
- "Form has required field empty → User submits → Field is highlighted and submission is blocked"

### Bad TC examples:
- "Verify that the system handles the AI failure correctly" ← too vague
- "Call POST /api/score with missing body → Check 400 response" ← technical
- "User can still log in" ← untouched behavior`,overrides:{}};async function m(e){let{owner:t,repo:n,pullNumber:i,debug:a,projectContext:o,docPattern:f,githubToken:m,llm:h,model:g,apiKey:_,summaryLlm:v,summaryModel:y,githubClient:b}=e;a&&r.debug(`Running QA Test Cases Workflow for ${t}/${n}#${i}`);try{return await s({githubToken:m,llm:h,model:g,apiKey:_,owner:t,repo:n,pullNumber:i,debug:a,summaryLlm:v,summaryModel:y,githubClient:b},{promptDef:p,schema:d,prepareVariables:async({gh:e,codeDiff:a})=>{let s=``;f&&(r.log(`Searching for documentation...`),s=u(f),s||r.warn(`No documentation found matching the provided pattern.`));let c=(await e.listComments(t,n,i)).filter(e=>e.body?.includes(`🧪 QA Test Cases`)).sort((e,t)=>new Date(t.created_at).getTime()-new Date(e.created_at).getTime())[0]?.body||``,d=l();return{project_context:o||`No project context provided.`,code_diff:a,documentation:s||`No documentation provided for these changes.`,previous_comment:c,date:d}},handleResult:async({gh:e},r)=>{let a=`### 🧪 QA Test Cases — updated ${l()}\n\n`;if(a+=`> ${r.summary} (**Total active tests: ${r.totalTests}**)\n\n`,r.impactedFeatures.length>0){a+=`**New / updated**
`;for(let e of r.impactedFeatures)a+=`**${e.featureSlug}**\n`,a+=e.testCases.map(e=>`- [ ] ${e}`).join(`
`)+`
`;a+=`
`}r.unchangedTestCases.length>0&&(a+=`**Already covered**
`,a+=r.unchangedTestCases.map(e=>`- [ ] ${e}`).join(`
`)+`

`),r.retiredTestCases.length>0&&(a+=`**Retired**
`,a+=r.retiredTestCases.map(e=>`~~- ${e}~~`).join(`
`)+`
`),await c(e,t,n,i,`🧪 QA Test Cases`,a)}})}catch(e){let t=e instanceof Error?e.message:String(e);throw r.error(`Workflow failed at step: ${t}`),e}}process.env.NODE_ENV!==`test`&&i(m,{requiredEnvVars:[`GITHUB_EVENT_PULL_REQUEST_NUMBER`],validate:e=>{let t=f.safeParse(e);return t.success||(console.error(`Invalid or missing environment variables:`),console.error(JSON.stringify(t.error.format(),null,2))),{success:t.success,error:t.success?void 0:{message:JSON.stringify(t.error.format())}}}}).run();export{m as runQATestCasesWorkflow};