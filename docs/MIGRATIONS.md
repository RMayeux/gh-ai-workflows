# Migration Guides

This document provides step-by-step instructions for upgrading `gh-ai-workflows` between major versions.

## v1.0.0 $\rightarrow$ v1.1.0 (Minor Update)
No breaking changes. Updated provider capabilities for Gemini and added Mistral support.

## v1.1.0 $\rightarrow$ v1.2.0 (Minor Update)
Removed prompt versioning and filesystem-based prompt loading. Prompts are now managed as TypeScript constants in `src/core/prompts`. This simplifies the architecture and improves type safety.

## v1.0.0 $\rightarrow$ v2.0.0 (Major Update)
*This is an example migration guide.*

### Changes
- **Output Schema**: The `PRMetadata` schema now includes `risk_level` (enum: low, medium, high).
- **Required Inputs**: Added `organization-id` as a required input for enterprise billing tracking.

### Upgrade Steps
1. **Update Workflow**: Update your `.github/workflows/ai-pr-metadata.yml` to use `v2`.
   ```yaml
   uses: your-org/gh-ai-workflows/workflows/pr-metadata@v2
   ```
2. **Add New Input**: Provide the `organization-id` secret.
   ```yaml
   with:
     organization-id: ${{ secrets.ORG_ID }}
   ```
3. **Update Downstream Logic**: If you use the `doc_slugs` output in other jobs, ensure you handle the new `risk_level` output if needed.
