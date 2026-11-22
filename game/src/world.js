import {CITY,CAR,PEDESTRIAN} from './config.js';
import {createRandom} from './random.js';

const PAINT=['#c85d4c','#57a5a2','#e9bf68','#d3d6c8','#697f9c','#b37187'];
const ROOFS=['#dfc7a2','#e9d4b3','#9cbbb0','#d4a99b','#b6c5c7'];
const names=['MOTEL SOL','DELMAR STORAGE','LUNA CAFÉ','TROPIC LAUNDRY','BAHIA RADIO','SUNMARKET','CASA MAR','EL FARO'];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function createWorld(seed=1) {
  const rng=createRandom(seed);
  const w={seed,rng,width:CITY.width,height:CITY.height,roads:[],buildings:[],parks:[],trees:[],props:[],cars:[],peds:[],pickups:[],lights:[],time:0};
  for(let x=160;x<CITY.coast;x+=320)w.roads.push({x:x-44,y:0,w:88,h:CITY.height,axis:'v'});
  for(let y=160;y<CITY.height;y+=320)w.roads.push({x:0,y:y-44,w:CITY.coast,h:88,axis:'h'});
  // Each block has a continuous pavement ring and four separate accessible buildings.
  for(let x=220;x<2200;x+=320)for(let y=220;y<2100;y+=320){
    if((x/320|0)+(y/320|0)===3 || rng()<0.15){
      w.parks.push({x,y,w:200,h:200});
      for(let k=0;k<8;k++)w.trees.push({x:x+15+rng()*170,y:y+15+rng()*170,r:16+rng()*6});
      continue;
    }
    for(let a=0;a<2;a++)for(let b=0;b<2;b++){
      const bw=72+rng()*15,bh=68+rng()*20;
      w.buildings.push({x:x+a*103+5,y:y+b*103+5,w:bw,h:bh,color:PAINT[(rng()*PAINT.length)|0],roof:ROOFS[(rng()*ROOFS.length)|0],name:names[(rng()*names.length)|0],height:8+rng()*9});
    }
    for(let k=0;k<3;k++)w.trees.push({x:x+12+k*80,y:y-8,r:15+rng()*6});
  }
  for(let x=160;x<CITY.coast;x+=320)for(let y=160;y<CITY.height;y+=320){
    w.lights.push({x,y,phase:0});
    w.props.push({x:x+54,y:y+54,type:'lamp',angle:0});
    if(rng()<0.5)w.props.push({x:x-60,y:y+92,type:'bench',angle:Math.PI/2});
  }
  for(let y=80;y<CITY.height;y+=110){
    w.trees.push({x:2225,y,r:21});
    w.props.push({x:2320,y:y+35,type:'umbrella',angle:rng()*6.28});
  }
  // Parked cars occupy the curb; traffic starts in lanes pointed along the road.
  for(let i=0;i<46;i++){
    const horizontal=i%2===0,road=160+320*((rng()*6)|0),along=80+rng()*2040,parked=i%3===0;
    const angle=horizontal?(i%4===0?0:Math.PI):(i%4===1?Math.PI/2:-Math.PI/2);
    const offset=parked?34:19;
    w.cars.push({id:`car-${i}`,x:horizontal?along:road+(angle>0?-offset:offset),y:horizontal?road+(angle===0?offset:-offset):along,angle,speed:parked?0:60+rng()*35,health:100,color:PAINT[i%PAINT.length],kind:'civilian',parked,stolen:false,controlled:false,turnCooldown:0});
  }
  Object.assign(w.cars[0],{x:505,y:392,angle:-Math.PI/2,parked:true,speed:0,color:'#e9b956'});
  w.cars.push({id:'courier',x:1440,y:1072,angle:0,speed:0,health:100,color:'#efb746',kind:'civilian',parked:true,stolen:false,controlled:false,turnCooldown:0});
  for(let i=0;i<PEDESTRIAN.count;i++){
    const horizontal=i%2===0,road=160+320*((rng()*7)|0),along=30+rng()*2110,side=rng()<0.5?-58:58;
    const x=horizontal?along:road+side,y=horizontal?road+side:along;
    if(x>2200)continue;
    w.peds.push({id:`ped-${i}`,x,y,homeX:x,homeY:y,angle:horizontal?0:Math.PI/2,health:100,panic:0,color:PAINT[i%PAINT.length],axis:horizontal?'h':'v',direction:rng()<0.5?-1:1,respawn:0});
  }
  for(const p of [{x:430,y:392,type:'health'},{x:552,y:392,type:'ammo'},...Array.from({length:18},(_,i)=>({x:160+320*(i%6)+58,y:160+320*(i/6|0)+105,type:i%2?'ammo':'health'}))])w.pickups.push({...p,active:true,respawn:0});
  return w;
}
export function solid(w,x,y,r=10){
  if(x-r<12||y-r<12||x+r>2390||y+r>w.height-12)return true;
  return w.buildings.some(b=>x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h);
}
export function moveEntity(w,e,dx,dy,r=10){
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/8));let hit=false;
  for(let i=0;i<steps;i++){
    if(!solid(w,e.x+dx/steps,e.y,r))e.x+=dx/steps;else hit=true;
    if(!solid(w,e.x,e.y+dy/steps,r))e.y+=dy/steps;else hit=true;
  }
  return hit;
}
export function nearestCar(w,x,y,max=64){
  let found=null,near=max;
  for(const c of w.cars){const d=Math.hypot(c.x-x,c.y-y);if(c.health>0&&!c.controlled&&d<near){found=c;near=d;}}
  return found;
}
export function lightGreen(w,x,y,axis){
  const cycle=(w.time+Math.round(x/320)*1.7+Math.round(y/320)*0.8)%16;
  return axis==='h'?cycle<7:cycle>=8&&cycle<15;
}
export function roadPoint(w,x,y){
  const gx=Math.max(160,Math.min(2080,Math.round((x-160)/320)*320));
  const gy=Math.max(160,Math.min(2080,Math.round((y-160)/320)*320));
  return Math.abs(x-gx)<Math.abs(y-gy)?{x:gx+19,y:Math.max(45,Math.min(2195,y)),angle:-Math.PI/2}:{x:Math.max(45,Math.min(2200,x)),y:gy+19,angle:0};
}
export function lineOfSight(w,a,b){
  const count=Math.ceil(distance(a,b)/20);
  for(let i=1;i<count;i++){
    const x=a.x+(b.x-a.x)*i/count,y=a.y+(b.y-a.y)*i/count;
    if(w.buildings.some(v=>x>v.x&&x<v.x+v.w&&y>v.y&&y<v.y+v.h))return false;
  }
  return true;
}
export function updateWorld(w,dt,target){
  w.time+=dt;
  for(const c of w.cars){
    if(c.controlled||c.kind==='police'||c.parked||c.health<=0)continue;
    c.turnCooldown=Math.max(0,c.turnCooldown-dt);
    const horizontal=Math.abs(Math.cos(c.angle))>0.7,axis=horizontal?'h':'v';
    const sign=horizontal?Math.sign(Math.cos(c.angle)):Math.sign(Math.sin(c.angle));
    const along=horizontal?c.x:c.y;
    const next=160+320*Math.round((along+sign*60-160)/320);
    const ahead=(next-along)*sign;
    const crossX=horizontal?next:160+320*Math.round((c.x-160)/320);
    const crossY=horizontal?160+320*Math.round((c.y-160)/320):next;
    let desired=82;
    if(ahead>24&&ahead<80&&!lightGreen(w,crossX,crossY,axis))desired=0;
    for(const other of w.cars){
      if(other===c||other.health<=0)continue;
      const dx=other.x-c.x,dy=other.y-c.y;
      const forward=dx*Math.cos(c.angle)+dy*Math.sin(c.angle),side=Math.abs(-dx*Math.sin(c.angle)+dy*Math.cos(c.angle));
      if(forward>0&&forward<64&&side<25)desired=Math.min(desired,Math.max(0,(forward-36)*2));
    }
    c.speed+=(desired-c.speed)*Math.min(1,dt*2.5);
    if(ahead>=-3&&ahead<3&&c.turnCooldown===0&&w.rng()<0.018){
      c.angle+=w.rng()<0.5?Math.PI/2:-Math.PI/2;c.turnCooldown=4;
    }
    const hit=moveEntity(w,c,Math.cos(c.angle)*c.speed*dt,Math.sin(c.angle)*c.speed*dt,15);
    if(hit||c.x<35||c.x>2205||c.y<35||c.y>2205){c.angle+=Math.PI;c.speed=25;c.turnCooldown=3;}
  }
  for(const p of w.peds){
    if(p.cop)continue;
    if(p.health<=0){p.respawn=(p.respawn||18)-dt;if(p.respawn<=0){p.health=100;p.x=p.homeX;p.y=p.homeY;p.respawn=0;}continue;}
    p.panic=Math.max(0,p.panic-dt);
    let dx=0,dy=0;
    if(p.panic>0&&target){const angle=Math.atan2(p.y-target.y,p.x-target.x);dx=Math.cos(angle)*80;dy=Math.sin(angle)*80;p.angle=angle;}
    else {const v=PEDESTRIAN.speed*p.direction;if(p.axis==='h')dx=v;else dy=v;p.angle=Math.atan2(dy,dx);}
    if(moveEntity(w,p,dx*dt,dy*dt,7)||p.x<30||p.x>2205||p.y<30||p.y>2205)p.direction*=-1;
    // Sidewalk walkers reverse before entering the carriageway at crossings.
    if(p.panic===0&&Math.abs((p.axis==='h'?p.x:p.y)-(p.axis==='h'?p.homeX:p.homeY))>125)p.direction*=-1;
  }
  for(const p of w.pickups)if(!p.active){p.respawn-=dt;if(p.respawn<=0)p.active=true;}
}
