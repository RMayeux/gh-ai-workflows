import{c as e,d as t,h as n,i as r,l as i,m as a,n as o,o as s,p as c,r as l,s as u,t as d,u as f}from"../llm-DwD2cvkQ.mjs";import{t as p}from"../file-system-DdvyYQ2J.mjs";const m=i({summary:f().describe(`One sentence describing what changed and why it matters to QA`),impactedFeatures:s(i({featureSlug:f().describe(`The domain/feature-slug`),testCases:s(f()).describe(`List of test cases in "condition → action → expected result" format`)})),unchangedTestCases:s(f()).describe(`Test cases from the previous comment that are still valid`),retiredTestCases:s(f()).describe(`Test cases from the previous comment that are no longer relevant`),totalTests:e().describe(`Total number of active test cases (impacted + unchanged)`)});i({githubToken:f().min(1),llm:f().min(1),model:f().min(1),apiKey:f().min(1),owner:f().min(1),repo:f().min(1),pullNumber:e().int().positive(),projectContext:f().optional().describe(`General context about the project to help the AI understand the domain.`),docPattern:f().optional().describe(`Optional regex to find documentation files in the repository. If provided, all matching files will be included in the prompt.`),debug:u().optional()});const h={id:`qa-test-cases`,system:`You are a senior QA lead reviewing a pull request before it goes to QA.
Your goal is the most focused, actionable test list possible.
Do not output any reasoning or analysis. Output ONLY a valid JSON object.`,user:`---
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
- Never rewrite or paraphrase unchanged TCs — copy them character for character

---
## Output Format
You must return a JSON object with exactly these keys:
- "summary": (string) A concise one-sentence summary of what changed and why it matters to QA.
- "impactedFeatures": (array of objects) Each object must have:
    - "featureSlug": (string) The domain/feature-slug (e.g., "auth/login").
    - "testCases": (array of strings) Each string is a new or updated TC in the "condition → action → expected result" format.
- "unchangedTestCases": (array of strings) TCs from the previous comment that are still fully valid, copied verbatim.
- "retiredTestCases": (array of strings) TCs from the previous comment that are no longer relevant, copied verbatim.
- "totalTests": (number) Total number of active test cases (impactedFeatures + unchanged, excluding retired).

---
## Comment rendering (the agent will format this, not you)
The output will be rendered as:

### QA Test Cases — updated {{date}}
> summary

**New / updated**
- TC 1
- TC 2

**Already covered**
- TC 3 (unchanged, verbatim)

~~- TC 4~~ (retired)

---
### Good TC examples:
- "Session has completed steps → AI scores step → Score AND confidence level (1–5) both appear"
- "Form has required field empty → User submits → Field is highlighted and submission is blocked"

### Bad TC examples:
- "Verify that the system handles the AI failure correctly" ← too vague
- "Call POST /api/score with missing body → Check 400 response" ← technical
- "User can still log in" ← untouched behavior`,overrides:{}};async function g(e){let{githubToken:i,llm:s,model:u,apiKey:f,owner:g,repo:_,pullNumber:v,projectContext:y,docPattern:b,debug:x=!1,githubClient:S}=e;x&&a.debug(`Running QA Test Cases Workflow for ${g}/${_}#${v}`);try{a.log(`Step 1: Initializing GitHub Client...`);let e=S||new t(i),C=new n(e);a.log(`Step 2: Fetching PR diff and files...`);let w=await C.buildPRContext(g,_,v).catch(e=>{throw Error(`Failed to build PR context: ${e instanceof Error?e.message:String(e)}`)}),T=``;b?(a.log(`Step 3: Searching for documentation matching pattern: ${b}...`),T=p(b),T||a.warn(`No documentation found matching the provided pattern.`)):a.log(`Step 3: No docPattern provided, skipping documentation collection.`),a.log(`Step 4: Loading and rendering prompt...`);let E=(await e.listComments(g,_,v)).filter(e=>e.body?.includes(`🧪 QA Test Cases`)).sort((e,t)=>new Date(t.created_at).getTime()-new Date(e.created_at).getTime())[0]?.body||``,D=o.render(h,{project_context:y||`No project context provided.`,code_diff:w.diff,documentation:T||`No documentation provided for these changes.`,previous_comment:E});a.log(`Step 5: Generating QA test cases using ${s}:${u}...`),d();let O=await r(l.create(s,{apiKey:f,model:u}),m,{prompt:D.user,systemPrompt:D.system},{maxRetries:3,jsonMode:!0}).catch(e=>{throw Error(`LLM request failed: ${e instanceof Error?e.message:String(e)}`)});if(!O.success)throw Error(`LLM Generation failed: ${O.error}`);let k=O.data;x&&a.debug(`Generated QA Test Cases:`,k),a.log(`Step 6: Updating GitHub PR...`);let A=`### 🧪 QA Test Cases — updated ${new Date().toISOString().replace(`T`,` `).replace(/\..+Z$/,` UTC`)}\n\n`;if(A+=`> ${k.summary}\n\n`,k.impactedFeatures.length>0){A+=`**New / updated**
`;for(let e of k.impactedFeatures)A+=`**${e.featureSlug}**\n`,A+=e.testCases.map(e=>`- [ ] ${e}`).join(`
`)+`
`;A+=`
`}return k.unchangedTestCases.length>0&&(A+=`**Already covered**
`,A+=k.unchangedTestCases.map(e=>`- [ ] ${e}`).join(`
`)+`

`),k.retiredTestCases.length>0&&(A+=`**Retired**
`,A+=k.retiredTestCases.map(e=>`~~- ${e}~~`).join(`
`)+`
`),await c(e,g,_,v,`🧪 QA Test Cases`,A).catch(e=>{throw Error(`Failed to post QA comment: ${e.message}`)}),a.log(`QA Test Cases Workflow completed successfully.`),k}catch(e){let t=e instanceof Error?e.message:String(e);throw a.error(`Workflow failed at step: ${t}`),e}}async function _(){let e={GITHUB_TOKEN:process.env.GITHUB_TOKEN,LLM:process.env.LLM,MODEL:process.env.MODEL,API_KEY:process.env.API_KEY,GITHUB_REPOSITORY_OWNER:process.env.GITHUB_REPOSITORY_OWNER,GITHUB_REPOSITORY_NAME:process.env.GITHUB_REPOSITORY_NAME,GITHUB_EVENT_PULL_REQUEST_NUMBER:process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER},t=Object.entries(e).filter(([e,t])=>!t).map(([e])=>e);t.length>0&&(console.error(`Missing required environment variables:`),console.error(t.join(`, `)),process.exit(1));let n={githubToken:process.env.GITHUB_TOKEN||``,llm:process.env.LLM||``,model:process.env.MODEL||``,apiKey:process.env.API_KEY||``,owner:process.env.GITHUB_REPOSITORY_OWNER||``,repo:process.env.GITHUB_REPOSITORY_NAME||``,pullNumber:parseInt(process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER||`0`,10),projectContext:process.env.PROJECT_CONTEXT||``,docPattern:process.env.DOC_PATTERN||``,debug:process.env.DEBUG===`true`};try{await g(n),process.exit(0)}catch(e){console.error(`Workflow failed:`,e),process.exit(1)}}process.env.NODE_ENV!==`test`&&_();export{g as runQATestCasesWorkflow};