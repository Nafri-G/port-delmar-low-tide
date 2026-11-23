// Every sound is synthesized with WebAudio; the game ships no audio files.
// Two oscillators run continuously (engine hum and police siren) with their
// gains driven by the game state; one-shot effects are short envelopes.
// M is mute: the master gain is driven to zero, not the oscillators stopped,
// so unmuting resumes instantly with no re-creation.
export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;

  function unlock() {
    if (!context) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      context = new AudioCtx();
      master = context.createGain();
      master.gain.value = 0.24;
      master.connect(context.destination);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    }
    if (context.state === 'suspended') context.resume();
  }

  function tone(frequency, duration = 0.15, type = 'sine', volume = 0.3, delay = 0) {
    if (!context) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration);
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggle() {
      muted = !muted;
      if (master) {
        master.gain.setTargetAtTime(muted ? 0 : 0.24, context.currentTime, 0.03);
      }
      return muted;
    },
    play(name) {
      if (name === 'shot') {
        tone(80, 0.12, 'sawtooth', 0.6);
        tone(720, 0.04, 'square', 0.14);
      } else if (name === 'crash') {
        tone(48, 0.25, 'sawtooth', 0.7);
        tone(95, 0.18, 'triangle', 0.5);
      } else if (name === 'mission') {
        [392, 494, 587, 784].forEach((freq, i) => tone(freq, 0.35, 'triangle', 0.45, i * 0.12));
      } else if (name === 'pickup') {
        tone(660);
        tone(990, 0.2, 'sine', 0.3, 0.08);
      } else {
        tone(220, 0.1, 'triangle');
      }
    },
    update(speed, wanted, time, playing = true) {
      if (!context) return;
      const now = context.currentTime;
      engineOsc.frequency.setTargetAtTime(35 + Math.abs(speed) * 0.65, now, 0.08);
      engineGain.gain.setTargetAtTime(playing && speed !== null ? 0.08 : 0, now, 0.1);
      sirenOsc.frequency.setTargetAtTime(600 + Math.sin(time * 5) * 220, now, 0.04);
      sirenGain.gain.setTargetAtTime(playing && wanted ? 0.045 : 0, now, 0.1);
    },
  };
}
