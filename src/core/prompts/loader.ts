import { PromptDefinition } from './types';
import { PR_METADATA_PROMPT } from './pr-metadata';
import { PR_REVIEW_PROMPT } from './pr-review';

const PROMPTS_REGISTRY: Record<string, PromptDefinition> = {
  'pr-metadata': PR_METADATA_PROMPT,
  'pr-review': PR_REVIEW_PROMPT,
};

export class PromptLoader {
  constructor() {}

  /**
   * Loads a prompt by its ID.
   */
  async load(promptId: string): Promise<PromptDefinition> {
    const definition = PROMPTS_REGISTRY[promptId];
    if (!definition) {
      throw new Error(`Prompt ${promptId} not found in registry`);
    }

    return definition;
  }
}
