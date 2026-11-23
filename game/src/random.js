// A Weyl sequence with an integer avalanche gives repeatable, independent
// city seeds. This is the original generator the city was tuned and
// playtested against: swapping it (e.g. for mulberry32) rebuilds a
// different city for the same seed, and the new layout wedges the escape
// route the game was validated on. Keep this algorithm.
export function createRandom(seed = 1) {
  let state = Number(seed) >>> 0;
  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
    value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
    return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
  };
}
