/**
 * The site's motion budget.
 *
 * Three ambient effects (the hero line field, the section backdrop and the
 * liquid headings) each run their own rAF loop, and all three are driven by
 * the cursor. On a touch device there is no cursor: they cost every frame and
 * give nothing back, which is what made phones stutter. `liteMotion()` is the
 * single switch those effects check – true for reduced-motion users and for
 * coarse pointers alike – and each one renders a single static frame instead
 * of animating.
 *
 * Deliberately a pointer/hover query rather than a width breakpoint: a narrow
 * desktop window still has a cursor worth reacting to, and a large tablet
 * still has none.
 */
export function prefersReducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function liteMotion(): boolean {
  return prefersReducedMotion() || matchMedia('(hover: none), (pointer: coarse)').matches;
}
