import { describe, expect, it } from 'vitest';
import { createEventBus } from '../src/core/events.js';

describe('event bus', () => {
  it('delivers to listeners', () => {
    const bus = createEventBus();
    const seen: number[] = [];
    bus.on('kilometre', (p) => seen.push(p.km));
    bus.emit('kilometre', { km: 3 });
    bus.emit('kilometre', { km: 4 });
    expect(seen).toEqual([3, 4]);
  });

  it('unsubscribes via the returned handle', () => {
    const bus = createEventBus();
    let count = 0;
    const off = bus.on('kilometre', () => count++);
    bus.emit('kilometre', { km: 1 });
    off();
    bus.emit('kilometre', { km: 2 });
    expect(count).toBe(1);
  });

  it('ignores emits with no listeners', () => {
    const bus = createEventBus();
    expect(() => bus.emit('overtake', { totalOvertakes: 1 })).not.toThrow();
  });

  it('keeps event types independent', () => {
    const bus = createEventBus();
    let km = 0;
    let overtakes = 0;
    bus.on('kilometre', () => km++);
    bus.on('overtake', () => overtakes++);
    bus.emit('kilometre', { km: 1 });
    expect(km).toBe(1);
    expect(overtakes).toBe(0);
  });

  it('survives a listener removing itself during dispatch', () => {
    const bus = createEventBus();
    const seen: string[] = [];
    const off = bus.on('kilometre', () => {
      seen.push('first');
      off();
    });
    bus.on('kilometre', () => seen.push('second'));
    bus.emit('kilometre', { km: 1 });
    bus.emit('kilometre', { km: 2 });
    expect(seen).toEqual(['first', 'second', 'second']);
  });
});
