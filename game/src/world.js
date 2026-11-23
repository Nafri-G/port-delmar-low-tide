// Port Delmar: a seeded coastal city. Roads run on a 320 m grid; each
// block holds four buildings or a park; the beach and water edge run along
// the east side. Everything here is deterministic for a given seed, so the
// city is identical on every load with that seed.
//
// The world also runs the traffic and pedestrian simulation: civilian cars
// follow lanes and stop at red lights, pedestrians walk the sidewalks and
// flee when frightened. Collision is against buildings and the city edge.
import { CITY, CAR, PEDESTRIAN } from './config.js';
import { createRandom } from './random.js';

// Paint and roof colours for the buildings, and the shop signs.
const PAINTS = ['#c85d4c', '#57a5a2', '#e9bf68', '#d3d6c8', '#697f9c', '#b37187'];
const ROOFS = ['#dfc7a2', '#e9d4b3', '#9cbbb0', '#d4a99b', '#b6c5c7'];
const SIGNS = ['MOTEL SOL', 'DELMAR STORAGE', 'LUNA CAFÉ', 'TROPIC LAUNDRY', 'BAHIA RADIO', 'SUNMARKET', 'CASA MAR', 'EL FARO'];

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function createWorld(seed = 1) {
  const rng = createRandom(seed);
  const world = {
    seed,
    rng,
    width: CITY.width,
    height: CITY.height,
    time: 0,
    roads: [],
    buildings: [],
    parks: [],
    trees: [],
    props: [],
    cars: [],
    peds: [],
    pickups: [],
    lights: [],
  };

  // Roads: vertical lanes every 320 m up to the coast, horizontal lanes
  // every 320 m down the whole height. Each road is 88 m wide.
  for (let x = 160; x < CITY.coast; x += 320) {
    world.roads.push({ x: x - 44, y: 0, w: 88, h: CITY.height, axis: 'v' });
  }
  for (let y = 160; y < CITY.height; y += 320) {
    world.roads.push({ x: 0, y: y - 44, w: CITY.coast, h: 88, axis: 'h' });
  }

  // Blocks: a park on the diagonal and on a random 15% of blocks; otherwise
  // four buildings with a pavement ring between them.
  for (let bx = 220; bx < 2200; bx += 320) {
    for (let by = 220; by < 2100; by += 320) {
      const diagonal = Math.floor(bx / 320) + Math.floor(by / 320) === 3;
      if (diagonal || rng() < 0.15) {
        world.parks.push({ x: bx, y: by, w: 200, h: 200 });
        for (let k = 0; k < 8; k++) {
          world.trees.push({ x: bx + 15 + rng() * 170, y: by + 15 + rng() * 170, r: 16 + rng() * 6 });
        }
        continue;
      }
      for (let a = 0; a < 2; a++) {
        for (let b = 0; b < 2; b++) {
          const bw = 72 + rng() * 15;
          const bh = 68 + rng() * 20;
          // Buildings are right-aligned in their cell so every building in
          // a column shares the same east face (bx + a*103 + 92). If the
          // east faces varied with the random width, vertically-adjacent
          // buildings formed a lip: a car driving north in the gap east of
          // them wedged into a 0.5 m pocket between the two east faces and
          // could never move out. The RNG sequence is unchanged (bw is
          // still drawn once per building); only the x formula differs.
          world.buildings.push({
            x: bx + a * 103 + 92 - bw,
            y: by + b * 103 + 5,
            w: bw,
            h: bh,
            color: pick(rng, PAINTS),
            roof: pick(rng, ROOFS),
            name: pick(rng, SIGNS),
            height: 8 + rng() * 9,
          });
        }
      }
      for (let k = 0; k < 3; k++) {
        world.trees.push({ x: bx + 12 + k * 80, y: by - 8, r: 15 + rng() * 6 });
      }
    }
  }

  // One traffic light, one lamp and sometimes a bench at every crossing.
  for (let x = 160; x < CITY.coast; x += 320) {
    for (let y = 160; y < CITY.height; y += 320) {
      world.lights.push({ x, y, phase: 0 });
      world.props.push({ x: x + 54, y: y + 54, type: 'lamp', angle: 0 });
      if (rng() < 0.5) world.props.push({ x: x - 60, y: y + 92, type: 'bench', angle: Math.PI / 2 });
    }
  }

  // A palm line and beach umbrellas along the water edge.
  for (let y = 80; y < CITY.height; y += 110) {
    world.trees.push({ x: 2225, y, r: 21 });
    world.props.push({ x: 2320, y: y + 35, type: 'umbrella', angle: rng() * 6.28 });
  }

  // Civilian cars: a third parked at the curb, the rest driving in lanes.
  for (let i = 0; i < 46; i++) {
    const horizontal = i % 2 === 0;
    const road = 160 + 320 * Math.floor(rng() * 6);
    const along = 80 + rng() * 2040;
    const parked = i % 3 === 0;
    const angle = horizontal ? (i % 4 === 0 ? 0 : Math.PI) : (i % 4 === 1 ? Math.PI / 2 : -Math.PI / 2);
    const offset = parked ? 34 : 19;
    world.cars.push({
      id: `car-${i}`,
      x: horizontal ? along : road + (angle > 0 ? -offset : offset),
      y: horizontal ? road + (angle === 0 ? offset : -offset) : along,
      angle,
      speed: parked ? 0 : 60 + rng() * 35,
      health: 100,
      color: PAINTS[i % PAINTS.length],
      kind: 'civilian',
      parked,
      stolen: false,
      controlled: false,
      turnCooldown: 0,
    });
  }
  // The player's starter car, parked by the garage.
  Object.assign(world.cars[0], { x: 505, y: 392, angle: -Math.PI / 2, parked: true, speed: 0, color: '#e9b956' });
  // The mission car: Niko's Sunrunner, parked at the courier office.
  // It is already marked stolen, so taking it for the job adds no wanted level.
  // It faces south, along the north-south road it is parked on: facing east
  // would point it at the beach, and the escape job starts at the dock with
  // the car needing to drive south, so an east-facing start forces a U-turn
  // straight into the beachfront building at (2145,1608).
  world.cars.push({
    id: 'courier', x: 1440, y: 1072, angle: Math.PI / 2, speed: 0, health: 100,
    color: '#efb746', kind: 'civilian', parked: true, stolen: true,
    controlled: false, turnCooldown: 0,
  });

  // Pedestrians walk the sidewalks, one lane offset from the road.
  for (let i = 0; i < PEDESTRIAN.count; i++) {
    const horizontal = i % 2 === 0;
    const road = 160 + 320 * Math.floor(rng() * 7);
    const along = 30 + rng() * 2110;
    const side = rng() < 0.5 ? -58 : 58;
    const x = horizontal ? along : road + side;
    const y = horizontal ? road + side : along;
    if (x > 2200) continue;
    world.peds.push({
      id: `ped-${i}`,
      x, y,
      homeX: x, homeY: y,
      angle: horizontal ? 0 : Math.PI / 2,
      health: 100,
      panic: 0,
      color: PAINTS[i % PAINTS.length],
      axis: horizontal ? 'h' : 'v',
      direction: rng() < 0.5 ? -1 : 1,
      respawn: 0,
    });
  }

  // Pickups: a health and an ammo pack by the garage, then a spread of
  // eighteen more across the city, alternating health and ammo.
  const spots = [{ x: 430, y: 392, type: 'health' }, { x: 552, y: 392, type: 'ammo' }];
  for (let i = 0; i < 18; i++) {
    spots.push({ x: 160 + 320 * (i % 6) + 58, y: 160 + 320 * Math.floor(i / 6) + 105, type: i % 2 ? 'ammo' : 'health' });
  }
  for (const spot of spots) world.pickups.push({ ...spot, active: true, respawn: 0 });

  return world;
}

