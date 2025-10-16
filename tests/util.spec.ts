
import { describe, it, expect, vi } from 'vitest';
import { throttle } from '../src/helpers/util';

describe('throttle', () => {
  it('throttles calls', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t();
    t();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(120);
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
