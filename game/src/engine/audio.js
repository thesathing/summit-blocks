// Procedural Web Audio: wind, footsteps, jumps, coin chimes, checkpoint
// fanfares and a light pentatonic pluck melody. No sound files are loaded;
// every sound is synthesized. The AudioContext is created only after the
// player presses a button, so headless play never errors.
const BASE_FREQ = 220;

export function createAudio() {
  let ctx = null;
  let master = null;
  let windGain = null;
  let muted = false;
  let musicTimer = 0;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Wind: looped filtered noise.
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      windGain = ctx.createGain();
      windGain.gain.value = 0.03;
      noise.connect(filter);
      filter.connect(windGain);
      windGain.connect(master);
      noise.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function note(midi, dur, vol = 0.16, when = 0) {
    const freq = BASE_FREQ * Math.pow(2, midi / 12);
    tone(freq, dur, 'triangle', vol, when);
    tone(freq * 2, dur * 0.6, 'sine', vol * 0.35, when);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    click() {
      if (ensure()) tone(660, 0.08, 'sine', 0.2);
    },
    jump() {
      if (ensure()) tone(280, 0.22, 'sine', 0.22, 0, 640);
    },
    land() {
      if (ensure()) tone(140, 0.12, 'triangle', 0.22, 0, 70);
    },
    step() {
      if (ensure()) tone(95 + Math.random() * 40, 0.06, 'triangle', 0.07);
    },
    coin() {
      if (ensure()) {
        tone(987, 0.12, 'sine', 0.22);
        tone(1318, 0.22, 'sine', 0.22, 0.07);
      }
    },
    checkpoint() {
      if (ensure()) {
        [0, 4, 7, 12].forEach((n, i) => note(n, 0.35, 0.18, i * 0.09));
      }
    },
    fall() {
      if (ensure()) tone(420, 0.5, 'sawtooth', 0.12, 0, 90);
    },
    victory() {
      if (ensure()) {
        [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => note(n, 0.5, 0.2, i * 0.1));
      }
    },
    gameover() {
      if (ensure()) {
        [12, 7, 4, 0].forEach((n, i) => note(n - 12, 0.5, 0.18, i * 0.12));
      }
    },
    setWind(level) {
      if (windGain) windGain.gain.value = 0.02 + level * 0.06;
    },
    // Light pentatonic plucks, one note per beat while playing.
    updateMusic(dt, playing) {
      if (!ctx || muted || !playing) return;
      musicTimer += dt;
      if (musicTimer > 0.42) {
        musicTimer = 0;
        const seq = [0, 2, 4, 7, 9, 7, 4, 2, 0, 4, 7, 9, 12, 9, 7, 4];
        note(seq[musicStep % seq.length], 0.5, 0.07);
        musicStep += 1;
      }
    },
  };
}
