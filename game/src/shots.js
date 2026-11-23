// Staged scenes for the four screenshots (?shot=start|play|mission|police).
// A scene takes a fresh live state and re-arranges it into a good picture:
// frozen time keeps the palms, lights and HUD animation repeatable, and the
// same entities, renderer and rules as live play do the drawing.
// The seed is fixed (seed=1) in the shot URLs, so the four pictures are
// the same city the player gets, not a special layout.
export function stageShot(name, state) {
  state.world.time = 92;
  state.elapsed = 92;
  state.screen = name === 'start' ? 'title' : 'play';
  state.player.x = 1760;
  state.player.y = 1032;
  state.camera = { x: 1760, y: 1050, zoom: 0.94 };
  state.money = 1250;
  state.objective = 'MARA VELEZ / Deliver the sealed ledger to Sunmarket';
  state.marker = { x: 1960, y: 1032, label: 'SUNMARKET · DELIVERY' };
  state.mission = 0;
  state.stage = 1;
  state.dialogue = 'Mara Velez: That ledger buys our waterfront back. Keep it dry.';
  state.toast = 'LOW TIDE / A city that owes you nothing.';
  const car = state.world.cars[0];
  Object.assign(car, { x: 1740, y: 1125, angle: -0.17, speed: 155, controlled: true, stolen: true, color: '#edb957', health: 86 });

  if (name === 'start') {
    state.player.x = 1990;
    state.player.y = 1030;
    state.camera = { x: 1920, y: 1100, zoom: 0.84 };
    state.dialogue = '';
  } else if (name === 'mission') {
    state.car = null;
    state.player.x = 1910;
    state.player.y = 1032;
    state.camera = { x: 1900, y: 1100, zoom: 1.12 };
    state.objective = 'MARA VELEZ / The handoff · Approach the amber marker';
    state.dialogue = 'Mara Velez: You made it. The harbor has a long memory.';
    state.money = 1750;
  } else {
    state.car = car;
    state.player.x = car.x;
    state.player.y = car.y;
    state.dialogue = '';
    state.objective = name === 'police'
      ? 'IVO SANTOS / Lose the patrols. Keep the ledger safe.'
      : 'NIKO REYES / Bring the Sunrunner to Pier 9';
    state.marker = { x: 2080, y: 1672, label: 'PIER 9 / 620 M' };
    if (name === 'police') {
      state.wanted = 3;
      state.escape = 4;
      for (let i = 0; i < 4; i++) {
        state.world.cars.push({
          id: `shot-patrol-${i}`, kind: 'police', x: 1570 - i * 54, y: 1120 + (i % 2) * 35,
          angle: 0.08, speed: 180, health: 100, color: '#ecf3e8',
          controlled: false, parked: false,
        });
      }
      state.world.peds.push({
        id: 'shot-cop', cop: true, x: 1690, y: 1060, angle: 0,
        health: 100, panic: 0, color: '#173b60',
      });
      state.toast = 'DISPATCH / Suspect heading east on Pelican Avenue';
    }
  }
  return state;
}
