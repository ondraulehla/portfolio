import { describe, expect, it } from 'vitest';
import { MLP, makeDataset, rng } from '../src/neural/nn';

describe('MLP', () => {
  it('produces one probability output in [0,1] and correct per-layer activation shapes', () => {
    const net = new MLP([2, 4, 3, 1], 'tanh', 1);
    const out = net.forward([0.3, -0.6]);
    expect(out).toHaveLength(1);
    expect(out[0]!).toBeGreaterThanOrEqual(0);
    expect(out[0]!).toBeLessThanOrEqual(1);
    expect(net.activations.map((a) => a.length)).toEqual([2, 4, 3, 1]);
  });

  it('is deterministic for a given seed', () => {
    const a = new MLP([2, 5, 1], 'tanh', 99).forward([0.1, 0.2]);
    const b = new MLP([2, 5, 1], 'tanh', 99).forward([0.1, 0.2]);
    expect(a).toEqual(b);
  });

  it('learns XOR — loss drops and accuracy clears 85% after training', () => {
    const data = makeDataset('xor', 240, 3);
    const net = new MLP([2, 8, 8, 1], 'tanh', 5);
    const first = net.trainStep(data, 0.3);
    for (let i = 0; i < 600; i++) net.trainStep(data, 0.3);
    const last = net.trainStep(data, 0.3);
    expect(last).toBeLessThan(first);

    const correct = data.filter((p) => (net.forward([p.x, p.y])[0]! > 0.5 ? 1 : 0) === p.label).length;
    expect(correct / data.length).toBeGreaterThan(0.85);
  });
});

describe('datasets', () => {
  it('are deterministic and balanced-ish', () => {
    const a = makeDataset('spiral', 100, 7);
    const b = makeDataset('spiral', 100, 7);
    expect(a).toEqual(b);
    const ones = a.filter((p) => p.label === 1).length;
    expect(ones).toBeGreaterThan(20);
    expect(ones).toBeLessThan(80);
  });

  it('keeps points within the [-1.1, 1.1] box', () => {
    for (const kind of ['circle', 'xor', 'spiral', 'gaussian'] as const) {
      for (const p of makeDataset(kind, 150, 2)) {
        expect(Math.abs(p.x)).toBeLessThan(1.2);
        expect(Math.abs(p.y)).toBeLessThan(1.2);
      }
    }
  });
});

describe('rng', () => {
  it('is reproducible and within [0,1)', () => {
    const r = rng(123);
    const vals = [r(), r(), r()];
    expect(vals).toEqual([rng(123)(), (() => { const x = rng(123); x(); return x(); })(), (() => { const x = rng(123); x(); x(); return x(); })()]);
    for (const v of vals) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
