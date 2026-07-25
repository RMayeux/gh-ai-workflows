import{_ as e,a as t,c as n,d as r,f as i,g as a,h as o,i as s,l as c,n as l,o as u,p as d,r as f,t as p,u as m}from"../workflow-runner-DqAlT4Z4.mjs";import{t as h}from"../file-system-BEi2Aye1.mjs";import{t as g}from"../date-BLOVFp3M.mjs";const _=r({summary:i().describe(`One sentence describing what changed and why it matters to QA`),impactedFeatures:n(r({featureSlug:i().describe(`The domain/feature-slug`),testCases:n(i()).describe(`List of test cases in "condition → action → expected result" format`)})).optional().default([]),unchangedTestCases:n(i()).optional().default([]).describe(`Test cases from the previous comment that are still valid, copied verbatim`),retiredTestCases:n(i()).optional().default([]).describe(`Test cases from the previous comment that are no longer relevant, copied verbatim`),totalTests:m().describe(`Total number of active test cases (impacted + unchanged, excluding retired)`)}),v=r({githubToken:i().min(1),llm:i().min(1),model:i().min(1),apiKey:i().min(1),owner:i().min(1),repo:i().min(1),pullNumber:m().int().positive(),projectContext:i().optional().describe(`General context about the project to help the AI understand the domain.`),docPattern:i().optional().describe(`Optional regex to find documentation files in the repository. If provided, all matching files will be included in the prompt.`),debug:c().optional(),summaryLlm:i().optional(),summaryModel:i().optional()}),y={id:`qa-test-cases`,system:`You are a senior QA lead reviewing a pull request before it goes to QA.
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
- "User can still log in" ← untouched behavior`,overrides:{}};async function b(n){let{githubToken:r,llm:i,model:c,apiKey:p,owner:m,repo:v,pullNumber:b,projectContext:x,docPattern:S,debug:C=!1,summaryLlm:w,summaryModel:T,githubClient:E}=n;C&&a.debug(`Running QA Test Cases Workflow for ${m}/${v}#${b}`);try{a.log(`Step 1: Initializing GitHub Client...`);let n=E||new d(r),D=new e(n);a.log(`Step 2: Fetching PR diff and files...`);let O=(await D.buildPRContext(m,v,b).catch(e=>{throw Error(`Failed to build PR context: ${e instanceof Error?e.message:String(e)}`)})).diff;if(w&&T){a.log(`Step 2b: Summarizing large diff...`),l();let e=t.create(w,{apiKey:p,model:T});O=await f(O,e)}let k=``;S?(a.log(`Step 3: Searching for documentation matching pattern: ${S}...`),k=h(S),k||a.warn(`No documentation found matching the provided pattern.`)):a.log(`Step 3: No docPattern provided, skipping documentation collection.`),a.log(`Step 4: Loading and rendering prompt...`);let A=(await n.listComments(m,v,b)).filter(e=>e.body?.includes(`🧪 QA Test Cases`)).sort((e,t)=>new Date(t.created_at).getTime()-new Date(e.created_at).getTime())[0]?.body||``,j=g(),M=s.render(y,{project_context:x||`No project context provided.`,code_diff:O,documentation:k||`No documentation provided for these changes.`,previous_comment:A,date:j});a.log(`Step 5: Generating QA test cases using ${i}:${c}...`),l();let N=await u(t.create(i,{apiKey:p,model:c}),_,{prompt:M.user,systemPrompt:M.system},{maxRetries:3,jsonMode:!0}).catch(e=>{throw Error(`LLM request failed: ${e instanceof Error?e.message:String(e)}`)});if(!N.success)throw Error(`LLM Generation failed: ${N.error}`);let P=N.data;C&&a.debug(`Generated QA Test Cases:`,P),a.log(`Step 6: Updating GitHub PR...`);let F=`### 🧪 QA Test Cases — updated ${j}\n\n`;if(F+=`> ${P.summary} (**Total active tests: ${P.totalTests}**)\n\n`,P.impactedFeatures.length>0){F+=`**New / updated**
`;for(let e of P.impactedFeatures)F+=`**${e.featureSlug}**\n`,F+=e.testCases.map(e=>`- [ ] ${e}`).join(`
`)+`
`;F+=`
`}return P.unchangedTestCases.length>0&&(F+=`**Already covered**
`,F+=P.unchangedTestCases.map(e=>`- [ ] ${e}`).join(`
`)+`

`),P.retiredTestCases.length>0&&(F+=`**Retired**
`,F+=P.retiredTestCases.map(e=>`~~- ${e}~~`).join(`
`)+`
`),await o(n,m,v,b,`🧪 QA Test Cases`,F).catch(e=>{throw Error(`Failed to post QA comment: ${e.message}`)}),a.log(`QA Test Cases Workflow completed successfully.`),P}catch(e){let t=e instanceof Error?e.message:String(e);throw a.error(`Workflow failed at step: ${t}`),e}}process.env.NODE_ENV!==`test`&&p(b,{requiredEnvVars:[`GITHUB_EVENT_PULL_REQUEST_NUMBER`],validate:e=>{let t=v.safeParse(e);return t.success||(console.error(`Invalid or missing environment variables:`),console.error(JSON.stringify(t.error.format(),null,2))),{success:t.success,error:t.success?void 0:{message:JSON.stringify(t.error.format())}}}}).run();export{b as runQATestCasesWorkflow};