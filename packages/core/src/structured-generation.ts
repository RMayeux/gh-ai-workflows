import { z } from 'zod';
import { LLMProvider, GenerateRequest, GenerateResponse } from './types/llm';
import { Logger } from './telemetry';

export interface StructuredGenerationOptions {
  maxRetries?: number;
  jsonMode?: boolean;
}

export interface StructuredGenerationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
  rawResponse: string;
}

/**
 * Robustly extracts JSON from a string, handling markdown fences and surrounding text.
 */
export function cleanJson(text: string): string {
  const trimmed = text.trim();
  
  // 1. Try parsing as-is first
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // Not a plain JSON string, continue to cleaning
  }

  // 2. Try to find JSON blocks (```json ... ``` or ``` ... ```)
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const fenceMatch = trimmed.match(fenceRegex);
  if (fenceMatch && fenceMatch[1]) {
    const content = fenceMatch[1].trim();
    try {
      JSON.parse(content);
      return content;
    } catch {
      // Found a fence but it's not valid JSON, keep it for last-resort attempt
    }
  }

  // 3. Last resort: Find the first '{' and last '}'
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const extracted = trimmed.substring(firstBrace, lastBrace + 1);
    try {
      JSON.parse(extracted);
      return extracted;
    } catch {
      // Still not valid JSON
    }
  }

  return trimmed;
}

/**
 * Generates structured output from an LLM, with retry logic and validation.
 */
export async function generateStructured<T>(
  provider: LLMProvider,
  schema: z.ZodSchema<T>,
  request: GenerateRequest,
  options: StructuredGenerationOptions = {}
): Promise<StructuredGenerationResult<T>> {
  const { maxRetries = 2, jsonMode = true } = options;
  let attempts = 0;
  let lastRawResponse = '';

  while (attempts <= maxRetries) {
    attempts++;
    
    // Ensure jsonMode is requested if the provider supports it
    const currentRequest = { 
      ...request, 
      jsonMode: jsonMode && provider.capabilities.capabilities.has('json_mode') 
    };

    try {
      // Implementation of a simple timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('LLM request timed out after 60 seconds')), 60000)
      );

      const response = await Promise.race([
        provider.generate(currentRequest),
        timeoutPromise
      ]) as GenerateResponse;

      lastRawResponse = response.text;
      const cleaned = cleanJson(lastRawResponse);
      
      if (cleaned !== lastRawResponse.trim()) {
        Logger.debug(`[StructuredGeneration] JSON extraction performed. Raw length: ${lastRawResponse.length}, Cleaned length: ${cleaned.length}`);
      }
      
      try {
        const parsed = JSON.parse(cleaned);
        const validated = schema.parse(parsed);
        
        return {
          success: true,
          data: validated,
          attempts,
          rawResponse: lastRawResponse,
        };
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        Logger.error(`[StructuredGeneration] Attempt ${attempts} failed: ${errorMessage}`);
        
        if (attempts > maxRetries) {
          return {
            success: false,
            error: errorMessage,
            attempts,
            rawResponse: lastRawResponse,
          };
        }

        // Prepare repair request
        const repairPrompt = `The previous output was invalid JSON or failed validation. 
Please correct it. 
Original output: ${lastRawResponse}
Error: ${errorMessage}
Return ONLY the corrected JSON without any markdown fences or conversational text.`;

        request = { 
          ...request, 
          prompt: repairPrompt 
        };
      }
    } catch (e: any) {
      // Handle RateLimitError with exponential backoff
      if (e.name === 'RateLimitError' && attempts <= maxRetries) {
        const delay = Math.pow(2, attempts) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (attempts > maxRetries) {
        return {
          success: false,
          error: e instanceof Error ? e.message : String(e),
          attempts,
          rawResponse: lastRawResponse,
        };
      }
    }
  }

  return {
    success: false,
    error: 'Max retries reached',
    attempts,
    rawResponse: lastRawResponse,
  };
}