// True when a circle of radius r at (x, y) touches a building or the edge.
export function solid(world, x, y, r = 10) {
  if (x - r < 12 || y - r < 12 || x + r > 2390 || y + r > world.height - 12) return true;
  return world.buildings.some((b) => x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h);
}

// Move an entity by (dx, dy) in small steps so it slides along walls
// instead of tunnelling through them. Returns true on any collision.
export function moveEntity(world, entity, dx, dy, r = 10) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
  let hit = false;
  for (let i = 0; i < steps; i++) {
    if (!solid(world, entity.x + dx / steps, entity.y, r)) entity.x += dx / steps;
    else hit = true;
    if (!solid(world, entity.x, entity.y + dy / steps, r)) entity.y += dy / steps;
    else hit = true;
  }
  return hit;
}

// The nearest drivable car within max metres, ignoring wrecks and the car
// the player is already driving.
export function nearestCar(world, x, y, max = 64) {
  let found = null;
  let best = max;
  for (const car of world.cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (car.health > 0 && !car.controlled && d < best) {
      found = car;
      best = d;
    }
  }
  return found;
}

// Traffic lights cycle on a 16 s loop, offset by intersection so the grid
// is not in sync. Horizontal green is the first 7 s, vertical the next 7.
export function lightGreen(world, x, y, axis) {
  const cycle = (world.time + Math.round(x / 320) * 1.7 + Math.round(y / 320) * 0.8) % 16;
  return axis === 'h' ? cycle < 7 : cycle >= 8 && cycle < 15;
}

