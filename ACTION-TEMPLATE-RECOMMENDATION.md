# Action Template Recommendation: Composite Actions That Download & Invoke Prebuilt Rust Binaries

## Research Summary

### 1. Biome (`biomejs/setup-biome`)

- **Runtime model**: Node.js 24 action (`@actions/core`, `@actions/tool-cache`). Bundled to `dist/index.mjs` via `bun build`.
- **Download flow**: Resolves version (input → lockfiles → `package.json` → `biome.json` `$schema` → `"latest"`). Queries GH Releases API via Octokit to find release tag, paginates assets, matches asset name to `${platform}-${arch}`. Downloads via `@actions/tool-cache` (uses GH Releases HTTPS), renames binary to `biome`, `chmod 755`, adds dir to `$PATH` via `core.addPath`.
- **Caching**: None — `@actions/tool-cache` places binaries in a temp dir added to PATH each run.
- **Platform mapping**:
  ```
  linux  → linux-${arch}
  darwin → darwin-${arch}
  win32  → win32-${arch}.exe
  ```
- **Source**: [src/setup.ts](https://github.com/biomejs/setup-biome/blob/main/src/setup.ts)

### 2. Oxlint (`oxc-project/oxlint-action`)

- **Runtime model**: Composite action with bash scripts. Does _not_ download a Rust binary directly — uses `npx oxlint@<version>` which pulls the npm package (which ships NAPI bindings, not a standalone binary).
- **Input-to-arg mapping**: All inputs passed as env vars (`OXLINT_DENY`, `OXLINT_WARN`, etc.), a companion `oxlint.sh` script builds CLI flags via string munging.
- **PR-aware**: On `pull_request` events, fetches base branch, diffs changed files, filters to lintable extensions, passes paths as positional args.
- **Output**: Uses `--format github` for GH-annotations-compatible output.
- **Source**: [oxlint.sh](https://github.com/oxc-project/oxlint-action/blob/main/oxlint.sh), [action.yml](https://github.com/oxc-project/oxlint-action/blob/main/action.yml)

### 3. `taiki-e/install-action` (community standard)

- **Runtime model**: Composite bash (sh → bash bootstrap). Downloads prebuilt binaries from GH Releases with SHA256 verification.
- **Tool coverage**: ~200+ tools with manifest-driven download URLs. Non-listed tools fall back to `cargo-binstall`.
- **Caching**: None built-in — each run fetches fresh. But `Swatinem/rust-cache` is the standard for Rust build artifact caching (caches `~/.cargo`, `target/`).
- **Security**: SHA256 checksums verified for all manifest-listed tools. Falls back to HTTPS+tlsv1.2+ for others.
- **Source**: [action.yml](https://github.com/taiki-e/install-action/blob/main/action.yml)

### 4. `oxc-project/archive-binary` (binary release helper)

- Platform-conditional archive: Windows → `.zip` via `7z`, Unix → `.tar.gz` via `tar czf`.
- Used in the release pipeline to bundle binaries before uploading to GH Releases.
- **Source**: [action.yml](https://github.com/oxc-project/oxc/blob/main/.github/actions/archive-binary/action.yml)

---

## Recommended Pattern for gh-ai-workflows

### Architecture Decision

**TypeScript action (Node runtime) over composite shell**, because:
- Existing codebase is TypeScript — bundling via `tsdown` is wired.
- `@actions/tool-cache` handles download, retries, and platform-aware temp paths.
- Octokit for GH API is already a dependency pattern in this repo.
- TypeScript gives better error handling, input validation (Zod), and testability.

### Recommended `action.yml` Template

```yaml
name: '<Feature Name>'
description: '<One-line description>'
inputs:
  version:
    description: 'Version to use (semver, "latest", or empty for auto-detect)'
    required: false
    default: ''
  github-token:
    description: 'GitHub Token for API requests'
    required: true
    default: ${{ github.token }}
  # Feature-specific inputs become CLI flags:
  config:
    description: 'Path to config file'
    required: false
    default: ''

runs:
  using: 'composite'
  steps:
    - name: 'Download & Invoke Binary'
      shell: bash
      env:
        INPUT_VERSION: ${{ inputs.version }}
        INPUT_CONFIG: ${{ inputs.config }}
        GITHUB_TOKEN: ${{ inputs.github-token }}
      run: node ${{ github.action_path }}/../../dist/<feature>/index.mjs
```

### CLI Argument Design (Binary Contract)

The Rust binary (e.g., `wfs-lint`, `wfs-format`, `wfs-ai`) receives:

```
wfs <command> [--flag value] [--other-flag] [positional...]
```

**Flag naming convention**:
| Action Input | Env Var | CLI Flag | Type |
|---|---|---|---|
| `version` | `INPUT_VERSION` | — (used to select binary) | internal |
| `config` | `INPUT_CONFIG` | `--config` | string |
| `debug` | `INPUT_DEBUG` | `--debug` | flag (bool) |
| `working-directory` | `INPUT_WORKING_DIRECTORY` | `--cwd` | string |
| `max-warnings` | `INPUT_MAX_WARNINGS` | `--max-warnings` | number |

The TypeScript action constructs the CLI command by iterating over known env vars and appending flags. The binary parses with `clap` (Rust).

### Version Selection Strategy

```
1. inputs.version (if non-empty)
2. package.json / lockfile (project-managed version, auto-detect)
3. "latest" → fetch latest stable GH Release tag
```

**Implementation sketch** (TypeScript action):

```ts
async function resolveVersion(version: string, octokit: Octokit): Promise<string> {
  if (version && version !== 'latest') return version;
  // Auto-detect from project
  const pkg = tryReadPackageJson();
  if (pkg?.devDependencies?.['@wfs/cli']) return pkg.devDependencies['@wfs/cli'];
  // Fallback: latest stable release
  const releases = await octokit.paginate('GET /repos/{owner}/{repo}/releases', {
    owner: 'RMayeux', repo: 'gh-ai-workflows',
  });
  return releases.filter(r => !r.prerelease && !r.draft)[0].tag_name;
}
```

### Binary Download & Platform Detection

```ts
// Platform → asset suffix mapping
const assetSuffix: Record<string, string> = {
  linux:   `linux-${arch}`,
  darwin:  `darwin-${arch}`,
  win32:   `win32-${arch}.exe`,
};

// Download via @actions/tool-cache
const assetUrl = findAssetMatching(release, assetSuffix[process.platform]);
const downloadPath = await downloadTool(assetUrl);
const binaryPath = renameToStandardName(downloadPath, 'wfs');
chmodSync(binaryPath, 0o755);
core.addPath(dirname(binaryPath));
```

### Caching the Binary Across Workflow Runs

**Recommendation: Use `@actions/cache` in the consumer workflow, not inside the action.**

Rationale:
- Caching inside the action couples it to a specific caching strategy.
- The consumer may already use `actions/cache` for other artifacts.
- Actions that self-cache create implicit state that can confuse debugging.

Template for consumer workflows:

```yaml
- name: Cache wfs binary
  uses: actions/cache@v4
  id: cache-wfs
  with:
    path: ~/.cache/wfs
    key: ${{ runner.os }}-wfs-${{ env.WFS_VERSION }}

- name: Setup wfs
  if: steps.cache-wfs.outputs.cache-hit != 'true'
  uses: RMayeux/gh-ai-workflows/.github/actions/setup-wfs@v1
  with:
    version: ${{ env.WFS_VERSION }}
```

For the setup action itself, expose a `install-only` mode that skips the binary invocation and just places the binary in a known path.

### Graceful Handling: Missing Binary / Wrong Platform

```ts
// In the TypeScript action:
try {
  const asset = findAsset(release, assetSuffix[platform]);
  if (!asset) {
    core.setFailed(`Unsupported platform: ${platform}-${arch}. Supported: linux-x64, linux-arm64, darwin-x64, darwin-arm64, win32-x64.`);
    process.exit(1);
  }
} catch (error) {
  if (error instanceof RequestError && error.status === 404) {
    core.setFailed(`Version ${version} not found. Check the version exists in GH Releases.`);
    process.exit(1);
  }
  // Rate limiting
  if (error instanceof RequestError && error.status === 403) {
    core.setFailed('GitHub API rate limited. Provide a GITHUB_TOKEN with higher limits.');
    process.exit(1);
  }
  throw error; // Unexpected — let it surface
}
```

### Binary-to-Action Output Protocol

The Rust binary communicates results to the action via:

1. **Exit code**: `0` = success, `1` = failure (action calls `core.setFailed`).
2. **Stdout lines** prefixed with a structured output prefix, parsed by the action wrapper:

```
::wfs-output::{"key":"annotations","value":[...]}
::wfs-output::{"key":"summary","value":"..."}
```

The TypeScript action reads stdout line-by-line, parses `::wfs-output::` JSON lines, and translates to:
- `core.setOutput(name, value)` for workflow outputs.
- `core.error`/`core.warning` for GitHub annotations (file:line:col messages).
- `core.setFailed` if the binary exits non-zero.

**Future**: Move to `@actions/artifact` client for large result payloads (diffs, structured reports).

### File Layout per Feature

```
features/<name>/
  index.ts       # Orchestration: download binary, build args, invoke, parse output
  prompt.ts      # Prompts (if the binary is an AI tool)
  schema.ts      # Input Zod schema
  action.yml     # Composite action metadata
  __tests__/
    index.test.ts
    prompt.test.ts
    schema.test.ts
```

`index.ts` implements:
1. `resolveVersion()` — version selection cascade
2. `downloadBinary()` — platform detection, GH Release asset lookup, download
3. `buildArgs()` — env var → CLI flag conversion
4. `invokeBinary()` — spawn, stream output, parse protocol lines
5. `handleResult()` — translate protocol to `core.setOutput`, `core.setFailed`, annotations

### Consumer Workflow Example

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/cache@v4
        id: cache-wfs
        with:
          path: ~/.cache/wfs
          key: ${{ runner.os }}-wfs-1.0.0
      - uses: RMayeux/gh-ai-workflows/features/lint@v1
        if: steps.cache-wfs.outputs.cache-hit != 'true'
        with:
          version: '1.0.0'
          config: wfs.config.json
```

---

## Key Differences from Existing Pattern (Node JS Actions)

| Aspect | Current (pure JS) | Future (Rust binary) |
|---|---|---|
| Runtime | Node.js only | Node.js action downloads + invokes Rust binary |
| Entrypoint | `node dist/<name>/index.mjs` runs the whole workflow | Same, but spawns a child process for the binary |
| Output | Direct function calls to GH API | Binary writes structured stdout → action translates |
| Dependencies | Zod, LLM SDKs, Octokit | Same + `@actions/tool-cache`, Octokit for release discovery |
| Version mgmt | Pinned in repo | Downloaded from GH Releases by semver |
