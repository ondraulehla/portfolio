/**
 * A small, dependency-free MLP – the compute core revived from my master's
 * thesis "Modeling Neural Networks in Virtual Reality" (CTU FIT, 2025).
 *
 * The input layer takes 1–6 engineered features of the 2D point (x, y) and
 * the output layer is either a single sigmoid unit (binary classification)
 * or a softmax over 2–3 classes. Forward pass exposes per-layer activations
 * so the visualizations can light neurons up; backprop trains the decision
 * surface live.
 */

export type Activation = 'tanh' | 'sigmoid' | 'relu';
export type DatasetKind = 'circle' | 'xor' | 'spiral' | 'gaussian';

export interface Point {
  x: number;
  y: number;
  /** class index, 0..classes-1 */
  label: number;
}

/** Feature basis for the input layer, in order. */
export const FEATURE_NAMES = ['x', 'y', 'x²', 'y²', 'x·y', 'sin πx'] as const;
export const MAX_FEATURES = FEATURE_NAMES.length;

/** First `count` engineered features of a 2D point. */
export function features(x: number, y: number, count: number): number[] {
  const all = [x, y, x * x, y * y, x * y, Math.sin(Math.PI * x)];
  return all.slice(0, count);
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
  /** number of classes the output represents (1 output unit → 2 classes) */
  readonly classes: number;
  /** weights[l][j][k] = weight into neuron j of layer l+1 from neuron k of layer l */
  weights: number[][][] = [];
  biases: number[][] = [];
  /** activations from the most recent forward(), per layer */
  activations: number[][] = [];

  constructor(sizes: number[], activation: Activation = 'tanh', seed = 42) {
    this.sizes = sizes;
    this.activation = activation;
    const out = sizes[sizes.length - 1]!;
    this.classes = out === 1 ? 2 : out;
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

  /** Forward pass; output layer is sigmoid (1 unit) or softmax (2+ units). */
  forward(input: number[]): number[] {
    let current = input;
    this.activations[0] = current;
    for (let l = 0; l < this.weights.length; l++) {
      const isOutput = l === this.weights.length - 1;
      const w = this.weights[l]!;
      const b = this.biases[l]!;
      const next = new Array<number>(w.length);
      for (let j = 0; j < w.length; j++) {
        let sum = b[j]!;
        const wj = w[j]!;
        for (let k = 0; k < current.length; k++) sum += wj[k]! * current[k]!;
        next[j] = sum;
      }
      if (isOutput) {
        if (w.length === 1) {
          next[0] = act.sigmoid(next[0]!);
        } else {
          // softmax, stabilised against overflow
          let max = -Infinity;
          for (const v of next) max = Math.max(max, v);
          let total = 0;
          for (let j = 0; j < next.length; j++) {
            next[j] = Math.exp(next[j]! - max);
            total += next[j]!;
          }
          for (let j = 0; j < next.length; j++) next[j] = next[j]! / total;
        }
      } else {
        const fn = act[this.activation];
        for (let j = 0; j < next.length; j++) next[j] = fn(next[j]!);
      }
      current = next;
      this.activations[l + 1] = current;
    }
    return current;
  }

  /** Class probabilities for a point, always length `classes`. */
  probs(input: number[]): number[] {
    const out = this.forward(input);
    return out.length === 1 ? [1 - out[0]!, out[0]!] : out;
  }

  /** Predicted class index for a point. */
  predict(input: number[]): number {
    const p = this.probs(input);
    let best = 0;
    for (let i = 1; i < p.length; i++) if (p[i]! > p[best]!) best = i;
    return best;
  }

  /**
   * One SGD step over a batch; returns mean cross-entropy loss. Labels are
   * class indices; for both sigmoid+BCE and softmax+CE the output delta is
   * (prediction − target), so the backward pass is shared.
   */
  trainStep(batch: Point[], lr = 0.1, featureCount = this.sizes[0]!): number {
    const L = this.weights.length;
    // accumulate gradients
    const gW = this.weights.map((layer) => layer.map((row) => row.map(() => 0)));
    const gB = this.biases.map((row) => row.map(() => 0));
    let loss = 0;

    for (const p of batch) {
      const out = this.forward(features(p.x, p.y, featureCount));
      const acts = this.activations.map((a) => a.slice());

      let delta: number[];
      if (out.length === 1) {
        const yhat = out[0]!;
        const y = p.label;
        loss += -(y * Math.log(yhat + 1e-9) + (1 - y) * Math.log(1 - yhat + 1e-9));
        delta = [yhat - y];
      } else {
        loss += -Math.log(out[p.label]! + 1e-9);
        delta = out.map((prob, i) => prob - (i === p.label ? 1 : 0));
      }

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

/** Deterministic dataset generator in [-1, 1]² with `classes` classes. */
export function makeDataset(kind: DatasetKind, n = 200, seed = 7, classes = 2): Point[] {
  const rand = rng(seed);
  const k = Math.max(2, Math.min(3, classes));
  const pts: Point[] = [];
  const noise = () => (rand() * 2 - 1) * 0.08;
  for (let i = 0; i < n; i++) {
    const c = i % k;
    if (kind === 'circle') {
      // k concentric bands
      const r0 = c / k;
      const r = r0 * 0.85 + rand() * (0.85 / k - 0.06) + 0.08;
      const a = rand() * Math.PI * 2;
      pts.push({ x: r * Math.cos(a) + noise(), y: r * Math.sin(a) + noise(), label: c });
    } else if (kind === 'xor') {
      // quadrants coloured by index mod k
      const x = rand() * 1.8 - 0.9;
      const y = rand() * 1.8 - 0.9;
      const quadrant = (x > 0 ? 0 : 1) + (y > 0 ? 0 : 2); // 0..3
      const order = [0, 1, 3, 2]; // walk quadrants counter-clockwise
      pts.push({ x: x + noise(), y: y + noise(), label: order[quadrant]! % k });
    } else if (kind === 'gaussian') {
      // k clusters around the origin
      const angle = (c / k) * Math.PI * 2 + Math.PI / 4;
      const cx = 0.55 * Math.cos(angle);
      const cy = 0.55 * Math.sin(angle);
      pts.push({ x: cx + (rand() * 2 - 1) * 0.3, y: cy + (rand() * 2 - 1) * 0.3, label: c });
    } else {
      // spiral with k arms
      const t = (i / n) * 3.5 + rand() * 0.2;
      const r = t / 5.2;
      const a = t * 2 + (c * 2 * Math.PI) / k;
      pts.push({ x: r * Math.cos(a) + noise(), y: r * Math.sin(a) + noise(), label: c });
    }
  }
  return pts;
}