// The nearest point on a road lane to (x, y), with the driving direction.
export function roadPoint(world, x, y) {
  const gx = Math.max(160, Math.min(2080, Math.round((x - 160) / 320) * 320));
  const gy = Math.max(160, Math.min(2080, Math.round((y - 160) / 320) * 320));
  if (Math.abs(x - gx) < Math.abs(y - gy)) {
    return { x: gx + 19, y: Math.max(45, Math.min(2195, y)), angle: -Math.PI / 2 };
  }
  return { x: Math.max(45, Math.min(2200, x)), y: gy + 19, angle: 0 };
}

// True when no building stands between two points.
export function lineOfSight(world, a, b) {
  const count = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 20);
  for (let i = 1; i < count; i++) {
    const x = a.x + ((b.x - a.x) * i) / count;
    const y = a.y + ((b.y - a.y) * i) / count;
    if (world.buildings.some((v) => x > v.x && x < v.x + v.w && y > v.y && y < v.y + v.h)) return false;
  }
  return true;
}

// One simulation tick: traffic cars drive their lanes, pedestrians walk
// (or flee), and spent pickups count down to respawn.
export function updateWorld(world, dt, target) {
  world.time += dt;

  for (const car of world.cars) {
    if (car.controlled || car.kind === 'police' || car.parked || car.health <= 0) continue;
    car.turnCooldown = Math.max(0, car.turnCooldown - dt);
    const horizontal = Math.abs(Math.cos(car.angle)) > 0.7;
    const axis = horizontal ? 'h' : 'v';
    const sign = horizontal ? Math.sign(Math.cos(car.angle)) : Math.sign(Math.sin(car.angle));
    const along = horizontal ? car.x : car.y;
    const next = 160 + 320 * Math.round((along + sign * 60 - 160) / 320);
    const ahead = (next - along) * sign;
    const crossX = horizontal ? next : 160 + 320 * Math.round((car.x - 160) / 320);
    const crossY = horizontal ? 160 + 320 * Math.round((car.y - 160) / 320) : next;
    let desired = 82;
    if (ahead > 24 && ahead < 80 && !lightGreen(world, crossX, crossY, axis)) desired = 0;
    for (const other of world.cars) {
      if (other === car || other.health <= 0) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const forward = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (forward > 0 && forward < 64 && side < 25) {
        desired = Math.min(desired, Math.max(0, (forward - 36) * 2));
      }
    }
    car.speed += (desired - car.speed) * Math.min(1, dt * 2.5);
    if (ahead >= -3 && ahead < 3 && car.turnCooldown === 0 && world.rng() < 0.018) {
      car.angle += world.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      car.turnCooldown = 4;
    }
    const hit = moveEntity(world, car, Math.cos(car.angle) * car.speed * dt, Math.sin(car.angle) * car.speed * dt, 15);
    if (hit || car.x < 35 || car.x > 2205 || car.y < 35 || car.y > 2205) {
      car.angle += Math.PI;
      car.speed = 25;
      car.turnCooldown = 3;
    }
  }

  for (const ped of world.peds) {
    if (ped.cop) continue;
    if (ped.health <= 0) {
      ped.respawn = (ped.respawn || 18) - dt;
      if (ped.respawn <= 0) {
        ped.health = 100;
        ped.x = ped.homeX;
        ped.y = ped.homeY;
        ped.respawn = 0;
      }
      continue;
    }
    ped.panic = Math.max(0, ped.panic - dt);
    let dx = 0;
    let dy = 0;
    if (ped.panic > 0 && target) {
      const angle = Math.atan2(ped.y - target.y, ped.x - target.x);
      dx = Math.cos(angle) * 80;
      dy = Math.sin(angle) * 80;
      ped.angle = angle;
    } else {
      const v = PEDESTRIAN.speed * ped.direction;
      if (ped.axis === 'h') dx = v;
      else dy = v;
      ped.angle = Math.atan2(dy, dx);
    }
    const blocked = moveEntity(world, ped, dx * dt, dy * dt, 7);
    const outOfBounds = ped.x < 30 || ped.x > 2205 || ped.y < 30 || ped.y > 2205;
    if (blocked || outOfBounds) ped.direction *= -1;
    // Walkers turn back before wandering more than 125 m from home, so
    // they stay on their own sidewalk instead of crossing the carriageway.
    if (ped.panic === 0) {
      const away = Math.abs((ped.axis === 'h' ? ped.x : ped.y) - (ped.axis === 'h' ? ped.homeX : ped.homeY));
      if (away > 125) ped.direction *= -1;
    }
  }

  for (const pickup of world.pickups) {
    if (!pickup.active) {
      pickup.respawn -= dt;
      if (pickup.respawn <= 0) pickup.active = true;
    }
  }
}
