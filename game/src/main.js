// Port Delmar: Low Tide — the game loop, screens, player and car control,
// the three story missions, the wanted level and police pursuit, shooting,
// pickups, and save/load.
//
// ?seed=N fixes the city. ?shot=start|play|mission|police (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { CITY, CAR, PLAYER, SAVE_KEY, STEP, MISSION_POINTS } from './config.js';
import { createWorld, solid, moveEntity, nearestCar, lineOfSight, roadPoint, updateWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

// The longest frame the loop catches up on; a longer stall (a hidden tab)
// is dropped rather than replayed.
const MAX_FRAME = 0.25;
const FIRE_COOLDOWN = 0.22;
const CRIME_COOLDOWN = 2;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const renderer = createRenderer(canvas);
const input = createInput(canvas);
if ('ontouchstart' in window) document.getElementById('touch').classList.add('active');

// Three story jobs. A stage is a place to reach, a car to take, or a heat
// level to lose; finishing all three pays $2,250 in total.
const MISSIONS = [
  {
    giver: 'Mara Velez', reward: 500,
    intro: 'Mara Velez: That ledger buys our waterfront back. Pick it up and keep it dry.',
    stages: [
      { kind: 'goto', point: MISSION_POINTS.garage, label: 'MARA VELEZ / GARAGE', objective: 'MARA VELEZ / Meet Mara at the garage', radius: 55 },
      { kind: 'goto', point: MISSION_POINTS.package, label: 'SEALED LEDGER / PICKUP', objective: 'MARA VELEZ / Pick up the sealed ledger', radius: 45 },
      { kind: 'goto', point: MISSION_POINTS.drop, label: 'SUNMARKET / DELIVERY', objective: 'MARA VELEZ / Deliver the ledger to Sunmarket', radius: 55 },
    ],
  },
  {
    giver: 'Niko Reyes', reward: 750,
    intro: 'Niko Reyes: The Sunrunner is parked by the courier office. Bring it to Pier 9, no scratches.',
    stages: [
      { kind: 'goto', point: MISSION_POINTS.courier, label: 'COURIER OFFICE / SUNRUNNER', objective: 'NIKO REYES / Find the Sunrunner at the courier office', radius: 55 },
      { kind: 'enterCar', carId: 'courier', point: MISSION_POINTS.courier, label: 'SUNRUNNER / TAKE THE CAR', objective: 'NIKO REYES / Take the Sunrunner', radius: 70 },
      { kind: 'deliverCar', carId: 'courier', point: MISSION_POINTS.dock, label: 'PIER 9 / DELIVERY', objective: 'NIKO REYES / Deliver the Sunrunner to Pier 9', radius: 60 },
    ],
  },
  {
    giver: 'Ivo Santos', reward: 1000,
    intro: 'Ivo Santos: The harbor deal is done, but dispatch heard it. Grab the cut at the dock, then vanish.',
    stages: [
      { kind: 'goto', point: MISSION_POINTS.dock, label: 'PIER 9 / THE CUT', objective: 'IVO SANTOS / Meet Ivo at Pier 9', radius: 55 },
      { kind: 'escape', point: MISSION_POINTS.safe, label: 'SAFE HOUSE / LAY LOW', objective: 'IVO SANTOS / Lose the police, then reach the safe house', radius: 60 },
    ],
  },
];

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.completed)) return null;
    return data;
  } catch {
    return null;
  }
}

function newState() {
  const world = createWorld(seed);
  return {
    world, seed,
    player: { x: MISSION_POINTS.garage.x, y: MISSION_POINTS.garage.y, angle: 0, health: PLAYER.maxHealth, ammo: 24 },
    car: null,
    camera: { x: MISSION_POINTS.garage.x, y: MISSION_POINTS.garage.y, zoom: 1 },
    money: 250,
    wanted: 0, escape: 0, inSight: false, bust: 0,
    bullets: [], particles: [],
    elapsed: 0, screen: 'title',
    mission: -1, stage: 0,
    objective: 'PORT DELMAR / Press Enter to start the story',
    marker: { x: MISSION_POINTS.garage.x, y: MISSION_POINTS.garage.y, label: 'MARA VELEZ / GARAGE' },
    dialogue: '', dialogueT: 0, toast: '', toastT: 0,
    completed: [], completionText: '',
    muted: false, hasSave: readSave() !== null,
    fireT: 0, crimeT: 0, copCount: 0, repairedAt: false,
  };
}

