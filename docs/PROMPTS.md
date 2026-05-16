# Prompt System Documentation

The prompt system provides a versioned, testable, and provider-aware way to manage LLM prompts across the monorepo.

## Directory Structure

Prompts are stored in the `/prompts` directory at the root of the repository.

```
prompts/
  └── [prompt-id]/
      └── [version]/
          ├── system.txt      # System prompt template
          ├── user.txt        # User prompt template
          └── overrides.json  # Optional: Provider-specific overrides
```

## Prompt Versioning

Every prompt must have a version (e.g., `1.0.0`). Versions follow semantic versioning principles:
- **Patch**: Minor wording changes that don't change the expected output structure.
- **Minor**: New optional variables or improved guidance.
- **Major**: Changes to the output schema or required variables.

### Loading Prompts

The `PromptLoader` provides two ways to load prompts:
1. `load(promptId, version)`: Loads a specific version. Throws if not found.
2. `loadLatest(promptId)`: Loads the highest version found in the directory.
3. `loadWithFallback(promptId, version)`: Tries to load the specific version, but falls back to the latest version if the requested one is missing.

## Variable Interpolation

Prompts use `{{variable_name}}` syntax. The `PromptEngine` replaces these placeholders with provided values.

**Warning**: If a variable is present in the template but not provided in the variables object, the engine will throw an error to prevent sending incomplete prompts to the LLM.

## Provider Overrides

Different LLM providers (OpenAI, Anthropic, etc.) may respond better to different prompt phrasing. You can define overrides in `overrides.json`:

```json
{
  "anthropic": {
    "system": "You are an expert... (Anthropic-specific wording)",
    "user": "Please analyze this... (Anthropic-specific wording)"
  }
}
```

If an override is present for the given `providerId`, it replaces the base system/user prompt before variable interpolation.

## Migration Guide

When updating a prompt that is used by active workflows:

1. **Non-breaking changes**: Create a new patch version (e.g., `1.0.0` -> `1.0.1`). Workflows using `loadLatest` will pick it up automatically.
2. **Breaking changes** (e.g., adding a required variable):
    - Create a new major version (e.g., `1.0.0` -> `2.0.0`).
    - Update the corresponding workflow code to provide the new variable.
    - Update the workflow to request version `2.0.0`.
    - Keep version `1.0.0` for backward compatibility until all dependencies are migrated.
3. **Deprecation**: Once version `1.0.0` is no longer used, it can be removed from the `/prompts` directory.
