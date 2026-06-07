interface EarringIconProps {
  color: string;
  className?: string;
}

export function EarringIcon({ color, className = 'w-16 h-24' }: EarringIconProps) {
  return (
    <svg
      viewBox="0 0 60 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Ear wire hook */}
      <path
        d="M30 6 Q44 6 44 18 Q44 30 30 30"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Stem */}
      <line x1="30" y1="30" x2="30" y2="56" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Drop */}
      <ellipse cx="30" cy="72" rx="13" ry="15" stroke={color} strokeWidth="2" fill={color} fillOpacity="0.2" />
    </svg>
  );
}
