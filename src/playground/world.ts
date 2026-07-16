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
   * Where the floating project billboards hover (in project order). Give each
   * project its own spot – if there are more projects than spots they wrap and
   * overlap (which z-fights). Spread around the island, clear of the town,
   * mountains and river so each sign stands alone.
   */
  signSpots: [
    { x: -18, z: -70, h: 15 },
    { x: 68, z: -14, h: 11 },
    { x: -10, z: 78, h: 19 },
    { x: 40, z: -60, h: 23 },
    { x: -66, z: 46, h: 12 },
    { x: 74, z: 40, h: 17 },
    { x: 18, z: 8, h: 21 },
    { x: 44, z: 68, h: 14 },
  ],

  /** Forests: lower densityThreshold (0..1) → more/larger woods. */
  forest: { densityThreshold: 0.5, maxTrees: 320, minHeight: 0.9, maxHeight: 8.5 },

  /** Rock clusters scattered on each mountain's flank. */
  rocks: { clustersPerMountain: 3 },

  clouds: { count: 11 },

  /**
   * Dirt roads as polylines of waypoints; they are painted into the terrain
   * colours (width in world units) and keep trees/sheep off the tarmac.
   * Road 1 runs town → river bridge → western meadows, road 2 town → pier.
   */
  roads: {
    width: 2.4,
    paths: [
      [
        { x: 40, z: 24 },
        { x: 24, z: 18 },
        { x: 10, z: 14 },
        { x: -4, z: 12 },
        { x: -20, z: 4 },
        { x: -36, z: -8 },
      ],
      // bridge road fork → south to the farmstead
      [
        { x: -20, z: 4 },
        { x: -24, z: 18 },
        { x: -27, z: 32 },
        { x: -29, z: 42 },
      ],
      [
        { x: 46, z: 46 },
        { x: 52, z: 64 },
        { x: 58, z: 80 },
        { x: 62, z: 91 },
      ],
    ],
  },

  /** Wooden bridge where road 1 crosses the river. */
  bridge: { z: 13 },

  /** Wooden pier running from the south-east beach into the sea. */
  pier: { x: 62, z: 92.5, angle: 0.58, length: 15 },

  /** Patchwork of tilled fields between the town and the river + a windmill. */
  fields: [
    { x: 34, z: 52, w: 11, l: 8, rot: 0.35, tint: 0xd9b95c },
    { x: 42, z: 59, w: 9, l: 10, rot: 0.35, tint: 0xc9a84c },
    { x: 33, z: 63, w: 8, l: 7, rot: 0.35, tint: 0x9ec25e },
    { x: 41, z: 47, w: 8, l: 6, rot: 0.35, tint: 0xb5d068 },
  ],
  windmill: { x: 46, z: 68 },

  /** Farmstead on the west meadow across the river from the town. */
  farm: { x: -32, z: 48 },

  fauna: { birds: 7, sheep: 14 },
} as const;
