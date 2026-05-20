import{a as e,d as t,f as n,h as r,i,l as a,m as o,n as s,o as c,p as l,s as u,t as d,u as f}from"../llm-wSWP-siq.mjs";import{t as p}from"../file-system-DZ_a68Wh.mjs";import{t as m}from"../markdown-N2G_IbEu.mjs";const h=n({summary:l().describe(`One sentence describing what changed and why it matters to QA`),impactedFeatures:a(n({featureSlug:l().describe(`The domain/feature-slug`),testCases:a(l()).describe(`List of test cases in "condition → action → expected result" format`)})),totalTests:t().describe(`Total number of test cases across all features`)});n({githubToken:l().min(1),llm:l().min(1),model:l().min(1),apiKey:l().min(1),owner:l().min(1),repo:l().min(1),pullNumber:t().int().positive(),projectContext:l().optional().describe(`General context about the project to help the AI understand the domain.`),docPattern:l().optional().describe(`Optional regex to find documentation files in the repository. If provided, all matching files will be included in the prompt.`),debug:f().optional()});const g={id:`qa-test-cases`,system:`You are a senior QA lead reviewing a pull request before it goes to QA.
Your goal is the most focused, actionable test list possible.
Do not output any reasoning or analysis. Output ONLY a valid JSON object.`,user:`---
## Context
{{project_context}}

## PR code changes:
{{code_diff}}

## Documentation:
{{documentation}}
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
---
## Output Format
You must return a JSON object with exactly these keys:
- "summary": (string) A concise one-sentence summary of what changed and why it matters to QA.
- "impactedFeatures": (array of objects) Each object must have:
    - "featureSlug": (string) The domain/feature-slug (e.g., "auth/login").
    - "testCases": (array of strings) Each string must be a test case in the "condition → action → expected result" format.
- "totalTests": (number) The total number of test cases across all features.

### Good TC examples:
- "Session has completed steps → AI scores step → Score AND confidence level (1–5) both appear"
- "Form has required field empty → User submits → Field is highlighted and submission is blocked"

### Bad TC examples:
- "Verify that the system handles the AI failure correctly" ← too vague
- "Call POST /api/score with missing body → Check 400 response" ← technical
- "User can still log in" ← untouched behavior`,overrides:{}};async function _(t){let{githubToken:n,llm:a,model:l,apiKey:f,owner:_,repo:v,pullNumber:y,projectContext:b,docPattern:x,debug:S=!1,githubClient:C}=t;S&&u.debug(`Running QA Test Cases Workflow for ${_}/${v}#${y}`);try{u.log(`Step 1: Initializing GitHub Client...`);let t=C||new s(n),w=new r(t);u.log(`Step 2: Fetching PR diff and files...`);let T=await w.buildPRContext(_,v,y).catch(e=>{throw Error(`Failed to build PR context: ${e instanceof Error?e.message:String(e)}`)}),E=``;x?(u.log(`Step 3: Searching for documentation matching pattern: ${x}...`),E=p(x),E||u.warn(`No documentation found matching the provided pattern.`)):u.log(`Step 3: No docPattern provided, skipping documentation collection.`),u.log(`Step 4: Loading and rendering prompt...`);let D=e.render(g,{project_context:b||`No project context provided.`,code_diff:T.diff,documentation:E||`No documentation provided for these changes.`});u.log(`Step 5: Generating QA test cases using ${a}:${l}...`),d();let O=await c(o.create(a,{apiKey:f,model:l}),h,{prompt:D.user,systemPrompt:D.system},{maxRetries:3,jsonMode:!0}).catch(e=>{throw Error(`LLM request failed: ${e instanceof Error?e.message:String(e)}`)});if(!O.success)throw Error(`LLM Generation failed: ${O.error}`);let k=O.data;S&&u.debug(`Generated QA Test Cases:`,k),u.log(`Step 6: Updating GitHub PR...`),await i(t,_,v,y,`🧪 QA Test Cases`);let A=k.impactedFeatures.map(e=>e.featureSlug).join(`, `),j=`## 🧪 QA Test Cases

`;j+=`**${k.totalTests} tests — ${A}**\n`,j+=`_${k.summary}_\n\n`;for(let e of k.impactedFeatures)j+=m(e.featureSlug,e.testCases,`- [ ] `);return await t.postComment(_,v,y,j).catch(e=>{throw Error(`Failed to post QA comment: ${e.message}`)}),u.log(`QA Test Cases Workflow completed successfully.`),k}catch(e){let t=e instanceof Error?e.message:String(e);throw u.error(`Workflow failed at step: ${t}`),e}}async function v(){let e={GITHUB_TOKEN:process.env.GITHUB_TOKEN,LLM:process.env.LLM,MODEL:process.env.MODEL,API_KEY:process.env.API_KEY,GITHUB_REPOSITORY_OWNER:process.env.GITHUB_REPOSITORY_OWNER,GITHUB_REPOSITORY_NAME:process.env.GITHUB_REPOSITORY_NAME,GITHUB_EVENT_PULL_REQUEST_NUMBER:process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER},t=Object.entries(e).filter(([e,t])=>!t).map(([e])=>e);t.length>0&&(console.error(`Missing required environment variables:`),console.error(t.join(`, `)),process.exit(1));let n={githubToken:process.env.GITHUB_TOKEN||``,llm:process.env.LLM||``,model:process.env.MODEL||``,apiKey:process.env.API_KEY||``,owner:process.env.GITHUB_REPOSITORY_OWNER||``,repo:process.env.GITHUB_REPOSITORY_NAME||``,pullNumber:parseInt(process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER||`0`,10),projectContext:process.env.PROJECT_CONTEXT||``,docPattern:process.env.DOC_PATTERN||``,debug:process.env.DEBUG===`true`};try{await _(n),process.exit(0)}catch(e){console.error(`Workflow failed:`,e),process.exit(1)}}process.env.NODE_ENV!==`test`&&v();export{_ as runQATestCasesWorkflow};