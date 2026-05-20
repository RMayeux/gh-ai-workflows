# Providers

## openai
- Required env vars: `API_KEY` (string, OpenAI dashboard), `MODEL` (string, OpenAI docs)
- Optional env vars: None
- Known limitations: None

## anthropic
- Required env vars: `API_KEY` (string, Anthropic console), `MODEL` (string, Anthropic docs)
- Optional env vars: None
- Known limitations: None

## gemini
- Required env vars: `API_KEY` (string, Google AI Studio), `MODEL` (string, Google AI Studio)
- Optional env vars: None
- Known limitations: None

## mistral
- Required env vars: `API_KEY` (string, Mistral console), `MODEL` (string, Mistral docs)
- Optional env vars: None
- Known limitations: None

## mock
- Required env vars: None
- Optional env vars: `responseText` (string, custom response)
- Known limitations: Does not call actual LLM
