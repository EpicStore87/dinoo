const Sound = (() => {
  let ctx = null;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function beep({ freq = 440, dur = 0.08, type = 'square', vol = 0.06, slideTo = null }) {
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
      gain.gain.setValueAtTime(vol, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      osc.connect(gain).connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + dur);
    } catch (e) { /* áudio não disponível, tudo bem */ }
  }

  return {
    jump: () => beep({ freq: 340, slideTo: 560, dur: 0.09, type: 'square' }),
    duck: () => beep({ freq: 180, dur: 0.05, type: 'triangle', vol: 0.04 }),
    hit: () => beep({ freq: 160, slideTo: 40, dur: 0.28, type: 'sawtooth', vol: 0.09 }),
    point: () => beep({ freq: 660, slideTo: 880, dur: 0.07, type: 'square', vol: 0.05 }),
    shield: () => beep({ freq: 500, slideTo: 900, dur: 0.18, type: 'sine', vol: 0.07 }),
    countdown: () => beep({ freq: 400, dur: 0.1, type: 'square', vol: 0.06 }),
    go: () => beep({ freq: 500, slideTo: 1000, dur: 0.2, type: 'square', vol: 0.08 }),
  };
})();
