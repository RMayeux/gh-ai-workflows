# Provider System Documentation

The Provider system is designed to make the platform agnostic to the underlying AI model. It allows users to switch between OpenAI, Anthropic, Gemini, and Mistral with zero changes to the workflow logic.

## Architecture

The system relies on a common interface defined in `src/core/types/llm.ts`: `LLMProvider`.

### The `LLMProvider` Interface

Every provider implementation must implement the following:

- `providerId`: A unique string identifier (e.g., `'openai'`).
- `capabilities`: An object describing the provider's limits and features:
    - `capabilities`: A `Set` of supported features (e.g., `json_mode`, `vision`).
    - `maxTokens`: Maximum tokens the provider can generate.
    - `contextWindow`: Total token limit for the prompt + response.
- `generate(request: GenerateRequest)`: The primary method to send a prompt and receive a `GenerateResponse`.

## Provider Registry

To avoid hard-coding provider implementations, the platform uses a `ProviderRegistry`.

### Registering a Provider
Providers are registered during the application initialization phase:
```typescript
ProviderRegistry.register('openai', OpenAIProvider);
```

### Creating a Provider Instance
Workflows instantiate providers using the registry:
```typescript
const provider = ProviderRegistry.create('openai', { apiKey: 'sk-...' });
```

## Supported Providers

| Provider | JSON Mode | Vision | Max Tokens | Context Window |
| :--- | :---: | :---: | :---: | :---: |
| **OpenAI** | ✅ | ✅ | 4096 | 128k |
| **Anthropic** | ✅ | ✅ | 4096 | 200k |
| **Gemini** | ✅ | ✅ | 8192 | 1M |
| **Mistral** | ✅ | ❌ | 4096 | 32k |
| **Mock** | ✅ | ❌ | N/A | N/A |

## Adding a New Provider

To add a new LLM provider:

1. **Create Implementation**: Create a new class in `src/platform/llm/implementations/` that implements `LLMProvider`.
2. **Implement `generate`**: Handle the provider's specific API requests and responses.
3. **Normalize Errors**: Use the `normalizeError` method to map vendor-specific errors (like 429 Too Many Requests) to platform-standard errors (`RateLimitError`).
4. **Register**: Add the provider to `registerAllProviders()` in `src/platform/llm/index.ts`.
5. **Test**: Add unit tests in `src/platform/llm/tests/` using the Mock provider or real API keys.
