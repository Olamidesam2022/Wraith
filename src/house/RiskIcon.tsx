import type { RiskKind } from '../types';

interface RiskIconProps {
  kind: RiskKind;
  size?: number;
  tone?: 'bronze' | 'umber' | 'oxblood';
  className?: string;
  x?: number;
  y?: number;
}

export function RiskIcon({ kind, size = 22, tone = 'oxblood', className, x, y }: RiskIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={`risk-icon risk-icon--${tone}${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      x={x}
      y={y}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle className="risk-icon__plate" cx="12" cy="12" r="10.5" />
      {kind === 'ghost' && <>
        <path d="M5 20V11a7 7 0 0 1 14 0v9l-3-2-4 2-4-2-3 2Z" />
        <path d="M9 11h.01M15 11h.01" />
      </>}
      {kind === 'cobweb' && <>
        <path d="M4 4v16h16M4 4l16 16M4 12h16M12 4v16M7 7l10 10M7 17 17 7" />
        <path d="M4 8c3 0 4 1 4 4s1 4 4 4 4 1 4 4M8 4c0 3 1 4 4 4s4 1 4 4 1 4 4 4" />
      </>}
      {kind === 'poltergeist' && <>
        <path d="M13 2 5 13h6l-1 9 9-12h-6l1-8Z" />
        <circle cx="12" cy="12" r="10" />
      </>}
    </svg>
  );
}

export function LanternIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M10 3v3l-4 4v9h12v-9l-4-4V3M6 10h12M12 13v3" />
    </svg>
  );
}
