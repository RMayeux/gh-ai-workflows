import{_ as e,a as t,c as n,g as r,l as i,n as a,o,s,t as c}from"../workflow-pipeline-BIGenON_.mjs";import{t as l}from"../file-system--0vQ0XrS.mjs";import{t as u}from"../date-BLOVFp3M.mjs";const d=n({summary:i().describe(`One sentence describing what changed and why it matters to QA`),impactedFeatures:t(n({featureSlug:i().describe(`The domain/feature-slug`),testCases:t(i()).describe(`List of test cases in "condition → action → expected result" format`)})).optional().default([]),unchangedTestCases:t(i()).optional().default([]).describe(`Test cases from the previous comment that are still valid, copied verbatim`),retiredTestCases:t(i()).optional().default([]).describe(`Test cases from the previous comment that are no longer relevant, copied verbatim`),totalTests:s().describe(`Total number of active test cases (impacted + unchanged, excluding retired)`)}),f=n({githubToken:i().min(1),llm:i().min(1),model:i().min(1),apiKey:i().min(1),owner:i().min(1),repo:i().min(1),pullNumber:s().int().positive(),projectContext:i().optional().describe(`General context about the project to help the AI understand the domain.`),docPattern:i().optional().describe(`Optional regex to find documentation files in the repository. If provided, all matching files will be included in the prompt.`),debug:o().optional(),summaryLlm:i().optional(),summaryModel:i().optional()}),p={id:`qa-test-cases`,system:`You are a senior QA lead reviewing a pull request before it goes to QA.
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
- "User can still log in" ← untouched behavior`,overrides:{}};async function m(t){let{owner:n,repo:i,pullNumber:a,debug:o,projectContext:s,docPattern:f,githubToken:m,llm:h,model:g,apiKey:_,summaryLlm:v,summaryModel:y,githubClient:b}=t;o&&e.debug(`Running QA Test Cases Workflow for ${n}/${i}#${a}`);try{return await c({githubToken:m,llm:h,model:g,apiKey:_,owner:n,repo:i,pullNumber:a,debug:o,summaryLlm:v,summaryModel:y,githubClient:b},{promptDef:p,schema:d,prepareVariables:async({gh:t,codeDiff:r})=>{let o=``;f&&(e.log(`Searching for documentation...`),o=l(f),o||e.warn(`No documentation found matching the provided pattern.`));let c=(await t.listComments(n,i,a)).filter(e=>e.body?.includes(`🧪 QA Test Cases`)).sort((e,t)=>new Date(t.created_at).getTime()-new Date(e.created_at).getTime())[0]?.body||``,d=u();return{project_context:s||`No project context provided.`,code_diff:r,documentation:o||`No documentation provided for these changes.`,previous_comment:c,date:d}},handleResult:async({gh:e},t)=>{let o=`### 🧪 QA Test Cases — updated ${u()}\n\n`;if(o+=`> ${t.summary} (**Total active tests: ${t.totalTests}**)\n\n`,t.impactedFeatures.length>0){o+=`**New / updated**
`;for(let e of t.impactedFeatures)o+=`**${e.featureSlug}**\n`,o+=e.testCases.map(e=>`- [ ] ${e}`).join(`
`)+`
`;o+=`
`}t.unchangedTestCases.length>0&&(o+=`**Already covered**
`,o+=t.unchangedTestCases.map(e=>`- [ ] ${e}`).join(`
`)+`

`),t.retiredTestCases.length>0&&(o+=`**Retired**
`,o+=t.retiredTestCases.map(e=>`~~- ${e}~~`).join(`
`)+`
`),await r(e,n,i,a,`🧪 QA Test Cases`,o)}})}catch(t){let n=t instanceof Error?t.message:String(t);throw e.error(`Workflow failed at step: ${n}`),t}}process.env.NODE_ENV!==`test`&&a(m,{requiredEnvVars:[`GITHUB_EVENT_PULL_REQUEST_NUMBER`],validate:e=>{let t=f.safeParse(e);return t.success||(console.error(`Invalid or missing environment variables:`),console.error(JSON.stringify(t.error.format(),null,2))),{success:t.success,error:t.success?void 0:{message:JSON.stringify(t.error.format())}}}}).run();export{m as runQATestCasesWorkflow};