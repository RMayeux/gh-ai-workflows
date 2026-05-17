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
  // ...
});
```

## Structured Output Validation

The core of the platform is the `generateStructured` function. Instead of hoping the LLM returns valid JSON, we enforce it.

### The Validation Pipeline

1. **Raw Response**: The LLM returns a string.
2. **JSON Cleaning**: The `cleanJson` utility removes markdown code fences (e.g., ` ```json ... ``` `).
3. **JSON Parsing**: `JSON.parse()` converts the string to a JavaScript object. If a single-element array is returned when an object is expected, the platform automatically unwraps the value to match the schema.
4. **Schema Validation**: `schema.parse(object)` checks the object against the Zod schema.

### Self-Repair Loop
When validation fails, the platform implements a retry mechanism to handle transient issues or inconsistent LLM outputs:

1. **Catch Error**: The Zod validation or JSON parsing error is caught.
2. **Retry**: The request is retried using exponential backoff.
3. **Repeat**: This loop continues up to `maxRetries` (default: 2).

## Validation Results

The validation logic in `src/core/structured-generation.ts` provides a normalized result format:

```typescript
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}
```

This allows the workflow to handle errors gracefully and provide human-readable feedback in GitHub Action logs.