let state = newState();

// Read-only hook for automated play-testing (screen, money, wanted, player, car).
window.__delmar = { get state() { return state; } };

function announce(message) {
  status.textContent = message;
}

function say(text, seconds = 4) {
  state.dialogue = text;
  state.dialogueT = seconds;
}

function notify(text, seconds = 3) {
  state.toast = text;
  state.toastT = seconds;
}

function burst(x, y, color, count = 10, speed = 120) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    state.particles.push({
      x, y,
      vx: Math.cos(a) * speed * (0.4 + Math.random() * 0.6),
      vy: Math.sin(a) * speed * (0.4 + Math.random() * 0.6),
      life: 0.5 + Math.random() * 0.4, color,
    });
  }
}

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.money, completed: state.completed, mission: state.completed.length, savedAt: Date.now(),
    }));
    state.hasSave = true;
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function loadSave() {
  const data = readSave();
  if (!data) return false;
  state.money = data.money || 0;
  state.completed = data.completed.slice(0, 3);
  return true;
}

function focusPos() {
  return state.car || state.player;
}

function applyStage() {
  const mission = MISSIONS[state.mission];
  if (!mission) {
    state.objective = 'FREE ROAM / Port Delmar is yours — explore, earn, survive';
    state.marker = null;
    return;
  }
  const stage = mission.stages[state.stage];
  if (!stage) return;
  state.objective = stage.objective;
  state.marker = { x: stage.point.x, y: stage.point.y, label: stage.label };
}

function startMission(index) {
  state.mission = index;
  state.stage = 0;
  if (index === 1) restoreCourier();
  const mission = MISSIONS[index];
  applyStage();
  say(mission.intro, 5);
  announce(`Mission: ${mission.giver}. ${state.objective}`);
}

// The Sunrunner must always be drivable when Niko's job starts or after a
// busted/wasted retry: a wrecked courier soft-locks the mission (there is
// no other courier, and cars never respawn). It comes back pristine and
// parked, still marked stolen so taking it adds no wanted level.
function restoreCourier() {
  const courier = state.world.cars.find((c) => c.id === 'courier');
  if (!courier) return;
  courier.health = 100;
  courier.x = MISSION_POINTS.courier.x;
  courier.y = MISSION_POINTS.courier.y;
  courier.angle = Math.PI / 2;
  courier.speed = 0;
  courier.parked = true;
  courier.controlled = false;
  courier.stolen = true;
}

function completeMission() {
  const mission = MISSIONS[state.mission];
  state.money += mission.reward;
  state.completed.push(state.mission);
  state.completionText = `${mission.giver} paid you $${mission.reward}. The waterfront remembers a favor.`;
  audio.play('mission');
  saveGame();
  state.screen = 'complete';
  announce(`Mission complete. ${mission.giver} paid $${mission.reward}. Total $${state.money}.`);
}

function updateMission() {
  const mission = MISSIONS[state.mission];
  if (!mission) return;
  const stage = mission.stages[state.stage];
  if (!stage) return;
  const pos = focusPos();
  if (stage.kind === 'goto') {
    if (Math.hypot(pos.x - stage.point.x, pos.y - stage.point.y) < stage.radius) {
      if (state.stage + 1 < mission.stages.length) {
        state.stage += 1;
        applyStage();
        notify('OBJECTIVE UPDATED / Follow the gold marker');
        if (mission.stages[state.stage].kind === 'escape') {
          // Scripted heat, set directly: addWanted() returns early during
          // the 2 s crime cooldown, which would silently skip the forced
          // 3-star escape if the player just committed a crime.
          state.wanted = 3;
          state.escape = 0;
          notify('WANTED LEVEL 3 / The police are coming');
          say('Ivo Santos: Dispatch heard the deal. Lose them, then get to the safe house.', 5);
        }
      } else {
        completeMission();
      }
    }
  } else if (stage.kind === 'enterCar') {
    if (state.car && state.car.id === stage.carId) {
      state.stage += 1;
      applyStage();
      notify('SUNRUNNER SECURED / Drive it to Pier 9');
    }
  } else if (stage.kind === 'deliverCar') {
    if (state.car && state.car.id === stage.carId && Math.hypot(pos.x - stage.point.x, pos.y - stage.point.y) < stage.radius) {
      completeMission();
    }
  } else if (stage.kind === 'escape') {
    if (Math.hypot(pos.x - stage.point.x, pos.y - stage.point.y) < stage.radius) {
      if (state.wanted <= 1) completeMission();
      else notify('TOO HOT / Lose the police before the safe house');
    }
  }
}

