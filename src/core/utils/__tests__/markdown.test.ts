import { describe, it, expect } from 'vitest';
import { formatAIList } from '../markdown';

describe('formatAIList', () => {
  it('formats a list with default checkbox prefix', () => {
    const result = formatAIList('Tasks', ['Item 1', 'Item 2']);
    expect(result).toBe('### Tasks\n- [ ] Item 1\n- [ ] Item 2\n');
  });

  it('uses custom item prefix when provided', () => {
    const result = formatAIList('Done', ['A', 'B'], '- [x] ');
    expect(result).toBe('### Done\n- [x] A\n- [x] B\n');
  });

  it('returns empty string for empty items array', () => {
    const result = formatAIList('Empty', []);
    expect(result).toBe('');
  });

  it('returns empty string for null items', () => {
    const result = formatAIList('Null', null as unknown as string[]);
    expect(result).toBe('');
  });

  it('handles a single item', () => {
    const result = formatAIList('Single', ['Only']);
    expect(result).toBe('### Single\n- [ ] Only\n');
  });
});
