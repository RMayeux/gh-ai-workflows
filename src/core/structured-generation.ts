import { z } from 'zod';
import { LLMProvider, GenerateRequest, GenerateResponse } from '../platform/llm/types';
import { Logger } from './telemetry';
import { LLMError } from './errors/llm-errors';

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

  // 3. Last resort: Find the first '[' or '{' and the corresponding last ']' or '}'
  const firstBrace = trimmed.indexOf('{');
  const firstBracket = trimmed.indexOf('[');
  
  let start = -1;
  let end = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    end = trimmed.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    start = firstBracket;
    end = trimmed.lastIndexOf(']');
  }
  
  if (start !== -1 && end !== -1 && end > start) {
    const extracted = trimmed.substring(start, end + 1);
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
 * Generates structured output from an LLM, with retry logic only for HTTP/Transient errors.
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
      let timeoutId: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('LLM request timed out after 300 seconds')), 300000);
      });

      const response = await Promise.race([
        provider.generate(currentRequest),
        timeoutPromise
      ]) as GenerateResponse;
      
      clearTimeout(timeoutId!);

      if (response.usage) {
        Logger.debug(`[StructuredGeneration] Token usage — prompt: ${response.usage.promptTokens}, completion: ${response.usage.completionTokens}, total: ${response.usage.totalTokens}`);
      }

      lastRawResponse = response.text;
      const cleaned = cleanJson(lastRawResponse);
      
      if (cleaned !== lastRawResponse.trim()) {
        Logger.debug(`[StructuredGeneration] JSON extraction performed. Raw length: ${lastRawResponse.length}, Cleaned length: ${cleaned.length}`);
      }
      
      try {
        let parsed = JSON.parse(cleaned);
        
        // If schema expects an object but we got a single-element array, unwrap it
        if (schema instanceof z.ZodObject && Array.isArray(parsed) && parsed.length === 1) {
          Logger.debug(`[StructuredGeneration] Unwrapping single-element array to match object schema`);
          parsed = parsed[0];
        }

        const validated = schema.parse(parsed);
        
        return {
          success: true,
          data: validated,
          attempts,
          rawResponse: lastRawResponse,
        };
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        
        if (attempts <= maxRetries) {
          Logger.error(`[StructuredGeneration] Parsing/Validation failed: ${errorMessage}. Raw JSON: ${cleaned}. Retrying... (Attempt ${attempts}/${maxRetries})`);
          const delay = Math.pow(2, attempts) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        Logger.error(`[StructuredGeneration] Parsing/Validation failed after max retries: ${errorMessage}. Raw JSON: ${cleaned}`);
        return {
          success: false,
          error: `Format Error: ${errorMessage}`,
          attempts,
          rawResponse: lastRawResponse,
        };
      }
    } catch (e: unknown) {
      const isRetryable = e instanceof LLMError ? e.retryable : false;
      const errorMessage = e instanceof Error ? e.message : String(e);

      if (isRetryable && attempts <= maxRetries) {
        const delay = Math.pow(2, attempts) * 1000;
        Logger.error(`[StructuredGeneration] Retryable error: ${errorMessage}. Retrying in ${delay}ms... (Attempt ${attempts}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      Logger.error(`[StructuredGeneration] Non-retryable error or max retries reached: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        attempts,
        rawResponse: lastRawResponse,
      };
    }
  }

  return {
    success: false,
    error: 'Max retries reached',
    attempts,
    rawResponse: lastRawResponse,
  };
}
