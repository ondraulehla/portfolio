/**
 * Hand-editable layout of the playground island.
 *
 * x/z are ground coordinates (the island is roughly a circle of radius
 * `islandRadius` around 0,0), y is up. Edit values, run `npm run dev`
 * and open /en/playground to see the result live.
 */
export const WORLD = {
  /** Radius where land starts falling away into the sea. */
  islandRadius: 95,
  /** Width of the coast/underwater falloff belt beyond islandRadius. */
  coastWidth: 45,
  /** Sea surface height. */
  waterLevel: -0.9,

  /**
   * The river's centre line: x = a1·sin(z·f1) + a2·sin(z·f2) + offset.
   * Larger a = wider meanders, larger f = tighter bends.
   * `width` is the total width of the carved valley.
   */
  river: { a1: 34, f1: 0.018, a2: 6, f2: 0.05, offset: -8, width: 10 },

  /** The town: a levelled plateau with houses and a church. */
  city: { x: 45, z: 35, radius: 22 },

  /**
   * Mountains as smooth gaussian bumps: peak position, height (h)
   * and footprint radius (r). Add/remove entries freely.
   */
  mountains: [
    { x: -58, z: -42, h: 26, r: 17 },
    { x: -72, z: -18, h: 20, r: 14 },
    { x: -42, z: -64, h: 22, r: 15 },
    { x: -30, z: -38, h: 12, r: 12 },
  ],

  /**
   * Where the floating project billboards hover (in project order).
   * More projects than spots wrap around to the first spot.
   */
  signSpots: [
    { x: -15, z: -68 },
    { x: 72, z: -8 },
    { x: -8, z: 76 },
  ],

  /** Forests: lower densityThreshold (0..1) → more/larger woods. */
  forest: { densityThreshold: 0.5, maxTrees: 320, minHeight: 0.9, maxHeight: 8.5 },

  /** Rock clusters scattered on each mountain's flank. */
  rocks: { clustersPerMountain: 3 },

  clouds: { count: 11 },
} as const;
