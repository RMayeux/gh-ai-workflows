import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { getAllFilesRecursive, collectDocs } from '../file-system';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('getAllFilesRecursive', () => {
  it('returns files from a flat directory', () => {
    vi.mocked(readdirSync).mockReturnValue(['a.ts', 'b.ts'] as never);
    vi.mocked(existsSync).mockImplementation((p) => {
      const str = String(p);
      return str.endsWith('.ts');
    });

    const result = getAllFilesRecursive('/root');
    expect(result).toEqual(['/root/a.ts', '/root/b.ts']);
  });

  it('skips directories named .git, node_modules, dist', () => {
    vi.mocked(readdirSync).mockReturnValue(['.git', 'node_modules', 'dist', 'keep'] as never);
    vi.mocked(existsSync).mockReturnValue(false);

    const result = getAllFilesRecursive('/root');
    expect(result).toEqual([]);
  });

  it('recursively traverses subdirectories', () => {
    const dirContents: Record<string, string[]> = {};
    const existingPaths = new Set<string>();
    vi.mocked(readdirSync).mockImplementation((p) => dirContents[String(p)] as never);
    vi.mocked(existsSync).mockImplementation((p) => existingPaths.has(String(p)));

    existingPaths.add('/root/dir');
    existingPaths.add('/root/file.ts');
    existingPaths.add('/root/dir/nested.ts');
    dirContents['/root'] = ['dir', 'file.ts'];
    dirContents['/root/dir'] = ['nested.ts'];

    const result = getAllFilesRecursive('/root');
    expect(result).toContain('/root/file.ts');
    expect(result).toContain('/root/dir/nested.ts');
  });

  it('handles readdir errors gracefully inside recursion', () => {
    vi.mocked(readdirSync)
      .mockReturnValueOnce(['a', 'b'] as never)
      .mockImplementationOnce(() => { throw new Error('permission denied'); });
    vi.mocked(existsSync).mockReturnValue(false);

    const result = getAllFilesRecursive('/root');
    expect(result).toEqual([]);
  });

  it('handles empty directory', () => {
    vi.mocked(readdirSync).mockReturnValue([]);
    const result = getAllFilesRecursive('/root');
    expect(result).toEqual([]);
  });
});

describe('collectDocs', () => {
  beforeEach(() => {
    vi.spyOn(process, 'cwd').mockReturnValue('/root');
  });

  it('collects content from files matching the pattern', () => {
    vi.mocked(readdirSync).mockReturnValue(['doc.md', 'other.ts'] as never);
    vi.mocked(existsSync).mockImplementation((p) => {
      const str = String(p);
      return str.endsWith('.md') || str.endsWith('.ts');
    });
    vi.mocked(readFileSync).mockImplementation((p) => {
      if (String(p).endsWith('doc.md')) return '# Doc content';
      return '';
    });

    const result = collectDocs('\\.md$');
    expect(result).toContain('--- FILE: doc.md ---');
    expect(result).toContain('# Doc content');
  });

  it('returns empty string when no files match the pattern', () => {
    vi.mocked(readdirSync).mockReturnValue(['doc.md'] as never);
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('# Doc content');

    const result = collectDocs('\\.txt$');
    expect(result).toBe('');
  });

  it('skips files that fail to read', () => {
    vi.mocked(readdirSync).mockReturnValue(['doc.md'] as never);
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation(() => { throw new Error('EACCES'); });

    const result = collectDocs('\\.md$');
    expect(result).toBe('');
  });

  it('handles empty directory', () => {
    vi.mocked(readdirSync).mockReturnValue([]);
    const result = collectDocs('\\.md$');
    expect(result).toBe('');
  });
});
