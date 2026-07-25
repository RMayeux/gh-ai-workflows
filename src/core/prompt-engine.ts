export interface PromptOverride {
  system?: string;
  user?: string;
}

export interface PromptDefinition {
  id: string;
  system: string;
  user: string;
  overrides?: Record<string, PromptOverride>;
}

export interface PromptResult {
  system: string;
  user: string;
}

export interface PromptVariables {
  [key: string]: string | number | boolean | undefined;
}

export class PromptEngine {
  private static isTruthy(val: string | number | boolean | undefined): boolean {
    return val !== undefined && val !== false && val !== 0 && val !== '';
  }

  private static getRequired(key: string, variables: PromptVariables): string | number | boolean {
    const value = variables[key];
    if (value === undefined) {
      throw new Error(`Missing required prompt variable: ${key}`);
    }
    return value;
  }

  /**
   * Interpolates variables into a template string.
   * Supports {{variable}}, {{#var}}...{{/var}} (truthy), {{^var}}...{{/var}} (falsy).
   */
  static interpolate(template: string, variables: PromptVariables): string {
    let result = template;

    result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
      return this.isTruthy(this.getRequired(key, variables)) ? content : '';
    });

    result = result.replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
      return this.isTruthy(this.getRequired(key, variables)) ? '' : content;
    });

    result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return String(this.getRequired(key, variables));
    });

    return result;
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
