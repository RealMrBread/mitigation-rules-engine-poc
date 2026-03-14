import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('smoke test', () => {
  it('should parse a string with zod', () => {
    const result = z.string().parse('hello');
    expect(result).toBe('hello');
  });
});
