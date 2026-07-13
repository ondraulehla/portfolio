/**
 * A small, dependency-free MLP for binary classification – the compute core
 * revived from my master's thesis "Modeling Neural Networks in Virtual Reality"
 * (CTU FIT, 2025). Forward pass exposes per-layer activations so the 3D view
 * can light up neurons; backprop trains the 2D decision surface live.
 */

export type Activation = 'tanh' | 'sigmoid' | 'relu';
export type DatasetKind = 'circle' | 'xor' | 'spiral' | 'gaussian';

export interface Point {
  x: number;
  y: number;
  /** class label, 0 or 1 */
  label: number;
}

const act = {
  tanh: (x: number) => Math.tanh(x),
  sigmoid: (x: number) => 1 / (1 + Math.exp(-x)),
  relu: (x: number) => Math.max(0, x),
} as const;

const actDeriv = {
  // derivatives expressed in terms of the activation output `y`
  tanh: (y: number) => 1 - y * y,
  sigmoid: (y: number) => y * (1 - y),
  relu: (y: number) => (y > 0 ? 1 : 0),
} as const;

/** Mulberry32 – tiny seeded PRNG so a given seed reproduces a network. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class MLP {
  /** neuron counts per layer, e.g. [2, 5, 4, 1] */
  readonly sizes: number[];
  readonly activation: Activation;
  /** weights[l][j][k] = weight into neuron j of layer l+1 from neuron k of layer l */
  weights: number[][][] = [];
  biases: number[][] = [];
  /** activations from the most recent forward(), per layer */
  activations: number[][] = [];

  constructor(sizes: number[], activation: Activation = 'tanh', seed = 42) {
    this.sizes = sizes;
    this.activation = activation;
    const rand = rng(seed);
    for (let l = 1; l < sizes.length; l++) {
      const fanIn = sizes[l - 1]!;
      const fanOut = sizes[l]!;
      // Xavier-ish init
      const scale = Math.sqrt(6 / (fanIn + fanOut));
      this.weights.push(
        Array.from({ length: fanOut }, () =>
          Array.from({ length: fanIn }, () => (rand() * 2 - 1) * scale),
        ),
      );
      this.biases.push(Array.from({ length: fanOut }, () => 0));
    }
    this.activations = sizes.map((n) => new Array(n).fill(0));
  }

  /** Forward pass; the output layer always uses sigmoid (probability). */
  forward(input: number[]): number[] {
    let current = input;
    this.activations[0] = current;
    for (let l = 0; l < this.weights.length; l++) {
      const isOutput = l === this.weights.length - 1;
      const fn = isOutput ? act.sigmoid : act[this.activation];
      const w = this.weights[l]!;
      const b = this.biases[l]!;
      const next = new Array(w.length);
      for (let j = 0; j < w.length; j++) {
        let sum = b[j]!;
        const wj = w[j]!;
        for (let k = 0; k < current.length; k++) sum += wj[k]! * current[k]!;
        next[j] = fn(sum);
      }
      current = next;
      this.activations[l + 1] = current;
    }
    return current;
  }

  /** One SGD step over a batch; returns mean binary cross-entropy loss. */
  trainStep(batch: Point[], lr = 0.1): number {
    const L = this.weights.length;
    // accumulate gradients
    const gW = this.weights.map((layer) => layer.map((row) => row.map(() => 0)));
    const gB = this.biases.map((row) => row.map(() => 0));
    let loss = 0;

    for (const p of batch) {
      const out = this.forward([p.x, p.y]);
      const acts = this.activations.map((a) => a.slice());
      const yhat = out[0]!;
      const y = p.label;
      loss += -(y * Math.log(yhat + 1e-9) + (1 - y) * Math.log(1 - yhat + 1e-9));

      // output delta for sigmoid + BCE simplifies to (yhat - y)
      let delta = [yhat - y];
      for (let l = L - 1; l >= 0; l--) {
        const prev = acts[l]!;
        const w = this.weights[l]!;
        for (let j = 0; j < w.length; j++) {
          const d = delta[j]!;
          gB[l]![j]! += d;
          for (let k = 0; k < prev.length; k++) gW[l]![j]![k]! += d * prev[k]!;
        }
        if (l > 0) {
          const prevAct = acts[l]!; // outputs of layer l (= input layer index l)
          const deriv = actDeriv[this.activation];
          const nextDelta = new Array(prev.length).fill(0);
          for (let k = 0; k < prev.length; k++) {
            let s = 0;
            for (let j = 0; j < w.length; j++) s += w[j]![k]! * delta[j]!;
            nextDelta[k] = s * deriv(prevAct[k]!);
          }
          delta = nextDelta;
        }
      }
    }

    const n = batch.length;
    for (let l = 0; l < L; l++) {
      for (let j = 0; j < this.weights[l]!.length; j++) {
        this.biases[l]![j]! -= (lr * gB[l]![j]!) / n;
        for (let k = 0; k < this.weights[l]![j]!.length; k++) {
          this.weights[l]![j]![k]! -= (lr * gW[l]![j]![k]!) / n;
        }
      }
    }
    return loss / n;
  }
}

/** Deterministic dataset generator in [-1, 1]². */
export function makeDataset(kind: DatasetKind, n = 200, seed = 7): Point[] {
  const rand = rng(seed);
  const pts: Point[] = [];
  const noise = () => (rand() * 2 - 1) * 0.08;
  for (let i = 0; i < n; i++) {
    if (kind === 'circle') {
      const r = rand() < 0.5 ? rand() * 0.4 : 0.65 + rand() * 0.3;
      const a = rand() * Math.PI * 2;
      pts.push({ x: r * Math.cos(a) + noise(), y: r * Math.sin(a) + noise(), label: r < 0.5 ? 1 : 0 });
    } else if (kind === 'xor') {
      const x = rand() * 1.8 - 0.9;
      const y = rand() * 1.8 - 0.9;
      pts.push({ x: x + noise(), y: y + noise(), label: x * y > 0 ? 1 : 0 });
    } else if (kind === 'gaussian') {
      const c = rand() < 0.5 ? 1 : 0;
      const cx = c ? 0.5 : -0.5;
      const cy = c ? 0.5 : -0.5;
      pts.push({ x: cx + (rand() * 2 - 1) * 0.35, y: cy + (rand() * 2 - 1) * 0.35, label: c });
    } else {
      // spiral
      const c = i % 2;
      const t = (i / n) * 3.5 + rand() * 0.2;
      const r = t / 5.2;
      const a = t * 2 + c * Math.PI;
      pts.push({ x: r * Math.cos(a) + noise(), y: r * Math.sin(a) + noise(), label: c });
    }
  }
  return pts;
}
