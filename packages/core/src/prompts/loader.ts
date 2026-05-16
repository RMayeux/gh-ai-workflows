import fs from 'node:fs/promises';
import path from 'node:path';
import { PromptDefinition } from './types';

export class PromptLoader {
  private readonly promptsRoot: string;

  constructor(promptsRoot: string) {
    this.promptsRoot = promptsRoot;
  }

  /**
   * Loads a specific version of a prompt, falling back to the latest if not found.
   */
  async loadWithFallback(promptId: string, version: string): Promise<PromptDefinition> {
    try {
      return await this.load(promptId, version);
    } catch {
      return this.loadLatest(promptId);
    }
  }

  /**
   * Loads a specific version of a prompt.
   */
  async load(promptId: string, version: string): Promise<PromptDefinition> {
    const versionDir = path.join(this.promptsRoot, promptId, version);
    
    try {
      const [system, user] = await Promise.all([
        fs.readFile(path.join(versionDir, 'system.txt'), 'utf-8'),
        fs.readFile(path.join(versionDir, 'user.txt'), 'utf-8'),
      ]);

      let overrides = {};
      try {
        const overridesPath = path.join(versionDir, 'overrides.json');
        const overridesContent = await fs.readFile(overridesPath, 'utf-8');
        overrides = JSON.parse(overridesContent);
      } catch {
        // Overrides are optional
      }

      return {
        id: promptId,
        version,
        system,
        user,
        overrides,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load prompt ${promptId} v${version}: ${message}`);
    }
  }

  /**
   * Loads the latest version of a prompt.
   */
  async loadLatest(promptId: string): Promise<PromptDefinition> {
    const promptDir = path.join(this.promptsRoot, promptId);
    let versions: string[];
    try {
      versions = await fs.readdir(promptDir);
    } catch {
      throw new Error(`No versions found for prompt ${promptId}`);
    }
    
    // Simple semver-ish sort (highest version last)
    const latestVersion = versions.sort((a, b) => {
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] ?? 0;
        const bVal = bParts[i] ?? 0;
        if (aVal !== bVal) return aVal - bVal;
      }
      return 0;
    }).pop();

    if (!latestVersion) {
      throw new Error(`No versions found for prompt ${promptId}`);
    }

    return this.load(promptId, latestVersion);
  }
}
