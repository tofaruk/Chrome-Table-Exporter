
import { describe, it, expect } from 'vitest';
import { escapeCell, toDelimited } from '../src/helpers/csv';

describe('csv helpers', () => {
  it('escapes quotes and delimiter', () => {
    const out = escapeCell('a,b\"c', ',', '\"', false);
    expect(out).toBe('\"a,b\"\"c\"');
  });

  it('handles newlines and alwaysQuote', () => {
    const out = escapeCell('line1\nline2', ',', '\"', true);
    expect(out).toBe('\"line1\nline2\"');
  });

  it('toDelimited joins rows and columns', () => {
    const text = toDelimited([['A','B'], ['1','2']], ',', false);
    expect(text).toBe('A,B\n1,2');
  });
});
