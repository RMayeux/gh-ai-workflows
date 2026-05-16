# Validation Documentation

The platform uses a "Validation-First" approach to ensure that LLM outputs are predictable and usable in automated CI/CD pipelines.

## The Role of Zod

We use [Zod](https://zod.dev/) as the primary validation engine. Zod allows us to define a single source of truth for the data structure that is used for both TypeScript type-safety and runtime validation.

## Input Validation

Every workflow entry point validates its environment variables. This prevents "garbage-in" scenarios where an LLM might be called with missing or malformed configuration.

### Example Input Schema
```typescript
export const WorkflowInputsSchema = z.object({
  llm: z.enum(['openai', 'anthropic', 'gemini', 'mistral', 'mock']),
  model: z.string().min(1),
  apiKey: z.string().min(1),
  promptVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  // ...
});
```

## Structured Output Validation

The core of the platform is the `generateStructured` function. Instead of hoping the LLM returns valid JSON, we enforce it.

### The Validation Pipeline

1. **Raw Response**: The LLM returns a string.
2. **JSON Cleaning**: The `cleanJson` utility removes markdown code fences (e.g., ` ```json ... ``` `).
3. **JSON Parsing**: `JSON.parse()` converts the string to a JavaScript object.
4. **Schema Validation**: `schema.parse(object)` checks the object against the Zod schema.

### Self-Repair Loop

When validation fails, the platform doesn't simply give up. It utilizes the LLM's ability to correct itself:

1. **Catch Error**: The Zod validation error is caught.
2. **Repair Prompt**: A new prompt is generated:
   *"The previous output was invalid JSON or failed validation. Original output: [RAW]. Error: [ERROR]. Return ONLY the corrected JSON."*
3. **Retry**: The repair prompt is sent to the LLM.
4. **Repeat**: This loop continues up to `maxRetries` (default: 2).

## Validation Results

The `Validator` class in `packages/validators` provides a normalized result format:

```typescript
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}
```

This allows the workflow to handle errors gracefully and provide human-readable feedback in GitHub Action logs.