function clearPolice() {
  state.world.cars = state.world.cars.filter((c) => !c.spawnedPolice);
  state.world.peds = state.world.peds.filter((p) => !p.cop);
  state.copCount = 0;
  state.bust = 0;
  state.inSight = false;
}

function spawnPoliceCar() {
  const pos = focusPos();
  const dir = state.world.rng() < 0.5 ? 1 : -1;
  const spot = roadPoint(state.world, pos.x + dir * 520, pos.y + (state.world.rng() - 0.5) * 300);
  const car = {
    id: `police-${Date.now() % 100000}-${state.world.cars.length}`,
    x: spot.x, y: spot.y, angle: Math.atan2(pos.y - spot.y, pos.x - spot.x),
    speed: 0, health: 100, color: '#ecf3e8', kind: 'police',
    parked: false, stolen: false, controlled: false, turnCooldown: 0, spawnedPolice: true,
  };
  state.world.cars.push(car);
  return car;
}

function spawnCop() {
  const pos = focusPos();
  const a = Math.random() * Math.PI * 2;
  const cop = {
    id: `cop-${Date.now() % 100000}-${state.copCount}`,
    x: pos.x + Math.cos(a) * 260, y: pos.y + Math.sin(a) * 260,
    homeX: pos.x, homeY: pos.y, angle: 0, health: 100, panic: 0,
    color: '#24476b', axis: 'h', direction: 1, respawn: 0, cop: true,
  };
  state.world.peds.push(cop);
  state.copCount += 1;
}

function addWanted(n) {
  if (state.crimeT > 0) return;
  state.wanted = Math.min(5, state.wanted + n);
  // No escape reset here: committing a crime raises the heat, but it does
  // not erase the unseen time already banked. The old reset wiped the whole
  // bank (and the star it was building toward) every time the escape
  // autopilot clipped a pedestrian, so one accident undid 5+ s of evasion
  // and re-escalated the chase at once. The crime still costs a star's
  // worth of new banking (8 s), which is the real penalty.
  state.crimeT = CRIME_COOLDOWN;
  if (state.wanted > 0) notify(`WANTED LEVEL ${state.wanted} / The police are coming`);
}

