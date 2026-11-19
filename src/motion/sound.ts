'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { soundConfig } from '../config';

export function useSound() {
  const [enabled, setEnabled] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const play = useCallback(() => {
    if (!enabled || typeof window === 'undefined' || !window.AudioContext) return;
    const audio = context.current ?? (context.current = new AudioContext());
    if (audio.state === 'suspended') void audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = soundConfig.cueFrequencyHz;
    gain.gain.setValueAtTime(soundConfig.maximumGain, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + soundConfig.cueDurationMs / 1000);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + soundConfig.cueDurationMs / 1000);
  }, [enabled]);
  useEffect(() => () => { if (context.current) void context.current.close(); }, []);
  return { enabled, toggle: () => setEnabled((value) => !value), play };
}
