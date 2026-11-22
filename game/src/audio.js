// All sound is synthesized on demand; the city carries no audio assets.
export function createAudio() {
  let context=null,master=null,engine=null,engineGain=null,siren=null,sirenGain=null;
  let muted=false;
  function unlock(){
    if(!context){
      context=new (window.AudioContext||window.webkitAudioContext)();
      master=context.createGain();master.gain.value=0.24;master.connect(context.destination);
      engine=context.createOscillator();engine.type='sawtooth';engineGain=context.createGain();engineGain.gain.value=0;engine.connect(engineGain);engineGain.connect(master);engine.start();
      siren=context.createOscillator();siren.type='sine';sirenGain=context.createGain();sirenGain.gain.value=0;siren.connect(sirenGain);sirenGain.connect(master);siren.start();
    }
    if(context.state==='suspended')context.resume();
  }
  function tone(frequency,duration=0.15,type='sine',volume=0.3,delay=0){
    if(!context)return;
    const at=context.currentTime+delay,osc=context.createOscillator(),gain=context.createGain();
    osc.type=type;osc.frequency.setValueAtTime(frequency,at);gain.gain.setValueAtTime(volume,at);gain.gain.exponentialRampToValueAtTime(0.001,at+duration);osc.connect(gain);gain.connect(master);osc.start(at);osc.stop(at+duration);
  }
  return {
    unlock,
    get muted(){return muted;},
    toggle(){muted=!muted;if(master)master.gain.setTargetAtTime(muted?0:0.24,context.currentTime,0.03);return muted;},
    play(name){
      if(name==='shot'){tone(80,0.12,'sawtooth',0.6);tone(720,0.04,'square',0.14);}
      else if(name==='crash'){tone(48,0.25,'sawtooth',0.7);tone(95,0.18,'triangle',0.5);}
      else if(name==='mission'){[392,494,587,784].forEach((f,i)=>tone(f,0.35,'triangle',0.45,i*0.12));}
      else if(name==='pickup'){tone(660);tone(990,0.2,'sine',0.3,0.08);}
      else tone(220,0.1,'triangle');
    },
    update(speed,wanted,time,playing=true){
      if(!context)return;
      engine.frequency.setTargetAtTime(35+Math.abs(speed)*0.65,context.currentTime,0.08);
      engineGain.gain.setTargetAtTime(playing&&speed!==null?0.08:0,context.currentTime,0.1);
      siren.frequency.setTargetAtTime(600+Math.sin(time*5)*220,context.currentTime,0.04);
      sirenGain.gain.setTargetAtTime(playing&&wanted?0.045:0,context.currentTime,0.1);
    }
  };
}
