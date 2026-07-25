import{a as e,c as t,d as n,f as r,g as i,h as a,i as o,l as s,m as c,n as l,r as u,s as d,t as f,u as p}from"../workflow-runner-_DpMNe5R.mjs";import{t as m}from"../file-system-Br-4RWIy.mjs";import{t as h}from"../date-BLOVFp3M.mjs";const g=p({summary:n().describe(`One sentence describing what changed and why it matters to QA`),impactedFeatures:d(p({featureSlug:n().describe(`The domain/feature-slug`),testCases:d(n()).describe(`List of test cases in "condition → action → expected result" format`)})).optional().default([]),unchangedTestCases:d(n()).optional().default([]).describe(`Test cases from the previous comment that are still valid, copied verbatim`),retiredTestCases:d(n()).optional().default([]).describe(`Test cases from the previous comment that are no longer relevant, copied verbatim`),totalTests:s().describe(`Total number of active test cases (impacted + unchanged, excluding retired)`)}),_=p({githubToken:n().min(1),llm:n().min(1),model:n().min(1),apiKey:n().min(1),owner:n().min(1),repo:n().min(1),pullNumber:s().int().positive(),projectContext:n().optional().describe(`General context about the project to help the AI understand the domain.`),docPattern:n().optional().describe(`Optional regex to find documentation files in the repository. If provided, all matching files will be included in the prompt.`),debug:t().optional()}),v={id:`qa-test-cases`,system:`You are a senior QA lead reviewing a pull request before it goes to QA.
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
- "User can still log in" ← untouched behavior`,overrides:{}};async function y(t){let{githubToken:n,llm:s,model:d,apiKey:f,owner:p,repo:_,pullNumber:y,projectContext:b,docPattern:x,debug:S=!1,githubClient:C}=t;S&&a.debug(`Running QA Test Cases Workflow for ${p}/${_}#${y}`);try{a.log(`Step 1: Initializing GitHub Client...`);let t=C||new r(n),w=new i(t);a.log(`Step 2: Fetching PR diff and files...`);let T=await w.buildPRContext(p,_,y).catch(e=>{throw Error(`Failed to build PR context: ${e instanceof Error?e.message:String(e)}`)}),E=``;x?(a.log(`Step 3: Searching for documentation matching pattern: ${x}...`),E=m(x),E||a.warn(`No documentation found matching the provided pattern.`)):a.log(`Step 3: No docPattern provided, skipping documentation collection.`),a.log(`Step 4: Loading and rendering prompt...`);let D=(await t.listComments(p,_,y)).filter(e=>e.body?.includes(`🧪 QA Test Cases`)).sort((e,t)=>new Date(t.created_at).getTime()-new Date(e.created_at).getTime())[0]?.body||``,O=h(),k=u.render(v,{project_context:b||`No project context provided.`,code_diff:T.diff,documentation:E||`No documentation provided for these changes.`,previous_comment:D,date:O});a.log(`Step 5: Generating QA test cases using ${s}:${d}...`),l();let A=await e(o.create(s,{apiKey:f,model:d}),g,{prompt:k.user,systemPrompt:k.system},{maxRetries:3,jsonMode:!0}).catch(e=>{throw Error(`LLM request failed: ${e instanceof Error?e.message:String(e)}`)});if(!A.success)throw Error(`LLM Generation failed: ${A.error}`);let j=A.data;S&&a.debug(`Generated QA Test Cases:`,j),a.log(`Step 6: Updating GitHub PR...`);let M=`### 🧪 QA Test Cases — updated ${O}\n\n`;if(M+=`> ${j.summary} (**Total active tests: ${j.totalTests}**)\n\n`,j.impactedFeatures.length>0){M+=`**New / updated**
`;for(let e of j.impactedFeatures)M+=`**${e.featureSlug}**\n`,M+=e.testCases.map(e=>`- [ ] ${e}`).join(`
`)+`
`;M+=`
`}return j.unchangedTestCases.length>0&&(M+=`**Already covered**
`,M+=j.unchangedTestCases.map(e=>`- [ ] ${e}`).join(`
`)+`

`),j.retiredTestCases.length>0&&(M+=`**Retired**
`,M+=j.retiredTestCases.map(e=>`~~- ${e}~~`).join(`
`)+`
`),await c(t,p,_,y,`🧪 QA Test Cases`,M).catch(e=>{throw Error(`Failed to post QA comment: ${e.message}`)}),a.log(`QA Test Cases Workflow completed successfully.`),j}catch(e){let t=e instanceof Error?e.message:String(e);throw a.error(`Workflow failed at step: ${t}`),e}}process.env.NODE_ENV!==`test`&&f(y,{requiredEnvVars:[`GITHUB_EVENT_PULL_REQUEST_NUMBER`],validate:e=>{let t=_.safeParse(e);return t.success||(console.error(`Invalid or missing environment variables:`),console.error(JSON.stringify(t.error.format(),null,2))),{success:t.success,error:t.success?void 0:{message:JSON.stringify(t.error.format())}}}}).run();export{y as runQATestCasesWorkflow};