import { describe, it, expect } from 'vitest';
import { PromptEngine, PromptDefinition } from '../prompt-engine';

describe('PromptEngine', () => {
  describe('interpolate', () => {
    it('should replace variables in a template string', () => {
      const template = 'Hello {{name}}, welcome to {{place}}!';
      const variables = { name: 'Alice', place: 'Wonderland' };
      expect(PromptEngine.interpolate(template, variables)).toBe('Hello Alice, welcome to Wonderland!');
    });

    it('should handle numeric and boolean variables', () => {
      const template = 'Value: {{val}}, Active: {{active}}';
      const variables = { val: 42, active: true };
      expect(PromptEngine.interpolate(template, variables)).toBe('Value: 42, Active: true');
    });

    it('should throw an error if a required variable is missing', () => {
      const template = 'Hello {{name}}!';
      const variables = {};
      expect(() => PromptEngine.interpolate(template, variables)).toThrow('Missing required prompt variable: name');
    });

    it('should not replace strings that do not match the pattern', () => {
      const template = 'Hello {name}!';
      const variables = { name: 'Alice' };
      expect(PromptEngine.interpolate(template, variables)).toBe('Hello {name}!');
    });

    it('should include content inside {{#var}} when var is truthy', () => {
      const template = 'Before{{#flag}} INNER {{/flag}}After';
      expect(PromptEngine.interpolate(template, { flag: true })).toBe('Before INNER After');
    });

    it('should omit content inside {{#var}} when var is falsy', () => {
      const template = 'Before{{#flag}} INNER {{/flag}}After';
      expect(PromptEngine.interpolate(template, { flag: false })).toBe('BeforeAfter');
    });

    it('should include content inside {{^var}} when var is falsy', () => {
      const template = 'Before{{^flag}} FALLBACK {{/flag}}After';
      expect(PromptEngine.interpolate(template, { flag: false })).toBe('Before FALLBACK After');
    });

    it('should omit content inside {{^var}} when var is truthy', () => {
      const template = 'Before{{^flag}} FALLBACK {{/flag}}After';
      expect(PromptEngine.interpolate(template, { flag: true })).toBe('BeforeAfter');
    });

    it('should handle multi-line conditional blocks', () => {
      const template = 'a\n{{#show}}\nblock\n{{/show}}\nb';
      expect(PromptEngine.interpolate(template, { show: true })).toBe('a\n\nblock\n\nb');
      expect(PromptEngine.interpolate(template, { show: false })).toBe('a\n\nb');
    });

    it('should throw when conditional variable is missing', () => {
      const template = '{{#missing}}content{{/missing}}';
      expect(() => PromptEngine.interpolate(template, {}))
        .toThrow('Missing required prompt variable: missing');
    });

    it('should support empty string as falsy in conditionals', () => {
      const template = '{{#show}}VISIBLE{{/show}}|{{^show}}HIDDEN{{/show}}';
      expect(PromptEngine.interpolate(template, { show: '' })).toBe('|HIDDEN');
    });
  });

  describe('render', () => {
    const mockDefinition: PromptDefinition = {
      id: 'test-prompt',
      system: 'You are a {{role}}.',
      user: 'Analyze this: {{content}}',
      overrides: {
        'openai': {
          system: 'You are an OpenAI {{role}}.',
        },
        'anthropic': {
          user: 'Please analyze the following content as an Anthropic model: {{content}}',
        }
      }
    };

    it('should render with default prompts', () => {
      const result = PromptEngine.render(mockDefinition, { role: 'Expert', content: 'Some data' });
      expect(result).toEqual({
        system: 'You are a Expert.',
        user: 'Analyze this: Some data',
      });
    });

    it('should apply provider-specific system overrides', () => {
      const result = PromptEngine.render(mockDefinition, { role: 'Expert', content: 'Some data' }, 'openai');
      expect(result.system).toBe('You are an OpenAI Expert.');
      expect(result.user).toBe('Analyze this: Some data');
    });

    it('should apply provider-specific user overrides', () => {
      const result = PromptEngine.render(mockDefinition, { role: 'Expert', content: 'Some data' }, 'anthropic');
      expect(result.system).toBe('You are a Expert.');
      expect(result.user).toBe('Please analyze the following content as an Anthropic model: Some data');
    });

    it('should throw if interpolation fails during render', () => {
      expect(() => PromptEngine.render(mockDefinition, { role: 'Expert' }))
        .toThrow('Missing required prompt variable: content');
    });
  });
});
