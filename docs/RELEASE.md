# Release & Versioning Policy

This document defines how `gh-ai-workflows` is versioned, released, and maintained.

## 1. Versioning Strategy

### Packages (Core, Providers, etc.)
We use **Semantic Versioning (SemVer)** for all internal packages. Versioning is managed via [Changesets](https://github.com/changesets/changesets).

- **Patch**: Bug fixes and non-breaking internal changes.
- **Minor**: New features, new provider support, or non-breaking prompt updates.
- **Major**: Breaking API changes in `core`, changes to the expected JSON output schema of a workflow, or removals of supported providers.

### Workflows (Composite Actions)
Workflows are versioned globally at the repository level using Git tags.
- **Major Versions**: We maintain major version branches (e.g., `v1`, `v2`).
- **Exact Versions**: We create tags for every release (e.g., `v1.0.0`, `v1.1.0`).

Users are encouraged to pin to major versions for automatic updates:
```yaml
uses: your-org/gh-ai-workflows/workflows/pr-metadata@v1
```

## 2. Release Process

### Local Development
1. Make changes to a package.
2. Run `npx changeset` to create a changeset file describing the change.
3. Commit the changeset file.

### Automated Release
The `releases/publish.yml` workflow handles the following:
1. **Version Bump**: Runs `changeset version` to update `package.json` files and generate changelogs.
2. **Tagging**: Creates a Git tag for the release.
3. **Publishing**: Publishes packages to the registry (if applicable).
4. **Release Notes**: Generates a GitHub Release with the accumulated changelogs.

## 3. Compatibility & Maintenance

### Backward Compatibility Policy
We strive to maintain backward compatibility within a major version.
- **No Breaking Changes in Minor/Patch**: Any change that requires a user to update their `action.yml` inputs or changes the output schema MUST be a Major version bump.
- **Grace Period**: When a major version is deprecated, we maintain the previous major version for at least 3 months.

### Deprecation Policy
1. **Warning**: Deprecated features are marked with a `[DEPRECATED]` warning in the logs.
2. **Notice**: A notice is added to the `USER_GUIDE.md` and the GitHub Release notes.
3. **Removal**: Features are removed in the next Major release.

## 4. Migration Guides
For every Major release, a migration guide is added to the `docs/MIGRATIONS.md` file, detailing:
- What changed.
- Why it changed.
- Step-by-step instructions to upgrade.
