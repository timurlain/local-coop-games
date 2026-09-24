import { describe, expect, it } from 'vitest';
import { computeScale } from '../../src/shared/splitscreen';

describe('computeScale', () => {
  it('picks the largest integer scale that fits', () => {
    expect(computeScale(1920, 1080)).toBe(5);
    expect(computeScale(1280, 720)).toBe(3);
    expect(computeScale(640, 400)).toBe(2);
  });

  it('never goes below 1', () => {
    expect(computeScale(300, 150)).toBe(1);
  });
});
