import { describe, it, expect } from 'vitest';

describe('toolchain smoke', () => {
  it('runs vitest with TypeScript', () => {
    const answer: number = 42;
    expect(answer).toBe(42);
  });
});
