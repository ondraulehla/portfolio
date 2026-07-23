import { describe, expect, it } from 'vitest';
import { MLP, makeDataset, features, FEATURE_NAMES, rng } from '../src/neural/nn';

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

  it('softmax output sums to 1 and probs() covers both output modes', () => {
    const multi = new MLP([2, 5, 3], 'tanh', 4);
    const out = multi.forward([0.2, -0.3]);
    expect(out).toHaveLength(3);
    expect(out.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(multi.classes).toBe(3);

    const binary = new MLP([2, 5, 1], 'tanh', 4);
    const p = binary.probs([0.2, -0.3]);
    expect(p).toHaveLength(2);
    expect(p[0]! + p[1]!).toBeCloseTo(1, 6);
    expect(binary.classes).toBe(2);
  });

  it('learns a 3-class gaussian dataset with softmax', () => {
    const data = makeDataset('gaussian', 210, 3, 3);
    const net = new MLP([2, 8, 3], 'tanh', 5);
    const first = net.trainStep(data, 0.3);
    for (let i = 0; i < 400; i++) net.trainStep(data, 0.3);
    const last = net.trainStep(data, 0.3);
    expect(last).toBeLessThan(first);

    const correct = data.filter((p) => net.predict([p.x, p.y]) === p.label).length;
    expect(correct / data.length).toBeGreaterThan(0.85);
  });
});

describe('features', () => {
  it('returns the first n engineered features of (x, y)', () => {
    expect(features(0.5, -0.25, 2)).toEqual([0.5, -0.25]);
    const all = features(0.5, -0.25, FEATURE_NAMES.length);
    expect(all).toHaveLength(FEATURE_NAMES.length);
    expect(all[2]).toBeCloseTo(0.25); // x²
    expect(all[3]).toBeCloseTo(0.0625); // y²
    expect(all[4]).toBeCloseTo(-0.125); // x·y
    expect(all[5]).toBeCloseTo(1); // sin(πx) at x = 0.5
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

  it('generates the requested number of classes', () => {
    for (const kind of ['circle', 'xor', 'spiral', 'gaussian'] as const) {
      for (const k of [2, 3, 4]) {
        const labels = new Set(makeDataset(kind, 120, 5, k).map((p) => p.label));
        expect([...labels].sort()).toEqual(Array.from({ length: k }, (_, i) => i));
      }
    }
  });

  it('overlapping gaussians are learnable but never a foregone conclusion', () => {
    // the lab's easy multi-class dataset: solvable, yet accuracy should not
    // start at 100% – that is what makes watching it converge worthwhile
    const data = makeDataset('gaussian', 210, 3, 3);
    const net = new MLP([2, 8, 3], 'tanh', 5);
    net.trainStep(data, 0.3);
    const early = data.filter((p) => net.predict([p.x, p.y]) === p.label).length / data.length;
    expect(early).toBeLessThan(0.995);
  });

  it('the "Three rings" challenge converges with quadratic features', () => {
    // mirrors the lab preset: circle ×3 classes, features x, y, x², y²
    const data = makeDataset('circle', 220, 7, 3);
    const net = new MLP([4, 6, 3], 'tanh', 42);
    for (let i = 0; i < 600; i++) net.trainStep(data, 0.15, 4);
    const correct = data.filter((p) => net.predict(features(p.x, p.y, 4)) === p.label).length;
    expect(correct / data.length).toBeGreaterThan(0.9);
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
