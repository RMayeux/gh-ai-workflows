import { z } from 'zod';
import { PRMetadataSchema } from './schemas/pr-metadata';
import { PRReviewSchema } from './schemas/pr-review';
import { WorkflowInputsSchema } from './schemas/workflow-inputs';
import { exportToJsonSchema } from './utils/json-schema';

export { PRMetadataSchema, PRReviewSchema, WorkflowInputsSchema };
export { exportToJsonSchema };

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export class Validator {
  /**
   * Validates data against a zod schema.
   * Returns a normalized ValidationResult.
   */
  static validate<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    return {
      success: false,
      errors: result.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })),
    };
  }

  /**
   * Formats validation errors into a human-readable string.
   */
  static formatErrors(errors: ValidationError[]): string {
    return errors
      .map(err => `[${err.path || 'root'}] ${err.message} (${err.code})`)
      .join('\n');
  }
}
