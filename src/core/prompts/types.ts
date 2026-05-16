export interface PromptOverride {
  system?: string;
  user?: string;
}

export interface PromptDefinition {
  id: string;
  version: string;
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
