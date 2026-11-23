// Canvas rendering for Port Delmar: the city, its cars and people, the HUD
// with its minimap, and every menu screen. The canvas is drawn in a
// virtual 1280x720 space and scaled to the window, so the layout is the
// same at any size. Only what the camera can see is drawn.
// The palette comes from config.js; the renderer never hard-codes a colour
// that belongs to the tuning, so a palette change is a config change.
import { CITY, COLORS } from './config.js';
import { lightGreen, nearestCar } from './world.js';

const TAU = Math.PI * 2;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const buttons = [];
  let state = null;

  function fitCanvas() {
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * scale);
    canvas.height = Math.round(window.innerHeight * scale);
  }
  fitCanvas();
  window.addEventListener('resize', fitCanvas);

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  function label(value, x, y, size = 16, color = COLORS.paper, weight = 400, align = 'left') {
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  }
  function disc(x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
  }
  function segment(x1, y1, x2, y2, color, width = 1) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  function screenToWorld(x, y, s) {
    return {
      x: (x - 640) / s.camera.zoom + s.camera.x,
      y: (y - 360) / s.camera.zoom + s.camera.y,
    };
  }
  function onScreen(x, y, w = 0, h = 0) {
    const cam = state.camera;
    return (
      x + w > cam.x - 760 / cam.zoom &&
      x < cam.x + 760 / cam.zoom &&
      y + h > cam.y - 450 / cam.zoom &&
      y < cam.y + 450 / cam.zoom
    );
  }

  function drawBuilding(b) {
    if (!onScreen(b.x, b.y, b.w + 25, b.h + 25)) return;
    rect(b.x + 12, b.y + 16, b.w, b.h, '#12353635');
    rect(b.x, b.y + 8, b.w, b.h, b.color);
    rect(b.x, b.y, b.w, b.h - 8, b.roof);
    rect(b.x + 4, b.y + 4, b.w - 8, 3, '#fff0cc88');
    rect(b.x + b.w - 5, b.y + 5, 5, b.h - 13, '#00000016');
    rect(b.x + 8, b.y + 13, b.w - 16, b.h - 30, '#ffffff13');
    for (let x = 8; x < b.w - 8; x += 18) {
      rect(b.x + x, b.y + b.h - 1, 10, 5, '#294d55');
      rect(b.x + x, b.y + b.h + 5, 10, 2, '#fff0cc88');
    }
    rect(b.x + 12, b.y + 18, 19, 14, '#6c8281');
    rect(b.x + 12, b.y + 18, 19, 3, '#9cad9f');
    for (let i = 0; i < 4; i++) segment(b.x + 15 + i * 4, b.y + 23, b.x + 15 + i * 4, b.y + 29, '#415c60');
    if (b.w > 78) {
      rect(b.x + b.w - 28, b.y + 18, 16, 8, '#34596a');
      rect(b.x + b.w - 26, b.y + 19, 12, 4, '#7babb0');
    }
    if (b.name && state.camera.zoom > 0.78) {
      rect(b.x + 5, b.y + b.h - 22, b.w - 10, 13, '#112d3bc9');
      label(b.name, b.x + b.w / 2, b.y + b.h - 12, 7, '#fff0cc', 700, 'center');
    }
  }

  function drawPalm(t) {
    if (!onScreen(t.x - 35, t.y - 35, 70, 75)) return;
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.save();
    ctx.translate(12, 17);
    ctx.scale(1, 0.65);
    disc(0, 0, t.r, '#173f3c25');
    ctx.restore();
    segment(3, 10, -2, -3, '#986b48', 5);
    segment(1, 8, -3, -5, '#b08c59', 2);
    for (let i = 0; i < 7; i++) {
      const a = (i * TAU) / 7 + t.x * 0.01;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(8, -t.r * 0.65, t.r, 2);
      ctx.quadraticCurveTo(t.r * 0.5, -4, 0, 4);
      ctx.fillStyle = i % 2 ? '#357859' : '#4c9162';
      ctx.fill();
      ctx.restore();
    }
    disc(0, 0, 3, '#a4af66');
    ctx.restore();
  }

  function drawCar(car) {
    if (!onScreen(car.x - 35, car.y - 35, 70, 70)) return;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    rect(-20, -9, 43, 22, '#0d263e40');
    for (const x of [-13, 10]) {
      rect(x, -13, 9, 5, '#193440');
      rect(x, 8, 9, 5, '#193440');
    }
    rect(-22, -10, 43, 20, car.health > 0 ? car.color : '#4e5050');
    rect(-18, -9, 35, 2, '#fff7d866');
    rect(-18, 7, 35, 2, '#001b3933');
    rect(-7, -9, 18, 18, '#263f4c');
    rect(-5, -7, 12, 14, car.kind === 'police' ? '#f0eddb' : car.color);
    rect(7, -7, 5, 14, '#82a8a5');
    rect(-10, -7, 4, 14, '#33495b');
    segment(7, -6, 11, -3, '#c5e0cf', 1);
    rect(15, -8, 4, 16, '#ffffff12');
    rect(19, -9, 3, 4, '#fff1be');
    rect(19, 5, 3, 4, '#fff1be');
    rect(-22, -9, 2, 4, '#fc7054');
    rect(-22, 5, 2, 4, '#fc7054');
    if (car.kind === 'police') {
      rect(-18, -10, 10, 20, '#203f58');
      rect(1, -9, 4, 18, '#192c45');
      const blink = Math.floor(state.world.time * 9) % 2 === 0;
      rect(0, -8, 5, 7, blink ? '#ff5c6b' : '#522c46');
      rect(0, 1, 5, 7, blink ? '#244166' : '#72bfff');
      if (state.wanted) {
        disc(0, -7, 11, '#ff3f6816');
        disc(0, 7, 11, '#4b9cff16');
      }
    }
    if (car.health < 35 && car.health > 0) {
      disc(-18, -3, 5 + Math.sin(state.elapsed * 4) * 2, '#746457aa');
    }
    if (car.controlled) {
      ctx.strokeStyle = COLORS.mint;
      ctx.lineWidth = 1;
      ctx.strokeRect(-25, -14, 49, 28);
    }
    ctx.restore();
  }

  function drawPerson(p, isPlayer = false) {
    if (p.health <= 0) {
      if (onScreen(p.x, p.y)) {
        disc(p.x + 2, p.y + 3, 9, '#435652');
        segment(p.x - 7, p.y, p.x + 8, p.y, '#b38769', 5);
      }
      return;
    }
    if (!onScreen(p.x - 14, p.y - 14, 28, 28)) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle || 0);
    disc(3, 4, 8, '#153c423b');
    const stride = Math.sin(state.elapsed * (p.panic ? 15 : 9) + p.x) * 3;
    rect(-4, -7 + stride, 6, 4, '#293d4e');
    rect(-4, 3 - stride, 6, 4, '#293d4e');
    disc(0, 0, 7, isPlayer ? '#fff1d2' : p.cop ? '#24476b' : p.color);
    disc(3, 0, 4, '#d7a276');
    if (isPlayer || p.cop) {
      rect(3, 5, 9, 3, '#d7a276');
      rect(10, 5, 7, 3, '#243a46');
    }
    ctx.restore();
    if (isPlayer) {
      ctx.strokeStyle = COLORS.mint;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13, 0, TAU);
      ctx.stroke();
    }
  }

  function drawCity() {
    const w = state.world;
    rect(0, 0, w.width, w.height, '#b7c9a0');
    rect(2190, 0, 200, w.height, '#ead69b');
    rect(2390, 0, 170, w.height, '#258d99');
    for (let i = 0; i < 20; i++) {
      const y = i * 135 + Math.sin(i * 2.9) * 20;
      segment(2395, y, 2430, y + 55, '#b4e2c57a', 3);
      segment(2450, y + 20, 2520, y + 45, '#76c9b67a', 2);
    }
    for (const park of w.parks) {
      rect(park.x - 8, park.y - 8, park.w + 16, park.h + 16, '#c4c5a0');
      rect(park.x, park.y, park.w, park.h, '#7da779');
      rect(park.x + park.w / 2 - 7, park.y, 14, park.h, '#d7c69e');
      rect(park.x, park.y + park.h / 2 - 7, park.w, 14, '#d7c69e');
      disc(park.x + park.w / 2, park.y + park.h / 2, 24, '#ddcdad');
      disc(park.x + park.w / 2, park.y + park.h / 2, 17, '#63aaa5');
      disc(park.x + park.w / 2, park.y + park.h / 2, 5, '#f0e3b9');
    }
    for (const r of w.roads) rect(r.x - 15, r.y - 15, r.w + 30, r.h + 30, '#d2c9ae');
    for (const r of w.roads) rect(r.x, r.y, r.w, r.h, '#4c6269');
    ctx.setLineDash([15, 18]);
    ctx.strokeStyle = '#c6c5a0';
    ctx.lineWidth = 1.5;
    for (const r of w.roads) {
      ctx.beginPath();
      if (r.axis === 'h') {
        ctx.moveTo(r.x, r.y + 44);
        ctx.lineTo(r.x + r.w, r.y + 44);
      } else {
        ctx.moveTo(r.x + 44, r.y);
        ctx.lineTo(r.x + 44, r.y + r.h);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const light of w.lights) {
      if (!onScreen(light.x - 100, light.y - 100, 200, 200)) continue;
      rect(light.x - 44, light.y - 44, 88, 88, '#4c6269');
      for (let i = -3; i <= 3; i++) {
        rect(light.x + i * 10 - 3, light.y - 59, 6, 11, '#e8dcc0');
        rect(light.x + i * 10 - 3, light.y + 48, 6, 11, '#e8dcc0');
        rect(light.x - 59, light.y + i * 10 - 3, 11, 6, '#e8dcc0');
        rect(light.x + 48, light.y + i * 10 - 3, 11, 6, '#e8dcc0');
      }
      rect(light.x + 47, light.y + 42, 8, 18, '#263e48');
      disc(light.x + 51, light.y + 47, 2.5, lightGreen(w, light.x, light.y, 'h') ? '#8ce5a8' : '#ff7b60');
      rect(light.x - 58, light.y - 57, 18, 8, '#263e48');
      disc(light.x - 52, light.y - 53, 2.5, lightGreen(w, light.x, light.y, 'v') ? '#8ce5a8' : '#ff7b60');
    }
    for (const b of w.buildings) drawBuilding(b);
    ctx.save();
    ctx.globalAlpha = 0.3;
    for (let y = 480; y < 2200; y += 640) {
      label(y === 1120 ? 'PELICAN AVENUE' : 'CALLE SOL', 1090, y - 27, 11, '#fff3d5', 600, 'center');
    }
    ctx.restore();
    for (const prop of w.props) {
      if (!onScreen(prop.x - 20, prop.y - 20, 40, 40)) continue;
      if (prop.type === 'umbrella') {
        disc(prop.x + 8, prop.y + 8, 18, '#6b6a4333');
        disc(prop.x, prop.y, 17, Math.round(prop.y) % 2 ? '#e67d60' : '#83bbb0');
        segment(prop.x - 17, prop.y, prop.x + 17, prop.y, '#fff0cc88');
        segment(prop.x, prop.y - 17, prop.x, prop.y + 17, '#fff0cc88');
        disc(prop.x, prop.y, 2, '#ffefc7');
        rect(prop.x - 7, prop.y + 23, 14, 25, '#f4e5c6');
      } else if (prop.type === 'bench') {
        rect(prop.x - 9, prop.y - 3, 18, 6, '#8d6c4d');
        segment(prop.x - 9, prop.y - 5, prop.x + 9, prop.y - 5, '#4c655b', 2);
      } else {
        segment(prop.x, prop.y, prop.x + 8, prop.y - 7, '#54655a', 2);
        disc(prop.x + 8, prop.y - 7, 3, '#ffedac');
      }
    }
    for (const pickup of w.pickups) {
      if (!pickup.active) continue;
      disc(pickup.x, pickup.y, 13, pickup.type === 'ammo' ? '#ffcd612a' : '#7ff1c52a');
      rect(pickup.x - 7, pickup.y - 7, 14, 14, pickup.type === 'ammo' ? '#e4b251' : '#fff1ce');
      if (pickup.type === 'health') {
        rect(pickup.x - 2, pickup.y - 5, 4, 10, '#ed795f');
        rect(pickup.x - 5, pickup.y - 2, 10, 4, '#ed795f');
      } else {
        for (let k = 0; k < 3; k++) rect(pickup.x - 4 + k * 3, pickup.y - 4, 2, 8, '#344c52');
      }
    }
    for (const p of w.peds) drawPerson(p);
    for (const car of w.cars) drawCar(car);
    if (!state.car) drawPerson(state.player, true);
    for (const t of w.trees) drawPalm(t);
    for (const b of state.bullets) {
      segment(b.x, b.y, b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14, '#ffe7a1', 2);
    }
    for (const p of state.particles) disc(p.x, p.y, Math.max(1, p.life * 4), p.color);
    if (state.marker) {
      const m = state.marker;
      const pulse = 3 * Math.sin(state.elapsed * 3);
      disc(m.x, m.y, 29 + pulse, '#ffcd6124');
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 23 + pulse, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(m.x, m.y - 45);
      ctx.lineTo(m.x + 9, m.y - 32);
      ctx.lineTo(m.x, m.y - 19);
      ctx.lineTo(m.x - 9, m.y - 32);
      ctx.closePath();
      ctx.fillStyle = COLORS.gold;
      ctx.fill();
      label(m.label || 'OBJECTIVE', m.x, m.y - 54, 10, COLORS.ink, 700, 'center');
    }
  }

  function drawMinimap() {
    const x = 27;
    const y = 493;
    const mw = 191;
    const mh = 173;
    const sx = mw / CITY.width;
    const sy = mh / CITY.height;
    rect(x - 7, y - 7, mw + 14, mh + 35, '#102d3bf2');
    rect(x, y, mw, mh, '#91aa86');
    rect(x + 2240 * sx, y, 150 * sx, mh, '#e1cf96');
    rect(x + 2390 * sx, y, 170 * sx, mh, '#368f98');
    for (const r of state.world.roads) {
      rect(x + r.x * sx, y + r.y * sy, Math.max(1, r.w * sx), Math.max(1, r.h * sy), '#47616a');
    }
    for (const b of state.world.buildings) {
      rect(x + b.x * sx, y + b.y * sy, b.w * sx, b.h * sy, '#c7baa1');
    }
    for (const car of state.world.cars) {
      if (car.health > 0) {
        disc(x + car.x * sx, y + car.y * sy, car.kind === 'police' ? 2.5 : 1.1, car.kind === 'police' ? '#ff806e' : '#d6d9c0');
      }
    }
    if (state.marker) {
      disc(x + state.marker.x * sx, y + state.marker.y * sy, 4, COLORS.gold);
      disc(x + state.marker.x * sx, y + state.marker.y * sy, 1.5, COLORS.ink);
    }
    const p = state.car || state.player;
    ctx.save();
    ctx.translate(x + p.x * sx, y + p.y * sy);
    ctx.rotate(p.angle || 0);
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fillStyle = '#fff4ce';
    ctx.fill();
    ctx.restore();
    label('N ↑', x + mw - 4, y + 15, 10, '#fff0cc', 700, 'right');
    label('PORT DELMAR', x + 3, y + mh + 18, 9, '#adc7c1', 700);
    label('GPS / LIVE', x + mw - 3, y + mh + 18, 9, COLORS.mint, 400, 'right');
  }

  function drawHud() {
    rect(20, 17, 247, 59, '#102d3be8');
    rect(20, 17, 4, 59, COLORS.mint);
    label('PORT DELMAR', 38, 42, 19, COLORS.paper, 800);
    label('LOW TIDE / THE WATERFRONT', 39, 61, 9, '#9bbdb5', 700);
    rect(1020, 17, 240, 86, '#102d3be8');
    label('$' + Math.floor(state.money).toLocaleString('en-US'), 1238, 47, 27, COLORS.mint, 700, 'right');
    for (let i = 0; i < 5; i++) {
      label('★', 1040 + i * 26, 77, 23, i < state.wanted ? COLORS.gold : '#577079', 700);
    }
    const minutes = 16 * 60 + 40 + Math.floor(state.elapsed / 6);
    label(
      `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
      1239, 81, 12, '#bfd0bd', 400, 'right',
    );
    if (state.objective) {
      rect(287, 18, 710, 53, '#102d3be8');
      disc(306, 43, 5, COLORS.gold);
      label(state.objective, 323, 48, 15, COLORS.paper, 600);
    }
    if (state.wanted) {
      rect(925, 115, 335, 45, '#102d3bd9');
      label(
        state.inSight ? 'POLICE / VISUAL CONTACT' : 'POLICE / SEARCHING',
        942, 133, 10, state.inSight ? COLORS.coral : COLORS.gold, 700,
      );
      rect(942, 143, 299, 4, '#42606b');
      rect(942, 143, 299 * Math.min(1, state.escape / 8), 4, COLORS.gold);
    }
    if (state.marker) {
      const m = state.marker;
      const p = state.car || state.player;
      const dist = Math.round(Math.hypot(m.x - p.x, m.y - p.y));
      label(`${dist} M  /  ${m.label || 'OBJECTIVE'}`, 644, 91, 11, COLORS.ink, 700, 'center');
      const mx = (m.x - state.camera.x) * state.camera.zoom + 640;
      const my = (m.y - state.camera.y) * state.camera.zoom + 360;
      if (mx < 25 || mx > 1255 || my < 115 || my > 680) {
        const a = Math.atan2(my - 360, mx - 640);
        const xx = 640 + Math.cos(a) * Math.min(570, 270 / Math.max(0.01, Math.abs(Math.sin(a))));
        const yy = 360 + Math.sin(a) * Math.min(570, 270 / Math.max(0.01, Math.abs(Math.sin(a))));
        ctx.save();
        ctx.translate(xx, yy);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(11, 0);
        ctx.lineTo(-8, -8);
        ctx.lineTo(-8, 8);
        ctx.closePath();
        ctx.fillStyle = COLORS.gold;
        ctx.fill();
        ctx.restore();
      }
    }
    drawMinimap();
    rect(20, 434, 205, 45, '#102d3be8');
    label('HEALTH', 32, 450, 9, '#a9c5bc', 700);
    label('AMMO ' + state.player.ammo, 212, 450, 10, COLORS.paper, 700, 'right');
    rect(32, 461, 180, 6, '#49616b');
    rect(32, 461, 180 * Math.max(0, state.player.health) / 100, 6, state.player.health < 30 ? COLORS.coral : COLORS.mint);
    if (state.car) {
      rect(1084, 585, 176, 96, '#102d3be8');
      label(String(Math.round(Math.abs(state.car.speed) * 0.34)).padStart(3, '0'), 1100, 634, 40, COLORS.paper, 700);
      label('KM/H', 1239, 633, 11, COLORS.mint, 700, 'right');
      label('VEHICLE', 1101, 657, 9, '#a9c5bc', 700);
      rect(1100, 666, 143, 4, '#49616b');
      rect(1100, 666, 143 * Math.max(0, state.car.health) / 100, 4, COLORS.gold);
    }
    const prompt = state.car
      ? 'E / EXIT VEHICLE'
      : nearestCar(state.world, state.player.x, state.player.y)
        ? 'E / ENTER VEHICLE'
        : 'WASD / MOVE    SHIFT / RUN    CLICK / FIRE';
    label(prompt, 640, 697, 11, COLORS.paper, 700, 'center');
    label('P / PAUSE   M / ' + (state.muted ? 'UNMUTE' : 'MUTE'), 1258, 705, 9, '#dce0c9', 600, 'right');
    if (state.dialogue) {
      rect(292, 579, 690, 82, '#102d3bf2');
      rect(292, 579, 3, 82, COLORS.gold);
      label('INCOMING / THE WATERFRONT', 311, 601, 9, COLORS.gold, 700);
      wrapText(state.dialogue, 311, 624, 650, 16, 20);
    }
    if (state.toast) {
      rect(333, 111, 610, 33, '#102d3be8');
      label(state.toast, 638, 132, 12, COLORS.mint, 600, 'center');
    }
    if (state.bust > 0) {
      label('BUSTING ' + Math.round(state.bust) + '%', 640, 520, 18, COLORS.coral, 700, 'center');
    }
  }

  function wrapText(value, x, y, width, size, lineHeight) {
    const words = value.split(' ');
    let row = '';
    ctx.font = `400 ${size}px Arial`;
    for (const word of words) {
      const next = row + word + ' ';
      if (ctx.measureText(next).width > width && row) {
        label(row, x, y, size);
        y += lineHeight;
        row = word + ' ';
      } else {
        row = next;
      }
    }
    if (row) label(row, x, y, size);
  }

  function button(id, text, x, y, w = 350) {
    rect(x, y, w, 43, '#e5ecd713');
    rect(x, y, 3, 43, id === 'start' || id === 'resume' || id === 'next' ? COLORS.mint : '#6b8989');
    const hover = state.menuIndex === buttons.length;
    if (hover) rect(x + 3, y, w - 3, 43, '#7ff1c524');
    label(text, x + 18, y + 28, 15, hover ? COLORS.mint : COLORS.paper, 600);
    label('↗', x + w - 18, y + 28, 20, COLORS.mint, 400, 'right');
    buttons.push({ id, x, y, w, h: 43 });
  }

  function drawMenus() {
    if (state.screen === 'title') {
      const gradient = ctx.createLinearGradient(0, 0, 800, 0);
      gradient.addColorStop(0, '#102c3bf5');
      gradient.addColorStop(0.65, '#102c3bef');
      gradient.addColorStop(1, '#102c3b00');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 900, 720);
      label('A WATERFRONT CRIME STORY', 60, 76, 11, COLORS.mint, 700);
      label('PORT', 53, 188, 108, COLORS.paper, 900);
      label('DELMAR', 53, 284, 108, COLORS.paper, 900);
      rect(61, 310, 52, 4, COLORS.gold);
      label('L O W   T I D E', 128, 319, 21, COLORS.gold, 700);
      label('The harbor is being sold. Mara has a ledger.', 63, 374, 16, '#d1d6c0');
      label('You have a borrowed set of keys.', 63, 399, 16, '#d1d6c0');
      label('Make a living. Decide who owns this city.', 63, 424, 16, '#d1d6c0');
      button('start', 'START / NEW STORY', 62, 465, 371);
      button('continue', state.hasSave ? 'CONTINUE / SAVED STORY' : 'CONTINUE / NO SAVE YET', 62, 519, 371);
      button('help', 'HOW TO PLAY', 62, 573, 371);
      label('ORIGINAL CITY  /  LOCAL PLAY  /  SYNTHESIZED SOUND', 63, 672, 9, '#91b5ad', 700);
      rect(992, 31, 255, 45, '#102c3bdc');
      label('27° N / THE WATERFRONT', 1119, 59, 12, COLORS.paper, 600, 'center');
      label('THE CITY IS YOURS TO LOSE.', 1218, 649, 20, COLORS.ink, 800, 'right');
      label('PORT DELMAR / EST. 1926', 1218, 674, 11, COLORS.ink, 600, 'right');
      return;
    }
    if (state.screen === 'play') return;
    rect(0, 0, 1280, 720, '#092532a8');
    const help = state.screen === 'help';
    const x = help ? 315 : 390;
    const w = help ? 650 : 500;
    rect(x, help ? 95 : 166, w, help ? 546 : 400, '#112d3bf8');
    rect(x, help ? 95 : 166, w, 4, COLORS.mint);
    if (help) {
      label('THE STREETS ARE OPEN', x + 36, 144, 25, COLORS.paper, 800);
      const rows = [
        ['WASD / ARROWS', 'Walk · Accelerate, brake & steer'],
        ['SHIFT / SPACE', 'Run on foot · Handbrake in a car'],
        ['E', 'Enter / exit a nearby vehicle'],
        ['MOUSE + CLICK', 'Aim and fire · Limited ammunition'],
        ['GOLD MARKER', 'Follow your current story objective'],
        ['STARS', 'Break line of sight to lose police'],
        ['P / ESCAPE · M', 'Pause / save · Toggle sound'],
      ];
      rows.forEach(([key, desc], i) => {
        label(key, x + 36, 190 + i * 49, 11, COLORS.mint, 700);
        label(desc, x + 225, 190 + i * 49, 14, COLORS.paper);
      });
      label('Health + ammo at sidewalk pickups. Garage repairs cost $100.', x + 36, 554, 13, '#afc7b9');
      button('back', 'BACK', x + 36, 578, w - 72);
      return;
    }
    const headings = { paused: 'CITY ON HOLD', busted: 'BUSTED', wasted: 'WASTED', complete: 'MISSION COMPLETE' };
    label(
      headings[state.screen] || 'PORT DELMAR',
      640, 224, state.screen === 'complete' ? 30 : 36,
      state.screen === 'busted' || state.screen === 'wasted' ? COLORS.coral : COLORS.paper, 800, 'center',
    );
    if (state.screen === 'paused') {
      label('Progress is saved at safe checkpoints.', 640, 259, 14, '#b1c8bb', 400, 'center');
      button('resume', 'RESUME', x + 40, 296, w - 80);
      button('save', 'SAVE PROGRESS', x + 40, 353, w - 80);
      button('title', 'RETURN TO TITLE', x + 40, 410, w - 80);
    } else if (state.screen === 'complete') {
      wrapText(state.completionText || 'The waterfront remembers a favor.', x + 40, 269, w - 80, 16, 24);
      label('CASH $' + state.money + '  /  JOBS ' + state.completed.length + '/3', 640, 369, 17, COLORS.mint, 700, 'center');
      button('next', state.completed.length === 3 ? 'EXPLORE THE CITY' : 'NEXT JOB', x + 40, 422, w - 80);
    } else {
      label(
        state.screen === 'busted' ? 'They took the car. You kept your story.' : 'The city gave you another chance.',
        640, 279, 14, '#b1c8bb', 400, 'center',
      );
      label('Your completed jobs and cash are kept.', 640, 309, 13, COLORS.paper, 400, 'center');
      button('restart', 'RETURN TO THE GARAGE', x + 40, 356, w - 80);
      button('title', 'TITLE SCREEN', x + 40, 414, w - 80);
    }
  }

  function draw(s) {
    state = s;
    buttons.length = 0;
    ctx.setTransform(canvas.width / 1280, 0, 0, canvas.height / 720, 0, 0);
    rect(0, 0, 1280, 720, COLORS.ink);
    ctx.save();
    ctx.translate(640, 360);
    ctx.scale(s.camera.zoom, s.camera.zoom);
    ctx.translate(-s.camera.x, -s.camera.y);
    drawCity();
    ctx.restore();
    if (s.screen !== 'title') drawHud();
    drawMenus();
    // Warm film grain: sparse deterministic screen flecks, never random pixels.
    ctx.globalAlpha = 0.035;
    for (let i = 0; i < 180; i++) rect((i * 197) % 1280, (i * 137) % 720, 1, 1, '#fff2cf');
    ctx.globalAlpha = 1;
  }

  return { draw, screenToWorld, buttons };
}
