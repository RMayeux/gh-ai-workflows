import { 
  PromptDefinition, 
  PromptResult, 
  PromptVariables 
} from './types/prompt';

export class PromptEngine {
  /**
   * Interpolates variables into a template string.
   * Replaces {{variable}} with the corresponding value from variables.
   */
  static interpolate(template: string, variables: PromptVariables): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      if (value === undefined) {
        throw new Error(`Missing required prompt variable: ${key}`);
      }
      return String(value);
    });
  }

  /**
   * Renders a prompt definition into final system and user strings.
   */
  static render(
    definition: PromptDefinition, 
    variables: PromptVariables, 
    providerId?: string
  ): PromptResult {
    let system = definition.system;
    let user = definition.user;

    // Apply provider-specific overrides
    if (providerId && definition.overrides?.[providerId]) {
      const overrides = definition.overrides[providerId];
      if (overrides.system) system = overrides.system;
      if (overrides.user) user = overrides.user;
    }

    return {
      system: this.interpolate(system, variables),
      user: this.interpolate(user, variables),
    };
  }
}
