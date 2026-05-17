# Prompt System Documentation

The prompt system provides a centralized, type-safe way to manage LLM prompts across the platform.

## Implementation

Prompts are implemented as TypeScript constants located in `src/core/prompts/`. This approach ensures type safety, removes runtime filesystem dependencies, and allows prompts to be bundled directly with the application.

### Prompt Structure

Each prompt is defined as a `PromptDefinition` object:

```typescript
export const MY_PROMPT: PromptDefinition = {
  id: 'my-prompt-id',
  system: `You are an expert...`,
  user: `Please analyze this: {{input_data}}`,
  overrides: {},
};
```

- **`id`**: A unique identifier used by the `PromptLoader` to retrieve the prompt.
- **`system`**: The system-level instructions for the LLM.
- **`user`**: The user-level prompt template.
- **`overrides`**: (Optional) A map of provider-specific prompt overrides.

## Loading Prompts

The `PromptLoader` is used to retrieve prompts by their ID:

```typescript
const loader = new PromptLoader();
const prompt = await loader.load('pr-metadata');
```

## Variable Interpolation

Prompts use `{{variable_name}}` syntax for placeholders. The `PromptEngine` replaces these placeholders with provided values.

**Warning**: If a variable is present in the template but not provided in the variables object, the engine will throw an error to prevent sending incomplete prompts to the LLM.

## Provider Overrides

Different LLM providers (OpenAI, Anthropic, etc.) may respond better to different prompt phrasing. You can define overrides directly within the `PromptDefinition`:

```typescript
overrides: {
  "anthropic": {
    "system": "You are an expert... (Anthropic-specific wording)",
    "user": "Please analyze this... (Anthropic-specific wording)"
  }
}
```

If an override is present for the given `providerId`, it replaces the base system/user prompt before variable interpolation.

## Adding a New Prompt

To add a new prompt to the system:

1. **Create a new file**: Create `src/core/prompts/[prompt-id].ts`.
2. **Define the prompt**: Export a `PromptDefinition` constant.
3. **Register the prompt**: Import the constant into `src/core/prompts/loader.ts` and add it to the `PROMPTS_REGISTRY` map.
4. **Use in Workflow**: Call `loader.load('[prompt-id]')` in your workflow logic.
