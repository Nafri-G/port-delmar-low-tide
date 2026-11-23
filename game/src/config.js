// Tuning for Port Delmar. Distances are in metres inside the simulation;
// the renderer turns them into screen pixels. These numbers were tuned by
// playtesting: cars feel fast but controllable, on-foot movement is brisk,
// and the police are dangerous without being unbeatable.

// The playable city. Roads run on a 320 m grid; the beach and water sit
// along the east edge past x = 2240.
export const CITY = Object.freeze({
  width: 2560,
  height: 2240,
  block: 320,
  road: 88,
  coast: 2240,
});

// Car handling. maxSpeed is metres per second; acceleration and brake are
// metres per second squared; steer is radians per second at full speed.
export const CAR = Object.freeze({
  length: 42,
  width: 22,
  maxSpeed: 310,
  acceleration: 190,
  brake: 270,
  steer: 2.7,
  drag: 0.65,
  // The player's mission car is tougher than traffic (100): a chase lasts
  // 40-60 s and the car takes rams, wall scrapes and traffic hits while the
  // driver is breaking line of sight. At 100 HP it wrecked at ~60 s, before
  // the 16 s escape timer could bank. At 150 it survives the chase without
  // becoming invincible — a bad driver who keeps ramming walls still wrecks.
  maxHealth: 150,
});

// Pedestrians walk the sidewalks and flee when frightened.
export const PEDESTRIAN = Object.freeze({
  speed: 28,
  count: 100,
});

// The player on foot.
export const PLAYER = Object.freeze({
  walk: 110,
  run: 185,
  radius: 9,
  maxHealth: 100,
});

// One fixed step per simulation tick; the loop accumulates real time.
export const STEP = 1 / 60;

// Where progress lives in the browser.
export const SAVE_KEY = 'port-delmar-save-v1';

// The palette: deep teal night UI, warm sand paper, mint for the player,
// coral for danger, gold for money and objectives, teal water.
export const COLORS = Object.freeze({
  ink: '#112d3b',
  paper: '#fff0cc',
  mint: '#7ff1c5',
  coral: '#ff765f',
  gold: '#ffcd61',
  water: '#227e91',
});

// The places the story sends the player. The garage is home; the package,
// the drop, the courier office, the dock and the safe house are the
// mission stops, in the order the three jobs visit them.
export const MISSION_POINTS = Object.freeze({
  garage: { x: 480, y: 392 },
  package: { x: 1120, y: 712 },
  drop: { x: 1760, y: 1032 },
  courier: { x: 1440, y: 1072 },
  dock: { x: 2080, y: 1672 },
  safe: { x: 800, y: 1672 },
});
