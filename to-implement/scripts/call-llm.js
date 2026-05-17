#!/usr/bin/env node
/**
 * call-llm.js
 * Calls the Gemini API with gemma-4-31b-it.
 *
 * Usage:
 *   PROMPT_FILE=/tmp/prompt.txt node call-llm.js          -> text output
 *   PROMPT_FILE=/tmp/prompt.txt node call-llm.js --json   -> validated JSON output
 */

import { readFileSync } from 'fs';

const jsonMode = process.argv.includes('--json');

if (!process.env.PROMPT_FILE) { console.error('Missing PROMPT_FILE'); process.exit(1); }
if (!process.env.GEMINI_API_KEY) { console.error('Missing GEMINI_API_KEY'); process.exit(1); }

const prompt = readFileSync(process.env.PROMPT_FILE, 'utf8').trim();
if (!prompt) { console.error('Prompt file is empty'); process.exit(1); }

const MODEL = 'gemma-4-31b-it';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 5000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Jittered exponential backoff: base * 2^attempt + random jitter up to 1s
const retryDelay = (attempt) => BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 1000;

async function callGemini() {
  const url = `${BASE_URL}/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const startTime = Date.now();

  const systemInstruction = jsonMode
    ? 'You are a helpful assistant. Output only valid JSON. No preamble, no explanation, no markdown fences.'
    : 'You are a helpful assistant.';

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 4096, temperature: 0.2 }
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.error(`Attempt ${attempt}/${MAX_RETRIES}...`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      const data = await response.json();

      if (!data.candidates?.length) {
        console.error(`Attempt ${attempt}: empty response`);
      } else {
        const text = data.candidates[0].content.parts
          .filter(p => p.thought !== true)
          .map(p => p.text || '')
          .join('\n')
          .trim();

        if (text) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const usage = data.usageMetadata || {};
          console.error(`✓ Done in ${elapsed}s | prompt tokens: ${usage.promptTokenCount ?? '?'} | output tokens: ${usage.candidatesTokenCount ?? '?'}`);

          // Write to step summary if available
          if (process.env.GITHUB_STEP_SUMMARY) {
            const { appendFileSync } = await import('fs');
            appendFileSync(process.env.GITHUB_STEP_SUMMARY,
              `| LLM | ${elapsed}s | ${usage.promptTokenCount ?? '?'} | ${usage.candidatesTokenCount ?? '?'} |\n`
            );
          }

          return text;
        }
        console.error(`Attempt ${attempt}: only thought blocks, retrying...`);
      }
    } else {
      const errorText = await response.text();
      console.error(`Attempt ${attempt}: API error ${response.status} — ${errorText}`);
    }

    if (attempt < MAX_RETRIES) {
      const delay = retryDelay(attempt);
      console.error(`Retrying in ${(delay / 1000).toFixed(1)}s...`);
      await sleep(delay);
    }
  }

  console.error(`All ${MAX_RETRIES} attempts failed.`);
  process.exit(1);
}

async function main() {
  const text = await callGemini();

  if (jsonMode) {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try {
      JSON.parse(clean);
      console.log(clean);
    } catch {
      console.error('LLM did not return valid JSON. Raw response:', clean);
      process.exit(1);
    }
  } else {
    console.log(text);
  }
}

main().catch(err => { console.error('Unexpected error:', err); process.exit(1); });
