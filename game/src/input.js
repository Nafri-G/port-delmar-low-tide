// Keyboard, mouse and touch input. Movement keys are read continuously
// (held), while actions are read once (pressed) so a single key press fires
// a single action even if the key stays down.
//
// The pointer is reported in the game's virtual 1280x720 coordinates, so
// aiming and menu clicks work at any window size. Touch uses the same
// virtual coordinates, so the on-screen stick and buttons feed the same
// movement and action paths as the keyboard and mouse.
export function createInput(canvas) {
  const heldKeys = new Set();
  const pressedKeys = new Set();
  const pointer = { x: 640, y: 360, down: false, clicked: false };
  const touch = { x: 0, y: 0, run: false, fire: false };

  // Only game keys are captured; everything else (F5, browser shortcuts)
  // is left alone.
  const gameKey = /^(Key[WASDEPM]|Arrow(Up|Down|Left|Right)|Shift(Left|Right)|Enter|Space|Escape|Digit[123])$/;

  window.addEventListener('keydown', (event) => {
    if (!gameKey.test(event.code)) return;
    event.preventDefault();
    if (!event.repeat) pressedKeys.add(event.code);
    heldKeys.add(event.code);
  });
  window.addEventListener('keyup', (event) => heldKeys.delete(event.code));
  window.addEventListener('blur', () => {
    heldKeys.clear();
    pointer.down = false;
    touch.x = 0;
    touch.y = 0;
  });

  function trackPointer(event) {
    const box = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - box.left) * 1280) / box.width;
    pointer.y = ((event.clientY - box.top) * 720) / box.height;
  }
  canvas.addEventListener('pointermove', trackPointer);
  canvas.addEventListener('pointerdown', (event) => {
    trackPointer(event);
    pointer.down = true;
    pointer.clicked = true;
    canvas.focus();
  });
  window.addEventListener('pointerup', () => { pointer.down = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  // Touch joystick: a virtual stick in the bottom-left corner.
  const stick = document.getElementById('stick');
  const nub = document.getElementById('nub');
  let stickPointer = null;
  function moveStick(event) {
    const box = stick.getBoundingClientRect();
    const dx = event.clientX - box.left - box.width / 2;
    const dy = event.clientY - box.top - box.height / 2;
    const reach = Math.max(45, Math.hypot(dx, dy));
    touch.x = dx / reach;
    touch.y = dy / reach;
    nub.style.transform = `translate(${touch.x * 36}px, ${touch.y * 36}px)`;
  }
  function releaseStick() {
    stickPointer = null;
    touch.x = 0;
    touch.y = 0;
    nub.style.transform = '';
  }
  stick.addEventListener('pointerdown', (event) => {
    stickPointer = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    moveStick(event);
  });
  stick.addEventListener('pointermove', (event) => {
    if (event.pointerId === stickPointer) moveStick(event);
  });
  stick.addEventListener('pointerup', releaseStick);
  stick.addEventListener('pointercancel', releaseStick);

  // Touch buttons: ENTER acts like pressing E once; RUN and FIRE are held.
  document.getElementById('touch-enter').addEventListener('pointerdown', (event) => {
    event.preventDefault();
    pressedKeys.add('KeyE');
  });
  for (const [id, flag] of [['touch-run', 'run'], ['touch-shoot', 'fire']]) {
    const button = document.getElementById(id);
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      touch[flag] = true;
    });
    button.addEventListener('pointerup', () => { touch[flag] = false; });
    button.addEventListener('pointercancel', () => { touch[flag] = false; });
  }

  return {
    pointer,
    touch,
    down(...codes) {
      return codes.some((code) => heldKeys.has(code));
    },
    take(code) {
      const wasPressed = pressedKeys.has(code);
      pressedKeys.delete(code);
      return wasPressed;
    },
    axes() {
      const left = heldKeys.has('KeyA') || heldKeys.has('ArrowLeft');
      const right = heldKeys.has('KeyD') || heldKeys.has('ArrowRight');
      const up = heldKeys.has('KeyW') || heldKeys.has('ArrowUp');
      const downKey = heldKeys.has('KeyS') || heldKeys.has('ArrowDown');
      const x = Math.max(-1, Math.min(1, (right ? 1 : 0) - (left ? 1 : 0) + touch.x));
      const y = Math.max(-1, Math.min(1, (downKey ? 1 : 0) - (up ? 1 : 0) + touch.y));
      return { x, y };
    },
    endFrame() {
      pressedKeys.clear();
      pointer.clicked = false;
    },
  };
}
