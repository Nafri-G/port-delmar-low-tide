// Continuous movement and one-shot actions are deliberately separate.
export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const pointer = {x:640,y:360,down:false,clicked:false};
  const touch = {x:0,y:0,run:false,fire:false};
  const recognized = /^(Key[WASDEPM]|Arrow(Up|Down|Left|Right)|Shift(Left|Right)|Enter|Space|Escape|Digit[123])$/;
  window.addEventListener('keydown', e => {
    if (!recognized.test(e.code)) return;
    e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', e => held.delete(e.code));
  window.addEventListener('blur', () => {held.clear();pointer.down=false;touch.x=touch.y=0;});
  function position(e) {
    const box=canvas.getBoundingClientRect();
    pointer.x=(e.clientX-box.left)*1280/box.width;
    pointer.y=(e.clientY-box.top)*720/box.height;
  }
  canvas.addEventListener('pointermove', position);
  canvas.addEventListener('pointerdown', e => {position(e);pointer.down=true;pointer.clicked=true;canvas.focus();});
  window.addEventListener('pointerup', () => {pointer.down=false;});
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  const stick=document.getElementById('stick');
  const nub=document.getElementById('nub');
  let stickId=null;
  function joystick(e) {
    const b=stick.getBoundingClientRect();
    const dx=e.clientX-b.left-b.width/2,dy=e.clientY-b.top-b.height/2;
    const length=Math.max(45,Math.hypot(dx,dy));
    touch.x=dx/length;touch.y=dy/length;
    nub.style.transform=`translate(${touch.x*36}px,${touch.y*36}px)`;
  }
  stick.addEventListener('pointerdown', e => {stickId=e.pointerId;stick.setPointerCapture(e.pointerId);joystick(e);});
  stick.addEventListener('pointermove', e => {if(e.pointerId===stickId)joystick(e);});
  const release=()=>{stickId=null;touch.x=touch.y=0;nub.style.transform='';};
  stick.addEventListener('pointerup',release);stick.addEventListener('pointercancel',release);
  document.getElementById('touch-enter').addEventListener('pointerdown', e=>{e.preventDefault();pressed.add('KeyE');});
  for (const [id,key] of [['touch-run','run'],['touch-shoot','fire']]) {
    const button=document.getElementById(id);
    button.addEventListener('pointerdown', e=>{e.preventDefault();button.setPointerCapture(e.pointerId);touch[key]=true;});
    button.addEventListener('pointerup',()=>touch[key]=false);
    button.addEventListener('pointercancel',()=>touch[key]=false);
  }
  return {
    pointer,touch,
    down:(...codes)=>codes.some(code=>held.has(code)),
    take(code){const yes=pressed.has(code);pressed.delete(code);return yes;},
    axes(){return {x:Math.max(-1,Math.min(1,(held.has('KeyD')||held.has('ArrowRight')?1:0)-(held.has('KeyA')||held.has('ArrowLeft')?1:0)+touch.x)),y:Math.max(-1,Math.min(1,(held.has('KeyS')||held.has('ArrowDown')?1:0)-(held.has('KeyW')||held.has('ArrowUp')?1:0)+touch.y))};},
    endFrame(){pressed.clear();pointer.clicked=false;}
  };
}
