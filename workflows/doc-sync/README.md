# AI Doc Sync

Synchronizes project documentation with code changes in a Pull Request.

## 🚀 How to Trigger

### 1. Automatic Trigger
The workflow runs automatically when:
- A Pull Request is **opened**.
- A Pull Request is **updated** (new commits pushed).

### 2. Manual Trigger
To manually sync docs for a PR:
1. Go to the **Actions** tab in GitHub.
2. Select **Doc Sync** from the left sidebar.
3. Click **Run workflow**.
4. Enter the **Pull Request Number** and click **Run workflow**.

## ⚙️ Configuration
Inputs are configured in `.github/workflows/doc-sync.yml`.

The `doc-pattern` input allows you to specify which files should be considered as documentation (e.g., `docs/.*\.md$`).
