# QA Test Cases Workflow

This workflow automatically generates actionable QA test cases for a pull request by analyzing the code diff and matching it against the project's feature documentation.

## How it works

1. **Context Gathering**: Fetches the PR diff and identifies changed files.
2. **Doc Matching**: Matches changed files to existing feature documentation in `docs/features/`.
3. **AI Analysis**: Uses an LLM to identify new or changed business rules and generate targeted test cases.
4. **GitHub Integration**:
   - Cleans up previous QA test case comments.
   - Posts a new, structured list of test cases to the PR.
   - Removes the `qa-ready` label once completed.

## Usage

This workflow is typically triggered by adding the `qa-ready` label to a pull request.

### Example Workflow Configuration

```yaml
name: QA Test Cases
on:
  pull_request:
    types: [labeled]

jobs:
  generate-qa:
    if: github.event.label.name == 'qa-ready'
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    steps:
      - uses: your-org/gh-ai-workflows/workflows/qa-test-cases@v1
        with:
          llm: 'gemini'
          model: 'gemini-1.5-pro'
          api-key: ${{ secrets.GEMINI_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```