function updatePolice(dt) {
  const pos = focusPos();
  // One police car per wanted star, up to four: at 3 stars the escape used
  // to face four cars (wanted+1), and four simultaneous rams — even at 1/s
  // each — plus wall and traffic hits killed the car in ~11 s of driving,
  // before the 8 s-per-star escape timer could bank. Three cars at 3 stars
  // still surround and ram the player; 4-5 stars still field the full four.
  const wantCars = state.wanted >= 1 ? Math.min(state.wanted, 4) : 0;
  const policeCars = state.world.cars.filter((c) => c.kind === 'police' && c.health > 0);
  if (state.wanted === 0) {
    if (policeCars.length || state.world.peds.some((p) => p.cop)) clearPolice();
    return;
  }
  while (policeCars.length < wantCars) policeCars.push(spawnPoliceCar());
  const wantCops = state.wanted >= 2 ? Math.min(state.wanted - 1, 3) : 0;
  const cops = state.world.peds.filter((p) => p.cop && p.health > 0);
  while (cops.length < wantCops) { spawnCop(); cops.push(state.world.peds[state.world.peds.length - 1]); }

  let seen = false;
  for (const car of policeCars) {
    if (car.controlled) continue;
    const dx = pos.x - car.x, dy = pos.y - car.y;
    const dist = Math.hypot(dx, dy);
    const target = Math.atan2(dy, dx);
    let diff = target - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    // Police top speed was 250 + 18/wanted (304 at 3 stars) against the
    // player's 310, a 6 m/s margin: the cops never fell behind, so they
    // re-acquired line of sight before the 8 s escape timer could ever
    // complete and rammed the car to death mid-escape. 230 + 15/wanted
    // (275) and then 200 + 12/wanted (236) still matched the player
    // closely enough that, on the escape loop's short straights, the player
    // opened ~130 m per straight while the cops closed it at every turn —
    // the timer banked ~1-5 s in 30-40 s. 180 + 10/wanted gives a real
    // margin at every level (210 at 3 stars, 230 at 5) while 5 stars stays
    // the fastest heat, as max heat should be — the player outruns the
    // cops on the straights, but a driver who stops, wrecks, or drives
    // into a pack still gets caught.
    const top = 180 + state.wanted * 10;
    car.speed += ((dist > 70 ? top : top * 0.55) - car.speed) * Math.min(1, dt * 1.6);
    const hit = moveEntity(state.world, car, Math.cos(car.angle) * car.speed * dt, Math.sin(car.angle) * car.speed * dt, 15);
    if (hit) { car.speed *= 0.4; car.angle += 0.3; }
    // Sight range is 300 m, not 420: at 420 the cops kept line of sight
    // for the whole chase (they match the player's speed at high wanted),
    // so the escape timer banked ~5 s in 30 s and the mission was
    // unwinnable. At 300 the player banks time by opening a real gap on a
    // straight or breaking line of sight around a block, while a driver who
    // stops or dawdles is still spotted at once — the cops close 300 m in
    // about a second.
    if (dist < 300 && lineOfSight(state.world, car, pos)) seen = true;
    if (dist < 46) {
      if (state.car) {
        // 9/s per cop destroyed the car in ~10 s of contact, so a
        // 3-star escape that must last 30-60 s was a DPS race the car
        // usually lost. 5/s still lost it in ~11 s once two or more cops
        // piled on (100 -> 76 -> 16 HP), and even 2/s still killed it in
        // ~11 s of driving: four cops in continuous contact deal 8/s, so
        // the car dies in 12 s while the escape needs 30-60 s. 1/s per cop
        // punishes being rammed (a lone cop still kills a 100 HP car in
        // 100 s of contact) but lets a chase be survived by outrunning
        // the cops on the straights — the wreck, not the chase, was the
        // unfair part.
        state.car.health -= 1 * dt;
        // The ram slowdown is the other half of the ram, and cutting the
        // damage alone left it gluing the cops to the car: at 0.8/s per
        // cop in contact, two cops dragged the player's equilibrium speed
        // to ~119 m/s — below the cops' close-range 151 — so once two cops
        // touched the car they never let go, the car never opened a gap,
        // and the escape timer never banked a second. 0.35/s per cop lets
        // the player pull away from one or two cops (equilibrium ~271)
        // while four cops piled on still pin the car (~136), so a driver
        // who stops or drives into a pack still gets wrecked.
        state.car.speed *= (1 - 0.35 * dt);
        if (Math.random() < dt * 2) { audio.play('crash'); burst(car.x, car.y, '#ffcd61', 4, 80); }
      } else {
        state.bust += 45 * dt;
      }
    }
  }
  for (const cop of cops) {
    const dx = pos.x - cop.x, dy = pos.y - cop.y;
    const dist = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    moveEntity(state.world, cop, (dx / (dist || 1)) * 95 * dt, (dy / (dist || 1)) * 95 * dt, 7);
    if (dist < 300 && lineOfSight(state.world, cop, pos)) seen = true;
    if (dist < 30 && !state.car) state.bust += 60 * dt;
  }
  state.inSight = seen;
  if (!seen && policeCars.length + cops.length > 0) {
    state.bust = Math.max(0, state.bust - 30 * dt);
    state.escape += dt;
    // 8 s of staying unseen loses a star. Playtested at 14 s: the escape
    // timer never accumulated once in four driving attempts — police cars
    // (304) nearly match the player car (310) and on-foot cops stay glued,
    // so `seen` is true almost the whole chase. 8 s keeps the escape a real
    // challenge (two stars still need 16 s of evasion) while letting a good
    // driver bank a star by breaking line-of-sight around a block.
    if (state.escape > 8) {
      state.wanted -= 1;
      state.escape = 0;
      notify(state.wanted > 0 ? `YOU LOST A STAR / Wanted level ${state.wanted}` : 'HEAT GONE / You slipped away');
      if (state.wanted === 0) clearPolice();
    }
  }
  // No else-branch: when the player IS seen, the timer PAUSES (holds its
  // value) instead of resetting to 0. Resetting threw away every brief
  // line-of-sight break — a driver who broke away around a block, then got
  // re-spotted, lost all banked time, so the 8 s threshold was unreachable
  // whenever four cops kept at least one pair of eyes on the car. Pausing
  // keeps the 8 s per star and the wanted<=1 requirement, and a player who
  // just sits still still gets busted: seen stays true, the timer never
  // grows, and the bust meter fills.
  if (state.bust >= 100) {
    state.bust = 0;
    state.wanted = 0;
    if (state.car) { state.car.controlled = false; state.car.speed = 0; state.car = null; }
    clearPolice();
    saveGame();
    state.screen = 'busted';
    announce('Busted. The police took the car. Your jobs and cash are kept.');
  }
}

