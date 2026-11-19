export const motionTokens = {
  duration: { fast: 150, base: 250, slow: 400, set: 1200 },
  easing: {
    out: 'cubic-bezier(0.16, 1, 0.3, 1)',
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    door: 'cubic-bezier(0.7, 0, 0.2, 1)',
  },
} as const;

export const motionCssVariables = {
  duration: {
    fast: `var(--dur-fast)`,
    base: `var(--dur-base)`,
    slow: `var(--dur-slow)`,
    set: `var(--dur-set)`,
  },
} as const;
