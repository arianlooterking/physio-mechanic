import { native } from './platform';
import { getState } from './store';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!getState().profile.sound) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.12): void {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  correct() {
    tone(784, 0, 0.14, 'triangle', 0.14);
    tone(1175, 0.09, 0.22, 'triangle', 0.12);
  },
  wrong() {
    tone(220, 0, 0.18, 'sawtooth', 0.05);
    tone(165, 0.1, 0.24, 'sawtooth', 0.05);
    vibrate(40);
  },
  tap() {
    tone(660, 0, 0.05, 'sine', 0.05);
  },
  flip() {
    tone(520, 0, 0.06, 'triangle', 0.06);
    tone(700, 0.04, 0.06, 'triangle', 0.05);
  },
  complete() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.28, 'triangle', 0.12));
  },
  aha() {
    [587, 880, 1175].forEach((f, i) => tone(f, i * 0.07, 0.3, 'sine', 0.1));
  },
};

export function vibrate(ms: number): void {
  if (native.haptic) return native.haptic(ms);
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}