function fireBullet() {
  if (state.fireT > 0 || state.player.ammo <= 0 || state.car) return;
  const mouse = renderer.screenToWorld(input.pointer.x, input.pointer.y, state);
  const angle = Math.atan2(mouse.y - state.player.y, mouse.x - state.player.x);
  state.player.angle = angle;
  state.bullets.push({ x: state.player.x + Math.cos(angle) * 14, y: state.player.y + Math.sin(angle) * 14, angle, speed: 640, life: 0.7, damage: 34 });
  state.player.ammo -= 1;
  state.fireT = FIRE_COOLDOWN;
  audio.play('shot');
  burst(state.player.x + Math.cos(angle) * 16, state.player.y + Math.sin(angle) * 16, '#ffe7a1', 3, 60);
}

function updateBullets(dt) {
  for (const b of state.bullets) {
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    if (b.life <= 0 || solid(state.world, b.x, b.y, 2)) { b.life = 0; continue; }
    for (const p of state.world.peds) {
      if (p.health > 0 && Math.hypot(p.x - b.x, p.y - b.y) < 11) {
        p.health -= b.damage;
        p.panic = 1;
        b.life = 0;
        burst(b.x, b.y, '#ff765f', 6, 90);
        addWanted(1);
        break;
      }
    }
    if (b.life <= 0) continue;
    for (const c of state.world.cars) {
      if (c.health > 0 && !c.controlled && Math.hypot(c.x - b.x, c.y - b.y) < 20) {
        c.health -= b.damage;
        b.life = 0;
        burst(b.x, b.y, '#ffcd61', 6, 90);
        if (c.kind === 'police') addWanted(1);
        break;
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
}

function updatePlayer(dt) {
  const axes = input.axes();
  const running = input.down('ShiftLeft', 'ShiftRight') || input.touch.run;
  const speed = running ? PLAYER.run : PLAYER.walk;
  const dx = axes.x * speed * dt, dy = axes.y * speed * dt;
  if (dx || dy) {
    moveEntity(state.world, state.player, dx, dy, PLAYER.radius);
    if (!input.pointer.down) state.player.angle = Math.atan2(dy, dx);
  }
  if (input.pointer.down) {
    const mouse = renderer.screenToWorld(input.pointer.x, input.pointer.y, state);
    state.player.angle = Math.atan2(mouse.y - state.player.y, mouse.x - state.player.x);
  }
  // Sidewalk pickups: health patches the player, ammo refills the pistol.
  const pos = state.player;
  for (const p of state.world.pickups) {
    if (!p.active) continue;
    if (Math.hypot(p.x - pos.x, p.y - pos.y) < 24) {
      p.active = false;
      p.respawn = 25;
      if (p.type === 'health') {
        state.player.health = Math.min(PLAYER.maxHealth, state.player.health + 35);
        notify('HEALTH +35 / Patched up');
      } else {
        state.player.ammo += 12;
        notify('AMMO +12 / Loaded');
      }
      audio.play('pickup');
    }
  }
}

function updateCar(dt) {
  const car = state.car;
  const axes = input.axes();
  const throttle = -axes.y; // W accelerates, S brakes / reverses
  if (throttle > 0) car.speed += CAR.acceleration * throttle * dt;
  else if (throttle < 0) car.speed += (car.speed > 5 ? -CAR.brake : -CAR.acceleration * 0.55) * dt;
  if (input.down('Space')) car.speed *= Math.max(0, 1 - 3.2 * dt);
  else car.speed *= Math.max(0, 1 - CAR.drag * dt);
  car.speed = Math.max(-CAR.maxSpeed * 0.45, Math.min(CAR.maxSpeed, car.speed));
  const steerInput = axes.x;
  // Steering keeps authority at a crawl: the old code needed |speed| > 4
  // to steer at all, so a car pinned against a wall at speed ~0 could
  // never turn its nose off the wall and stayed wedged forever. The floor
  // only applies while the driver gives throttle, and driving above
  // 36 m/s is unchanged, so normal handling is untouched.
  const steerSpeed = Math.max(Math.abs(car.speed), throttle !== 0 ? 36 : 0);
  if (steerInput !== 0 && steerSpeed > 0) {
    car.angle += steerInput * CAR.steer * (steerSpeed / CAR.maxSpeed) * dt * 2.2;
  }
  const before = car.speed;
  const hit = moveEntity(state.world, car, Math.cos(car.angle) * car.speed * dt, Math.sin(car.angle) * car.speed * dt, 15);
  if (hit && Math.abs(before) > 120) {
    // A high-speed wall smash still hurts, but the old 0.12 factor took
    // ~19 HP off a 280 m/s clip — and the escape autopilot clips a corner
    // on nearly every turn, so wall damage alone killed the car in ~20 s.
    // 0.06 keeps a real penalty for smashing a wall at speed without making
    // corner clips a death sentence.
    car.health -= (Math.abs(before) - 120) * 0.06;
    if (Math.abs(before) > 200) state.player.health -= (Math.abs(before) - 200) * 0.05;
    audio.play('crash');
    burst(car.x, car.y, '#ffcd61', 10, 140);
    car.speed *= -0.25;
  } else if (hit) {
    // Scraping a wall is friction, not an instant halving. The old x0.5
    // every frame pinned a car nosed into a building corner at ~3 m/s:
    // the wall-slide could never carry it around the corner, so the escape
    // autopilot sat wedged at (1060,1706) for 10-30 s while the cops piled
    // in and shoved it back into the wall. Friction (~1.2/s) still slows
    // the car against a wall, but it keeps enough speed for the slide to
    // carry it around the corner and drive out. The >120 crash (damage +
    // bounce) above is untouched, so a real high-speed smash still hurts.
    car.speed *= Math.max(0, 1 - 1.2 * dt);
  }
  // Traffic and parked cars are solid to the player car.
  for (const other of state.world.cars) {
    if (other === car || other.health <= 0) continue;
    if (Math.hypot(other.x - car.x, other.y - car.y) < 38) {
      // Police rams have their own damage (the 2/s ram in updatePolice):
      // the 6 HP crash tick below fired every frame the player drove at
      // >90 m/s in contact with a ramming cop, shredding the car in ~11 s
      // of driving and making the 3-star escape unwinnable even though the
      // ram DoT itself was survivable. Police contact still slows the car
      // and shoves it; only the crash tick is skipped for them.
      if (other.kind !== 'police' && Math.abs(car.speed) > 90) {
        car.health -= 6;
        other.health -= 4;
        audio.play('crash');
        burst(car.x, car.y, '#ffcd61', 8, 120);
      }
      // Same split for the speed cut: the x0.55 below halved the player's
      // speed every frame a car stayed within 38 px, so plowing through
      // traffic kept the car at ~80 m/s while the cops closed at 210 — the
      // player never reached the top speed that was supposed to be the
      // escape's advantage. Traffic contact is now friction (~1.5/s, like
      // the wall scrape): the car still slows through a crash, but it keeps
      // enough speed to pull away afterwards. Police contact still costs
      // only the ram DoT + ram slowdown.
      if (other.kind !== 'police') car.speed *= Math.max(0, 1 - 1.5 * dt);
      // The separation push goes through moveEntity, not a raw position
      // change: a raw push could shove the car inside a building or past
      // the map edge, where every direction is solid and moveEntity then
      // blocks all movement forever — the car sat wedged at speed ~0,
      // turning in place, for the rest of the escape. moveEntity slides
      // along walls and stops at solid, so the push can never clip the
      // car into a trap.
      const push = Math.atan2(car.y - other.y, car.x - other.x);
      moveEntity(state.world, car, Math.cos(push) * 6, Math.sin(push) * 6, 15);
    }
  }
  // Running down a pedestrian is a crime, and it is felt — but only if the
  // car is actually moving. A stationary or crawling car used to kill any
  // pedestrian who walked into it and add a wanted star each time, so a car
  // wedged against a building corner climbed 3 -> 5 stars while sitting
  // still, with five police cars keeping it seen for the whole escape.
  // Below 40 m/s the pedestrian just walks past; above it, the old
  // run-over (kill + wanted + slowdown) still applies.
  for (const p of state.world.peds) {
    if (p.health > 0 && !p.cop && Math.abs(car.speed) > 40 && Math.hypot(p.x - car.x, p.y - car.y) < 26) {
      p.health = 0;
      p.panic = 1;
      for (const q of state.world.peds) if (Math.hypot(q.x - p.x, q.y - p.y) < 160) q.panic = 1;
      addWanted(1);
      audio.play('crash');
      burst(p.x, p.y, '#ff765f', 8, 110);
      car.speed *= 0.85;
    }
  }
  // Garage repairs: park the car by the garage and it is fixed for $100.
  const garage = MISSION_POINTS.garage;
  if (Math.hypot(car.x - garage.x, car.y - garage.y) < 80 && car.health < 100 && state.money >= 100 && !state.repairedAt) {
    state.money -= 100;
    car.health = 100;
    state.repairedAt = true;
    // Persist the spend: without this, reloading after a repair
    // restores the pre-repair money and the $100 comes back.
    saveGame();
    notify('GARAGE REPAIR — $100 / Good as new');
    audio.play('pickup');
  } else if (Math.hypot(car.x - garage.x, car.y - garage.y) >= 120) {
    state.repairedAt = false;
  }
  if (car.health <= 0) {
    burst(car.x, car.y, '#ff765f', 26, 220);
    burst(car.x, car.y, '#3a3f45', 18, 120);
    audio.play('crash');
    state.player.health -= 20;
    state.player.x = car.x + 34;
    state.player.y = car.y;
    car.controlled = false;
    car.speed = 0;
    state.car = null;
    notify('CAR WRECKED / You crawled out');
    return;
  }
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
}

function enterExitCar() {
  if (state.car) {
    const car = state.car;
    car.controlled = false;
    car.speed *= 0.3;
    state.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    state.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    state.car = null;
    notify('ON FOOT / Keys in your pocket');
    return;
  }
  const car = nearestCar(state.world, state.player.x, state.player.y, 64);
  if (!car || car.kind === 'police') return;
  car.controlled = true;
  car.parked = false;
  state.car = car;
  state.player.x = car.x;
  state.player.y = car.y;
  if (!car.stolen && car.kind === 'civilian') {
    car.stolen = true;
    addWanted(1);
    notify('CAR STOLEN / Someone saw you take it');
  } else {
    notify('BEHIND THE WHEEL / Drive');
  }
  audio.unlock();
}

function resetAfterTrouble() {
  if (state.car) { state.car.controlled = false; state.car.speed = 0; state.car = null; }
  state.wanted = 0;
  state.bust = 0;
  state.escape = 0;
  clearPolice();
  restoreCourier();
  state.bullets = [];
  state.player.x = MISSION_POINTS.garage.x;
  state.player.y = MISSION_POINTS.garage.y;
  state.player.health = PLAYER.maxHealth;
  state.player.ammo = Math.max(state.player.ammo, 12);
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  state.mission = state.completed.length < 3 ? state.completed.length : -1;
  state.stage = 0;
  if (state.mission >= 0) startMission(state.mission);
  else applyStage();
  state.screen = 'play';
  announce('Back at the garage. The story continues.');
}

function startNewGame() {
  state = newState();
  state.money = 250;
  state.screen = 'play';
  startMission(0);
  audio.unlock();
  announce('Playing. Mara Velez needs the ledger delivered.');
}

function continueGame() {
  if (!loadSave()) return;
  state.screen = 'play';
  state.mission = state.completed.length < 3 ? state.completed.length : -1;
  state.stage = 0;
  if (state.mission >= 0) startMission(state.mission);
  else applyStage();
  audio.unlock();
  announce(`Continuing. $${state.money}, ${state.completed.length} of 3 jobs done.`);
}

function step(dt) {
  state.elapsed += dt;
  state.fireT = Math.max(0, state.fireT - dt);
  state.crimeT = Math.max(0, state.crimeT - dt);
  if (state.dialogueT > 0) { state.dialogueT -= dt; if (state.dialogueT <= 0) state.dialogue = ''; }
  if (state.toastT > 0) { state.toastT -= dt; if (state.toastT <= 0) state.toast = ''; }
  const pos = focusPos();
  updateWorld(state.world, dt, pos);
  if (state.car) updateCar(dt);
  else updatePlayer(dt);
  updateBullets(dt);
  updatePolice(dt);
  updateMission();
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  // The camera follows the player or the car, pulling back as speed rises.
  const target = focusPos();
  state.camera.x += (target.x - state.camera.x) * Math.min(1, 6 * dt);
  state.camera.y += (target.y - state.camera.y) * Math.min(1, 6 * dt);
  const zoomTarget = state.car ? (Math.abs(state.car.speed) > 240 ? 0.78 : 0.85) : 1;
  state.camera.zoom += (zoomTarget - state.camera.zoom) * Math.min(1, 3 * dt);
  if (state.player.health <= 0) {
    state.player.health = 0;
    saveGame();
    state.screen = 'wasted';
    announce('Wasted. The city gave you another chance.');
  }
}

function handleButton(id) {
  audio.unlock();
  if (id === 'start') startNewGame();
  else if (id === 'continue') { if (state.hasSave) continueGame(); else notify('NO SAVE YET / Start a new story first'); }
  else if (id === 'help') { state.screen = 'help'; announce('How to play.'); }
  else if (id === 'back') { state.screen = 'title'; announce('Port Delmar. Press Enter to start.'); }
  else if (id === 'resume') { state.screen = 'play'; announce('Playing.'); }
  else if (id === 'save') { saveGame(); notify('PROGRESS SAVED / Safe at the garage'); }
  else if (id === 'title') { state.screen = 'title'; announce('Port Delmar. Press Enter to start.'); }
  else if (id === 'restart') resetAfterTrouble();
  else if (id === 'next') {
    if (state.completed.length < 3) { startMission(state.completed.length); state.screen = 'play'; }
    else {
      // All three jobs done: free roam. mission MUST go to -1 — without
      // this it still points at the mission 3 escape stage, and the car
      // is sitting inside the safe-house radius with wanted <= 1, so the
      // first updateMission step re-completes mission 3: +$1000, a second
      // 2 in `completed`, and the screen flips straight back to
      // 'complete', trapping the player in a completion loop.
      state.mission = -1;
      state.stage = 0;
      state.screen = 'play';
      applyStage();
    }
  }
}

function handleKeys() {
  if (input.take('KeyM')) {
    state.muted = audio.toggle();
    notify(state.muted ? 'SOUND OFF' : 'SOUND ON', 2);
  }
  const confirm = input.take('Enter') || input.take('Space');
  if (state.screen === 'title') {
    if (confirm) startNewGame();
    else if (input.take('Digit1')) startNewGame();
  } else if (state.screen === 'help') {
    if (confirm || input.take('Escape')) state.screen = 'title';
  } else if (state.screen === 'play') {
    if (input.take('KeyP') || input.take('Escape')) { state.screen = 'paused'; announce('Paused.'); }
    else if (input.take('KeyE')) enterExitCar();
  } else if (state.screen === 'paused') {
    if (input.take('KeyP') || input.take('Escape') || confirm) { state.screen = 'play'; announce('Playing.'); }
  } else if (state.screen === 'busted' || state.screen === 'wasted') {
    if (confirm) resetAfterTrouble();
  } else if (state.screen === 'complete') {
    if (confirm) handleButton('next');
  }
}

function handleClicks() {
  if (!input.pointer.clicked) return;
  audio.unlock();
  const clicked = renderer.buttons.find((b) => input.pointer.x >= b.x && input.pointer.x <= b.x + b.w && input.pointer.y >= b.y && input.pointer.y <= b.y + b.h);
  if (clicked) {
    handleButton(clicked.id);
    return;
  }
  if (state.screen === 'play') fireBullet();
}

function runShot(name) {
  state = newState();
  state = stageShot(name, state);
  let painted = 0;
  function paint() {
    renderer.draw(state);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  state.screen = 'title';

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleKeys();
    if (state.screen === 'play') {
      while (accumulator >= STEP) {
        step(STEP);
        accumulator -= STEP;
        if (state.screen !== 'play') { accumulator = 0; break; }
      }
    } else {
      accumulator = 0;
      // The title screen keeps the city alive behind the menu.
      if (state.screen === 'title') {
        state.elapsed += 1 / 60;
        updateWorld(state.world, 1 / 60, state.player);
        state.camera.x += (1200 - state.camera.x) * 0.002;
        state.camera.y += (900 - state.camera.y) * 0.002;
      }
    }
    renderer.draw(state);
    handleClicks();
    audio.update(state.car ? state.car.speed : null, state.wanted, state.elapsed, state.screen === 'play');
    input.endFrame();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'play') {
      state.screen = 'paused';
      announce('Paused.');
    }
  });
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });

  announce('Port Delmar. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
