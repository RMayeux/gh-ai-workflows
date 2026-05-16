import { z } from 'zod';
import { LLMProvider, GenerateRequest, GenerateResponse } from './types/llm';

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
 * Removes markdown code fences from a string.
 */
export function cleanJson(text: string): string {
  const regex = /^```json\s*([\s\S]*?)\s*```$|^```\s*([\s\S]*?)\s*```$|^[\s\S]*?({[\s\S]*})[\s\S]*$/;
  const match = text.trim().match(regex);
  if (match) {
    return (match[1] || match[2] || match[3]).trim();
  }
  return text.trim();
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
        if (attempts > maxRetries) {
          return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
            attempts,
            rawResponse: lastRawResponse,
          };
        }

        // Prepare repair request
        const repairPrompt = `The previous output was invalid JSON or failed validation. 
Please correct it. 
Original output: ${lastRawResponse}
Error: ${e instanceof Error ? e.message : String(e)}
Return ONLY the corrected JSON.`;

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
